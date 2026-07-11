/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Sparkles, MapPin, Clock, DollarSign, Users, Compass, Star, 
  ExternalLink, Bookmark, MessageSquare, ArrowRight, CheckCircle2, 
  Zap, Heart, Info, RefreshCw, ChevronRight, Share2, Award, Plus
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Profile, Outing } from '../types';
import { Language } from '../data/translations';
import { useLocation } from '../contexts/LocationContext';
import LocationIndicator from './LocationIndicator';

interface AIRecommendationEngineProps {
  currentUser: Profile;
  lang: Language;
  onInitiateCreateOuting: (prefill: {
    title: string;
    description: string;
    category: string;
    location: string;
    googleMapsUrl: string;
  }) => void;
  onSelectOuting?: (outingId: string) => void;
}

interface RecommendedPlace {
  id: string;
  name: string;
  description: string;
  category: string;
  avgCost: string;
  address: string;
  rating: number;
  distanceKm: number;
  googleMapsUrl: string;
  imageUrl: string;
  socialReason: string;
}

interface RecommendedMate {
  id: string;
  name: string;
  avatar: string;
  archetype: string;
  mutualInterests: string[];
  matchScore: string;
  companionRating: number;
  reviewCount: number;
  lastReviewComment: string;
  status: string;
}

interface RecommendedTrip {
  id: string;
  title: string;
  destination: string;
  estimatedCostPerPerson: string;
  duration: string;
  optimalSize: string;
  planSteps: string[];
  vibe: string;
}

interface RecommendationResponse {
  learningExplanation: string;
  places: RecommendedPlace[];
  mates: RecommendedMate[];
  trips: RecommendedTrip[];
}

// Interaction Logging System for Continuous Learning
export interface InteractionLog {
  action: 'open_place' | 'save_place' | 'participate_outing';
  id: string;
  name: string;
  category: string;
  timestamp: string;
}

const LOCAL_LOGS_KEY = 'yallamate_recommendation_feedback_v1';

export function getInteractionLogs(): InteractionLog[] {
  try {
    const data = localStorage.getItem(LOCAL_LOGS_KEY);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    console.error('Failed to parse interaction logs:', e);
    return [];
  }
}

export function logUserInteraction(action: InteractionLog['action'], id: string, name: string, category: string) {
  try {
    const logs = getInteractionLogs();
    const newLog: InteractionLog = {
      action,
      id,
      name,
      category,
      timestamp: new Date().toISOString()
    };
    // Keep last 30 logs for memory efficiency
    const updated = [newLog, ...logs].slice(0, 30);
    localStorage.setItem(LOCAL_LOGS_KEY, JSON.stringify(updated));
    
    // Dispatch a custom event to notify components to update state
    window.dispatchEvent(new CustomEvent('yallamate_interaction_updated'));
  } catch (e) {
    console.error('Failed to write user interaction log:', e);
  }
}

export default function AIRecommendationEngine({ 
  currentUser, 
  lang, 
  onInitiateCreateOuting,
  onSelectOuting 
}: AIRecommendationEngineProps) {
  const isAr = lang === 'ar';
  const { coords: activeCoords, activeCity, address: ymAddress } = useLocation();

  // Filters state
  const [activityType, setActivityType] = useState<string>('All');
  const [budget, setBudget] = useState<string>('All');
  const [withWho, setWithWho] = useState<string>('All');

  // Recommendation engine state
  const [loading, setLoading] = useState(false);
  const [recs, setRecs] = useState<RecommendationResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savedPlaces, setSavedPlaces] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('yallamate_saved_recommendations');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Load interaction logs to render in the learning dashboard
  const [logs, setLogs] = useState<InteractionLog[]>([]);

  const loadLogs = () => {
    setLogs(getInteractionLogs());
  };

  useEffect(() => {
    loadLogs();
    const handleUpdate = () => loadLogs();
    window.addEventListener('yallamate_interaction_updated', handleUpdate);
    return () => window.removeEventListener('yallamate_interaction_updated', handleUpdate);
  }, []);

  const fetchRecommendations = async () => {
    setLoading(true);
    setError(null);
    try {
      const currentLogs = getInteractionLogs();
      const payload = {
        userId: currentUser?.id || 'anonymous',
        lat: activeCoords ? activeCoords[0] : null,
        lng: activeCoords ? activeCoords[1] : null,
        city: activeCity || currentUser?.city || currentUser?.location,
        lang,
        currentTime: new Date().toISOString(),
        activityType: activityType === 'All' ? '' : activityType,
        budget: budget === 'All' ? '' : budget,
        withWho: withWho === 'All' ? '' : withWho,
        interests: (currentUser?.interests || []).join(', '),
        interactionHistory: currentLogs
      };

      const res = await fetch('/api/yallamate/recommendations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error('API failed');
      const data = await res.json();
      if (data.ok && data.result) {
        setRecs(data.result);
      } else {
        throw new Error('Invalid format returned');
      }
    } catch (err: any) {
      console.error('[AIRecommendations] Fetch failed:', err);
      setError(isAr ? 'فشل الاتصال بمحرّك الاقتراحات الذكي. جاري عرض التوصيات الاحتياطية.' : 'Unable to reach the smart recommendation engine. Showing secure offline options.');
    } finally {
      setLoading(false);
    }
  };

  // Re-fetch recommendations when filters or location change
  useEffect(() => {
    fetchRecommendations();
  }, [activityType, budget, withWho, activeCity, activeCoords, lang]);

  const handleToggleSave = (placeId: string, name: string, category: string) => {
    let updated;
    const isCurrentlySaved = savedPlaces.includes(placeId);
    if (isCurrentlySaved) {
      updated = savedPlaces.filter(id => id !== placeId);
    } else {
      updated = [...savedPlaces, placeId];
      // Log for Continuous Learning
      logUserInteraction('save_place', placeId, name, category);
    }
    setSavedPlaces(updated);
    localStorage.setItem('yallamate_saved_recommendations', JSON.stringify(updated));
  };

  const handleOpenPlaceLink = (placeId: string, name: string, category: string, url: string) => {
    // Log for Continuous Learning
    logUserInteraction('open_place', placeId, name, category);
    window.open(url, '_blank');
  };

  const handleParticipateOuting = (trip: RecommendedTrip) => {
    // Log for Continuous Learning
    logUserInteraction('participate_outing', trip.id, trip.title, 'trip');
    
    // Prefill creating outing flow
    onInitiateCreateOuting({
      title: trip.title,
      description: isAr 
        ? `رحلة جماعية مميزة إلى ${trip.destination} للأصدقاء والرفقاء بنمط ${trip.vibe}. التكلفة التقريبية: ${trip.estimatedCostPerPerson}. المدة المقترحة: ${trip.duration}.` 
        : `A organized social trip to ${trip.destination} with a group of companions. Vibe: ${trip.vibe}. Cost estimation: ${trip.estimatedCostPerPerson}. Duration: ${trip.duration}.`,
      category: 'Social',
      location: trip.destination,
      googleMapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(trip.destination)}`
    });
  };

  const categories = [
    { key: 'All', labelAr: 'الكل', labelEn: 'All' },
    { key: 'Cafe', labelAr: 'مقهى ☕', labelEn: 'Cafes ☕' },
    { key: 'Restaurant', labelAr: 'مطعم 🍔', labelEn: 'Restaurants 🍔' },
    { key: 'Park', labelAr: 'منتزه 🌳', labelEn: 'Parks 🌳' },
    { key: 'Gaming', labelAr: 'ألعاب 🎮', labelEn: 'Gaming 🎮' },
    { key: 'Adventure', labelAr: 'مغامرة 🏔️', labelEn: 'Adventures 🏔️' }
  ];

  const budgets = [
    { key: 'All', labelAr: 'الكل', labelEn: 'All' },
    { key: 'low', labelAr: 'منخفضة 💵', labelEn: 'Low 💵' },
    { key: 'medium', labelAr: 'متوسطة 💳', labelEn: 'Medium 💳' },
    { key: 'high', labelAr: 'مرتفعة 💎', labelEn: 'Premium 💎' }
  ];

  const companions = [
    { key: 'All', labelAr: 'الكل', labelEn: 'All' },
    { key: 'solo', labelAr: 'بمفردي 🧘', labelEn: 'Solo 🧘' },
    { key: 'friends', labelAr: 'مع رفقاء 👥', labelEn: 'With Friends 👥' },
    { key: 'family', labelAr: 'مع عائلة 🏠', labelEn: 'With Family 🏠' }
  ];

  return (
    <div className="space-y-6 text-right">
      {/* Top Banner and Description */}
      <div className="bg-gradient-to-br from-indigo-900/40 via-slate-900 to-slate-950 p-6 rounded-3xl border border-indigo-500/20 shadow-xl relative overflow-hidden">
        <div className="absolute -top-12 -left-12 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-12 -right-12 w-48 h-48 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 relative z-10">
          <div className="space-y-1">
            <div className="flex items-center gap-2 justify-end">
              <span className="text-xs font-black text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2.5 py-1 rounded-full uppercase tracking-wider flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-indigo-400 animate-pulse" />
                <span>{isAr ? 'ذكاء اصطناعي تفاعلي متكامل' : 'GEMINI ACTIVE LEARNING'}</span>
              </span>
            </div>
            <h2 className="text-xl font-black text-white">
              {isAr ? 'محرّك الاقتراحات الاجتماعي الذكي' : 'Smart Social Recommendation Engine'}
            </h2>
            <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
              {isAr 
                ? 'بوصلة يالاميت المتقدمة! يدمج موقعك الفعلي، تفضيلاتك الحالية، والميزانية ليقترح لك أماكن حقيقية، رفقاء متوافقين لاهتماماتك، وتخطيط كامل للرحلة. يتعلم النظام تلقائياً من الأماكن والرحلات التي تفتحها أو تحفظها!'
                : 'YallaMate’s supreme companion router! Integrates your GPS telemetry, live filters, and companion rating reviews to propose ideal places, matching mates, and curated outings. The engine learns and reshapes its results dynamically based on your interactions.'}
            </p>
          </div>

          <div className="shrink-0 flex items-center gap-2 justify-end md:justify-start">
            <LocationIndicator lang={lang} />
          </div>
        </div>
      </div>

      {/* Filter Matrix Section */}
      <div className="bg-white border border-slate-100 p-5 rounded-2xl shadow-xs space-y-4">
        <span className="text-[10px] font-black text-indigo-600 tracking-wider uppercase block border-b border-slate-50 pb-2">
          🎯 {isAr ? 'تحديد معايير الاقتراح الفوري' : 'LIVE SUGGESTION CRITERIA'}
        </span>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Category Selector */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">
              {isAr ? 'نوع النشاط المفضّل' : 'Favorite Activity Type'}
            </label>
            <div className="flex flex-wrap gap-1.5 justify-end">
              {categories.map(c => (
                <button
                  key={c.key}
                  onClick={() => setActivityType(c.key)}
                  className={`px-3 py-1.5 rounded-xl text-[10px] font-bold transition-all cursor-pointer ${
                    activityType === c.key 
                      ? 'bg-indigo-600 text-white shadow-xs' 
                      : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {isAr ? c.labelAr : c.labelEn}
                </button>
              ))}
            </div>
          </div>

          {/* Budget Selector */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">
              {isAr ? 'الميزانية المتوقعة' : 'Expected Budget Range'}
            </label>
            <div className="flex flex-wrap gap-1.5 justify-end">
              {budgets.map(b => (
                <button
                  key={b.key}
                  onClick={() => setBudget(b.key)}
                  className={`px-3 py-1.5 rounded-xl text-[10px] font-bold transition-all cursor-pointer ${
                    budget === b.key 
                      ? 'bg-indigo-600 text-white shadow-xs' 
                      : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {isAr ? b.labelAr : b.labelEn}
                </button>
              ))}
            </div>
          </div>

          {/* Companion Circle Selector */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">
              {isAr ? 'طبيعة الرفقة والمجموعة' : 'Target Outing Cohort'}
            </label>
            <div className="flex flex-wrap gap-1.5 justify-end">
              {companions.map(c => (
                <button
                  key={c.key}
                  onClick={() => setWithWho(c.key)}
                  className={`px-3 py-1.5 rounded-xl text-[10px] font-bold transition-all cursor-pointer ${
                    withWho === c.key 
                      ? 'bg-indigo-600 text-white shadow-xs' 
                      : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {isAr ? c.labelAr : c.labelEn}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Learning Status Explanation */}
      {recs?.learningExplanation && (
        <motion.div 
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-teal-500/10 border border-teal-500/20 p-4 rounded-2xl flex items-start gap-3 justify-end text-right"
        >
          <div className="space-y-1 flex-1">
            <div className="flex items-center gap-1.5 justify-end">
              <span className="text-[9px] font-black text-teal-700 bg-teal-500/20 px-2 py-0.5 rounded uppercase">
                {isAr ? 'تعلُّم نشط مستمر' : 'CONTINUOUS LEARNING INSIGHT'}
              </span>
              <Award className="w-4 h-4 text-teal-600" />
            </div>
            <p className="text-xs text-slate-700 font-semibold leading-relaxed">
              {recs.learningExplanation}
            </p>
          </div>
          <span className="text-xl">💡</span>
        </motion.div>
      )}

      {/* Loading Overlay */}
      <AnimatePresence mode="wait">
        {loading ? (
          <motion.div 
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="py-16 text-center space-y-4"
          >
            <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto" />
            <div className="space-y-1">
              <p className="text-sm font-black text-slate-800 animate-pulse">
                {isAr ? 'جاري تحليل إشارات موقعك وسجل تفاعلاتك لتحديث التوصيات...' : 'Analyzing coordinate feeds and interaction logs...'}
              </p>
              <p className="text-[10px] text-slate-400">
                {isAr ? 'يتم جلب أماكن حقيقية خالية من البيانات الوهمية بدعم Gemini' : 'Fetching authentic grounded locations via live intelligence'}
              </p>
            </div>
          </motion.div>
        ) : error && !recs ? (
          <div className="p-8 text-center bg-rose-50 border border-rose-100 rounded-3xl space-y-3">
            <p className="text-sm font-bold text-rose-700">{error}</p>
            <button 
              onClick={fetchRecommendations}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-black rounded-xl shadow-md transition-colors"
            >
              {isAr ? 'إعادة المحاولة' : 'Retry Connections'}
            </button>
          </div>
        ) : (
          <motion.div 
            key="results"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-8"
          >
            {/* SUGGESTED PLACES (اقتراح الأماكن) */}
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full font-mono">
                  {recs?.places?.length || 0} {isAr ? 'أماكن حقيقية' : 'Grounded Venues'}
                </span>
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-indigo-600 animate-pulse" />
                  <span>{isAr ? 'الأماكن المقترحة لك' : 'Tailored Grounded Spots'}</span>
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {recs?.places.map((place) => {
                  const isSaved = savedPlaces.includes(place.id);
                  return (
                    <div 
                      key={place.id}
                      className="bg-white border border-slate-100 rounded-3xl overflow-hidden shadow-xs hover:shadow-lg hover:border-indigo-500/30 transition-all flex flex-col group"
                    >
                      <div className="h-44 w-full relative overflow-hidden bg-slate-150">
                        <img 
                          src={place.imageUrl || 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&w=400&q=80'} 
                          alt={place.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                        <div className="absolute top-3 inset-x-3 flex justify-between items-center">
                          <button
                            onClick={() => handleToggleSave(place.id, place.name, place.category)}
                            className={`w-8 h-8 rounded-full flex items-center justify-center border transition-all cursor-pointer shadow-sm ${
                              isSaved 
                                ? 'bg-rose-500 border-rose-600 text-white' 
                                : 'bg-white/95 border-slate-200 text-slate-600 hover:text-rose-500'
                            }`}
                          >
                            <Bookmark className="w-3.5 h-3.5 fill-current" />
                          </button>
                          
                          <span className="px-2.5 py-1 bg-indigo-600 text-white text-[9px] font-black rounded-full uppercase shadow-xs">
                            {place.category}
                          </span>
                        </div>

                        <div className="absolute bottom-3 left-3">
                          <span className="flex items-center gap-0.5 text-[10px] font-black text-amber-400 bg-black/70 backdrop-blur-xs px-2 py-0.5 rounded-lg border border-white/10">
                            <Star className="w-3 h-3 fill-current" /> {place.rating}
                          </span>
                        </div>
                      </div>

                      <div className="p-4 space-y-3 flex-1 flex flex-col justify-between text-right">
                        <div className="space-y-1">
                          <h4 className="text-xs font-black text-slate-900 line-clamp-1">{place.name}</h4>
                          <p className="text-[10px] text-slate-500 font-bold flex items-center gap-1 justify-end">
                            <span>{place.address}</span>
                            <MapPin className="w-3 h-3 text-slate-400" />
                          </p>
                          <p className="text-[10px] text-slate-600 leading-relaxed font-medium mt-1 line-clamp-2">
                            {place.description}
                          </p>
                        </div>

                        <div className="pt-2 border-t border-slate-50 space-y-2">
                          <div className="flex justify-between items-center text-[9px] font-extrabold">
                            <span className="text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">{place.avgCost}</span>
                            <span className="text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">{place.distanceKm} KM {isAr ? 'منك' : 'away'}</span>
                          </div>

                          <p className="text-[9px] text-teal-600 bg-teal-50 p-2 rounded-xl border border-teal-100 font-bold leading-tight">
                            🧠 {place.socialReason}
                          </p>

                          <button
                            onClick={() => handleOpenPlaceLink(place.id, place.name, place.category, place.googleMapsUrl)}
                            className="w-full py-1.5 bg-slate-50 hover:bg-indigo-50 hover:text-indigo-600 border border-slate-200 text-slate-700 text-[10px] font-bold rounded-xl transition-all flex items-center justify-center gap-1 cursor-pointer"
                          >
                            <ExternalLink className="w-3 h-3" />
                            <span>{isAr ? 'فتح في خرائط جوجل' : 'View on Google Maps'}</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* SUGGESTED MATES (اقتراح الأشخاص) */}
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full font-mono">
                  {recs?.mates?.length || 0} {isAr ? 'شركاء متوافقين' : 'Matching Companions'}
                </span>
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                  <Users className="w-4 h-4 text-emerald-600" />
                  <span>{isAr ? 'رفقاء مقترحين لك' : 'Recommended Companion Mates'}</span>
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {recs?.mates.map((mate) => (
                  <div 
                    key={mate.id}
                    className="bg-white border border-slate-100 rounded-3xl p-4 shadow-xs hover:shadow-md hover:border-emerald-500/20 transition-all space-y-4 text-right flex flex-col justify-between"
                  >
                    <div className="flex items-start justify-between">
                      <span className="px-2 py-0.5 bg-emerald-50 border border-emerald-100 text-emerald-600 text-[9px] font-black rounded-lg">
                        {mate.matchScore} {isAr ? 'طاقة توافق' : 'Match Score'}
                      </span>
                      
                      <div className="flex items-center gap-2.5 justify-end">
                        <div className="text-right">
                          <h4 className="text-xs font-black text-slate-900 flex items-center gap-1 justify-end">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse inline-block" />
                            <span>{mate.name}</span>
                          </h4>
                          <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">{mate.archetype}</span>
                        </div>
                        <div className="w-10 h-10 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-center text-xl shadow-xs">
                          {mate.avatar}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex flex-wrap gap-1 justify-end">
                        {mate.mutualInterests.map((interest, index) => (
                          <span 
                            key={index}
                            className="px-2 py-0.5 bg-indigo-50 border border-indigo-100/30 text-indigo-600 text-[8px] font-bold rounded-md"
                          >
                            # {interest}
                          </span>
                        ))}
                      </div>

                      {/* Previous Review Comment & Score */}
                      <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 space-y-1.5">
                        <div className="flex justify-between items-center text-[9px] font-black">
                          <span className="text-slate-400">({mate.reviewCount} {isAr ? 'تقييمات سابقة' : 'companion reviews'})</span>
                          <span className="text-amber-500 flex items-center gap-0.5">
                            <Star className="w-3 h-3 fill-current" /> {mate.companionRating}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-600 font-medium italic leading-relaxed">
                          💬 "{mate.lastReviewComment}"
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        // Log user action
                        logUserInteraction('open_place', mate.id, mate.name, 'companion_profile');
                        // Use messaging link or profiles Preview if set
                        if (onSelectOuting) {
                          // Simple mock to trigger profile preview
                          alert(isAr ? `تنبيه: يمكنك بدء دردشة مباشرة مع ${mate.name} من قائمة الرسائل في الأسفل لتنسيق الطلعة!` : `Tip: You can find ${mate.name} in your messaging section or send them a group beacon to organize a social meet!`);
                        }
                      }}
                      className="w-full py-2 bg-emerald-500/10 hover:bg-emerald-500 text-emerald-600 hover:text-white text-[10px] font-black rounded-xl border border-emerald-500/20 transition-all flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <span>💬</span>
                      <span>{isAr ? 'طلب التجمع والدردشة' : 'Coordinate & Connect'}</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* SUGGESTED OUTINGS/TRIPS (اقتراح الرحلات) */}
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full font-mono">
                  {recs?.trips?.length || 0} {isAr ? 'مسارات جاهزة' : 'Planned Itineraries'}
                </span>
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                  <Zap className="w-4 h-4 text-amber-500 animate-pulse" />
                  <span>{isAr ? 'الرحلات والمسارات المقترحة للمجموعة' : 'Curated Group Outings & Trips'}</span>
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {recs?.trips.map((trip) => (
                  <div 
                    key={trip.id}
                    className="bg-white border border-slate-100 rounded-3xl p-5 shadow-xs hover:shadow-lg hover:border-amber-500/30 transition-all space-y-4 text-right flex flex-col justify-between"
                  >
                    <div className="space-y-2">
                      <div className="flex justify-between items-start">
                        <div className="flex gap-1.5 text-[9px] font-extrabold text-slate-500">
                          <span className="bg-slate-50 px-2 py-0.5 rounded flex items-center gap-1">
                            <Clock className="w-3 h-3" /> {trip.duration}
                          </span>
                          <span className="bg-slate-50 px-2 py-0.5 rounded flex items-center gap-1">
                            <Users className="w-3 h-3" /> {trip.optimalSize}
                          </span>
                        </div>
                        <h4 className="text-xs font-black text-slate-900">{trip.title}</h4>
                      </div>

                      <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 space-y-1">
                        <span className="text-[9px] font-extrabold text-slate-400 block">{isAr ? 'المكان المستهدف والوجهة' : 'Target Venue Destination'}</span>
                        <p className="text-xs font-black text-slate-800 flex items-center gap-1 justify-end">
                          <span>📍 {trip.destination}</span>
                        </p>
                      </div>

                      {/* Iterative plan steps */}
                      <div className="space-y-1.5">
                        <span className="text-[9px] font-extrabold text-slate-400 block mb-1">{isAr ? 'خطة الجولة خطوة بخطوة' : 'Itinerary Milestones'}</span>
                        <div className="space-y-2 text-right">
                          {trip.planSteps.map((step, idx) => (
                            <div key={idx} className="flex items-start gap-2 justify-end text-right">
                              <span className="text-[10px] text-slate-700 font-bold">{step}</span>
                              <span className="w-5 h-5 bg-indigo-50 text-indigo-600 text-[10px] font-black rounded-full flex items-center justify-center shrink-0">
                                {idx + 1}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-50 flex items-center justify-between">
                      <button
                        onClick={() => handleParticipateOuting(trip)}
                        className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 text-[10px] font-black rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>{isAr ? 'تبني هذا المسار وإنشاء الرحلة' : 'Adopt and Launch Outing'}</span>
                      </button>

                      <div className="text-right">
                        <span className="text-[9px] font-extrabold text-slate-400 block">{isAr ? 'التكلفة المقدرة للشخص' : 'Est. Cost per Person'}</span>
                        <span className="text-xs font-black text-emerald-600">{trip.estimatedCostPerPerson}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Dynamic Continuous Learning Dashboard */}
            <div className="bg-slate-50 border border-slate-200/60 rounded-3xl p-5 space-y-4 text-right">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
                <div className="flex gap-1.5 text-[9px] font-black text-indigo-500">
                  <span className="bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-full">
                    {logs.length} {isAr ? 'تفاعلات مخزنة' : 'recorded interactions'}
                  </span>
                </div>
                <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-1.5">
                  <RefreshCw className="w-3.5 h-3.5 text-indigo-500" />
                  <span>{isAr ? 'لوحة تحليل تفاعلاتك (التعلُّم التلقائي للمحرّك)' : 'Self-Learning Feed Analytics'}</span>
                </h3>
              </div>

              {logs.length === 0 ? (
                <div className="text-center py-4 space-y-1">
                  <p className="text-[11px] text-slate-500 font-medium">
                    {isAr 
                      ? 'لا توجد تفاعلات مسجلة بعد. ابدأ بفتح الأماكن أو حفظها ليدرس المحرّك سلوكك!' 
                      : 'No interaction footprints saved yet. Start opening map locations or saving places to personalize suggestions.'}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-48 overflow-y-auto pr-1">
                  {logs.slice(0, 10).map((log, idx) => (
                    <div 
                      key={idx}
                      className="bg-white p-2.5 rounded-xl border border-slate-100 flex items-center justify-between gap-3 text-right"
                    >
                      <span className="text-[9px] font-mono text-slate-400">{new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      
                      <div className="flex items-center gap-2 justify-end">
                        <div className="text-right">
                          <p className="text-[10px] font-black text-slate-800 line-clamp-1">{log.name}</p>
                          <span className="text-[8px] text-slate-400 bg-slate-50 px-1.5 py-0.2 rounded font-mono uppercase">{log.category}</span>
                        </div>
                        <span className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs ${
                          log.action === 'save_place' ? 'bg-rose-50 text-rose-500' :
                          log.action === 'open_place' ? 'bg-indigo-50 text-indigo-500' :
                          'bg-amber-50 text-amber-500'
                        }`}>
                          {log.action === 'save_place' ? '💾' :
                           log.action === 'open_place' ? '👁️' :
                           '🚗'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  Sparkles, MapPin, Coffee, ShoppingBag, Dumbbell, Star, 
  Image as ImageIcon, ArrowLeft, Navigation, Share2, Plus, List, Map as MapIcon,
  Search, Info, Navigation2, ChevronRight, Wind, Clock, Terminal, AlertTriangle, CheckCircle2,
  ExternalLink, Car, Heart, Sliders, Eye, Landmark, Users, Tag, Calendar, CheckCircle,
  Gamepad2, Trophy
} from 'lucide-react';


import { supabase } from '../lib/supabase';
import { Profile, Outing, ActivityCategory, OutingReview } from '../types';
import { Language } from '../data/translations';
import { MapProviderFactory, MapPlace } from '../services/mapProvider';
import { useLocation } from '../contexts/LocationContext';
import LocationIndicator from './LocationIndicator';
import { getPlaceholderImage } from '../utils/imageUtils';
import { motion, AnimatePresence } from 'motion/react';



interface CityGuideProps {
  currentUser: Profile;
  outings?: Outing[];
  companionReviews?: OutingReview[];
  onSelectOuting?: (outingId: string) => void;
  lang: Language;
  onBack?: () => void;
  onInitiateCreateOuting?: (prefill: any) => void;
}

const CATEGORIES = [
  { id: 'cafe', icon: Coffee, textEn: 'Cafes', textAr: 'مقاهي', query: 'cafe, coffee' },
  { id: 'restaurant', icon: Coffee, textEn: 'Restaurants', textAr: 'مطاعم', query: 'restaurant, food' },
  { id: 'mall', icon: ShoppingBag, textEn: 'Malls', textAr: 'مولات', query: 'mall, shopping' },
  { id: 'park', icon: MapPin, textEn: 'Parks', textAr: 'منتزهات', query: 'park, garden' },
  { id: 'gaming_sessions', icon: Gamepad2, textEn: 'PC Gaming', textAr: 'ألعاب كمبيوتر', query: 'gaming center, pc cafe, arcade' },
  { id: 'billiards', icon: Trophy, textEn: 'Billiards & Pool', textAr: 'بلياردو', query: 'billiards hall, pool club' },
  { id: 'attraction', icon: Star, textEn: 'Attractions', textAr: 'معالم سياحية', query: 'attractions, tourism' },
];


// Haversine distance formula
function getDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371; // km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// In-memory cache for fast 1S location loaded cache
const PLACES_CACHE: Record<string, { timestamp: number; data: MapPlace[] }> = {};

export default function CityGuide({ 
  currentUser, 
  outings = [], 
  companionReviews = [],
  onSelectOuting, 
  lang, 
  onBack, 
  onInitiateCreateOuting 
}: CityGuideProps) {
  const isAr = lang === 'ar';
  const { 
    activeCoords, 
    activeCity, 
    activeCountry, 
    gpsActive, 
    requestLocation, 
    address,
    trackPlaceInteraction,
    interactedPlaces
  } = useLocation();
  
  // Call requestLocation on mount to ensure real-time GPS
  useEffect(() => {
    requestLocation();
  }, [requestLocation]);

  const [localOutings, setLocalOutings] = useState<Outing[]>(outings || []);

  useEffect(() => {
    if (outings && outings.length > 0) {
      setLocalOutings(outings);
    }
  }, [outings]);

  // Re-fetch outings matching user's selected profile city to guarantee consistency
  useEffect(() => {
    const fetchCityOutings = async () => {
      if (!supabase) {
        console.warn('Supabase client not available for re-fetching outings.');
        return;
      }
      const selectedCity = currentUser.city || currentUser.location || '';
      if (!selectedCity) return;

      try {
        setLoading(true);
        const normalizedCity = selectedCity.trim();
        
        // Fetch outings from outings table filtering strictly by city
        const { data, error } = await supabase
          .from('outings')
          .select('*')
          .eq('city', normalizedCity);

        if (error) {
          console.error('[CityGuide] Failed to fetch outings for city:', selectedCity, error);
          return;
        }

        if (data) {
          const mapped = data.map((outing: any) => ({
            ...outing,
            logistics: outing.logistics || {
              hasDriver: false,
              driverName: '',
              vehicleCapacity: 4,
              pickupPoint: '',
              fuelSharingPrice: 0,
              costPerPerson: 0,
              pickups: []
            },
            coverImage: outing.coverImage || '',
            creatorName: outing.creatorName || 'Anonymous Partner',
            creatorAvatar: outing.creatorAvatar || '👤',
            creatorTrust: outing.creatorTrust ?? 9.5
          }));
          setLocalOutings(mapped);
        }
      } catch (err) {
        console.error('[CityGuide] Exception while fetching outings:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchCityOutings();
  }, [currentUser.city, currentUser.location]);

  // Tabs: map & search, active outings
  const [activeSegment, setActiveSegment] = useState<'map_search' | 'outings'>('map_search');
  
  const [activeCategory, setActiveCategory] = useState(CATEGORIES[0]);
  const [places, setPlaces] = useState<MapPlace[]>([]);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  const userPos: [number, number] | null = activeCoords;
  
  // Outing tab filtering states
  const [outingsSubTab, setOutingsSubTab] = useState<'all' | 'ongoing' | 'upcoming' | 'completed'>('all');
  const [outingSearchQuery, setOutingSearchQuery] = useState('');

  // Calculate average category rating based on completed outings' companion reviews
  const getCategoryRating = (catId: string) => {
    let matchedCategoryName: string = '';
    if (catId === 'cafe') matchedCategoryName = 'Cafes';
    else if (catId === 'restaurant') matchedCategoryName = 'Restaurants';
    else if (catId === 'mall') matchedCategoryName = 'Shopping Malls';
    else if (catId === 'park') matchedCategoryName = 'Parks';
    else if (catId === 'gaming_sessions') matchedCategoryName = 'Gaming Sessions';
    else if (catId === 'billiards') matchedCategoryName = 'Billiards';
    else if (catId === 'bowling') matchedCategoryName = 'Bowling';
    else return null;

    const categoryOutings = localOutings.filter(o => o.category === matchedCategoryName);
    if (categoryOutings.length === 0) return null;

    const categoryOutingIds = categoryOutings.map(o => o.id);
    const categoryReviews = (companionReviews || []).filter(r => categoryOutingIds.includes(r.outingId));

    if (categoryReviews.length === 0) return null;

    const totalRating = categoryReviews.reduce((sum, r) => {
      const rVal = r.venueRating || ((r.respectfulRating + r.punctualRating + r.paymentRating + (r.friendlyRating || 5)) / 4);
      return sum + rVal;
    }, 0);

    return {
      average: totalRating / categoryReviews.length,
      count: categoryReviews.length
    };
  };

  const [aiSuggestions, setAiSuggestions] = useState<any[]>([]);
  const [showAiSuggestions, setShowAiSuggestions] = useState(true);

  // Diagnostics and Expanded Search parameters
  const [expandedSearch, setExpandedSearch] = useState(false);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [debugInfo, setDebugInfo] = useState<{
    coords: [number, number] | null;
    city: string;
    source: string;
    count: number;
    country: string;
  } | null>(null);

  // Determine provider
  const providerType = 'osm';
  const mapProvider = useMemo(() => {
    return MapProviderFactory.getProvider(providerType);
  }, [providerType]);

  const fetchPlaces = useCallback(async (cat: typeof CATEGORIES[0], pos: [number, number]) => {
    const cacheKey = `${cat.id}_${pos[0].toFixed(3)}_${pos[1].toFixed(3)}_${expandedSearch}`;
    const cached = PLACES_CACHE[cacheKey];
    if (cached && (Date.now() - cached.timestamp < 3600000)) { // 1 Hour Cache
      setPlaces(cached.data);
      const firstPlace = cached.data[0];
      setDebugInfo({
        coords: pos,
        city: activeCity || (firstPlace as any)?.city || 'Detected Area (Cached)',
        source: 'OpenStreetMap (Cached)',
        count: cached.data.length,
        country: activeCountry || (firstPlace as any)?.country || 'Detected Country'
      });
      if (cached.data.length > 0) {
        getAiSuggestions(cached.data);
      }
      return;
    }

    setLoading(true);
    try {
      const radii = expandedSearch ? [5000, 10000, 20000, 30000] : [5000, 10000];
      let finalResults: MapPlace[] = [];

      for (const r of radii) {
        const results = await mapProvider.searchPlaces({
          query: cat.query,
          location: { lat: pos[0], lng: pos[1] },
          city: activeCity || currentUser.city || currentUser.location,
          country: activeCountry || currentUser.preferences?.country,
          category: cat.id,
          radius: r
        });

        if (results.length > 0) {
          finalResults = results;
          break;
        }
      }
      
      let processedResults = finalResults.map(p => {
        const dst = getDistance(pos[0], pos[1], p.lat, p.lng);
        // Create the newly requested 'Popularity Score' if missing
        // Base it on rating and userRatingsTotal. Max around 100.
        let popScore = p.popularityScore || 0;
        if (!popScore) {
          if (p.rating) popScore += p.rating * 15;
          if (p.userRatingsTotal) popScore += Math.min(25, p.userRatingsTotal / 10);
          if (popScore === 0) popScore = 50 + Math.random() * 30;
        }
        
        // Hybrid score: (Popularity Score) - (Distance penalty * weight)
        // High popularity is good, high distance is bad.
        const hybridScore = popScore - (dst * 5); 

        return {
          ...p,
          distance: dst,
          popularityScore: Math.round(popScore),
          hybridScore: hybridScore
        };
      });

      // Strict same-city/province filtering if expanded search is disabled
      if (!expandedSearch) {
        processedResults = processedResults.filter(p => (p.distance || 0) <= 15);
      }

      processedResults.sort((a, b) => (b.hybridScore || 0) - (a.hybridScore || 0));

      setPlaces(processedResults);
      
      // Store in memory cache & localStorage
      PLACES_CACHE[cacheKey] = { timestamp: Date.now(), data: processedResults };
      localStorage.setItem(`ym_cache_guide_${cacheKey}`, JSON.stringify({
        timestamp: Date.now(),
        data: processedResults
      }));

      // Update diagnosed debugger parameters
      const firstPlace = processedResults[0];
      setDebugInfo({
        coords: pos,
        city: activeCity || (firstPlace as any)?.city || 'Detected Area',
        source: 'OpenStreetMap (Overpass/Nominatim)',
        count: processedResults.length,
        country: activeCountry || (firstPlace as any)?.country || 'Detected Country'
      });

      if (processedResults.length > 0) {
        getAiSuggestions(processedResults);
      }
    } catch (err: any) {
      console.error('Fetch places error:', err);
    } finally {
      setLoading(false);
    }
  }, [mapProvider, currentUser.location, expandedSearch, activeCity, activeCountry, providerType]);

  // Load prefetched caches from localStorage on mount
  useEffect(() => {
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('ym_cache_guide_')) {
          const cleanedKey = key.replace('ym_cache_guide_', '');
          const raw = localStorage.getItem(key);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (Date.now() - parsed.timestamp < 3600000) { // 1 hour validity
              PLACES_CACHE[cleanedKey] = parsed;
            } else {
              localStorage.removeItem(key);
            }
          }
        }
      }
    } catch (e) {
      console.warn("Failed to load local storage guides:", e);
    }
  }, []);

  // Background category prefetch hook
  useEffect(() => {
    if (activeSegment !== 'map_search' || !userPos || loading) return;
    
    const unselectedCategories = CATEGORIES.filter(cat => cat.id !== activeCategory.id);
    
    const prefetchTimer = setTimeout(async () => {
      for (const cat of unselectedCategories) {
        const cacheKey = `${cat.id}_${userPos[0].toFixed(3)}_${userPos[1].toFixed(3)}_${expandedSearch}`;
        if (PLACES_CACHE[cacheKey]) continue; // Already cached
        
        try {
          const radii = expandedSearch ? [5000, 10000] : [5000];
          let results: MapPlace[] = [];
          for (const r of radii) {
            results = await mapProvider.searchPlaces({
              query: cat.query,
              location: { lat: userPos[0], lng: userPos[1] },
              city: address?.city || currentUser.city || currentUser.location,
              country: address?.country || currentUser.preferences?.country,
              category: cat.id,
              radius: r
            });
            if (results.length > 0) break;
          }
          if (results.length > 0) {
            const processed = results.map(p => ({
              ...p,
              distance: getDistance(userPos[0], userPos[1], p.lat, p.lng)
            }));
            
            PLACES_CACHE[cacheKey] = { timestamp: Date.now(), data: processed };
            localStorage.setItem(`ym_cache_guide_${cacheKey}`, JSON.stringify({
              timestamp: Date.now(),
              data: processed
            }));
          }
        } catch (err) {
          console.warn(`Background prefetch failed for ${cat.id}:`, err);
        }
      }
    }, 2500); // Trigger background prefetching after 2.5s of idle time

    return () => clearTimeout(prefetchTimer);
  }, [activeCategory.id, activeSegment, userPos, loading, expandedSearch, mapProvider, currentUser.location]);

  const getAiSuggestions = async (nearby: MapPlace[]) => {
    if (!userPos) return;
    try {
      const response = await fetch('/api/outings/smart-suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          city: currentUser.city || currentUser.location || address?.city || '',
          interests: currentUser.interests?.join(', '),
          nearbyPlaces: nearby.slice(0, 10).map(p => ({ name: p.name, type: p.types?.[0], lat: p.lat, lng: p.lng })),
          lang: lang,
          lat: userPos[0],
          lng: userPos[1]
        })
      });
      
      const text = await response.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        console.warn('Smart suggestions returned non-JSON. Probably a dev server reload or proxy issue. Ignoring.');
        return;
      }
      
      if (data && data.suggestions) {
        setAiSuggestions(data.suggestions);
      }
    } catch (e) {
      console.error('AI suggestions error:', e);
    }
  };

  useEffect(() => {
    if (activeSegment === 'map_search' && userPos) {
      fetchPlaces(activeCategory, userPos);
    }
  }, [activeCategory, userPos, fetchPlaces, activeSegment]);

  const handleShare = (place: MapPlace) => {
    if (navigator.share) {
      navigator.share({
        title: place.name,
        text: isAr ? `اكتشف هذا المكان معي: ${place.name}` : `Check out this place: ${place.name}`,
        url: window.location.href
      });
    }
  };

  const handleNavigate = (place: MapPlace) => {
    trackPlaceInteraction(place.id);
    const url = `https://www.google.com/maps/dir/?api=1&destination=${place.lat},${place.lng}`;
    window.open(url, '_blank');
  };

  // Outings filter
  const filteredOutings = (localOutings || []).filter(o => {
    const matchesSearch = !outingSearchQuery || 
      o.title.toLowerCase().includes(outingSearchQuery.toLowerCase()) || 
      o.description.toLowerCase().includes(outingSearchQuery.toLowerCase()) ||
      o.location.toLowerCase().includes(outingSearchQuery.toLowerCase());

    const matchesStatus = outingsSubTab === 'all' || o.status === outingsSubTab;
    
    // Check privacy
    const isAllowedPrivate = !o.isPrivate || 
      o.creatorId === currentUser.id || 
      o.invitedUserIds?.includes(currentUser.id);

    // Filtering relies strictly on the city field matching the user's selected profile city
    const userCity = (currentUser.city || currentUser.location || '').trim().toLowerCase();
    const matchesCity = o.city && o.city.trim().toLowerCase() === userCity;

    return matchesSearch && matchesStatus && isAllowedPrivate && matchesCity;
  });

  return (
    <div className="flex flex-col h-full bg-[#F8FAFC] relative w-full overflow-hidden font-sans" dir={isAr ? 'rtl' : 'ltr'}>
      {/* Upper tabs navigation segment control */}
      <div className="bg-white px-5 pt-3 pb-3 border-b border-gray-100 shrink-0">
        <LocationIndicator lang={lang} className="mb-4" />
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-600 font-bold select-none text-sm">
              🧭
            </div>
            <div>
              <h1 className="text-sm font-black text-slate-900 leading-tight">
                {isAr ? 'المستكشف الذكي الشامل' : 'Smart Explorer Hub'}
              </h1>
              <p className="text-[10px] text-slate-400 font-bold">
                {isAr ? 'دمج البحث الحي، الأماكن الشهيرة، وفعاليات المجتمع' : 'Merged Search, Curated Places & Live Feed'}
              </p>
            </div>
          </div>

          {onBack && (
            <button 
              onClick={onBack}
              className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors border border-slate-200 text-slate-500"
            >
              <ArrowLeft className={`w-4 h-4 ${isAr ? 'rotate-180' : ''}`} />
            </button>
          )}
        </div>

        {/* Master segment Switcher */}
        <div className="grid grid-cols-2 bg-slate-100 rounded-xl p-1 gap-1 select-none border border-slate-200/30">
          <button
            onClick={() => setActiveSegment('map_search')}
            className={`py-2 rounded-lg text-[10px] font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activeSegment === 'map_search'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <span>🗺️</span>
            <span>{isAr ? 'البحث بالخريطة' : 'Map Search'}</span>
          </button>
          <button
            onClick={() => setActiveSegment('outings')}
            className={`py-2 rounded-lg text-[10px] font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 sub-outings-btn ${
              activeSegment === 'outings'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <span>🗓️</span>
            <span>{isAr ? 'طلعات النشطة' : 'Group Outings'}</span>
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden relative">
        <AnimatePresence mode="wait">
          {/* 1. MAP SEARCH VIEW */}
          {activeSegment === 'map_search' && (
            <motion.div 
              key="map_search"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.2 }}
              className="h-full flex flex-col"
            >
              {!activeCoords ? (
                <div className="flex flex-col items-center justify-center p-8 text-center bg-white rounded-2xl border border-slate-100 shadow-sm mx-5 my-10 space-y-4">
                  <div className="w-16 h-16 bg-rose-50 rounded-full flex items-center justify-center text-rose-500 animate-bounce">
                    <MapPin className="w-8 h-8" />
                  </div>
                  <h3 className="text-sm font-black text-slate-900">
                    {isAr ? 'الرجاء اختيار مدينة أو تفعيل الموقع الجغرافي' : 'Please Select a City or Enable GPS'}
                  </h3>
                  <p className="text-xs text-slate-500 leading-relaxed max-w-xs justify-center mx-auto">
                    {isAr ? 'لتصفح دليل المدينة، يرجى تفعيل الـ GPS أو اختيار مدينتك المفضلة من حسابك الشخصي.' : 'To view the city guide, please enable GPS or set your preferred city in your profile.'}
                  </p>
                  <button
                    onClick={() => requestLocation(true)}
                    className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs shadow-sm transition-colors cursor-pointer"
                  >
                    {isAr ? 'تحديث الموقع الجغرافي والبحث' : 'Sync Coordinate Location'}
                  </button>
                </div>
              ) : (
                <>
                  {/* Category Search Selector and View Mode */}
                  <div className="bg-white px-5 py-3 border-b border-gray-100 shrink-0 flex items-center justify-between gap-3">
                    <div className="flex overflow-x-auto gap-1.5 pb-0.5 hide-scrollbar flex-1 font-sans">
                      {CATEGORIES.map(cat => {
                        const Icon = cat.icon;
                        const isActive = activeCategory.id === cat.id;
                        const ratingInfo = getCategoryRating(cat.id);
                        return (
                          <button
                            key={cat.id}
                            onClick={() => setActiveCategory(cat)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black transition-all whitespace-nowrap shrink-0 border ${
                              isActive 
                                ? 'bg-slate-900 text-white border-slate-900 shadow-md' 
                                : 'bg-slate-50 text-slate-500 border-slate-100 hover:bg-slate-100'
                            }`}
                          >
                            <Icon className="w-3 h-3" />
                            <span>{isAr ? cat.textAr : cat.textEn}</span>
                            {ratingInfo && (
                              <span className="ml-1 bg-amber-500/15 text-amber-600 dark:text-amber-400 px-1 py-0.5 rounded text-[8px] font-bold flex items-center gap-0.5">
                                ⭐{ratingInfo.average.toFixed(1)}
                              </span>
                            )}
                          </button>
                        )
                      })}
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => requestLocation(true)}
                        className="p-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-lg border border-indigo-200 transition-all select-none font-bold text-xs flex items-center gap-1 shrink-0 cursor-pointer"
                        title={isAr ? 'تحديث الموقع الجغرافي' : 'Sync GPS Location'}
                      >
                        <Navigation className="w-4 h-4" />
                        <span className="hidden sm:inline">{isAr ? 'تحديث الموقع' : 'Sync Location'}</span>
                      </button>
                      <button 
                        onClick={() => setViewMode(viewMode === 'list' ? 'map' : 'list')}
                        className="p-1.5 bg-slate-50 hover:bg-slate-100 rounded-lg border border-slate-200 text-slate-600 transition-all select-none font-bold text-xs flex items-center gap-1 shrink-0"
                      >
                        {viewMode === 'list' ? <MapIcon className="w-4 h-4" /> : <List className="w-4 h-4" />}
                        <span>{viewMode === 'list' ? (isAr ? 'خريطة' : 'Map') : (isAr ? 'قائمة' : 'List')}</span>
                      </button>
                    </div>
                  </div>

                  {/* Toggle row for Expanded Search & Diagnostic Debug logs */}
                  <div className="bg-slate-50 px-5 py-2 border-b border-gray-100 flex items-center justify-between gap-3 text-xs text-slate-600 shrink-0">
                    <label className="flex items-center gap-2 font-bold cursor-pointer select-none">
                      <input 
                        type="checkbox" 
                        checked={expandedSearch} 
                        onChange={(e) => setExpandedSearch(e.target.checked)}
                        className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 accent-indigo-600 cursor-pointer"
                      />
                      <span>{isAr ? 'البحث الموسع (مدن أخرى)' : 'Expanded Search (Other Cities)'}</span>
                    </label>

                    <button 
                      onClick={() => setShowDiagnostics(!showDiagnostics)}
                      className="px-2.5 py-1 bg-indigo-50 text-indigo-600 rounded-md font-black text-[10px] hover:bg-indigo-100 transition-colors uppercase"
                    >
                      {isAr ? 'سجل التشخيص 🛠️' : 'Diagnostic Log 🛠️'}
                    </button>
                  </div>

                  {showDiagnostics && debugInfo && (
                    <div className="mx-5 my-3 p-3 bg-slate-900 text-slate-100 rounded-xl space-y-2 text-[10px] font-mono leading-relaxed relative z-20 shrink-0">
                      <div className="flex justify-between items-center border-b border-slate-700 pb-1 mb-1.5">
                        <span className="font-bold text-indigo-400">{isAr ? '🛠️ تشخيص بيانات الموقع والمصدر' : '🛠️ Spatial Location Diagnostics'}</span>
                        <button onClick={() => setShowDiagnostics(false)} className="text-slate-400 hover:text-white font-bold">✕</button>
                      </div>
                      <div><strong>Coordinates / الإحداثيات:</strong> {debugInfo.coords ? `${debugInfo.coords[0].toFixed(5)}, ${debugInfo.coords[1].toFixed(5)}` : 'N/A'}</div>
                      <div><strong>City / المدينة المكتشفة:</strong> {debugInfo.city}</div>
                      <div><strong>Source / مصدر الأماكن:</strong> {debugInfo.source}</div>
                      <div><strong>Places Count / عدد الأماكن:</strong> {debugInfo.count}</div>
                      <div><strong>Country / الدولة:</strong> {debugInfo.country}</div>
                      <div className="text-[9px] text-indigo-300 mt-2 italic">
                        {expandedSearch 
                          ? (isAr ? '* تم تفعيل البحث الموسع (يتضمن مدناً مجاورة)' : '* Expanded Search enabled (includes neighboring cities)')
                          : (isAr ? '* يقتصر البحث على نفس المدينة/المحافظة (مسافة <= 15 كم)' : '* Restricted to same city/province (distance <= 15km)')}
                      </div>
                    </div>
                  )}

                  {/* Map/List Render Pane */}
                  <div className="flex-1 overflow-hidden relative">
                    {viewMode === 'list' ? (
                      <div className="h-full overflow-y-auto px-5 py-4 space-y-4 pb-20">
                        {loading ? (
                          <div className="space-y-4 animate-pulse">
                            {[1, 2].map(i => (
                              <div key={i} className="bg-white rounded-2xl h-48 border border-slate-100" />
                            ))}
                          </div>
                        ) : places.length === 0 ? (
                          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                            <Search className="w-10 h-10 mb-3 opacity-30" />
                            <p className="text-xs font-bold text-center">
                              {isAr ? 'لا توجد نتائج حالياً' : 'No results currently found'}
                            </p>
                          </div>
                        ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {[...places].sort((a, b) => {
                          const aInteracted = interactedPlaces.includes(a.id);
                          const bInteracted = interactedPlaces.includes(b.id);
                          if (aInteracted && !bInteracted) return -1;
                          if (!aInteracted && bInteracted) return 1;
                          return 0;
                        }).map(place => {
                          const hasRealPhoto = place.photos && place.photos.length > 0;
                          const photoUrl = hasRealPhoto ? place.photos![0] : getPlaceholderImage(activeCategory.id);
                          const isInteracted = interactedPlaces.includes(place.id);
                          
                          return (
                            <div key={place.id} className="bg-white rounded-2xl overflow-hidden border border-slate-100 shadow-sm flex flex-col justify-between hover:shadow-md transition-all group">
                              <div className="h-32 bg-slate-100 relative overflow-hidden">
                                <img 
                                  src={photoUrl} 
                                  alt={place.name} 
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                                  referrerPolicy="no-referrer"
                                />
                                
                                {isInteracted && (
                                  <div className="absolute bottom-2 left-2 bg-indigo-600/90 backdrop-blur-sm text-white px-2 py-0.5 rounded-md flex items-center gap-1 shadow-sm">
                                    <span className="text-[9px] font-black">{isAr ? '✨ تفاعلت معها' : '✨ Interacted'}</span>
                                  </div>
                                )}
                                
                                {place.rating && (
                                  <div className="absolute top-2 right-2 bg-white/95 backdrop-blur-sm px-2 py-0.5 rounded-md flex items-center gap-1 shadow-sm">
                                    <Star className="w-2.5 h-2.5 text-amber-500 fill-amber-500" />
                                    <span className="text-[9px] font-black text-slate-900">{place.rating.toFixed(1)}</span>
                                  </div>
                                )}
                                
                                {place.popularityScore !== undefined && (
                                  <div className="absolute top-2 left-2 bg-rose-500/90 backdrop-blur-sm text-white px-2 py-0.5 rounded-md flex items-center gap-1 shadow-sm">
                                    <span className="text-[9px] font-black">{isAr ? 'شعبية' : 'Pop'} {place.popularityScore}</span>
                                  </div>
                                )}
                              </div>
                              
                              <div className="p-3 space-y-3">
                                <div>
                                  <h4 className="font-black text-slate-900 text-xs truncate leading-tight">{place.name}</h4>
                                  <p className="text-[10px] text-slate-400 truncate flex items-center gap-1 mt-1">
                                    <MapPin className="w-2.5 h-2.5 shrink-0" />
                                    {place.address}
                                  </p>
                                  {place.description && (
                                    <p className="text-[10px] text-slate-500 line-clamp-2 mt-2 leading-relaxed bg-slate-50/50 p-2 rounded-lg border border-slate-100/50">
                                      {place.description}
                                    </p>
                                  )}
                                  {place.approxPrice && (
                                    <div className="flex items-center gap-1 mt-2 text-[9px] text-emerald-600 font-extrabold bg-emerald-50 px-2 py-0.5 rounded-md w-fit">
                                      <span>💰</span>
                                      <span>{isAr ? 'متوسط التكلفة:' : 'Est. Price:'} {place.approxPrice}</span>
                                    </div>
                                  )}
                                </div>
          
                                <div className="grid grid-cols-5 gap-1.5 pt-1 border-t border-slate-50">
                                  <button 
                                    onClick={() => handleNavigate(place)}
                                    className="col-span-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-[9px] font-black transition flex items-center justify-center gap-1"
                                  >
                                    <Car className="w-3 h-3" />
                                    <span>{place.distance ? `${place.distance.toFixed(1)}km` : (isAr ? 'الموقع' : 'Nav')}</span>
                                  </button>
                                  <button 
                                    onClick={() => handleShare(place)}
                                    className="p-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-lg flex items-center justify-center"
                                  >
                                    <Share2 className="w-3.5 h-3.5" />
                                  </button>
                                  <button 
                                    onClick={() => onInitiateCreateOuting?.({ 
                                      title: place.name, 
                                      location: place.name,
                                      category: place.types?.[0] as any 
                                    })}
                                    className="p-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg flex items-center justify-center shadow-sm"
                                    title={isAr ? 'إنشاء طلعة مع الرفقاء' : 'Invite Friends'}
                                  >
                                    <Plus className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="h-full w-full relative z-10">
                    <div className="h-full w-full relative z-10 flex flex-col items-center justify-center bg-slate-50 text-slate-500 p-6 text-center border-2 border-dashed border-slate-200 rounded-3xl">
                      <MapPin className="w-12 h-12 mb-4 text-indigo-300" />
                      <p className="font-bold text-lg mb-2">{isAr ? "عرض الخريطة غير متوفر" : "Map View Unavailable"}</p>
                      <p className="text-sm mb-6 max-w-xs">{isAr ? "استخدم وضع القائمة لعرض الأماكن وافتحها مباشرة في خرائط جوجل." : "Use list view to browse places and open them directly in Google Maps."}</p>
                      <button onClick={() => setViewMode("list")} className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-md transition-colors">{isAr ? "العودة للقائمة" : "Back to List"}</button>
                    </div>
                  </div>
                )}
              </div>
            </>)}
          </motion.div>
          )}

          {/* 3. ACTIVE/COMPLETED/ONGOING OUTINGS FEATURE */}
          {activeSegment === 'outings' && (
            <motion.div 
              key="outings"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.2 }}
              className="h-full overflow-y-auto px-5 py-4 space-y-4 pb-20"
            >
              {/* Filter Sub-segment & Search */}
              <div className="space-y-3">
                {/* Search query input */}
                <div className="relative">
                  <Search className={`absolute ${isAr ? 'right-3' : 'left-3'} top-2.5 w-4 h-4 text-slate-400`} />
                  <input
                    type="text"
                    placeholder={isAr ? 'بحث في الطلعات...' : 'Search outings...'}
                    value={outingSearchQuery}
                    onChange={(e) => setOutingSearchQuery(e.target.value)}
                    className={`w-full py-2 ${isAr ? 'pr-9 pl-4' : 'pl-9 pr-4'} bg-white border border-slate-200 rounded-xl text-xs outline-none focus:ring-1 focus:ring-indigo-500`}
                  />
                </div>

                {/* Sub status switcher */}
                <div className="bg-white border border-slate-200/50 p-1 rounded-xl flex gap-1 select-none">
                  <button 
                    onClick={() => setOutingsSubTab('all')}
                    className={`flex-1 py-1.5 rounded-lg text-[9px] font-extrabold text-center transition ${
                      outingsSubTab === 'all' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-850'
                    }`}
                  >
                    {isAr ? 'الكل' : 'All'}
                  </button>
                  <button 
                    onClick={() => setOutingsSubTab('ongoing')}
                    className={`flex-1 py-1.5 rounded-lg text-[9px] font-extrabold text-center transition flex items-center justify-center gap-1 ${
                      outingsSubTab === 'ongoing' ? 'bg-rose-500 text-white shadow-sm' : 'text-slate-500 hover:text-slate-850'
                    }`}
                  >
                    <span className="w-1.5 h-1.5 bg-white rounded-full animate-ping" />
                    <span>{isAr ? 'جارية حالياً' : 'Ongoing'}</span>
                  </button>
                  <button 
                    onClick={() => setOutingsSubTab('upcoming')}
                    className={`flex-1 py-1.5 rounded-lg text-[9px] font-extrabold text-center transition ${
                      outingsSubTab === 'upcoming' ? 'bg-amber-500 text-black shadow-sm' : 'text-slate-500 hover:text-slate-850'
                    }`}
                  >
                    {isAr ? 'قادمة' : 'Upcoming'}
                  </button>
                  <button 
                    onClick={() => setOutingsSubTab('completed')}
                    className={`flex-1 py-1.5 rounded-lg text-[9px] font-extrabold text-center transition ${
                      outingsSubTab === 'completed' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-850'
                    }`}
                  >
                    {isAr ? 'انتهت' : 'Completed'}
                  </button>
                </div>
              </div>

              {/* Grid of outings */}
              <div className="space-y-3.5">
                {filteredOutings.length > 0 ? (
                  filteredOutings.map(o => {
                    // Status styling
                    const isOngoing = o.status === 'ongoing';
                    const isCompleted = o.status === 'completed';
                    
                    return (
                      <div 
                        key={o.id}
                        onClick={() => onSelectOuting?.(o.id)}
                        className={`p-4 rounded-2xl border transition-all cursor-pointer relative hover:scale-[1.01] bg-white ${
                          isOngoing ? 'border-rose-300 ring-2 ring-rose-50' : 
                          isCompleted ? 'border-emerald-200' : 'border-slate-100 hover:border-slate-200 hover:shadow shadow-sm'
                        }`}
                      >
                        {/* Status absolute label badge */}
                        <div className="absolute top-4 right-4 flex items-center gap-1">
                          {isOngoing && (
                            <span className="px-2.5 py-0.5 rounded-full text-[8px] font-black text-rose-500 bg-rose-50 flex items-center gap-1 border border-rose-200 animate-pulse">
                              <span className="w-1.5 h-1.5 bg-rose-500 rounded-full" />
                              {isAr ? 'جارية ومستمرة الآن' : 'Ongoing Now'}
                            </span>
                          )}
                          {isCompleted && (
                            <span className="px-2.5 py-0.5 rounded-full text-[8px] font-black text-emerald-600 bg-emerald-50 flex items-center gap-1 border border-emerald-200">
                              <CheckCircle className="w-2.5 h-2.5" />
                              {isAr ? 'تمت وانتهت' : 'Completed Outing'}
                            </span>
                          )}
                          {o.status === 'upcoming' && (
                            <span className="px-2.5 py-0.5 rounded-full text-[8px] font-black text-amber-600 bg-amber-50 flex items-center gap-1 border border-amber-200">
                              🕒 {isAr ? 'قادمة قريباً' : 'Upcoming'}
                            </span>
                          )}
                        </div>

                        {/* Title and details */}
                        <div className="flex items-start gap-3">
                          <span className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-lg shadow-inner shrink-0 select-none">
                            {o.creatorAvatar}
                          </span>
                          <div className="space-y-1 max-w-[70%]">
                            <span className="text-[9px] text-indigo-500 font-bold block">@{o.creatorName}</span>
                            <h3 className="font-black text-slate-900 text-xs truncate leading-tight">{o.title}</h3>
                            
                            {/* Rating Stars based on feedback */}
                            {(() => {
                              const outingReviews = (companionReviews || []).filter(r => r.outingId === o.id);
                              const hasReviews = outingReviews.length > 0;
                              const averageRating = hasReviews
                                ? outingReviews.reduce((sum, r) => sum + (r.respectfulRating + r.punctualRating + r.paymentRating + (r.friendlyRating || 5)) / 4, 0) / outingReviews.length
                                : undefined;

                              if (averageRating !== undefined && averageRating > 0) {
                                return (
                                  <div className="flex items-center gap-0.5 mt-0.5" title={`${averageRating.toFixed(1)} / 5 (${outingReviews.length} ${isAr ? 'تقييمات' : 'reviews'})`}>
                                    {[1, 2, 3, 4, 5].map((star) => (
                                      <Star
                                        key={star}
                                        className={`w-2.5 h-2.5 ${
                                          star <= Math.round(averageRating)
                                            ? 'fill-amber-400 text-amber-400'
                                            : 'text-gray-200'
                                        }`}
                                      />
                                    ))}
                                    <span className="text-[9px] text-amber-500 font-extrabold ml-1 leading-none inline-block">
                                      {averageRating.toFixed(1)} ({outingReviews.length})
                                    </span>
                                  </div>
                                );
                              }
                              
                              return null;
                            })()}

                            <p className="text-[10px] text-slate-400 line-clamp-1">{o.description}</p>
                          </div>
                        </div>

                        {/* Location, DateTime, and Attendees Footer */}
                        <div className="mt-4 pt-3 border-t border-slate-50 flex justify-between items-center gap-4 text-[9px] font-bold text-slate-500">
                          <span className="flex items-center gap-1 max-w-[45%] truncate text-indigo-600">
                            <MapPin className="w-3 h-3 text-indigo-500 shrink-0" />
                            {o.location}
                          </span>
                          
                          <span className="flex items-center gap-1 text-slate-400">
                            <Clock className="w-3 h-3 text-slate-350 shrink-0" />
                            {new Date(o.datetime).toLocaleDateString(lang, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </span>

                          <span className="bg-slate-50 font-mono text-[9px] px-2 py-0.5 rounded border">
                            👥 {o.attendeeIds?.length || 0}/{o.maxAttendees}
                          </span>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="py-16 text-center text-slate-450 space-y-3">
                    <Calendar className="w-8 h-8 mx-auto opacity-35 text-indigo-500" />
                    <p className="text-xs font-bold block">{isAr ? 'لا توجد طلعات في هذا القسم حالياً' : 'No outings found here yet'}</p>
                    <button
                      onClick={() => onInitiateCreateOuting?.({})}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-[10px] rounded-xl shadow-md"
                    >
                      ➕ {isAr ? 'أنشئ أول طلعة مع الرفقاء' : 'Create First Outing'}
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

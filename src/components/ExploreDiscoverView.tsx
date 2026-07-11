import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Sparkles, 
  MapPin, 
  RefreshCw, 
  TrendingUp, 
  Play, 
  Tv, 
  Users, 
  DollarSign, 
  Compass, 
  Hash, 
  Music, 
  ArrowRight,
  Info,
  Flame,
  Zap,
  CheckCircle,
  HelpCircle,
  Clock
} from 'lucide-react';
import { Profile, Outing } from '../types';
import { useLocation } from '../contexts/LocationContext';
import LocationIndicator from './LocationIndicator';

interface TrendingOuting {
  title: string;
  description: string;
  category: string;
  estimatedCost: string;
  vibe: string;
  googleMapsUrl?: string;
}

interface PopularReel {
  caption: string;
  views: string;
  tags: string[];
  music: string;
}

interface DiscoverData {
  trendingOutings: TrendingOuting[];
  popularReels: PopularReel[];
}

interface ExploreDiscoverViewProps {
  currentUser: Profile | null;
  lang: 'ar' | 'en';
  userCoordinates?: { lat: number; lng: number } | null;
  onInitiateCreateOuting: (prefill: Partial<Outing> | null) => void;
  onChangeTab: (tab: 'home' | 'explore' | 'create' | 'reels' | 'profile') => void;
}

export default function ExploreDiscoverView({ 
  currentUser, 
  lang, 
  userCoordinates,
  onInitiateCreateOuting,
  onChangeTab
}: ExploreDiscoverViewProps) {
  const isAr = lang === 'ar';
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<DiscoverData | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [showActiveVideo, setShowActiveVideo] = useState<number | null>(null);
  const [showToast, setShowToast] = useState(false);
  
  // Boredom scale state: 0 to 100
  const [boredomLevel, setBoredomLevel] = useState(70);
  // Simulated dynamic matches ready
  const [activeMatesNear, setActiveMatesNear] = useState(12);

  const { requestLocation } = useLocation();

  const containerRef = useRef<HTMLDivElement>(null);
  const touchStartY = useRef(0);
  const isAtTopRef = useRef(true);

  // Dynamic status based on boredom
  const getBoredomStatus = (level: number) => {
    if (isAr) {
      if (level < 30) return { title: "رائق ومكتفي 😎", desc: "أنت في حالة مزاجية جيدة، لكن فنجان قهوة مع رفيق سيزيد يومك جمالاً!", color: "text-green-500", bg: "bg-green-50" };
      if (level < 70) return { title: "ودك تطلع؟ 🤔", desc: "النشاط المتوسط ممتاز للتخطيط لجولة ليلية أو عشاء خفيف بالبوليفارد.", color: "text-amber-500", bg: "bg-amber-50" };
      return { title: "طفشان مرررة! 🚨", desc: "مزاجك مستعد لمغامرة غير عادية! جهّز سيارتك وتواصل مع رفقاء جدد حالاً واخرج من عزلتك.", color: "text-rose-500", bg: "bg-rose-50" };
    } else {
      if (level < 30) return { title: "Chill & Cozy 😎", desc: "You are doing great, but a quick specialty coffee with a mate would lock in the perfect day!", color: "text-green-600", bg: "bg-green-50" };
      if (level < 70) return { title: "Slightly Bored? 🤔", desc: "Perfect time to host a game session or clear your head with a sunset walk at Huraymila.", color: "text-amber-600", bg: "bg-amber-50" };
      return { title: "CRITICAL BOREDOM! 🚨", desc: "Alert! Your energy peaks for an epic outing. Fire up the engine, gather new mates, and skip the screens!", color: "text-rose-600", bg: "bg-rose-50" };
    }
  };

  const boredomInfo = getBoredomStatus(boredomLevel);

  // Translations
  const trans = {
    ar: {
      title: "اكتشاف بـذكاء Gemini ✨",
      subtitle: "اقتراحات أنشطة وريلز رائجة مخصصة لنمط شخصيتك وموقعك الحالي لتخرج حالاً!",
      pullToRefresh: "اسحب للأسفل للتحديث...",
      releaseToRefresh: "أفلت للتحديث الآن 🔄",
      refreshing: "جاري تحليل البيانات وتحميل الأماكن بواسطة Gemini...",
      localOutingsTitle: "🔥 أماكن وطلعات رائجة تناسب طبعك الآن",
      popularReelsTitle: "📺 أفكار لتصوير ريلز رائعة اليوم",
      vibe: "الأجواء",
      category: "الفئة",
      cost: "حساب التكلفة",
      createNowBtn: "ابدأ الطلعة وشارك الفاتورة حالاً 🚗",
      views: "مشاهدة",
      music: "الصوت المقترح",
      playIdea: "محاكاة الريل",
      closePreview: "إغلاق المعاينة",
      geminiBadge: "تحليل ذكي فوري بـ Gemini",
      locationContext: "يعتمد التحليل على إحداثيات GPS الخاصة بك ونمط شخصيتك وعاداتك المسجلة.",
      archetypeLabel: "نمطك الحالي:",
      interestsLabel: "اهتماماتك النشطة:",
      trendingBadge: isAr ? `رائج في ${currentUser?.city || currentUser?.location || 'مدينتكم'}` : "Trending Now",
      refreshSuccess: "تم تحديث بوصلة الاكتشاف الذكي بنجاح!",
      boredomBusterTitle: "⚡ مقياس الطفش والتطلع للخروج",
      boredomSubtitle: "اسحب لتحديد مدى حاجتك للخروج وتصميم طلعة فورية:",
      matesWaitingPrompt: "هناك {n} رفيق من نفس نمطك مستعدون للتجمع معك بمدينتك حالاً! 🌟",
      instantChatBtn: "أرسل إشارة دعوة جماعية سريعة 🔔",
      instantChatSuccess: "تم إرسال إشارة دعوة سريعة لـ 5 رفقاء قرابة موقعك!"
    },
    en: {
      title: "Smart AI Discover with Gemini ✨",
      subtitle: "Personalized premium spots, activities and style suggestions to get you out immediately",
      pullToRefresh: "Pull down to refresh...",
      releaseToRefresh: "Release to refresh 🔄",
      refreshing: "Analyzing places with Gemini...",
      localOutingsTitle: "🔥 Immersive Curated Activities For You",
      popularReelsTitle: "📺 High-Viral Reel Ideas For Your Vibe",
      vibe: "Vibe",
      category: "Category",
      cost: "Expected Cost",
      createNowBtn: "Create Outing & Split Fuel 🚗",
      views: "views",
      music: "Recommended Audio",
      playIdea: "Preview Reel Scenario",
      closePreview: "Close Preview",
      geminiBadge: "Grounded by Gemini Flash",
      locationContext: "Real-time location, local coordinates, and personality vectors are integrated in this analysis.",
      archetypeLabel: "Your Archetype:",
      interestsLabel: "Your Interests:",
      trendingBadge: "Trending Now",
      refreshSuccess: "Discovery board updated successfully!",
      boredomBusterTitle: "⚡ Boredom & Outing Excitement Scaler",
      boredomSubtitle: "Slide to map your current boredom level to get absolute match suggestions:",
      matesWaitingPrompt: "{n} social mates matching your profile are active around your area and ready to go!",
      instantChatBtn: "Send Instant Meetup Beacon 🔔",
      instantChatSuccess: "Outing beacon dispatched to 5 active mates nearby!"
    }
  }[lang];

  const [showBeaconSuccess, setShowBeaconSuccess] = useState(false);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchData = async () => {
    setErrorMsg(null);
    try {
      // Force request fresh coordinates before sending API call
      let latestLat = userCoordinates?.lat;
      let latestLng = userCoordinates?.lng;
      
      const response = await fetch('/api/yallamate/discover', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          archetype: currentUser?.archetype || 'Explorer',
          interests: currentUser?.interests || ['Cafes', 'Adventures'],
          city: currentUser?.city || currentUser?.location || (isAr ? 'المدينة الحالية' : 'Current City'),
          lang,
          lat: latestLat,
          lng: latestLng
        }),
      });
      const resData = await response.json();
      if (!response.ok) {
        throw new Error(resData.error || 'Failed to fetch discovery recommendations');
      }
      if (resData && resData.result) {
        setData(resData.result);
      }
    } catch (err: any) {
      console.error('Error fetching discovery recommendations:', err);
      let emsg = err.message || '';
      if (emsg.includes('429') || emsg.includes('Quota')) {
        setErrorMsg(isAr ? 'عذراً، تم الوصول للحد الأقصى لاستخدام الذكاء الاصطناعي حالياً. يرجى الانتظار والمحاولة لاحقاً.' : 'AI Quota Exceeded. Please try again later.');
      } else {
        setErrorMsg(isAr ? 'حدث خطأ في تحميل التوصيات.' : 'Failed to load recommendations.');
      }
    }
  };

  const syncData = async (isPull: boolean = false) => {
    if (isPull) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    await fetchData();
    setRefreshing(false);
    setLoading(false);
    setPullDistance(0);

    setShowToast(true);
    setTimeout(() => {
      setShowToast(false);
    }, 3000);
  };

  useEffect(() => {
    requestLocation();
    syncData();
    // Simulate random count of mates nearby
    setActiveMatesNear(Math.floor(Math.random() * 8) + 8);
  }, [currentUser, lang, requestLocation]);

  // Handle Touch Pull-to-Refresh Gesture Event Handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    const container = containerRef.current;
    if (container) {
      isAtTopRef.current = container.scrollTop === 0;
    }
    if (isAtTopRef.current) {
      touchStartY.current = e.touches[0].clientY;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isAtTopRef.current) return;
    const currentY = e.touches[0].clientY;
    const deltaY = currentY - touchStartY.current;

    if (deltaY > 0) {
      const distance = Math.min(100, deltaY * 0.35);
      setPullDistance(distance);
      if (e.cancelable) {
        e.preventDefault();
      }
    }
  };

  const handleTouchEnd = () => {
    if (pullDistance >= 55) {
      syncData(true);
    } else {
      setPullDistance(0);
    }
  };

  const handleTriggerBeacon = () => {
    setShowBeaconSuccess(true);
    setTimeout(() => setShowBeaconSuccess(false), 4000);
  };

  return (
    <div 
      ref={containerRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className="relative flex-1"
      dir={isAr ? 'rtl' : 'ltr'}
    >
      {/* Pull down refresh indicator */}
      <div 
        className="w-full overflow-hidden flex flex-col items-center justify-center transition-all duration-150 relative bg-indigo-50/20 border-b border-indigo-100/30"
        style={{ height: pullDistance > 0 ? `${pullDistance + 40}px` : refreshing ? '70px' : '0px' }}
      >
        <div className="flex flex-col items-center gap-1 text-indigo-950 py-2">
          {refreshing ? (
            <div className="flex items-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-indigo-650" />
              <span className="text-xs font-black">{trans.refreshing}</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 opacity-80">
              <RefreshCw className="w-4 h-4 rotate-180 text-indigo-600 animate-pulse" />
              <span className="text-xs font-black">
                {pullDistance >= 55 ? trans.releaseToRefresh : trans.pullToRefresh}
              </span>
            </div>
          )}
          <div 
            className="h-1 bg-green-500 rounded-full mt-2 transition-all"
            style={{ width: `${Math.min(100, (pullDistance / 55) * 100)}%` }}
          />
        </div>
      </div>

      {/* Floating Success Alert Toast */}
      <AnimatePresence>
        {showToast && (
          <motion.div 
            initial={{ opacity: 0, y: -40, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="fixed top-24 left-1/2 -translate-x-1/2 z-50 bg-green-650 border border-green-500 text-white font-extrabold text-xs px-5 py-3 rounded-full shadow-xl flex items-center gap-2"
          >
            <Sparkles className="w-4 h-4 text-yellow-300 animate-bounce" />
            <span>{trans.refreshSuccess}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="pb-28">
        <LocationIndicator lang={lang} className="mb-4 mt-2 shadow-sm" />

        {/* Excitement Hero Banner Setup */}
        <div className="bg-gradient-to-br from-slate-900 via-slate-950 to-indigo-950 p-6 rounded-[2.25rem] text-white shadow-lg relative overflow-hidden mb-6 border border-white/5 mx-1">
          {/* Decorative glowing blobs */}
          <div className="absolute top-0 right-0 w-36 h-36 bg-green-500 rounded-full filter blur-[80px] opacity-25 -mr-8 -mt-8"></div>
          <div className="absolute bottom-0 left-0 w-36 h-36 bg-indigo-600 rounded-full filter blur-[90px] opacity-35 -ml-8 -mb-8"></div>
          
          <div className="relative z-10 space-y-3">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1 px-3 py-1 bg-white/10 rounded-full text-[10px] uppercase tracking-widest font-black text-indigo-200 border border-white/5">
                <Sparkles className="w-3.5 h-3.5 text-yellow-300 animate-pulse" />
                {trans.geminiBadge}
              </span>
                  <span className="bg-green-500 text-white text-[9px] font-black px-2 py-0.5 rounded-md flex items-center gap-1">
                <Flame className="w-3 h-3 fill-current" />
                {trans.trendingBadge}
              </span>
            </div>
            
            <div>
              <h2 className="text-xl font-black mb-1.5">{trans.title}</h2>
              <p className="text-[11px] text-slate-300 leading-relaxed font-semibold max-w-md">{trans.subtitle}</p>
            </div>
            
            {/* Dynamic Archetype tags for personalized feel */}
            {currentUser && (
              <div className="pt-2.5 border-t border-white/10 flex flex-wrap gap-2 text-[10px]">
                <div className="bg-white/5 border border-white/5 rounded-xl px-2.5 py-1 flex items-center gap-1 text-slate-100">
                  <span className="font-extrabold text-green-400">{trans.archetypeLabel}</span>
                  <span className="font-bold font-mono">{currentUser.archetype}</span>
                </div>
                <div className="bg-white/5 border border-white/5 rounded-xl px-2.5 py-1 flex items-center gap-1 text-slate-100">
                  <span className="font-extrabold text-indigo-300">{trans.interestsLabel}</span>
                  <span className="font-bold">{currentUser.interests?.slice(0, 3).join(', ')}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ⚡ BOREDOM BUSTER SLIDER PANEL */}
        <div className="bg-white border border-slate-100 rounded-3xl p-5 shadow-sm mb-6 mx-1 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
              <span className="p-1 rounded-lg bg-green-100 text-green-600 block shrink-0">
                <Zap className="w-4 h-4 fill-current" />
              </span>
              {trans.boredomBusterTitle}
            </h3>
            <span className={`text-[10px] uppercase font-black tracking-wider px-2.5 py-1 rounded-full ${boredomInfo.bg} ${boredomInfo.color}`}>
              {boredomInfo.title}
            </span>
          </div>

          <p className="text-[11px] text-slate-500 font-semibold">
            {trans.boredomSubtitle}
          </p>

          <div className="relative py-2 select-none">
            <input 
              type="range" 
              min="0" 
              max="100" 
              value={boredomLevel} 
              onChange={(e) => setBoredomLevel(Number(e.target.value))}
              className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-green-600"
            />
            <div className="flex justify-between text-[9px] text-slate-400 font-bold mt-1 font-mono">
              <span>{isAr ? 'روقان ☕' : 'Chill ☕'}</span>
              <span>{isAr ? 'عادي 🚶‍♂️' : 'Boring 🚶‍♂️'}</span>
              <span>{isAr ? 'مستعد للاستكشاف! 🔥' : 'Eager to go! 🔥'}</span>
            </div>
          </div>

          {/* Dynamic feedback panel based on selection */}
          <div className="p-3.5 bg-slate-50 border border-slate-100 rounded-2xl flex items-start gap-2.5">
            <div className={`p-1.5 rounded-xl bg-white text-lg ${boredomLevel > 70 ? 'animate-bounce' : ''}`}>
              {boredomLevel < 30 ? '☕' : boredomLevel < 70 ? '🚗' : '🏜️'}
            </div>
            <div className="flex-1 space-y-1">
              <h4 className="text-xs font-black text-slate-900 leading-tight">
                {boredomInfo.title}
              </h4>
              <p className="text-[10px] text-slate-500 leading-relaxed font-semibold">
                {boredomInfo.desc}
              </p>
            </div>
          </div>

          {/* Social Beacon trigger block */}
          <div className="pt-2 border-t border-slate-100 space-y-3">
            <p className="text-[10px] text-indigo-950 font-black flex items-center gap-1.5 leading-relaxed">
              <Users className="w-3.5 h-3.5 text-indigo-650" />
              <span>{trans.matesWaitingPrompt.replace('{n}', activeMatesNear.toString())}</span>
            </p>

            <button
              onClick={handleTriggerBeacon}
              className="w-full bg-indigo-950 hover:bg-slate-900 text-white rounded-2xl py-3 px-4 text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer shadow-sm active:scale-[0.99] transition-all"
            >
              <span>{trans.instantChatBtn}</span>
            </button>

            {showBeaconSuccess && (
              <motion.div 
                initial={{ opacity: 0, y: -5 }} 
                animate={{ opacity: 1, y: 0 }} 
                className="bg-emerald-50 border border-emerald-100 text-emerald-800 text-[10px] font-black px-3.5 py-2.5 rounded-2xl text-center flex items-center justify-center gap-1.5"
              >
                <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                <span>{trans.instantChatSuccess}</span>
              </motion.div>
            )}
          </div>
        </div>

        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3">
            <div className="relative">
              <div className="w-12 h-12 rounded-full border-4 border-indigo-200 border-t-green-600 animate-spin" />
              <Sparkles className="w-4 h-4 text-green-650 absolute top-1.5 left-1.5 animate-pulse" />
            </div>
            <p className="text-xs text-slate-500 font-extrabold mt-1 animate-pulse">{trans.refreshing}</p>
          </div>
        ) : errorMsg ? (
          <div className="bg-red-50 text-red-600 rounded-2xl p-6 text-center font-bold text-sm border border-red-100 mx-4 shadow-sm">
             {errorMsg}
          </div>
        ) : (
          <div className="space-y-6 mx-1">
            {/* Outings Curated Spot Cards */}
            {data?.trendingOutings && (
              <div className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <h3 className="text-xs font-black text-slate-900 flex items-center gap-2">
                    <TrendingUp className="w-4.5 h-4.5 text-green-600" />
                    {trans.localOutingsTitle}
                  </h3>
                  <span className="bg-green-500/10 text-green-700 text-[10px] font-black px-2 py-0.5 rounded-full border border-green-500/20">
                     {currentUser?.city || currentUser?.location || 'Your City'}
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  {data.trendingOutings.map((outing, i) => (
                    <motion.div 
                      key={i} 
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.1 }}
                      className="bg-white border border-slate-100 rounded-3xl p-5 shadow-sm relative overflow-hidden group hover:border-green-300 transition-all cursor-pointer hover:shadow-md"
                    >
                      {/* Cost tag & vibe tag */}
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div className="flex flex-wrap gap-1.5">
                          <span className="bg-indigo-50/90 text-indigo-700 border border-indigo-100 rounded-full px-2.5 py-0.5 text-[9px] font-black font-mono">
                            {outing.category}
                          </span>
                          <span className="bg-amber-50 text-amber-700 border border-amber-100 rounded-full px-2.5 py-0.5 text-[9px] font-extrabold">
                            {trans.vibe}: {outing.vibe}
                          </span>
                        </div>
                        <span className="bg-green-50/95 text-green-700 border border-green-200 rounded-lg px-2 py-0.5 text-[9px] font-black flex items-center gap-0.5 font-mono">
                          <DollarSign className="w-3 h-3" />
                          {outing.estimatedCost}
                        </span>
                      </div>

                      <h4 className="text-sm font-black text-slate-900 mb-1.5 group-hover:text-green-600 transition-colors">
                        {outing.title}
                      </h4>
                      <p className="text-[11px] text-slate-500 leading-relaxed font-semibold mb-4">
                        {outing.description}
                      </p>

                      {/* Quick convert outing action trigger */}
                      <div className="flex gap-2">
                        {outing.googleMapsUrl && (
                          <a
                            href={outing.googleMapsUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="bg-indigo-50 hover:bg-indigo-600 hover:text-white border border-indigo-200/50 rounded-2xl p-3 text-indigo-800 transition-all flex items-center justify-center cursor-pointer shadow-sm"
                          >
                            <MapPin className="w-5 h-5" />
                          </a>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onInitiateCreateOuting({
                              title: outing.title,
                              description: outing.description,
                              location: currentUser?.city || currentUser?.location || 'Your City',
                              category: (outing.category as any) || 'Cafes',
                            });
                          }}
                          className="flex-1 bg-green-50 hover:bg-green-600 hover:text-white border border-green-200/50 hover:border-green-600 rounded-2xl py-3 px-4 text-xs font-black text-green-800 transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm active:scale-98"
                        >
                          <span>{trans.createNowBtn}</span>
                          <ArrowRight className="w-4 h-4" />
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            {/* Popular Reels Ideas Section */}
            {data?.popularReels && (
              <div className="space-y-3">
                <h3 className="text-xs font-black text-slate-900 flex items-center gap-2 px-1">
                  <Tv className="w-4.5 h-4.5 text-indigo-600 animate-pulse" />
                  {trans.popularReelsTitle}
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {data.popularReels.map((reel, i) => {
                    const isCurrentActive = showActiveVideo === i;

                    return (
                      <motion.div 
                        key={i}
                        initial={{ opacity: 0, scale: 0.96 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.2 + i * 0.1 }}
                        className="bg-slate-950 text-white rounded-3xl p-5 relative overflow-hidden flex flex-col justify-between shadow-md hover:shadow-indigo-900/10 hover:-translate-y-0.5 transition-all text-left"
                      >
                        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-slate-950/40 to-slate-950/95 pointer-events-none z-0"></div>
                        <div className="absolute right-2 top-2 rounded-full w-24 h-24 bg-green-500/10 filter blur-xl pointer-events-none"></div>

                        <div className="relative z-10 flex-1">
                          <div className="flex items-center justify-between gap-2 mb-3">
                            <span className="bg-white/10 backdrop-blur-sm rounded-full px-2.5 py-0.5 text-[9px] font-black text-indigo-200 border border-white/5 uppercase tracking-wider font-mono">
                              ⭐ {trans.trendingBadge}
                            </span>
                            <span className="bg-emerald-500/20 text-emerald-400 font-mono text-[9px] font-bold px-2 py-0.5 rounded-full border border-emerald-500/30">
                              👁️ {reel.views}
                            </span>
                          </div>

                          {isCurrentActive ? (
                            <div className="bg-black/90 rounded-2xl p-4 my-2 mb-3 border border-indigo-500/30 text-center animate-fade-in">
                              <div className="flex items-center justify-center gap-1.5 h-10 mb-2">
                                <span className="w-1.5 h-5 bg-green-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                                <span className="w-1.5 h-8 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '0.3s' }} />
                                <span className="w-1.5 h-4 bg-pink-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                                <span className="w-1.5 h-7 bg-green-400 rounded-full animate-bounce" style={{ animationDelay: '0.5s' }} />
                                <span className="w-1.5 h-3 bg-red-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }} />
                              </div>
                              <span className="text-[10px] text-slate-300 font-extrabold flex justify-center items-center gap-1 select-none">
                                <Music className="w-3.5 h-3.5 text-pink-400 animate-spin" />
                                {reel.music}
                              </span>
                              <button
                                onClick={() => setShowActiveVideo(null)}
                                className="text-[9px] font-black text-indigo-400 hover:text-white mt-3 underline"
                              >
                                {trans.closePreview}
                              </button>
                            </div>
                          ) : (
                            <div className="bg-white/5 border border-white/5 rounded-2xl p-3 my-2 mb-3 flex items-center justify-between">
                              <span className="text-[10px] text-slate-300 truncate pr-2 flex items-center gap-1 font-mono font-bold max-w-[130px]">
                                <Music className="w-3.5 h-3.5 text-pink-400" />
                                {reel.music}
                              </span>
                              <button
                                onClick={() => setShowActiveVideo(i)}
                                className="w-7 h-7 bg-indigo-650 text-white rounded-full flex items-center justify-center hover:scale-110 active:scale-95 transition-transform"
                              >
                                <Play className="w-3.5 h-3.5 fill-white ml-0.5" />
                              </button>
                            </div>
                          )}

                          <p className="text-xs font-black leading-relaxed tracking-wide text-slate-100 mb-3 block">
                            {reel.caption}
                          </p>

                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {reel.tags.map((tag, tIdx) => (
                              <span key={tIdx} className="text-[9px] font-mono font-extrabold text-[#79d8b2] hover:underline cursor-pointer">
                                #{tag}
                              </span>
                            ))}
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Bottom Motivation CTA Call to action to trigger social connection */}
            <div className="bg-gradient-to-br from-indigo-50/70 to-green-50/40 border border-indigo-100/50 p-5 rounded-[2rem] text-slate-800 flex flex-col justify-between shadow-sm relative overflow-hidden text-center sm:text-left">
              <div className="relative z-10 space-y-2">
                <span className="text-[9px] font-black uppercase text-indigo-650 tracking-widest">{isAr ? 'خروج الرفقاء الكبـير' : 'Go Out Today'}</span>
                <p className="text-xs leading-relaxed font-bold text-slate-700">
                  {isAr 
                    ? `ماذا تنتظر؟ أفضل الأماكن بـ ${currentUser?.city || currentUser?.location || 'مدينتك'} نشطة الآن وبانتظارك رفقاء رائقين من نفس شغفك. جهّز قهوتك وانطلق وصوّر ريلز جديدة! 🚗☕🔥`
                    : `What are you waiting for? ${currentUser?.city || currentUser?.location || 'Your city'}'s finest spots are booming right now with high crowd flow. Put on your shades and go make memories! 🚗☕`
                  }
                </p>
                <div className="text-[10px] text-slate-400 flex items-center justify-center gap-1.5 font-bold pt-1">
                  <Clock className="w-3.5 h-3.5" />
                  <span>{isAr ? `نشط الآن - ${currentUser?.city || currentUser?.location || 'مدينتك'}` : `Booming now - ${currentUser?.city || currentUser?.location || 'your city'}`}</span>
                </div>
              </div>
            </div>

            {/* Prompt context telemetry banner */}
            <div className="bg-slate-50 border border-slate-200/50 rounded-3xl p-4 flex gap-3 text-slate-500">
              <Info className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
              <p className="text-[10px] leading-relaxed font-bold">
                {trans.locationContext}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

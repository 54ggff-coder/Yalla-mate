import React, { useState, useEffect, useMemo } from 'react';
import { Outing, Profile, ActivityCategory } from '../types';
import { categoryMeta, arabCitiesList, foreignCitiesList } from '../constants';
import OutingCard from './OutingCard';
import { OutingCardSkeleton } from './Skeleton';
import DashboardMap from './DashboardMap';
import AISuggestions from './AISuggestions';
import ExploreDiscoverView from './ExploreDiscoverView';
import PlaceSuggester from './PlaceSuggester';
import TrendingPlacesView from './TrendingPlacesView';
import ExploreFilters from './ExploreFilters';
import CityGuide from './CityGuide';
import AIRecommendationEngine from './AIRecommendationEngine';
import { Search, Compass, Sparkles, ExternalLink, Globe, MapPin, Calendar, CheckCircle2, Clock, Star, Play } from 'lucide-react';
import { translations, Language } from '../data/translations';
import { useCountryValidation } from '../hooks/useCountryValidation';
import { saveOutingsToCache } from '../services/db';
import LocationIndicator from './LocationIndicator';
import { getGoogleMapsViewUrl, getGoogleMapsDirUrl, sanitizeCoordinates } from '../utils/mapUtils';
import { haversineDistance } from '../lib/geoUtils';

interface ExploreViewProps {
  currentUser: Profile;
  outings: Outing[];
  onSelectOuting: (outingId: string) => void;
  lang: Language;
  onInitiateCreateOuting: (prefill: any) => void;
  userCoordinates?: { lat: number; lng: number } | null;
  onChangeTab?: (tab: 'home' | 'explore' | 'create' | 'reels' | 'profile' | 'social_feed') => void;
}

export default function ExploreView({
  currentUser,
  outings,
  onSelectOuting,
  lang,
  onInitiateCreateOuting,
  userCoordinates,
  onChangeTab,
}: ExploreViewProps) {
  const { validate, userCountry } = useCountryValidation();
  
  const allCities = [...arabCitiesList, ...foreignCitiesList];
  const cityToCountryMap = useMemo(() => {
    const map = new Map<string, string>();
    allCities.forEach(c => {
      map.set(c.nameEn, c.countryEn);
      map.set(c.nameAr, c.countryEn);
    });
    return map;
  }, []);

  useEffect(() => {
    if (outings && outings.length > 0) {
      saveOutingsToCache(outings);
    }
  }, [outings]);
  const t = translations[lang];
  const isAr = lang === 'ar';
  
  // Subtab selector: smart_recs (AI Smart Suggestions), city_guide (leaflet search), listings (active/finished), places (PlaceSuggester), trending, ai_discover
  const [exploreSubTab, setExploreSubTab] = useState<'city_guide' | 'listings' | 'places' | 'trending' | 'ai_discover' | 'smart_recs'>('smart_recs');
  const [feedLayout, setFeedLayout] = useState<'list' | 'map'>('list');
  const [calendarView, setCalendarView] = useState<'week' | 'month'>('week');
  
  // Status filter state for listings: all, ongoing, upcoming, completed
  const [statusFilter, setStatusFilter] = useState<'all' | 'ongoing' | 'upcoming' | 'completed'>('all');
  const [trustSafeguardEnabled, setTrustSafeguardEnabled] = useState(false);
  
  // Haptic Feedback
  const triggerHaptic = () => navigator.vibrate?.(50);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedCity, setSelectedCity] = useState<string>('All');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // Feature 3: Personality Archetype Filter State
  const [selectedArchetype, setSelectedArchetype] = useState<'All' | 'Chill' | 'Competitive' | 'Adventurous'>('All');
  const [showOnlyNearby, setShowOnlyNearby] = useState(false);

  const getOutingStyle = (outing: Outing): 'chill' | 'competitive' | 'adventurous' => {
    // 1. Check if the outing already has an explicit property
    const anyOuting = outing as any;
    if (anyOuting.personalityStyle) return anyOuting.personalityStyle;
    
    // 2. Map based on standard category
    const cat = (outing.category || '').toLowerCase();
    if (cat.includes('coffee') || cat.includes('read') || cat.includes('walk') || cat.includes('board') || cat.includes('relax') || cat.includes('cafe')) {
      return 'chill';
    }
    if (cat.includes('gym') || cat.includes('sport') || cat.includes('game') || cat.includes('play') || cat.includes('compet') || cat.includes('active')) {
      return 'competitive';
    }
    if (cat.includes('drive') || cat.includes('trip') || cat.includes('road') || cat.includes('camp') || cat.includes('hike') || cat.includes('cruis')) {
      return 'adventurous';
    }
    
    // 3. Fallback to parsing title/description
    const text = `${outing.title} ${outing.description}`.toLowerCase();
    if (text.includes('chill') || text.includes('quiet') || text.includes('relax') || text.includes('قهوة)')) return 'chill';
    if (text.includes('race') || text.includes('game') || text.includes('win') || text.includes('play') || text.includes('تحدي')) return 'competitive';
    return 'adventurous'; // Default
  };

  // Helper for calendar
  const getWeekDates = () => {
    const now = new Date();
    const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));
    return Array.from({ length: 7 }).map((_, i) => {
        const d = new Date(startOfWeek);
        d.setDate(startOfWeek.getDate() + i);
        return d;
    });
  };

  const weekDates = getWeekDates();

  const categories = ['All', ...Object.keys(categoryMeta)];
  
  const displayCitiesList = lang === 'ar' ? arabCitiesList : foreignCitiesList;
  const currentCityValue = 'Current Location';
  const cities = ['All', currentCityValue, ...displayCitiesList.map(c => c.nameEn)];

  const filteredOutings = (outings || []).filter((outing) => {
    const outingCountry = cityToCountryMap.get(outing.city);
    const matchesCountry = validate(outingCountry);

    const matchesSearch = !searchQuery || 
      outing.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
      outing.description.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesCat = selectedCategory === 'All' || outing.category === selectedCategory;
    const matchesCity = selectedCity === 'All' 
      ? true 
      : selectedCity === currentCityValue 
        ? outing.city === (currentUser.city || currentUser.location)
        : outing.city === selectedCity;

    // Filter by personality Archetype
    const matchesArchetype = selectedArchetype === 'All' || (() => {
      const style = getOutingStyle(outing);
      return style.toLowerCase() === selectedArchetype.toLowerCase();
    })();

    let fulfillsDistance = true;
    if (showOnlyNearby && userCoordinates && outing.mapCoordinates) {
        const dist = haversineDistance([userCoordinates.lat, userCoordinates.lng], [outing.mapCoordinates.lat, outing.mapCoordinates.lng]);
        if (dist > 50) fulfillsDistance = false;
    }

    let matchesDates = true;
    const outingDate = new Date(outing.datetime).getTime();
    if (startDate) {
      const sDate = new Date(startDate).getTime();
      if (outingDate < sDate) matchesDates = false;
    }
    if (endDate) {
      const eDate = new Date(endDate).getTime() + 86400000;
      if (outingDate >= eDate) matchesDates = false;
    }

    const isAllowedPrivate = !outing.isPrivate || 
      outing.creatorId === currentUser.id || 
      outing.invitedUserIds?.includes(currentUser.id);

    // Filter status matches:
    // Ongoing/Active could be explicit ongoing status or date is today
    // Completed/Finished could be explicit completed status or date is past
    const matchesStatus = statusFilter === 'all' || 
      (statusFilter === 'ongoing' && outing.status === 'ongoing') ||
      (statusFilter === 'upcoming' && outing.status === 'upcoming') ||
      (statusFilter === 'completed' && outing.status === 'completed');

    if (trustSafeguardEnabled && (outing.minTrustScore || 0) > (currentUser.trustScore || 0)) return false;

    return matchesCountry && matchesSearch && matchesCat && matchesCity && matchesDates && isAllowedPrivate && matchesStatus && fulfillsDistance && matchesArchetype;
  });

  const handleGoogleSearch = (outing: Outing) => {
    const query = `${outing.title} ${outing.city} google search`;
    window.open(`https://www.google.com/search?q=${encodeURIComponent(query)}`, '_blank');
  };

  const handleGoogleMaps = (outing: Outing) => {
    const url = getGoogleMapsViewUrl({
      lat: outing.mapCoordinates?.lat,
      lng: outing.mapCoordinates?.lng,
      placeId: outing.placeId,
      name: outing.location || outing.title,
      city: outing.city
    });
    window.open(url, '_blank');
  };

  return (
    <div className="space-y-6 pb-16 no-swipe" dir={isAr ? 'rtl' : 'ltr'}>
      <LocationIndicator lang={lang} className="mb-2 mt-2 shadow-sm" />

      {/* Premium Apple-style Scrollable Tab Selector */}
      <div className="flex bg-slate-100 p-1.5 rounded-2xl border border-slate-200/40 shadow-inner max-w-xl mx-auto w-full relative z-20 overflow-x-auto scrollbar-none select-none gap-1">
        <button
          onClick={() => setExploreSubTab('smart_recs')}
          className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 ${
            exploreSubTab === 'smart_recs' 
              ? 'bg-indigo-600 text-white shadow-md' 
              : 'text-slate-500 hover:text-slate-900 bg-transparent'
          }`}
        >
          <span>✨</span>
          <span>{isAr ? 'الاقتراحات الذكية' : 'Smart Recommendations'}</span>
        </button>
        <button
          onClick={() => setExploreSubTab('city_guide')}
          className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 ${
            exploreSubTab === 'city_guide' 
              ? 'bg-indigo-600 text-white shadow-md' 
              : 'text-slate-500 hover:text-slate-900 bg-transparent'
          }`}
        >
          <span>🧭</span>
          <span>{isAr ? 'دليل مدينتك' : 'City Guide'}</span>
        </button>
        <button
          onClick={() => setExploreSubTab('listings')}
          className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 ${
            exploreSubTab === 'listings' 
              ? 'bg-indigo-600 text-white shadow-md' 
              : 'text-slate-500 hover:text-slate-900 bg-transparent'
          }`}
        >
          <span>👥</span>
          <span>{isAr ? 'الطلعات النشطة' : 'Active Outings'}</span>
        </button>
        <button
          onClick={() => setExploreSubTab('places')}
          className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 ${
            exploreSubTab === 'places' 
              ? 'bg-indigo-600 text-white shadow-md' 
              : 'text-slate-500 hover:text-slate-900 bg-transparent'
          }`}
        >
          <span>🎯</span>
          <span>{isAr ? 'اقتراح الأماكن' : 'Place Suggester'}</span>
        </button>
        <button
          onClick={() => setExploreSubTab('trending')}
          className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 ${
            exploreSubTab === 'trending' 
              ? 'bg-rose-500 text-white shadow-md' 
              : 'text-slate-500 hover:text-slate-900 bg-transparent'
          }`}
        >
          <span>🔥</span>
          <span>{isAr ? 'الترند بمدينتك' : 'Trending'}</span>
        </button>
        <button
          onClick={() => setExploreSubTab('ai_discover')}
          className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 ${
            exploreSubTab === 'ai_discover' 
              ? 'bg-indigo-600 text-white shadow-md' 
              : 'text-slate-500 hover:text-slate-900 bg-transparent'
          }`}
        >
          <span>✨</span>
          <span>{isAr ? 'اكتشف بـ AI' : 'AI Discover'}</span>
        </button>
      </div>

      {/* Render selected subtab content */}
      {exploreSubTab === 'smart_recs' ? (
        <AIRecommendationEngine
          currentUser={currentUser}
          lang={lang}
          onInitiateCreateOuting={onInitiateCreateOuting}
          onSelectOuting={onSelectOuting}
        />
      ) : exploreSubTab === 'city_guide' ? (
        <div className="h-[76vh] flex flex-col rounded-3xl overflow-hidden border border-gray-100 shadow-xl bg-white">
          <CityGuide
            currentUser={currentUser}
            outings={outings}
            onSelectOuting={onSelectOuting}
            lang={lang}
            onInitiateCreateOuting={onInitiateCreateOuting}
          />
        </div>
      ) : exploreSubTab === 'places' ? (
        <div className="space-y-4">
          <div className="bg-gradient-to-r from-teal-500/10 to-indigo-500/10 p-5 rounded-3xl border border-teal-500/20 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="space-y-1 text-center sm:text-right">
              <h3 className="text-sm font-black text-slate-900 flex items-center justify-center sm:justify-start gap-1.5">
                <Sparkles className="w-4 h-4 text-teal-600 animate-pulse" />
                <span>{isAr ? 'أداة اقتراح الأماكن المدمجة والذكية' : 'Smart Integrated Places & Activities'}</span>
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed max-w-lg">
                {isAr 
                  ? 'اكتشف المقاهي والمنتزهات والمطاعم والمعالم السياحية في مدينتك. يمكنك مراجعة الآراء، الموقع الجغرافي، أسعار الدخول، ومناسبة المكان للأفراد والمجموعات.' 
                  : 'Examine cafes, public parks, diners, and scenic local landscapes in your current city. Includes detailed reviews, pricing models, and targeted cohort suitability indicators.'}
              </p>
            </div>
          </div>
          
          <PlaceSuggester 
            currentUser={currentUser}
            lang={lang}
            onSelectPrefillForOuting={onInitiateCreateOuting}
          />
        </div>
      ) : exploreSubTab === 'trending' ? (
        <TrendingPlacesView
          currentUser={currentUser}
          lang={lang}
        />
      ) : exploreSubTab === 'ai_discover' ? (
        <ExploreDiscoverView
          currentUser={currentUser}
          lang={lang === 'ar' ? 'ar' : 'en'}
          userCoordinates={userCoordinates}
          onInitiateCreateOuting={onInitiateCreateOuting}
          onChangeTab={onChangeTab || (() => {})}
        />
      ) : (
        <>
          <ExploreFilters
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            selectedCategory={selectedCategory}
            setSelectedCategory={setSelectedCategory}
            selectedCity={selectedCity}
            setSelectedCity={setSelectedCity}
            cities={cities}
            startDate={startDate}
            setStartDate={setStartDate}
            endDate={endDate}
            setEndDate={setEndDate}
            selectedArchetype={selectedArchetype}
            setSelectedArchetype={setSelectedArchetype}
            showOnlyNearby={showOnlyNearby}
            setShowOnlyNearby={setShowOnlyNearby}
            userCoordinates={userCoordinates}
            lang={lang}
            triggerHaptic={triggerHaptic}
          />

          {/* Outings segment - with Live "Ongoing" vs "Completed" tab selector */}
          <div>
            <div className="bg-slate-50 border border-slate-100 p-1.5 rounded-2xl flex items-center gap-1.5 mb-6 max-w-xl overflow-x-auto scrollbar-none select-none">
              <button
                onClick={() => setStatusFilter('all')}
                className={`flex-1 py-2.5 px-3 rounded-xl text-[10px] font-black transition-all cursor-pointer flex items-center justify-center gap-1 shrink-0 ${
                  statusFilter === 'all'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 bg-white/40 hover:bg-white'
                }`}
              >
                <span>🌍</span>
                <span>{isAr ? 'الكل' : 'All Outings'}</span>
              </button>
              
              <button
                onClick={() => setStatusFilter('ongoing')}
                className={`flex-1 py-2.5 px-3 rounded-xl text-[10px] font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 shrink-0 border ${
                  statusFilter === 'ongoing'
                    ? 'bg-rose-500 text-white border-rose-600 shadow-md ring-2 ring-rose-100'
                    : 'bg-white text-slate-600 hover:text-slate-900 border-slate-250 hover:bg-slate-100'
                }`}
              >
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                </span>
                <span>{isAr ? 'طلعات جارية الآن' : 'Ongoing / Live'}</span>
              </button>

              <button
                onClick={() => setStatusFilter('upcoming')}
                className={`flex-1 py-2.5 px-3 rounded-xl text-[10px] font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 shrink-0 border ${
                  statusFilter === 'upcoming'
                    ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                    : 'bg-white text-slate-600 hover:text-slate-900 border-slate-250 hover:bg-slate-100'
                }`}
              >
                <span>🗓️</span>
                <span>{isAr ? 'طلعات قادمة' : 'Upcoming'}</span>
              </button>

              <button
                onClick={() => setStatusFilter('completed')}
                className={`flex-1 py-2.5 px-3 rounded-xl text-[10px] font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 shrink-0 border ${
                  statusFilter === 'completed'
                    ? 'bg-emerald-600 text-white border-emerald-700 shadow-md ring-2 ring-emerald-50'
                    : 'bg-white text-slate-600 hover:text-slate-900 border-slate-250 hover:bg-slate-100'
                }`}
              >
                <span>✅</span>
                <span>{isAr ? 'طلعات منتهية' : 'Completed / Past'}</span>
              </button>
            </div>

            {/* Title / Header count */}
            <div className="flex justify-between items-center mb-5">
              <div className="flex items-center gap-4">
                <h3 className="text-xs font-black text-gray-900 uppercase tracking-widest leading-none flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${statusFilter === 'ongoing' ? 'bg-red-500 animate-ping' : 'bg-green-500'} shadow-xs`}></span>
                  <span>
                    {statusFilter === 'ongoing' && (isAr ? 'الطلعات الجارية والفعّالة حالياً' : 'Live Ongoing Activities')}
                    {statusFilter === 'completed' && (isAr ? 'الطلعات والفعاليات السابقة المنتهية' : 'Completed Past Outings')}
                    {statusFilter === 'upcoming' && (isAr ? 'الطلعات المستقبلية القريبة' : 'Upcoming Coordinated Outings')}
                    {statusFilter === 'all' && (isAr ? 'الطلعات المتاحة' : 'Discovered Coordinated Outings')}
                  </span>
                  <span className="opacity-50 font-mono">({filteredOutings?.length || 0})</span>
                </h3>
                <button
                  onClick={() => setTrustSafeguardEnabled(!trustSafeguardEnabled)}
                  className={`px-3 py-1.5 text-[10px] font-bold rounded-lg border flex items-center gap-1.5 transition-all cursor-pointer ${trustSafeguardEnabled ? 'bg-indigo-50 border-indigo-200 text-indigo-700 shadow-sm' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'}`}
                  title={isAr ? 'إخفاء الطلعات التي تفوق موثوقيتك' : 'Hide outings that exceed your trust score'}
                >
                  <span className={`w-2 h-2 rounded-full ${trustSafeguardEnabled ? 'bg-indigo-500' : 'bg-slate-300'}`}></span>
                  {isAr ? 'درع الموثوقية' : 'Trust Safeguard'}
                </button>
              </div>
              <div className="flex items-center gap-1 bg-gray-100 border border-gray-200 p-1 rounded-xl">
                <button
                  onClick={() => setFeedLayout('list')}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${feedLayout === 'list' ? 'bg-white text-green-700 shadow-xs' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-200'}`}
                >
                  {isAr ? 'قائمة' : 'List'}
                </button>
                <button
                  onClick={() => setFeedLayout('map')}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1.5 ${feedLayout === 'map' ? 'bg-white text-green-700 shadow-xs' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-200'}`}
                >
                  🗺️ {isAr ? 'الخريطة' : 'Map'}
                </button>
              </div>
            </div>

            {/* Outing list Rendering */}
            {(filteredOutings && (filteredOutings?.length || 0) > 0) ? (
              feedLayout === 'list' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {filteredOutings.map((out, idx) => {
                    const isOngoing = out.status === 'ongoing';
                    const isCompleted = out.status === 'completed';
                    
                    return (
                      <div 
                        key={out.id} 
                        className={`relative rounded-3xl overflow-hidden border bg-white flex flex-col justify-between transition-all duration-300 hover:shadow-xl hover:translate-y-[-2px] ${
                          isOngoing ? 'border-rose-300 shadow-md shadow-rose-200/20' : 
                          isCompleted ? 'border-emerald-200' : 'border-gray-200'
                        }`}
                      >
                        {/* Dynamic Top Badge according to status */}
                        <div className="absolute top-3 inset-x-3 z-10 flex justify-between items-center">
                          <span className={`px-2.5 py-1 text-[9px] font-bold text-white rounded-full flex items-center gap-1 shadow-sm uppercase ${
                            isOngoing ? 'bg-rose-500 animate-pulse' :
                            isCompleted ? 'bg-emerald-600' : 'bg-slate-600'
                          }`}>
                            {isOngoing && <span className="w-1.5 h-1.5 bg-white rounded-full animate-ping" />}
                            {isOngoing ? (isAr ? 'جاري الآن • نشط' : 'Live Now') : 
                             isCompleted ? (isAr ? 'انتهت بنجاح' : 'Completed') :
                             (isAr ? 'قادمة قريباً' : 'Upcoming')}
                          </span>
                          
                          {/* Google Services tools quick links to ensure absolute reliability and AI matches */}
                          <div className="flex gap-1">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleGoogleSearch(out);
                              }}
                              title={isAr ? 'البحث عن المكان في جوجل' : 'Google Search Place Details'}
                              className="w-7 h-7 bg-white/90 hover:bg-white text-slate-600 hover:text-indigo-600 border border-slate-200 rounded-full flex items-center justify-center shadow-xs cursor-pointer active:scale-90 transition-transform"
                            >
                              <Globe className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleGoogleMaps(out);
                              }}
                              title={isAr ? 'الاتجاهات وخرائط جوجل' : 'Direct Google Directions'}
                              className="w-7 h-7 bg-white/90 hover:bg-white text-slate-600 hover:text-green-600 border border-slate-200 rounded-full flex items-center justify-center shadow-xs cursor-pointer active:scale-90 transition-transform"
                            >
                              <MapPin className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Traditional Card Component but loaded with Smart widgets inside */}
                        <div className="p-0 flex-1">
                          <OutingCard
                            outing={out}
                            currentUserTrustScore={currentUser.trustScore}
                            onSelect={onSelectOuting}
                            onCategoryClick={setSelectedCategory}
                            lang={lang}
                            index={idx}
                          />
                        </div>

                        {/* Smart action footer showing location alignment, reviews, rating average or active companion triggers */}
                        <div className="px-5 pb-5 pt-1 border-t border-slate-100 bg-slate-50/50 flex flex-col gap-2">
                          {isCompleted ? (
                            <div className="flex items-center justify-between text-[11px]">
                              <div className="flex items-center gap-1 text-slate-500">
                                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                                <span>{isAr ? 'تم تقييم الصحبة بنجاح' : 'Coordinations Completed'}</span>
                              </div>
                              <div className="flex items-center gap-0.5 text-amber-500 font-bold bg-amber-50 px-2 py-0.5 rounded-md">
                                <Star className="w-3 h-3 fill-amber-500" />
                                <span>{'4.9'}</span>
                              </div>
                            </div>
                          ) : isOngoing ? (
                            <div className="flex items-center justify-between text-[11px]">
                              <div className="flex items-center gap-1.5 text-rose-600 font-bold animate-pulse">
                                <Clock className="w-3.5 h-3.5" />
                                <span>{isAr ? 'التجمع نشط الآن! انضم بالدردشة' : 'Session is active now! Coordinate spot'}</span>
                              </div>
                              <span className="text-[10px] text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded font-black">
                                {isAr ? 'تأكيد الحضور قيد التشغيل' : 'LIVE Check-in'}
                              </span>
                            </div>
                          ) : (
                            <div className="flex items-center justify-between text-[11px] text-slate-500">
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3.5 h-3.5 text-indigo-500" />
                                <span>{isAr ? 'مجلس التخطيط مغلق' : 'Planning open'}</span>
                              </span>
                              <span className="text-[10px] font-mono">
                                {new Date(out.datetime).toLocaleDateString(isAr ? 'ar-SA' : 'en-US', { day: 'numeric', month: 'short' })}
                              </span>
                            </div>
                          )}

                          {/* Search details & external reliability search link */}
                          <button
                            onClick={() => onSelectOuting(out.id)}
                            className={`w-full py-2 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1 cursor-pointer ${
                              isOngoing ? 'bg-rose-500 hover:bg-rose-600 text-white shadow-sm' :
                              isCompleted ? 'bg-slate-100 hover:bg-slate-200 text-slate-700' :
                              'bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs'
                            }`}
                          >
                            <span>{isOngoing ? (isAr ? 'ادخل دردشة الموقع واللوكيشن' : 'Open Live Coordination Chat') : 
                                   isCompleted ? (isAr ? 'عرض ملخص الذكريات والتقييمات' : 'View Memories & Reviews') :
                                   (isAr ? 'استكشف تفاصيل اللقاء وصحبته' : 'Explore Companion Spots')}</span>
                            <ExternalLink className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <DashboardMap
                  outings={filteredOutings}
                  currentUserTrustScore={currentUser.trustScore}
                  onSelectOuting={onSelectOuting}
                  lang={lang}
                  userCoordinates={userCoordinates}
                />
              )
            ) : (!filteredOutings || (filteredOutings?.length || 0) === 0) && (!outings || outings.length === 0) ? (
                // Show Loading Skeletons
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {[1, 2, 3].map(i => <OutingCardSkeleton key={i} />)}
                </div>
            ) : (
              <div className="bg-white p-12 text-center rounded-3xl border border-gray-100 shadow-xs space-y-4">
                <div className="text-4xl animate-bounce">☕</div>
                <h4 className="text-sm font-black text-gray-900">{t.noOutingsDiscovered}</h4>
                <p className="text-xs text-gray-500 max-w-xs mx-auto leading-relaxed">{t.noOutingsDesc}</p>
                <AISuggestions city={currentUser.location} lang={lang} onInitiateCreateOuting={onInitiateCreateOuting} />
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

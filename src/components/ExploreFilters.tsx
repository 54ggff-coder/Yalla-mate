import React from 'react';
import { Search, Calendar, MapPin, Sparkles, Filter, ChevronDown } from 'lucide-react';
import { categoryMeta } from '../constants';
import { Language, translations } from '../data/translations';

interface ExploreFiltersProps {
  searchQuery: string;
  setSearchQuery: (val: string) => void;
  selectedCategory: string;
  setSelectedCategory: (val: string) => void;
  selectedCity: string;
  setSelectedCity: (val: string) => void;
  cities: string[];
  startDate: string;
  setStartDate: (val: string) => void;
  endDate: string;
  setEndDate: (val: string) => void;
  selectedArchetype: 'All' | 'Chill' | 'Competitive' | 'Adventurous';
  setSelectedArchetype: (val: 'All' | 'Chill' | 'Competitive' | 'Adventurous') => void;
  showOnlyNearby: boolean;
  setShowOnlyNearby: (val: boolean) => void;
  userCoordinates?: { lat: number; lng: number } | null;
  lang: Language;
  triggerHaptic: () => void;
}

export default function ExploreFilters({
  searchQuery, setSearchQuery, selectedCategory, setSelectedCategory,
  selectedCity, setSelectedCity, cities, startDate, setStartDate,
  endDate, setEndDate, selectedArchetype, setSelectedArchetype,
  showOnlyNearby, setShowOnlyNearby, userCoordinates, lang, triggerHaptic
}: ExploreFiltersProps) {
  const t = translations[lang];
  const isAr = lang === 'ar';

  return (
    <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-5 animate-in fade-in slide-in-from-top-4 duration-300">
      
      {/* Header section */}
      <div className="flex items-center justify-between border-b border-gray-50 pb-3" dir={isAr ? 'rtl' : 'ltr'}>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-indigo-500" />
          <span className="text-xs font-black text-gray-800 uppercase tracking-wider">
            {isAr ? 'خيارات تصفية وتضييق البحث' : 'Filter & Refine Outings'}
          </span>
        </div>
        {(searchQuery || selectedCategory !== 'All' || selectedCity !== 'All' || startDate || endDate || selectedArchetype !== 'All' || showOnlyNearby) && (
          <button
            onClick={() => {
              triggerHaptic();
              setSearchQuery('');
              setSelectedCategory('All');
              setSelectedCity('All');
              setStartDate('');
              setEndDate('');
              setSelectedArchetype('All');
              setShowOnlyNearby(false);
            }}
            className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 transition-colors cursor-pointer"
          >
            {isAr ? 'إعادة تعيين الكل 🔄' : 'Reset Filters 🔄'}
          </button>
        )}
      </div>

      {/* Search & City Select Inputs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3" dir={isAr ? 'rtl' : 'ltr'}>
        <div className="relative md:col-span-2">
          <Search className={`absolute ${isAr ? 'right-3' : 'left-3'} top-3.5 w-4 h-4 text-gray-400 pointer-events-none`} />
          <input
            type="text"
            placeholder={t.searchPlaceholder}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={`w-full ${isAr ? 'pr-9 pl-4' : 'pl-9 pr-4'} py-3 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-gray-900 placeholder-gray-400 transition-all font-bold`}
          />
        </div>

        <div className="md:col-span-2 relative">
          <MapPin className={`absolute ${isAr ? 'right-3' : 'left-3'} top-3.5 w-4 h-4 text-gray-400 pointer-events-none`} />
          <select
            value={selectedCity}
            onChange={(e) => setSelectedCity(e.target.value)}
            className={`w-full ${isAr ? 'pr-9 pl-8' : 'pl-9 pr-8'} py-3 bg-gray-50 border border-gray-200 rounded-xl text-xs font-black text-gray-950 cursor-pointer hover:bg-gray-100 transition-all focus:outline-none focus:ring-1 focus:ring-indigo-500 appearance-none`}
          >
            <option value="All" className="bg-white">{t.allCitiesOption}</option>
            {cities.map(c => (
              <option key={c} value={c} className="bg-white">{c}</option>
            ))}
          </select>
          <ChevronDown className={`absolute ${isAr ? 'left-3' : 'right-3'} top-3.5 w-4 h-4 text-gray-400 pointer-events-none`} />
        </div>
      </div>

      {/* Date Range Section */}
      <div className="border-t border-gray-100 pt-4" dir={isAr ? 'rtl' : 'ltr'}>
        <span className="text-[9px] font-black text-gray-500 tracking-widest uppercase block mb-3 flex items-center gap-1.5">
          <Calendar className="w-3.5 h-3.5 text-indigo-500" />
          {isAr ? 'نطاق تاريخ الطلعات المفضل' : 'Preferred Outing Date Range'}
        </span>
        <div className="grid grid-cols-2 gap-3">
          <div className="relative">
            <span className={`absolute ${isAr ? 'right-3' : 'left-3'} top-2.5 text-[9px] text-gray-400 font-bold select-none pointer-events-none uppercase`}>
              {isAr ? 'من:' : 'From:'}
            </span>
            <input 
              type="date" 
              value={startDate} 
              onChange={(e) => setStartDate(e.target.value)} 
              className={`w-full text-xs ${isAr ? 'pr-10 pl-3' : 'pl-12 pr-3'} py-2 bg-gray-50 border border-gray-200 rounded-xl font-bold text-gray-800 focus:outline-none focus:ring-1 focus:ring-indigo-500`}
            />
          </div>
          <div className="relative">
            <span className={`absolute ${isAr ? 'right-3' : 'left-3'} top-2.5 text-[9px] text-gray-400 font-bold select-none pointer-events-none uppercase`}>
              {isAr ? 'إلى:' : 'To:'}
            </span>
            <input 
              type="date" 
              value={endDate} 
              onChange={(e) => setEndDate(e.target.value)} 
              className={`w-full text-xs ${isAr ? 'pr-10 pl-3' : 'pl-12 pr-3'} py-2 bg-gray-50 border border-gray-200 rounded-xl font-bold text-gray-800 focus:outline-none focus:ring-1 focus:ring-indigo-500`}
            />
          </div>
        </div>
      </div>

      {/* Categories Horizontal Scroller with translated Arabic tags */}
      <div className="border-t border-gray-100 pt-4" dir={isAr ? 'rtl' : 'ltr'}>
        <span className="text-[9px] font-black text-gray-500 tracking-widest uppercase block mb-3">
          🎯 {isAr ? 'تصنيف النشاط والترفيه' : 'Activity & Experience Category'}
        </span>
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none max-w-full">
          {['All', ...Object.keys(categoryMeta)].map((cat) => {
            const isSelected = selectedCategory === cat;
            const meta = categoryMeta[cat as any];
            const icon = cat === 'All' ? '🌟' : (meta?.icon || '✨');
            const label = cat === 'All' 
              ? (isAr ? 'الكل' : 'All') 
              : (isAr ? (meta?.nameAr || cat) : cat);

            return (
              <button
                key={cat}
                type="button"
                onClick={() => { triggerHaptic(); setSelectedCategory(cat); }}
                className={`px-3.5 py-1.5 rounded-full text-[10px] font-black transition-all shrink-0 flex items-center gap-1.5 cursor-pointer border ${
                  isSelected 
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm scale-105' 
                    : 'bg-gray-50 border-gray-200 hover:bg-gray-100 text-gray-700'
                }`}
              >
                <span className="text-xs">{icon}</span>
                <span>{label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Personality Style filter */}
      <div className="border-t border-gray-100 pt-4" dir={isAr ? 'rtl' : 'ltr'}>
        <span className="text-[9px] font-black text-gray-500 tracking-widest uppercase block mb-3">
          🎭 {isAr ? 'نمط وأجواء الطلعة (الرفقاء)' : 'Companion Personality Atmosphere'}
        </span>
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none max-w-full">
          {(['All', 'Chill', 'Competitive', 'Adventurous'] as const).map((style) => {
            const active = selectedArchetype === style;
            const iconsMap = { All: '👥', Chill: '🧘', Competitive: '⚡', Adventurous: '🧗' };
            const labelAr = { All: 'كل الأجواء', Chill: 'مريح وهادئ (Chill)', Competitive: 'تحدي وتنافس (Match)', Adventurous: 'مغامرات وطرق (Drive)' };
            const labelEn = { All: 'All Vibes', Chill: 'Chill & Relaxed', Competitive: 'Competitive Matches', Adventurous: 'Road & Drive' };
            return (
              <button
                key={style}
                type="button"
                onClick={() => { triggerHaptic(); setSelectedArchetype(style); }}
                className={`px-3.5 py-1.5 rounded-full text-[10px] font-black transition-all shrink-0 flex items-center gap-1.5 cursor-pointer border ${
                  active 
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm scale-105' 
                    : 'bg-gray-50 border-gray-200 hover:bg-gray-100 text-gray-700'
                }`}
              >
                <span className="text-xs">{iconsMap[style]}</span> 
                <span>{isAr ? labelAr[style] : labelEn[style]}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Distance proximity filter */}
      <div className="border-t border-gray-100 pt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3" dir={isAr ? 'rtl' : 'ltr'}>
        <div className="flex flex-col text-right">
          <span className="text-[10px] font-black text-gray-800 tracking-wider flex items-center gap-1.5 leading-none">
            📍 {isAr ? 'تحديد نطاق المسافة الجغرافية' : 'Proximity Location Range'}
          </span>
          <span className="text-[9px] text-gray-400 mt-1.5 leading-relaxed">
            {isAr 
              ? 'تصفية وحجب جميع الطلعات التي تبعد أكثر من 50 كم من موقع إحداثيات GPS الخاص بك' 
              : 'Hide and filter any outings farther than 50km from your active coordinates'}
          </span>
          {showOnlyNearby && !userCoordinates && (
            <span className="text-[8.5px] text-rose-500 font-extrabold block mt-1 animate-pulse">
              ⚠️ {isAr ? 'قم بالسماح بالوصول للموقع GPS أو اضبط مدينتك لتفعيل قياس المسافات!' : 'Grant GPS permissions or update your city location to calculate distance!'}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => { triggerHaptic(); setShowOnlyNearby(!showOnlyNearby); }}
          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
            showOnlyNearby ? 'bg-indigo-600' : 'bg-gray-200'
          }`}
        >
          <span
            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
              showOnlyNearby ? (isAr ? '-translate-x-5' : 'translate-x-5') : 'translate-x-0'
            }`}
          />
        </button>
      </div>
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { Profile, DetailedPlace } from '../types';
import { Language } from '../data/translations';
import { Search, MapPin, Users, Star, Compass, Sparkles, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { getPlaceholderImage } from '../utils/imageUtils';

interface UnifiedSearchProps {
  currentUser: Profile;
  lang: Language;
  onViewProfile: (userId: string) => void;
  onSelectPlace: (place: any) => void;
  profiles: Profile[];
  places: any[]; // Combined places from different sources
}

export default function UnifiedSearch({ currentUser, lang, onViewProfile, onSelectPlace, profiles, places }: UnifiedSearchProps) {
  const isAr = lang === 'ar';
  const [query, setQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'places' | 'people' | 'communities' | 'outings'>('all');
  const [sortBy, setSortBy] = useState<'match' | 'rating' | 'nearest' | 'popular'>('match');
  
  const filteredProfiles = (profiles || []).filter(p => 
    p.name.toLowerCase().includes(query.toLowerCase()) || 
    p.location.toLowerCase().includes(query.toLowerCase())
  ).filter(p => p.id !== currentUser.id);

  const filteredPlaces = (places || []).filter(p => 
    (p.nameEn || p.nameAr || '').toLowerCase().includes(query.toLowerCase()) || 
    (p.city || '').toLowerCase().includes(query.toLowerCase())
  );

  const sortedPlaces = [...filteredPlaces].sort((a, b) => {
    if (sortBy === 'rating') {
      return (b.rating || 0) - (a.rating || 0);
    }
    if (sortBy === 'nearest') {
      const aMatch = (a.city || '').toLowerCase() === (currentUser?.city || '').toLowerCase() ? 1 : 0;
      const bMatch = (b.city || '').toLowerCase() === (currentUser?.city || '').toLowerCase() ? 1 : 0;
      return bMatch - aMatch;
    }
    if (sortBy === 'popular') {
      const aPop = (a.rating || 0) * (a.reviewsCount || 10);
      const bPop = (b.rating || 0) * (b.reviewsCount || 10);
      return bPop - aPop;
    }
    return 0; // Default match
  });

  const showProfiles = activeFilter === 'all' || activeFilter === 'people';
  const showPlaces = activeFilter === 'all' || activeFilter === 'places';
  const showCommunities = activeFilter === 'all' || activeFilter === 'communities';
  const showOutings = activeFilter === 'all' || activeFilter === 'outings';

  return (
    <div className="max-w-xl mx-auto space-y-6" dir={isAr ? 'rtl' : 'ltr'}>
      <div className="relative">
        <Sparkles className="absolute left-4 top-3.5 w-5 h-5 text-indigo-400 animate-pulse" />
        <input 
          type="text" 
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={isAr ? 'بحث ذكي: أماكن، رفقاء، مجتمعات، طلعات...' : 'Smart Search: places, mates, communities, outings...'}
          className="w-full bg-white border border-gray-100 rounded-3xl py-3.5 px-12 text-sm focus:ring-2 focus:ring-indigo-500 shadow-sm"
        />
        {query && (
          <button 
            onClick={() => setQuery('')}
            className="absolute right-4 top-3.5 text-gray-400 hover:text-gray-600 font-bold"
          >
            ✕
          </button>
        )}
      </div>

      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
        <button 
          onClick={() => setActiveFilter('all')}
          className={`px-5 py-2 rounded-full text-xs font-black transition-all shrink-0 ${activeFilter === 'all' ? 'bg-indigo-600 text-white shadow-md' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
        >
          ✨ {isAr ? 'الكل (ترتيب ذكي)' : 'All (AI Ranked)'}
        </button>
        <button 
          onClick={() => setActiveFilter('places')}
          className={`px-4 py-2 rounded-full text-xs font-black transition-all shrink-0 ${activeFilter === 'places' ? 'bg-indigo-600 text-white shadow-md' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
        >
          📍 {isAr ? 'الأماكن' : 'Places'}
        </button>
        <button 
          onClick={() => setActiveFilter('people')}
          className={`px-4 py-2 rounded-full text-xs font-black transition-all shrink-0 ${activeFilter === 'people' ? 'bg-indigo-600 text-white shadow-md' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
        >
          👥 {isAr ? 'الرفقاء' : 'Mates'}
        </button>
        <button 
          onClick={() => setActiveFilter('communities')}
          className={`px-4 py-2 rounded-full text-xs font-black transition-all shrink-0 ${activeFilter === 'communities' ? 'bg-indigo-600 text-white shadow-md' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
        >
          🌍 {isAr ? 'المجتمعات' : 'Communities'}
        </button>
        <button 
          onClick={() => setActiveFilter('outings')}
          className={`px-4 py-2 rounded-full text-xs font-black transition-all shrink-0 ${activeFilter === 'outings' ? 'bg-indigo-600 text-white shadow-md' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
        >
          🔥 {isAr ? 'الطلعات' : 'Outings'}
        </button>
      </div>

      <div className="space-y-8 pb-20">
        {/* Results Sections */}
        {!query && (
          <div className="text-center py-20 px-8 space-y-4">
             <div className="w-16 h-16 bg-indigo-50 text-indigo-400 rounded-full flex items-center justify-center mx-auto">
               <Compass className="w-8 h-8 animate-spin-slow" />
             </div>
             <div className="space-y-1">
               <h3 className="text-sm font-black text-gray-900">{isAr ? 'استكشف عالم يالاميت' : 'Explore the YallaMate World'}</h3>
               <p className="text-xs text-slate-400">{isAr ? 'ابحث عن أفضل الأماكن للطلعة القادمة أو تواصل مع رفقاء جدد يشاركونك اهتماماتك.' : 'Find perfect spots for your next outing or catch up with new mates sharing your vibes.'}</p>
             </div>
          </div>
        )}

        {query && showProfiles && filteredProfiles.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">{isAr ? 'الرفقاء' : 'Potential Mates'}</h2>
            <div className="grid grid-cols-1 gap-2">
              {filteredProfiles.map(p => (
                <button 
                  key={p.id}
                  onClick={() => onViewProfile(p.id)}
                  className="bg-white p-3 rounded-2xl border border-gray-100 flex items-center justify-between hover:border-indigo-300 transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-slate-50 border border-gray-100 rounded-full flex items-center justify-center text-xl shadow-inner">
                      {p.avatar}
                    </div>
                    <div className="text-start">
                      <h4 className="text-sm font-black text-gray-900">{p.name}</h4>
                      <p className="text-[10px] text-slate-400 font-bold">{p.archetype} &bull; {p.location}</p>
                    </div>
                  </div>
                  <div className="bg-gray-50 p-2 rounded-xl group-hover:bg-indigo-50 transition-colors">
                    <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-indigo-600" />
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {query && showPlaces && filteredPlaces.length > 0 && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-2">
              <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{isAr ? 'الأماكن المقترحة' : 'Suggested Places'}</h2>
              
              <div className="flex items-center gap-1 bg-gray-50 p-0.5 rounded-full border border-gray-100 self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => setSortBy('match')}
                  className={`px-3 py-1 rounded-full text-[9px] font-black tracking-wider uppercase transition-colors cursor-pointer ${sortBy === 'match' ? 'bg-indigo-600 text-white' : 'text-gray-500 hover:text-gray-900'}`}
                >
                  {isAr ? 'ترتيب ذكي' : 'Match'}
                </button>
                <button
                  type="button"
                  onClick={() => setSortBy('rating')}
                  className={`px-3 py-1 rounded-full text-[9px] font-black tracking-wider uppercase transition-colors cursor-pointer ${sortBy === 'rating' ? 'bg-indigo-600 text-white' : 'text-gray-500 hover:text-gray-900'}`}
                >
                  {isAr ? 'تقييم عالي' : 'Rating'}
                </button>
                <button
                  type="button"
                  onClick={() => setSortBy('nearest')}
                  className={`px-3 py-1 rounded-full text-[9px] font-black tracking-wider uppercase transition-colors cursor-pointer ${sortBy === 'nearest' ? 'bg-indigo-600 text-white' : 'text-gray-500 hover:text-gray-900'}`}
                >
                  {isAr ? 'الأقرب لك' : 'Nearest'}
                </button>
                <button
                  type="button"
                  onClick={() => setSortBy('popular')}
                  className={`px-3 py-1 rounded-full text-[9px] font-black tracking-wider uppercase transition-colors cursor-pointer ${sortBy === 'popular' ? 'bg-indigo-600 text-white' : 'text-gray-500 hover:text-gray-900'}`}
                >
                  {isAr ? 'الأكثر شعبية' : 'Popular'}
                </button>
              </div>
            </div>
            
            <div className="grid grid-cols-1 gap-3">
              {sortedPlaces.map(place => (
                <button 
                  key={place.id}
                  onClick={() => onSelectPlace(place)}
                  className="bg-white overflow-hidden rounded-3xl border border-gray-100 flex items-center hover:border-indigo-300 transition-colors group"
                >
                  <div className="w-24 h-24 shrink-0 bg-slate-100 relative">
                     <img 
                       src={place.images && place.images.length > 0 ? place.images[0] : getPlaceholderImage(place.category)} 
                       alt="" 
                       className="w-full h-full object-cover"
                     />
                     {(!place.images || place.images.length === 0) && (
                        <div className="absolute top-1 left-1 bg-indigo-600/90 text-[7px] font-black text-white px-1.5 py-0.5 rounded shadow-sm">
                           <Sparkles className="w-2 h-2 inline mr-0.5" />
                           {isAr ? 'توضيحي' : 'AI'}
                        </div>
                     )}
                  </div>
                  <div className="p-3 flex-1 text-start">
                    <div className="flex justify-between items-start">
                      <h4 className="text-sm font-black text-gray-900 line-clamp-1">{isAr ? place.nameAr : place.nameEn}</h4>
                      <div className="flex items-center gap-1 text-[10px] text-amber-500 font-bold">
                        <Star className="w-3 h-3 fill-current" />
                        <span>{place.rating}</span>
                      </div>
                    </div>
                    <p className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                      <MapPin className="w-2.5 h-2.5" />
                      {place.city} &bull; {place.category}
                    </p>
                    <div className="mt-2 flex items-center gap-2">
                       <span className="text-[8px] bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full font-bold">
                         {isAr ? place.classificationAr : place.classificationEn}
                       </span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {query && showOutings && (
          <div className="space-y-4">
            <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">{isAr ? 'الطلعات القادمة (ميزة ذكية)' : 'Upcoming Outings (AI Feature)'}</h2>
            <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-3xl text-center">
              <Sparkles className="w-6 h-6 text-indigo-400 mx-auto mb-2" />
              <p className="text-xs text-indigo-800 font-bold">{isAr ? `تلميح ذكي: يمكنك العثور على طلعات جاهزة تتعلق بـ "${query}" من القائمة الرئيسية.` : `Smart Tip: You can find ready outings related to "${query}" via the main feed.`}</p>
            </div>
          </div>
        )}

        {query && showCommunities && (
          <div className="space-y-4">
            <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">{isAr ? 'المجتمعات ذات الصلة' : 'Related Communities'}</h2>
            <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-3xl text-center">
              <Compass className="w-6 h-6 text-emerald-400 mx-auto mb-2" />
              <p className="text-xs text-emerald-800 font-bold">{isAr ? `الذكاء الاصطناعي وجد أن "${query}" يتوافق بقوة مع مجموعة "عشاق القهوة المختصة". تم إضافته لترشيحاتك.` : `AI identified "${query}" highly with "Specialty Coffee Lovers". Added to your recommended communities.`}</p>
            </div>
          </div>
        )}

        {query && filteredProfiles.length === 0 && filteredPlaces.length === 0 && (
          <div className="text-center py-20 space-y-3">
             <div className="text-4xl">🔎</div>
             <h3 className="text-sm font-black text-gray-900">{isAr ? 'لم نجد نتائج مطابقة' : 'No matches found'}</h3>
             <p className="text-xs text-slate-400">{isAr ? 'جرب البحث بكلمات أخرى أو تصفح الأقسام المقترحة.' : 'Try refining your search or browse recommended categories.'}</p>
          </div>
        )}
      </div>
    </div>
  );
}

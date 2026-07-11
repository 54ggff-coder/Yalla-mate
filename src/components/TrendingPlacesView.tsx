import React, { useState, useEffect } from 'react';
import { useLocation } from '../contexts/LocationContext';
import { Profile } from '../types';
import { Flame, Star, TrendingUp, Crown, Camera, Coffee, MapPin, RefreshCw } from 'lucide-react';
import LocationIndicator from './LocationIndicator';
import { motion, AnimatePresence } from 'motion/react';

interface TrendingPlacesViewProps {
  currentUser: Profile;
  lang: 'en' | 'ar';
}

export default function TrendingPlacesView({ currentUser, lang }: TrendingPlacesViewProps) {
  const isAr = lang === 'ar';
  const { coords, loading: locLoading, error: locError, requestLocation } = useLocation();
  const [places, setPlaces] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<'nearest' | 'trending' | 'topRated'>('nearest');

  useEffect(() => {
    if (coords) {
      const cacheKey = `ym_trending_places_cache_${coords[0].toFixed(3)}_${coords[1].toFixed(3)}_${activeFilter}`;
      const saved = localStorage.getItem(cacheKey);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Date.now() - parsed.timestamp < 1800000) { // 30 minutes
            setPlaces(parsed.data);
            setLoading(false);
            // background refresh
            fetchTrendingPlaces(coords[0], coords[1], false);
            return;
          }
        } catch (e) {
          console.warn("Cached loading parsed failed:", e);
        }
      }
      fetchTrendingPlaces(coords[0], coords[1], true);
    } else if (!locLoading && !locError) {
      if (locError) {
        setLoading(false);
      }
    }
  }, [coords, activeFilter]);

  const fetchTrendingPlaces = async (lat: number, lng: number, withLoader = true) => {
    if (withLoader) setLoading(true);
    try {
      const resp = await fetch('/api/yallamate/trending', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat, lng, lang, filter: activeFilter })
      });
      if (!resp.ok) throw new Error('Failed to fetch');
      const data = await resp.json();
      const loadedPlaces = data.places || [];
      setPlaces(loadedPlaces);
      const cacheKey = `ym_trending_places_cache_${lat.toFixed(3)}_${lng.toFixed(3)}_${activeFilter}`;
      localStorage.setItem(cacheKey, JSON.stringify({ timestamp: Date.now(), data: loadedPlaces }));
    } catch (err) {
      console.error(err);
    } finally {
      if (withLoader) setLoading(false);
    }
  };

  const badges = {
    trending: { icon: Flame, textAr: 'رائج الآن', textEn: 'Trending Now', color: 'text-orange-500 bg-orange-50' },
    topRated: { icon: Star, textAr: 'الأعلى تقييمًا', textEn: 'Top Rated', color: 'text-yellow-500 bg-yellow-50' },
    rising: { icon: TrendingUp, textAr: 'صاعد بسرعة', textEn: 'Rising Fast', color: 'text-emerald-500 bg-emerald-50' },
    popular: { icon: Crown, textAr: 'الأكثر شعبية', textEn: 'Most Popular', color: 'text-purple-500 bg-purple-50' },
    photo: { icon: Camera, textAr: 'الأفضل للتصوير', textEn: 'Best for Photos', color: 'text-pink-500 bg-pink-50' },
    coffee: { icon: Coffee, textAr: 'الأشهر هذا الأسبوع', textEn: 'Popular This Week', color: 'text-amber-600 bg-amber-50' }
  };

  if (!coords) {
    return (
      <div className="flex flex-col items-center justify-center py-16 space-y-4 px-4 text-center">
        <MapPin className="w-12 h-12 text-slate-300" />
        <h3 className="text-lg font-bold text-slate-900">
          {isAr ? 'يحتاج التطبيق إلى موقعك الجغرافي' : 'Location Required'}
        </h3>
        <p className="text-sm text-slate-500">
          {isAr ? 'لرؤية الأماكن الرائجة القريبة منك بدقة، يرجى تفعيل الموقع.' : 'To see trending places near you accurately, please enable location.'}
        </p>
        <button
          onClick={() => requestLocation()}
          className="px-6 py-2 bg-indigo-600 text-white rounded-xl font-bold text-sm shadow-sm"
        >
          {isAr ? 'تحديث الموقع الجغرافي' : 'Sync My Location'}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20" dir={isAr ? 'rtl' : 'ltr'}>
      <LocationIndicator lang={lang} className="mb-2 shadow-sm !bg-white" />
      
      {/* Categories */}
      <div className="flex bg-white p-1.5 rounded-2xl border border-slate-200 overflow-x-auto hide-scrollbar gap-2 relative z-20 mx-4">
        <button
          onClick={() => setActiveFilter('nearest')}
          className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
            activeFilter === 'nearest' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          📍 {isAr ? 'الأقرب إلي' : 'Nearest to Me'}
        </button>
        <button
          onClick={() => setActiveFilter('trending')}
          className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
            activeFilter === 'trending' ? 'bg-orange-500 text-white shadow-md' : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          🔥 {isAr ? 'الأكثر رواجاً اليوم' : 'Trending Today'}
        </button>
        <button
          onClick={() => setActiveFilter('topRated')}
          className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
            activeFilter === 'topRated' ? 'bg-yellow-500 text-white shadow-md' : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          ⭐ {isAr ? 'الأعلى تقييماً' : 'Top Rated'}
        </button>
      </div>

      <div className="px-4 space-y-4">
        {loading ? (
          <div className="flex justify-center items-center py-20">
            <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin" />
          </div>
        ) : (!places || places.length === 0) ? (
          <div className="text-center py-20 text-slate-500 text-sm">
            {isAr ? 'لا توجد أماكن مطابقة قريبة جداً في الوقت الحالي.' : 'No matching places found nearby right now.'}
          </div>
        ) : (
          places.map((place, i) => {
            const b = badges[place.badge as keyof typeof badges] || badges.popular;
            const BadgeIcon = b.icon;
            return (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                key={place.id}
                className="bg-white rounded-2xl border border-slate-100 shadow-[0_4px_20px_-10px_rgba(0,0,0,0.05)] overflow-hidden flex flex-row"
              >
                <div className="w-1/3 relative shrink-0">
                  <img src={place.image} alt={place.name} className="w-full h-full object-cover" />
                  <div className="absolute top-2 left-2 bg-white/90 backdrop-blur-sm rounded-lg px-2 py-1 flex items-center gap-1 shadow-sm">
                    <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                    <span className="text-[10px] font-black text-slate-800">{place.rating}</span>
                  </div>
                </div>
                <div className="p-3 w-2/3 flex flex-col justify-between">
                  <div>
                    <h3 className="font-black text-slate-900 text-sm mb-1 leading-tight">{place.name}</h3>
                    <div className="flex items-center gap-2 mb-2">
                       <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${b.color}`}>
                         <BadgeIcon className="w-3 h-3" />
                         {isAr ? b.textAr : b.textEn}
                       </span>
                    </div>
                    <p className="text-[10px] text-slate-500 line-clamp-2 leading-relaxed mb-3">
                      {place.description}
                    </p>
                  </div>
                  <div className="flex items-center justify-between mt-auto">
                    <div className="flex items-center gap-1 text-[10px] font-bold text-slate-800 bg-slate-100 px-2 py-1 rounded-md">
                      <MapPin className="w-3 h-3 text-slate-400" />
                      {place.distance} {isAr ? 'كم' : 'km'}
                    </div>
                    <button className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-md hover:bg-indigo-100 transition-colors">
                      {isAr ? 'تفاصيل' : 'Details'}
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })
        )}
      </div>
    </div>
  );
}

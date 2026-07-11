import React, { useState } from 'react';
import { Compass, Loader2, Star, Clock, Activity, DollarSign, Navigation, Users } from 'lucide-react';
import { Language } from '../data/translations';

interface SuggestionResult {
  name: string;
  address: string;
  rating: number;
  distanceKm: number;
  googleMapsUrl: string;
  durationMins?: number;
  openNow?: boolean;
  crowded?: string;
}

interface SmartSuggestionsUIProps {
  lang: Language;
  userLat?: number;
  userLng?: number;
  city: string;
  country: string;
  category: string;
  attendees: number | string;
  onSelectPlace: (place: { name: string; url: string }) => void;
}

export default function SmartSuggestionsUI({ lang, userLat, userLng, city, country, category, attendees, onSelectPlace }: SmartSuggestionsUIProps) {
  const [suggestions, setSuggestions] = useState<SuggestionResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const handleFetchSmartSuggestions = async () => {
    setIsLoading(true);
    setHasSearched(true);
    try {
      const res = await fetch('/api/outings/smart-places-suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          city,
          country,
          category,
          attendees,
          userLat,
          userLng,
          lang,
          currentTime: new Date().toISOString()
        })
      });
      if (res.ok) {
        const data = await res.json();
        setSuggestions(data.results || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-[#161B26]/80 border border-indigo-500/30 shadow-lg shadow-indigo-500/10 rounded-2xl p-4">
      <div className="flex justify-between items-start mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">🤖</span>
          <div>
            <h4 className="text-xs font-black text-indigo-400 uppercase tracking-widest">{lang === 'ar' ? 'المقترح الذكي للأماكن' : 'Smart Places Suggester'}</h4>
            <p className="text-[9px] text-slate-400 max-w-[200px] leading-tight">
              {lang === 'ar' ? 'يعتمد على موقعك، الطقس، التقييمات، المسافة وميزانيتك والوقت الحالي.' : 'Based on your location, weather, ratings, distance, budget, and time.'}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleFetchSmartSuggestions}
          disabled={isLoading || !userLat || !userLng}
          className="px-3 py-1.5 bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 rounded-lg text-[10px] font-bold hover:bg-indigo-500/30 disabled:opacity-50 transition-all flex items-center gap-1.5 cursor-pointer"
        >
          {isLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Compass className="w-3 h-3" />}
          <span>{lang === 'ar' ? 'اقتراح الآن' : 'Suggest Now'}</span>
        </button>
      </div>

      {!userLat && !userLng && !hasSearched && (
        <p className="text-[9px] text-amber-500/80 font-medium italic mt-2">
          ⚠️ {lang === 'ar' ? 'قم بتحديد موقعك الحالي لتفعيل الذكاء الاصطناعي بدقة.' : 'Allow location access for precise AI suggestions.'}
        </p>
      )}

      {hasSearched && suggestions.length === 0 && !isLoading && (
        <p className="text-xs text-slate-500 text-center py-4">{lang === 'ar' ? 'لم يتم العثور على أماكن مناسبة حالياً' : 'No suitable places found right now.'}</p>
      )}

      {suggestions.length > 0 && (
        <div className="grid grid-cols-1 gap-2 mt-4 max-h-56 overflow-y-auto pr-1 custom-scroll">
          {suggestions.map((s, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => onSelectPlace({ name: s.name, url: s.googleMapsUrl })}
              className="text-left bg-[#0B0E14] border border-slate-800 hover:border-indigo-500/50 p-3 rounded-xl transition-all w-full flex flex-col cursor-pointer"
            >
              <div className="flex justify-between items-start mb-1.5">
                <span className="text-xs font-bold text-white truncate pr-2">📍 {s.name}</span>
                <span className="shrink-0 flex items-center gap-0.5 text-[10px] font-black text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                  <Star className="w-2.5 h-2.5 fill-current" /> {s.rating}
                </span>
              </div>
              
              <div className="flex flex-wrap gap-1.5 mt-1">
                <span className="flex items-center gap-0.5 text-[9px] text-slate-400 bg-slate-800/50 px-1.5 py-0.5 rounded">
                  <Navigation className="w-2.5 h-2.5" /> {s.distanceKm} km
                </span>
                {s.durationMins && (
                  <span className="flex items-center gap-0.5 text-[9px] text-slate-400 bg-slate-800/50 px-1.5 py-0.5 rounded">
                    <Clock className="w-2.5 h-2.5" /> {s.durationMins} min
                  </span>
                )}
                {s.openNow !== undefined && (
                  <span className={`flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded ${s.openNow ? 'text-emerald-400 bg-emerald-500/10' : 'text-rose-400 bg-rose-500/10'}`}>
                    <Activity className="w-2.5 h-2.5" /> {s.openNow ? (lang === 'ar' ? 'مفتوح' : 'Open') : (lang === 'ar' ? 'مغلق' : 'Closed')}
                  </span>
                )}
                {s.crowded && (
                  <span className="flex items-center gap-0.5 text-[9px] text-orange-400 bg-orange-500/10 px-1.5 py-0.5 rounded">
                    <Users className="w-2.5 h-2.5" /> {s.crowded}
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

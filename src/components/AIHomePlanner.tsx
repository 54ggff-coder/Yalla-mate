
import React, { useState, useEffect } from 'react';
import { Sparkles, RefreshCw, X } from 'lucide-react';
import { Profile } from '../types';
import { Language } from '../data/translations';
import { useLocation } from '../contexts/LocationContext';
import LocationIndicator from './LocationIndicator';

interface AIHomePlannerProps {
  currentUser: Profile;
  lang: Language;
  onInitiateCreateOuting: (prefill: any) => void;
  onClose: () => void;
}

export default function AIHomePlanner({ currentUser, lang, onInitiateCreateOuting, onClose }: AIHomePlannerProps) {
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { coords: userCoordinates, address: userAddress, requestLocation } = useLocation();

  useEffect(() => {
    requestLocation();
  }, [requestLocation]);

  const fetchSuggestions = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/ai-planner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location: userAddress?.city || currentUser.location,
          coordinates: userCoordinates ? { lat: userCoordinates[0], lng: userCoordinates[1] } : null,
          archetype: currentUser.archetype,
          interests: currentUser.interests,
          lang: lang
        })
      });
      console.log('AIHomePlanner fetch response status:', res.status);
      const data = await res.json();
      console.log('AIHomePlanner fetch response data:', data);
      if (!res.ok) {
        throw new Error(data.error || 'Failed to fetch AI suggestions');
      }
      setSuggestions(data.result?.outings || []);
    } catch (err: any) {
      console.error('Error fetching AI suggestions:', err);
      let errMsg = err.message;
      if (errMsg.includes('429') || errMsg.includes('Quota')) {
         errMsg = lang === 'ar' ? 'عذراً، تم تجاوز الحد الأقصى لاستخدام الذكاء الاصطناعي حالياً. يرجى المحاولة لاحقاً.' : 'AI Quota Exceeded. Please try again later.';
      } else {
         errMsg = lang === 'ar' ? 'حدث خطأ في جلب التوصيات.' : 'Error fetching suggestions.';
      }
      setError(errMsg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSuggestions();
  }, [currentUser.id]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex flex-col gap-1">
          <h3 className="text-sm font-black text-gray-900 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-500" />
            {lang === 'ar' ? 'توصيات الذكاء الاصطناعي لك' : 'AI Personalized for You'}
          </h3>
          <LocationIndicator lang={lang} className="!ml-0 !mr-0 !bg-transparent !border-0 !shadow-none !p-0 !justify-start scale-90 origin-left" />
        </div>
        <div className="flex items-center gap-2">
            <button 
              onClick={fetchSuggestions}
              disabled={loading}
              className="p-2 bg-gray-100 rounded-full text-gray-600 hover:bg-gray-200 transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button 
              onClick={onClose}
              className="p-2 bg-gray-100 rounded-full text-gray-600 hover:bg-gray-200 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-4 animate-in fade-in duration-500">
           {[1, 2, 3].map(i => (
             <div key={i} className="bg-white p-5 rounded-3xl border border-gray-100 flex flex-col gap-3 min-h-[140px]">
                <div className="h-32 w-full bg-gray-100 rounded-2xl animate-pulse" />
                <div className="h-4 bg-gray-200 rounded animate-pulse w-2/3" />
                <div className="h-3 bg-gray-100 rounded animate-pulse w-full" />
                <div className="h-3 bg-gray-50 rounded animate-pulse w-11/12" />
             </div>
           ))}
        </div>
      ) : error ? (
        <div className="bg-red-50 text-red-600 rounded-2xl p-6 text-center font-bold text-sm border border-red-100">
           {error}
        </div>
      ) : suggestions.length === 0 ? (
        <div className="text-center py-10 text-gray-500 text-sm">
           {lang === 'ar' ? 'لم يتم العثور على توصيات حالياً.' : 'No suggestions found at the moment.'}
        </div>
      ) : (
        <div className="grid gap-4">
          {suggestions.map((o: any, idx: number) => (
            <button
              key={idx}
              onClick={() => onInitiateCreateOuting({
                title: o.title,
                description: o.description,
                location: currentUser.location,
                rationale: o.rationale
              })}
              className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm hover:border-amber-300 transition-all text-right flex flex-col gap-3"
            >
              {o.imageUrl && (
                 <img src={o.imageUrl} alt={o.title} className="w-full h-32 object-cover rounded-xl" />
              )}
              <div className="flex justify-between items-center w-full">
                <div className="text-sm font-black text-gray-900">{o.title}</div>
                {o.rating && <div className="text-xs font-bold text-amber-500">★ {o.rating}</div>}
              </div>
              <div className="text-xs text-gray-600 leading-relaxed">{o.description}</div>
              {o.vibe && <div className="text-[10px] text-indigo-600 bg-indigo-50 px-2 py-1 rounded inline-block">{o.vibe}</div>}
              <div className="text-[10px] text-amber-600 font-medium italic mt-1 bg-amber-50 p-2 rounded-lg">
                {o.rationale}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

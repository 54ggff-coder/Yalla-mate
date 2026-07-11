
import React from 'react';
import { Outing, Profile, ActivityCategory } from '../types';
import { cityLandmarks } from '../constants';
import { Sparkles } from 'lucide-react';
import { Language, translations } from '../data/translations';
import { useLocation } from '../contexts/LocationContext';
import LocationIndicator from './LocationIndicator';

interface AISuggestionsProps {
  city: string;
  lang: Language;
  onInitiateCreateOuting: (prefill: any) => void;
}

export default function AISuggestions({ city, lang, onInitiateCreateOuting }: AISuggestionsProps) {
  const t = translations[lang];
  const { coords, requestLocation } = useLocation();
  const landmarks = cityLandmarks[city] || [];
  
  if (landmarks.length === 0) return null;

  // Take first 3 as AI suggestions
  const suggestions = landmarks.slice(0, 3).map(lm => ({
    ...lm,
    id: `ai_${lm.nameEn.replace(/\s+/g, '_')}`,
    category: lm.category as ActivityCategory,
  }));

  return (
    <div className="space-y-4 pt-6 mt-6 border-t border-gray-100">
      <div className="flex flex-col gap-1">
        <h3 className="text-xs font-black text-gray-900 uppercase tracking-widest leading-none flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-amber-500" />
          {lang === 'ar' ? 'اقتراحات إضافية من الذكاء الاصطناعي' : 'Extra AI Suggestions'}
        </h3>
        <LocationIndicator lang={lang} className="!ml-0 !mr-0 !bg-transparent !border-0 !shadow-none !p-0 !justify-start scale-90 origin-left" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {suggestions.map(s => (
          <button 
            key={s.id}
            onClick={() => onInitiateCreateOuting({
                title: s.nameEn,
                description: lang === 'ar' ? `طلعة مقترحة للذهاب إلى ${s.nameAr}` : `Plan to visit ${s.nameEn}`,
                category: s.category,
                location: s.nameEn,
                city: city
            })}
            className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm hover:border-amber-300 transition-all text-right flex flex-col items-start gap-2"
          >
            <span className="text-2xl">✨</span>
            <span className="text-sm font-bold text-gray-900">{lang === 'ar' ? s.nameAr : s.nameEn}</span>
            <span className="text-[10px] text-gray-500">{t.proposeOutingBtn}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { Profile, ActivityCategory } from '../types';
import { Sparkles, MapPin, Users, User, CircleDollarSign, Clock, HelpCircle, Send, Timer, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useLocation } from '../contexts/LocationContext';
import LocationIndicator from './LocationIndicator';

interface ImBoredSectionProps {
  currentUser: Profile;
  lang: 'ar' | 'en';
  onInitiateCreateOuting: (prefill: {
    title: string;
    description: string;
    category: ActivityCategory;
    location: string;
    isPrivate?: boolean;
    invitedUserIds?: string[];
  }) => void;
  onClose: () => void;
}

interface BoredSuggestion {
  spotName: string;
  spotDescription: string;
  category: string;
  suggestedMates: { name: string; avatar: string; archetype: string }[];
  transportNode: string;
  avgCost: string;
  departureTime: string;
  googleMapsUrl?: string;
}

export default function ImBoredSection({ currentUser, lang, onInitiateCreateOuting, onClose }: ImBoredSectionProps) {
  const isAr = lang === 'ar';
  const { coords, address: userAddress, requestLocation } = useLocation();
  
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [who, setWho] = useState<'solo' | 'group' | ''>('');
  const [budget, setBudget] = useState<'budget' | 'medium' | 'luxury' | ''>('');
  const [hours, setHours] = useState<'1' | '2' | '4+' | ''>('');

  useEffect(() => {
    requestLocation();
  }, [requestLocation]);
  
  const [loading, setLoading] = useState(false);
  const [suggestion, setSuggestion] = useState<BoredSuggestion | null>(null);

  const handleNextStep = (nextStep: 2 | 3 | 4) => {
    setStep(nextStep);
    if (nextStep === 4) {
      fetchAIProposal();
    }
  };

  const handlePrevStep = () => {
    if (step > 1) {
      setStep((step - 1) as 1 | 2 | 3 | 4);
    }
  };

  const refreshSuggestion = () => {
    fetchAIProposal();
  };

  const fetchAIProposal = async () => {
    setLoading(true);
    setSuggestion(null);

    try {
      const response = await fetch('/api/yallamate/bored', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          city: userAddress?.city || currentUser.location || '',
          lang,
          gender: currentUser.gender === 'male' ? 'men_only' : 'women_only',
          who,
          budget,
          hours,
          coords: coords ? [coords[0], coords[1]] : null
        })
      });

      if (response.ok) {
        const data = await response.json();
        if (data && data.result) {
          setSuggestion(data.result);
          setLoading(false);
          return;
        }
      }
    } catch (e) {
      console.warn("Bypassing server error for offline scenario:", e);
    }

    // Fallback: Notify user if generation fails
    setSuggestion(null);
    setLoading(false);
    // Optional: add a real notification here if desired, 
    // but the UI will naturally show a "retry" or empty state.
    console.error("AI proposal generation failed.");
  };

  const handleLaunchOuting = () => {
    if (!suggestion) return;

    // Convert matching category to correct ActivityCategory format
    const categoryMapping: Record<string, ActivityCategory> = {
      'Cafes': 'Cafes',
      'Restaurants': 'Restaurants',
      'Parks': 'Parks',
      'Gaming Sessions': 'Gaming Sessions',
      'Billiards': 'Billiards',
      'Football': 'Football',
      'Outdoor Adventures': 'Outdoor Adventures'
    };
    const finalCategory: ActivityCategory = categoryMapping[suggestion.category] || 'Custom Activities';

    onInitiateCreateOuting({
      title: suggestion.spotName,
      description: suggestion.spotDescription,
      category: finalCategory,
      location: userAddress?.city || currentUser.location || (isAr ? 'المدينة الحالية' : 'Current City'),
      invitedUserIds: [], // Start fresh
      isPrivate: false
    });
  };

  return (
    <div className="w-full text-center relative" dir={isAr ? 'rtl' : 'ltr'}>
      <button 
        onClick={onClose}
        className="absolute top-0 right-0 p-2 text-slate-400 hover:text-white rounded-full bg-white/5 border border-white/10"
      >
        <X className="w-5 h-5" />
      </button>

      <div className="flex items-center justify-center gap-2 mb-2 text-amber-400">
        <Sparkles className="w-8 h-8 animate-pulse" />
        <h2 className="text-2xl font-black">{isAr ? 'المساعد الذكي' : 'Smart Assistant'}</h2>
      </div>
      <LocationIndicator lang={lang} className="mb-6 !bg-slate-800 !text-slate-300 !border-slate-700" />

      <AnimatePresence mode="wait">
        {step === 1 && (
          <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
            <h3 className="text-xl font-bold text-white mb-6">{isAr ? 'هل أنت وحدك أم مع مجموعة؟' : 'Are you alone or with a group?'}</h3>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <button onClick={() => { setWho('solo'); handleNextStep(2); }} className="p-6 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl flex flex-col items-center gap-3 transition">
                 <User className="w-8 h-8 text-indigo-400" />
                 <span className="font-bold text-slate-200">{isAr ? 'لوحدي' : 'Solo'}</span>
              </button>
              <button onClick={() => { setWho('group'); handleNextStep(2); }} className="p-6 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl flex flex-col items-center gap-3 transition">
                 <Users className="w-8 h-8 text-emerald-400" />
                 <span className="font-bold text-slate-200">{isAr ? 'مع مجموعة' : 'Group'}</span>
              </button>
            </div>
          </motion.div>
        )}

        {step === 2 && (
          <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
            <h3 className="text-xl font-bold text-white mb-6">{isAr ? 'ما هي ميزانيتك؟' : 'What is your budget?'}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
              <button onClick={() => { setBudget('budget'); handleNextStep(3); }} className="p-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl flex flex-col items-center gap-2 transition cursor-pointer">
                 <CircleDollarSign className="w-6 h-6 text-slate-400" />
                 <span className="font-bold text-slate-200 text-sm">{isAr ? 'اقتصادي / مجاني' : 'Budget / Free'}</span>
              </button>
              <button onClick={() => { setBudget('medium'); handleNextStep(3); }} className="p-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl flex flex-col items-center gap-2 transition cursor-pointer">
                 <CircleDollarSign className="w-6 h-6 text-emerald-400" />
                 <span className="font-bold text-slate-200 text-sm">{isAr ? 'متوسط' : 'Medium'}</span>
              </button>
              <button onClick={() => { setBudget('luxury'); handleNextStep(3); }} className="p-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl flex flex-col items-center gap-2 transition cursor-pointer">
                 <CircleDollarSign className="w-6 h-6 text-amber-400" />
                 <span className="font-bold text-slate-200 text-sm">{isAr ? 'فاره' : 'Luxury'}</span>
              </button>
            </div>
            <button onClick={handlePrevStep} className="mt-4 text-slate-400 hover:text-white text-sm font-bold flex items-center gap-2 mx-auto cursor-pointer">
              {isAr ? 'الرجوع خطوة ↩' : 'Go Back ↩'}
            </button>
          </motion.div>
        )}

        {step === 3 && (
          <motion.div key="step3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
            <h3 className="text-xl font-bold text-white mb-6">{isAr ? 'كم ساعة لديك؟' : 'How many hours do you have?'}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
              <button onClick={() => { setHours('1'); handleNextStep(4); }} className="p-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl flex flex-col items-center gap-2 transition cursor-pointer">
                 <Timer className="w-6 h-6 text-indigo-400" />
                 <span className="font-bold text-slate-200 text-sm">{isAr ? 'ساعة واحدة' : '1 Hour'}</span>
              </button>
              <button onClick={() => { setHours('2'); handleNextStep(4); }} className="p-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl flex flex-col items-center gap-2 transition cursor-pointer">
                 <Clock className="w-6 h-6 text-indigo-400" />
                 <span className="font-bold text-slate-200 text-sm">{isAr ? 'ساعتين' : '2 Hours'}</span>
              </button>
              <button onClick={() => { setHours('4+'); handleNextStep(4); }} className="p-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl flex flex-col items-center gap-2 transition cursor-pointer">
                 <Timer className="w-6 h-6 text-purple-400" />
                 <span className="font-bold text-slate-200 text-sm">{isAr ? '٤ ساعات وأكثر' : '4+ Hours'}</span>
              </button>
            </div>
            <button onClick={handlePrevStep} className="mt-4 text-slate-400 hover:text-white text-sm font-bold flex items-center gap-2 mx-auto cursor-pointer">
              {isAr ? 'الرجوع خطوة ↩' : 'Go Back ↩'}
            </button>
          </motion.div>
        )}

        {step === 4 && loading && (
          <motion.div key="step4Loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-12 flex flex-col items-center justify-center space-y-4">
            <div className="w-16 h-16 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-amber-400 font-bold animate-pulse text-sm">{isAr ? 'جاري تحليل البيانات وإيجاد أفضل مسار لك...' : 'Analyzing parameters & routing matches...'}</p>
          </motion.div>
        )}

        {step === 4 && !loading && suggestion && (
          <motion.div key="step4Done" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="space-y-6 text-left flex flex-col" dir={isAr ? 'rtl' : 'ltr'}>
            <div className="bg-gradient-to-r from-amber-500/10 to-transparent p-5 rounded-3xl border border-amber-500/20">
              <h3 className="text-xl font-black text-white flex items-center gap-2 mb-2">
                <MapPin className="w-5 h-5 text-amber-400" />
                {suggestion.spotName}
              </h3>
              <p className="text-sm text-slate-300 leading-relaxed mb-4">{suggestion.spotDescription}</p>
              
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                 <div className="bg-black/20 p-3 rounded-2xl">
                   <div className="text-[10px] text-slate-500 font-bold uppercase mb-1">{isAr ? 'التكلفة التقريبية' : 'Est. Cost'}</div>
                   <div className="text-sm font-black text-emerald-400">{suggestion.avgCost}</div>
                 </div>
                 <div className="bg-black/20 p-3 rounded-2xl">
                   <div className="text-[10px] text-slate-500 font-bold uppercase mb-1">{isAr ? 'وقت الانطلاق' : 'Departure'}</div>
                   <div className="text-sm font-black text-indigo-400">{suggestion.departureTime}</div>
                 </div>
                 <div className="bg-black/20 p-3 rounded-2xl col-span-2">
                   <div className="text-[10px] text-slate-500 font-bold uppercase mb-1">{isAr ? 'الرفقاء المتاحين' : 'Available Mates'}</div>
                   <div className="bg-[#07090E] rounded-xl flex items-center gap-2 overflow-hidden px-2 py-1.5 border border-white/5">
                      {suggestion.suggestedMates.map((m, i) => (
                        <div key={i} className="flex-shrink-0 w-8 h-8 flex items-center justify-center bg-white/10 rounded-full border border-white/10 text-sm shadow-md" title={m.name}>
                          {m.avatar}
                        </div>
                      ))}
                      <span className="text-[10px] font-bold text-slate-300 mr-2">{isAr ? `+ ${suggestion.suggestedMates.length} رفقاء` : `+ ${suggestion.suggestedMates.length} mates`}</span>
                   </div>
                 </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row justify-end gap-2 pt-3 border-t border-white/5 mt-auto">
              <button
                onClick={() => { setStep(3); }}
                className="w-full sm:w-auto py-3 px-6 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white font-bold text-xs rounded-xl transition-all border border-white/10 flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>{isAr ? 'الرجوع خطوة ↩' : 'Go Back ↩'}</span>
              </button>
              {suggestion.googleMapsUrl && (
                <a 
                  href={suggestion.googleMapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full sm:w-auto py-3 px-6 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl transition-all border border-indigo-400/30 flex items-center justify-center gap-2 cursor-pointer shadow-sm shadow-indigo-500/20"
                >
                  <MapPin className="w-4 h-4" />
                  <span>{isAr ? 'عرض الموقع 🗺️' : 'View on Maps 🗺️'}</span>
                </a>
              )}
              <button
                onClick={refreshSuggestion}
                className="w-full sm:w-auto py-3 px-6 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white font-bold text-xs rounded-xl transition-all border border-white/10 flex items-center justify-center gap-2 cursor-pointer"
              >
                <Sparkles className="w-4 h-4" />
                <span>{isAr ? 'اقتراح آخر 🔄' : 'Another Match 🔄'}</span>
              </button>
              <button
                onClick={handleLaunchOuting}
                className="w-full sm:w-auto py-3 px-8 bg-emerald-500 hover:bg-emerald-400 text-white font-black text-sm rounded-xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
              >
                <Send className="w-5 h-5 animate-bounce" />
                <span>{isAr ? 'إنشاء الطلعة للمجموعة 🚀' : 'Launch Outing 🚀'}</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

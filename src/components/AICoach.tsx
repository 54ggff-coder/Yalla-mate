/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Profile, AIRecommendation, ActivityCategory } from '../types';
import { categoryMeta } from '../constants';
import { Sparkles, Users, Compass, HelpCircle, ShieldHalf, Split } from 'lucide-react';
import { translations, Language } from '../data/translations';
import LocationIndicator from './LocationIndicator';

interface AICoachProps {
  currentUser: Profile;
  availableProfiles: Profile[];
  lang: Language;
}

export default function AICoach({ currentUser, availableProfiles, lang }: AICoachProps) {
  const t = translations[lang];

  const [selectedCompanionIds, setSelectedCompanionIds] = useState<string[]>([availableProfiles[0]?.id]);
  const [requestedCategory, setRequestedCategory] = useState<ActivityCategory>('Cafes');
  const [loading, setLoading] = useState(false);
  const [recommendation, setRecommendation] = useState<AIRecommendation | null>(null);
  const [recSource, setRecSource] = useState<'ai' | 'algorithm'>('algorithm');
  
  // Personality Assessment state
  const [showQuiz, setShowQuiz] = useState(false);
  const [quizAnswers, setQuizAnswers] = useState<string[]>(['', '', '', '', '']);
  const [assessmentResult, setAssessmentResult] = useState<any>(null);

  const personalityQuestions = [
    lang === 'ar' ? 'ما هو أكثر نشاط يجعلك تشعر بالحيوية في عطلة نهاية الأسبوع؟ (رياضة، طبيعة، تجمعات)' : 'What activity makes you feel most energized on a weekend? (Sports, Nature, Gatherings)',
    lang === 'ar' ? 'كيف تفضل التعامل مع التخطيط للطلعات: التلقائية تماماً أم التنظيم المسبق؟' : 'How do you prefer planning outings: Total spontaneity or meticulous structure?',
    lang === 'ar' ? 'أي من هذه العبارات تصفك أكثر في التجمعات؟ (المركز القيادي، المستمع الهادئ، المشاكس المضحك)' : 'Which described you best in gatherings? (The Leader, The Quiet Observer, The Joker)',
    lang === 'ar' ? 'ما هو أثمن شيء في الطلعة بالنسبة لك؟ (النقاشات العميقة، الضحك والمرح، تجربة تحدي جديدة)' : 'What is the most valuable part of an outing for you? (Deep conversations, Laughter/Fun, Trying a new challenge)',
    lang === 'ar' ? 'في حال ساءت خطط الطلعة، ما هو رد فعلك الأول؟' : 'If outing plans go wrong, what is your initial reaction?'
  ];

  const [error, setError] = useState<string | null>(null);
  
  const handleAssessPersonality = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/personality/assess', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers: quizAnswers, lang })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to assess personality');
      setAssessmentResult(data.result);
      setShowQuiz(false); // Hide quiz after analysis
    } catch (err: any) {
      console.error(err);
      setError(lang === 'ar' ? 'فشل تحليل الشخصية، ربما تم تجاوز حد استخدام الذكاء الاصطناعي.' : 'Personality analysis failed, perhaps AI quota exceeded.');
    } finally {
      setLoading(false);
    }
  };

  const toggleCompanion = (id: string) => {
    if (selectedCompanionIds.includes(id)) {
      setSelectedCompanionIds(selectedCompanionIds.filter(item => item !== id));
    } else {
      setSelectedCompanionIds([...selectedCompanionIds, id]);
    }
  };

  const generateItinerary = async () => {
    setLoading(true);
    setRecommendation(null);

    // Prepare list of companions including current user
    const companionsList = [
      currentUser,
      ...availableProfiles.filter(p => selectedCompanionIds.includes(p.id))
    ];

    try {
      const response = await fetch('/api/yallamate/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companions: companionsList,
          requestedCategory: requestedCategory,
          city: currentUser.location,
          lang: lang,
        })
      });

      const data = await response.json();
      if (data.result) {
        setRecommendation(data.result);
        setRecSource(data.source);
      } else {
        throw new Error('No result returned');
      }
    } catch (err) {
      console.error('Itinerary query failed:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div id="aicoach_container" className="space-y-6 max-w-3xl mx-auto" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <div className="bg-gradient-to-tr from-[#0B0E14] via-slate-900 to-[#121021] p-6 rounded-3xl text-white border border-white/10 shadow-xl relative overflow-hidden">
        {/* Decorative ambient background */}
        <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-500/20 rounded-full blur-3xl opacity-50" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-purple-500/20 rounded-full blur-3xl opacity-50" />

        <div className="flex items-start gap-4 relative z-10">
          <div className="p-3 bg-indigo-500/20 text-indigo-400 rounded-2xl border border-indigo-500/30 shrink-0 shadow-inner">
            <Sparkles className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h2 className="text-xl font-display font-black tracking-tight">{t.aiCoachTitle}</h2>
            <p className="text-slate-300 text-xs mt-1.5 leading-relaxed font-medium">
              {t.aiCoachDesc}
            </p>
          </div>
        </div>
      </div>
      
      {/* Personality Assessment Quiz Section */}
      <div className="bg-white/5 backdrop-blur-md rounded-3xl p-6 border border-white/10 shadow-xl relative z-10">
        <h3 className="text-xs font-black text-white uppercase tracking-widest mb-4 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-purple-400" /> {t.personalityAssessTitle}
        </h3>
        
        {error && (
          <div className="text-xs text-red-400 font-bold mt-4">{error}</div>
        )}
        
        {!showQuiz && !assessmentResult && (
          <button onClick={() => setShowQuiz(true)} className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white text-xs font-bold rounded-2xl transition">
            {t.personalityQuizStartBtn}
          </button>
        )}
        
        {showQuiz && !assessmentResult && (
          <div className="space-y-4">
            <p className="text-xs text-slate-400 font-bold">{t.personalityAssessDesc}</p>
            {personalityQuestions.map((q, i) => (
              <textarea 
                key={i} 
                className="w-full bg-[#0B0E14] border border-white/10 p-3 rounded-xl text-xs text-white" 
                placeholder={q} 
                onChange={(e) => {
                  const newAnswers = [...quizAnswers];
                  newAnswers[i] = e.target.value;
                  setQuizAnswers(newAnswers);
                }}
              />
            ))}
            <button onClick={handleAssessPersonality} disabled={loading} className="px-6 py-3 bg-indigo-600 text-white text-xs font-bold rounded-2xl disabled:opacity-50">
              {loading ? '...' : t.personalityQuizAnalyzeBtn}
            </button>
          </div>
        )}
        
        {assessmentResult && (
          <div className="bg-indigo-500/10 p-4 rounded-2xl border border-indigo-500/20">
            <h4 className="text-sm font-black text-indigo-300">{assessmentResult.archetype}</h4>
            <p className="text-xs text-slate-300 mt-2">{assessmentResult.archetypeDescription}</p>
          </div>
        )}
      </div>

      <div className="bg-white/5 backdrop-blur-md rounded-3xl p-6 border border-white/10 shadow-xl grid grid-cols-1 md:grid-cols-2 gap-8 relative z-10">
        <div>
          <h3 className="text-xs font-black text-white uppercase tracking-widest mb-4 flex items-center gap-2">
            <Users className="w-4 h-4 text-indigo-400" /> {t.assembleCircleTitle}
          </h3>
          <p className="text-[10px] text-slate-400 mb-4 font-bold tracking-wide uppercase">{t.assembleCircleDesc} ({currentUser.name})</p>

          <div className="space-y-3 max-h-[220px] overflow-y-auto pr-2 custom-scroll">
            {availableProfiles.map((p) => {
              const checked = selectedCompanionIds.includes(p.id);
              return (
                <div 
                  key={p.id}
                  onClick={() => toggleCompanion(p.id)}
                  className={`flex items-center justify-between p-3 border rounded-2xl cursor-pointer transition-all duration-300 select-none shadow-sm ${checked ? 'border-indigo-500/50 bg-indigo-500/10' : 'border-white/5 bg-[#0B0E14] hover:bg-white/5'}`}
                >
                  <div className="flex items-center gap-3">
                    <span className="w-9 h-9 bg-white/5 border border-white/10 shadow-inner rounded-full flex items-center justify-center text-lg select-none shrink-0 overflow-hidden">
                      {p.avatar && (p.avatar.startsWith('http') || p.avatar.startsWith('data:image') || p.avatar.length > 4) ? (
                        <img src={p.avatar} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        p.avatar
                      )}
                    </span>
                    <div>
                      <span className="text-xs font-black text-white block tracking-wide">{p.name}</span>
                      <span className="text-[9px] text-slate-400 font-bold tracking-widest uppercase block mt-0.5">{p.archetype}</span>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={checked}
                    readOnly
                    className="rounded text-indigo-500 bg-white/10 border-white/20 focus:ring-indigo-500 focus:ring-offset-[#0B0E14] h-4 w-4"
                  />
                </div>
              );
            })}
          </div>
        </div>

        <div>
          <h3 className="text-xs font-black text-white uppercase tracking-widest mb-4 flex items-center gap-2">
            <Compass className="w-4 h-4 text-emerald-400" /> {t.chooseCategoryTitle}
          </h3>
          <p className="text-[10px] text-slate-400 mb-2 font-bold leading-relaxed">
            {lang === 'ar' ? 'سوف يتم اقتراح أماكن بناءً على موقعك الحالي وشخصيات الرفاق، بالإضافة لتفضيلاتك المسجلة عبر رقم الهاتف.' : 'Suggestions will be strongly weighted by your current location, network archetypes, and saved preferences linked to your phone number.'}
          </p>
          <LocationIndicator lang={lang} className="!ml-0 !mr-0 !bg-white/5 !text-white !border-white/10 !justify-start scale-90 origin-left mb-5" />

          <div className="space-y-4 pt-1">
            <select
              id="select_ai_category"
              value={requestedCategory}
              onChange={(e) => setRequestedCategory(e.target.value as ActivityCategory)}
              className="w-full px-4 py-3 bg-[#0B0E14] border border-white/10 rounded-2xl text-xs font-bold text-white shadow-inner focus:outline-none focus:ring-2 focus:ring-indigo-500/50 appearance-none cursor-pointer"
            >
              <option value="Cafes" className="bg-[#0B0E14] text-white">☕ {lang === 'ar' ? 'المقاهي وجلسات الحوار' : 'Cafes (Specialty Coffee)'}</option>
              <option value="Restaurants" className="bg-[#0B0E14] text-white">🍽️ {lang === 'ar' ? 'المطاعم والوجبات التقليدية' : 'Restaurants & Dinner'}</option>
              <option value="Gaming Sessions" className="bg-[#0B0E14] text-white">🎮 {lang === 'ar' ? 'ألعاب الكمبيوتر التنافسية وبلايستيشن' : 'Cooperative Gaming & Arcade'}</option>
              <option value="Study Sessions" className="bg-[#0B0E14] text-white">📚 {lang === 'ar' ? 'جلسات المذاكرة والعمل الهادئة' : 'Quiet Studies & Laptops'}</option>
              <option value="City Tours" className="bg-[#0B0E14] text-white">🚗 {lang === 'ar' ? 'جولات بالسيارة والهايكنج الخفيف' : 'Sightseeing Cruise & Drive'}</option>
              <option value="Cinema" className="bg-[#0B0E14] text-white">🎬 {lang === 'ar' ? 'حضور الأفلام في السينما' : 'Cinema & Film Evenings'}</option>
              <option value="Billiards" className="bg-[#0B0E14] text-white">🎱 {lang === 'ar' ? 'نوادي البلياردو والبولينج' : 'Billiards & Bowling'}</option>
            </select>

            <button
              id="btn_ai_generate"
              disabled={loading}
              onClick={generateItinerary}
              className="w-full py-4 mt-2 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 disabled:opacity-50 disabled:from-slate-700 disabled:to-slate-800 text-white text-xs font-black uppercase tracking-widest rounded-2xl transition-all duration-300 flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20 cursor-pointer"
            >
              {loading ? (
                <>
                  <Compass className="w-4 h-4 animate-spin text-white" />
                  <span>{t.analyzingPersonalities}</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-white" />
                  <span>{t.coordinateOutingBtn}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {loading && (
          <motion.div
            key="ai_loading"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="p-12 text-center bg-white/5 backdrop-blur-md border border-white/10 rounded-3xl shadow-xl space-y-5"
          >
            <Compass className="w-12 h-12 text-indigo-400 animate-spin mx-auto drop-shadow-[0_0_15px_rgba(99,102,241,0.5)]" />
            <h3 className="text-sm font-black text-white uppercase tracking-widest">{t.aligningParameters}</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed font-bold">
              {t.modelingBehaviorDesc}
            </p>
          </motion.div>
        )}

        {recommendation && (
          <motion.div
            key="ai_result"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white/5 backdrop-blur-md rounded-3xl p-6 border border-indigo-500/20 shadow-2xl space-y-8 relative overflow-hidden"
          >
            {/* Soft backdrop glow for the result */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-gradient-to-r from-indigo-500/5 via-purple-500/5 to-emerald-500/5 pointer-events-none rounded-3xl" />

            <div className="flex justify-between items-start gap-4 relative z-10">
              <div>
                <span className="px-3 py-1 bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-[9px] font-black uppercase tracking-widest rounded-full shadow-inner inline-block mb-3">
                  {t.matchmakerRecommendationLabel}
                </span>
                <h2 className="text-2xl font-display font-black text-white leading-tight drop-shadow-sm">{recommendation.title}</h2>
                <p className="text-slate-300 text-xs mt-2 leading-relaxed font-medium">{recommendation.description}</p>
              </div>

              <span className="px-3 py-1.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[9px] font-black uppercase tracking-widest rounded-xl shrink-0 shadow-inner">
                {lang === 'ar' ? 'مصدر:' : 'Source:'} {recSource === 'ai' ? '🤖 Live Gemini' : '🧮 Fallback Algo'}
              </span>
            </div>

            {/* Itinerary Steps */}
            <div className="space-y-4 relative z-10">
              <h4 className="text-[10px] font-black text-indigo-300 uppercase tracking-widest border-l-2 border-indigo-500/50 pl-3">
                {t.suggestedItineraryLabel}
              </h4>
              <div className="space-y-3 mt-3">
                {recommendation.suggestedItinerary.map((step, idx) => (
                  <div key={idx} className="flex gap-4 text-xs text-white bg-[#0B0E14] p-4 rounded-2xl border border-white/5 leading-relaxed font-bold shadow-inner">
                    <span className="font-black text-indigo-400 shrink-0 uppercase tracking-widest">{lang === 'ar' ? `خطوة ${idx + 1}:` : `Step ${idx + 1}:`}</span>
                    <span>{step}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Archetypes satisfied */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 relative z-10">
              <div className="space-y-4 bg-indigo-500/5 p-5 rounded-2xl border border-indigo-500/10 shadow-inner">
                <h4 className="text-[10px] font-black text-indigo-300 uppercase tracking-widest flex items-center gap-2 border-b border-indigo-500/20 pb-3">
                  <ShieldHalf className="w-4 h-4 text-indigo-400" /> {t.archetypeLogsLabel}
                </h4>
                <div className="space-y-2 mt-2">
                  {recommendation.matchedArchetypes.map((sat, idx) => (
                    <div key={idx} className="text-xs text-slate-300 font-bold leading-relaxed flex items-start gap-2">
                      <span className="text-indigo-400 mt-0.5">•</span> {sat}
                    </div>
                  ))}
                </div>
              </div>

              {/* Expense Splitting & Savings Strategies */}
              <div className="space-y-4 bg-emerald-500/5 p-5 rounded-2xl border border-emerald-500/10 shadow-inner">
                <h4 className="text-[10px] font-black text-emerald-300 uppercase tracking-widest flex items-center gap-2 border-b border-emerald-500/20 pb-3">
                  <Split className="w-4 h-4 text-emerald-400" /> {t.expenseGuidelinesLabel}
                </h4>
                <p className="text-xs text-slate-200 leading-relaxed font-bold mt-2">
                  {recommendation.savingsStrategy}
                </p>
                <div className="text-[9px] font-black text-emerald-400 tracking-widest uppercase mt-4 bg-emerald-500/10 border border-emerald-500/20 p-2.5 rounded-xl text-center">
                  {t.driverSavingProTip}
                </div>
              </div>
            </div>

            {/* Dialog Icebreakers */}
            <div className="space-y-4 bg-purple-500/5 p-5 rounded-3xl border border-purple-500/10 relative z-10 shadow-inner">
              <h4 className="text-[10px] font-black text-purple-300 uppercase tracking-widest flex items-center gap-2 mb-2">
                <HelpCircle className="w-4 h-4 text-purple-400" /> {t.recommendedIcebreakersLabel}
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
                {recommendation.icebreakers.map((ice, idx) => (
                  <div key={idx} className="bg-[#0B0E14] p-4 rounded-xl border border-white/5 text-[11px] shadow-sm font-bold text-slate-200 flex items-start gap-3 hover:border-purple-500/30 transition-colors">
                    <span className="text-lg leading-none shrink-0 drop-shadow-sm">💬</span>
                    <span className="leading-relaxed">{ice}</span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

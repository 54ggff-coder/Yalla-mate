import React, { useState, useEffect } from 'react';
import { Sparkles, MapPin, Clock, Calendar, DollarSign, Activity, Compass, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Profile, Outing } from '../types';
import { Language } from '../data/translations';

interface SmartAIDashboardProps {
  currentUser: Profile;
  outings: Outing[];
  lang: Language;
  onInitiateCreateOuting?: () => void;
}

interface AIDashboardData {
  dailySummary: string;
  recommendations: Array<{
    title: string;
    category: string;
    time: string;
    matchingReason: string;
    costSar: number;
    estimatedDistanceKm: number;
  }>;
}

export default function SmartAIDashboard({ currentUser, outings, lang, onInitiateCreateOuting }: SmartAIDashboardProps) {
  const isAr = lang === 'ar';
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<AIDashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboardData = async () => {
    setLoading(true);
    setError(null);
    try {
      const todayOutings = (outings || []).filter(o => {
        // Today is July 9, 2026. Filter outings matching July 9, 2026
        const date = new Date(o.datetime);
        return date.getFullYear() === 2026 && date.getMonth() === 6 && date.getDate() === 9;
      });

      const res = await fetch('/api/yallamate/ai-dashboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          outings: todayOutings,
          currentUser,
          lang
        })
      });

      if (!res.ok) throw new Error('Failed to load dashboard summary');
      const json = await res.json();
      setData(json);
    } catch (err: any) {
      console.error('Error fetching AI dashboard:', err);
      setError(isAr ? 'فشل تحميل بيانات المرشد الذكي' : 'Failed to connect with Al-Murshed');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [outings, currentUser, lang]);

  return (
    <motion.div 
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gradient-to-br from-[#121824] via-[#161f33] to-[#0d121c] p-6 rounded-3xl border border-indigo-500/20 shadow-xl relative overflow-hidden"
    >
      {/* Absolute high-tech glowing backgrounds */}
      <div className="absolute -top-10 -right-10 w-40 h-40 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="flex items-center justify-between mb-4 relative z-10">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-indigo-500/20 border border-indigo-500/30 rounded-xl animate-pulse">
            <Sparkles className="w-5 h-5 text-indigo-400" />
          </div>
          <div>
            <h2 className="text-sm font-black text-white tracking-widest uppercase flex items-center gap-1.5">
              {isAr ? 'المُوجز اليومي للمُرشد' : 'AL-MURSHED DAILY BRIEF'}
            </h2>
            <p className="text-[10px] text-indigo-300 font-extrabold uppercase tracking-widest">
              {isAr ? 'لوحة القيادة المدعومة بالذكاء الاصطناعي' : 'AI-POWERED INTELLIGENT COMPANION'}
            </p>
          </div>
        </div>

        <button 
          onClick={fetchDashboardData}
          disabled={loading}
          className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-all disabled:opacity-50"
          title={isAr ? 'تحديث المُرشد' : 'Refresh Brief'}
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <AnimatePresence mode="wait">
        {loading ? (
          <motion.div 
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="py-10 text-center space-y-3"
          >
            <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs text-slate-400 animate-pulse">{isAr ? 'جاري تحليل جدول طلعاتك واستنتاج التوصيات...' : 'Analyzing your outing coordinates and generating smart recommendations...'}</p>
          </motion.div>
        ) : error ? (
          <motion.div 
            key="error"
            className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-center space-y-2"
          >
            <p className="text-xs text-rose-300 font-bold">{error}</p>
            <button 
              onClick={fetchDashboardData}
              className="px-3 py-1 bg-rose-500/25 text-rose-200 text-[10px] font-bold rounded-lg hover:bg-rose-500/40 transition-colors"
            >
              {isAr ? 'إعادة المحاولة' : 'Try Again'}
            </button>
          </motion.div>
        ) : (
          <motion.div 
            key="content"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-5 relative z-10"
          >
            {/* Daily schedule summary text */}
            <div className="bg-[#0B0E14]/50 border border-white/5 p-4 rounded-2xl backdrop-blur-sm">
              <span className="text-[9px] font-black text-indigo-400 tracking-wider uppercase block mb-1">
                📅 {isAr ? 'ملخص جدول اليوم (٩ يوليو)' : 'TODAY\'S AGENDA (JULY 9)'}
              </span>
              <p className="text-xs text-slate-200 leading-relaxed font-semibold">
                {data?.dailySummary}
              </p>
            </div>

            {/* Recommendations Grid */}
            <div>
              <span className="text-[9px] font-black text-amber-400 tracking-widest uppercase block mb-3">
                ⭐ {isAr ? 'توصيات الفعاليات والأنشطة المقترحة لك' : 'TAILORED RECOMMENDATIONS'}
              </span>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {data?.recommendations.map((rec, index) => (
                  <div 
                    key={index}
                    className="p-4 bg-white/[0.03] border border-white/5 hover:border-indigo-500/30 rounded-2xl transition-all duration-300 flex flex-col justify-between group"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="text-xs font-black text-white group-hover:text-indigo-400 transition-colors">
                          {rec.title}
                        </span>
                        <span className="text-[8.5px] font-black text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20 uppercase shrink-0">
                          {rec.category}
                        </span>
                      </div>

                      <p className="text-[11px] text-slate-400 leading-relaxed mb-3">
                        {rec.matchingReason}
                      </p>
                    </div>

                    <div className="flex items-center justify-between text-[10px] font-black text-slate-500 border-t border-white/5 pt-2.5 mt-2">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        {rec.time}
                      </span>
                      <span className="flex items-center gap-2">
                        <span className="text-indigo-300">
                          {rec.estimatedDistanceKm} km
                        </span>
                        <span className="text-emerald-400 font-black">
                          {rec.costSar} SAR
                        </span>
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

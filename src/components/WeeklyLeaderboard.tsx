import React from 'react';
import { Profile } from '../types';
import { Award, ShieldCheck, Trophy, Sparkles } from 'lucide-react';

interface WeeklyLeaderboardProps {
  profiles: Profile[];
  currentUser: Profile;
  lang: 'ar' | 'en';
}

export default function WeeklyLeaderboard({ profiles, currentUser, lang }: WeeklyLeaderboardProps) {
  const isAr = lang === 'ar';

  // Sort profiles by XP (or trust score as fallback if XP is not set yet)
  const rankedProfiles = [...profiles]
    .map(p => ({
      ...p,
      xp: p.xp || 0,
      level: p.level || 1,
    }))
    .sort((a, b) => b.xp - a.xp);

  return (
    <div className="bg-white/5 backdrop-blur-md rounded-3xl p-6 border border-white/10 shadow-xl space-y-6" dir={isAr ? 'rtl' : 'ltr'}>
      <div className="flex items-center justify-between border-b border-white/10 pb-4">
        <div>
          <h3 className="text-xl font-display font-black text-white flex items-center gap-2">
            <Trophy className="w-6 h-6 text-yellow-400 animate-bounce" />
            {isAr ? 'لوحة الصدارة الأسبوعية للرفاق' : 'Weekly Companions Leaderboard'}
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            {isAr ? 'احصل على نقاط الخبرة (XP) من خلال التفاعل، التقييم الإيجابي، والالتزام وبدء الرحلات!' : 'Command the ranks! Acquire XP by hosting, committing to punctuality guidelines, and giving solid reviews.'}
          </p>
        </div>
        <div className="bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 text-xs font-bold px-3 py-1.5 rounded-xl">
          {isAr ? 'الأسبوع الحالي ⚡' : 'Active Week ⚡'}
        </div>
      </div>

      {/* Top 3 Podium Cards */}
      <div className="grid grid-cols-3 gap-3 pt-2 items-end">
        {/* 2nd Place */}
        {rankedProfiles[1] && (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4 text-center space-y-2 flex flex-col items-center h-[160px] justify-end relative">
            <div className="absolute -top-3 w-7 h-7 bg-slate-400 rounded-full flex items-center justify-center text-xs text-slate-900 font-extrabold shadow-md">
              2
            </div>
            <span className="text-2xl">{rankedProfiles[1].avatar}</span>
            <span className="text-xs font-bold text-white truncate max-w-full block leading-none">{(rankedProfiles[1]?.name || 'User').split(' ')[0]}</span>
            <span className="text-[10px] bg-slate-400/20 text-slate-300 font-bold px-2 py-0.5 rounded-full">{rankedProfiles[1].xp} XP</span>
            <span className="text-[9px] text-slate-400 font-bold">Lvl {rankedProfiles[1].level}</span>
          </div>
        )}

        {/* 1st Place */}
        {rankedProfiles[0] && (
          <div className="bg-gradient-to-b from-yellow-500/10 to-transparent border-2 border-yellow-500/30 rounded-2xl p-4 text-center space-y-2 flex flex-col items-center h-[185px] justify-end relative shadow-2xl shadow-yellow-500/10">
            <div className="absolute -top-4 w-9 h-9 bg-yellow-500 rounded-full flex items-center justify-center text-md text-[#07090E] font-black shadow-lg animate-pulse">
              👑
            </div>
            <span className="text-4xl">{rankedProfiles[0].avatar}</span>
            <span className="text-sm font-black text-white truncate max-w-full block leading-none flex items-center gap-1">
              {(rankedProfiles[0]?.name || 'User').split(' ')[0]}
              {rankedProfiles[0].verified && <ShieldCheck className="w-3.5 h-3.5 text-indigo-400 inline" />}
            </span>
            <span className="text-xs bg-yellow-400/20 text-yellow-300 font-black px-2.5 py-0.5 rounded-full">{rankedProfiles[0].xp} XP</span>
            <span className="text-[10px] text-yellow-400 font-bold flex items-center gap-1">
              <Sparkles className="w-3 h-3" /> Lvl {rankedProfiles[0].level}
            </span>
          </div>
        )}

        {/* 3rd Place */}
        {rankedProfiles[2] && (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4 text-center space-y-2 flex flex-col items-center h-[150px] justify-end relative">
            <div className="absolute -top-3 w-7 h-7 bg-amber-700/80 rounded-full flex items-center justify-center text-xs text-amber-100 font-extrabold shadow-md">
              3
            </div>
            <span className="text-2xl">{rankedProfiles[2].avatar}</span>
            <span className="text-xs font-bold text-white truncate max-w-full block leading-none">{(rankedProfiles[2]?.name || 'User').split(' ')[0]}</span>
            <span className="text-[10px] bg-amber-700/20 text-amber-300 font-bold px-2 py-0.5 rounded-full">{rankedProfiles[2].xp} XP</span>
            <span className="text-[9px] text-slate-400 font-bold">Lvl {rankedProfiles[2].level}</span>
          </div>
        )}
      </div>

      {/* Ranked List scrollable container */}
      <div className="space-y-2">
        {rankedProfiles.map((p, idx) => {
          const isMe = p.id === currentUser.id;
          return (
            <div
              key={p.id}
              className={`p-3.5 rounded-2xl border flex items-center justify-between transition-all ${
                isMe
                  ? 'bg-indigo-500/10 border-indigo-500/50 shadow-inner'
                  : 'bg-white/5 border-white/5 hover:border-white/10'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className={`w-6 text-center font-mono font-bold text-xs ${idx < 3 ? 'text-yellow-400 font-black' : 'text-slate-500'}`}>
                  #{idx + 1}
                </span>

                <span className="w-10 h-10 bg-white/5 border border-white/10 rounded-xl flex items-center justify-center text-xl select-none">
                  {p.avatar}
                </span>

                <div>
                  <div className="text-xs font-black text-white flex items-center gap-1.5">
                    {p.name}
                    {p.verified && <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />}
                    {isMe && (
                      <span className="text-[9px] bg-indigo-500/20 text-indigo-300 px-1.5 py-0.5 rounded font-black">
                        {isAr ? 'أنت' : 'You'}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] text-slate-400 font-semibold">{p.archetype}</span>
                    <span className="w-1 h-1 rounded-full bg-slate-600"></span>
                    <span className="text-[9px] text-amber-500 font-extrabold flex items-center gap-0.5">★ {p.trustScore.toFixed(1)}</span>
                  </div>
                </div>
              </div>

              <div className="text-right flex items-center gap-4">
                <div>
                  <span className="text-xs font-black text-indigo-300 block">{p.xp} XP</span>
                  <span className="text-[9px] text-slate-400 font-bold uppercase block tracking-wider">Level {p.level}</span>
                </div>
                
                {/* Micro level XP process line */}
                <div className="w-16 h-1.5 bg-white/5 rounded-full hidden sm:block overflow-hidden border border-white/10">
                  <div 
                    className="h-full bg-indigo-500 rounded-full" 
                    style={{ width: `${(p.xp % 100)}%` }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

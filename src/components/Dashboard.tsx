/**
 * @license
 * Copyright (c) 2026 Ali Fouad Al-Khidir Salem (علي فؤاد الخضر سالم). All rights reserved.
 * Protected Code.
 */

import React, { useState } from 'react';
import { Outing, Profile, ActivityCategory } from '../types';
import { categoryMeta, arabCitiesList, foreignCitiesList } from '../constants';
import OutingCard from './OutingCard';
import DashboardMap from './DashboardMap';
import AICoach from './AICoach';
import ExpenseSplitter from './ExpenseSplitter';
import PlaceSuggester from './PlaceSuggester';
import WeeklyLeaderboard from './WeeklyLeaderboard';
import InterestCommunities from './InterestCommunities';
import ImBoredSection from './ImBoredSection';
import { 
  Compass, PlusCircle, Search, ShieldCheck, Heart, Award, 
  Sparkles, AlertTriangle, UserMinus, UserPlus, CheckCircle,
  Bell, BellRing, BarChart2, Activity, Map, Users
} from 'lucide-react';
import { translations, Language } from '../data/translations';
import MatesReels from './MatesReels';
import { useLocation } from '../contexts/LocationContext';
import { useGlobalAI } from '../contexts/GlobalAIContext';
import SmartAIDashboard from './SmartAIDashboard';

interface DashboardProps {
  currentUser: Profile;
  outings: Outing[];
  allProfiles: Profile[];
  friendsList: string[]; // List of friend IDs
  onToggleFriend: (friendId: string) => void;
  onSelectOuting: (outingId: string) => void;
  onInitiateCreateOuting: (prefill?: any) => void;
  lang: Language;
  onSwitchToReels: () => void;
}

export default function Dashboard({
  currentUser,
  outings,
  allProfiles,
  friendsList,
  onToggleFriend,
  onSelectOuting,
  onInitiateCreateOuting,
  lang,
  onSwitchToReels,
}: DashboardProps) {
  const t = translations[lang];
  const { coords } = useLocation();
  const { evolutionInsights, fetchEvolutionInsights } = useGlobalAI();
  const userCoordinates = coords ? { lat: coords[0], lng: coords[1] } : null;
  const [activeTab, setActiveTab] = useState<'feed' | 'reels' | 'ai' | 'standing' | 'stats' | 'expense' | 'suggest_places' | 'leaderboard' | 'communities' | 'bored' | 'evolution'>('feed');
  const [feedLayout, setFeedLayout] = useState<'list' | 'map'>('list');
  const [remindersEnabled, setRemindersEnabled] = useState(false);

  React.useEffect(() => {
    fetchEvolutionInsights();
  }, []);
  
  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedCity, setSelectedCity] = useState<string>('All');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  const categories = ['All', ...Object.keys(categoryMeta)];
  
  const displayCitiesList = lang === 'ar' ? arabCitiesList : foreignCitiesList;
  const currentCityValue = 'Current Location';
  
  // All cities based on language preference
  const cities = ['All', currentCityValue, ...displayCitiesList.map(c => c.nameEn)];

  // Filter listings
  const filteredOutings = (outings || []).filter((outing) => {
    const matchesSearch = !searchQuery || 
      outing.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
      outing.description.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesCat = selectedCategory === 'All' || outing.category === selectedCategory;
    const matchesCity = selectedCity === 'All' 
      ? true 
      : selectedCity === currentCityValue 
        ? outing.city === currentUser.location
        : outing.city === selectedCity;

    let matchesDates = true;
    const outingDate = new Date(outing.datetime).getTime();
    if (startDate) {
      const sDate = new Date(startDate).getTime();
      if (outingDate < sDate) matchesDates = false;
    }
    if (endDate) {
      // Add 1 day to include the entire end date selected
      const eDate = new Date(endDate).getTime() + 86400000;
      if (outingDate >= eDate) matchesDates = false;
    }

    const isAllowedPrivate = !outing.isPrivate || 
      outing.creatorId === currentUser.id || 
      outing.invitedUserIds?.includes(currentUser.id);

    return matchesSearch && matchesCat && matchesCity && matchesDates && isAllowedPrivate;
  });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      {/* Side navigation and Profile info */}
      <div className="lg:col-span-3 space-y-6">
        {/* Profile Card */}
        <div className="bg-white/5 backdrop-blur-md rounded-3xl p-5 border border-white/10 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-emerald-500" />
          
          <div className="flex items-center gap-3">
            <span className="w-14 h-14 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center text-3xl shadow-inner select-none">
              {currentUser.avatar}
            </span>
            <div>
              <div className="text-base font-black text-white flex items-center gap-1.5">
                {currentUser.name}
                {currentUser.verified && (
                  <ShieldCheck className="w-4 h-4 text-indigo-400" />
                )}
              </div>
              <span className="text-[10px] bg-indigo-500/20 text-indigo-300 font-bold px-2.5 py-0.5 rounded-full mt-1.5 inline-block truncate max-w-[140px] border border-indigo-500/30">
                {currentUser.archetype}
              </span>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3 border-t border-white/5 pt-4">
            <div className="bg-white/5 p-3 rounded-2xl text-center border border-white/5">
              <span className="text-xs text-slate-400 font-bold uppercase block text-[9px] tracking-widest">{t.scoreHeading}</span>
              <span className="text-sm font-black text-amber-400 block mt-1 drop-shadow-sm">★ {currentUser.trustScore.toFixed(2)}</span>
            </div>
            <div className="bg-white/5 p-3 rounded-2xl text-center border border-white/5">
              <span className="text-xs text-slate-400 font-bold uppercase block text-[9px] tracking-widest">{t.standingHeading}</span>
              <span className={`text-[10px] font-bold block mt-1 ${currentUser.warningCount > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                {currentUser.warningCount > 0 ? `${currentUser.warningCount} ${t.alertsCountText}` : t.perfectCheck}
              </span>
            </div>
          </div>

          {/* Warning state notification */}
          {currentUser.warningCount > 0 && (
            <div className="mt-4 p-3.5 bg-rose-500/10 rounded-2xl border border-rose-500/20 flex items-start gap-2 text-[10px] leading-relaxed text-rose-300">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
              <div>
                <span className="font-bold">{t.communityWarningAlert}</span>
              </div>
            </div>
          )}

          {/* Feature 5: Visual Dashboard of Community Contribution Badges */}
          <div className="mt-5 pt-4 border-t border-white/5 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-[9px] font-black text-slate-400 tracking-widest uppercase block">
                🏵️ {lang === 'ar' ? 'أوسمة المساهمة المجتمعية' : 'Community Contribution'}
              </span>
              <span className="text-[9.5px] text-amber-400 font-bold bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-500/20">
                Lv. {currentUser.level || 2}
              </span>
            </div>

            {/* Micro Progression XP bar */}
            <div className="bg-[#0B0E14] border border-white/5 rounded-2xl p-2.5 shadow-inner">
              <div className="flex justify-between text-[9px] font-black text-slate-300 mb-1 uppercase tracking-wider">
                <span>{lang === 'ar' ? 'شريط الخبرة (XP)' : 'XP Progression'}</span>
                <span>{currentUser.xp || 320} / 500 XP</span>
              </div>
              <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden border border-white/5">
                <div 
                  className="bg-indigo-500 h-full rounded-full shadow-[0_0_8px_rgba(99,102,241,0.5)] transition-all duration-1000" 
                  style={{ width: `${Math.min(100, Math.max(10, ((currentUser.xp || 320) / 500) * 100))}%` }}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {[
                {
                  nameEn: "Frequent Organizer",
                  nameAr: "منسق طلعات دائم",
                  descEn: "Organize premium outings",
                  descAr: "تقديراً لتنسيق الفعاليات للرفقاء",
                  icon: "📅",
                  met: (currentUser.level || 1) >= 2
                },
                {
                  nameEn: "Top Rated Driver",
                  nameAr: "كابتن الطرق المقيّم",
                  descEn: "Trust score above 4.5",
                  descAr: "لتحقيق تقييم قيادة يفوق 4.5",
                  icon: "🏎️",
                  met: (currentUser.trustScore || 0) >= 4.5
                },
                {
                  nameEn: "Vanguard Catalyst",
                  nameAr: "العضو القيادي المُلهم",
                  descEn: "Earn over 300 XP",
                  descAr: "لتجاوز نقاط الخبرة 300 XP",
                  icon: "🔥",
                  met: (currentUser.xp || 0) >= 300
                },
                {
                  nameEn: "Noble Companion",
                  nameAr: "الرفيق النبيل الحريص",
                  descEn: "Zero system warnings",
                  descAr: "للانضباط الخالي من التنبيهات",
                  icon: "🛡️",
                  met: (currentUser.warningCount || 0) === 0
                }
              ].map((badge, idx) => {
                return (
                  <div 
                    key={idx} 
                    className={`p-2.5 rounded-2xl border transition-all text-center flex flex-col items-center justify-center relative ${
                      badge.met 
                        ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-200' 
                        : 'bg-white/5 border-white/5 text-slate-500 opacity-60 bg-gradient-to-br from-transparent to-black/20'
                    }`}
                  >
                    <span className={`text-xl mb-1 ${badge.met ? '' : 'grayscale opacity-40'}`}>{badge.icon}</span>
                    <span className="text-[9px] font-black leading-tight block truncate w-full">
                      {lang === 'ar' ? badge.nameAr : badge.nameEn}
                    </span>
                    <span className="text-[7.5px] font-medium leading-none text-slate-400 block mt-0.5 truncate w-full">
                      {lang === 'ar' ? badge.descAr : badge.descEn}
                    </span>
                    {badge.met ? (
                      <span className="absolute top-1 right-1 text-[6.5px] font-black text-emerald-400 bg-emerald-500/20 px-1.5 py-0.2 rounded uppercase tracking-wider">Met</span>
                    ) : (
                      <span className="absolute top-1 right-1 text-[6.5px] font-black text-slate-500 bg-white/5 px-1.5 py-0.2 rounded uppercase tracking-wider">Lock</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Workspace core navigation buttons */}
        <div className="bg-white/5 backdrop-blur-md rounded-3xl p-3 border border-white/10 shadow-xl space-y-1">
          <button
            onClick={() => setActiveTab('feed')}
            className={`w-full text-left px-4 py-3 rounded-2xl text-xs font-bold transition-all flex items-center justify-between cursor-pointer ${activeTab === 'feed' ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20' : 'text-slate-300 hover:bg-white/5 hover:text-white'}`}
          >
            <span>🌍 {t.explorerTabHeading}</span>
            <span className="text-[10px] font-semibold opacity-80 bg-white/20 px-2 py-0.5 rounded-full">{(outings?.length || 0)} {t.activeStateLabel}</span>
          </button>

          <button
            id="sidemenu_suggest_places"
            onClick={() => setActiveTab('suggest_places')}
            className={`w-full text-left px-4 py-3 rounded-2xl text-xs font-bold transition-all flex items-center justify-between cursor-pointer ${activeTab === 'suggest_places' ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20' : 'text-slate-300 hover:bg-white/5 hover:text-white'}`}
          >
            <span>🗺️ {lang === 'ar' ? 'الأماكن الشهيرة المتعددة' : 'Famous Multiple Places'}</span>
            <span className="text-[10px] bg-red-500 text-white font-extrabold px-1.5 py-0.5 rounded-md animate-pulse">NEW</span>
          </button>

          <button
            id="sidemenu_reels"
            onClick={onSwitchToReels}
            className="w-full text-left px-4 py-3 rounded-2xl text-xs font-bold transition-all flex items-center justify-between cursor-pointer text-slate-300 hover:bg-white/5 hover:text-white"
          >
            <span>🎥 {t.reelsTitle}</span>
            <div className="flex items-center gap-1.5 font-mono">
              <span className="text-[10px] bg-red-500/90 text-white font-extrabold px-1.5 py-0.5 rounded-md animate-pulse">LIVE</span>
              <span className="text-[9px] text-indigo-400">◀ {lang === 'ar' ? 'اسحب' : 'Slide'}</span>
            </div>
          </button>

          <button
            onClick={() => setActiveTab('ai')}
            className={`w-full text-left px-4 py-3 rounded-2xl text-xs font-bold transition-all flex items-center justify-between cursor-pointer ${activeTab === 'ai' ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20' : 'text-slate-300 hover:bg-white/5 hover:text-white'}`}
          >
            <span className="flex items-center gap-1.5 text-amber-300">
              <Sparkles className="w-4 h-4 animate-pulse" /> {t.matchmakerTabHeading}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('communities')}
            className={`w-full text-left px-4 py-3 rounded-2xl text-xs font-bold transition-all flex items-center justify-between cursor-pointer ${activeTab === 'communities' ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20' : 'text-slate-300 hover:bg-white/5 hover:text-white'}`}
          >
            <span>🌍 {lang === 'ar' ? 'مجتمعات الاهتمامات' : 'Interest Communities'}</span>
            <span className="text-[9px] bg-indigo-500/20 text-indigo-300 font-extrabold px-1.5 py-0.5 rounded-md">NEW</span>
          </button>

          <button
            onClick={() => setActiveTab('leaderboard')}
            className={`w-full text-left px-4 py-3 rounded-2xl text-xs font-bold transition-all flex items-center justify-between cursor-pointer ${activeTab === 'leaderboard' ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20' : 'text-slate-300 hover:bg-white/5 hover:text-white'}`}
          >
            <span>🏆 {lang === 'ar' ? 'لوحة الصدارة الأسبوعية' : 'Weekly Leaderboard'}</span>
            <span className="text-[9px] bg-yellow-500/20 text-yellow-500 font-extrabold px-1.5 py-0.5 rounded-md animate-pulse">XP</span>
          </button>

          <button
            onClick={() => setActiveTab('bored')}
            className={`w-full text-left px-4 py-3 rounded-2xl text-xs font-black transition-all flex items-center justify-between cursor-pointer ${activeTab === 'bored' ? 'bg-gradient-to-r from-amber-500 to-amber-650 text-slate-900 shadow-lg' : 'bg-amber-500/10 text-amber-300 hover:bg-amber-500/25 border border-amber-500/20'}`}
          >
            <span>⚡ {lang === 'ar' ? 'أنا طفشان!' : "I'm Bored!"}</span>
            <span className="text-[9px] bg-slate-900/45 text-white font-black px-1.5 py-0.5 rounded-md">AI</span>
          </button>

          <button
            onClick={() => setActiveTab('standing')}
            className={`w-full text-left px-4 py-3 rounded-2xl text-xs font-bold transition-all flex items-center justify-between cursor-pointer ${activeTab === 'standing' ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20' : 'text-slate-300 hover:bg-white/5 hover:text-white'}`}
          >
            <span>👥 {t.circlesTabHeading}</span>
            <span className="text-[10px] font-semibold opacity-80 bg-white/20 px-2 py-0.5 rounded-full">{(friendsList?.length || 0)} {t.matesCountText}</span>
          </button>

          <button
            onClick={() => setActiveTab('stats')}
            className={`w-full text-left px-4 py-3 rounded-2xl text-xs font-bold transition-all flex items-center justify-between cursor-pointer ${activeTab === 'stats' ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20' : 'text-slate-300 hover:bg-white/5 hover:text-white'}`}
          >
            <span>📈 {t.statsTabHeading}</span>
          </button>

          <button
            onClick={() => setActiveTab('evolution')}
            className={`w-full text-left px-4 py-3 rounded-2xl text-xs font-black transition-all flex items-center justify-between cursor-pointer ${activeTab === 'evolution' ? 'bg-gradient-to-r from-emerald-500 to-emerald-650 text-white shadow-lg' : 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/25 border border-emerald-500/20'}`}
          >
            <span>🧠 {lang === 'ar' ? 'نمو المنصة الذكي' : "App Evolution Engine"}</span>
            <span className="text-[9px] bg-slate-900/45 text-white font-black px-1.5 py-0.5 rounded-md">LIVE</span>
          </button>

          <button
            onClick={() => setActiveTab('expense')}
            className={`w-full text-left px-4 py-3 rounded-2xl text-xs font-bold transition-all flex items-center justify-between cursor-pointer ${activeTab === 'expense' ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20' : 'text-slate-300 hover:bg-white/5 hover:text-white'}`}
          >
            <span>⛽ {lang === 'ar' ? 'حاسبة تقاسم البنزين' : 'Fuel Split Calculator'}</span>
          </button>
        </div>

        {/* Notifications / Reminders */}
        <div className="bg-white/5 backdrop-blur-md rounded-3xl p-3 border border-white/10 shadow-xl">
          <button
            loading-state="false"
            onClick={() => setRemindersEnabled(!remindersEnabled)}
            className={`w-full text-left px-4 py-3 rounded-2xl text-xs font-bold transition-all flex items-center justify-between cursor-pointer ${remindersEnabled ? 'bg-amber-500/20 text-amber-300 border border-amber-500/20' : 'text-slate-400 hover:bg-white/5'}`}
          >
            <span className="flex items-center gap-2">
              {remindersEnabled ? <BellRing className="w-4 h-4 animate-bounce" /> : <Bell className="w-4 h-4" />} 
              {remindersEnabled ? t.remindersActive || 'Reminders Active' : t.enableReminders || 'Enable Reminders'}
            </span>
          </button>
        </div>

        {/* Famous Multiple Places AI / Google Maps redirection */}
        <button
          id="btn_show_famous_places"
          onClick={() => setActiveTab('suggest_places')}
          className="w-full py-4 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 text-white font-black rounded-2xl transition-all shadow-lg shadow-indigo-500/25 flex items-center justify-center gap-2 cursor-pointer text-xs uppercase tracking-wider relative overflow-hidden group"
        >
          <div className="absolute inset-0 bg-white/20 group-hover:translate-x-full transition-transform duration-500 -translate-x-full skew-x-12"></div>
          <Compass className="w-5 h-5 relative z-10 animate-pulse" /> <span className="relative z-10">{t.proposeOutingBtn}</span>
        </button>
      </div>

      {/* Main interactive area */}
      <div className="lg:col-span-9 space-y-6">
        {activeTab === 'feed' && (
          <div className="space-y-6">
            <SmartAIDashboard 
              currentUser={currentUser} 
              outings={outings} 
              lang={lang} 
              onInitiateCreateOuting={() => onInitiateCreateOuting()}
            />

            {/* Search and Filters Segment */}
            <div className="bg-white/5 backdrop-blur-md p-5 rounded-3xl border border-white/10 shadow-xl space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div className="relative md:col-span-2">
                  <Search className={`absolute ${lang === 'ar' ? 'right-3' : 'left-3'} top-3 w-4 h-4 text-slate-400`} />
                  <input
                    id="input_feed_search"
                    type="text"
                    placeholder={t.searchPlaceholder}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className={`w-full ${lang === 'ar' ? 'pr-9 pl-4' : 'pl-9 pr-4'} py-2 bg-white/5 border border-white/10 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 text-white placeholder-slate-500 transition-colors`}
                  />
                </div>

                <div className="md:col-span-2">
                  <select
                    id="select_feed_city"
                    value={selectedCity}
                    onChange={(e) => setSelectedCity(e.target.value)}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-xs font-bold text-white cursor-pointer hover:bg-white/10 transition-[background-color] focus:outline-none focus:ring-1 focus:ring-indigo-500 appearance-none"
                  >
                    <option value="All" className="bg-[#0B0E14]">{t.allCitiesOption}</option>
                    {cities.filter(c => c !== 'All').map(c => {
                      if (c === currentCityValue) {
                        return (
                          <option key={c} value={c} className="bg-[#0B0E14]">
                            {lang === 'ar' ? 'مدينتك الحالية' : 'Current Location'}
                          </option>
                        );
                      }
                      // Lookup Arabic translation for city if possible
                      const displayCitiesList = lang === 'ar' ? arabCitiesList : foreignCitiesList;
                      const matchCity = displayCitiesList.find(ac => ac.nameEn === c) || arabCitiesList.find(ac => ac.nameEn === c);
                      return (
                        <option key={c} value={c} className="bg-[#0B0E14]">
                          {lang === 'ar' && matchCity ? matchCity.nameAr : c}
                        </option>
                      );
                    })}
                  </select>
                </div>
              </div>

              {/* Date Filters Segment */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="flex flex-col">
                  <label className="text-[10px] font-bold text-slate-400 mb-1 tracking-wider uppercase">{t.startDateLabel}</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 custom-date-input"
                  />
                </div>
                <div className="flex flex-col">
                  <label className="text-[10px] font-bold text-slate-400 mb-1 tracking-wider uppercase">{t.endDateLabel}</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 custom-date-input"
                  />
                </div>
                <div className="flex items-end mb-1">
                  {(startDate || endDate) && (
                    <button
                      onClick={() => {
                         setStartDate('');
                         setEndDate('');
                      }}
                      className="px-3 py-2 w-full text-[10px] font-bold text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 rounded-xl transition cursor-pointer"
                    >
                      ✕ {t.clearDatesBtn}
                    </button>
                  )}
                </div>
              </div>

              {/* Tag Categories filter pills */}
              <div className="border-t border-white/10 pt-4">
                <span className="text-[9px] font-bold text-slate-400 tracking-widest uppercase block mb-3">{t.filterFocusLabel}</span>
                <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none max-w-full">
                  {categories.map((cat) => {
                    const active = selectedCategory === cat;
                    const meta = categoryMeta[cat as ActivityCategory];
                    return (
                      <button
                        key={cat}
                        onClick={() => setSelectedCategory(cat)}
                        className={`px-3.5 py-1.5 rounded-full text-[10px] font-bold transition-all shrink-0 flex items-center gap-1.5 cursor-pointer border ${active ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/50 shadow-inner' : 'bg-white/5 border-white/10 hover:bg-white/10 text-slate-300'}`}
                      >
                        <span className="text-sm">{meta?.icon || '🌍'}</span> <span>{lang === 'ar' && meta?.nameAr ? meta.nameAr : cat === 'All' ? t.allLabel : cat}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Outing card grid */}
            <div>
              <div className="flex justify-between items-center mb-5">
                <h3 className="text-xs font-black text-white/90 uppercase tracking-widest leading-none flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.8)]"></span>
                  {t.discoveredOutingsLabel} <span className="opacity-50 font-mono">({(filteredOutings?.length || 0)})</span>
                </h3>
                <div className="flex items-center gap-1 bg-white/5 border border-white/10 p-1 rounded-xl">
                  <button
                    onClick={() => setFeedLayout('list')}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${feedLayout === 'list' ? 'bg-indigo-500 text-white shadow-md' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
                  >
                    {lang === 'ar' ? 'قائمة' : 'List'}
                  </button>
                  <button
                    onClick={() => setFeedLayout('map')}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1.5 ${feedLayout === 'map' ? 'bg-indigo-500 text-white shadow-md' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
                  >
                    🗺️ {lang === 'ar' ? 'الخريطة' : 'Map'}
                  </button>
                </div>
              </div>

              {(filteredOutings?.length || 0) > 0 ? (
                feedLayout === 'list' ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {filteredOutings.map((out, idx) => (
                      <OutingCard
                        key={`${out.id}-${idx}`}
                        outing={out}
                        currentUserTrustScore={currentUser.trustScore}
                        onSelect={onSelectOuting}
                        onCategoryClick={setSelectedCategory}
                        lang={lang}
                      />
                    ))}
                  </div>
                ) : (
                  <DashboardMap
                    outings={filteredOutings}
                    currentUserTrustScore={currentUser.trustScore}
                    onSelectOuting={onSelectOuting}
                    lang={lang}
                    userCoordinates={userCoordinates}
                  />
                )
              ) : (
                <div className="bg-white/5 p-12 text-center rounded-3xl border border-white/10 shadow-xl space-y-4 backdrop-blur-sm">
                  <div className="text-4xl animate-bounce">☕</div>
                  <h4 className="text-sm font-black text-white">{t.noOutingsDiscovered}</h4>
                  <p className="text-xs text-slate-400 max-w-xs mx-auto leading-relaxed">{t.noOutingsDesc}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'reels' && (
          <div className="bg-[#0B0E14]/60 backdrop-blur-md p-10 rounded-3xl border border-white/10 text-center space-y-4">
            <span className="text-4xl animate-bounce block">📱</span>
            <h4 className="text-base font-black text-white">{lang === 'ar' ? 'تم تحويل الريلز إلى صفحة مستقلة بالكامل!' : 'Reels are now on a dedicated full page!'}</h4>
            <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">{lang === 'ar' ? 'يمكنك التمرير أو السحب للجانب، أو الضغط على الزر بالأسفل للانتقال فورا لصفحة الريلز ومتابعة طلعات الرفاق بأسلوب ريلز تفاعلي.' : 'You can swipe the screen to the side or click the button below to transition instantly to the immersive vertical Reels layout.'}</p>
            <button 
              onClick={onSwitchToReels}
              className="px-5 py-2.5 bg-indigo-500 hover:bg-indigo-400 text-white font-black text-xs rounded-xl shadow-lg shadow-indigo-500/10 cursor-pointer transition-all"
            >
              🚀 {lang === 'ar' ? 'اسحب وانتقل للريلز الآن' : 'Switch, Slide & Play Reels Now'}
            </button>
          </div>
        )}

        {activeTab === 'suggest_places' && (
          <PlaceSuggester
            currentUser={currentUser}
            lang={lang}
            onSelectPrefillForOuting={(prefill) => {
              onInitiateCreateOuting(prefill);
            }}
          />
        )}

        {activeTab === 'ai' && (
          <AICoach 
            currentUser={currentUser}
            availableProfiles={(allProfiles || []).filter(p => p.id !== currentUser.id)}
            lang={lang}
          />
        )}

        {activeTab === 'standing' && (
          <div className="space-y-6">
            <div className="bg-white/5 backdrop-blur-md rounded-3xl p-6 border border-white/10 shadow-xl space-y-5">
              <div>
                <h3 className="text-lg font-black text-white border-b border-white/10 pb-3">{t.myCirclesTitle}</h3>
                <p className="text-xs text-slate-400 mt-2">{t.myCirclesDesc}</p>
              </div>

              <div className="space-y-3">
                {allProfiles
                  .filter(p => p.id !== currentUser.id)
                  .map((p) => {
                    const isFriend = friendsList.includes(p.id);
                    return (
                      <div key={p.id} className="p-4 bg-white/5 border border-white/5 hover:border-white/10 transition-colors rounded-2xl flex items-center justify-between group">
                        <div className="flex items-center gap-4">
                          <span className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center text-2xl select-none group-hover:scale-110 transition-transform">
                            {p.avatar}
                          </span>
                          <div>
                            <span className="text-sm font-black text-white flex items-center gap-1.5 leading-none mb-1">{p.name} {p.verified && <ShieldCheck className="w-3.5 h-3.5 text-indigo-400"/>}</span>
                            <span className="text-[10px] text-slate-400 font-semibold flex items-center gap-1.5"><span className="text-indigo-400">{p.archetype}</span> &bull; {p.location}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-5">
                          <div className="text-right">
                            <span className="text-sm font-black text-amber-400 block">★ {p.trustScore.toFixed(1)}</span>
                            <span className="text-[9px] text-slate-500 font-bold tracking-widest uppercase block">{t.reputationLabel}</span>
                          </div>

                          <button
                            id={`btn_toggle_friend_${p.id}`}
                            onClick={() => onToggleFriend(p.id)}
                            className={`p-2.5 rounded-xl border transition-all cursor-pointer shrink-0 ${isFriend ? 'bg-rose-500/10 border-rose-500/20 text-rose-400 shadow-inner' : 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400 hover:bg-indigo-500/20'}`}
                          >
                            {isFriend ? (
                              <span className="text-[10px] font-black px-1.5 flex items-center gap-1.5 uppercase tracking-wide"><UserMinus className="w-4 h-4" /> {t.removeFriendLabel}</span>
                            ) : (
                              <span className="text-[10px] font-black px-1.5 flex items-center gap-1.5 uppercase tracking-wide"><UserPlus className="w-4 h-4" /> {t.addFriendLabel}</span>
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  })
                }
              </div>
            </div>
          </div>
        )}

        {/* --- Tab 4: Trip Statistics --- */}
        {activeTab === 'stats' && (
          <div className="space-y-6 animate-in slide-in-from-bottom-4 fade-in duration-500">
            <div className="bg-white/5 backdrop-blur-md p-8 rounded-3xl border border-white/10 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-600/10 rounded-full blur-[80px] pointer-events-none"></div>
              
              <h2 className="text-lg font-black text-white flex items-center gap-2 mb-2 relative z-10">
                <BarChart2 className="w-6 h-6 text-indigo-400" /> {t.statsTabHeading}
              </h2>
              <p className="text-xs text-slate-400 mb-8 relative z-10">{lang === 'ar' ? 'تتبع إنجازاتك ونشاطاتك في النظام.' : 'Track your achievements and activity log in the hub.'}</p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 relative z-10">
                <div className="bg-white/5 border border-white/10 p-6 rounded-2xl flex flex-col items-center justify-center text-center shadow-lg hover:bg-white/10 transition-colors">
                  <Activity className="w-6 h-6 text-emerald-400 mb-3" />
                  <span className="text-3xl font-black text-white mb-1">{(outings || []).filter(o => o.attendeeIds?.includes(currentUser.id) || o.creatorId === currentUser.id).length + 4}</span>
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{t.tripsCompleted || 'Trips Completed'}</span>
                </div>
                
                <div className="bg-white/5 border border-white/10 p-6 rounded-2xl flex flex-col items-center justify-center text-center shadow-lg hover:bg-white/10 transition-colors">
                  <Map className="w-6 h-6 text-purple-400 mb-3" />
                  <span className="text-3xl font-black text-white mb-1">120</span>
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{t.distanceTraveled || 'Distance Traveled'} {lang === 'ar' ? 'كم' : 'KM'}</span>
                </div>

                <div className="bg-white/5 border border-white/10 p-6 rounded-2xl flex flex-col items-center justify-center text-center shadow-lg hover:bg-white/10 transition-colors">
                  <UserPlus className="w-6 h-6 text-indigo-400 mb-3" />
                  <span className="text-3xl font-black text-white mb-1">{(friendsList?.length || 0) + 8}</span>
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{t.friendsMet || 'Friends Met'}</span>
                </div>
              </div>

              {/* Preferences Editor Section  */}
              <div className="mt-10 border-t border-white/10 pt-8 relative z-10">
                <h3 className="text-sm font-black text-white mb-3 flex items-center gap-2">
                  ⚙️ {lang === 'ar' ? 'تفضيلات الأماكن والمقترحات' : 'Places & Suggestions Preferences'}
                </h3>
                <p className="text-[11px] text-slate-400 mb-5 leading-relaxed">
                  {lang === 'ar' 
                    ? 'عدل تفضيلاتك لتحسين دقة اقتراحات المنسق الذكي للمطاعم والمقاهي والأماكن المشابهة.' 
                    : 'Modify your preferences to improve AI Matchmaker suggestions.'}
                </p>
                <div className="space-y-5">
                  <div className="bg-white/5 p-5 rounded-2xl border border-white/10">
                    <label className="block text-[10px] font-bold text-slate-300 mb-3 uppercase tracking-widest">
                      {lang === 'ar' ? 'أنواع الأكل المفضلة' : 'Favorite Cuisines'}
                    </label>
                    <div className="flex flex-wrap gap-2.5">
                      {['Italian', 'Asian', 'Fast Food', 'Healthy', 'Traditional'].map(cuisine => (
                        <button key={cuisine} className="px-4 py-1.5 bg-white/5 border border-white/10 shadow-sm text-[11px] rounded-xl font-bold text-slate-300 hover:bg-emerald-500/20 hover:border-emerald-500/30 hover:text-emerald-300 transition-all cursor-pointer">
                          {cuisine} +
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  <div className="bg-white/5 p-5 rounded-2xl border border-white/10">
                    <label className="block text-[10px] font-bold text-slate-300 mb-3 uppercase tracking-widest">
                      {lang === 'ar' ? 'الصالات والملاعب المفضلة' : 'Preferred Stadiums / Venues'}
                    </label>
                    <div className="flex flex-wrap gap-2.5">
                      {['Padel Courts', 'Football Stadiums', 'E-Sports Arenas', 'Quiet Studies'].map(venue => (
                        <button key={venue} className="px-4 py-1.5 bg-white/5 border border-white/10 shadow-sm text-[11px] rounded-xl font-bold text-slate-300 hover:bg-indigo-500/20 hover:border-indigo-500/30 hover:text-indigo-300 transition-all cursor-pointer">
                          {venue} +
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-8 p-5 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl text-xs text-indigo-200 font-medium leading-relaxed relative z-10 backdrop-blur-sm">
                {lang === 'ar' ? 'استمر في تنظيم المزيد من الرحلات والمقترحات لتوسيع دائرة معارفك ورفع درجات الثقة خاصتك بمجتمعنا، هذا الرمز محمي بحقوق ملكية وحماية لـ علي فؤاد الخضر سالم.' : 'Keep organizing trips and outings to expand your network and increase your standing. Protected Code by Ali Fouad Al-Khidir Salem.'}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'expense' && (
          <ExpenseSplitter lang={lang} defaultCity={currentUser.location} />
        )}

        {/* --- Tab: Weekly Leaderboard (لوحة الصدارة الأسبوعية) --- */}
        {activeTab === 'leaderboard' && (
          <div className="space-y-6 animate-in slide-in-from-bottom-4 fade-in duration-500">
            <WeeklyLeaderboard 
              profiles={allProfiles} 
              currentUser={currentUser} 
              lang={lang} 
            />
          </div>
        )}

        {/* --- Tab: Interest Communities (مجتمعات الاهتمامات) --- */}
        {activeTab === 'communities' && (
          <div className="space-y-6 animate-in slide-in-from-bottom-4 fade-in duration-500">
            <InterestCommunities 
              currentUser={currentUser} 
              lang={lang} 
              allProfiles={allProfiles}
            />
          </div>
        )}

        {/* --- Tab: "I'm Bored" (أنا طفشان!) --- */}
        {activeTab === 'bored' && (
          <div className="space-y-6 animate-in slide-in-from-bottom-4 fade-in duration-500">
            <ImBoredSection 
              currentUser={currentUser} 
              lang={lang} 
              onInitiateCreateOuting={onInitiateCreateOuting}
              onClose={() => setActiveTab('feed')}
            />
          </div>
        )}

        {/* --- Tab: "Evolution Engine" --- */}
        {activeTab === 'evolution' && (
          <div className="space-y-6 animate-in slide-in-from-bottom-4 fade-in duration-500">
            <div className="bg-emerald-950/30 backdrop-blur-md rounded-3xl p-8 border border-emerald-500/20 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-[80px] pointer-events-none"></div>
              <h2 className="text-xl font-black text-emerald-400 mb-2">{lang === 'ar' ? 'محرك نمو النظام الذكي' : 'Application Evolution Engine'}</h2>
              <p className="text-xs text-emerald-100/70 mb-8 max-w-xl">
                {lang === 'ar' ? 'يقوم المحرك المركزي بتحليل أنشطة المجتمع لاستنتاج احتياجات وميزات جديدة كلياً لتحسين التجربة بشكل ذاتي.' : 'A central AI engine analyzing macro social trends to dynamically generate missing features and logic evolutions.'}
              </p>

              <div className="space-y-4">
                {evolutionInsights.length > 0 ? evolutionInsights.map((insight, idx) => (
                  <div key={idx} className="bg-white/5 border border-white/10 p-5 rounded-2xl">
                     <div className="flex items-center gap-3 mb-2">
                       <span className="p-2 bg-emerald-500/20 rounded-lg text-emerald-400">
                         {insight.icon === 'users' ? <Users className="w-5 h-5" /> : insight.icon === 'trending' ? <Activity className="w-5 h-5"/> : <Sparkles className="w-5 h-5"/>}
                       </span>
                       <h3 className="text-sm font-bold text-emerald-300">{insight.title}</h3>
                     </div>
                     <p className="text-xs text-slate-300">{insight.description}</p>
                  </div>
                )) : (
                  <div className="text-center py-8">
                     <Sparkles className="w-8 h-8 text-emerald-500/50 mx-auto animate-pulse mb-3" />
                     <p className="text-xs text-emerald-400/70">{lang === 'ar' ? 'جاري استنتاج التحديثات...' : 'Synthesizing evolutions...'}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

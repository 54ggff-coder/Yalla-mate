import React, { useState } from 'react';
import { AnimatePresence } from 'motion/react';
import { Profile, Outing, OutingReview } from '../types';
import { translations, Language } from '../data/translations';
import { ShieldCheck, Award, Activity, AlertTriangle, ArrowLeft, Fuel, Users, BarChart2, Zap, Trophy, Compass, PlusCircle, Video, Settings, UserPlus, Trash2, UserMinus, LogOut, Camera, Moon, Sun, Lock, Sparkles, Brain, Mail } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';

import ImBoredSection from './ImBoredSection';
import AICoach from './AICoach';
import ExpenseSplitter from './ExpenseSplitter';
import WeeklyLeaderboard from './WeeklyLeaderboard';
import InterestCommunities from './InterestCommunities';
import MyPostsView from './MyPostsView';
import PersonalityQuiz from './PersonalityQuiz';
import OutingCard from './OutingCard';
import GmailCompanion from './GmailCompanion';
import UserAvatar, { openUserProfile } from './UserAvatar';

interface ProfileMoreViewProps {
  currentUser: Profile;
  allProfiles: Profile[];
  friendsList: string[];
  lang: Language;
  onInitiateCreateOuting: (prefill: any) => void;
  onEditProfile: () => void;
  onUpdateArchetype?: (arc: string) => void;
  outingsCount: number;
  outings: Outing[];
  onAddReel: () => void;
  reels: any[];
  setReels: React.Dispatch<React.SetStateAction<any[]>>;
  onChangeTab?: (tab: 'home' | 'explore' | 'create' | 'reels' | 'profile') => void;
  onLogout?: () => void;
  theme?: 'light' | 'dark';
  onToggleTheme?: () => void;
  onToggleLang?: () => void;
  onProfileClick?: (userId: string) => void;
  companionReviews?: OutingReview[];
}

import FollowersListModal from './FollowersListModal';

type InternalTab = 'menu' | 'bored' | 'ai' | 'standing' | 'stats' | 'expense' | 'leaderboard' | 'communities' | 'my_posts' | 'gmail';

export default function ProfileMoreView({
  currentUser,
  allProfiles,
  friendsList,
  lang,
  onInitiateCreateOuting,
  onEditProfile,
  onUpdateArchetype,
  outingsCount,
  outings,
  onAddReel,
  reels,
  setReels,
  onChangeTab,
  onLogout,
  theme = 'light',
  onToggleTheme,
  onToggleLang,
  onProfileClick,
  companionReviews = []
}: ProfileMoreViewProps) {
  const t = translations[lang];
  const isAr = lang === 'ar';
  
  const [selectedBadge, setSelectedBadge] = useState<any | null>(null);
  const [isQuizOpen, setIsQuizOpen] = useState(false);

  const handleQuizComplete = (archetype: string) => {
    if (onUpdateArchetype) {
      onUpdateArchetype(archetype);
    }
  };

  const xpValue = currentUser.xp || 0;
  const trustValue = currentUser.trustScore || 0;

  const currentBadges = [
    {
      id: 'pinnacle',
      nameEn: 'Pinnacle Mate',
      nameAr: 'الرفيق القدوة',
      descEn: 'Exemplary trust rating. A shining beacon of reliability in the wild!',
      descAr: 'معدل ثقة استثنائي ومثالي. رمز للموثوقية الدائمة في الرحلات الفعالة!',
      icon: <ShieldCheck className="w-5 h-5 text-emerald-500" />,
      colorClass: 'text-emerald-555',
      bgColorClass: 'bg-emerald-500/10 dark:bg-emerald-500/20',
      borderClass: 'border-emerald-500/25',
      isUnlocked: trustValue >= 9.8,
      reqTextEn: 'Trust Score 9.8+',
      reqTextAr: 'معدل ثقة 9.8+',
    },
    {
      id: 'adventurer',
      nameEn: 'High-Vibe Mate',
      nameAr: 'رفيق الوناسة الدائمة',
      descEn: 'Exceptional companion status. Highly requested at golden hour outings.',
      descAr: 'رفيق من الطراز الرفيع ذو روح مغامرة، مطلوب في جميع التجمعات المسائية.',
      icon: <Award className="w-5 h-5 text-indigo-505" />,
      colorClass: 'text-indigo-500',
      bgColorClass: 'bg-indigo-500/10 dark:bg-indigo-500/20',
      borderClass: 'border-indigo-500/25',
      isUnlocked: trustValue >= 9.5,
      reqTextEn: 'Trust Score 9.5+',
      reqTextAr: 'معدل ثقة 9.5+',
    },
    {
      id: 'trailblazer',
      nameEn: 'Trailblazer Explorer',
      nameAr: 'المستكشف المحترف',
      descEn: 'Acquired legendary experience points planning and joining outings.',
      descAr: 'حائز على نقاط خبرة أسطورية عبر تخطيط والمشاركة في الطلعات الفعالة.',
      icon: <Trophy className="w-5 h-5 text-amber-500" />,
      colorClass: 'text-amber-505',
      bgColorClass: 'bg-amber-500/10 dark:bg-amber-500/20',
      borderClass: 'border-amber-500/25',
      isUnlocked: xpValue >= 500,
      reqTextEn: 'XP of 500+',
      reqTextAr: '500+ نقطة خبرة',
    },
    {
      id: 'rising_star',
      nameEn: 'Rising Star',
      nameAr: 'النجم الصاعد',
      descEn: 'Actively participating in circles and making an epic mark.',
      descAr: 'مشارك نشط في دوائر الأصدقاء ووضع بصمته المميزة في فترة قصيرة.',
      icon: <Zap className="w-5 h-5 text-cyan-500" />,
      colorClass: 'text-cyan-505',
      bgColorClass: 'bg-cyan-500/10 dark:bg-cyan-500/20',
      borderClass: 'border-cyan-500/25',
      isUnlocked: xpValue >= 150,
      reqTextEn: 'XP of 150+',
      reqTextAr: '150+ نقطة خبرة',
    },
    {
      id: 'guardian',
      nameEn: 'Safe Community Pillar',
      nameAr: 'حامي كود المجتمع',
      descEn: 'Maintaining a clean record without any active community alerts.',
      descAr: 'الحفاظ على سجل أخلاقي نظيف في المجتمع بدون أي إنذارات.',
      icon: <Users className="w-5 h-5 text-pink-500" />,
      colorClass: 'text-pink-505',
      bgColorClass: 'bg-pink-500/10 dark:bg-pink-500/20',
      borderClass: 'border-pink-500/25',
      isUnlocked: (currentUser.warningCount || 0) === 0 && trustValue >= 9.0,
      reqTextEn: '0 Warning & Trust 9.0+',
      reqTextAr: 'دون إنذار وثقة 9.0+',
    }
  ];

  const unlockedCount = currentBadges.filter(b => b.isUnlocked).length;

  const [activeTab, setActiveTab] = useState<InternalTab>('menu');
  const [activeProfileSection, setActiveProfileSection] = useState<'bio'|'history'|'reels'|'reviews'|'reputation'>('bio');
  const [followersListState, setFollowersListState] = useState<{ show: boolean, type: 'followers' | 'following', userIds: string[] }>({ show: false, type: 'followers', userIds: [] });

  // Placeholder for friend management features
  const [friendRequests, setFriendRequests] = useState<string[]>(['user_3']); 

  const handleRemoveFriend = (friendId: string) => {
    // Implement removal logic
  };

  const handleAcceptRequest = (friendId: string) => {
    // Implement acceptance logic
  };

  if (activeTab !== 'menu') {
    return (
      <div className="space-y-6 pb-24" dir={isAr ? 'rtl' : 'ltr'}>
        <button 
          onClick={() => setActiveTab('menu')}
          className="flex items-center gap-2 text-xs font-bold text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className={`w-4 h-4 ${isAr ? 'rotate-180' : ''}`} />
          {isAr ? 'العودة للقائمة' : 'Back to Menu'}
        </button>
        
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
          {activeTab === 'bored' && (
            <ImBoredSection currentUser={currentUser} lang={lang} onInitiateCreateOuting={onInitiateCreateOuting} onClose={() => setActiveTab('menu')} />
          )}
          {activeTab === 'ai' && (
            <AICoach currentUser={currentUser} availableProfiles={(allProfiles || []).filter(p => p.id !== currentUser.id)} lang={lang} />
          )}
          {activeTab === 'leaderboard' && (
            <WeeklyLeaderboard profiles={allProfiles} currentUser={currentUser} lang={lang} />
          )}
          {activeTab === 'communities' && (
            <InterestCommunities currentUser={currentUser} lang={lang} allProfiles={allProfiles} />
          )}
          {activeTab === 'expense' && (
            <ExpenseSplitter lang={lang} defaultCity={currentUser.location} />
          )}
          {activeTab === 'gmail' && (
            <GmailCompanion currentUser={currentUser} outings={outings} lang={lang} />
          )}
          {activeTab === 'my_posts' && (
            <MyPostsView 
              currentUser={currentUser} 
              userReels={(reels || []).filter(r => r.owner_id === currentUser.id || r.creator_id === currentUser.id || (r as any).creatorId === currentUser.id)} 
              lang={lang} 
              onClose={() => setActiveTab('menu')} 
              onDeleteReel={(id) => setReels(prev => prev.filter(r => r.id !== id))}
              onUpdateReel={(id, updates) => setReels(prev => prev.map(r => r.id === id ? { ...r, ...updates } : r))}
            />
          )}
          {activeTab === 'stats' && (() => {
            const ratingData = [
              { name: isAr ? 'طلعة ١' : 'Outing 1', punctuality: 4.2, friendliness: 4.5, communication: 4.0, preparedness: 4.1 },
              { name: isAr ? 'طلعة ٢' : 'Outing 2', punctuality: 4.5, friendliness: 4.6, communication: 4.3, preparedness: 4.4 },
              { name: isAr ? 'طلعة ٣' : 'Outing 3', punctuality: 4.8, friendliness: 4.8, communication: 4.7, preparedness: 4.5 },
              { name: isAr ? 'طلعة ٤' : 'Outing 4', punctuality: 4.9, friendliness: 4.9, communication: 4.8, preparedness: 4.8 },
              { name: isAr ? 'طلعة ٥' : 'Outing 5', punctuality: 5.0, friendliness: 5.0, communication: 4.9, preparedness: 5.0 },
            ];

            return (
              <div className="bg-white/5 backdrop-blur-md p-8 rounded-3xl border border-white/10 shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-600/10 rounded-full blur-[80px] pointer-events-none"></div>
                
                <h2 className="text-lg font-black text-white flex items-center gap-2 mb-2 relative z-10">
                  <BarChart2 className="w-6 h-6 text-indigo-400" /> {t.statsTabHeading}
                </h2>
                <p className="text-xs text-slate-400 mb-8 relative z-10">{isAr ? 'تتبع إنجازاتك ونشاطاتك في النظام.' : 'Track your achievements and activity log in the hub.'}</p>
                
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 relative z-10 mb-8">
                  <div className="bg-white/5 border border-white/10 p-6 rounded-2xl flex flex-col items-center justify-center text-center shadow-lg hover:bg-white/10 transition-colors">
                    <span className="text-3xl font-black text-white mb-1">{outingsCount}</span>
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{t.tripsCompleted || 'Trips Completed'}</span>
                  </div>
                  
                  <div className="bg-white/5 border border-white/10 p-6 rounded-2xl flex flex-col items-center justify-center text-center shadow-lg hover:bg-white/10 transition-colors">
                    <span className="text-3xl font-black text-white mb-1">{outingsCount * 12}</span>
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{t.distanceTraveled || 'Distance Traveled'} {isAr ? 'كم' : 'KM'}</span>
                  </div>
                  
                  <div className="bg-white/5 border border-white/10 p-6 rounded-2xl flex flex-col items-center justify-center text-center shadow-lg hover:bg-white/10 transition-colors">
                    <span className="text-3xl font-black text-white mb-1">{friendsList.length}</span>
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{t.friendsMet || 'Friends Met'}</span>
                  </div>
                </div>

                {/* Recharts Rating Breakdown Section */}
                <div className="bg-[#0B0E14]/40 border border-white/10 p-6 rounded-2xl relative z-10">
                  <h3 className="text-xs font-black text-white uppercase tracking-widest mb-4">
                    {isAr ? 'تحليل تقييمات الرفقاء المفصلة عبر الوقت 📈' : 'Detailed Companion Ratings Breakdown Over Time 📈'}
                  </h3>
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={ratingData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <defs>
                          <linearGradient id="colorPunc" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                            <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                          </linearGradient>
                          <linearGradient id="colorFriend" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.2}/>
                            <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                          </linearGradient>
                          <linearGradient id="colorComm" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2}/>
                            <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                          </linearGradient>
                          <linearGradient id="colorPrep" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#d946ef" stopOpacity={0.2}/>
                            <stop offset="95%" stopColor="#d946ef" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                        <XAxis dataKey="name" stroke="#94a3b8" fontSize={9} tickLine={false} />
                        <YAxis domain={[3.5, 5]} stroke="#94a3b8" fontSize={9} tickLine={false} />
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#0B0E14', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '12px' }}
                          labelStyle={{ color: '#fff', fontWeight: 'bold' }}
                        />
                        <Legend verticalAlign="top" height={36} iconType="circle" wrapperStyle={{ fontSize: '9px', fontWeight: 'bold' }} />
                        <Area type="monotone" name={isAr ? 'الالتزام بالوقت' : 'Punctuality'} dataKey="punctuality" stroke="#10b981" fillOpacity={1} fill="url(#colorPunc)" strokeWidth={2} />
                        <Area type="monotone" name={isAr ? 'الود واللطف' : 'Friendliness'} dataKey="friendliness" stroke="#f59e0b" fillOpacity={1} fill="url(#colorFriend)" strokeWidth={2} />
                        <Area type="monotone" name={isAr ? 'التواصل والتجاوب' : 'Communication'} dataKey="communication" stroke="#6366f1" fillOpacity={1} fill="url(#colorComm)" strokeWidth={2} />
                        <Area type="monotone" name={isAr ? 'الجهوزية والتنظيم' : 'Preparedness'} dataKey="preparedness" stroke="#d946ef" fillOpacity={1} fill="url(#colorPrep)" strokeWidth={2} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            );
          })()}
          {activeTab === 'standing' && (
  <div className="bg-white/5 backdrop-blur-md rounded-3xl p-6 border border-white/10 shadow-xl space-y-5">
    <div>
      <h3 className="text-lg font-black text-white border-b border-white/10 pb-3">{t.myCirclesTitle}</h3>
      <p className="text-xs text-slate-400 mt-2">{t.myCirclesDesc}</p>
    </div>

    {/* Friend Requests */}
    {(friendRequests?.length || 0) > 0 && (
      <div className="space-y-3">
        <h4 className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">{isAr ? 'طلبات الصداقة' : 'Friend Requests'}</h4>
        {(allProfiles || []).filter(p => (friendRequests || []).includes(p.id)).map(p => (
           <div key={p.id} className="p-3 bg-white/5 border border-white/5 rounded-2xl flex items-center justify-between">
             <div className="flex items-center gap-3">
               <UserAvatar 
                 avatar={p.avatar} 
                 className="w-10 h-10 text-xl bg-white/10 rounded-xl cursor-pointer hover:scale-105 transition-transform" 
                 onClick={() => openUserProfile(p.id)} 
               />
               <span className="text-sm font-bold text-white cursor-pointer hover:text-indigo-400 transition-colors" onClick={() => openUserProfile(p.id)}>{p.name}</span>
             </div>
             <button onClick={() => handleAcceptRequest(p.id)} className="px-3 py-1 bg-indigo-500 rounded-lg text-[10px] font-bold text-white">{isAr ? 'قبول' : 'Accept'}</button>
           </div>
        ))}
      </div>
    )}

    <div className="space-y-3">
      <h4 className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">{isAr ? 'الأصدقاء' : 'Friends'}</h4>
      {(allProfiles || []).filter(p => p.id !== currentUser.id && friendsList.includes(p.id)).map((p) => (
         <div key={p.id} className="p-4 bg-white/5 border border-white/5 rounded-2xl flex items-center justify-between">
           <div className="flex items-center gap-4">
             <UserAvatar 
               avatar={p.avatar} 
               className="w-12 h-12 text-2xl bg-white/10 rounded-xl cursor-pointer hover:scale-105 transition-transform" 
               onClick={() => openUserProfile(p.id)} 
             />
             <div>
               <span className="text-sm font-black text-white flex items-center gap-1.5 leading-none mb-1 cursor-pointer hover:text-indigo-400 transition-colors" onClick={() => openUserProfile(p.id)}>{p.name}</span>
               <span className="text-[10px] text-slate-400 font-semibold">{p.archetype} &bull; {p.location}</span>
             </div>
           </div>
           <button onClick={() => handleRemoveFriend(p.id)} className="p-2 text-rose-400 hover:text-rose-500">
             <UserMinus className="w-5 h-5" />
           </button>
         </div>
      ))}
    </div>
  </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-16 max-w-2xl mx-auto" dir={isAr ? 'rtl' : 'ltr'}>
      {/* Profile Card */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-gray-100 dark:border-slate-800/80 shadow-sm relative overflow-hidden transition-all text-gray-900 dark:text-white">
        <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-green-500 via-blue-500 to-emerald-500" />
        
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div 
              onClick={onEditProfile}
              className="relative shrink-0 cursor-pointer group select-none"
              title={isAr ? 'تغيير الصورة الشخصية' : 'Change Profile Picture'}
            >
              <div className="relative overflow-hidden rounded-full">
                <UserAvatar
                  avatar={currentUser.avatar}
                  className="w-20 h-20 text-4xl shadow-inner bg-gray-50 dark:bg-slate-800 border border-gray-100 dark:border-slate-700 transition-transform group-hover:scale-105 duration-300"
                />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-full">
                  <Camera className="w-5 h-5 text-white" />
                </div>
              </div>
              <div className="absolute -bottom-2 -right-2 bg-indigo-600 text-white text-[9px] font-black px-2 py-0.5 rounded-full border-2 border-white dark:border-slate-900 shadow-md">
                 Lv {currentUser.level || 1}
              </div>
            </div>
            <div>
              <div className="text-xl font-black text-gray-900 dark:text-white flex items-center gap-1.5">
                {currentUser.name}
                {currentUser.verified && <ShieldCheck className="w-5 h-5 text-green-600 dark:text-green-400" />}
              </div>
              <span className="text-xs text-gray-500 dark:text-slate-400 block mb-1">{currentUser.location}</span>

              {currentUser.archetype && (
                <div className="inline-flex items-center gap-1 bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-100/50 dark:border-indigo-900 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded-md text-[9px] font-black uppercase mb-1.5">
                  <Sparkles className="w-3 h-3 text-indigo-500 shrink-0" />
                  {currentUser.archetype}
                </div>
              )}
              {/* Trust Badges */}
              <div className="flex flex-wrap items-center gap-1.5 mb-2">
                {((currentUser.trustScore !== undefined ? currentUser.trustScore : 5) >= 8.5) && (
                  <span className="flex items-center gap-1 text-[9px] text-amber-600 dark:text-amber-300 font-bold bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 px-2 py-0.5 rounded-md uppercase tracking-wider">
                    <Award className="w-2.5 h-2.5 text-amber-500 dark:text-amber-400" /> {lang === 'ar' ? 'رفيق موثوق' : 'Reliable Mate'}
                  </span>
                )}
                {((outingsCount || 0) >= 5) && (
                  <span className="flex items-center gap-1 text-[9px] text-indigo-600 dark:text-indigo-300 font-bold bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/20 px-2 py-0.5 rounded-md uppercase tracking-wider">
                    <Activity className="w-2.5 h-2.5 text-indigo-500 dark:text-indigo-400" /> {lang === 'ar' ? 'منسق مميز' : 'Top Coordinator'}
                  </span>
                )}
                {(currentUser.reputationScore !== undefined && currentUser.reputationScore >= 90) && (
                  <span className="flex items-center gap-1 text-[9px] text-emerald-600 dark:text-emerald-300 font-bold bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 px-2 py-0.5 rounded-md uppercase tracking-wider">
                    <ShieldCheck className="w-2.5 h-2.5 text-emerald-500 dark:text-emerald-400" /> {lang === 'ar' ? 'سمعة ممتازة' : 'High Reputation'}
                  </span>
                )}
              </div>

              <div className="flex flex-wrap gap-2 mt-1">
                <button 
                  onClick={onEditProfile} 
                  className="text-xs text-indigo-600 dark:text-white font-extrabold px-3 py-1.5 rounded-full border border-indigo-200 dark:border-slate-700 hover:bg-indigo-50 dark:hover:bg-slate-800 transition-colors flex items-center gap-1 shadow-xs cursor-pointer"
                >
                  <Camera className="w-3 h-3" />
                  {isAr ? 'تغيير الصورة 📸' : 'Change Photo 📸'}
                </button>
                <button 
                  onClick={onEditProfile} 
                  className="text-xs text-slate-700 dark:text-slate-200 font-bold px-3 py-1.5 rounded-full border border-gray-200 dark:border-slate-700 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  {isAr ? 'تعديل الملف' : 'Edit Profile'}
                </button>
                <button onClick={() => setIsQuizOpen(true)} className="text-[10px] text-indigo-600 dark:text-indigo-400 font-extrabold px-2.5 py-1.5 rounded-full border border-indigo-150/50 dark:border-indigo-950/50 bg-indigo-500/10 hover:bg-indigo-500/20 dark:hover:bg-indigo-950/40 transition-colors flex items-center gap-1 cursor-pointer">
                  <Brain className="w-3 h-3 text-indigo-500 shrink-0" />
                  {currentUser.archetype ? (isAr ? 'إعادة اختبار النمط' : 'Retake Social Style') : (isAr ? 'اكتشف نمطك الاجتماعي 🧠' : 'Discover Social Style 🧠')}
                </button>
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-2 items-end">
            <div className="flex gap-1 items-center">
              {onToggleTheme && (
                <button
                  onClick={onToggleTheme}
                  className="p-2 text-gray-400 hover:text-indigo-600 dark:hover:text-amber-400 active:scale-90 transition-all outline-none"
                  title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                >
                  {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400 animate-pulse" /> : <Moon className="w-4 h-4" />}
                </button>
              )}
              {onToggleLang && (
                <button
                  onClick={onToggleLang}
                  className="p-2 text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 font-black text-xs transition-colors outline-none"
                >
                  {isAr ? 'EN' : 'AR'}
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-around border-t border-gray-100 dark:border-slate-800/80 pt-5 pb-2">
          <div className="text-center">
            <span className="text-lg font-black text-gray-900 dark:text-white block">{outingsCount}</span>
            <span className="text-[9px] text-gray-500 dark:text-slate-400 font-bold uppercase tracking-widest block mt-0.5">{isAr ? 'الطلعات' : 'Outings'}</span>
          </div>
          <div className="w-px h-8 bg-gray-100 dark:bg-slate-800"></div>
          <div className="text-center cursor-pointer hover:opacity-80 transition-opacity" onClick={() => setFollowersListState({ show: true, type: 'followers', userIds: currentUser.followers || [] })}>
            <span className="text-lg font-black text-gray-900 dark:text-white block">{currentUser.followers?.length || 0}</span>
            <span className="text-[9px] text-gray-500 dark:text-slate-400 font-bold uppercase tracking-widest block mt-0.5">{isAr ? 'متابعون' : 'Followers'}</span>
          </div>
          <div className="w-px h-8 bg-gray-100 dark:bg-slate-800"></div>
          <div className="text-center cursor-pointer hover:opacity-80 transition-opacity" onClick={() => setFollowersListState({ show: true, type: 'following', userIds: currentUser.following || [] })}>
            <span className="text-lg font-black text-gray-900 dark:text-white block">{currentUser.following?.length || 0}</span>
            <span className="text-[9px] text-gray-500 dark:text-slate-400 font-bold uppercase tracking-widest block mt-0.5">{isAr ? 'يتابع' : 'Following'}</span>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-4 border-t border-gray-100 dark:border-slate-800/80 pt-5">
          <div className="bg-gray-50 dark:bg-slate-800/50 p-3 rounded-2xl text-center border border-gray-100 dark:border-slate-800/60 flex flex-col items-center justify-center">
            <span className="text-[10px] text-gray-500 dark:text-slate-400 font-bold uppercase block tracking-widest mb-1">{t.scoreHeading}</span>
            <span className="text-lg font-black text-amber-600 dark:text-amber-400">★ {currentUser.trustScore.toFixed(2)}</span>
          </div>
          <div className="bg-gray-50 dark:bg-slate-800/50 p-3 rounded-2xl text-center border border-gray-100 dark:border-slate-800/60 flex flex-col items-center justify-center">
            <span className="text-[10px] text-gray-500 dark:text-slate-400 font-bold uppercase block tracking-widest mb-1">{t.standingHeading}</span>
            <span className={`text-xs font-bold ${currentUser.warningCount > 0 ? 'text-red-650' : 'text-green-600 dark:text-green-400'}`}>
              {currentUser.warningCount > 0 ? `${currentUser.warningCount} ${t.alertsCountText}` : t.perfectCheck}
            </span>
          </div>
          <button
            onClick={onAddReel}
            className="col-span-2 mt-2 w-full flex items-center justify-center gap-2 bg-gradient-to-r from-rose-500 to-fuchsia-600 text-white rounded-2xl py-3 text-xs font-black uppercase tracking-widest hover:scale-[1.02] transition-transform"
          >
            <Video className="w-4 h-4" />
            {isAr ? 'إضافة ريلز جديد' : 'Add New Reel'}
          </button>
        </div>

        {currentUser.warningCount > 0 && (
          <div className="mt-5 p-4 bg-red-500/10 rounded-2xl border border-red-500/20 flex items-start gap-3 text-xs leading-relaxed text-red-600 dark:text-red-400">
            <AlertTriangle className="w-5 h-5 shrink-0 text-red-500" />
            <div><span className="font-bold">{t.communityWarningAlert}</span></div>
          </div>
        )}
      </div>

      {/* Profile Section Tabs */}
      <div className="flex flex-wrap bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800/80 shadow-sm p-1 gap-1">
        {['bio', 'history', 'reels', 'reviews', 'reputation'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveProfileSection(tab as any)}
            className={`flex-1 min-w-[70px] py-2 text-xs font-bold uppercase tracking-wider rounded-xl transition-all ${
              activeProfileSection === tab 
              ? 'bg-indigo-50 dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm' 
              : 'text-gray-400 dark:text-slate-500 hover:text-gray-700 dark:hover:text-slate-300'
            }`}
          >
            {tab === 'bio' && (isAr ? 'نبذة' : 'Bio')}
            {tab === 'history' && (isAr ? 'الرحلات' : 'Trips')}
            {tab === 'reels' && (isAr ? 'الفيديوهات' : 'Videos')}
            {tab === 'reviews' && (isAr ? 'التقييمات' : 'Reviews')}
            {tab === 'reputation' && (isAr ? 'السمعة' : 'Reputation')}
          </button>
        ))}
      </div>

      {activeProfileSection === 'bio' && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-gray-100 dark:border-slate-800/80 shadow-sm space-y-4 animate-in fade-in">
          <h4 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-widest">{isAr ? 'نبذة عني' : 'About Me'}</h4>
          <p className="text-sm text-gray-600 dark:text-slate-300 leading-relaxed font-medium">
            {currentUser.bio || (isAr ? 'لا توجد نبذة شخصية بعد.' : 'No bio available yet.')}
          </p>
          {currentUser.interests && currentUser.interests.length > 0 && (
            <div className="pt-4 border-t border-gray-100 dark:border-slate-800/80">
              <h5 className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest mb-3">
                {isAr ? 'الاهتمامات' : 'Interests'}
              </h5>
              <div className="flex flex-wrap gap-2">
                {currentUser.interests.map(interest => (
                  <span key={interest} className="px-3 py-1.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-slate-300 rounded-xl text-[10px] font-bold">
                    {interest}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {activeProfileSection === 'history' && (
        <div className="space-y-4 animate-in fade-in">
          {(outings || []).filter(o => o.creatorId === currentUser.id || o.attendeeIds?.includes(currentUser.id)).length > 0 ? (
            (outings || []).filter(o => o.creatorId === currentUser.id || o.attendeeIds?.includes(currentUser.id)).map((outing) => (
              <OutingCard 
                key={outing.id} 
                outing={outing} 
                currentUserTrustScore={currentUser.trustScore} 
                lang={lang} 
                onSelect={() => {}} 
              />
            ))
          ) : (
             <div className="text-center py-10 bg-white dark:bg-slate-900 rounded-3xl border border-gray-100 dark:border-slate-800/80 shadow-sm animate-in fade-in">
                <Compass className="w-8 h-8 mx-auto text-gray-300 dark:text-slate-700 mb-3" />
                <p className="text-sm font-bold text-gray-500 dark:text-slate-400">{isAr ? 'لم يقم بأي طلعة حتى الآن' : 'No outings history available.'}</p>
             </div>
          )}
        </div>
      )}

      {activeProfileSection === 'reels' && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 animate-in fade-in">
          {reels.filter(r => r.owner_id === currentUser.id || r.creator_id === currentUser.id).length > 0 ? (
            reels.filter(r => r.owner_id === currentUser.id || r.creator_id === currentUser.id).map((reel) => (
              <div key={reel.id} className="relative aspect-[9/16] rounded-2xl overflow-hidden border border-gray-100 dark:border-slate-800 shadow-sm bg-black group">
                {reel.video_url ? (
                  <video src={reel.video_url} className="w-full h-full object-cover" muted playsInline preload="metadata" />
                ) : (
                  <div className="w-full h-full bg-slate-900 flex items-center justify-center">
                    <Video className="w-8 h-8 text-gray-500" />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/30 p-3 flex flex-col justify-between opacity-90 group-hover:opacity-100 transition-opacity">
                  <div className="flex justify-end">
                    <span className="text-[10px] bg-black/45 text-white py-0.5 px-2 rounded-full font-bold">
                      ❤️ {reel.likes_count || 0}
                    </span>
                  </div>
                  <div>
                    <p className="text-white text-xs font-bold line-clamp-2 leading-snug">{reel.caption}</p>
                    <span className="text-[9px] text-gray-300 block mt-1">
                      💬 {reel.comments_count || 0} {isAr ? 'تعليقات' : 'comments'}
                    </span>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="col-span-full text-center py-10 bg-white dark:bg-slate-900 rounded-3xl border border-gray-100 dark:border-slate-800/80 shadow-sm">
              <Video className="w-8 h-8 mx-auto text-gray-300 dark:text-slate-700 mb-3" />
              <p className="text-sm font-bold text-gray-500 dark:text-slate-400">
                {isAr ? 'لم تقم بنشر أي مقطع فيديو بعد' : 'No reels published yet.'}
              </p>
            </div>
          )}
        </div>
      )}

      {activeProfileSection === 'reviews' && (
        <div className="space-y-4 animate-in fade-in">
          {companionReviews.filter(r => r.revieweeId === currentUser.id).length > 0 ? (
            companionReviews.filter(r => r.revieweeId === currentUser.id).map((review) => {
              const reviewer = allProfiles.find(p => p.id === review.reviewerId);
              const avgScore = ((review.respectfulRating + review.punctualRating + review.paymentRating + review.friendlyRating) / 4).toFixed(1);
              return (
                <div key={review.id} className="bg-white dark:bg-slate-900 p-4 rounded-3xl border border-gray-100 dark:border-slate-800/80 shadow-sm space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <UserAvatar avatar={reviewer?.avatar} className="w-9 h-9" />
                      <div>
                        <h4 className="text-xs font-black text-gray-900 dark:text-white">
                          {reviewer?.name || (isAr ? 'رفيق طلعة' : 'Companion')}
                        </h4>
                        <span className="text-[9px] text-gray-400 block">
                          {reviewer?.location || (isAr ? 'المملكة العربية السعودية' : 'Saudi Arabia')}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 bg-amber-50 dark:bg-amber-500/10 border border-amber-100 dark:border-amber-500/20 py-1 px-2.5 rounded-full text-xs font-black text-amber-600 dark:text-amber-400">
                      ★ {avgScore}
                    </div>
                  </div>
                  
                  {review.comment && (
                    <p className="text-xs text-gray-600 dark:text-slate-300 leading-relaxed font-medium bg-gray-50 dark:bg-slate-800/30 p-3 rounded-2xl">
                      "{review.comment}"
                    </p>
                  )}

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-gray-100 dark:border-slate-800/40">
                    <div className="text-center bg-gray-50/50 dark:bg-slate-800/10 p-1.5 rounded-xl">
                      <span className="text-[8px] text-gray-400 uppercase tracking-widest block">{isAr ? 'الاحترام' : 'Respect'}</span>
                      <span className="text-xs font-black text-indigo-600 dark:text-indigo-400">★ {review.respectfulRating}</span>
                    </div>
                    <div className="text-center bg-gray-50/50 dark:bg-slate-800/10 p-1.5 rounded-xl">
                      <span className="text-[8px] text-gray-400 uppercase tracking-widest block">{isAr ? 'الالتزام' : 'Punctual'}</span>
                      <span className="text-xs font-black text-indigo-600 dark:text-indigo-400">★ {review.punctualRating}</span>
                    </div>
                    <div className="text-center bg-gray-50/50 dark:bg-slate-800/10 p-1.5 rounded-xl">
                      <span className="text-[8px] text-gray-400 uppercase tracking-widest block">{isAr ? 'التعامل المالي' : 'Splitting'}</span>
                      <span className="text-xs font-black text-indigo-600 dark:text-indigo-400">★ {review.paymentRating}</span>
                    </div>
                    <div className="text-center bg-gray-50/50 dark:bg-slate-800/10 p-1.5 rounded-xl">
                      <span className="text-[8px] text-gray-400 uppercase tracking-widest block">{isAr ? 'الودية' : 'Friendly'}</span>
                      <span className="text-xs font-black text-indigo-600 dark:text-indigo-400">★ {review.friendlyRating}</span>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-center py-10 bg-white dark:bg-slate-900 rounded-3xl border border-gray-100 dark:border-slate-800/80 shadow-sm">
              <Award className="w-8 h-8 mx-auto text-gray-300 dark:text-slate-700 mb-3" />
              <p className="text-sm font-bold text-gray-500 dark:text-slate-400">
                {isAr ? 'لا توجد تقييمات من زملاء الرحلات بعد' : 'No companion reviews yet.'}
              </p>
            </div>
          )}
        </div>
      )}

      {activeProfileSection === 'reputation' && (
      <>
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-gray-100 dark:border-slate-800/80 shadow-sm space-y-4 animate-in fade-in">
        <div className="flex items-center justify-between border-b border-gray-100 dark:border-slate-850 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 dark:bg-amber-500/20 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-amber-500 animate-pulse" />
            </div>
            <div className="text-right sm:text-left">
              <h4 className="text-xs sm:text-sm font-black text-gray-900 dark:text-white leading-tight">
                {isAr ? 'الأوسمة والإنجازات' : 'My Achievements & Badges'}
              </h4>
              <p className="text-[10px] text-gray-500 dark:text-slate-400">
                {isAr ? 'مستندة على نقاط الـ XP ومعدل الثقة' : 'Based on your XP & active Trust Score'}
              </p>
            </div>
          </div>
          <span className="text-[9px] font-black font-mono bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 px-2.5 py-1 rounded-full border border-indigo-100/50 dark:border-indigo-950">
            {unlockedCount} / {currentBadges.length} {isAr ? 'مفتوح' : 'Unlocked'}
          </span>
        </div>

        {/* Badges Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {currentBadges.map((badge) => (
            <button
              key={badge.id}
              onClick={() => setSelectedBadge(badge)}
              className={`p-3.5 rounded-2xl border text-center relative flex flex-col items-center justify-center transition-all cursor-pointer select-none ${
                badge.isUnlocked
                  ? `${badge.bgColorClass} ${badge.borderClass} hover:scale-[1.03] hover:shadow-sm`
                  : 'bg-gray-50/50 dark:bg-slate-800/25 border-gray-150 dark:border-slate-800/40 opacity-55 hover:opacity-75'
              }`}
            >
              {/* Unlock Indicator */}
              <div className="absolute top-2.5 right-2.5">
                {badge.isUnlocked ? (
                  <span className="w-3.5 h-3.5 bg-green-500 text-white rounded-full flex items-center justify-center text-[7px] font-black shadow-sm">✓</span>
                ) : (
                  <Lock className="w-3 h-3 text-gray-400" />
                )}
              </div>

              {/* Badge Icon Slot */}
              <div className={`w-11 h-11 rounded-full flex items-center justify-center mb-2 shadow-inner ${
                badge.isUnlocked ? 'bg-white/80 dark:bg-slate-900/60' : 'bg-gray-100 dark:bg-slate-800/50'
              }`}>
                {badge.icon}
              </div>

              {/* Badge Label */}
              <span className="text-xs font-black block text-gray-900 dark:text-white truncate max-w-full">
                {isAr ? badge.nameAr : badge.nameEn}
              </span>

              {/* Requirements Small */}
              <span className="text-[8px] font-bold text-gray-500 dark:text-slate-400 bg-white/40 dark:bg-slate-900/40 px-1.5 py-0.5 rounded mt-1.5 leading-none">
                {isAr ? badge.reqTextAr : badge.reqTextEn}
              </span>
            </button>
          ))}
        </div>

        {/* Simple inline progress bar */}
        <div className="pt-2">
          <div className="flex justify-between text-[9px] font-bold text-gray-450 dark:text-slate-400 mb-1.5">
            <span>{isAr ? 'تقدم الإنجاز العام' : 'Overall Achievement Progress'}</span>
            <span>{Math.round((unlockedCount / currentBadges.length) * 100)}%</span>
          </div>
          <div className="w-full bg-gray-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
            <div 
              className="bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 h-full transition-all duration-500"
              style={{ width: `${(unlockedCount / currentBadges.length) * 100}%` }}
            />
          </div>
        </div>
      </div>
          
      {/* Interactive Badge Detail Modal */}
      {selectedBadge && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-gray-100 dark:border-slate-800/50 max-w-sm w-full shadow-2xl space-y-4 animate-in zoom-in-95 duration-200 text-center relative" dir={isAr ? 'rtl' : 'ltr'}>
            
            {/* Close button */}
            <button 
              onClick={() => setSelectedBadge(null)}
              className="absolute top-4 right-4 w-7 h-7 bg-gray-150 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-550 dark:text-slate-300 rounded-full flex items-center justify-center text-xs transition cursor-pointer"
            >
              ✕
            </button>

            {/* Badge Icon Popover */}
            <div className={`w-16 h-16 mx-auto rounded-full flex items-center justify-center shadow-lg ${
              selectedBadge.bgColorClass
            }`}>
              {selectedBadge.icon}
            </div>

            <div className="space-y-1">
              <h4 className="text-base font-black text-gray-901 dark:text-white">
                {isAr ? selectedBadge.nameAr : selectedBadge.nameEn}
              </h4>
              <span className={`inline-block text-[10px] font-black px-2.5 py-0.5 rounded-full ${
                selectedBadge.isUnlocked 
                  ? 'bg-green-105 dark:bg-green-950/40 text-green-700 dark:text-green-400' 
                  : 'bg-gray-100 dark:bg-slate-800 text-gray-550'
              }`}>
                {selectedBadge.isUnlocked ? (isAr ? '✓ وسام مفتوح' : '✓ Unlocked') : (isAr ? '🔒 مقفل حالياً' : '🔒 Locked')}
              </span>
            </div>

            <p className="text-xs text-gray-600 dark:text-slate-350 leading-relaxed px-2">
              {isAr ? selectedBadge.descAr : selectedBadge.descEn}
            </p>

            <div className="bg-gray-50/70 dark:bg-slate-850 p-3.5 rounded-2xl border border-gray-150 dark:border-slate-800 text-xs text-right sm:text-left">
              <div className="text-gray-400 dark:text-slate-400 text-[9px] uppercase font-black tracking-widest mb-1">
                {isAr ? 'متطلبات الحصول عليه' : 'How to obtain'}
              </div>
              <div className="font-extrabold text-gray-800 dark:text-white text-xs">
                {isAr ? selectedBadge.reqTextAr : selectedBadge.reqTextEn}
              </div>
              <div className="text-[10px] text-gray-500 mt-1 dark:text-slate-400 leading-snug">
                {selectedBadge.isUnlocked 
                  ? (isAr ? 'أنت تتمتع بهذا الوسام وجاهز لتأكيد موثوقيتك للطلعات!' : 'You currently own this badge. Ready to showcase reliability!')
                  : (isAr ? 'احرص على رفع نقاط خبرتك ومعدل التزامك مع الرفقاء في الرحلات لتفعيله.' : 'Stay engaged, commit to plan details, and increase your XP to unlock.')}
              </div>
            </div>

            <button
              onClick={() => setSelectedBadge(null)}
              className="w-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:opacity-90 rounded-2xl py-3 text-xs font-black uppercase tracking-wider transition-opacity cursor-pointer"
            >
              {isAr ? 'فهمت' : 'Understood'}
            </button>
          </div>
        </div>
      )}
      </>
      )}

      <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest pt-4 px-2">
        {isAr ? 'الأدوات والمزيد' : 'Tools & More'}
      </h3>

      {/* Menu Options */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Migrated Core Options from bottom navbar */}
        <button
          onClick={() => onChangeTab?.('explore')}
          className="bg-emerald-50/90 hover:bg-emerald-100/80 border border-emerald-100/60 rounded-3xl p-5 flex items-center gap-4 transition-all text-left cursor-pointer shadow-sm hover:border-emerald-300 hover:scale-[1.01]"
          dir={isAr ? 'rtl' : 'ltr'}
        >
          <div className="w-11 h-11 bg-emerald-600 text-white rounded-2xl flex items-center justify-center shrink-0 shadow-md">
             <Compass className="w-6 h-6 animate-spin-slow" />
          </div>
          <div>
            <h4 className="text-sm font-black text-emerald-900 mb-0.5">{isAr ? 'استكشف الخريطة والفعاليات' : 'Explore Map & Outings'}</h4>
            <div className="text-[10px] text-emerald-700 font-bold">{isAr ? 'ابحث عن رفقاء وطلعات نشطة بالقرب منك' : 'Find companions and active outings near you'}</div>
          </div>
        </button>

        <button
          onClick={() => onInitiateCreateOuting(null)}
          className="bg-indigo-50/90 hover:bg-indigo-100/80 border border-indigo-100/60 rounded-3xl p-5 flex items-center gap-4 transition-all text-left cursor-pointer shadow-sm hover:border-indigo-300 hover:scale-[1.01]"
          dir={isAr ? 'rtl' : 'ltr'}
        >
          <div className="w-11 h-11 bg-indigo-600 text-white rounded-2xl flex items-center justify-center shrink-0 shadow-md">
             <PlusCircle className="w-6 h-6" />
          </div>
          <div>
            <h4 className="text-sm font-black text-indigo-900 mb-0.5">{isAr ? 'إنشاء طلعة جديدة 🚀' : 'Create New Outing 🚀'}</h4>
            <div className="text-[10px] text-indigo-700 font-bold">{isAr ? 'بادر بتخطيط تجمع أو نشاط ودعوة الرفقاء' : 'Start a new gathering and invite buddies'}</div>
          </div>
        </button>

        <button
          onClick={() => setActiveTab('bored')}
          className="bg-white hover:bg-gray-50 border border-gray-200 rounded-3xl p-4 flex items-center gap-4 transition-all text-left cursor-pointer shadow-sm hover:border-green-300 hover:shadow-md"
          dir={isAr ? 'rtl' : 'ltr'}
        >
          <div className="w-10 h-10 bg-amber-100 text-amber-600 rounded-xl flex items-center justify-center shrink-0">
             <Zap className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-gray-900 mb-0.5">{isAr ? 'أنا طفشان (مساعد الذكاء الاصطناعي)' : "I'm Bored (AI Assistant)"}</h4>
            <div className="text-[10px] text-gray-600">{isAr ? 'دع الذكاء الاصطناعي يقترح الأفضل لك' : 'Let AI suggest the best for you'}</div>
          </div>
        </button>

        <button
          onClick={() => setActiveTab('ai')}
          className="bg-white hover:bg-gray-50 border border-gray-200 rounded-3xl p-4 flex items-center gap-4 transition-all text-left cursor-pointer shadow-sm hover:border-green-300 hover:shadow-md"
          dir={isAr ? 'rtl' : 'ltr'}
        >
          <div className="w-10 h-10 bg-amber-100 text-amber-600 rounded-xl flex items-center justify-center shrink-0">
             <Zap className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-gray-900 mb-0.5">{t.matchmakerTabHeading}</h4>
            <div className="text-[10px] text-gray-600">{isAr ? 'مساعد ذكي للرفقاء' : 'Smart companion matching'}</div>
          </div>
        </button>

        <button
          onClick={() => setActiveTab('communities')}
          className="bg-white hover:bg-gray-50 border border-gray-200 rounded-3xl p-4 flex items-center gap-4 transition-all text-left cursor-pointer shadow-sm hover:border-green-300 hover:shadow-md"
          dir={isAr ? 'rtl' : 'ltr'}
        >
          <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center shrink-0">
             <Users className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-gray-900 mb-0.5">{isAr ? 'مجتمعات الاهتمامات' : 'Interest Communities'}</h4>
            <div className="text-[10px] text-gray-600">{isAr ? 'انضم لقروبات تشبهك' : 'Join similar groups'}</div>
          </div>
        </button>

        <button
          onClick={() => setActiveTab('leaderboard')}
          className="bg-white hover:bg-gray-50 border border-gray-200 rounded-3xl p-4 flex items-center gap-4 transition-all text-left cursor-pointer shadow-sm hover:border-green-300 hover:shadow-md"
          dir={isAr ? 'rtl' : 'ltr'}
        >
          <div className="w-10 h-10 bg-yellow-100 text-yellow-600 rounded-xl flex items-center justify-center shrink-0">
             <Trophy className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-gray-900 mb-0.5">{isAr ? 'لوحة الصدارة' : 'Leaderboard'}</h4>
            <div className="text-[10px] text-gray-600">{isAr ? 'أكثر المستخدمين نشاطا' : 'Most active users'}</div>
          </div>
        </button>

        <button
          onClick={() => setActiveTab('my_posts')}
          className="bg-white hover:bg-gray-50 border border-gray-200 rounded-3xl p-4 flex items-center gap-4 transition-all text-left cursor-pointer shadow-sm hover:border-rose-300 hover:shadow-md"
          dir={isAr ? 'rtl' : 'ltr'}
        >
          <div className="w-10 h-10 bg-rose-100 text-rose-600 rounded-xl flex items-center justify-center shrink-0">
             <Camera className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-gray-900 mb-0.5">{isAr ? 'منشوراتي' : 'My Posts'}</h4>
            <div className="text-[10px] text-gray-600">{isAr ? 'إدارة المقاطع التي نشرتها' : 'Manage your published reels'}</div>
          </div>
        </button>

        <button
          onClick={() => setActiveTab('standing')}
          className="bg-white hover:bg-gray-50 border border-gray-200 rounded-3xl p-4 flex items-center gap-4 transition-all text-left cursor-pointer shadow-sm hover:border-green-300 hover:shadow-md"
          dir={isAr ? 'rtl' : 'ltr'}
        >
          <div className="w-10 h-10 bg-green-100 text-green-700 rounded-xl flex items-center justify-center shrink-0">
             <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-gray-900 mb-0.5">{t.circlesTabHeading}</h4>
            <div className="text-[10px] text-gray-600">{isAr ? 'إدارة دائرة أصدقائك' : 'Manage friends circle'}</div>
          </div>
        </button>

        <button
          onClick={() => setActiveTab('stats')}
          className="bg-white hover:bg-gray-50 border border-gray-200 rounded-3xl p-4 flex items-center gap-4 transition-all text-left cursor-pointer shadow-sm hover:border-green-300 hover:shadow-md"
          dir={isAr ? 'rtl' : 'ltr'}
        >
          <div className="w-10 h-10 bg-purple-100 text-purple-600 rounded-xl flex items-center justify-center shrink-0">
             <BarChart2 className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-gray-900 mb-0.5">{t.statsTabHeading}</h4>
            <div className="text-[10px] text-gray-600">{isAr ? 'معلومات نشاطك' : 'Your activity stats'}</div>
          </div>
        </button>

        <button
          onClick={() => setActiveTab('expense')}
          className="bg-white hover:bg-gray-50 border border-gray-200 rounded-3xl p-4 flex items-center gap-4 transition-all text-left cursor-pointer shadow-sm hover:border-green-300 hover:shadow-md"
          dir={isAr ? 'rtl' : 'ltr'}
        >
          <div className="w-10 h-10 bg-pink-100 text-pink-600 rounded-xl flex items-center justify-center shrink-0">
             <Fuel className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-gray-900 mb-0.5">{isAr ? 'حاسبة تقاسم البنزين' : 'Fuel Split Calculator'}</h4>
            <div className="text-[10px] text-gray-600">{isAr ? 'حساب تكاليف الرحلة' : 'Calculate trip costs'}</div>
          </div>
        </button>

        <button
          onClick={() => setActiveTab('gmail')}
          className="bg-white hover:bg-gray-50 border border-gray-200 rounded-3xl p-4 flex items-center gap-4 transition-all text-left cursor-pointer shadow-sm hover:border-indigo-300 hover:shadow-md"
          dir={isAr ? 'rtl' : 'ltr'}
        >
          <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center shrink-0">
             <Mail className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-gray-900 dark:text-white mb-0.5">{isAr ? 'مساعد بريد Gmail 📬' : 'Gmail Companion 📬'}</h4>
            <div className="text-[10px] text-gray-650 dark:text-slate-400">{isAr ? 'تصفح بريدك وأرسل دعوات للرفقاء' : 'Search emails & invite companions'}</div>
          </div>
        </button>
      </div>

      {onLogout && (
        <button
          onClick={onLogout}
          className="w-full bg-rose-50/40 dark:bg-rose-500/10 hover:bg-rose-50 dark:hover:bg-rose-500/20 border border-rose-150 dark:border-rose-500/30 rounded-3xl p-4 flex items-center gap-4 transition-all text-left cursor-pointer shadow-sm hover:border-rose-300"
          dir={isAr ? 'rtl' : 'ltr'}
        >
          <div className="w-10 h-10 bg-rose-100 text-rose-600 rounded-xl flex items-center justify-center shrink-0">
             <LogOut className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-rose-900 mb-0.5">{isAr ? 'تسجيل الخروج' : 'Log Out'}</h4>
            <div className="text-[10px] text-rose-600">{isAr ? 'تبديل الحساب أو الخروج' : 'Switch account or sign out'}</div>
          </div>
        </button>
      )}

      {isQuizOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-300">
          <div className="w-full max-w-md my-8">
            <PersonalityQuiz
              lang={lang}
              currentArchetype={currentUser.archetype}
              onComplete={handleQuizComplete || (() => {})}
              onClose={() => setIsQuizOpen(false)}
            />
          </div>
        </div>
      )}
      <AnimatePresence>
        {followersListState.show && onProfileClick && (
          <FollowersListModal
            title={followersListState.type === 'followers' ? (isAr ? 'المتابعون' : 'Followers') : (isAr ? 'يتابع' : 'Following')}
            userIds={followersListState.userIds}
            allProfiles={allProfiles}
            lang={lang}
            onClose={() => setFollowersListState({ ...followersListState, show: false })}
            onProfileClick={onProfileClick}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

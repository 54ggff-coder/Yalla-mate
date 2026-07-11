import React, { useMemo, useState } from 'react';
import { Profile, Outing, Reel } from '../types';
import { translations, Language } from '../data/translations';
import { ShieldCheck, ArrowLeft, Users, Navigation, Compass, Verified, Camera, Activity, Calendar, Award, X, Star, Heart, MessageCircle, UserPlus, TrendingUp, Settings } from 'lucide-react';
import OutingCard from './OutingCard';
import { motion, AnimatePresence } from 'motion/react';
import UserAvatar from './UserAvatar';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import SettingsModal from './SettingsModal';

interface UserProfileModalProps {
  profile: Profile;
  currentUser: Profile;
  allOutings: Outing[];
  allReels: Reel[];
  onClose: () => void;
  onFollowToggle: (userId: string) => void;
  onFriendToggle?: (userId: string) => void;
  isFollowing: boolean;
  isFriend?: boolean;
  lang: Language;
  onMessage?: (profile: Profile) => void;
  onLogout?: () => void;
  onThemeToggle?: () => void;
  onEditProfile?: () => void;
  onToggleLang?: () => void;
  theme?: string;
  allProfiles?: Profile[];
  onProfileClick?: (userId: string) => void;
}

import FollowersListModal from './FollowersListModal';

const getArchetypeColor = (archetype: string) => {
  const lower = archetype.toLowerCase();
  if (lower.includes('social') || lower.includes('فراشة')) return 'bg-pink-500/20 text-pink-300 border-pink-500/30 shadow-pink-500/20';
  if (lower.includes('organizer') || lower.includes('منظم')) return 'bg-blue-500/20 text-blue-300 border-blue-500/30 shadow-blue-500/20';
  if (lower.includes('chill') || lower.includes('هادئ') || lower.includes('coffee')) return 'bg-teal-500/20 text-teal-300 border-teal-500/30 shadow-teal-500/20';
  if (lower.includes('explorer') || lower.includes('مستكشف')) return 'bg-orange-500/20 text-orange-300 border-orange-500/30 shadow-orange-500/20';
  if (lower.includes('foodie') || lower.includes('أكول')) return 'bg-red-500/20 text-red-300 border-red-500/30 shadow-red-500/20';
  return 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30 shadow-indigo-500/20';
};

export default function UserProfileModal({
  profile,
  currentUser,
  allOutings,
  allReels,
  onClose,
  onFollowToggle,
  onFriendToggle,
  isFollowing,
  isFriend,
  lang,
  onMessage,
  onLogout,
  onThemeToggle,
  onEditProfile,
  onToggleLang,
  theme,
  allProfiles,
  onProfileClick
}: UserProfileModalProps) {
  const t = translations[lang];
  const isAr = lang === 'ar';

  const userOutings = (allOutings || []).filter(o => o.creatorId === profile.id || o.attendeeIds?.includes(profile.id));
  const userReels = (allReels || []).filter(r => r.owner_id === profile.id || r.creator_id === profile.id);

  const completedOutings = useMemo(() => {
    const now = new Date();
    return (userOutings || []).filter(o => o.status === 'completed' || (o.status !== 'cancelled' && new Date(o.datetime) < now));
  }, [userOutings]);

  const activeOutings = useMemo(() => {
    const now = new Date();
    return (userOutings || []).filter(o => o.status !== 'completed' && o.status !== 'cancelled' && new Date(o.datetime) >= now);
  }, [userOutings]);

  const completedStats = useMemo(() => {
    const total = completedOutings.length;
    
    // Companions
    const uniqueCompanions = new Set<string>();
    completedOutings.forEach(o => {
      o.attendeeIds?.forEach(id => {
        if (id !== profile.id) {
          uniqueCompanions.add(id);
        }
      });
      if (o.creatorId !== profile.id) {
        uniqueCompanions.add(o.creatorId);
      }
    });
    
    // Organized count
    const organized = completedOutings.filter(o => o.creatorId === profile.id).length;
    const attendee = total - organized;
    const primaryRole = total === 0 ? '-' : (organized >= attendee ? (isAr ? 'منظّم' : 'Organizer') : (isAr ? 'مستكشف' : 'Explorer'));
    
    // Top category
    const categoryCounts: { [key: string]: number } = {};
    completedOutings.forEach(o => {
      if (o.category) {
        categoryCounts[o.category] = (categoryCounts[o.category] || 0) + 1;
      }
    });
    let topCategory = '';
    let maxCount = 0;
    Object.entries(categoryCounts).forEach(([cat, count]) => {
      if (count > maxCount) {
        maxCount = count;
        topCategory = cat;
      }
    });
    
    let topCategoryLabel = topCategory || (isAr ? 'متنوع' : 'Diverse');
    if (topCategory) {
      topCategoryLabel = topCategory.charAt(0).toUpperCase() + topCategory.slice(1);
    }

    return {
      total,
      companionsCount: uniqueCompanions.size,
      primaryRole,
      topCategoryLabel
    };
  }, [completedOutings, profile.id, isAr]);

  const trustHistoryData = useMemo(() => {
    const currentScore = profile.trustScore !== undefined ? profile.trustScore : 5;
    const data = [];
    const days = 90; // Last 3 months
    
    // Deterministic random seed based on user's ID
    let seed = profile.id ? profile.id.charCodeAt(0) + profile.id.charCodeAt(profile.id.length - 1) : 42;
    const random = () => {
      const x = Math.sin(seed++) * 10000;
      return x - Math.floor(x);
    };

    let runningScore = currentScore;
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateString = d.toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-US', { month: 'short', day: 'numeric' });
      
      data.push({
        day: dateString,
        score: Math.round(Math.min(5, Math.max(0, runningScore)) * 100) / 100
      });

      // Fluctuate previous score backwards (making it walk forward normally)
      const fluctuation = (random() - 0.47) * 0.08; 
      runningScore = runningScore - fluctuation;
    }

    // Anchor current value to the last spot
    if (data.length > 0) {
      data[data.length - 1].score = currentScore;
    }
    
    return data;
  }, [profile.trustScore, profile.id, lang]);

  const badges = useMemo(() => {
    const list = [];
    const score = profile.trustScore !== undefined ? profile.trustScore : 5;
    
    // Badge 1: Reliable Mate
    if (score >= 4.8) {
      list.push({
        id: 'reliable',
        labelAr: 'رفيق موثوق 🎖️',
        labelEn: 'Reliable Mate 🎖️',
        descAr: 'حساب ذو معدل ثقة ممتاز وتاريخ متميز من الحضور والالتزام',
        descEn: 'Exceptional trust rating with outstanding attendance and reliability.',
        color: 'from-amber-500/20 to-orange-500/20 text-amber-300 border-amber-500/30'
      });
    } else if (score >= 4.0) {
      list.push({
        id: 'good_standing',
        labelAr: 'رفيق ملتزم ⭐',
        labelEn: 'Committed Mate ⭐',
        descAr: 'حساب ذو معدل التزام جيد جداً في الطلعات والتفاعل مع الرفقاء',
        descEn: 'Very good commitment record in outings and mate interactions.',
        color: 'from-emerald-500/10 to-teal-500/10 text-emerald-300 border-emerald-500/20'
      });
    }

    // Badge 2: Top Coordinator
    const organizedCount = completedOutings?.length || 0;
    if (organizedCount >= 2 && score >= 4.5) {
      list.push({
        id: 'top_coordinator',
        labelAr: 'منسق متميز 👑',
        labelEn: 'Top Coordinator 👑',
        descAr: 'منظم نشط ذو تقييمات عالية وخبرة واسعة في تنظيم وريادة الفعاليات الناجحة',
        descEn: 'Highly rated active organizer with proven leadership in crafting successful outings.',
        color: 'from-indigo-500/20 to-purple-500/20 text-indigo-300 border-indigo-500/30'
      });
    } else if (profile.archetype === 'Coordinator' || profile.archetype === 'Leader') {
      list.push({
        id: 'top_coordinator',
        labelAr: 'قائد طلعات 🧭',
        labelEn: 'Outing Leader 🧭',
        descAr: 'مبادر دائم ومتميز في إدارة الرحلات والأنشطة الترفيهية الجماعية',
        descEn: 'Natural organizer with great initiative in coordinating group activities.',
        color: 'from-sky-500/20 to-blue-500/20 text-sky-300 border-sky-500/30'
      });
    }

    return list;
  }, [profile.trustScore, profile.archetype, completedOutings]);

  const [activeTab, setActiveTab] = useState<'bio'|'history'|'reputation'>('bio');
  const [historySubTab, setHistorySubTab] = useState<'active'|'completed'>('active');
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [followersListState, setFollowersListState] = useState<{ show: boolean, type: 'followers' | 'following', userIds: string[] }>({ show: false, type: 'followers', userIds: [] });

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-[#07090E]/90 backdrop-blur-xl sm:p-4"
    >
      <AnimatePresence>
        {showSettingsModal && (
          <SettingsModal 
            lang={lang} 
            theme={theme}
            onClose={() => setShowSettingsModal(false)}
            onThemeToggle={() => {
              if (onThemeToggle) onThemeToggle();
            }}
            onToggleLang={onToggleLang}
            onLogout={() => {
              if (onLogout) onLogout();
              setShowSettingsModal(false);
            }}
            onEditProfile={() => {
              if (onEditProfile) onEditProfile();
              setShowSettingsModal(false);
            }}
          />
        )}
      </AnimatePresence>
      <motion.div 
        initial={{ opacity: 0, y: 40, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 40, scale: 0.96 }}
        transition={{ type: "spring", stiffness: 350, damping: 30 }}
        className="bg-[#0f141e] w-full max-w-2xl sm:rounded-[40px] rounded-t-[40px] h-[95vh] sm:h-[85vh] flex flex-col shadow-[0_0_80px_rgba(0,0,0,0.8)] border border-white/10 overflow-hidden ring-1 ring-white/5 relative"
      >
        
        {/* Absolute Floating Header Controls */}
        <div className="absolute top-0 inset-x-0 p-5 flex items-center justify-between z-50">
          <button 
            onClick={onClose}
            className="w-11 h-11 bg-black/40 hover:bg-black/80 backdrop-blur-md border border-white/10 rounded-full flex items-center justify-center transition-all text-white cursor-pointer shadow-lg active:scale-95"
            title={isAr ? "رجوع" : "Back"}
          >
            <ArrowLeft className={`w-5 h-5 ${isAr ? 'rotate-180' : ''}`} />
          </button>
          
          <div className="flex items-center gap-2">
            {currentUser.id === profile.id && (
              <button 
                onClick={() => setShowSettingsModal(true)}
                className="w-11 h-11 bg-black/40 hover:bg-black/80 backdrop-blur-md border border-white/10 rounded-full flex items-center justify-center transition-all text-white cursor-pointer shadow-lg active:scale-95"
                title={isAr ? "الإعدادات" : "Settings"}
              >
                <Settings className="w-5 h-5" />
              </button>
            )}
            <button 
              onClick={onClose}
              className="w-11 h-11 bg-black/40 hover:bg-black/80 backdrop-blur-md border border-white/10 rounded-full flex items-center justify-center transition-all text-white cursor-pointer shadow-lg active:scale-95"
              title={isAr ? "إغلاق" : "Close"}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="overflow-y-auto flex-1 scrollbar-none scroll-smooth" dir={isAr ? 'rtl' : 'ltr'}>
           {/* Profile Header Hero Section */}
           <div className="relative pb-8">
             <div className="h-64 absolute top-0 inset-x-0 overflow-hidden">
               {/* Cover Photo or Advanced abstract mesh gradient background */}
               {profile.coverPhoto ? (
                 <img src={profile.coverPhoto} alt="Cover" className="w-full h-full object-cover opacity-80" />
               ) : (
                 <>
                   <div className="absolute inset-0 bg-gradient-to-br from-indigo-600/30 via-purple-900/40 to-slate-900 z-0"></div>
                   <div className="absolute top-[-50%] left-[-10%] w-[120%] h-[150%] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-500/20 via-transparent to-transparent blur-3xl mix-blend-screen opacity-60"></div>
                 </>
               )}
               {profile.id === currentUser.id && (
                 <div 
                   onClick={() => onEditProfile && onEditProfile()}
                   className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity cursor-pointer flex items-center justify-center z-10"
                 >
                   <div className="bg-black/60 p-3 rounded-full flex items-center gap-2 backdrop-blur-sm border border-white/10">
                     <Camera className="w-5 h-5 text-white" />
                     <span className="text-white text-xs font-bold">{isAr ? 'تغيير صورة الغلاف' : 'Change Cover'}</span>
                   </div>
                 </div>
               )}
               <div className="absolute bottom-0 inset-x-0 h-32 bg-gradient-to-t from-[#0f141e] to-transparent z-10 pointer-events-none"></div>
             </div>
             
             <div className="pt-40 px-6 sm:px-10 relative z-20 flex flex-col items-center">
                <motion.div 
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.1, type: "spring", stiffness: 200, damping: 20 }}
                  className="relative group cursor-pointer"
                  onClick={() => {
                    if (profile.id === currentUser.id && onEditProfile) {
                      onEditProfile();
                    }
                  }}
                >
                  <UserAvatar 
                    avatar={profile.avatar}
                    className="w-32 h-32 bg-[#07090E] border-[6px] border-[#0f141e] rounded-full text-6xl shadow-2xl z-20 transition-transform group-hover:scale-105"
                  />
                  {profile.id === currentUser.id && (
                    <div className="absolute inset-0 bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center z-30">
                      <Camera className="w-6 h-6 text-white" />
                    </div>
                  )}
                  {profile.verified && (
                    <motion.div 
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: 0.3 }}
                      className="absolute bottom-1 right-1 bg-indigo-500 rounded-full p-1.5 border-[3px] border-[#0f141e] shadow-lg z-40"
                    >
                      <ShieldCheck className="w-5 h-5 text-white" />
                    </motion.div>
                  )}
                </motion.div>

                <motion.div 
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.2 }}
                  className="text-center mt-5"
                >
                  <h2 className="text-3xl font-black text-white tracking-tight">{profile.name}</h2>
                  {profile.moodText && (
                    <div className="mt-3 inline-flex items-center gap-2 bg-[#1b2234]/80 backdrop-blur border border-indigo-500/10 px-4 py-2 rounded-2xl max-w-xs mx-auto shadow-lg animate-in fade-in duration-300">
                      <span className="text-lg select-none">{profile.moodEmoji || '😊'}</span>
                      <span className="text-xs text-slate-200 font-bold tracking-wide">{profile.moodText}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-center gap-2 mt-3">
                    <span className={`text-[11px] font-black border px-4 py-1.5 rounded-full uppercase tracking-widest shadow-inner ${getArchetypeColor(profile.archetype)}`}>
                      {profile.archetype}
                    </span>
                    <span className="text-[11px] text-emerald-300 font-black bg-emerald-500/10 border border-emerald-500/20 px-4 py-1.5 rounded-full uppercase tracking-widest shadow-inner flex items-center gap-1">
                      <Star className="w-3 h-3" /> {(profile.trustScore !== undefined ? profile.trustScore : 5).toFixed(1)}
                    </span>
                  </div>

                  {/* Trust Badges Display */}
                  {badges.length > 0 && (
                    <div className="flex flex-wrap justify-center gap-1.5 mt-4 max-w-sm mx-auto">
                      {badges.map(badge => (
                        <div 
                          key={badge.id}
                          className={`text-[9px] font-extrabold px-3 py-1 rounded-xl bg-gradient-to-tr border flex items-center gap-1 select-none transition-all hover:scale-105 duration-200 cursor-help ${badge.color}`}
                          title={isAr ? badge.descAr : badge.descEn}
                        >
                          <span>{isAr ? badge.labelAr : badge.labelEn}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </motion.div>

                <motion.div 
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.3 }}
                  className="mt-6 flex items-center justify-center gap-8 w-full max-w-sm mx-auto bg-white/5 backdrop-blur-md rounded-3xl p-5 border border-white/10 shadow-2xl"
                >
                  <div className="text-center flex-1">
                    <span className="text-2xl font-black text-white block">{userOutings?.length || 0}</span>
                    <span className="text-[9px] text-slate-400 font-black uppercase tracking-[0.2em]">{isAr ? 'الطلعات' : 'Outings'}</span>
                  </div>
                  <div className="w-px h-10 bg-white/10 rounded-full"></div>
                  <div className="text-center flex-1 cursor-pointer hover:opacity-80 transition-opacity" onClick={() => setFollowersListState({ show: true, type: 'followers', userIds: profile.followers || [] })}>
                    <span className="text-2xl font-black text-white block">{profile.followers?.length || 0}</span>
                    <span className="text-[9px] text-slate-400 font-black uppercase tracking-[0.2em]">{isAr ? 'متابعون' : 'Followers'}</span>
                  </div>
                  <div className="w-px h-10 bg-white/10 rounded-full"></div>
                  <div className="text-center flex-1 cursor-pointer hover:opacity-80 transition-opacity" onClick={() => setFollowersListState({ show: true, type: 'following', userIds: profile.following || [] })}>
                    <span className="text-2xl font-black text-white block">{profile.following?.length || 0}</span>
                    <span className="text-[9px] text-slate-400 font-black uppercase tracking-[0.2em]">{isAr ? 'يتابع' : 'Following'}</span>
                  </div>
                </motion.div>

                <motion.div 
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.4 }}
                  className="mt-8 flex flex-col sm:flex-row gap-3 w-full max-w-sm mx-auto"
                >
                  {profile.id !== currentUser.id ? (
                    <>
                      <button 
                        onClick={() => onFollowToggle(profile.id)}
                        className={`group flex-1 py-3.5 rounded-2xl text-[11px] font-black uppercase tracking-[0.15em] transition-all cursor-pointer flex items-center justify-center gap-2 ${isFollowing ? 'bg-white/10 text-white hover:bg-white/20 border border-white/20' : 'bg-white text-black hover:bg-indigo-50 hover:text-indigo-900 shadow-[0_0_20px_rgba(255,255,255,0.3)]'}`}
                      >
                        {!isFollowing && <UserPlus className="w-4 h-4" />}
                        {isFollowing ? (isAr ? 'إلغاء المتابعة' : 'Unfollow') : (isAr ? 'متابعة' : 'Follow')}
                      </button>
                      <button 
                        onClick={() => onFriendToggle?.(profile.id)}
                        className={`flex-1 py-3.5 rounded-2xl text-[11px] font-black uppercase tracking-[0.15em] transition-all cursor-pointer flex items-center justify-center gap-2 ${isFriend ? 'bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border border-rose-500/20' : 'bg-indigo-500 text-white hover:bg-indigo-400 shadow-[0_0_20px_rgba(99,102,241,0.4)]'}`}
                      >
                        {!isFriend && <Heart className="w-4 h-4" />}
                        {isFriend ? (isAr ? 'إزالة الصديق' : 'Unfriend') : (isAr ? 'إضافة' : 'Add Friend')}
                      </button>
                      <button 
                        onClick={() => onMessage?.(profile)}
                        className="py-3.5 px-5 rounded-2xl text-[11px] font-black uppercase tracking-[0.15em] transition-all cursor-pointer bg-white/5 text-slate-300 hover:text-white border border-white/10 hover:bg-white/10 flex items-center justify-center shadow-lg"
                        title={isAr ? 'رسالة' : 'Message'}
                      >
                        <MessageCircle className="w-5 h-5" />
                      </button>
                    </>
                  ) : (
                    <button 
                      onClick={() => {
                        if (onEditProfile) onEditProfile();
                      }}
                      className="w-full py-3.5 rounded-2xl text-[11px] font-black uppercase tracking-[0.15em] transition-all cursor-pointer bg-indigo-500 text-white hover:bg-indigo-400 shadow-[0_0_20px_rgba(99,102,241,0.4)] flex items-center justify-center gap-2"
                    >
                      <Settings className="w-4 h-4" />
                      {isAr ? 'تعديل الملف الشخصي' : 'Edit Profile'}
                    </button>
                  )}
                </motion.div>
              </div>
           </div>

           {/* Content Grid */}
           <motion.div 
             initial={{ y: 20, opacity: 0 }}
             animate={{ y: 0, opacity: 1 }}
             transition={{ delay: 0.5 }}
             className="px-6 sm:px-10 pb-12 space-y-8"
           >
             {/* Tab Navigation */}
             <div className="flex bg-[#0B0E14] rounded-2xl p-1 gap-1 border border-white/5 mx-auto max-w-sm">
                <button
                  onClick={() => setActiveTab('bio')}
                  className={`flex-1 py-2.5 text-[10px] font-black uppercase tracking-[0.1em] rounded-xl transition-all ${activeTab === 'bio' ? 'bg-white/10 text-white shadow-md' : 'text-slate-500 hover:text-slate-300'}`}
                >
                  {isAr ? 'نبذة' : 'Bio'}
                </button>
                <button
                  onClick={() => setActiveTab('history')}
                  className={`flex-1 py-2.5 text-[10px] font-black uppercase tracking-[0.1em] rounded-xl transition-all ${activeTab === 'history' ? 'bg-white/10 text-white shadow-md' : 'text-slate-500 hover:text-slate-300'}`}
                >
                  {isAr ? 'الطلعات' : 'History'}
                </button>
                <button
                  onClick={() => setActiveTab('reputation')}
                  className={`flex-1 py-2.5 text-[10px] font-black uppercase tracking-[0.1em] rounded-xl transition-all ${activeTab === 'reputation' ? 'bg-white/10 text-white shadow-md' : 'text-slate-500 hover:text-slate-300'}`}
                >
                  {isAr ? 'السمعة' : 'Reputation'}
                </button>
             </div>

             <div className="pt-2">
               {activeTab === 'bio' && (
                 <motion.div
                   initial={{ opacity: 0, y: 10 }}
                   animate={{ opacity: 1, y: 0 }}
                   className="space-y-8"
                 >
                   {profile.bio && (
                     <div className="bg-white/5 border border-white/5 p-6 rounded-3xl backdrop-blur-sm">
                       <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.25em] mb-3 flex items-center gap-2">
                         <Navigation className="w-3.5 h-3.5" /> {isAr ? 'عن المستخدم' : 'About'}
                       </h3>
                       <p className="text-sm text-slate-300 leading-relaxed font-medium">
                         {profile.bio}
                       </p>
                     </div>
                   )}
      
                   <div className="space-y-4">
                     <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] px-2 flex items-center gap-2">
                       <Activity className="w-4 h-4 text-indigo-400" /> {isAr ? 'الاهتمامات' : 'Interests'}
                     </h3>
                     <div className="flex flex-wrap gap-2">
                       {profile.interests.map((i, idx) => (
                         <span key={`${i}-${idx}`} className="px-5 py-2.5 bg-gradient-to-b from-white/10 to-white/5 border border-white/10 rounded-xl text-xs font-bold text-slate-200 shadow-md">
                           {i}
                         </span>
                       ))}
                       {(!profile.interests || profile.interests.length === 0) && (
                         <div className="text-xs text-slate-500 italic py-2 px-2">{isAr ? 'لا توجد اهتمامات' : 'No interests listed'}</div>
                       )}
                     </div>
                   </div>
                 </motion.div>
               )}

                               {activeTab === 'history' && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-6"
                  >
                    {/* Sub Tab Navigation */}
                    <div className="flex bg-[#0B0E14] rounded-2xl p-1 gap-1 border border-white/5 max-w-sm">
                      <button
                        onClick={() => setHistorySubTab('active')}
                        className={`flex-1 py-2 text-[10px] font-black uppercase tracking-[0.1em] rounded-xl transition-all cursor-pointer ${historySubTab === 'active' ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30' : 'text-slate-500 hover:text-slate-300'}`}
                      >
                        {isAr ? 'الطلعات النشطة' : 'Active Outings'}
                      </button>
                      <button
                        onClick={() => setHistorySubTab('completed')}
                        className={`flex-1 py-2 text-[10px] font-black uppercase tracking-[0.1em] rounded-xl transition-all cursor-pointer ${historySubTab === 'completed' ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30' : 'text-slate-500 hover:text-slate-300'}`}
                      >
                        {isAr ? 'سجل الأنشطة' : 'Activity History'}
                      </button>
                    </div>

                    {historySubTab === 'active' ? (
                      <div className="space-y-4">
                        <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] px-2 flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-emerald-400" /> {isAr ? 'الطلعات النشطة والقادمة' : 'Upcoming & Active Outings'}
                        </h3>
                        <div className="space-y-4">
                          {activeOutings.length > 0 ? (
                            activeOutings.map(out => (
                              <div key={out.id} className="ring-1 ring-white/10 bg-[#0B0E14]/80 backdrop-blur-md rounded-3xl overflow-hidden shadow-2xl transition hover:ring-indigo-500/50">
                                <OutingCard outing={out} currentUserTrustScore={currentUser.trustScore} onSelect={() => {}} onCategoryClick={() => {}} lang={lang} />
                              </div>
                            ))
                          ) : (
                            <div className="text-center p-10 bg-gradient-to-b from-white/5 to-transparent rounded-3xl border border-white/5">
                              <Calendar className="w-10 h-10 text-slate-600 mx-auto mb-4" />
                              <p className="text-xs text-slate-400 uppercase tracking-[0.2em] font-black">{isAr ? 'لا توجد طلعات نشطة حالياً' : 'No active outings'}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-6 animate-in fade-in duration-300">
                        {/* Summary Stats Cards */}
                        <div className="grid grid-cols-2 gap-3">
                          <div className="bg-white/5 border border-white/5 p-4 rounded-2xl backdrop-blur-sm flex flex-col justify-between">
                            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{isAr ? 'الطلعات المكتملة' : 'Completed Outings'}</span>
                            <div className="text-lg font-black text-emerald-400 mt-2 flex items-center gap-1.5">
                              <Calendar className="w-4 h-4 text-emerald-400" /> {completedStats.total}
                            </div>
                          </div>
                          
                          <div className="bg-white/5 border border-white/5 p-4 rounded-2xl backdrop-blur-sm flex flex-col justify-between">
                            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{isAr ? 'رفاق قابلتهم' : 'Companions Met'}</span>
                            <div className="text-lg font-black text-indigo-400 mt-2 flex items-center gap-1.5">
                              <Users className="w-4 h-4 text-indigo-400" /> {completedStats.companionsCount}
                            </div>
                          </div>

                          <div className="bg-white/5 border border-white/5 p-4 rounded-2xl backdrop-blur-sm flex flex-col justify-between">
                            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{isAr ? 'الدور الغالب' : 'Primary Role'}</span>
                            <div className="text-xs font-bold text-amber-400 mt-2 flex items-center gap-1.5">
                              <ShieldCheck className="w-4 h-4 text-amber-400" /> {completedStats.primaryRole}
                            </div>
                          </div>

                          <div className="bg-white/5 border border-white/5 p-4 rounded-2xl backdrop-blur-sm flex flex-col justify-between">
                            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{isAr ? 'النشاط المفضل' : 'Favorite Activity'}</span>
                            <div className="text-xs font-bold text-pink-400 mt-2 flex items-center gap-1.5">
                              <Activity className="w-4 h-4 text-pink-500" /> {completedStats.topCategoryLabel}
                            </div>
                          </div>
                        </div>

                        {/* Completed Outings List */}
                        <div className="space-y-4">
                          <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] px-2 flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-amber-400" /> {isAr ? 'سجل الطلعات السابقة' : 'Past Social Engagements'}
                          </h3>
                          {completedOutings.length > 0 ? (
                            completedOutings.map(out => (
                              <div key={out.id} className="ring-1 ring-white/10 bg-[#0B0E14]/80 backdrop-blur-md rounded-3xl overflow-hidden shadow-2xl transition hover:ring-indigo-500/50">
                                <OutingCard outing={out} currentUserTrustScore={currentUser.trustScore} onSelect={() => {}} onCategoryClick={() => {}} lang={lang} />
                              </div>
                            ))
                          ) : (
                            <div className="text-center p-10 bg-gradient-to-b from-white/5 to-transparent rounded-3xl border border-white/5">
                              <Calendar className="w-10 h-10 text-slate-600 mx-auto mb-4" />
                              <p className="text-xs text-slate-400 uppercase tracking-[0.2em] font-black">{isAr ? 'لا توجد طلعات مكتملة مسبقاً' : 'No completed outings yet'}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}

                {activeTab === 'reputation' && (
                 <motion.div
                   initial={{ opacity: 0, y: 10 }}
                   animate={{ opacity: 1, y: 0 }}
                   className="space-y-8"
                 >
                   <div className="grid grid-cols-2 gap-4">
                     <div className="bg-white/5 border border-white/5 p-5 rounded-3xl backdrop-blur-sm">
                       <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.25em] mb-2">{t.scoreHeading}</h3>
                       <div className="text-2xl font-black text-amber-400 flex items-center gap-2">
                         <Star className="w-6 h-6" /> {(profile.trustScore !== undefined ? profile.trustScore : 5).toFixed(1)}
                       </div>
                     </div>
                     <div className="bg-white/5 border border-white/5 p-5 rounded-3xl backdrop-blur-sm">
                       <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.25em] mb-2">{t.standingHeading}</h3>
                       <div className={`text-sm font-black mt-2 ${profile.warningCount > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                         {profile.warningCount > 0 ? `${profile.warningCount} ${t.alertsCountText}` : t.perfectCheck}
                       </div>
                     </div>
                   </div>

                   <div className="space-y-4">
                     <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] px-2 flex items-center gap-2">
                       <>
                        {/* Trust History Recharts Area Line Chart */}
                        <div className="bg-white/5 border border-white/5 p-5 rounded-3xl backdrop-blur-sm mb-6 space-y-4 w-full">
                          <div>
                            <h3 className="text-xs font-black text-slate-200 tracking-wide uppercase flex items-center gap-2">
                              <TrendingUp className="w-4 h-4 text-emerald-400" />
                              {isAr ? 'مؤشر تطور مستوى الموثوقية (آخر 3 أشهر)' : 'Trust Score Trend (Last 3 Months)'}
                            </h3>
                            <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">
                              {isAr 
                                ? 'مخطط تفاعلي يوضح تطور ونمو نقاط الموثوقية والأمان الخاصة بك في آخر 3 أشهر بناءً على التزامك وحضور الرحلات.' 
                                : 'Interactive timeline representing the growth or decline of your trust quotient across the last 3 months.'}
                            </p>
                          </div>

                          <div className="h-44 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                              <AreaChart data={trustHistoryData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                                <defs>
                                  <linearGradient id="colorTrust" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                                  </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.05)" vertical={false} />
                                <XAxis 
                                  dataKey="day" 
                                  stroke="#64748b" 
                                  fontSize={8}
                                  tickLine={false}
                                  axisLine={false}
                                  interval={14}
                                />
                                <YAxis 
                                  domain={[3, 5]} 
                                  stroke="#64748b" 
                                  fontSize={8}
                                  tickLine={false}
                                  axisLine={false}
                                  tickCount={5}
                                />
                                <Tooltip
                                  contentStyle={{ 
                                    backgroundColor: '#0f172a', 
                                    border: '1px solid rgba(255, 255, 255, 0.1)', 
                                    borderRadius: '12px',
                                    fontSize: '10px',
                                    color: '#fff'
                                  }}
                                  itemStyle={{ color: '#10b981', fontWeight: 'bold' }}
                                />
                                <Area 
                                  type="monotone" 
                                  dataKey="score" 
                                  stroke="#10b981" 
                                  strokeWidth={2}
                                  fillOpacity={1} 
                                  fill="url(#colorTrust)" 
                                />
                              </AreaChart>
                            </ResponsiveContainer>
                          </div>
                        </div>

                        <Camera className="w-4 h-4 text-rose-400" /> {isAr ? 'الريلز' : 'Reels'} <span className="opacity-50 ml-1">{(userReels?.length || 0)}</span>
                      </>
                     </h3>
                     {(userReels?.length || 0) > 0 ? (
                       <div className="grid grid-cols-3 gap-3">
                         {userReels.map(reel => (
                           <div key={reel.id} className="aspect-[9/16] bg-[#07090E] rounded-2xl relative overflow-hidden group cursor-pointer border border-white/10 shadow-xl">
                             <img src={reel.video_url || 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?q=80&w=400&auto=format&fit=crop'} className="absolute inset-0 w-full h-full object-cover opacity-70 group-hover:opacity-100 transition-all duration-500 group-hover:scale-105" />
                             <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent"></div>
                             <div className="absolute inset-x-0 bottom-0 p-3 text-white flex items-center justify-between z-10 translate-y-2 group-hover:translate-y-0 transition-transform">
                               <span className="text-[10px] font-black border border-white/20 bg-black/60 backdrop-blur-md px-2 py-1 rounded-full flex items-center gap-1.5"><Compass className="w-3 h-3 text-rose-400" /> {reel.liked_by_ids?.length || 0}</span>
                             </div>
                           </div>
                         ))}
                       </div>
                     ) : (
                       <div className="text-center p-10 bg-gradient-to-b from-white/5 to-transparent rounded-3xl border border-white/5">
                         <Camera className="w-10 h-10 text-slate-600 mx-auto mb-4" />
                         <p className="text-xs text-slate-400 uppercase tracking-[0.2em] font-black">{isAr ? 'لا يوجد ريلز' : 'No reels yet'}</p>
                       </div>
                     )}
                   </div>
                 </motion.div>
               )}
             </div>

           </motion.div>
        </div>
      </motion.div>
      {followersListState.show && allProfiles && onProfileClick && (
        <FollowersListModal
          title={followersListState.type === 'followers' ? (isAr ? 'المتابعون' : 'Followers') : (isAr ? 'يتابع' : 'Following')}
          userIds={followersListState.userIds}
          allProfiles={allProfiles}
          lang={lang}
          onClose={() => setFollowersListState({ ...followersListState, show: false })}
          onProfileClick={onProfileClick}
        />
      )}
    </motion.div>
  );
}

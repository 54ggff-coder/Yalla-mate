import React, { useState, useEffect } from 'react';
import { Home, Compass, PlusCircle, Video, User, CloudOff, RefreshCw, CheckCircle2, Users } from 'lucide-react';
import { motion } from 'motion/react';
import { Language } from '../data/translations';
import { offlineSyncService } from '../services/offlineSyncService';
import { Haptics } from '../utils/haptics';

interface BottomNavigationProps {
  currentTab: 'home' | 'explore' | 'create' | 'reels' | 'profile' | 'social_feed' | 'community';
  onChangeTab: (tab: 'home' | 'explore' | 'create' | 'reels' | 'profile' | 'social_feed' | 'community') => void;
  lang: Language;
}

export default function BottomNavigation({ currentTab, onChangeTab, lang }: BottomNavigationProps) {
  const isAr = lang === 'ar';
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      offlineSyncService.processQueue();
    };
    const handleOffline = () => setIsOnline(false);

    const updateStatus = async () => {
      setIsSyncing(offlineSyncService.getIsSyncing());
      const count = await offlineSyncService.getPendingCount();
      setPendingCount(count);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('offline-sync-change', updateStatus);

    updateStatus();
    const interval = setInterval(updateStatus, 3000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('offline-sync-change', updateStatus);
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="fixed bottom-0 inset-x-0 bg-white/90 backdrop-blur-xl border-t border-gray-100 z-40 pb-safe shadow-[0_-5px_20px_rgba(0,0,0,0.05)]">
      {/* Visual Status Indicator Bar */}
      {(!isOnline || isSyncing || pendingCount > 0) && (
        <div className="w-full bg-slate-900 text-white px-3 py-1 flex items-center justify-center gap-2 text-[10px] font-bold shadow-inner transition-all duration-300">
          {!isOnline ? (
            <div className="flex items-center gap-1.5 text-amber-400 animate-pulse">
              <CloudOff className="w-3.5 h-3.5 shrink-0" />
              <span>{isAr ? `غير متصل (الوضع المحلّي Offline) - ${pendingCount} عناصر بانتظار المزامنة` : `Offline Mode - ${pendingCount} items pending Supabase sync`}</span>
            </div>
          ) : isSyncing ? (
            <div className="flex items-center gap-1.5 text-sky-300">
              <RefreshCw className="w-3.5 h-3.5 shrink-0 animate-spin" />
              <span>{isAr ? `جاري المزامنة مع Supabase... (${pendingCount} عناصر)` : `Syncing local cache to Supabase... (${pendingCount})`}</span>
            </div>
          ) : pendingCount > 0 ? (
            <div className="flex items-center gap-1.5 text-emerald-300">
              <RefreshCw className="w-3.5 h-3.5 shrink-0 animate-spin" />
              <span>{isAr ? `جاري رفع الكاش السحابي (${pendingCount})...` : `Syncing... (${pendingCount} pending)`}</span>
            </div>
          ) : null}
        </div>
      )}

      <div className="flex items-center justify-around px-2 min-h-[64px] max-w-lg mx-auto">
        <button
          onClick={() => { Haptics.light(); onChangeTab('home'); }}
          className={`relative flex flex-col items-center justify-center w-16 h-12 rounded-xl gap-0.5 transition-colors ${currentTab === 'home' ? 'text-indigo-600' : 'text-gray-400 hover:text-gray-600'}`}
        >
          {currentTab === 'home' && (
            <motion.div
              layoutId="navPill"
              className="absolute inset-0 bg-indigo-50/75 border border-indigo-100/20 rounded-xl -z-10"
              transition={{ type: 'spring', stiffness: 380, damping: 28 }}
            />
          )}
          <Home className={`w-5.5 h-5.5 outline-none transition-transform ${currentTab === 'home' ? 'scale-105' : ''}`} />
          <span className="text-[9px] font-black">{isAr ? 'الرئيسية' : 'Home'}</span>
        </button>
        
        <button
          onClick={() => { Haptics.light(); onChangeTab('reels'); }}
          className={`relative flex flex-col items-center justify-center w-16 h-12 rounded-xl gap-0.5 transition-colors ${currentTab === 'reels' ? 'text-indigo-600' : 'text-gray-400 hover:text-gray-600'}`}
        >
          {currentTab === 'reels' && (
            <motion.div
              layoutId="navPill"
              className="absolute inset-0 bg-indigo-50/75 border border-indigo-100/20 rounded-xl -z-10"
              transition={{ type: 'spring', stiffness: 380, damping: 28 }}
            />
          )}
          <Video className={`w-5.5 h-5.5 outline-none transition-transform ${currentTab === 'reels' ? 'scale-105' : ''}`} />
          <span className="text-[9px] font-black">{isAr ? 'ريلز' : 'Reels'}</span>
        </button>
        
        <button
          onClick={() => { Haptics.light(); onChangeTab('explore'); }}
          className={`relative flex flex-col items-center justify-center w-16 h-12 rounded-xl gap-0.5 transition-colors ${currentTab === 'explore' ? 'text-indigo-600' : 'text-gray-400 hover:text-gray-600'}`}
        >
          {currentTab === 'explore' && (
            <motion.div
              layoutId="navPill"
              className="absolute inset-0 bg-indigo-50/75 border border-indigo-100/20 rounded-xl -z-10"
              transition={{ type: 'spring', stiffness: 380, damping: 28 }}
            />
          )}
          <Compass className={`w-5.5 h-5.5 outline-none transition-transform ${currentTab === 'explore' ? 'scale-105' : ''}`} />
          <span className="text-[9px] font-black">{isAr ? 'استكشف' : 'Explore'}</span>
        </button>
        
        <button
          onClick={() => { Haptics.light(); onChangeTab('community'); }}
          className={`relative flex flex-col items-center justify-center w-16 h-12 rounded-xl gap-0.5 transition-colors ${currentTab === 'community' ? 'text-indigo-600' : 'text-gray-400 hover:text-gray-600'}`}
        >
          {currentTab === 'community' && (
            <motion.div
              layoutId="navPill"
              className="absolute inset-0 bg-indigo-50/75 border border-indigo-100/20 rounded-xl -z-10"
              transition={{ type: 'spring', stiffness: 380, damping: 28 }}
            />
          )}
          <Users className={`w-5.5 h-5.5 outline-none transition-transform ${currentTab === 'community' ? 'scale-105' : ''}`} />
          <span className="text-[9px] font-black">{isAr ? 'مجتمعات' : 'Community'}</span>
        </button>
        
        <button
          onClick={() => { Haptics.medium(); onChangeTab('create'); }}
          className="flex flex-col items-center justify-center relative -top-3 shrink-0"
        >
          <div className="w-12 h-12 bg-indigo-600 rounded-full flex items-center justify-center shadow-md shadow-indigo-500/30 text-white hover:scale-105 transition-transform border-4 border-white">
            <PlusCircle className="w-7 h-7" />
          </div>
          <span className="text-[9px] font-black mt-1 text-gray-400">{isAr ? 'إنشاء' : 'Create'}</span>
        </button>
        
        <button
          onClick={() => { Haptics.light(); onChangeTab('profile'); }}
          className={`relative flex flex-col items-center justify-center w-16 h-12 rounded-xl gap-0.5 transition-colors ${currentTab === 'profile' ? 'text-indigo-600' : 'text-gray-400 hover:text-gray-600'}`}
        >
          {currentTab === 'profile' && (
            <motion.div
              layoutId="navPill"
              className="absolute inset-0 bg-indigo-50/75 border border-indigo-100/20 rounded-xl -z-10"
              transition={{ type: 'spring', stiffness: 380, damping: 28 }}
            />
          )}
          <User className={`w-5.5 h-5.5 outline-none transition-transform ${currentTab === 'profile' ? 'scale-105' : ''}`} />
          <span className="text-[9px] font-black">{isAr ? 'حسابي' : 'Profile'}</span>
        </button>
      </div>
    </div>
  );
}

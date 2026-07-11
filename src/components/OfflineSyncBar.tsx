import React, { useEffect, useState } from 'react';
import { RefreshCw, Wifi, WifiOff } from 'lucide-react';
import { offlineSyncService } from '../services/offlineSyncService';

interface OfflineSyncBarProps {
  lang: 'ar' | 'en';
}

export default function OfflineSyncBar({ lang }: OfflineSyncBarProps) {
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [lowPowerMode, setLowPowerMode] = useState(() => {
    return typeof localStorage !== 'undefined' && localStorage.getItem('yallamate_low_power_mode') === 'true';
  });

  const updateStatus = async () => {
    const count = await offlineSyncService.getPendingCount();
    setPendingCount(count);
    setIsSyncing(offlineSyncService.getIsSyncing());
  };

  useEffect(() => {
    const handleLowPowerChange = (e: Event) => {
      const customEvent = e as CustomEvent<{ enabled: boolean }>;
      if (customEvent.detail && typeof customEvent.detail.enabled !== 'undefined') {
        setLowPowerMode(customEvent.detail.enabled);
      } else {
        setLowPowerMode(localStorage.getItem('yallamate_low_power_mode') === 'true');
      }
    };
    window.addEventListener('yallamate_low_power_mode_change', handleLowPowerChange);
    return () => window.removeEventListener('yallamate_low_power_mode_change', handleLowPowerChange);
  }, []);

  useEffect(() => {
    updateStatus();

    const handleSyncChange = () => {
      updateStatus();
    };

    const handleOnline = () => {
      setIsOnline(true);
      offlineSyncService.syncAll();
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('offline-sync-change', handleSyncChange);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const pollIntervalMs = lowPowerMode ? 15000 : 3000;
    const interval = setInterval(updateStatus, pollIntervalMs);

    return () => {
      window.removeEventListener('offline-sync-change', handleSyncChange);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, [lowPowerMode]);

  const handleForceResync = async () => {
    if (!isOnline) return;
    await offlineSyncService.syncAll();
    updateStatus();
  };

  if (pendingCount === 0 && isOnline) {
    return null;
  }

  const isAr = lang === 'ar';

  return (
    <div className="w-full bg-slate-900/90 backdrop-blur-md border-b border-white/5 px-4 py-2 flex items-center justify-between text-xs text-slate-300 z-[120] sticky top-0 transition-all shadow-md">
      <div className="flex items-center gap-2">
        {isOnline ? (
          <span className="flex items-center gap-1.5 text-emerald-400 font-bold">
            <Wifi className="w-3.5 h-3.5" />
            <span>{isAr ? 'متصل بالشبكة' : 'Online'}</span>
          </span>
        ) : (
          <span className="flex items-center gap-1.5 text-rose-400 font-bold">
            <WifiOff className="w-3.5 h-3.5" />
            <span>{isAr ? 'غير متصل بالشبكة' : 'Offline Mode'}</span>
          </span>
        )}
        
        {pendingCount > 0 && (
          <span className="px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-semibold border border-indigo-500/30">
            {pendingCount} {isAr ? 'عمليات معلقة' : 'Pending Operations'}
          </span>
        )}

        {isSyncing && (
          <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 font-semibold animate-pulse">
            <RefreshCw className="w-3 h-3 animate-spin text-indigo-400" />
            <span>{isAr ? 'جاري المزامنة...' : 'Syncing...'}</span>
          </span>
        )}
      </div>

      {pendingCount > 0 && isOnline && (
        <button
          onClick={handleForceResync}
          disabled={isSyncing}
          className="flex items-center gap-1.5 px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold text-[10px] uppercase tracking-wider shadow active:scale-95 transition-all cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
          <span>{isAr ? 'تزامن الآن' : 'Force Resync'}</span>
        </button>
      )}
    </div>
  );
}

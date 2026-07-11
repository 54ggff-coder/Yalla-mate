import React, { useState, useEffect } from 'react';
import { RefreshCw, CheckCircle, WifiOff } from 'lucide-react';
import { offlineSyncService } from '../services/offlineSyncService';

interface SyncStatusIndicatorProps {
  isOnline: boolean;
  lang: 'ar' | 'en';
}

export default function SyncStatusIndicator({ isOnline, lang }: SyncStatusIndicatorProps) {
  const [isSyncing, setIsSyncing] = useState(offlineSyncService.getIsSyncing());
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    const updateStatus = async () => {
      setIsSyncing(offlineSyncService.getIsSyncing());
      const count = await offlineSyncService.getPendingCount();
      setPendingCount(count);
    };
    
    updateStatus();

    const handleSyncChange = () => {
      updateStatus();
    };

    window.addEventListener('offline-sync-change', handleSyncChange);
    return () => window.removeEventListener('offline-sync-change', handleSyncChange);
  }, []);

  if (pendingCount === 0 && !isSyncing) return null;

  if (isSyncing) {
    return (
      <div 
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[10px] font-black uppercase tracking-widest"
      >
        <RefreshCw className="w-2.5 h-2.5 animate-spin" />
        <span>{lang === 'ar' ? 'جاري المزامنة...' : 'Syncing...'}</span>
      </div>
    );
  }

  if (!isOnline && pendingCount > 0) {
    return (
      <div 
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-black uppercase tracking-widest"
      >
        <WifiOff className="w-2.5 h-2.5" />
        <span>{lang === 'ar' ? `معلّق (${pendingCount})` : `Pending (${pendingCount})`}</span>
      </div>
    );
  }

  if (isOnline && pendingCount > 0) {
    return (
      <div 
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-black uppercase tracking-widest animate-pulse"
      >
        <RefreshCw className="w-2.5 h-2.5 animate-spin" />
        <span>{lang === 'ar' ? `جاري المعالجة (${pendingCount})` : `Processing (${pendingCount})`}</span>
      </div>
    );
  }

  return null;
}

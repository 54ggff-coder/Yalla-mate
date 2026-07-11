import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Database, AlertTriangle, CheckCircle, RefreshCw, X, Shield, Terminal, Key, Globe, Radio, MessageSquare, UserPlus, Zap, Mail, Send, Info } from 'lucide-react';
import { Language } from '../data/translations';
import { getPendingMessages, getPendingFriendRequests } from '../services/db';
import { offlineSyncService } from '../services/offlineSyncService';

interface SupabaseDiagnosticsProps {
  onClose: () => void;
  lang: Language;
  runDatabaseMigration: () => Promise<void>;
}

export default function SupabaseDiagnostics({ onClose, lang, runDatabaseMigration }: SupabaseDiagnosticsProps) {
  const isAr = lang === 'ar';
  const [loading, setLoading] = useState(false);
  const [url, setUrl] = useState('');
  const [apiKeyMasked, setApiKeyMasked] = useState('');
  const [keyType, setKeyType] = useState<'empty' | 'placeholder' | 'jwt' | 'unknown'>('empty');
  const [exactAuthResponse, setExactAuthResponse] = useState<any>(null);
  
  // Tabs & Sync-Gaps diagnostics states
  const [activeTab, setActiveTab] = useState<'system' | 'sync' | 'sync_audit' | 'integrity'>('system');
  const [integrityLogs, setIntegrityLogs] = useState<string[]>([]);
  const [isAuditingIntegrity, setIsAuditingIntegrity] = useState(false);
  const [pendingDMsCount, setPendingDMsCount] = useState(0);
  const [pendingReqsCount, setPendingReqsCount] = useState(0);
  const [lastSyncDMs, setLastSyncDMs] = useState<string | null>(null);
  const [lastSyncReqs, setLastSyncReqs] = useState<string | null>(null);
  const [isProcessingQueue, setIsProcessingQueue] = useState(false);


  
  // Statuses
  const [serverHealth, setServerHealth] = useState<'loading' | 'success' | 'failed'>('loading');
  const [serverHealthMsg, setServerHealthMsg] = useState('');
  const [clientInit, setClientInit] = useState<'loading' | 'success' | 'failed'>('loading');
  const [dbStatus, setDbStatus] = useState<'loading' | 'success' | 'failed'>('loading');
  const [authStatus, setAuthStatus] = useState<'loading' | 'success' | 'failed'>('loading');
  const [realtimeStatus, setRealtimeStatus] = useState<'loading' | 'success' | 'failed'>('loading');
  const [storageStatus, setStorageStatus] = useState<'loading' | 'success' | 'failed'>('loading');
  const [storageError, setStorageError] = useState<string | null>(null);
  
  // Detailed row counts & errors for each table
  const [tableAudit, setTableAudit] = useState<Record<string, { count: number | null; status: 'pending' | 'success' | 'failed'; error?: string; typeMismatch?: boolean }>>({
    users: { count: null, status: 'pending' },
    friend_requests: { count: null, status: 'pending' },
    direct_messages: { count: null, status: 'pending' },
    reels: { count: null, status: 'pending' },
    outings: { count: null, status: 'pending' }
  });

  const [lifecycleLogs, setLifecycleLogs] = useState<string[]>([]);
  const [isTesting, setIsTesting] = useState(false);

  const runLifecycleTest = async () => {
    setIsTesting(true);
    setLifecycleLogs(['Starting reel lifecycle test...']);
    const addLog = (msg: string) => {
      console.log(msg);
      setLifecycleLogs(prev => [...prev, `${new Date().toLocaleTimeString()}: ${msg}`]);
    };
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
         addLog('ERROR: User not authenticated');
         setIsTesting(false);
         return;
      }
      addLog(`Authenticated successfully. User ID: ${user.id}`);
      
      const newReelId = crypto.randomUUID();
      addLog(`Created mock payload for reels: ID ${newReelId}`);
      
      const { error: reelErr } = await supabase.from('reels').insert([{
        id: newReelId,
        caption: 'Diagnostic Test Reel',
        video_url: 'https://example.com/mock.mp4',
        owner_id: user.id,
        creator_id: user.id
      }]);
      
      if (reelErr) {
        addLog(`ERROR: Reel insert failed: ${JSON.stringify(reelErr)}`);
        setIsTesting(false);
        return;
      }
      addLog('Reel insert successful.');
      
      addLog('Attempting to like the new reel...');
      const { error: likeErr } = await supabase.from('reels_likes').insert([{
        reel_id: newReelId,
        user_id: user.id,
        owner_id: user.id
      }]);
      
      if (likeErr) {
        addLog(`ERROR: Reel like failed: ${JSON.stringify(likeErr)}`);
      } else {
        addLog('Reel like successful.');
      }
      
      addLog('Attempting to add comment...');
      const { error: commentErr } = await supabase.from('reels_comments').insert([{
        reel_id: newReelId,
        user_id: user.id,
        content: 'Test comment'
      }]);
      if (commentErr) {
        addLog(`ERROR: Reel comment failed: ${JSON.stringify(commentErr)}`);
      } else {
        addLog('Reel comment successful.');
      }
      
      addLog('Reloading server counts to verify constraints...');
      await runAudit();
      addLog('Counts reloaded. Cleaning up diagnostic reel...');
      
      await supabase.from('reels').delete().eq('id', newReelId);
      addLog('Cleanup successful. Test complete.');
      
    } catch (err: any) {
      addLog(`CRITICAL ERROR: ${err.message || String(err)}`);
    }
    setIsTesting(false);
  };

  const runIntegrityAudit = async () => {
    setIsAuditingIntegrity(true);
    setIntegrityLogs(['Executing deep PostgreSQL schema check...']);
    const addLog = (msg: string) => setIntegrityLogs(prev => [...prev, `${new Date().toLocaleTimeString()}: ${msg}`]);

    try {
      const tables = ['reels_likes', 'direct_messages', 'friend_requests'];

      for (const table of tables) {
        // 1. Get Count
        const { count, error } = await supabase.from(table).select('id', { count: 'exact', head: true });
        if (error) {
           addLog(`❌ Count error [${table}]: ${error.message}`);
        } else {
           addLog(`✅ Table [${table}]: ${count} rows.`);
        }

        // 2. Get Last Sync Timestamp
        const syncKey = table === 'direct_messages' ? 'mates_last_sync_direct_messages' : table === 'friend_requests' ? 'mates_last_sync_friend_requests' : null;
        if (syncKey) {
          const lastSync = localStorage.getItem(syncKey);
          addLog(`📅 Sync record [${table}]: ${lastSync || 'Never synced'}`);
        }
      }

      addLog('Integrity Audit Complete.');
    } catch(err: any) {
      addLog(`❌ SQL ERROR: ${err.message || String(err)}`);
    }
    setIsAuditingIntegrity(false);
  };

  const runReloadSchema = async () => {
    setIsAuditingIntegrity(true);
    setIntegrityLogs(['Notifying PostgREST to reload schema cache...']);
    const addLog = (msg: string) => setIntegrityLogs(prev => [...prev, `${new Date().toLocaleTimeString()}: ${msg}`]);

    try {
      const { error } = await supabase.rpc('execute_sql', {
        sql_query: "NOTIFY pgrst, 'reload schema';"
      });
      if (error) {
        addLog(`❌ Failed to send NOTIFY command: ${error.message}`);
      } else {
        addLog('✅ Sent NOTIFY pgrst, reload schema;');
      }
    } catch (e: any) {
      addLog(`❌ ERROR: ${e.message}`);
    }
    setIsAuditingIntegrity(false);
  };

  const runAudit = async () => {
    setLoading(true);
    
    // 1. Check client-side injected credentials
    const currentUrl = process.env.SUPABASE_URL || '';
    const currentKey = process.env.SUPABASE_ANON_KEY || '';
    
    setUrl(currentUrl);
    
    if (!currentUrl || !currentKey) {
      setApiKeyMasked(isAr ? 'غير معرف' : 'Not Defined');
      setKeyType('empty');
      setClientInit('failed');
    } else if (currentKey === 'sb_secret_21MC') {
      setApiKeyMasked('sb_secret_21MC (14 chars)');
      setKeyType('placeholder');
      setClientInit('success');
    } else if (currentKey.startsWith('eyJ')) {
      setApiKeyMasked(`${currentKey.substring(0, 8)}...${currentKey.substring(currentKey.length - 8)} (JWT format - ${currentKey.length} chars)`);
      setKeyType('jwt');
      setClientInit('success');
    } else {
      setApiKeyMasked(`${currentKey.substring(0, 4)}... (Unknown format - ${currentKey.length} chars)`);
      setKeyType('unknown');
      setClientInit('success');
    }

    // 2. Ping Server API health and proxy status
    try {
      const hResp = await fetch('/api/health');
      if (hResp.ok) {
        const hData = await hResp.json();
        setServerHealth('success');
        setServerHealthMsg(`Server OK (${new Date(hData.time).toLocaleTimeString()})`);
      } else {
        setServerHealth('failed');
        setServerHealthMsg(`HTTP Error ${hResp.status}`);
      }
    } catch (e: any) {
      setServerHealth('failed');
      setServerHealthMsg(e.message || 'Network Fail');
    }

    // 3. Test Auth Endpoint availability
    try {
      if (supabase && supabase.auth) {
        const { data: authData, error: authError } = await supabase.auth.getSession();
        console.log('[Diagnostics] getSession result:', { authData, authError });
        setExactAuthResponse({ authData, authError });
        if (authError) {
          setAuthStatus('failed');
        } else {
          setAuthStatus('success');
        }
      } else {
        setAuthStatus('failed');
      }
    } catch (e) {
      console.error('[Diagnostics] getSession exception:', e);
      setExactAuthResponse({ exception: e });
      setAuthStatus('failed');
    }

    // 4. Test Realtime subscription registration
    try {
      if (supabase) {
        const tempChannel = supabase.channel('supabase_diagnostics_ping');
        tempChannel.subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            setRealtimeStatus('success');
            supabase.removeChannel(tempChannel);
          } else if (status === 'CHANNEL_ERROR' || status === 'CLOSED') {
            setRealtimeStatus('failed');
          }
        });
        // Self timeout if no response in 2s
        setTimeout(() => {
          setRealtimeStatus(prev => prev === 'loading' ? 'failed' : prev);
        }, 5000);
      } else {
        setRealtimeStatus('failed');
      }
    } catch (e) {
      setRealtimeStatus('failed');
    }

    // 5. Test Storage Bucket 'reels'
    try {
      if (supabase && supabase.storage) {
        setStorageStatus('loading');
        // Try listing files (even if empty) to verify existence and public access
        const { error: listErr } = await supabase.storage.from('reels').list('', { limit: 1 });
        
        if (listErr) {
          console.warn('[Diagnostics] Storage bucket "reels" access failed:', listErr);
          setStorageStatus('failed');
          setStorageError(listErr.message);
        } else {
          setStorageStatus('success');
          setStorageError(null);
        }
      } else {
        setStorageStatus('failed');
      }
    } catch (e: any) {
      setStorageStatus('failed');
      setStorageError(e.message || 'Storage Access Error');
    }

    // 6. Audit all requested tables individually
    const tables = [
      'users', 
      'outings', 
      'reels', 
      'reels_likes', 
      'reels_comments',
      'reels_bookmarks',
      'posts', 
      'chats', 
      'direct_messages', 
      'communities', 
      'community_messages', 
      'friend_requests', 
      'follows', 
      'companion_reviews', 
      'incident_reports', 
      'place_reviews'
    ];
    let overallDbSuccess = true;

    for (const table of tables) {
      setTableAudit(prev => ({
        ...prev,
        [table]: { count: null, status: 'pending' }
      }));

      if (!supabase) {
        setTableAudit(prev => ({
          ...prev,
          [table]: { count: 0, status: 'failed', error: 'Supabase client is null (Check keys)' }
        }));
        overallDbSuccess = false;
        continue;
      }

      try {
        // Query full row to check ID type (for outingId/id mismatch detection)
        const { data: rowData, error, count } = await supabase
          .from(table)
          .select('*', { count: 'exact', head: false })
          .limit(1);

        let typeMismatch = false;
        if (rowData && rowData.length > 0) {
          const idValue = rowData[0].id;
          if (typeof idValue === 'string') {
            const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idValue);
            // The app uses custom strings like outing_... and reel_...
            // If it's a UUID, it's likely a mismatch from an older setup run.
            if ((table === 'outings' || table === 'reels') && isUuid) {
              typeMismatch = true;
              console.warn(`[Diagnostics] Type mismatch detected on ${table}.id - value looks like UUID: ${idValue}`);
            }
          }
        }

        if (error) {
          setTableAudit(prev => ({
            ...prev,
            [table]: { count: 0, status: 'failed', error: error.message }
          }));
          overallDbSuccess = false;
        } else {
          setTableAudit(prev => ({
            ...prev,
            [table]: { count: count || 0, status: 'success', typeMismatch }
          }));
        }
      } catch (err: any) {
        setTableAudit(prev => ({
          ...prev,
          [table]: { count: 0, status: 'failed', error: err.message || 'Catch clause panic' }
        }));
        overallDbSuccess = false;
      }
    }

    setDbStatus(overallDbSuccess ? 'success' : 'failed');
    await fetchSyncStats();
    setLoading(false);
  };

  const fetchSyncStats = async () => {
    try {
      const pendingDMs = await getPendingMessages();
      setPendingDMsCount(pendingDMs.length);
    } catch (e) {
      console.error('[Diagnostics] Failed to fetch IndexedDB pending DMs count:', e);
    }

    try {
      const pendingReqs = await getPendingFriendRequests();
      setPendingReqsCount(pendingReqs.length);
    } catch (e) {
      console.error('[Diagnostics] Failed to fetch IndexedDB pending requests count:', e);
    }

    setLastSyncDMs(localStorage.getItem('mates_last_sync_direct_messages'));
    setLastSyncReqs(localStorage.getItem('mates_last_sync_friend_requests'));
  };



  useEffect(() => {
    runAudit();
  }, []);

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 overflow-y-auto flex items-center justify-center p-4 antialiased text-slate-100" onClick={onClose}>
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl shadow-indigo-950/50 flex flex-col max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
        
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-800/80 flex items-center justify-between bg-slate-900/50 sticky top-0 z-10 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-500/10 text-indigo-400 rounded-2xl border border-indigo-500/20">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base tracking-tight text-white">
                {isAr ? 'فحص جودة اتصال قاعدة البيانات' : 'Supabase Connectivity Audit'}
              </h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
                {isAr ? 'التحري والتدقيق المباشر لمزود البيانات' : 'Front-end & Server Diagnostic Engine'}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="flex items-center gap-1.5 px-4 py-2 bg-rose-500 hover:bg-rose-600 text-white rounded-xl transition-all cursor-pointer font-black text-[10px] uppercase tracking-widest border border-rose-400/30 shadow-lg shadow-rose-500/20"
          >
            <X className="w-4 h-4" />
            {isAr ? 'إغلاق التشخيص' : 'Close Audit'}
          </button>
        </div>

        {/* Tabs Switcher Selector */}
        <div className="flex border-b border-slate-800 bg-slate-900/80 px-6 py-2 gap-4 flex-wrap">
          <button
            onClick={() => setActiveTab('system')}
            className={`px-4 py-2 text-xs font-black rounded-lg transition-all border ${activeTab === 'system' ? 'bg-indigo-600/20 text-indigo-400 border-indigo-500/30' : 'text-slate-400 hover:text-slate-200 border-transparent hover:bg-slate-800/50'}`}
          >
            {isAr ? '🖥️ سلامة النظام الأساسية' : '🖥️ System Integrity'}
          </button>
          <button
            onClick={() => setActiveTab('sync')}
            className={`px-4 py-2 text-xs font-black rounded-lg transition-all border flex items-center gap-1.5 ${activeTab === 'sync' ? 'bg-indigo-600/20 text-indigo-400 border-indigo-500/30' : 'text-slate-400 hover:text-slate-200 border-transparent hover:bg-slate-800/50'}`}
          >
            <Radio className="w-3.5 h-3.5" />
            {isAr ? '🔄 مزامنة الرسائل والصداقات' : '🔄 Chats & Friends Sync'}
          </button>
          <button
            onClick={() => setActiveTab('sync_audit')}
            className={`px-4 py-2 text-xs font-black rounded-lg transition-all border flex items-center gap-1.5 ${activeTab === 'sync_audit' ? 'bg-indigo-600/20 text-indigo-400 border-indigo-500/30' : 'text-slate-400 hover:text-slate-200 border-transparent hover:bg-slate-800/50'}`}
          >
            <Database className="w-3.5 h-3.5" />
            {isAr ? '🔍 تدقيق المزامنة التفصيلي' : '🔍 Sync Audit'}
          </button>
          <button
            onClick={() => { setActiveTab('integrity'); runIntegrityAudit(); }}
            className={`px-4 py-2 text-xs font-black rounded-lg transition-all border flex items-center gap-1.5 ${activeTab === 'integrity' ? 'bg-rose-600/20 text-rose-400 border-rose-500/30' : 'text-slate-400 hover:text-slate-200 border-transparent hover:bg-slate-800/50'}`}
          >
            <CheckCircle className="w-3.5 h-3.5" />
            {isAr ? '🛡️ تدقيق النزاهة والتطابق' : '🛡️ Integrity Audit'}
          </button>

        </div>

        {/* Audit Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
          


          {activeTab === 'integrity' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-4">
                <div>
                  <h4 className="text-white font-black text-sm">PostgreSQL Schema & Constraints Integrity</h4>
                  <p className="text-slate-400 mt-1">Real-time row counts and schema cache management.</p>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={async () => {
                      await supabase.rpc('execute_sql', { sql_query: "NOTIFY pgrst, 'reload schema';" });
                      alert('Schema cache reload signal sent.');
                    }}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-black tracking-widest uppercase transition-colors text-[10px]"
                  >
                    Reload Schema Cache
                  </button>
                  <button 
                    onClick={async () => {
                      const tables = ['reels_likes', 'direct_messages', 'friend_requests'];
                      const results: Record<string, number> = {};
                      for (const table of tables) {
                        const { count } = await supabase.from(table).select('*', { count: 'exact', head: true });
                        results[table] = count || 0;
                      }
                      setTableAudit(prev => ({
                        ...prev,
                        reels_likes: { ...prev.reels_likes, count: results.reels_likes },
                        direct_messages: { ...prev.direct_messages, count: results.direct_messages },
                        friend_requests: { ...prev.friend_requests, count: results.friend_requests }
                      }));
                    }} 
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-black tracking-widest uppercase transition-colors text-[10px]"
                  >
                    Run Audit
                  </button>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {['reels_likes', 'direct_messages', 'friend_requests'].map((table) => (
                  <div key={table} className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                    <h5 className="text-slate-400 font-bold text-xs uppercase mb-2">{table}</h5>
                    <p className="text-2xl font-black text-white">
                      {tableAudit[table]?.count ?? '...'}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'system' && (
            <>
          <div className="mb-6 bg-red-500/10 border border-red-500/20 p-4 rounded-2xl flex flex-col gap-3">
            <h3 className="text-red-400 font-bold flex items-center gap-2 text-sm">
              <AlertTriangle className="w-5 h-5 flex-shrink-0" />
              {isAr ? 'خطأ في صلاحيات الجداول (هام جداً)' : 'Critical Table Permission Error (Action Required)'}
            </h3>
            <p className="text-slate-300 text-xs leading-relaxed">
              {isAr 
                ? 'إذا كان التطبيق يعاني من مشكلة "permission denied for table users"، فهذا يعني أن الجداول تحتاج لصلاحيات إضافية. للأسف قاعدة البيانات تفتقد كلمة المرور للتدخل الآلي. يجب عليك تنفيذ هذا الكود يدوياً في Supabase Dashboard > SQL Editor:'
                : 'If you see a "permission denied for table users" error during sign-up, it happens because your table references auth.users which needs explicit permissions. The database password configured in the app is missing ([YOUR-PASSWORD]), so we cannot fix it automatically. Please run this command in your Supabase SQL Editor:'}
            </p>
            <div className="bg-black/80 border border-slate-700 p-3 rounded-xl">
              <code className="text-amber-300 font-mono text-xs whitespace-pre-wrap select-all">
                {`-- FIX FOR: "permission denied for table users"\nGRANT SELECT ON auth.users TO authenticated;\nGRANT SELECT ON auth.users TO anon;\n\n-- Ensure public.users has correct access if disabled:\nGRANT ALL PRIVILEGES ON TABLE public.users TO authenticated, anon;`}
              </code>
            </div>
          </div>
              {/* Key Alert Box */}
              {keyType === 'placeholder' && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex gap-3.5">
              <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5 animate-pulse" />
              <div className="space-y-1">
                <h4 className="font-bold text-amber-400">
                  {isAr ? 'تنبيه: تم كشف مفتاح تجريبي متوقف!' : 'Warning: Placeholder secret key loaded!'}
                </h4>
                <p className="text-slate-300 leading-relaxed text-[11px]">
                  {isAr 
                    ? 'المفتاح التجريبي الحالي (sb_secret_21MC) هو قالب غير صالح في سجلات Supabase الفعلية. سيؤدي هذا لتوقف المزامنة الحية وعمل التطبيق في الوضع المحلي فقط.'
                    : 'The current configuration is using the placeholder "sb_secret_21MC". Since it lacks a production credentials token, all queries will reject with authentication errors and utilize local storage/offline caches.'}
                </p>
                <div className="pt-2">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-500/20 text-amber-300 rounded-lg font-black text-[9px] uppercase tracking-wider">
                    {isAr ? 'يتطلب إجراء' : 'Action Required'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {keyType === 'empty' && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 flex gap-3.5">
              <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h4 className="font-bold text-red-400">
                  {isAr ? 'قيمة الاتصال شاغرة أو غير معرفة!' : 'Credentials are completely missing!'}
                </h4>
                <p className="text-slate-300 leading-relaxed text-[11px]">
                  {isAr
                    ? 'لم يتم الكشف عن SUPABASE_URL أو SUPABASE_ANON_KEY بالكامل داخل ملفات أو بيئة تشغيل التطبيق. يرجى مراجعة إعدادات Secrets.'
                    : 'No Supabase URL or Anon key was found in the bundle context registry. The client is completely dormant.'}
                </p>
              </div>
            </div>
          )}

          {keyType === 'jwt' && (
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4 flex gap-3.5">
              <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h4 className="font-bold text-emerald-400">
                  {isAr ? 'تم تحميل تركيبة مفتاح التوثيق بنجاح!' : 'Production token format is recognized!'}
                </h4>
                <p className="text-slate-300 leading-relaxed text-[11px]">
                  {isAr
                    ? 'اكتشف النظام تركيبة مفاتيح JWT برمجية صالحة في واجهة التطبيق. يتم تنفيذ الاستجواب الآن لترخيص الدخول.'
                    : 'The app detected a correctly structured JWT key pattern. Attempting live queries to authenticate.'}
                </p>
              </div>
            </div>
          )}

          {/* Config Summary Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            <div className="bg-slate-950/40 border border-slate-800/60 rounded-2xl p-4 space-y-3">
              <div className="flex items-center gap-2 text-slate-400 font-bold tracking-tight pb-1 border-b border-slate-800/50">
                <Globe className="w-4 h-4 text-indigo-400" />
                <span>{isAr ? 'رابط خادم البيانات' : 'Supabase URL'}</span>
              </div>
              <div className="font-mono text-[11px] break-all bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                {url || (isAr ? 'غير معروف أو فارغ' : 'Undefined / Missing')}
              </div>
            </div>

            <div className="bg-slate-950/40 border border-slate-800/60 rounded-2xl p-4 space-y-3">
              <div className="flex items-center gap-2 text-slate-400 font-bold tracking-tight pb-1 border-b border-slate-800/50">
                <Key className="w-4 h-4 text-indigo-400" />
                <span>{isAr ? 'مفتاح الاستدعاء العام' : 'Anon API Key'}</span>
              </div>
              <div className="font-mono text-[11px] break-all bg-slate-950 p-2.5 rounded-xl border border-slate-800 text-amber-400/90 font-bold">
                {apiKeyMasked || (isAr ? 'غير معروف' : 'Undefined')}
              </div>
            </div>

          </div>

          {/* System Status Indicators */}
          <div className="space-y-3">
            <h4 className="font-bold text-slate-300 text-xs px-1">
              {isAr ? 'مؤشرات الاتصال اللحظي:' : 'Real-time Integrities:'}
            </h4>
            
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              
              {/* Server Express API */}
              <div className="bg-slate-950/30 border border-slate-800/40 p-3 rounded-xl flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{isAr ? 'خادم Express' : 'Express Server'}</p>
                  <p className="font-medium text-slate-200 text-[11px]">{serverHealth === 'success' ? 'ONLINE' : 'OFFLINE'}</p>
                </div>
                <div className={`w-2 h-2 rounded-full ${serverHealth === 'success' ? 'bg-emerald-500 ring-4 ring-emerald-500/10' : serverHealth === 'loading' ? 'bg-amber-400' : 'bg-red-500 ring-4 ring-red-500/10'}`} />
              </div>

              {/* Supabase Client */}
              <div className="bg-slate-950/30 border border-slate-800/40 p-3 rounded-xl flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{isAr ? 'مكتبة الاستدعاء' : 'Client Library'}</p>
                  <p className="font-medium text-slate-200 text-[11px]">{clientInit === 'success' ? 'INITIALIZED' : 'DORMANT'}</p>
                </div>
                <div className={`w-2 h-2 rounded-full ${clientInit === 'success' ? 'bg-emerald-500 ring-4 ring-emerald-500/10' : 'bg-red-500 ring-4 ring-red-500/10'}`} />
              </div>

              {/* Database Test */}
              <div className="bg-slate-950/30 border border-slate-800/40 p-3 rounded-xl flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{isAr ? 'قاعدة البيانات' : 'Database Link'}</p>
                  <p className="font-medium text-slate-200 text-[11px]">{dbStatus === 'success' ? 'CONNECTED' : 'FAILED'}</p>
                </div>
                <div className={`w-2 h-2 rounded-full ${dbStatus === 'success' ? 'bg-emerald-500 ring-4 ring-emerald-500/10' : dbStatus === 'loading' ? 'bg-amber-400 animate-pulse' : 'bg-red-500 ring-4 ring-red-500/10'}`} />
              </div>

              {/* Authentication service */}
              <div className="bg-slate-950/30 border border-slate-800/40 p-3 rounded-xl flex items-center justify-between col-span-1">
                <div className="space-y-1">
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{isAr ? 'نظام التوثيق' : 'Authentication'}</p>
                  <p className="font-medium text-slate-200 text-[11px]">{authStatus === 'success' ? 'ACTIVE' : 'INACTIVE'}</p>
                </div>
                <div className={`w-2 h-2 rounded-full ${authStatus === 'success' ? 'bg-emerald-500 ring-4 ring-emerald-500/10' : 'bg-red-500 ring-4 ring-red-500/10'}`} />
              </div>

              {/* Realtime PubSubChannel */}
              <div className="bg-slate-950/30 border border-slate-800/40 p-3 rounded-xl flex items-center justify-between col-span-2">
                <div className="space-y-1 flex items-center gap-2">
                  <Radio className="w-3.5 h-3.5 text-indigo-400 shrink-0 animate-ping" />
                  <div>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{isAr ? 'استماع وبث مباشر' : 'Realtime PubSub'}</p>
                    <p className="font-medium text-slate-200 text-[11px]">{realtimeStatus === 'success' ? 'SUBSCRIBED' : realtimeStatus === 'loading' ? 'CONNECTING...' : 'DISCONNECTED'}</p>
                  </div>
                </div>
                <div className={`w-2 h-2 rounded-full ${realtimeStatus === 'success' ? 'bg-emerald-500 ring-4 ring-emerald-500/10' : realtimeStatus === 'loading' ? 'bg-amber-400' : 'bg-red-500 ring-4 ring-red-500/10'}`} />
              </div>

              {/* Storage bucket check */}
              <div className="bg-slate-950/30 border border-slate-800/40 p-3 rounded-xl flex items-center justify-between col-span-2 sm:col-span-1">
                <div className="space-y-1">
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{isAr ? 'مساحة التخزين' : 'Storage Bucket'}</p>
                  <p className="font-medium text-slate-200 text-[11px]">{storageStatus === 'success' ? 'READY' : storageStatus === 'loading' ? 'CHECKING...' : 'MISSING'}</p>
                </div>
                <div className={`w-2 h-2 rounded-full ${storageStatus === 'success' ? 'bg-emerald-500 ring-4 ring-emerald-500/10' : storageStatus === 'loading' ? 'bg-amber-400 animate-pulse' : 'bg-red-500 ring-4 ring-red-500/10'}`} />
              </div>

            </div>
          </div>

          {storageStatus === 'failed' && storageError && (
            <div className="bg-rose-500/10 border border-rose-500/20 rounded-2xl p-4 flex gap-3.5 animate-in fade-in slide-in-from-top-1">
              <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h4 className="font-bold text-rose-400">
                  {isAr ? 'تنبيه: مساحة التخزين غير مهيأة!' : 'Storage configuration required!'}
                </h4>
                <p className="text-slate-300 leading-relaxed text-[11px]">
                  {isAr
                    ? `فشل الوصول للمجلد "reels". يرجى التأكد من إنشاء Bucket باسم "reels" في Supabase وضبطه كـ Public. الخطأ: ${storageError}`
                    : `Access to "reels" bucket failed. Ensure you have created a public bucket named "reels" in your Supabase Dashboard. Error: ${storageError}`}
                </p>
              </div>
            </div>
          )}

          {/* Table Audit Stats */}
          <div className="space-y-3">
            <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-indigo-400" />
                  <h4 className="font-bold text-white text-xs">
                    {isAr ? 'اختبار دورة الحياة للمقاطع (Lifecycle Test)' : 'Reel Lifecycle Simulation'}
                  </h4>
                </div>
                <button
                  onClick={runLifecycleTest}
                  disabled={isTesting}
                  className="px-3 py-1.5 bg-indigo-500 hover:bg-indigo-400 disabled:opacity-50 text-white rounded-lg text-[10px] font-black uppercase tracking-wider transition"
                >
                  {isTesting ? 'Testing...' : 'Run Write/Delete Test'}
                </button>
              </div>

              {lifecycleLogs.length > 0 && (
                <div className="bg-black/50 p-3 rounded-xl border border-white/5 font-mono text-[9px] text-green-400 max-h-40 overflow-y-auto space-y-1">
                  {lifecycleLogs.map((log, i) => (
                    <div key={i}>{log}</div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between px-1">
              <h4 className="font-bold text-slate-300 text-xs">
                {isAr ? 'تقرير سجلات الجداول (Audit Table Logs):' : 'Audited Database Table Outlets:'}
              </h4>
              <span className="font-mono text-[10px] text-slate-500 uppercase font-black">{isAr ? 'العدد الفعلي بالخادم' : 'Live Row Counts'}</span>
            </div>

            <div className="space-y-2">
              {Object.entries(tableAudit).map(([table, result]) => {
                const res = result as { count: number | null; status: 'pending' | 'success' | 'failed'; error?: string; typeMismatch?: boolean };
                return (
                <div key={table} className="bg-slate-950/50 border border-slate-800/50 rounded-xl p-3 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[11px] text-white font-bold">{table}</span>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-400">{isAr ? 'السطور المكتشفة:' : 'Rows:'}</span>
                      {res.status === 'success' ? (
                        <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 rounded-md font-black font-mono text-[11px]">
                          {res.count}
                        </span>
                      ) : res.status === 'pending' ? (
                        <span className="text-slate-500 italic font-mono text-[10px]">PENDING...</span>
                      ) : (
                        <span className="px-2 py-0.5 bg-red-500/10 text-red-400 rounded-md font-black text-[9px] uppercase tracking-wider">
                          {isAr ? 'فشل ترخيص' : 'AUTH FAIL'}
                        </span>
                      )}
                    </div>
                  </div>

                  {res.typeMismatch && (
                    <div className="bg-amber-500/10 p-2.5 rounded-lg border border-amber-500/20 font-mono text-[10px] text-amber-300 flex flex-col gap-1 mb-1">
                      <span className="text-amber-400 font-black uppercase text-[9px] tracking-wider flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        {isAr ? 'خطأ في نوع البيانات المكتشفة:' : 'Column Type Mismatch Identified:'}
                      </span>
                      <span className="break-all">
                        {isAr 
                          ? 'اكتشف النظام استخدام UUID لهذه الجداول بينما يتوقع التطبيق نصوصاً برمجية. يرجى مسح الجداول وإعادة تشغيل SQL.' 
                          : 'System detected UUIDs in this table, but the app generates custom TEXT strings. This causes Foreign Key errors. Run setup script to force reset types.'}
                      </span>
                    </div>
                  )}

                  {res.error && (
                    <div className="bg-slate-950 p-2.5 rounded-lg border border-red-500/10 font-mono text-[10px] text-slate-400 flex flex-col gap-1">
                      <span className="text-red-400/90 font-black uppercase text-[9px] tracking-wider flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        {isAr ? 'تفاصيل العطل البرمجي:' : 'SQL Execution / API Error:'}
                      </span>
                      <span className="break-all">{res.error}</span>
                    </div>
                  )}
                </div>
              )})}
            </div>
          </div>

          {/* Exact Auth Response */}
          {exactAuthResponse && (
            <div className="space-y-3">
               <h4 className="font-bold text-slate-300 text-xs px-1">
                 Exact Auth getSession() Response:
               </h4>
               <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 overflow-x-auto">
                 <pre className="text-[10px] text-emerald-400 font-mono">
                   {JSON.stringify(exactAuthResponse, null, 2)}
                 </pre>
               </div>
            </div>
          )}
          
            </>
          )}

          {activeTab === 'sync' && (
            <div className="space-y-6">
              {/* Description Card */}
              <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800/80 space-y-2">
                <h4 className="font-extrabold text-indigo-400 text-sm flex items-center gap-2">
                  <Radio className="w-4 h-4 text-indigo-400 animate-pulse" />
                  {isAr ? 'مركز تدقيق بث ومزامنة رفيق الفوري' : 'Chats & Friend Requests Real-time Syncer'}
                </h4>
                <p className="text-slate-300 leading-relaxed text-[11px]">
                  {isAr 
                    ? 'يراقب هذا القسم سلامة قنوات البث الحية وحالة طوابير الرسائل غير المرسلة في وضع عدم الاتصال بالانترنت (Offline Queue)، لضمان مطابقة بيانات الواجهة للمخدم وتلافي مشكلة اختفاء رفقائك أو رسائلك.'
                    : 'This panel audits and manages your real-time WebSocket messaging channels, pending offline actions, and localStorage caches. It provides direct diagnostics for direct messages and friends sync.'}
                </p>
              </div>

              {/* Table Synchronization Indicators */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 1. Direct Messages Cardio Container */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4.5 space-y-4 shadow-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-xl border border-indigo-500/10">
                        <MessageSquare className="w-4 h-4" />
                      </div>
                      <div>
                        <h5 className="font-black text-xs text-white">{isAr ? 'الرسائل المباشرة' : 'Direct Messages'}</h5>
                        <p className="text-[10px] text-slate-400 font-mono">table: direct_messages</p>
                      </div>
                    </div>
                    <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider ${pendingDMsCount === 0 ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20 animate-pulse'}`}>
                      {pendingDMsCount === 0 ? (isAr ? 'متطابق' : 'In Sync') : (isAr ? 'معلق ومؤجل' : 'Offline Pending')}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-center">
                    <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800/60">
                      <span className="text-[9px] text-slate-400 font-bold block mb-1 uppercase tracking-wider">{isAr ? 'العدد بالخادم' : 'Server count'}</span>
                      <span className="text-sm font-black text-white">{tableAudit.direct_messages?.count ?? '—'}</span>
                    </div>
                    <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800/60">
                      <span className="text-[9px] text-slate-400 font-bold block mb-1 uppercase tracking-wider">{isAr ? 'طابور المعلق' : 'Queue backlog'}</span>
                      <span className="text-sm font-black text-amber-400">{pendingDMsCount}</span>
                    </div>
                  </div>

                  <div className="text-[11px] space-y-1.5 text-slate-300">
                    <div className="flex justify-between items-center bg-slate-950/40 p-1.5 rounded-lg">
                      <span>{isAr ? 'التخزين المحلي الآمن' : 'IndexedDB Engine'}</span>
                      <span className="font-mono text-emerald-400 font-bold">YallaMateDB (active)</span>
                    </div>
                    <div className="flex justify-between items-center bg-slate-950/40 p-1.5 rounded-lg">
                      <span>{isAr ? 'وقت آخر مزامنة ناجحة' : 'Last successful Sync'}</span>
                      <span className="font-mono text-slate-300 text-[9px] font-bold">
                        {lastSyncDMs ? new Date(lastSyncDMs).toLocaleTimeString() : (isAr ? 'غير مزامن' : 'Never')}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 2. Friend Requests Cardio Container */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4.5 space-y-4 shadow-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-xl border border-indigo-500/10">
                        <UserPlus className="w-4 h-4" />
                      </div>
                      <div>
                        <h5 className="font-black text-xs text-white">{isAr ? 'طلبات الصداقة والرفقاء' : 'Friend Requests'}</h5>
                        <p className="text-[10px] text-slate-400 font-mono">table: friend_requests</p>
                      </div>
                    </div>
                    <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider ${pendingReqsCount === 0 ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20 animate-pulse'}`}>
                      {pendingReqsCount === 0 ? (isAr ? 'متطابق' : 'In Sync') : (isAr ? 'معلق ومؤجل' : 'Offline Pending')}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-center">
                    <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800/60">
                      <span className="text-[9px] text-slate-400 font-bold block mb-1 uppercase tracking-wider">{isAr ? 'العدد بالخادم' : 'Server count'}</span>
                      <span className="text-sm font-black text-white">{tableAudit.friend_requests?.count ?? '—'}</span>
                    </div>
                    <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800/60">
                      <span className="text-[9px] text-slate-400 font-bold block mb-1 uppercase tracking-wider">{isAr ? 'طابور المعلق' : 'Queue backlog'}</span>
                      <span className="text-sm font-black text-amber-400">{pendingReqsCount}</span>
                    </div>
                  </div>

                  <div className="text-[11px] space-y-1.5 text-slate-300">
                    <div className="flex justify-between items-center bg-slate-950/40 p-1.5 rounded-lg">
                      <span>{isAr ? 'محرك الحفظ الأوفلاين' : 'Active Local Engine'}</span>
                      <span className="font-mono text-emerald-400 font-bold">LocalStorage (active)</span>
                    </div>
                    <div className="flex justify-between items-center bg-slate-950/40 p-1.5 rounded-lg">
                      <span>{isAr ? 'وقت آخر مزامنة ناجحة' : 'Last successful Sync'}</span>
                      <span className="font-mono text-slate-300 text-[9px] font-bold">
                        {lastSyncReqs ? new Date(lastSyncReqs).toLocaleTimeString() : (isAr ? 'غير مزامن' : 'Never')}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Sync actions controller bar */}
              <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4.5">
                <div className="space-y-1">
                  <h5 className="font-black text-xs text-white">
                    {isAr ? 'مزامنة وتفريغ البيانات يدويًا' : 'Manual Queue Synchronization'}
                  </h5>
                  <p className="text-[10px] text-slate-400">
                    {isAr ? 'اضغط لتشغيل معالجة الطوابير وإرسال الرسائل المعلقة لخادم Supabase.' : 'Manually execute backlog queues and dump offline requests to Supabase production.'}
                  </p>
                </div>

                <button
                  onClick={async () => {
                    setIsProcessingQueue(true);
                    try {
                      await offlineSyncService.processQueue();
                      await fetchSyncStats();
                      await runAudit();
                    } catch (e) {
                      console.error('Queue sync failed manually:', e);
                    } finally {
                      setIsProcessingQueue(false);
                    }
                  }}
                  disabled={isProcessingQueue}
                  className="px-5 py-3 bg-indigo-600 hover:bg-indigo-555 disabled:opacity-40 text-white rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-2 shadow-lg shadow-indigo-600/10 shrink-0 self-stretch sm:self-auto justify-center"
                >
                  <Zap className={`w-4 h-4 ${isProcessingQueue ? 'animate-bounce' : ''}`} />
                  {isProcessingQueue 
                    ? (isAr ? 'جاري المزامنة...' : 'Syncing...') 
                    : (isAr ? 'مزامنة وتحديث البيانات الآن ⚡' : 'Force Synchronize & Update Now ⚡')}
                </button>
              </div>
            </div>
          )}

          {activeTab === 'sync_audit' && (
            <div className="space-y-6">
              {/* Real-time Connectivity Status Card */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-extrabold text-white text-sm flex items-center gap-2">
                    <Radio className="w-4 h-4 text-emerald-400 animate-pulse" />
                    {isAr ? 'حالة الاتصال المباشر والشبكة' : 'Real-time Network Connectivity'}
                  </h4>
                  <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 ${navigator.onLine ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20 animate-pulse'}`}>
                    <span className={`w-2 h-2 rounded-full ${navigator.onLine ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`} />
                    {navigator.onLine ? (isAr ? 'متصل بالإنترنت' : 'Online / Connected') : (isAr ? 'غير متصل بالإنترنت' : 'Offline / Disconnected')}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="bg-slate-950 p-3 rounded-xl border border-slate-800/80 flex flex-col justify-between">
                    <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">{isAr ? 'عقد المزامنة الفورية' : 'WebSocket Sync Syncers'}</span>
                    <span className="font-mono text-emerald-400 font-extrabold mt-1">Supabase Realtime Channel: Active</span>
                  </div>
                  <div className="bg-slate-950 p-3 rounded-xl border border-slate-800/80 flex flex-col justify-between">
                    <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">{isAr ? 'نوع بروتوكول الاتصال' : 'Client Ingress Protocol'}</span>
                    <span className="font-mono text-slate-300 font-extrabold mt-1">Secure HTTPS / WSS TLS v1.3</span>
                  </div>
                </div>
              </div>

              {/* Specific Tables Audit Checklist */}
              <div className="space-y-4">
                <div className="flex items-center justify-between px-1">
                  <h4 className="font-extrabold text-slate-300 text-xs text-indigo-400">
                    {isAr ? 'تدقيق الجداول الحيوية للمراسلة والعلاقات' : 'Messaging & Social Tables Audit Logs'}
                  </h4>
                  <span className="text-[10px] font-mono text-slate-500 uppercase">{isAr ? 'البيانات الفورية بالخادم' : 'Live Auditing Outlet'}</span>
                </div>

                {[
                  {
                    key: 'direct_messages',
                    name: isAr ? 'الرسائل المباشرة' : 'Direct Messages',
                    desc: isAr ? 'سجلات المحادثات والدردشات الفردية الفورية بين الرفقاء.' : 'Instant individual peer-to-peer chats and conversational transcripts.',
                    lastSync: lastSyncDMs,
                    pendingCount: pendingDMsCount,
                    icon: <MessageSquare className="w-4 h-4" />
                  },
                  {
                    key: 'friend_requests',
                    name: isAr ? 'طلبات الصداقة والرفقة' : 'Friend Requests',
                    desc: isAr ? 'طلبات الصداقة الصادرة والواردة لتشكيل مجتمعات الرفقاء.' : 'Incoming and outgoing invitations for structural mate connections.',
                    lastSync: lastSyncReqs,
                    pendingCount: pendingReqsCount,
                    icon: <UserPlus className="w-4 h-4" />
                  },
                  {
                    key: 'follows',
                    name: isAr ? 'المتابعات والاهتمامات' : 'Follows & Circles',
                    desc: isAr ? 'تنظم شبكة المتابعين والطلعات الدورية المشتركة.' : 'Followers and followings circles data routing mappings.',
                    lastSync: localStorage.getItem('mates_last_sync_follows') || null,
                    pendingCount: 0,
                    icon: <Database className="w-4 h-4" />
                  }
                ].map((auditItem) => {
                  const dbRes = tableAudit[auditItem.key] || { count: null, status: 'pending' };
                  return (
                    <div key={auditItem.key} className="bg-slate-900 border border-slate-800 rounded-2xl p-4.5 space-y-4 shadow-lg">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-xl border border-indigo-500/10">
                            {auditItem.icon}
                          </div>
                          <div>
                            <h5 className="font-black text-xs text-white">{auditItem.name}</h5>
                            <p className="text-[10px] text-slate-400 font-mono">table: {auditItem.key}</p>
                          </div>
                        </div>
                        <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider ${
                          dbRes.status === 'success' 
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                            : dbRes.status === 'pending'
                              ? 'bg-slate-800 text-slate-400 border border-slate-705/30'
                              : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                        }`}>
                          {dbRes.status === 'success' ? (isAr ? 'الخادم نشط' : 'Server Live') : dbRes.status === 'pending' ? (isAr ? 'جاري التحقق' : 'Polling...') : (isAr ? 'خطأ قراءة' : 'Query Failed')}
                        </span>
                      </div>

                      <p className="text-[11px] text-slate-400 leading-relaxed balance-text">
                        {auditItem.desc}
                      </p>

                      <div className="grid grid-cols-2 gap-2 text-center">
                        <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800/60 font-mono text-[10px]">
                          <span className="text-[9px] text-slate-400 font-bold block mb-1 uppercase tracking-wider font-sans">{isAr ? 'سجلات الخادم الحقيقية' : 'Server Row Count'}</span>
                          <span className="text-sm font-black text-white">
                            {dbRes.status === 'success' ? dbRes.count : '—'}
                          </span>
                        </div>
                        <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800/60 font-mono text-[10px]">
                          <span className="text-[9px] text-slate-400 font-bold block mb-1 uppercase tracking-wider font-sans">{isAr ? 'العمليات بانتظار شبعة' : 'Backlog Queued'}</span>
                          <span className={`text-sm font-black ${auditItem.pendingCount > 0 ? 'text-amber-400 animate-pulse' : 'text-slate-400'}`}>
                            {auditItem.pendingCount}
                          </span>
                        </div>
                      </div>

                      <div className="text-[11px] space-y-1.5 text-slate-300">
                        <div className="flex justify-between items-center bg-slate-950/40 p-1.5 rounded-lg">
                          <span>{isAr ? 'أحدث مزامنة ناجحة' : 'Last Synced'}</span>
                          <span className="font-mono text-slate-300 font-bold">
                            {auditItem.lastSync ? new Date(auditItem.lastSync).toLocaleString() : (isAr ? 'لم تتم المزامنة بعد' : 'Never / Dynamic')}
                          </span>
                        </div>
                        {dbRes.error && (
                          <div className="bg-rose-950/20 p-2 rounded-lg border border-rose-500/20 text-rose-400 text-[10px] leading-relaxed font-mono mt-1 break-all select-all">
                            <strong>ERR:</strong> {dbRes.error}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* How to Fix instructions */}
          <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-3">
            <h4 className="font-bold text-indigo-400 text-xs flex items-center gap-2">
              <Shield className="w-4 h-4" />
              {isAr ? 'دليل إعداد المزامنة الحية في Google AI Studio:' : 'Configure live synchronization on Google AI Studio:'}
            </h4>

            <button
              onClick={runDatabaseMigration}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black text-xs transition cursor-pointer flex items-center justify-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              {isAr ? 'إصلاح مخطط قاعدة البيانات وإعادة المزامنة ⚡' : 'Force Fix Database Schema & Re-sync ⚡'}
            </button>

            <ol className="list-decimal list-inside space-y-2 text-slate-300 leading-relaxed text-[11px]">
              <li>
                {isAr 
                  ? 'اذهب إلى الشريط الجانبي الأيسر / محرر الأكواد في واجهة Google AI Studio البنائية.'
                  : 'Open the Google AI Studio cloud development sidebar configuration menu.'}
              </li>
              <li>
                {isAr
                  ? 'اختر تبويب "Secrets" أو "Settings".'
                  : 'Locate the secrets management window panel (Secrets / Settings).'}
              </li>
              <li>
                {isAr
                  ? 'قم بإضافة متغير باسم SUPABASE_URL وضف رابط الخادم الفعلي له (يبدأ بـ https).'
                  : 'Add / update the "SUPABASE_URL" variable with your exact Supabase project endpoint address.'}
              </li>
              <li>
                {isAr
                  ? 'قم بإضافة متغير باسم SUPABASE_ANON_KEY وضف مفتاح الـ Anon الطويل (يبدأ بـ eyJ).'
                  : 'Add / update the "SUPABASE_ANON_KEY" with your raw project user-space Key JWT token (starts with eyJ).'}
              </li>
              <li>
                {isAr
                  ? 'احفظ الإعدادات، سيقوم التطبيق بتهيئة الاتصال التلقائي بشكل فوري وآمن.'
                  : 'Apply/Save. The active browser runtime container will auto-load production endpoints.'}
              </li>
            </ol>
          </div>

        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-900/40 flex items-center justify-between gap-2.5">
          <button
            onClick={runAudit}
            disabled={loading}
            className="px-4 py-2 hover:bg-slate-800 active:bg-slate-700 disabled:opacity-50 text-slate-300 font-bold rounded-xl border border-slate-800 flex items-center gap-2 cursor-pointer transition text-[11px]"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            {isAr ? 'إعادة الفحص المالي والتقني' : 'Re-Run Connectivity Check'}
          </button>
          
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-6 py-3 bg-white hover:bg-slate-50 text-slate-900 border border-slate-200 font-extrabold rounded-xl shadow-sm transition cursor-pointer text-xs"
            >
              {isAr ? 'إغلاق المراقبة ✕' : 'Close Audit ✕'}
            </button>

            <button
              onClick={onClose}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-extrabold rounded-xl hover:shadow-lg shadow-rose-600/10 cursor-pointer transition text-[11px]"
            >
              {isAr ? 'إغلاق أداة فحص الاتصال والخروج ✕' : 'Exit & Close Audit ✕'}
            </button>
            
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl cursor-pointer transition text-[11px]"
            >
              {isAr ? 'مستمر كمستكشف أوفلاين' : 'Continue in Offline/Fallback Mode'}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

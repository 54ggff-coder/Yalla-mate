import React, { useState, useEffect, useRef } from 'react';
import { haptic } from './lib/haptics';
import { supabase } from './lib/supabase';
import { getPendingMessages, clearPendingMessages, getCachedOutings, saveOutingsToCache, getCachedReels, saveReelsToCache } from './services/db';
import { auth } from './lib/firebase';
import { onAuthStateChanged, signOut as fbSignOut } from 'firebase/auth';
import { reelsLikesService } from './services/reelsLikesService';
import { FriendshipManager } from './services/friendshipManager';
import { SocialService } from './services/socialService';
import { toUUID } from './utils/uuid';
import { analytics } from './services/analyticsService';
import { initSentry, captureException, startTransaction } from './lib/sentry';
import { Profile, Outing, Message, OutingReview, AppNotification, Reel, PendingOperation } from './types';
import { useLocation } from './contexts/LocationContext';
import { APIProvider } from '@vis.gl/react-google-maps';
import SocialHub from './components/SocialHub';
import RegisterFlow from './components/RegisterFlow';
import Dashboard from './components/Dashboard';
import HomeView from './components/HomeView';
import ExploreView from './components/ExploreView';
import ProfileMoreView from './components/ProfileMoreView';
import BottomNavigation from './components/BottomNavigation';
import OutingCreator from './components/OutingCreator';
import OutingDetails from './components/OutingDetails';
import MatesReels from './components/MatesReels';
import CommunityView from './components/CommunityView';
import ProfileEditor from './components/ProfileEditor';
import UserProfileModal from './components/UserProfileModal';
import NotificationsModal from './components/NotificationsModal';
import GlobalActionToast from './components/GlobalActionToast';
import ReelsUploader from './components/ReelsUploader';
import DirectMessageView from './components/DirectMessageView';
import ModernSocialFeed from './components/ModernSocialFeed';
import UnifiedSearch from './components/UnifiedSearch';
import CityGuide from './components/CityGuide';
import SupabaseDiagnostics from './components/SupabaseDiagnostics';
import LocationDiagnostics from './components/LocationDiagnostics';
import { robustSelect, validateOutingRlsPolicies } from './lib/supabaseUtils';
import { offlineSyncService } from './services/offlineSyncService';
import OfflineSyncBar from './components/OfflineSyncBar';
import { motion, AnimatePresence } from 'motion/react';
import { Compass, Sparkles, LogOut, Award, ShieldAlert, Heart, Calendar, Settings, ArrowLeft, Search, MessageSquare, Bell, Phone, AlertTriangle, X, Brain, Bot, Terminal } from 'lucide-react';
import { translations, Language } from './data/translations';
import MurshedAIControl from './components/MurshedAIControl';
import AIChatModal from './components/AIChatModal';
import AIDeveloperConsole from './components/AIDeveloperConsole';


initSentry();
analytics.init();

/**
 * @license
 * Copyright (c) 2026 Ali Fouad Al-Khidir Salem (علي فؤاد الخضر سالم). All rights reserved.
 * Protected Code Authorization Token: Aa19981994@
 */
















enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

function handleFirestoreError(e: any, op: OperationType, path: string) {
  console.error(`Supabase Error during ${op} on ${path}:`, e);
  captureException(e, { operation: op, path });
  const errMsg = e?.message || String(e);
  window.dispatchEvent(new CustomEvent('db_transaction_error', {
    detail: { op, path, error: errMsg }
  }));
}

function sanitizeProfileForDb(profile: any): any {
  if (!profile) return profile;
  const clone = { ...profile };
  
  if (typeof clone.trustScore === 'number') {
    clone.trustScore = Math.round(clone.trustScore);
  }
  return clone;
}

function sanitizeOutingForDb(outing: any): any {
  if (!outing) return outing;
  // Deep clone and clean
  const clean: any = {};
  Object.keys(outing).forEach(key => {
    // Skip new local fields that cause Supabase sync errors if schema is out of date
    if (['isSoloOuting', 'aiItinerarySteps', 'currentStepIndex', 'budgetEstimate'].includes(key)) {
      return;
    }
    const val = outing[key];
    if (val !== undefined && val !== null) {
      if (key === 'creatorTrust' || key === 'minTrustScore') {
        clean[key] = typeof val === 'number' ? Math.round(val * 10) / 10 : val;
      } else {
        clean[key] = val;
      }
    }
  });
  return clean;
}

// --------------------------------------------------------------------------------
// DATABASE SYNC HELPERS (Centralized to handle RLS and type issues gracefully)
// --------------------------------------------------------------------------------

const verifyDatabaseIntegrity = async () => {
  if (!supabase) return { ok: true, errors: [] };
  
  const tablesToCheck = [
    {
      name: 'users',
      cols: ['id', 'name', 'username', 'displayName', 'trustScore', 'onboarding_completed', 'gender']
    },
    {
      name: 'outings',
      cols: ['id', 'title', 'description', 'category', 'location', 'city', 'datetime', 'creatorId', 'creatorName', 'creatorAvatar', 'creatorTrust', 'maxAttendees', 'attendeeIds', 'minTrustScore', 'status', 'logistics', 'coverImage', 'genderRestriction', 'mapCoordinates', 'mapLocationUrl', 'isBlindOuting', 'isPrivate', 'invitedUserIds']
    },
    {
      name: 'reels',
      cols: ['id', 'owner_id', 'video_url', 'caption', 'creator_id', 'creatorId', 'creatorName', 'creatorAvatar', 'likes_count', 'comments_count', 'outing_id', 'created_at']
    },
    {
      name: 'reels_likes',
      cols: ['id', 'user_id', 'reel_id', 'created_at']
    },
    {
      name: 'reels_comments',
      cols: ['id', 'user_id', 'reel_id', 'content', 'created_at']
    },
    {
      name: 'direct_messages',
      cols: ['id', 'outingId', 'chatId', 'senderId', 'senderName', 'senderAvatar', 'content', 'timestamp', 'isSystem', 'imageUrl', 'locationUrl', 'read', 'isPinned', 'voiceUrl', 'audioDuration']
    },
    {
      name: 'friend_requests',
      cols: ['id', 'senderId', 'receiverId', 'status', 'senderName', 'senderAvatar', 'timestamp']
    },
    {
      name: 'follows',
      cols: ['id', 'follower_id', 'following_id', 'created_at']
    },
    {
      name: 'place_reviews',
      cols: ['id', 'placeId', 'authorId', 'author', 'avatar', 'rating', 'comment', 'timestamp']
    },
    {
      name: 'outing_participants',
      cols: ['id', 'outing_id', 'user_id', 'role', 'status', 'joined_at']
    },
    {
      name: 'outing_invites',
      cols: ['id', 'outing_id', 'inviter_id', 'invitee_id', 'status', 'created_at']
    },
    {
      name: 'outing_messages',
      cols: ['id', 'outing_id', 'sender_id', 'content', 'is_system', 'created_at']
    },
    {
      name: 'outing_locations',
      cols: ['id', 'outing_id', 'latitude', 'longitude', 'address', 'name', 'created_at']
    }
  ];

  const errors: string[] = [];
  
  for (const tableConfig of tablesToCheck) {
    try {
      const formattedCols = tableConfig.cols.map(col => {
        if (/[A-Z]/.test(col) && !col.startsWith('"')) {
          return `"${col}"`;
        }
        return col;
      });
      const selectStr = formattedCols.join(', ');
      const { error } = await supabase
        .from(tableConfig.name)
        .select(selectStr)
        .limit(0);
        
      if (error) {
        console.error(`[DB-Check-Failure] Table: ${tableConfig.name} - Error details:`, error);
        if (error.code === '42P01') {
          errors.push(`جدول مفقود (Missing Table): ${tableConfig.name}`);
        } else if (error.code === '42703' || error.message?.includes('column') || error.message?.includes('does not exist')) {
          errors.push(`حقل مفقود (Missing Column) في [${tableConfig.name}]: ${error.message}`);
        } else {
          errors.push(`خطأ في جدول (Error in ${tableConfig.name}): ${error.message}`);
        }
      }
    } catch (e: any) {
      console.error(`[DB-Check-Error] Fatal exception during check on ${tableConfig.name}:`, e);
      errors.push(`خطأ استثنائي في جدول [${tableConfig.name}]: ${e.message || String(e)}`);
    }
  }
  
  return {
    ok: errors.length === 0,
    errors
  };
};

const syncProfileToDb = async (profile: any) => {
  if (!supabase || !profile || !profile.id) return;
  
  try {
    const { error } = await supabase
      .from('users')
      .upsert([sanitizeProfileForDb(profile)]);
    
    if (error) {
       console.error('[Sync-Core] Profile sync error details:', {
         message: error.message,
         hint: error.hint,
         details: error.details,
         code: error.code,
         input: JSON.stringify(profile, null, 2)
       });
       console.error('[Sync-Core] Full Error Object:', JSON.stringify(error, null, 2));
       if (error.message.includes('row-level security')) {
         console.warn('[Sync-Core] RLS Policy detected. Sync paused. Profile stored locally.');
       } else if (error.code === '42P01') {
         console.warn('[Sync-Core] Table "users" missing. Profile stored locally.');
       }
       return false;
    }
    console.info('[Sync-Core] Profile successfully synced to Supabase.');
    return true;
  } catch (e) {
    console.error('[Sync-Core] Fatal sync error:', e);
    return false;
  }
};



































export default function App() {
  const [googleMapsKey, setGoogleMapsKey] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/maps/config')
      .then(res => res.json())
      .then(data => {
        if (data.apiKey) setGoogleMapsKey(data.apiKey);
      })
      .catch(err => console.error('Failed to load map config:', err));
  }, []);

  return googleMapsKey ? (
    <APIProvider apiKey={googleMapsKey}>
      <AppContent />
    </APIProvider>
  ) : (
    <AppContent />
  );
}

function AppContent() {
  const [lang, setLang] = useState<Language>(() => {
    return (localStorage.getItem('yallamate_lang') as Language) || 'ar';
  });

  const handleToggleLang = async () => {
    const newLang = lang === 'ar' ? 'en' : 'ar';
    setLang(newLang);
    localStorage.setItem('yallamate_lang', newLang);
    if (currentUser) {
      const updatedUser: Profile = { ...currentUser, preferred_lang: newLang };
      setCurrentUser(updatedUser);
      localStorage.setItem('yallamate_current_user', JSON.stringify(updatedUser));
    }
  };
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('yallamate_theme');
    if (saved === 'dark' || saved === 'light') return saved;
    // Check system preference
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark';
    return 'light';
  });
  
  useEffect(() => {
    localStorage.setItem('yallamate_theme', theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  const [lowPowerMode, setLowPowerMode] = useState(() => {
    return localStorage.getItem('yallamate_low_power_mode') === 'true';
  });

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
    return () => {
      window.removeEventListener('yallamate_low_power_mode_change', handleLowPowerChange);
    };
  }, []);

  const t = translations[lang];

  const [currentUser, setCurrentUser] = useState<Profile | null>(null);

  useEffect(() => {
    const handleProfileSync = (e: Event) => {
      const customEvent = e as CustomEvent<Partial<Profile>>;
      if (customEvent.detail && currentUser) {
        setCurrentUser(prev => prev ? { ...prev, ...customEvent.detail } : null);
        setProfiles(prev => prev.map(p => p.id === currentUser.id ? { ...p, ...customEvent.detail } : p));
      }
    };
    window.addEventListener('yallamate_user_sync', handleProfileSync);
    return () => {
      window.removeEventListener('yallamate_user_sync', handleProfileSync);
    };
  }, [currentUser]);

  const [isInitializingAuth, setIsInitializingAuth] = useState(true);
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const [outings, setOutings] = useState<Outing[]>([]);

  // Handle Deep Linking on mount/outings load
  const processedDeepLinkRef = useRef(false);
  useEffect(() => {
    if (outings && outings.length > 0 && !processedDeepLinkRef.current) {
      const params = new URLSearchParams(window.location.search);
      const urlOutingId = params.get('outingId');
      if (urlOutingId) {
        const found = outings.find(o => o.id === urlOutingId);
        if (found) {
          processedDeepLinkRef.current = true;
          setModalState('selected_outing', true, urlOutingId);
          // Clean the query parameter from url
          const url = new URL(window.location.href);
          url.searchParams.delete('outingId');
          window.history.replaceState({}, '', url.toString());
        }
      }
    }
  }, [outings]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [emailVerified, setEmailVerified] = useState<boolean>(false);
  const [companionReviews, setCompanionReviews] = useState<OutingReview[]>(() => {
    try {
      const saved = localStorage.getItem('yallamate_companion_reviews');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [reels, setReels] = useState<any[]>([]);

  useEffect(() => {
    const loadCachedData = async () => {
      try {
        const cachedOutings = await getCachedOutings();
        if (cachedOutings && cachedOutings.length > 0) {
          setOutings(cachedOutings as Outing[]);
        }
        const cachedReels = await getCachedReels();
        if (cachedReels && cachedReels.length > 0) {
          setReels(cachedReels);
        }
      } catch(e) {
        console.error("Failed to load cached data:", e);
      }
    };
    loadCachedData();
  }, []);
  const [friendsList, setFriendsList] = useState<string[]>([]); 
  const [modalStack, setModalStack] = useState<string[]>([]);
  
  const [isEditingProfile, setIsEditingProfile] = useState(false);

  React.useEffect(() => {
    const handleForceVerify = () => {
      setEmailVerified(true);
    };
    window.addEventListener('yallamate_force_verify', handleForceVerify);
    return () => window.removeEventListener('yallamate_force_verify', handleForceVerify);
  }, []);

  // Social / Viewing State
  const [viewingProfileId, setViewingProfileId] = useState<string | null>(null);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showCityGuide, setShowCityGuide] = useState(false);
  const [showMurshedAI, setShowMurshedAI] = useState(false);
  const [appNotifications, setAppNotifications] = useState<AppNotification[]>(() => {
    try {
      const saved = localStorage.getItem('yallamate_app_notifications');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem('yallamate_app_notifications', JSON.stringify(appNotifications.slice(0, 50)));
  }, [appNotifications]);
  const [unreadMessagesCount, setUnreadMessagesCount] = useState(0);

  // Keep track of which outings have already triggered a 30-min preparation alert
  const [alertedOutingIds, setAlertedOutingIds] = useState<string[]>(() => {
    try {
      const cached = localStorage.getItem('ym_alerted_outing_prep');
      return cached ? JSON.parse(cached) : [];
    } catch (e) {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem('ym_alerted_outing_prep', JSON.stringify(alertedOutingIds));
  }, [alertedOutingIds]);

  // Sync Functions lifted to component scope
  const fetchFollows = async () => {
    if (!currentUser?.id) return;
    try {
      let following_ids: string[] = [];
      let follower_ids: string[] = [];
      let counts = { following: 0, followers: 0, friends: 0 };

      const { data, error } = await supabase.rpc('get_friendship_data', { 
        p_user_id: currentUser.id 
      });
      
      if (!error && data) {
        following_ids = data.following_ids || [];
        follower_ids = data.follower_ids || [];
        counts = data.counts || counts;
      } else {
         const { data: reqs } = await supabase.from('friend_requests').select('senderId, receiverId').eq('status', 'accepted').or(`senderId.eq.${currentUser.id},receiverId.eq.${currentUser.id}`);
         if (reqs) {
            const uniqueFriendIds = Array.from(new Set(reqs.map(r => r.senderId === currentUser.id ? r.receiverId : r.senderId)));
            counts.friends = uniqueFriendIds.length;
         }
         const { data: follows } = await supabase.from('follows').select('follower_id, following_id').or(`follower_id.eq.${currentUser.id},following_id.eq.${currentUser.id}`);
         if (follows) {
            following_ids = Array.from(new Set(follows.filter(f => f.follower_id === currentUser.id).map(f => f.following_id)));
            follower_ids = Array.from(new Set(follows.filter(f => f.following_id === currentUser.id).map(f => f.follower_id)));
            counts.following = following_ids.length;
            counts.followers = follower_ids.length;
         }
      }

      setCurrentUser(prev => {
        if (!prev) return prev;
        const updated = { 
          ...prev, 
          following: following_ids || [], 
          followers: follower_ids || [],
          followingCount: counts?.following || 0,
          followersCount: counts?.followers || 0,
          friendsCount: counts?.friends || 0
        };
        if (JSON.stringify(prev.following) === JSON.stringify(updated.following) && 
            JSON.stringify(prev.followers) === JSON.stringify(updated.followers) &&
            prev.followingCount === updated.followingCount) return prev;
        localStorage.setItem('yallamate_current_user', JSON.stringify(updated));
        return updated;
      });
    } catch (err) {
      console.error('[Central Sync] RPC friendship data failed:', err);
    }
  };

  const fetchUnreadCounts = async () => {
    if (!currentUser?.id || !supabase) return;
    try {
      const { data, error } = await supabase.rpc('get_unread_counts', { 
        p_user_id: currentUser.id 
      });
      if (!error && data) {
        setUnreadMessagesCount(data.unread_messages || 0);
      }
    } catch (e) {}
  };

  // Transactional UI: Pending operations for robust optimistic updates
  const [pendingOps, setPendingOps] = useState<PendingOperation[]>(() => {
    try {
      const saved = localStorage.getItem('yallamate_pending_operations');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  useEffect(() => {
    localStorage.setItem('yallamate_pending_operations', JSON.stringify(pendingOps));
  }, [pendingOps]);

  // Real-time peer-to-peer presence system using Supabase Channel Presence
  useEffect(() => {
    if (!supabase || !currentUser?.id) return;

    console.log('[Presence] Configuring presence channel sub for user:', currentUser.id);
    const channel = supabase.channel('user_presence_track', {
      config: {
        presence: {
          key: currentUser.id,
        },
      },
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const onlineIds = new Set<string>();
        Object.keys(state).forEach((key) => {
          onlineIds.add(key);
        });
        setOnlineUsers(onlineIds);
        console.log('[Presence] Sync: count of active users:', onlineIds.size);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          const statusTrack = await channel.track({
            user_id: currentUser.id,
            online_at: new Date().toISOString(),
          });
          console.log('[Presence] Track status:', statusTrack);
        }
      });

    return () => {
      console.log('[Presence] Unsubscribing channel');
      channel.unsubscribe();
    };
  }, [currentUser?.id]);

  const executeTransactionalOp = async (
    type: PendingOperation['type'],
    tableName: string,
    payload: any,
    operation: () => Promise<{ error: any }>
  ) => {
    const opId = `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const newOp: PendingOperation = {
      id: opId,
      type,
      payload,
      tableName,
      timestamp: new Date().toISOString(),
      retryCount: 0
    };

    setPendingOps(prev => [...prev, newOp]);

    try {
      const { error } = await operation();
      if (error) throw error;
      
      setPendingOps(prev => prev.filter(op => op.id !== opId));

      // Centralized tactical haptic feedback on successful transaction completion
      try {
        const typeStr = type as string;
        if (typeStr === 'message') {
          haptic(35); // quick crisp sending tap
        } else if (typeStr === 'profile' || typeStr === 'settings') {
          haptic([40, 60, 40]); // smooth positive confirmation
        } else {
          haptic(20); // standard light completion tap
        }
      } catch (errh) {
        console.warn('Centralized transaction haptic failed:', errh);
      }

      return { success: true };
    } catch (err: any) {
      console.error(`[Transactional UI] ${type} on ${tableName} failed:`, err);
      
      const status = err.status || err.code;
      const isError = typeof status === 'number' ? (status >= 400) : true;
      
      if (isError) {
        triggerNotification(
          lang === 'ar' ? 'فشلت العملية. جارٍ التراجع...' : 'Operation failed. Rolling back...',
          lang === 'ar' ? 'حدث خطأ في الاتصال بالسيرفر (UI Rollback triggered)' : 'Network or Server error (UI Rollback triggered)',
          'warning'
        );
      }
      
      setPendingOps(prev => prev.filter(op => op.id !== opId));
      return { success: false, error: err };
    };
  };

  // Page navigator state
  const [currentTab, setCurrentTab] = useState<'home' | 'explore' | 'create' | 'reels' | 'profile' | 'messages' | 'social_feed' | 'community'>('home');

  useEffect(() => {
    const transaction = startTransaction(`Navigate: ${currentTab}`, 'ui.navigation');
    return () => {
      transaction.finish();
    };
  }, [currentTab]);

  const [reelsSubTab, setReelsSubTab] = useState<'reels' | 'community' | 'discover'>('reels');
  const [showDirectMessages, setShowDirectMessages] = useState(false);
  const [showSocialHub, setShowSocialHub] = useState(false);
  const [targetDmProfile, setTargetDmProfile] = useState<Profile | null>(null);
  const [isPostingReel, setIsPostingReel] = useState(false);
  const [selectedOutingId, setSelectedOutingId] = useState<string | null>(null);
  const [leaveOutingConfirmId, setLeaveOutingConfirmId] = useState<string | null>(null);
  const [isCreatingOuting, setIsCreatingOuting] = useState<boolean>(false);
  const [showSupabaseDiagnostics, setShowSupabaseDiagnostics] = useState(false);
  const [showLocationDiagnostics, setShowLocationDiagnostics] = useState(false);
  const [showAIChat, setShowAIChat] = useState(false);
  const [showDevConsole, setShowDevConsole] = useState(false);
  const [showNavDebugPanel, setShowNavDebugPanel] = useState(false);
  const [dbCompletenessErrors, setDbCompletenessErrors] = useState<string[]>([]);
  const [dbCheckHasRun, setDbCheckHasRun] = useState(false);
  const [outingErrorModal, setOutingErrorModal] = useState<{
    isOpen: boolean;
    errorType: string;
    errorMessage: string;
    errorCode: string;
    errorHint: string;
    errorDetails: string;
    sqlSolution: string;
    payloadDump: string;
  } | null>(null);
  const { coords: userCoordinates, address: userAddress, loading: locationLoading, error: locationError, setProfileCity } = useLocation();

  // Keep the LocationContext updated with the user's profile city (debounced)
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (currentUser) {
        const newCity = currentUser.city || currentUser.location;
        // Optimization: only set if actually changing (if useLocation had a getter, but here just debounce is good)
        setProfileCity(newCity);
      } else {
        setProfileCity(null);
      }
    }, 30000); // 30 seconds debounce

    return () => clearTimeout(timeoutId);
  }, [currentUser?.city, currentUser?.location, setProfileCity]);

  // Dynamically update currentUser's location session stats from real-time LocationContext GPS info
  useEffect(() => {
    if (!currentUser || !userCoordinates) return;
    
    const formattedLocation = userAddress 
      ? `${userAddress.city || (lang === 'ar' ? 'موقفك الحالي' : 'Current Location')}${userAddress.district ? ', ' + userAddress.district : ''}`
      : (currentUser.location || (lang === 'ar' ? 'موقعك' : 'Current Location'));

    const formattedCity = userAddress?.city || currentUser.city || (lang === 'ar' ? 'المدينة الحالية' : 'Current City');

    const needsUpdate = 
      !currentUser.preferences?.exactLat || 
      currentUser.preferences?.exactLat !== userCoordinates[0] ||
      currentUser.preferences?.exactLng !== userCoordinates[1] ||
      currentUser.location !== formattedLocation ||
      currentUser.city !== formattedCity;

    if (needsUpdate) {
      const updatedUser = {
        ...currentUser,
        location: formattedLocation,
        city: formattedCity,
        preferences: {
          ...(currentUser.preferences || {}),
          exactLat: userCoordinates[0],
          exactLng: userCoordinates[1],
          district: userAddress?.district,
          country: userAddress?.country
        }
      };
      
      setCurrentUser(updatedUser);
      localStorage.setItem('yallamate_current_user', JSON.stringify(updatedUser));

      if (supabase && currentUser.onboarding_completed) {
        supabase.from('users').update({
          location: formattedLocation,
          city: formattedCity,
          preferences: updatedUser.preferences
        }).eq('id', currentUser.id).then(({ error }) => {
          if (error) {
            console.warn('Silently syncing location to users failed:', error.message);
          }
        });
      }
    }
  }, [currentUser?.id, userCoordinates, userAddress]);

  const dmUnsentContentRef = useRef<boolean>(false);

  // Universal Navigation & Options undo/back history engine
  const [navHistory, setNavHistory] = useState<{
    currentTab: 'home' | 'explore' | 'create' | 'reels' | 'profile' | 'messages' | 'social_feed';
    reelsSubTab: 'reels' | 'community' | 'discover';
    selectedOutingId: string | null;
    isCreatingOuting: boolean;
    viewingProfileId: string | null;
    isEditingProfile: boolean;
    isPostingReel: boolean;
    showNotifications: boolean;
    showCityGuide: boolean;
    showDirectMessages: boolean;
    showSocialHub: boolean;
    modalStack: string[];
  }[]>([]);
  const [blockHistoryPush, setBlockHistoryPush] = useState(false);
  const blockHistoryPushRef = useRef(false);
  const popstateTriggeredByAppBackRef = useRef(false);
  const isNavigatingBackRef = useRef(false);

  const prevStatesRef = useRef({
    currentTab: 'home' as any,
    reelsSubTab: 'reels' as any,
    selectedOutingId: null as string | null,
    isCreatingOuting: false,
    viewingProfileId: null as string | null,
    isEditingProfile: false,
    isPostingReel: false,
    showNotifications: false,
    showCityGuide: false,
    showDirectMessages: false,
    showSocialHub: false,
    modalStack: [] as string[],
  });

  // Track state transitions to allow going back automatically from ANY choice/option
  useEffect(() => {
    console.log('Navigation Event:', {
      navHistoryLength: navHistory.length,
      currentTab,
      modalStack,
      showDirectMessages,
      showNotifications,
      viewingProfileId
    });
  }, [navHistory, currentTab, modalStack, showDirectMessages, showNotifications, viewingProfileId]);

  useEffect(() => {
    if (blockHistoryPush || blockHistoryPushRef.current) {
      setBlockHistoryPush(false);
      blockHistoryPushRef.current = false;
      prevStatesRef.current = {
        currentTab,
        reelsSubTab,
        selectedOutingId,
        isCreatingOuting,
        viewingProfileId,
        isEditingProfile,
        isPostingReel,
        showNotifications,
        showCityGuide,
        showDirectMessages,
        showSocialHub,
        modalStack: [...modalStack],
      };
      return;
    }

    const prev = prevStatesRef.current;
    const changed = 
      prev.currentTab !== currentTab ||
      prev.reelsSubTab !== reelsSubTab ||
      prev.selectedOutingId !== selectedOutingId ||
      prev.isCreatingOuting !== isCreatingOuting ||
      prev.viewingProfileId !== viewingProfileId ||
      prev.isEditingProfile !== isEditingProfile ||
      prev.isPostingReel !== isPostingReel ||
      prev.showNotifications !== showNotifications ||
      prev.showCityGuide !== showCityGuide ||
      prev.showDirectMessages !== showDirectMessages ||
      prev.showSocialHub !== showSocialHub ||
      JSON.stringify(prev.modalStack) !== JSON.stringify(modalStack);
    
    if (changed) {
      // Ensure we don't push redundant history entries if only irrelevant fields changed
      // (Though here all tracked fields are relevant for navigation)
      setNavHistory(prevHist => {
        const nextState = [...prevHist, { ...prev }];
        if (nextState.length > 20) {
          console.log('[History Pruning] Triggered, current size:', nextState.length);
          let pruned = nextState.filter((state, idx, arr) => {
            if (idx === 0 || idx === arr.length - 1) return true;
            const previous = arr[idx - 1];
            const keysChanged = Object.keys(state).filter(k => 
              JSON.stringify(state[k as keyof typeof state]) !== JSON.stringify(previous[k as keyof typeof previous])
            );
            // Drop minor purely state-only updates to consolidate
            if (keysChanged.length === 1 && (keysChanged[0] === 'viewingProfileId' || keysChanged[0] === 'reelsSubTab')) return false;
            return true;
          });
          if (pruned.length > 25) {
            pruned = pruned.slice(pruned.length - 20);
          }
          return pruned;
        }
        return nextState;
      });
      
      // Push to window history so browser back button triggers our internal restoration
      window.history.pushState({ type: 'nav_drilldown' }, '', window.location.href);

      prevStatesRef.current = {
        currentTab,
        reelsSubTab,
        selectedOutingId,
        isCreatingOuting,
        viewingProfileId,
        isEditingProfile,
        isPostingReel,
        showNotifications,
        showCityGuide,
        showDirectMessages,
        showSocialHub,
        modalStack: [...modalStack],
      };
    }
  }, [currentTab, reelsSubTab, selectedOutingId, isCreatingOuting, viewingProfileId, isEditingProfile, isPostingReel, showNotifications, showCityGuide, showDirectMessages, showSocialHub, blockHistoryPush, modalStack]);

  const handleGlobalBack = (fallbackAction?: () => void) => {
    console.log('[App] handleGlobalBack called, navHistory length:', navHistory.length);
    isNavigatingBackRef.current = true;
    
    try {
      // Check for unsent DM drafts
      if (dmUnsentContentRef.current && showDirectMessages) {
        if (!window.confirm('You have an unsent draft. Are you sure you want to go back to the home screen?')) {
          console.log('[App] Back action blocked by user draft confirmation');
          // If prevented, we need to push the state back to keep the user in the DM view
          window.history.pushState(null, '', window.location.href);
          return;
        }
        dmUnsentContentRef.current = false; // Reset if user confirmed
      }

      // 1. Pop from history stack and restore previous state
      if (navHistory.length > 0) {
        let updatedHistory = [...navHistory];
        let last = updatedHistory.pop()!;

        // Explicitly remove duplicate history entries that are identical to the target state or each other
        while (updatedHistory.length > 0) {
          const next = updatedHistory[updatedHistory.length - 1];
          if (JSON.stringify(last) === JSON.stringify(next)) {
            last = updatedHistory.pop()!;
          } else {
            break;
          }
        }

        const currentStateStr = JSON.stringify(prevStatesRef.current);
        while (JSON.stringify(last) === currentStateStr && updatedHistory.length > 0) {
          last = updatedHistory.pop()!;
        }

        console.log('[App] Popping from navHistory:', last);
        setNavHistory(updatedHistory);
        setBlockHistoryPush(true);
        blockHistoryPushRef.current = true;
        
        setCurrentTab(last.currentTab);
        setReelsSubTab(last.reelsSubTab);
        setSelectedOutingId(last.selectedOutingId);
        setIsCreatingOuting(last.isCreatingOuting);
        setViewingProfileId(last.viewingProfileId);
        setIsEditingProfile(last.isEditingProfile);
        setIsPostingReel(last.isPostingReel);
        setShowNotifications(last.showNotifications);
        setShowCityGuide(last.showCityGuide);
        setShowDirectMessages(last.showDirectMessages);
        setShowSocialHub(last.showSocialHub);
        setModalStack(last.modalStack || []);
      } else if (fallbackAction) {
        console.log('[App] No navHistory, executing fallback');
        fallbackAction();
      } else {
        // SELF-HEALING FALLBACK: If we have an active modal but navHistory is empty,
        // manually clean up active layers starting with user profile modal or top stack item
        console.log('[App] No navHistory and no fallback. Self-healing active modals.');
        const topModal = modalStackRef.current[modalStackRef.current.length - 1];
        if (topModal) {
          setModalStack(prev => prev.filter(id => id !== topModal));
          switch (topModal) {
            case 'posting_reel': setIsPostingReel(false); break;
            case 'editing_profile': setIsEditingProfile(false); break;
            case 'social_hub': setShowSocialHub(false); break;
            case 'direct_messages': setShowDirectMessages(false); setTargetDmProfile(null); break;
            case 'supabase_diagnostics': setShowSupabaseDiagnostics(false); break;
            case 'location_diagnostics': setShowLocationDiagnostics(false); break;
            case 'viewing_profile': setViewingProfileId(null); break;
            case 'notifications': setShowNotifications(false); break;
            case 'city_guide': setShowCityGuide(false); break;
            case 'creating_outing': setIsCreatingOuting(false); break;
            case 'selected_outing': setSelectedOutingId(null); break;
          }
        } else {
          // Safe check for other common overlays
          if (viewingProfileIdRef.current) {
            setViewingProfileId(null);
          } else if (showDirectMessagesRef.current) {
            setShowDirectMessages(false);
            setTargetDmProfile(null);
          } else if (showNotificationsRef.current) {
            setShowNotifications(false);
          } else if (showSocialHubRef.current) {
            setShowSocialHub(false);
          } else if (isCreatingOutingRef.current) {
            setIsCreatingOuting(false);
          } else if (selectedOutingIdRef.current) {
            setSelectedOutingId(null);
          } else if (isEditingProfileRef.current) {
            setIsEditingProfile(false);
          } else if (isPostingReelRef.current) {
            setIsPostingReel(false);
          } else if (showCityGuideRef.current) {
            setShowCityGuide(false);
          }
        }
      }
    } finally {
      setTimeout(() => {
        isNavigatingBackRef.current = false;
      }, 50);
    }
  };

  const triggerBack = () => {
    console.log('[App] triggerBack called. Executing direct programmatic back navigation for iframe security rule bypass.');
    // Determine if we have any state that was pushed to window history
    const isDrillDown = 
      navHistory.length > 0 ||
      modalStack.length > 0 ||
      viewingProfileId !== null ||
      showNotifications ||
      showDirectMessages ||
      showSocialHub ||
      isCreatingOuting ||
      selectedOutingId !== null ||
      isEditingProfile ||
      isPostingReel;

    if (isDrillDown) {
      // Prioritize programmatic back state restoration to make it 100% responsive in sandboxed iframes
      popstateTriggeredByAppBackRef.current = true;
      handleGlobalBack();
      
      // Attempt browser popstate trigger so that the URL gets synchronized if supported by environment
      try {
        window.history.back();
      } catch (e) {
        console.warn('[App] window.history.back failed in iframe:', e);
      }
    } else if (showDirectMessages) {
       // Fallback for edge cases where history might be missing but view is open
       handleGlobalBack(() => setModalState('direct_messages', false));
    } else {
       handleGlobalBack();
    }
  };

  // Standardizer shared internal function to manage modal/overlay show/hide state
  const setModalState = (modalId: string, isOpen: boolean, extraData?: any) => {
    // REDUNDANCY CHECK: If we are already in the requested state for this modal, skip
    const isAlreadyOpen = modalStack.includes(modalId);
    if (isOpen && isAlreadyOpen) {
      if (modalId === 'direct_messages' && extraData) {
        setTargetDmProfile(extraData);
      } else if (modalId === 'viewing_profile' && extraData) {
        setViewingProfileId(extraData);
      } else if (modalId === 'selected_outing' && extraData) {
        setSelectedOutingId(extraData);
      }
      return;
    }
    if (isOpen === isAlreadyOpen) return;

    // Micro-animation indicator for modalStack updates
    const getIndicatorContext = document.getElementById('root') || document.body;
    const visualIndicator = document.createElement('div');
    visualIndicator.className = `fixed inset-0 z-[99999] pointer-events-none transition-all duration-300 border-[6px] ${isOpen ? 'border-indigo-500/20 shadow-[inset_0_0_50px_rgba(99,102,241,0.1)]' : 'border-rose-500/10 shadow-[inset_0_0_30px_rgba(244,63,94,0.05)]'}`;
    getIndicatorContext.appendChild(visualIndicator);
    setTimeout(() => {
      visualIndicator.style.opacity = '0';
      visualIndicator.classList.remove('border-[6px]');
      visualIndicator.classList.add('border-0');
      setTimeout(() => {
        if (getIndicatorContext.contains(visualIndicator)) getIndicatorContext.removeChild(visualIndicator);
      }, 300);
    }, 50);

    if (isOpen) {
      // Add entry to history so back button closes the modal instead of leaving the page
      // We rely on the global useEffect to detect this change and pushState accordingly
      // removing redundant pushState here to avoid double-back-clicks requirement
      
      setModalStack(prev => [...prev, modalId]);
      // Handle the individual state update
      switch (modalId) {
        case 'posting_reel':
          setIsPostingReel(true);
          break;
        case 'editing_profile':
          setIsEditingProfile(true);
          break;
        case 'social_hub':
          setShowSocialHub(true);
          break;
        case 'direct_messages':
          setShowDirectMessages(true);
          if (extraData) setTargetDmProfile(extraData);
          break;
        case 'supabase_diagnostics':
          setShowSupabaseDiagnostics(true);
          break;
        case 'location_diagnostics':
          setShowLocationDiagnostics(true);
          break;
        case 'viewing_profile':
          setViewingProfileId(extraData || null);
          break;
        case 'notifications':
          setShowNotifications(true);
          break;
        case 'city_guide':
          setShowCityGuide(true);
          break;
        case 'creating_outing':
          setIsCreatingOuting(true);
          break;
        case 'selected_outing':
          setSelectedOutingId(extraData || null);
          break;
      }
    } else {
      // Programmatic modal closure syncing helper:
      // Ensure that closing a modal programmatically triggers a browser history state change,
      // effectively preventing the 'stuck' UI state when multiple overlays are stacked.
      setModalStack(prev => prev.filter(id => id !== modalId));
      switch (modalId) {
        case 'posting_reel':
          setIsPostingReel(false);
          break;
        case 'editing_profile':
          setIsEditingProfile(false);
          break;
        case 'social_hub':
          setShowSocialHub(false);
          break;
        case 'direct_messages':
          setShowDirectMessages(false);
          setTargetDmProfile(null);
          break;
        case 'supabase_diagnostics':
          setShowSupabaseDiagnostics(false);
          break;
        case 'location_diagnostics':
          setShowLocationDiagnostics(false);
          break;
        case 'viewing_profile':
          setViewingProfileId(null);
          break;
        case 'notifications':
          setShowNotifications(false);
          break;
        case 'city_guide':
          setShowCityGuide(false);
          break;
        case 'creating_outing':
          setIsCreatingOuting(false);
          break;
        case 'selected_outing':
          setSelectedOutingId(null);
          break;
      }

      if (!isNavigatingBackRef.current) {
        console.log('[App] Programmatic close of modal:', modalId, 'triggering browser history state change...');
        popstateTriggeredByAppBackRef.current = true;
        
        // Also pop the corresponding history from navHistory if any exists
        if (navHistory.length > 0) {
          setNavHistory(prevHist => prevHist.slice(0, -1));
          setBlockHistoryPush(true);
          blockHistoryPushRef.current = true;
        }
        
        try {
          window.history.back();
        } catch (err) {
          console.warn('[App] window.history.back failed during programmatic close:', err);
        }
      }
    }
  };

  // Close all overlays/modals via standard cleanup
  const closeAllModals = () => {
    console.log('[App] closeAllModals called. Clears all overlays and resets back history.');
    const layersToClose = modalStackRef.current.length;
    
    isNavigatingBackRef.current = true;
    try {
      if (layersToClose > 0) {
        popstateTriggeredByAppBackRef.current = true;
        try {
          window.history.go(-layersToClose);
        } catch (err) {
          console.warn('[App] window.history.go failed inside closeAllModals:', err);
        }
      }
      
      setModalStack([]);
      setNavHistory([]);
      setBlockHistoryPush(true);
      blockHistoryPushRef.current = true;
      
      setIsPostingReel(false);
      setIsEditingProfile(false);
      setShowSocialHub(false);
      setShowDirectMessages(false);
      setTargetDmProfile(null);
      setShowSupabaseDiagnostics(false);
      setShowLocationDiagnostics(false);
      setViewingProfileId(null);
      setShowNotifications(false);
      setShowCityGuide(false);
      setIsCreatingOuting(false);
      setSelectedOutingId(null);
      
      // Reset current tab to home
      setCurrentTab('home');
    } finally {
      setTimeout(() => {
        isNavigatingBackRef.current = false;
      }, 50);
    }
  };

  // Keep refs in sync to avoid stale closures in event listeners
  const showSupabaseDiagnosticsRef = useRef(showSupabaseDiagnostics);
  const showLocationDiagnosticsRef = useRef(showLocationDiagnostics);
  const viewingProfileIdRef = useRef(viewingProfileId);
  const showNotificationsRef = useRef(showNotifications);
  const showDirectMessagesRef = useRef(showDirectMessages);
  const showSocialHubRef = useRef(showSocialHub);
  const isCreatingOutingRef = useRef(isCreatingOuting);
  const selectedOutingIdRef = useRef(selectedOutingId);
  const isEditingProfileRef = useRef(isEditingProfile);
  const isPostingReelRef = useRef(isPostingReel);
  const showCityGuideRef = useRef(showCityGuide);
  const navHistoryRef = useRef(navHistory);
  const modalStackRef = useRef<string[]>([]);
  const friendsListRef = useRef<string[]>(friendsList);

  useEffect(() => {
    showSupabaseDiagnosticsRef.current = showSupabaseDiagnostics;
    showLocationDiagnosticsRef.current = showLocationDiagnostics;
    viewingProfileIdRef.current = viewingProfileId;
    showNotificationsRef.current = showNotifications;
    showDirectMessagesRef.current = showDirectMessages;
    showSocialHubRef.current = showSocialHub;
    isCreatingOutingRef.current = isCreatingOuting;
    selectedOutingIdRef.current = selectedOutingId;
    isEditingProfileRef.current = isEditingProfile;
    isPostingReelRef.current = isPostingReel;
    showCityGuideRef.current = showCityGuide;
    navHistoryRef.current = navHistory;
    modalStackRef.current = modalStack;
    friendsListRef.current = friendsList;
  });

  useEffect(() => {
    const handleOpenProfile = (e: Event) => {
      const userId = (e as CustomEvent).detail?.userId;
      if (userId) {
        setModalState('viewing_profile', true, userId);
      }
    };
    window.addEventListener('ym-open-profile', handleOpenProfile);
    return () => {
      window.removeEventListener('ym-open-profile', handleOpenProfile);
    };
  }, []);

  const closeTopMostModal = (): boolean => {
    if (modalStackRef.current.length === 0) return false;
    popstateTriggeredByAppBackRef.current = true;
    handleGlobalBack();
    try {
      window.history.back();
    } catch (err) {
      console.warn('[App] window.history.back failed in iframe:', err);
    }
    return true;
  };

  // Centralized NavInterceptor hook that listens for hardware 'back' events globally,
  // ensuring it consistently clears the top-most layer (modal, then view) without triggering full page reloads or conflicting with current tab history.
  const useNavInterceptor = () => {
    useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          const closed = closeTopMostModal();
          if (!closed) {
            if (showSupabaseDiagnosticsRef.current || showLocationDiagnosticsRef.current) {
              setShowSupabaseDiagnostics(false);
              setShowLocationDiagnostics(false);
            } else {
              closeAllModals();
            }
          }
        }
      };

      const handlePopState = (event: PopStateEvent) => {
        console.log('[NavInterceptor] popstate triggered, window.location:', window.location.href, 'event.state:', event.state);
        
        if (popstateTriggeredByAppBackRef.current) {
          console.log('[NavInterceptor] popstate ignored because back transition was already handled programmatically');
          popstateTriggeredByAppBackRef.current = false;
          return;
        }

        // 1. If modals are open, prioritize closing them via handleGlobalBack
        if (modalStackRef.current.length > 0) {
          console.log('[NavInterceptor] popstate closing top-most modal/overlay layer...');
          handleGlobalBack();
          return;
        }

        // 2. Allow internal components to intercept hardware back (e.g., DM view unsent text guard)
        const intercept = { blocked: false };
        const backEvent = new CustomEvent('request_internal_back', { 
          cancelable: true,
          bubbles: true, // Ensure it bubbles to all listeners
          detail: intercept 
        });
        window.dispatchEvent(backEvent);
        
        if (backEvent.defaultPrevented) {
          console.log('[NavInterceptor] popstate internal interception blocked:', intercept.blocked);
          // If blocked (e.g. user chose 'Cancel' on unsent draft prompt), re-push state to prevent navigation
          if (intercept.blocked) {
            window.history.pushState(event.state || {}, '', window.location.href);
          }
          return;
        }

        // 3. Otherwise, restore the full previous state from our tracked history
        console.log('[NavInterceptor] popstate restoring previous custom layout state...');
        handleGlobalBack();
      };

      window.addEventListener('keydown', handleKeyDown);
      window.addEventListener('popstate', handlePopState, { capture: true });
      
      return () => {
        window.removeEventListener('keydown', handleKeyDown);
        window.removeEventListener('popstate', handlePopState, { capture: true });
      };
    }, []);
  };

  // Instantiate global NavInterceptor
  useNavInterceptor();

  // Database Completeness Auto-Check on Application Startup
  useEffect(() => {
    const runIncompleteDbScan = async () => {
      if (!supabase) return;
      try {
        console.log('[YallaMate Startup DB Scan] Initiating db completeness verification...');
        const result = await verifyDatabaseIntegrity();
        const rlsResult = await validateOutingRlsPolicies();
        const combinedErrors = [...result.errors, ...rlsResult.errors];
        
        setDbCompletenessErrors(combinedErrors);
        setDbCheckHasRun(true);
        if (combinedErrors.length > 0) {
          console.warn('[YallaMate Startup DB Scan] Database validation flagged some missing items:', combinedErrors);
          console.log('[YallaMate Startup DB Scan] Running auto-repair implicitly...');
          // Run migration automatically instead of requiring a button press
          runDatabaseMigration();
        } else {
          console.log('[YallaMate Startup DB Scan] Database is 100% complete and fully secured!');
        }
      } catch (err) {
        console.error('[YallaMate Startup DB Scan] Exception during database scan:', err);
      }
    };
    
    // Slight delay of 1.5 seconds to avoid overlapping with high-priority initial data fetches
    const timer = setTimeout(() => {
      runIncompleteDbScan();
    }, 1500);
    
    return () => clearTimeout(timer);
  }, []);

  // Auth Listener and URL Cleaner
  useEffect(() => {
    if (!supabase) return;

    // Direct check on mount for popup window
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session && window.opener) {
        window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS', session }, '*');
        setTimeout(() => window.close(), 1500);
      }

      // Clean OAuth / Google access token params AFTER getSession completes
      setTimeout(() => {
        if (window.location.hash && (
          window.location.hash.includes('access_token=') || 
          window.location.hash.includes('id_token=') || 
          window.location.hash.includes('expires_in=') ||
          window.location.hash.includes('error=')
        )) {
          console.log('[Auth URL Cleaner] Google OAuth access token hash detected. Cleaning URL.');
          const urlWithoutHash = window.location.pathname + window.location.search;
          window.history.replaceState(null, '', urlWithoutHash);
        } else if (window.location.hash && !window.location.hash.includes('access_token=') && !window.location.hash.includes('id_token=') && !window.location.hash.includes('expires_in=')) {
          window.history.replaceState(null, '', window.location.pathname);
        }
      }, 500);
    });
  }, []);

  // Diagnostic status panel
  const [showDiagnostics, setShowDiagnostics] = useState(false);

  // Authenticated user profile state
  const [currentUserProfile, setCurrentUserProfile] = useState<any>(null);

  const refreshUserProfile = async (userId: string) => {
    const { data, error } = await robustSelect('users', '*', (q) => q.eq('id', userId));
    if (data && data.length > 0) {
      setCurrentUserProfile(data[0]);
    }
    return { data, error };
  };

  useEffect(() => {
    if (!supabase) return;

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      // Clear token hash on subsequent events as well
      if (window.location.hash && (window.location.hash.includes('access_token=') || window.location.hash.includes('id_token='))) {
        window.history.replaceState({}, document.title, window.location.pathname + window.location.search);
      }

      if (user) {
        // Robust profile fetch: Explicitly try to fetch, fallback to creation if not found
        const userUuid = toUUID(user.uid);
        console.log('[Auth] Fetching profile for user:', user.uid, 'Mapped UUID:', userUuid);
        let dbUser = null;
        if (supabase) {
          const { data: usersData, error: fetchError } = await robustSelect('users', '*', (q) => q.eq('id', userUuid));
          if (fetchError && fetchError.message !== 'Supabase client not initialized') {
            console.error('[Auth-Recovery] Profile fetch failed:', fetchError.message);
          }
          if (usersData && usersData.length > 0) {
            dbUser = usersData[0];
          }
        }

        if (!dbUser) {
          console.warn('[Auth-Recovery] Profile not found, initiating creation...');
          const newProfile = {
            id: userUuid,
            email: user.email || '',
            name: user.displayName || user.email?.split('@')[0] || 'New Mate',
            displayName: user.displayName || user.email?.split('@')[0] || 'New Mate',
            avatar: user.photoURL || '⛺',
            onboarding_completed: false,
            "trustScore": 5
          };
          
          if (supabase) {
            try {
              const { error: insertError } = await supabase.from('users').insert([newProfile]);
              if (insertError) {
                console.error('[Auth-Recovery] Failed to create profile in Supabase:', insertError.message);
                if (insertError.message === 'Failed to fetch') {
                  console.warn('[Auth-Recovery] Networking error detected. Check Supabase URL/CORS/Blocked requests.');
                } else if (insertError.code === '42501' || insertError.message.includes('permission denied')) {
                  console.warn('[Auth-Recovery] Permission denied. Triggering Supabase Diagnostics Modal.');
                  setModalState('supabase_diagnostics', true);
                  triggerNotification('خطأ في الصلاحيات. يرجى إصلاح إعدادات قاعدة البيانات.', 'Database permission error. Please run diagnostics.', 'error');
                }
              } else {
                console.log('[Auth-Recovery] Profile created successfully in Supabase.');
              }
            } catch (err: any) {
              console.error('[Auth-Recovery] Critical exception during profile creation:', err.message || err);
            }
          }
          dbUser = { ...newProfile, onboarding_completed: false } as any;
        }

        let confirmed = false;
        
        if (user.emailVerified) {
          confirmed = true;
        }

        const isSkipForced = sessionStorage.getItem('yallamate_skip_verify') === 'true';

        if (!confirmed && user.providerData.some(p => p.providerId === 'password') && !isSkipForced) {
          console.warn('[Security Guard] Unverified email detected. Restricting access.');
          setEmailVerified(false);
        } else {
          setEmailVerified(true);
        }

        if (dbUser && dbUser.preferred_lang) {
          setLang(dbUser.preferred_lang);
          localStorage.setItem('yallamate_lang', dbUser.preferred_lang);
        }

        setCurrentUser(dbUser);
        if (dbUser) {
          localStorage.setItem('yallamate_current_user', JSON.stringify(dbUser));
        }
      } else {
        setCurrentUser(null);
        localStorage.removeItem('yallamate_current_user');
        setEmailVerified(true);
      }
      setIsInitializingAuth(false);
    });

    return () => unsubscribe();
  }, []);

  // Keep profiles in a Ref to prevent real-time resubscriptions when they undergo changes
  const profilesRef = useRef(profiles);
  useEffect(() => {
    profilesRef.current = profiles;
  }, [profiles]);

  const currentUserRef = useRef(currentUser);
  useEffect(() => {
    currentUserRef.current = currentUser;
  }, [currentUser]);

  // Strict, continuous email verification enforcement. Prevents any attempts to bypass verification on reload/mount/state-drift.
  useEffect(() => {
    let active = true;
    const enforceVerification = async () => {
      const isSkipForced = sessionStorage.getItem('yallamate_skip_verify') === 'true';
      if (isSkipForced) {
        setEmailVerified(true);
        return;
      }
      if (!auth.currentUser || !currentUser) return;
      try {
        if (active) {
          const user = auth.currentUser;
          if (user.providerData.some(p => p.providerId === 'password')) {
            if (!user.emailVerified) {
              await user.reload();
            }

            const isVerified = user.emailVerified;

            if (!isVerified) {
              console.warn('[Security Guard] Unverified email detected. Restricting access.');
              setEmailVerified(false);
            } else {
              setEmailVerified(true);
            }
          }
        }
      } catch (err: any) {
        if (err?.code === 'auth/network-request-failed' || err?.message?.includes('network-request-failed')) {
          console.warn('[Security Guard] Network request failed. Retrying verification check when connectivity resumes.');
        } else {
          console.error('[Security Guard] Error enforcing email verification:', err);
        }
      }
    };
    enforceVerification();
    const interval = setInterval(enforceVerification, 4000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [currentUser]);

  const reelsRef = useRef(reels);
  useEffect(() => {
    reelsRef.current = reels;
  }, [reels]);

  // Combined, High-Efficiency Central Real-time Sync Controller
  const fetchFriends = async () => {
    if (!currentUser?.id) return;
    try {
      const overview = await SocialService.getSocialOverview(currentUser.id);
      
      // Store in localStorage
      localStorage.setItem('mates_last_sync_friend_requests', new Date().toISOString());
      localStorage.setItem(
        `mates_cached_pending_reqs_${currentUser.id}`,
        JSON.stringify({ pending: overview.pending_incoming, sent: overview.pending_outgoing })
      );

      // Populate notifications from pending requests
      if (overview.pending_incoming.length > 0) {
        setAppNotifications(prevArr => {
          const newNotifs = overview.pending_incoming.map((req: any) => ({
            id: `notif_fr_${req.id}`,
            userId: currentUser.id,
            type: 'friend_request' as const,
            actorId: req.senderId,
            actorName: req.senderName || 'Mate',
            actorAvatar: req.senderAvatar || '👤',
            targetId: req.id,
            message: lang === 'ar' ? 'أرسل لك طلب متابعة جديد' : 'sent you a new follow request',
            read: false,
            timestamp: req.timestamp || new Date().toISOString()
          }));
          
          const existingIds = new Set(prevArr.map(n => n.id));
          const uniqueNew = Array.from(new Map(newNotifs.map(n => [n.id, n])).values());
          const filteredNew = uniqueNew.filter(n => !existingIds.has(n.id));
          return [...filteredNew, ...prevArr];
        });
      }

      setFriendsList(overview.friends);
      
      const { data: allProfiles } = await robustSelect('users', 'id, name, username, "displayName", avatar, "trustScore", verified');
      if (allProfiles) {
        const matchedFriends = allProfiles.filter((p: any) => overview.friends.includes(p.id));
        localStorage.setItem(`mates_cached_friends_${currentUser.id}`, JSON.stringify(matchedFriends));
      }
    } catch (err) {
      console.error("[Central Sync] Friends fetch failed", err);
    }
  };

  const fetchDirectMessages = async () => {
    if (!currentUser?.id) return;
    try {
      const { data, error } = await robustSelect('direct_messages', 'id, "chatId", "senderId", "receiverId", content, type, timestamp, reactions, "imageUrl", "locationUrl"');
      if (error) throw error;

      if (data) {
        localStorage.setItem('mates_last_sync_direct_messages', new Date().toISOString());

        const grouped: Record<string, any[]> = {};
        data.forEach((m: any) => {
          const chatId = m.chatId;
          if (!grouped[chatId]) grouped[chatId] = [];
          grouped[chatId].push({
            id: m.id,
            chatId: m.chatId,
            senderId: m.senderId,
            receiverId: m.receiverId,
            content: m.content || '',
            type: m.type || 'text',
            timestamp: m.timestamp,
            reactions: m.reactions || {},
            imageSrc: m.imageUrl || m.imageSrc,
            voiceDuration: m.locationUrl?.startsWith('voice_duration:') 
              ? parseInt(m.locationUrl.split(':')[1]) 
              : (m.voiceDuration || 4)
          });
        });

        Object.entries(grouped).forEach(([chatId, msgs]) => {
          if (chatId.includes(currentUser.id)) {
            localStorage.setItem(`mates_cached_msgs_${chatId}`, JSON.stringify(msgs));
          }
        });
      }
    } catch (err) {
      console.error('[Central Sync] Messages sync failed:', err);
    }
  };

  useEffect(() => {
    if (!supabase) return;

    // A. Sync Reels Fetcher
    const allReelFields = '*, reels_likes(user_id), creator:users!reels_creatorId_fkey(name, avatar)';

    const fetchReels = async (fieldsToTry: string = allReelFields, orderField: string | null = 'created_at') => {
      const transaction = startTransaction('fetchReels', 'db.query');
      try {
        if (!supabase) return;
        
        let result = await robustSelect(
          'reels',
          fieldsToTry,
          orderField ? (q) => q.order(orderField, { ascending: false }) : undefined
        );
        
        // Handle relationship errors (PGRST200) or missing columns
        if (result.error && (result.error.code === 'PGRST200' || result.error.message?.includes('relationship') || result.error.message?.includes('reels_likes'))) {
           console.warn('[App] Relationship error with reels_likes, falling back to separate fetch');
           // Try fetching reels without the likes join
           const basicFields = fieldsToTry.split(', ').filter(f => !f.includes('reels_likes')).join(', ');
           const reelsOnly = await robustSelect(
             'reels',
             basicFields,
             orderField ? (q) => q.order(orderField, { ascending: false }) : undefined
           );
           
           if (reelsOnly.data) {
             const reelIds = reelsOnly.data.map((r: any) => r.id);
             // Fetch likes in bulk with schema cache resilience fallback
             let likesData = null;
             try {
               const likesRes = await supabase
                 .from('reels_likes')
                 .select('reel_id, user_id')
                 .in('reel_id', reelIds);
               if (likesRes.error) {
                 if (likesRes.error.code === 'PGRST205' || likesRes.error.message?.includes('schema cache')) {
                   console.warn('[App] reels_likes missing from schema cache. Falling back.');
                 } else {
                   throw likesRes.error;
                 }
               } else {
                 likesData = likesRes.data;
               }
             } catch (likesErr) {
               console.error('[App] reels_likes fallback triggered:', likesErr.message || likesErr);
               likesData = [];
             }
               
             result = {
               data: reelsOnly.data.map((r: any) => ({
                 ...r,
                 reels_likes: likesData?.filter(l => l.reel_id === r.id) || []
               })),
               error: null
             };
           }
        }

        if (result.error && result.error.code === '42703') {
          const match = result.error.message.match(/column \w+\.?(\w+) does not exist/) || 
                        result.error.message.match(/column "([^"]+)"/) ||
                        result.error.message.match(/column \w+\.?([^ ]+) does not exist/);
          const colName = match ? match[1] : null;
          
          if (colName) {
            console.warn(`[Central-Sync-Recovery] Handling missing column "${colName}" from reels table.`);
            const nextFields = fieldsToTry.split(', ')
              .filter(f => !f.includes(colName))
              .join(', ');
            const nextOrderField = (orderField === colName) ? null : orderField;
            return fetchReels(nextFields, nextOrderField);
          }
        }

        if (result.error) throw result.error;
        if (result.data && Array.isArray(result.data)) {
          let currentUserId = currentUserRef.current?.id;

          const mappedData = result.data.map((reel: any) => {
             const creator = reel.creator || {};
             
             // Get standard liked user IDs
             const serverLikedByIds = reel.reels_likes?.map((l: any) => l.user_id) || [];
             
             reelsLikesService.hydrateOptimisticLikes(reel.id, serverLikedByIds);

             return {
              ...reel,
              creator_id: reel.creator_id || reel.owner_id,
              creator_name: creator.name || reel.creator_name || (reel as any).creatorName || 'Anonymous Mate',
              creator_avatar: creator.avatar || reel.creator_avatar || (reel as any).creatorAvatar || '👤',
              liked_by_ids: serverLikedByIds
            };
          });
          const uniqueData = Array.from(new Map(mappedData.map((r: any) => [r.id, r])).values());
          setReels(uniqueData);
          saveReelsToCache(uniqueData).catch(e => console.error("Failed to cache reels:", e));
          console.log(`[App] Reels synced with ${uniqueData.length} records.`);
        }
      } catch (err) {
        console.error('[Central Sync] Failed to sync reels:', err);
      } finally {
        transaction.finish();
      }
    };

    // B. Notifications Polling Service (fetchOnlyNew)
    const fetchOnlyNewNotifications = async () => {
      if (!currentUser?.id) return;
      try {
        const lastSync = localStorage.getItem(`mates_last_sync_notifications_${currentUser.id}`) || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        
        // Example integration: check for new friend requests strictly after lastSync
        const { data: newRequests } = await supabase
          .from('friend_requests')
          .select('*')
          .eq('receiver_id', currentUser.id)
          .gt('timestamp', lastSync);

        if (newRequests && newRequests.length > 0) {
          setAppNotifications(prevArr => {
            const newNotifs = newRequests.map((req: any) => ({
              id: `notif_fr_${req.id}`,
              userId: currentUser.id,
              type: 'friend_request' as const,
              actorId: req.sender_id || req.senderId,
              actorName: 'Mate',
              actorAvatar: '👤',
              targetId: req.id,
              message: lang === 'ar' ? 'أرسل لك طلب متابعة جديد' : 'sent you a new follow request',
              read: false,
              timestamp: req.timestamp || new Date().toISOString()
            }));
            const existingIds = new Set(prevArr.map(n => n.id));
            const unique = newNotifs.filter(n => !existingIds.has(n.id));
            return [...unique, ...prevArr];
          });
        }
        
        localStorage.setItem(`mates_last_sync_notifications_${currentUser.id}`, new Date().toISOString());
      } catch (err) {
        console.warn('[Notifications] fetchOnlyNew failed:', err);
      }
    };

    // C. Sync Users Fetcher
    const fetchUsers = async () => {
      try {
        const fields = 'id, name, username, "displayName", bio, phone, location, city, avatar, archetype, "trustScore", "reputationScore", verified, interests, "joinedAt", "lastActive", "followersCount", "followingCount", "friendsCount", preferences, badges, "warningCount", suspended, gender, hobbies, "favoriteFood", "favoritePlayground", "musicPreference", "sportsTeam", xp, level, "emergencyContactName", "emergencyContactPhone", followers, following, "privacyStatus", "dmStatus", "hideFollowers", "notificationEnabled", onboarding_completed, "moodEmoji", "moodText", "reportCount"';
        let { data, error } = await robustSelect('users', fields);
        
        if (error && error.code === '42703') {
           console.warn('[Central Sync] One or more user columns missing. Retrying with basic fields.');
           const basicFields = 'id, name, username, "displayName", avatar, "trustScore", verified, interests, "joinedAt", "lastActive", "followersCount", "followingCount", "friendsCount", onboarding_completed';
           const { data: fallback, error: err2 } = await robustSelect('users', basicFields);
           if (!err2 && fallback) {
             data = fallback;
             error = null;
           }
        }
        
        if (!error && data && Array.isArray(data)) {
          // Robust deduplication by ID, keeping all users
          const uniqueData = Array.from(new Map(data.map((u: any) => [u.id, u])).values());
          setProfiles(uniqueData);
          
           if (currentUser?.id) {
            const foundUser = uniqueData.find((u: any) => u.id === currentUser.id);
            if (foundUser) {
              setCurrentUser(foundUser);
              localStorage.setItem('yallamate_current_user', JSON.stringify(foundUser));
            } else {
               console.warn('[Central Sync] Logged in user not in latest fetch. Syncing back...');
               syncProfileToDb(currentUser);
            }
          }
        }
      } catch (err) {
        console.error('[Central Sync] Failed to sync users:', err);
      }
    };

    // C. Sync Outings Fetcher
    const allOutingFields = 'id, title, description, category, location, city, datetime, "creatorName", "creatorAvatar", "creatorTrust", "maxAttendees", "attendeeIds", "minTrustScore", status, logistics, "coverImage", "genderRestriction", "mapCoordinates", "mapLocationUrl", "isBlindOuting", "blindWaypoints", "isPrivate", "invitedUserIds"';
    const fetchOutings = async (fieldsToTry: string = allOutingFields) => {
      const transaction = startTransaction('fetchOutings', 'db.query');
      try {
        const { data, error } = await robustSelect('outings', fieldsToTry);
        if (error && error.code === '42703') {
           const match = error.message.match(/column \w+\.?(\w+) does not exist/);
           const colName = match ? match[1] : null;
           
           if (colName && fieldsToTry.includes(colName)) {
             console.warn(`[Central-Sync-Recovery] Removing missing column "${colName}" from outings query.`);
             const nextFields = fieldsToTry.split(', ')
               .filter(f => !f.includes(colName))
               .join(', ');
             transaction.finish();
             return fetchOutings(nextFields);
           }
        }
        if (error) throw error;

        if (data && Array.isArray(data)) {
          const mappedData = data.map((outing: any) => {
            const baseLogistics = outing.logistics || {
              hasDriver: false,
              driverName: '',
              vehicleCapacity: 4,
              pickupPoint: '',
              fuelSharingPrice: 0,
              costPerPerson: 0,
              pickups: []
            };
            const creatorInfo = outing.creator || {};
            return {
              ...outing,
              logistics: baseLogistics,
              coverImage: outing.coverImage || '',
              creatorName: creatorInfo.name || outing.creatorName || 'Anonymous Partner',
              creatorAvatar: creatorInfo.avatar || outing.creatorAvatar || '👤',
              creatorTrust: creatorInfo.trustScore ?? outing.creatorTrust ?? 9.5,
            };
          });
          const uniqueDataRaw = Array.from(new Map(mappedData.map((o: any) => [o.id, o])).values());
          const currentNow = new Date();
          const deleteIds: string[] = [];
          const completeIds: string[] = [];

          const uniqueData = uniqueDataRaw.filter((outing: any) => {
            const noAttendees = !outing.attendeeIds || outing.attendeeIds.length === 0;
            let deeplyExpired = false;
            let shouldBeCompleted = false;
            if (outing.datetime) {
              const diffHours = (currentNow.getTime() - new Date(outing.datetime).getTime()) / (1000 * 3600);
              // expired by more than 12 hours
              if (diffHours > 12) {
                deeplyExpired = true;
              } else if (diffHours > 2 && (outing.status === 'upcoming' || outing.status === 'ongoing')) {
                shouldBeCompleted = true;
              }
            }
            if (noAttendees || deeplyExpired) {
              deleteIds.push(outing.id);
              return false;
            }
            if (shouldBeCompleted) {
              completeIds.push(outing.id);
              outing.status = 'completed'; // auto-complete locally
            }
            return true;
          });

          setOutings(uniqueData);
          saveOutingsToCache(uniqueData);

          if (deleteIds.length > 0) {
            (async () => {
              try {
                console.log('[Outing Garbage Collector] Permanently deleting and terminating outings:', deleteIds);
                await supabase.from('outings').delete().in('id', deleteIds);
              } catch (e) {
                console.warn('[Outing Garbage Collector Exception]', e);
              }
            })();
          }

          if (completeIds.length > 0) {
            (async () => {
              try {
                console.log('[Outing Status Polling] Auto-completing stale outings (>2 hours):', completeIds);
                await supabase.from('outings').update({ status: 'completed' }).in('id', completeIds);
              } catch (e) {
                console.warn('[Outing Status Polling Exception]', e);
              }
            })();
          }
        }
      } catch (err: any) {
        console.error('[Central Sync] Outings sync failed:', err);
      } finally {
        transaction.finish();
      }
    };

    // Sync Companion Reviews Fetcher
    const fetchCompanionReviews = async () => {
      try {
        const { data, error } = await robustSelect('companion_reviews', 'id, "outingId", "reviewerId", "revieweeId", "respectfulRating", "punctualRating", "paymentRating", "friendlyRating", comment, timestamp');
        if (error) throw error;
        if (data && Array.isArray(data)) {
          const mappedReviews = data.map((item: any) => ({
            id: item.id,
            outingId: item.outingId || item.outing_id,
            reviewerId: item.reviewerId || item.reviewer_id,
            revieweeId: item.revieweeId || item.reviewee_id,
            respectfulRating: item.respectfulRating || item.respectful_rating || 5,
            punctualRating: item.punctualRating || item.punctual_rating || 5,
            paymentRating: item.paymentRating || item.payment_rating || 5,
            friendlyRating: item.friendlyRating || item.friendly_rating || 5,
            comment: item.comment,
            timestamp: item.timestamp
          }));
          setCompanionReviews(mappedReviews);
          localStorage.setItem('yallamate_companion_reviews', JSON.stringify(mappedReviews));
        }
      } catch (err) {
        console.error('[Central Sync] companion_reviews fetch failed:', err);
      }
    };

    // PGRST Schema Cache Verification & Reload Strategy
    const checkSchemaValidityAndReload = async () => {
      if (!supabase) return;
      try {
        // Run a lightweight query on Direct Messages and Friend Requests to check for schema cache invalidations (PGRST errors)
        const dmCheck = await supabase.from('direct_messages').select('id').limit(1);
        const friendCheck = await supabase.from('friend_requests').select('id').limit(1);
        const likesCheck = await supabase.from('reels_likes').select('user_id').limit(1);

        const hasPgrstError = 
          (dmCheck.error && (dmCheck.error.code === 'PGRST205' || dmCheck.error.message?.includes('schema cache'))) ||
          (friendCheck.error && (friendCheck.error.code === 'PGRST205' || friendCheck.error.message?.includes('schema cache'))) ||
          (likesCheck.error && (likesCheck.error.code === 'PGRST205' || likesCheck.error.message?.includes('schema cache')));

        if (hasPgrstError) {
          console.warn('[PGRST Schema Recovery] Schema cache invalidation detected on critical messaging/friend tables. Signaling automatic schema reload...');
          const { error: reloadErr } = await supabase.rpc('execute_sql', { 
            sql_query: "NOTIFY pgrst, 'reload schema';" 
          });
          if (reloadErr) {
            console.error('[PGRST Schema Recovery] Automatic NOTIFY pgrst, reload schema failed:', reloadErr.message);
          } else {
            console.log('[PGRST Schema Recovery] NOTIFY pgrst, reload schema signal dispatched successfully.');
            // Refetch friend data and direct messages after schema is refreshed
            setTimeout(() => {
              if (currentUser?.id) {
                fetchFriends();
                fetchDirectMessages();
              }
            }, 1000);
          }
        }
      } catch (err: any) {
        console.error('[PGRST Schema Recovery] Verification lookup caught exception:', err.message || err);
      }
    };

    // F. Batch Trigger All Fetches & Seeders
    fetchReels();
    fetchUsers();
    fetchOutings();
    fetchCompanionReviews();
    fetchOnlyNewNotifications();
    checkSchemaValidityAndReload();
    fetchUnreadCounts();
    const checkIntervalMs = lowPowerMode ? 120000 : 30000;
    const schemaCheckInterval = setInterval(checkSchemaValidityAndReload, checkIntervalMs);
    
    // Also use the new dedicated service
    import('./services/schemaHealthCheckService').then(mod => {
      mod.schemaHealthCheckService.stop();
      mod.schemaHealthCheckService.start(checkIntervalMs);
    });

    if (currentUser?.id) {
      fetchFollows();
      fetchFriends();
      fetchDirectMessages();
    }

    // G. Multiplexed Single WebSocket Real-time Connection
    const channel_reels = supabase.channel('reels_sync_' + Math.random().toString(36).substr(2, 9)).on('postgres_changes', { event: '*', schema: 'public', table: 'reels' }, () => {
        fetchReels();
      })
      .subscribe();

    const channel_reels_bookmarks = supabase.channel('reels_bookmarks_sync_' + Math.random().toString(36).substr(2, 9))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reels_bookmarks' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          const currentUserId = currentUserRef.current?.id;
          if (!currentUserId || !payload.new) return;
          const bookmark = payload.new;
          const targetReelId = bookmark.reel_id || bookmark.reelId;
          const bookmarkerId = bookmark.user_id || bookmark.userId;
          if (bookmarkerId === currentUserId) return;
          const myReel = (reelsRef.current || []).find((r: any) => r.id === targetReelId);
          if (myReel && (myReel.creator_id === currentUserId || myReel.creatorId === currentUserId)) {
            const bookmarker = (profilesRef.current || []).find(p => p.id === bookmarkerId);
            const bookmarkerName = bookmarker ? (bookmarker.displayName || bookmarker.name) : (lang === 'ar' ? 'رحّال' : 'A Mate');
            triggerNotification(
              `أضاف ${bookmarkerName} مقطع الريلز الخاص بك للمفضلة!`,
              `${bookmarkerName} favorited your reel!`,
              'info'
            );
            setAppNotifications(prev => {
              const notifId = `notif_reelfav_${targetReelId}_${bookmarkerId}_${Date.now()}`;
              if (prev.some(n => n.id === notifId)) return prev;
              return [{
                id: notifId,
                userId: currentUserId,
                type: 'like_reel' as const, // Re-use like_reel type to just open reels
                actorId: bookmarkerId,
                actorName: bookmarkerName,
                actorAvatar: bookmarker?.avatar || '👤',
                targetId: targetReelId,
                message: lang === 'ar' ? `قام بإضافة مقطعك للمفضلة` : `${bookmarkerName} saved your reel to favorites`,
                read: false,
                timestamp: new Date().toISOString()
              }, ...prev];
            });
          }
        }
      })
      .subscribe();

    const channel_reels_comments = supabase.channel('reels_comments_sync_' + Math.random().toString(36).substr(2, 9))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reels_comments' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          const currentUserId = currentUserRef.current?.id;
          if (!currentUserId || !payload.new) return;
          const comment = payload.new;
          const targetReelId = comment.reel_id || comment.reelId;
          const commenterId = comment.user_id || comment.userId;
          if (commenterId === currentUserId) return;
          const myReel = (reelsRef.current || []).find((r: any) => r.id === targetReelId);
          if (myReel && (myReel.creator_id === currentUserId || myReel.creatorId === currentUserId)) {
            const commenter = (profilesRef.current || []).find(p => p.id === commenterId);
            const commenterName = commenter ? (commenter.displayName || commenter.name) : (lang === 'ar' ? 'رحّال' : 'A Mate');
            triggerNotification(
              `علق ${commenterName} على مقطع الريلز الخاص بك!`,
              `${commenterName} commented on your reel!`,
              'info'
            );
            setAppNotifications(prev => {
              const notifId = `notif_reelcomment_${targetReelId}_${commenterId}_${Date.now()}`;
              if (prev.some(n => n.id === notifId)) return prev;
              return [{
                id: notifId,
                userId: currentUserId,
                type: 'new_comment' as const, 
                actorId: commenterId,
                actorName: commenterName,
                actorAvatar: commenter?.avatar || '👤',
                targetId: targetReelId,
                message: lang === 'ar' ? `قام بالتعليق على مقطعك` : `commented on your reel`,
                read: false,
                timestamp: new Date().toISOString()
              }, ...prev];
            });
          }
        }
      })
      .subscribe();

    const channel_reels_likes = supabase.channel('reels_likes_sync_' + Math.random().toString(36).substr(2, 9))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reels_likes' }, (payload) => {
        fetchReels();

        if (payload.eventType === 'INSERT') {
          const currentUserId = currentUserRef.current?.id;
          if (!currentUserId || !payload.new) return;

          const like = payload.new;
          const targetReelId = like.reel_id || like.reelId;
          const likerId = like.user_id || like.userId;

          if (likerId === currentUserId) return; // ignore my own likes

          // Find is it my reel?
          const myReel = (reelsRef.current || []).find((r: any) => r.id === targetReelId);
          if (myReel && (myReel.creator_id === currentUserId || myReel.creatorId === currentUserId)) {
            const liker = (profilesRef.current || []).find(p => p.id === likerId);
            const likerName = liker ? (liker.displayName || liker.name) : (lang === 'ar' ? 'رحّال' : 'A Mate');

            triggerNotification(
              `أعجب ${likerName} بمقطع الريلز الخاص بك!`,
              `${likerName} liked your reel!`,
              'info'
            );

            setAppNotifications(prev => {
              const notifId = `notif_reellike_${targetReelId}_${likerId}_${Date.now()}`;
              if (prev.some(n => n.id === notifId)) return prev;
              return [{
                id: notifId,
                userId: currentUserId,
                type: 'like_reel' as const,
                actorId: likerId,
                actorName: likerName,
                actorAvatar: liker?.avatar || '❤️',
                targetId: targetReelId,
                message: lang === 'ar' ? 'أعجب بمقطع الريلز الخاص بك' : 'liked your reel',
                read: false,
                timestamp: new Date().toISOString()
              }, ...prev];
            });
          }
        }
      })
      .subscribe();

    const channel_reels_comments_2 = supabase.channel('reels_comments_sync_2_' + Math.random().toString(36).substr(2, 9))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reels_comments' }, (payload) => {
        fetchReels();

        if (payload.eventType === 'INSERT') {
          const currentUserId = currentUserRef.current?.id;
          if (!currentUserId || !payload.new) return;

          const comment = payload.new;
          const targetReelId = comment.reel_id || comment.reelId;
          const commentAuthorId = comment.user_id || comment.userId;

          if (commentAuthorId === currentUserId) return; // ignore my own comments

          const commentText = comment.comment || comment.comment_text || comment.text || comment.content || '';

          // Find is it my reel?
          const myReel = (reelsRef.current || []).find((r: any) => r.id === targetReelId);
          if (myReel && (myReel.creator_id === currentUserId || myReel.creatorId === currentUserId)) {
            const author = (profilesRef.current || []).find(p => p.id === commentAuthorId);
            const authorName = author ? (author.displayName || author.name) : (comment.user_name || (lang === 'ar' ? 'رحّال' : 'A Mate'));

            triggerNotification(
              `علّق ${authorName} على مقطع الريلز الخاص بك: ${commentText}`,
              `${authorName} commented on your reel: ${commentText}`,
              'info'
            );

            setAppNotifications(prev => {
              const notifId = `notif_reelcomment_${comment.id || Date.now()}`;
              if (prev.some(n => n.id === notifId)) return prev;
              return [{
                id: notifId,
                userId: currentUserId,
                type: 'new_comment' as const,
                actorId: commentAuthorId,
                actorName: authorName,
                actorAvatar: author?.avatar || '💬',
                targetId: targetReelId,
                message: lang === 'ar' ? `علّق على مقطع الريلز الخاص بك: ${commentText}` : `commented on your reel: ${commentText}`,
                read: false,
                timestamp: new Date().toISOString()
              }, ...prev];
            });
          }
        }
      })
      .subscribe();

    const channel_users = supabase.channel('users_sync_' + Math.random().toString(36).substr(2, 9))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, () => {
        fetchUsers();
      })
      .subscribe();

    const channel_outings = supabase.channel('outings_sync_' + Math.random().toString(36).substr(2, 9))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'outings' }, () => {
        fetchOutings();
      })
      .subscribe();

    const channel_follows = supabase.channel('follows_sync_' + Math.random().toString(36).substr(2, 9))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'follows' }, (payload) => {
        fetchFollows();
        
        if (payload.eventType === 'INSERT' && currentUser?.id) {
          const follow = payload.new;
          if (follow.following_id === currentUser.id && follow.follower_id !== currentUser.id) {
            const follower = (profilesRef.current || []).find(p => p.id === follow.follower_id);
            const followerName = follower ? (follower.displayName || follower.name) : 'A Mate';
            
            triggerNotification(
              `${followerName} بدأ بمتابعتك`,
              `${followerName} started following you`,
              'info'
            );

            setAppNotifications(prev => {
              const notifId = `notif_follow_${follow.id || Date.now()}`;
              if (prev.some(n => n.id === notifId)) return prev;
              const newNotif: AppNotification = {
                id: notifId,
                userId: currentUser.id,
                type: 'new_follower' as const,
                actorId: follow.follower_id,
                actorName: followerName,
                actorAvatar: follower?.avatar || '👤',
                targetId: follow.id,
                message: lang === 'ar' ? 'بدأ بمتابعتك الآن' : 'started following you',
                read: false,
                timestamp: follow.created_at || new Date().toISOString()
              };
              return [newNotif, ...prev];
            });
          }
        }
      })
      .subscribe();

    const channel_friend_requests = supabase.channel('friend_requests_sync_' + Math.random().toString(36).substr(2, 9))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'friend_requests' }, (payload) => {
        fetchFriends();
        
        if (payload.eventType === 'INSERT') {
          const req = payload.new;
          if (currentUser?.id && req && req.receiverId === currentUser.id && req.senderId !== currentUser.id) {
            const isAr = lang === 'ar';
            const senderName = req.senderName || 'Mate';
            
            triggerNotification(
              `طلب متابعة جديد من ${senderName}`,
              `New follow request from ${senderName}`,
              'info'
            );

            setAppNotifications(prev => {
              const newNotif = {
                id: `notif_fr_${req.id}`,
                userId: currentUser.id,
                type: 'friend_request' as const,
                actorId: req.senderId,
                actorName: senderName,
                actorAvatar: req.senderAvatar || '👤',
                targetId: req.id,
                message: isAr ? 'أرسل لك طلب متابعة جديد' : 'sent you a new follow request',
                read: false,
                timestamp: req.timestamp || new Date().toISOString()
              };
              
              if (prev.some(n => n.id === newNotif.id)) return prev;
              return [newNotif, ...prev];
            });
          }
        } else if (payload.eventType === 'UPDATE') {
          const req = payload.new;
          const old = payload.old;
          if (currentUser?.id && req && req.senderId === currentUser.id && req.status === 'accepted' && (!old || old.status !== 'accepted')) {
            const isAr = lang === 'ar';
            const actorName = req.receiverName || 'Mate';
            
            triggerNotification(
              `قبل ${actorName} طلب المتابعة الخاص بك`,
              `${actorName} accepted your follow request`,
              'info'
            );

            setAppNotifications(prev => {
              const newNotif = {
                id: `notif_fr_acc_${req.id}`,
                userId: currentUser.id,
                type: 'friend_request_accepted' as const,
                actorId: req.receiverId,
                actorName: actorName,
                actorAvatar: req.receiverAvatar || '👤',
                targetId: req.id,
                message: isAr ? 'قبل طلب المتابعة الخاص بك' : 'accepted your follow request',
                read: false,
                timestamp: req.timestamp || new Date().toISOString()
              };
              
              if (prev.some(n => n.id === newNotif.id)) return prev;
              return [newNotif, ...prev];
            });
          }
        }
      })
      .subscribe();

    const channel_direct_messages = supabase.channel('direct_messages_sync_' + Math.random().toString(36).substr(2, 9))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'direct_messages' }, (payload) => {
        fetchDirectMessages();
        
        if (payload.eventType === 'INSERT') {
          const msg = payload.new;
          if (currentUser?.id && msg && msg.receiverId === currentUser.id && msg.senderId !== currentUser.id) {
            const sender = (profilesRef.current || []).find(p => p.id === msg.senderId);
            const senderName = sender ? sender.displayName || sender.name : (msg.senderName || 'Mate');
            const isAr = lang === 'ar';
            
            triggerNotification(
              `رسالة جديدة من ${senderName}: ${msg.content || ''}`,
              `New message from ${senderName}: ${msg.content || ''}`,
              'info'
            );

            setAppNotifications(prev => {
              const newNotif = {
                id: `notif_msg_${msg.id}`,
                userId: currentUser.id,
                type: 'direct_message' as const,
                actorId: msg.senderId,
                actorName: senderName,
                actorAvatar: sender?.avatar || '💬',
                targetId: msg.chatId,
                message: isAr ? `أرسل لك رسالة: ${msg.content || ''}` : `sent you a message: ${msg.content || ''}`,
                read: false,
                timestamp: msg.timestamp || new Date().toISOString()
              };
              if (prev.some(n => n.id === newNotif.id)) return prev;
              return [newNotif, ...prev];
            });
          }
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'posts' }, (payload) => {
        const newPost = payload.new as any;
        const oldPost = payload.old as any;
        if (!oldPost || !newPost) return;
        
        if (currentUser?.id && newPost.userId === currentUser.id) {
          // Detect new likes
          const oldLikes = Array.isArray(oldPost.likes) ? oldPost.likes : [];
          const newLikes = Array.isArray(newPost.likes) ? newPost.likes : [];
          if (newLikes.length > oldLikes.length) {
            const newLikerId = newLikes.find((id: string) => !oldLikes.includes(id));
            if (newLikerId && newLikerId !== currentUser.id) {
              const liker = (profilesRef.current || []).find(p => p.id === newLikerId);
              const likerName = liker ? liker.displayName || liker.name : 'Someone';
              
              setAppNotifications(prev => {
                const newNotif = {
                  id: `notif_like_${newPost.id}_${newLikerId}_${Date.now()}`,
                  userId: currentUser.id,
                  type: 'like_post' as const,
                  actorId: newLikerId,
                  actorName: likerName,
                  actorAvatar: liker?.avatar || '❤️',
                  targetId: newPost.id,
                  message: lang === 'ar' ? 'أعجب بمنشورك' : 'liked your post',
                  read: false,
                  timestamp: new Date().toISOString()
                };
                return [newNotif, ...prev];
              });
            }
          }
          
          // Detect new comments
          const oldCommentsCount = oldPost.commentsCount || 0;
          const newCommentsCount = newPost.commentsCount || 0;
          if (newCommentsCount > oldCommentsCount) {
              setAppNotifications(prev => {
                const newNotif = {
                  id: `notif_comment_${newPost.id}_${Date.now()}`,
                  userId: currentUser.id,
                  type: 'new_comment' as const,
                  actorId: 'system',
                  actorName: lang === 'ar' ? 'أحدهم' : 'Someone',
                  actorAvatar: '💬',
                  targetId: newPost.id,
                  message: lang === 'ar' ? 'علق على منشورك' : 'commented on your post',
                  read: false,
                  timestamp: new Date().toISOString()
                };
                return [newNotif, ...prev];
              });
          }
        }
      })
      .subscribe();

    return () => {
      
      supabase.removeChannel(channel_reels);
      supabase.removeChannel(channel_reels_bookmarks);
      supabase.removeChannel(channel_reels_comments);
      supabase.removeChannel(channel_reels_comments_2);
      supabase.removeChannel(channel_reels_likes);
      supabase.removeChannel(channel_users);
      supabase.removeChannel(channel_outings);
      supabase.removeChannel(channel_follows);
      supabase.removeChannel(channel_friend_requests);
      supabase.removeChannel(channel_direct_messages);

      clearInterval(schemaCheckInterval);
    };
  }, [currentUser?.id, lang, lowPowerMode]);

  // Connection status
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = async () => {
      setIsOnline(true);
      if (!supabase) return;
      
      // Flush database & local storage pending queues
      await offlineSyncService.processQueue();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);
  
  // Social handlers
  const handleToggleFollow = async (targetId: string) => {
    if (!currentUser || !supabase) return;
    const isFollowed = currentUser.following?.includes(targetId);
    
    return executeTransactionalOp(
      isFollowed ? 'unfollow' : 'follow',
      'follows',
      { follower_id: currentUser.id, following_id: targetId },
      async () => {
        if (isFollowed) {
          // Unfollow
          const { error } = await supabase
            .from('follows')
            .delete()
            .eq('follower_id', currentUser.id)
            .eq('following_id', targetId);
          
          if (error) return { error };

          // Optimistic state update via sync refetch
          fetchFollows(); 
          return { error: null };
        } else {
          // Follow
          const { error: followErr } = await supabase.from('follows').insert([{
            follower_id: currentUser.id,
            following_id: targetId,
            created_at: new Date().toISOString()
          }]);

          if (followErr) return { error: followErr };

          // Also send a friend request so it appears in notifications
          const { error: reqErr } = await supabase.from('friend_requests').insert([{
            id: crypto.randomUUID(),
            senderId: currentUser.id,
            receiverId: targetId,
            status: 'pending',
            senderName: currentUser.name || 'Mate',
            senderAvatar: currentUser.avatar || '👤',
            timestamp: new Date().toISOString()
          }]);

          if (reqErr) return { error: reqErr };

          fetchFollows();
          return { error: null };
        }
      }
    );
  };

  // Real-time AI Matchmaker & Smart Notification Generator
  useEffect(() => {
    if (!currentUser || !profiles || profiles.length === 0) return;
    
    // Delayed startup of matching to let UI settle
    const timer = setTimeout(() => {
      // Find candidates the user isn't already following
      const unfollowed = profiles.filter(p => p.id !== currentUser.id && !(currentUser.following || []).includes(p.id));
      if (unfollowed.length === 0) return;

      // Score matching profiles
      type MatchScore = { profile: Profile; score: number; overlap: string[] };
      const matches: MatchScore[] = unfollowed.map(p => {
        let score = 0;
        const overlap: string[] = [];
        
        // Location matching
        if (p.location && currentUser.location && p.location.trim().toLowerCase() === currentUser.location.trim().toLowerCase()) {
          score += 4;
        }

        // Interest overlap
        const myInterests = currentUser.interests || [];
        const theirInterests = p.interests || [];
        const common = myInterests.filter(i => theirInterests.includes(i));
        score += common.length * 2;
        overlap.push(...common);

        // High trust alignment
        if (p.trustScore > 9.5 && currentUser.trustScore > 9.5) {
          score += 1;
        }

        return { profile: p, score, overlap };
      });

      // Sort by score
      matches.sort((a, b) => b.score - a.score);
      const bestMatch = matches[0];

      // If we have a robust recommendation, push a pristine dynamic notification!
      if (bestMatch && bestMatch.score >= 3) {
        const p = bestMatch.profile;
        const isAr = lang === 'ar';
        const overlapStr = bestMatch.overlap.length > 0
          ? (isAr ? `اهتمام مشترك بـ ${bestMatch.overlap.join('، ')}` : `common interest in ${bestMatch.overlap.join(', ')}`)
          : (isAr ? 'تقارب كبير في معدل الثقة والموقع' : 'close alignment in location & active trust');

        const messageTextAr = `يقترح لك رفيقاً ذكياً: ${p.displayName || p.name} في ${p.location || 'منطقتك'} لديه ${overlapStr}.`;
        const messageTextEn = `suggests an AI buddy match: ${p.displayName || p.name} in ${p.location || 'your area'} with ${overlapStr}.`;

        // Check if we already have this notification ID to avoid duplication
        const matchNotifId = `ai_smart_match_${p.id}`;
        setAppNotifications(prev => {
          if (prev.some(n => n.id === matchNotifId)) return prev;
          
          // Toast trigger safely
          setTimeout(() => {
            triggerNotification(
              `اقتراح الرفيق الذكي: ${p.displayName || p.name}`,
              `Smart Buddy Match: ${p.displayName || p.name}`,
              'success'
            );
          }, 1000);

          return [
            {
              id: matchNotifId,
              userId: currentUser.id,
              type: 'friend_request', // displays UserPlus icon
              actorId: p.id,
              actorName: 'AI Companion Assistant 🤖',
              actorAvatar: '🤖',
              targetId: p.id,
              message: isAr ? messageTextAr : messageTextEn,
              read: false,
              timestamp: new Date().toISOString()
            },
            ...prev
          ];
        });
      }
    }, 4500); // 4.5 seconds after loading profiles

    return () => clearTimeout(timer);
  }, [currentUser?.id, profiles.length]);

  // Navigation states
  const [prefillOuting, setPrefillOuting] = useState<any | null>(null);

  
  // Completed user registration handler
  const handleRegisterComplete = async (profile: Profile) => {
    if (!supabase) return;
    try {
      const fbUser = auth.currentUser;
      
      const isEmailProvider = fbUser?.providerData.some(p => p.providerId === 'password');
      const isSkipForced = sessionStorage.getItem('yallamate_skip_verify') === 'true';
      if (fbUser && isEmailProvider && !fbUser.emailVerified && !isSkipForced) {
        console.warn('[Register] Email not confirmed before completing registration.');
        alert(lang === 'ar' ? 'يرجى تأكيد بريدك الإلكتروني لتتمكن من استخدام التطبيق.' : 'Please verify your email address to access the application.');
        return;
      }

      let finalId = fbUser ? toUUID(fbUser.uid) : profile.id;
      if (!finalId || finalId.startsWith('user_')) {
        finalId = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
          const r = Math.random() * 16 | 0;
          const v = c === 'x' ? r : (r & 0x3 | 0x8);
          return v.toString(16);
        });
      }

      // Explicitly forcefully override trust and zero-out stats
      // to ensure a clean slate even if the Supabase record already existed and is being re-initialized
      const dbProfile = {
        ...profile,
        id: finalId,
        trustScore: 5,
        trips: 0,
        outings: 0,
        warnings: 0,
        warningCount: 0,
        joinedAt: new Date().toISOString(),
        lastActive: new Date().toISOString(),
        preferred_lang: lang,
        onboarding_completed: true,
      };
      
      await syncProfileToDb(dbProfile);
      
      setCurrentUser(dbProfile);
      localStorage.setItem('yallamate_current_user', JSON.stringify(dbProfile));
      
      if (!fbUser || (isEmailProvider && !fbUser.emailVerified)) {
         if (isSkipForced) {
           setEmailVerified(true);
         } else {
           setEmailVerified(false);
         }
      } else {
         setEmailVerified(true);
      }
    } catch (e) {
      console.error("Failed to register user to Supabase:", e);
    }
  };

  // Create proposed outing handler
  // Reel publication sync
  const handlePublishReel = (newReel: Reel) => {
    setReels(prev => [newReel, ...prev]);
    triggerNotification(
      lang === 'ar' ? 'تم نشر الريلز بنجاح! 🎥' : 'Reel published successfully! 🎥',
      lang === 'ar' ? 'تم نشر الريلز بنجاح! 🎥' : 'Reel published successfully! 🎥',
      'success'
    );
  };

  const handleSaveOuting = async (newOuting: Outing) => {
    if (!supabase) {
      triggerNotification(
        'فشل النشر: نظام Supabase غير متصل',
        'Publishing failed: Supabase not connected',
        'warning'
      );
      return;
    }

    // Detect if current user is using a sandbox/mock ID (which is non-UUID format)
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(currentUser?.id || '');
    if (!isUUID) {
      console.info("[handleSaveOuting] Sandbox/Bypass user detected. Local only mode.");
      triggerNotification(
        'تنبيه: أنت تعمل في وضع التجربة، لن يتم حفظ الطلعة في خوادم Supabase إلا بعد تسجيل دخول حقيقي.',
        'Warning: You are in sandbox mode. Outing will not be saved to Supabase without a real account.',
        'info'
      );
      return;
    }
    
    try {
      const sanitized = sanitizeOutingForDb(newOuting);
      const { error } = await supabase.from('outings').upsert([sanitized]);
      if (error) throw error;
      
      // Add creator to outing_participants
      await supabase.from('outing_participants').insert([{
        outing_id: newOuting.id,
        user_id: newOuting.creatorId,
        role: newOuting.logistics?.hasDriver ? 'driver' : 'organizer',
        status: 'joined'
      }]);

      triggerNotification(
        'تم نشر الطلعة بنجاح! 🎉',
        'Outing published successfully! 🎉',
        'success'
      );

      // Create new initial chat channel
      const welcomeMsg: Message = {
        id: `system_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        outingId: newOuting.id,
        senderId: 'system',
        senderName: 'YallaMate System',
        senderAvatar: '🤖',
        content: lang === 'ar' 
          ? `مرحباً! تم إنشاء " ${newOuting.title} " بنجاح. يمكنكم الآن التنسيق هنا.`
          : `Welcome! " ${newOuting.title} " has been created. Start coordinating here.`,
        timestamp: new Date().toISOString(),
        isSystem: true,
      };
      
      await supabase.from('direct_messages').insert([welcomeMsg]);

      setPrefillOuting(null);
      setIsCreatingOuting(false);
      setSelectedOutingId(newOuting.id); // Guide user automatically to details page!

      analytics.trackEvent('outing_created', { category: newOuting.category, outingId: newOuting.id });

    } catch (e: any) {
      console.error("[YallaMate DB Debug Error] Failed to save outing to Supabase!", {
        table: 'outings',
        operation: 'upsert',
        errorMessage: e?.message || String(e),
        errorCode: e?.code || 'N/A',
        errorDetails: e?.details || 'N/A',
        errorHint: e?.hint || 'N/A',
        payloadAttempted: sanitizeOutingForDb(newOuting)
      });
      
      const realErrorMsg = e?.message || String(e);
      const code = e?.code || 'N/A';
      const hint = e?.hint || 'N/A';
      const details = e?.details || 'N/A';
      
      let errorType = 'Generic Database Error / خطأ عام في قاعدة البيانات';
      let sqlSolution = 'يرجى تشغيل ملف SQL المحدث (supabase_setup_fixed.sql) في منصة Supabase لإعادة بناء الجداول وتحديث الصلاحيات.';

      if (code === '42501' || realErrorMsg.includes('row-level security') || realErrorMsg.includes('violates row-level security')) {
        errorType = 'RLS Policy Restriction / رفض بسبب سياسة الحماية RLS';
        sqlSolution = `-- تمنع سياسة RLS المستخدم المسجل من إدخال أو تعديل الطلعة. لتصحيح ذلك، يرجى تشغيل الأسطر التالية بـ SQL:\nCREATE POLICY "Permissive" ON public.outings FOR ALL USING (true) WITH CHECK (true);`;
      } else if (code === '42703' || realErrorMsg.includes('column') || realErrorMsg.includes('does not exist')) {
        errorType = 'Missing Column / حقل مفقود بجدول الطلعات';
        sqlSolution = `-- بعض الحقول مفقودة. لتصحيح ذلك، يرجى تشغيل الأسطر التالية بـ SQL:\nALTER TABLE public.outings ADD COLUMN IF NOT EXISTS "creatorTrust" numeric default 0;\nALTER TABLE public.outings ADD COLUMN IF NOT EXISTS "minTrustScore" numeric default 0;\nALTER TABLE public.outings ADD COLUMN IF NOT EXISTS "attendeeIds" text[] default '{}';\nALTER TABLE public.outings ADD COLUMN IF NOT EXISTS "logistics" jsonb;\nALTER TABLE public.outings ADD COLUMN IF NOT EXISTS "coverImage" text;`;
      } else if (code === '42P01') {
        errorType = 'Missing Table / جدول الطلعات مفقود';
        sqlSolution = `-- جدول outings غير موجود على الإطلاق. يرجى إنشاء جدول الطلعات باستخدام ملف supabase_setup_fixed.sql`;
      } else if (code === '42804' || realErrorMsg.includes('datatype') || realErrorMsg.includes('type mismatch') || realErrorMsg.includes('cannot be cast')) {
        errorType = 'Data Type Mismatch / تعارض في نوع البيانات';
        sqlSolution = `-- تعارض في نوع المعطيات. يرجى تشغيل ملف supabase_setup_fixed.sql لإعادة تشكيل أنواع البيانات للأعمدة للتوافق مع UUID ونصوص المعرفات.`;
      }

      setOutingErrorModal({
        isOpen: true,
        errorType,
        errorMessage: realErrorMsg,
        errorCode: code,
        errorHint: hint,
        errorDetails: details,
        sqlSolution,
        payloadDump: JSON.stringify(sanitizeOutingForDb(newOuting), null, 2)
      });

      triggerNotification(
        lang === 'ar' ? `⚠️ خطأ تقني في قاعدة البيانات` : `⚠️ Technical Database Error`,
        lang === 'ar' ? `⚠️ خطأ تقني: ${errorType}` : `⚠️ Database Error: ${errorType}`,
        'warning'
      );
    }
  };

  // Join outing cohort
  const handleJoinOuting = async (outingId: string) => {
    if (!currentUser) return;
    haptic(30);

    if (currentUser.suspended) {
      triggerNotification(t.suspensionWarning, t.suspensionWarning, 'warning');
      return;
    }

    const outing = outings.find(o => o.id === outingId);
    if (!outing) return;

    const userGender = currentUser.gender || 'male';

    // 1. Gender-segregated outing match (Men with men, women with women)
    if (outing.genderRestriction === 'men_only' && userGender !== 'male') {
      const msg = lang === 'ar' ? translations.ar.genderMismatchError : translations.en.genderMismatchError;
      triggerNotification(msg, msg, 'warning');
      return;
    }
    if (outing.genderRestriction === 'women_only' && userGender !== 'female') {
      const msg = lang === 'ar' ? translations.ar.genderMismatchError : translations.en.genderMismatchError;
      triggerNotification(msg, msg, 'warning');
      return;
    }

    // 2. Trust Score Verification (defaulting to 0 for new users, but allowing new users to join)
    const minTrust = Math.max(outing.minTrustScore || 0, 5);
    const isNewUser = !currentUser.trustScore || currentUser.trustScore === 0;
    if (!isNewUser && (currentUser.trustScore || 0) < minTrust) {
        const msg = lang === 'ar' ? 'عذراً، مستوى موثوقيتك لا يسمح بالانضمام لهذه الطلعة (يجب أن يكون ٥ فأكثر).' : 'Sorry, your trust score is too low to join this outing (must be at least 5).';
        triggerNotification(msg, msg, 'error');
        return;
    }

    // 2. Co-ed joint outings require BOTH the creator and joiner to have trust scores > 9.0
    if (outing.genderRestriction === 'co_ed') {
      if (currentUser.trustScore < 9.0) {
        const msg = lang === 'ar' ? translations.ar.coEdDeniedError : translations.en.coEdDeniedError;
        triggerNotification(msg, msg, 'warning');
        return;
      }
    }

    if (currentUser.trustScore < 5.0) {
      const msgAr = `حظر كود الأمان للثقة: هذه الطلعة تتطلب معدل ثقة قدره ★ 5.0+. معدلك الحالي هو ★ ${currentUser.trustScore.toFixed(2)}.`;
      const msgEn = `${t.trustSafeguardWarning} ★ 5.0+. Your score is ★ ${currentUser.trustScore.toFixed(2)}.`;
      triggerNotification(msgAr, msgEn, 'warning');
      return;
    }

    if ((outing.attendeeIds?.length || 0) >= outing.maxAttendees) {
      triggerNotification(t.ceilingWarning, t.ceilingWarning, 'warning');
      return;
    }

    // Update outings attendees list in Supabase
    try {
      await supabase
        .from('outings')
        .update({
          attendeeIds: [...outing.attendeeIds, currentUser.id]
        })
        .eq('id', outingId);

      // Add to outing_participants
      await supabase
        .from('outing_participants')
        .insert([{
          outing_id: outingId,
          user_id: currentUser.id,
          role: 'member',
          status: 'joined'
        }]);

      triggerNotification(
        '🎉 تهانينا! لقد انضممت بنجاح لهذه الطلعة مع رفقائك.',
        '🎉 Hurrah! You have successfully joined this outing with your mates.',
        'success'
      );
      
      analytics.trackEvent('outing_joined', { outingId });
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, `outings/join/${outingId}`);
      return;
    }

    // Post joined system message inside chat
    const systemNotice: Message = {
      id: `system_${Date.now()}`,
      outingId: outingId,
      senderId: 'system',
      senderName: 'YallaMate System',
      senderAvatar: '🤖',
      content: `${currentUser.avatar} ${currentUser.name} has joined this cohort! Punctuality filter passed. Coordinates visible.`,
      timestamp: new Date().toISOString(),
      isSystem: true,
    };

    try {
      await supabase.from('direct_messages').insert([systemNotice]);
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, 'direct_messages');
    }
  };

  // Leave outing cohort
  const handleLeaveOuting = async (outingId: string) => {
    setLeaveOutingConfirmId(outingId);
  };

  const executeLeaveOuting = async (outingId: string) => {
    setLeaveOutingConfirmId(null);
    if (!currentUser || !supabase) return;

    const targetOuting = outings.find(o => o.id === outingId);
    if (!targetOuting) return;
    const wasOngoing = targetOuting.status === 'ongoing';

    if (wasOngoing) {
      setCurrentUser(prev => {
        if (!prev) return null;
        // Deduct 2.5 score points on a 10.0 scale, increment community warnings
        const newScore = Math.max(0.0, Number(((prev.trustScore || 9.5) - 2.5).toFixed(1)));
        const updated = {
          ...prev,
          trustScore: newScore,
          warningCount: (prev.warningCount || 0) + 1
        };
        localStorage.setItem('yallamate_current_user', JSON.stringify(updated));
        return updated;
      });

      triggerNotification(
        `⚠️ تم خصم -2.5 نقطة من معدل الثقة الخاص بك وتوجيه إنذار لحسابك بسبب الانسحاب من طلعة مفعلة وبدأت بالفعل!`,
        `⚠️ Penalty applied: -2.5 points deducted from your Trust Score and a warning added to your account for withdrawing from a started outing!`,
        'warning'
      );
    }

    // Leave the outing in Supabase or delete if empty
    const remainingAttendees = targetOuting.attendeeIds.filter(id => id !== currentUser.id);
    try {
      if (remainingAttendees.length === 0) {
        await supabase
          .from('outings')
          .delete()
          .eq('id', outingId);

        triggerNotification(
          '👋 لقد ألغيت/حذفت هذه الطلعة لأنه لم يتبقَ أي رفقاء مشاركين فيها.',
          '👋 You have deleted this outing since there are no remaining participants.',
          'success'
        );
      } else {
        await supabase
          .from('outings')
          .update({
            attendeeIds: remainingAttendees
          })
          .eq('id', outingId);

        triggerNotification(
          '👋 لقد انسحبت بنجاح من هذه الطلعة.',
          '👋 You have successfully left this outing.',
          'success'
        );
      }
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, `outings/leave/${outingId}`);
      return;
    }

    // Post departed notice inside chat
    const systemNotice: Message = {
      id: `system_${Date.now()}`,
      outingId: outingId,
      senderId: 'system',
      senderName: 'YallaMate System',
      senderAvatar: '🤖',
      content: wasOngoing 
        ? `${currentUser.avatar} ${currentUser.name} has abandoned active outing. Seat emptied under community penalty!`
        : `${currentUser.avatar} ${currentUser.name} has left this cohort. Seats updated.`,
      timestamp: new Date().toISOString(),
      isSystem: true,
    };

    try {
      await supabase.from('direct_messages').insert([systemNotice]);
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, 'direct_messages');
    }
    
    // Auto-close detail view if we are viewing it
    if (selectedOutingId === outingId) {
      setModalState('selected_outing', false);
    }
  };

  const [notifications, setNotifications] = useState<{ id: string, ar: string, en: string, type: 'success' | 'error' | 'info' | 'warning' }[]>([]);

  const triggerNotification = (ar: string, en: string, type: 'success' | 'error' | 'info' | 'warning' = 'info') => {
    // Check if snooze is active
    const snoozeUntil = localStorage.getItem('yallamate_notifications_snooze_until');
    if (snoozeUntil) {
      try {
        if (new Date() < new Date(snoozeUntil)) {
          console.log('Notification suppressed (snoozed):', en);
          return;
        }
      } catch (e) {
        console.error('Error parsing snooze date:', e);
      }
    }

    const id = Date.now().toString() + Math.random().toString();
    setNotifications(prev => [...prev, { id, ar, en, type }]);
    
    // Tactile haptic feedback for notifications
    try {
      if (type === 'error') {
        haptic([100, 50, 100]); // stronger pattern for error
      } else if (type === 'success') {
        haptic([30, 80, 30]); // pleasant pattern for success
      } else if (type === 'warning') {
        haptic([80, 50, 80]); // warning pulse
      } else {
        haptic(25); // simple light tap for info
      }
    } catch (err) {
      console.warn('Haptic vibration failed:', err);
    }

    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 5000);
  };

  useEffect(() => {
    const handleDbError = (evt: Event) => {
      const detail = (evt as CustomEvent).detail;
      const opNameAr = detail.op === 'create' ? 'إضافة' : detail.op === 'delete' ? 'حذف' : 'تحديث';
      const opNameEn = detail.op === 'create' ? 'creating' : detail.op === 'delete' ? 'deleting' : 'updating';
      
      triggerNotification(
        `فشلت عملية الـ ${opNameAr} في قاعدة البيانات (${detail.path}): ${detail.error}`,
        `Database ${opNameEn} failed on ${detail.path}: ${detail.error}`,
        'error'
      );
    };

    window.addEventListener('db_transaction_error', handleDbError);
    return () => window.removeEventListener('db_transaction_error', handleDbError);
  }, []);

  // Monitor upcoming registered outings and alert 30 minutes before departure
  useEffect(() => {
    if (!currentUser || !outings || outings.length === 0) return;

    const checkOutingsForAlerts = () => {
      const now = new Date();
      const thirtyMinutesFromNow = new Date(now.getTime() + 30 * 60 * 1000);

      outings.forEach(outing => {
        // Only alert if the user is registered/joined the outing, it's upcoming, and hasn't been alerted yet
        if (
          outing.status === 'upcoming' &&
          outing.attendeeIds?.includes(currentUser.id) &&
          !alertedOutingIds.includes(outing.id)
        ) {
          const start = new Date(outing.datetime);
          // Check if start is in the future and less than or equal to 30 minutes away
          if (start > now && start <= thirtyMinutesFromNow) {
            const msgAr = `تبقت ٣٠ دقيقة على انطلاق طلعتك "${outing.title}"! يرجى الاستعداد والتحرك للموقع.`;
            const msgEn = `30 minutes left until your outing "${outing.title}" starts! Please prepare and head to the location.`;
            
            // Add to persistent appNotifications
            const newNotif: AppNotification = {
              id: `prep_alert_${outing.id}_${Date.now()}`,
              userId: currentUser.id,
              type: 'outing_invite',
              actorId: 'system_bot',
              actorName: 'YallaMates BOT',
              actorAvatar: '🤖',
              message: lang === 'ar' ? msgAr : msgEn,
              read: false,
              timestamp: new Date().toISOString()
            };

            setAppNotifications(prev => [newNotif, ...prev]);

            // Trigger modern local toast notification
            triggerNotification(msgAr, msgEn, 'warning');

            // Mark as alerted
            setAlertedOutingIds(prev => [...prev, outing.id]);
          }
        }
      });
    };

    // Run immediately on load/change
    checkOutingsForAlerts();

    // Check every 30 seconds (or 120 seconds in low-power mode)
    const checkIntervalMs = lowPowerMode ? 120000 : 30000;
    const interval = setInterval(checkOutingsForAlerts, checkIntervalMs);
    return () => clearInterval(interval);
  }, [outings, currentUser, alertedOutingIds, lang, lowPowerMode]);

  const handleEndOuting = async (outingId: string) => {
    if (!supabase) return;
    const outing = outings.find(o => o.id === outingId);
    if (outing) {
      try {
        await supabase
          .from('outings')
          .update({
            status: 'completed'
          })
          .eq('id', outingId);
      } catch (e) {
        console.error("Failed to end outing in Supabase:", e);
      }
    }
    
    triggerNotification(
      'تم إنهاء الرحلة! يمكنك الآن تقييم الرفاق.',
      'Outing completed! You can now review your companions.',
      'success'
    );

    const systemNotice: Message = {
      id: `msg_${Date.now()}`,
      outingId: outingId,
      senderId: 'system',
      senderName: 'YallaMate System',
      senderAvatar: '🌟',
      content: lang === 'ar' ? 'انتهت الرحلة! نرجو منكم تقييم الرفاق ليتم تحديث نقاط الثقة.' : 'Outing has ended! Please review your companions to update trust scores.',
      timestamp: new Date().toISOString(),
      isSystem: true,
    };

    try {
      await supabase.from('direct_messages').insert([systemNotice]);
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, 'direct_messages');
    }
  };

  // Send Chat message handler
  const handleSendMessage = async (outingId: string, text: string, imageUrl?: string, locationUrl?: string) => {
    if (!currentUser || !supabase) return;

    const msgId = `msg_${Date.now()}`;
    const newMsg: Message = {
      id: msgId,
      outingId,
      senderId: currentUser.id,
      senderName: currentUser.name,
      senderAvatar: currentUser.avatar,
      content: text,
      timestamp: new Date().toISOString(),
      ...(imageUrl ? { imageUrl } : {}),
      ...(locationUrl ? { locationUrl } : {}),
    };

    return executeTransactionalOp(
      'message',
      'outing_messages',
      newMsg,
      async () => {
        // 1. Optimistic Update in Cache
        const cacheKey = `mates_cached_msgs_${outingId}`;
        const cachedStr = localStorage.getItem(cacheKey);
        const existingMsgs = cachedStr ? JSON.parse(cachedStr) : [];
        const restoredMsgs = [...existingMsgs];
        
        localStorage.setItem(cacheKey, JSON.stringify([...existingMsgs, newMsg]));
        window.dispatchEvent(new CustomEvent('optimistic_message_added', { detail: { chatId: outingId } }));

        // 2. Perform DB insert
        const { error } = await supabase.from('direct_messages').insert([newMsg]);
        
        if (error) {
          // Automatic Rollback in catch of executeTransactionalOp handles notification,
          // but we also need to revert the specific local cache here
          localStorage.setItem(cacheKey, JSON.stringify(restoredMsgs));
          window.dispatchEvent(new CustomEvent('optimistic_message_added', { detail: { chatId: outingId } }));
          return { error };
        }
        
        return { error: null };
      }
    );
  };

  // Post-outing Review completion: Calculates the new reputation and updates accountability warnings
  const handleCompleteReview = async (review: Partial<OutingReview>) => {
    const { revieweeId, respectfulRating, punctualRating, paymentRating } = review;
    if (!revieweeId || !respectfulRating || !punctualRating || !paymentRating || !supabase || !currentUser) return;

    // Detect if involved users are sandbox
    const isReviewerUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(currentUser.id);
    const isRevieweeUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(revieweeId);
    
    if (!isReviewerUUID || !isRevieweeUUID) {
      console.info("[handleCompleteReview] Sandbox users involved. Review will not persist.");
      triggerNotification(
        'عذراً، يجب تسجيل الدخول الحقيقي لتقييم الرفاق.',
        'Auth required to review mates and persist reputation changes.',
        'info'
      );
      return;
    }

    try {
      const newReviewItem: OutingReview = {
        id: `rev_${Date.now()}`,
        outingId: review.outingId || '',
        reviewerId: currentUser.id,
        revieweeId: revieweeId,
        respectfulRating: respectfulRating,
        punctualRating: punctualRating,
        paymentRating: paymentRating,
        friendlyRating: review.friendlyRating || 5,
        venueRating: review.venueRating || 5,
        hostRating: review.hostRating || 5,
        comment: review.comment || ''
      };

      setCompanionReviews(prev => {
        const next = [...prev, newReviewItem];
        localStorage.setItem('yallamate_companion_reviews', JSON.stringify(next));
        return next;
      });

      // 1. Save the review document
      await supabase.from('companion_reviews').insert([{
        ...review,
        reviewerId: currentUser?.id,
        timestamp: new Date().toISOString()
      }]);

      // 2. Calculate the new score based on punctuality, friendliness, respectful, and payment ratings
      const scoreSum = (respectfulRating + punctualRating + paymentRating + (review.friendlyRating || 5)) / 4;
      
      const targetProfile = profiles.find(p => p.id === revieweeId);
      if (!targetProfile) return;

      const updatedTrustScore = Math.min(5.0, ((targetProfile.trustScore || 5.0) + scoreSum) / 2);
      
      let newWarningCount = targetProfile.warningCount || 0;
      let isSuspended = targetProfile.suspended || false;

      if (scoreSum < 3.2) {
        newWarningCount += 1;
        if (newWarningCount >= 3) {
          isSuspended = true;
        }
      }

      let currentXp = targetProfile.xp || 0;
      let currentLevel = targetProfile.level || 1;
      const earnedXp = scoreSum >= 3.5 ? 50 : 15;
      let nextXp = currentXp + earnedXp;
      const xpThreshold = currentLevel * 100;
      if (nextXp >= xpThreshold) {
        nextXp -= xpThreshold;
        currentLevel += 1;
      }

      // 3. Update target User document natively
      await supabase
        .from('users')
        .update({
          trustScore: parseFloat(updatedTrustScore.toFixed(2)),
          warningCount: newWarningCount,
          suspended: isSuspended,
          xp: nextXp,
          level: currentLevel
        })
        .eq('id', revieweeId);

      triggerNotification(
        'تم إرسال التقييم وتحديث حساب الموثوقية بنجاح.',
        'Review submitted and trust scores updated successfully.',
        'success'
      );
    } catch (e) {
      console.error("Failed to complete review natively in Supabase:", e);
    }
  };

  const handleUpdateArchetype = async (archetype: string) => {
    if (!currentUser) return;
    
    // Update local state immediately
    const updatedUser = { ...currentUser, archetype };
    setCurrentUser(updatedUser);
    setProfiles(prev => prev.map(p => p.id === currentUser.id ? updatedUser : p));

    // Update Supabase if real user
    const isRealUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(currentUser.id);
    if (isRealUUID && supabase) {
      try {
        await supabase
          .from('users')
          .update({ archetype })
          .eq('id', currentUser.id);
      } catch (e) {
        console.error("Failed to persist archetype in Supabase:", e);
      }
    }

    triggerNotification(
      `تهانينا! تم تحديد نمطك الاجتماعي كـ: ${archetype}`,
      `Awesome! Your social personality archetype has been set to: ${archetype}`,
      'success'
    );
  };

  const handleUpdateProfileAI = (updatedFields: Partial<Profile>) => {
    if (!currentUser) return;
    const updatedUser = { ...currentUser, ...updatedFields };
    setCurrentUser(updatedUser);
    setProfiles(prev => prev.map(p => p.id === currentUser.id ? updatedUser : p));
    const isRealUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(currentUser.id);
    if (isRealUUID && supabase) {
      supabase.from('users').update(updatedFields).eq('id', currentUser.id).then(({ error }) => {
        if (error) console.error("Failed to sync AI update to Supabase:", error);
      });
    }
  };

  const handleAddNotificationAI = (notif: { title: string; bodyAr: string; bodyEn: string; type: string }) => {
    const newNotif: AppNotification = {
      id: `notif_${Date.now()}`,
      userId: currentUser?.id || 'anonymous',
      type: 'friend_request_accepted',
      actorId: 'ai_murshed',
      actorName: lang === 'ar' ? 'المرشد الذكي 🤖' : 'Murshed AI 🤖',
      actorAvatar: '🤖',
      message: lang === 'ar' ? notif.bodyAr : notif.bodyEn,
      read: false,
      timestamp: new Date().toISOString()
    };
    setAppNotifications(prev => [newNotif, ...prev]);
  };

  const handleToggleFriend = async (friendId: string) => {
    if (!currentUser || !supabase) return;

    const isRemoving = friendsList.includes(friendId);
    
    return executeTransactionalOp(
      isRemoving ? 'unfollow' : 'friendship',
      'friend_requests',
      { friend_id: friendId },
      async () => {
        const previousFriends = [...friendsList];
        const cacheKey = `mates_cached_friends_${currentUser.id}`;
        const cachedFriendsStr = localStorage.getItem(cacheKey);
        const originalCachedFriends = cachedFriendsStr ? JSON.parse(cachedFriendsStr) : [];

        // Optimistic local update
        if (isRemoving) {
          setFriendsList(prev => prev.filter(id => id !== friendId));
          localStorage.setItem(cacheKey, JSON.stringify(originalCachedFriends.filter((f: any) => f.id !== friendId)));
        } else {
          setFriendsList(prev => [...prev, friendId]);
          const profileInfo = profiles.find((p: any) => p.id === friendId) || { id: friendId, name: 'Mate', avatar: '👤' };
          const newCache = [...originalCachedFriends];
          if (!newCache.some(f => f.id === friendId)) {
            newCache.push({ id: friendId, name: profileInfo.name || 'Mate', avatar: profileInfo.avatar || '👤', trustScore: (profileInfo as any).trustScore || 4.8 });
          }
          localStorage.setItem(cacheKey, JSON.stringify(newCache));
        }

        try {
          if (isRemoving) {
            const { error } = await supabase
              .from('friend_requests')
              .delete()
              .or(`and("senderId".eq.${currentUser.id},"receiverId".eq.${friendId}),and("senderId".eq.${friendId},"receiverId".eq.${currentUser.id})`);
            if (error) throw error;
          } else {
            const targetProfile = profiles.find((p: any) => p.id === friendId);
            const isPublicProfile = !targetProfile || targetProfile.privacyStatus === 'public';

            if (isPublicProfile) {
              const { error } = await supabase.from('friend_requests').insert([{
                id: crypto.randomUUID(),
                senderId: currentUser.id,
                receiverId: friendId,
                status: 'accepted',
                senderName: currentUser.name,
                senderAvatar: currentUser.avatar,
                timestamp: new Date().toISOString()
              }]);
              if (error) throw error;
            } else {
              const { error } = await supabase.from('friend_requests').insert([{
                id: crypto.randomUUID(),
                senderId: currentUser.id,
                receiverId: friendId,
                status: 'pending',
                senderName: currentUser.name,
                senderAvatar: currentUser.avatar,
                timestamp: new Date().toISOString()
              }]);
              if (error) throw error;
            }
          }
          return { error: null };
        } catch (err) {
          // Revert local state
          setFriendsList(previousFriends);
          localStorage.setItem(cacheKey, JSON.stringify(originalCachedFriends));
          return { error: err };
        }
      }
    );
  };

  const handleOptimisticDirectMessage = async (chatId: string, receiverId: string, content: string, type: string = 'text', imageUrl?: string, locationUrl?: string) => {
    if (!currentUser || !supabase) return;

    const msgId = crypto.randomUUID();
    const optimisticMsg = {
      id: msgId,
      chatId,
      senderId: currentUser.id,
      receiverId,
      content,
      type,
      timestamp: new Date().toISOString(),
      imageUrl,
      locationUrl
    };

    return executeTransactionalOp(
      'message',
      'direct_messages',
      optimisticMsg,
      async () => {
        const cacheKey = `mates_cached_msgs_${chatId}`;
        const cachedStr = localStorage.getItem(cacheKey);
        const existingMsgs = cachedStr ? JSON.parse(cachedStr) : [];
        const restoredMsgs = [...existingMsgs];
        
        localStorage.setItem(cacheKey, JSON.stringify([...existingMsgs, optimisticMsg]));
        window.dispatchEvent(new CustomEvent('optimistic_message_added', { detail: { chatId } }));

        const { error } = await supabase.from('direct_messages').insert([optimisticMsg]);
        if (error) {
          localStorage.setItem(cacheKey, JSON.stringify(restoredMsgs));
          window.dispatchEvent(new CustomEvent('optimistic_message_added', { detail: { chatId } }));
          return { error };
        }
        return { error: null };
      }
    );
  };
  
  const handleOptimisticFriendRequest = async (receiverId: string) => {
    if (!currentUser || !supabase) return;
    
    const reqId = crypto.randomUUID();
    const optimisticReq = {
      id: reqId,
      senderId: currentUser.id,
      receiverId,
      status: 'pending',
      senderName: currentUser.name,
      senderAvatar: currentUser.avatar,
      timestamp: new Date().toISOString()
    };
    
    return executeTransactionalOp(
      'friendship',
      'friend_requests',
      optimisticReq,
      async () => {
        const cacheKey = `mates_cached_pending_reqs_${currentUser.id}`;
        const cachedStr = localStorage.getItem(cacheKey);
        const existingCache = cachedStr ? JSON.parse(cachedStr) : { pending: [], sent: [] };
        const restoredCache = JSON.parse(JSON.stringify(existingCache));
        
        if (!existingCache.sent.includes(receiverId)) {
          existingCache.sent.push(receiverId);
        }
        localStorage.setItem(cacheKey, JSON.stringify(existingCache));
        window.dispatchEvent(new Event('optimistic_friend_requests_updated'));
        
        const { error } = await supabase.from('friend_requests').insert([optimisticReq]);
        if (error) {
          localStorage.setItem(cacheKey, JSON.stringify(restoredCache));
          window.dispatchEvent(new Event('optimistic_friend_requests_updated'));
          return { error };
        }
        return { error: null };
      }
    );
  };

  const handleLogout = async () => {
    if (supabase) {
      try {
        await supabase.auth.signOut();
      } catch (e) {
        console.error("Failed standard sign out:", e);
      }
    }
    try {
      await fbSignOut(auth);
    } catch (e) {
      console.error("Failed Firebase sign out:", e);
    }
    setCurrentUser(null);
    setSelectedOutingId(null);
    setIsCreatingOuting(false);
    localStorage.removeItem('yallamate_current_user');
    setCurrentTab('home');
  };

  // Lookup the currently selected outing object
  const activeOuting = outings.find(o => o.id === selectedOutingId) || null;

  // Render check: Set RTL direction state dynamically
  const dir = lang === 'ar' ? 'rtl' : 'ltr';

  const handleInitiatePrivateMessage = (profile: Profile) => {
    // 1. Close profile view modal to prevent visual layers from overlapping / getting stuck
    setModalState('viewing_profile', false);
    // 2. Open Direct Messages view
    setModalState('direct_messages', true, profile);
  };

  // Swipe to navigate config
  const tabSequence: ('home' | 'reels' | 'explore' | 'community' | 'profile')[] = ['home', 'reels', 'explore', 'community', 'profile'];
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    const targetElement = e.target as HTMLElement;
    // Don't intercept scrolls on horizontal scrolling containers or map elements
    if (targetElement.closest('.no-swipe') || targetElement.closest('.overflow-x-auto')) {
      return;
    }
    const touch = e.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartRef.current) return;
    const touch = e.changedTouches[0];
    const diffX = touch.clientX - touchStartRef.current.x;
    const diffY = touch.clientY - touchStartRef.current.y;
    touchStartRef.current = null;

    if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 70) {
      const currentIndex = tabSequence.indexOf(currentTab as any);
      if (currentIndex === -1) return;

      const isAr = lang === 'ar';
      // In LTR: swipe left (diffX < 0) means Next tab
      // In RTL: swipe right (diffX > 0) means Next tab
      const isNext = isAr ? diffX > 0 : diffX < 0;

      if (isNext) {
        const nextIndex = Math.min(currentIndex + 1, tabSequence.length - 1);
        setCurrentTab(tabSequence[nextIndex]);
      } else {
        const prevIndex = Math.max(currentIndex - 1, 0);
        setCurrentTab(tabSequence[prevIndex]);
      }
    }
  };

  const [migrationRunning, setMigrationRunning] = useState(false);
  const [migrationResult, setMigrationResult] = useState<{ success: boolean; msg: string } | null>(null);
  const [copyingState, setCopyingState] = useState<{ [key: string]: boolean }>({});

  const copySqlPart = async (part: 1 | 2) => {
    try {
      const fileName = `/supabase_part${part}.sql`;
      const res = await fetch(fileName);
      if (!res.ok) throw new Error('Failed to fetch partition file');
      const text = await res.text();
      await navigator.clipboard.writeText(text);
      setCopyingState(prev => ({ ...prev, [part]: true }));
      triggerNotification(
        lang === 'ar' ? `تم نسخ القسم ${part === 1 ? 'الأول' : 'الثاني'}! 📋` : `Part ${part} Copied! 📋`,
        lang === 'ar' 
          ? `قم بلصقه في SQL Edit بـ Supabase واضغط Run.` 
          : `Paste it in your Supabase SQL Editor and press Run.`,
        'success'
      );
      setTimeout(() => {
        setCopyingState(prev => ({ ...prev, [part]: false }));
      }, 3000);
    } catch (e) {
      triggerNotification(
        lang === 'ar' ? 'فشل نسخ كود الـ SQL' : 'Failed to copy SQL',
        lang === 'ar' 
          ? 'تأكد من وجود الملفات في خادم الويب الخاص بك.' 
          : 'Make sure partition files are served from your host.',
        'warning'
      );
    }
  };

  const runDatabaseMigration = async () => {
    if (!supabase) return;
    setMigrationRunning(true);
    setMigrationResult(null);
    try {
      console.log('[runDatabaseMigration] Initiating auto-migration with structured splitting...');
      
      const sqlFiles = ['/supabase_setup_fixed.sql', '/supabase_social_rpc.sql'];
      let executedCount = 0;
      let failedCount = 0;
      const lastErrors: string[] = [];

      for (const sqlFile of sqlFiles) {
        try {
          const res = await fetch(sqlFile);
          if (!res.ok) {
            console.warn(`[runDatabaseMigration] Skipping ${sqlFile} as it returned ${res.status}`);
            continue;
          }
          const sqlContent = await res.text();
          
          // Parse SQL content into standalone logic blocks
          const lines = sqlContent.split(/\r?\n/);
          const statements: string[] = [];
          let currentStatement = '';
          let inDollarQuote = false;
          
          for (const line of lines) {
            const trimmed = line.trim();
            if (!currentStatement && (!trimmed || trimmed.startsWith('--'))) continue;
            
            currentStatement += line + '\n';
            const lineWithoutComments = line.split('--')[0];
            const occurrences = (lineWithoutComments.match(/\$\$/g) || []).length;
            if (occurrences % 2 !== 0) inDollarQuote = !inDollarQuote;
            
            if (!inDollarQuote && trimmed.endsWith(';')) {
              statements.push(currentStatement.trim());
              currentStatement = '';
            }
          }
          if (currentStatement.trim()) statements.push(currentStatement.trim());

          console.log(`[runDatabaseMigration] Executing ${statements.length} blocks from ${sqlFile}...`);
          
          for (let i = 0; i < statements.length; i++) {
            const stmt = statements[i];
            if (!stmt) continue;
            const { data, error } = await supabase.rpc('execute_sql', { sql_query: stmt });
            if (error || (data && data.startsWith('SQL Error:'))) {
              failedCount++;
              lastErrors.push(error?.message || data);
            } else {
              executedCount++;
            }
          }
        } catch (err: any) {
          console.error(`[runDatabaseMigration] Failed to process ${sqlFile}:`, err);
        }
      }

      console.log(`[runDatabaseMigration] Completed sequence execution. Succeeded: ${executedCount}, Failed: ${failedCount}.`);
      
      if (executedCount === 0 && failedCount > 0) {
        throw new Error(`All SQL statement blocks failed execution. Primary cause: ${lastErrors[0]}`);
      }

      setMigrationResult({
        success: true,
        msg: lang === 'ar' 
          ? `تم تطبيق الإصلاح بنجاح! تم تشغيل ${executedCount} كتل برمجية وتحديث قاعدة البيانات.` 
          : `Repair complete! Successfully executed ${executedCount} SQL statement blocks.`
      });
      
      // Trigger a clean re-scan
      const checkResult = await verifyDatabaseIntegrity();
      const rlsResult = await validateOutingRlsPolicies();
      const combinedErrors = [...checkResult.errors, ...rlsResult.errors];
      setDbCompletenessErrors(combinedErrors);
      
      triggerNotification(
        lang === 'ar' ? 'تم تحديث قاعدة البيانات بنجاح! 🎉' : 'Database upgraded successfully! 🎉',
        lang === 'ar' ? 'تم تحديث قاعدة البيانات بنجاح! 🎉' : 'Database upgraded successfully! 🎉',
        'success'
      );
    } catch (err: any) {
      console.error('[runDatabaseMigration] Complete execution sequence failed:', err);
      const isMissingRpc = err.message?.includes('function public.execute_sql') || err.message?.includes('does not exist');
      const standardMsg = err.message || String(err);
      const friendlyStr = isMissingRpc 
        ? (lang === 'ar' ? 'لصلاحيات الحماية، يرجى نسخ الكود من ملف (supabase_setup_fixed.sql) وتشغيله مرة واحدة بـ SQL Schema Editor في لوحة تحكم Supabase.' : 'Security policy restriction. Please copy and run the schema code from (supabase_setup_fixed.sql) manually in the Supabase SQL editor once.')
        : standardMsg;
        
      setMigrationResult({
        success: false,
        msg: friendlyStr
      });
      // triggerNotification(
      //   lang === 'ar' ? 'فشل تشغيل الهجرة التلقائي' : 'Migration run failed',
      //   lang === 'ar' ? `خطأ: ${friendlyStr}` : `Error: ${friendlyStr}`,
      //   'warning'
      // );
    } finally {
      setMigrationRunning(false);
    }
  };

  if (isInitializingAuth) {
    return (
      <div dir={dir} className={`min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 font-sans ${lang === 'ar' ? 'font-arabic' : ''}`}>
        <div className="flex flex-col items-center justify-center gap-4">
          <Compass className="w-10 h-10 text-emerald-500 animate-spin" />
          <p className="text-slate-500 dark:text-slate-400 font-bold tracking-widest uppercase text-xs">
            {lang === 'ar' ? 'جاري التحميل...' : 'Loading...'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div 
      dir={dir} 
      className={`min-h-screen flex flex-col font-sans selection:bg-green-500/30 antialiased selection:text-green-900 ${lang === 'ar' ? 'font-arabic' : ''}`}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <OfflineSyncBar lang={lang} />
      
      {/* Notifications system */}
      <GlobalActionToast 
        toasts={notifications} 
        onRemove={(id) => setNotifications(prev => prev.filter(n => n.id !== id))} 
        lang={lang} 
      />

      {/* Floating Back Action if navHistory exists */}
      {navHistory.length > 0 && (
        <button
          onClick={() => triggerBack()}
          className={`fixed top-4 ${lang === 'ar' ? 'right-4' : 'left-4'} z-[110] p-2.5 bg-white/80 backdrop-blur border border-slate-200/50 rounded-full shadow-lg text-slate-700 hover:bg-white transition-all hover:scale-105 active:scale-95 cursor-pointer flex items-center justify-center`}
        >
          <ArrowLeft className={`w-5 h-5 ${lang === 'ar' ? 'rotate-180' : ''}`} />
        </button>
      )}

      {/* Floating Supabase Diagnostics Button */}
      <button
        onClick={() => setModalState('supabase_diagnostics', true)}
        className={`fixed top-4 ${lang === 'ar' ? 'left-4' : 'right-4'} z-50 px-3.5 py-2.5 bg-indigo-600/90 hover:bg-indigo-600 backdrop-blur text-white border border-indigo-500/50 rounded-full shadow-xl hover:scale-105 active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-1.5`}
        title="Supabase Diagnostics Audit"
      >
        <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0 select-none animate-pulse" />
        <span className="text-[10px] font-black uppercase tracking-wider select-none">
          {lang === 'ar' ? 'فحص جودة الاتصال ⚙️' : '⚙️ Supabase Audit'}
        </span>
      </button>

      {/* Floating Location Diagnostics Button */}
      <button
        onClick={() => setModalState('location_diagnostics', true)}
        className={`fixed top-16 ${lang === 'ar' ? 'left-4' : 'right-4'} z-50 px-3.5 py-2.5 bg-sky-600/90 hover:bg-sky-600 backdrop-blur text-white border border-sky-500/50 rounded-full shadow-xl hover:scale-105 active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-1.5`}
        title="Location Diagnostics Audit"
      >
        <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0 select-none animate-pulse" />
        <span className="text-[10px] font-black uppercase tracking-wider select-none">
          {lang === 'ar' ? 'فحص الموقع 📍' : '📍 Location Audit'}
        </span>
      </button>

      {/* Floating Nav Debugger Button */}
      <button
        onClick={() => setShowNavDebugPanel(!showNavDebugPanel)}
        className={`fixed top-[120px] ${lang === 'ar' ? 'left-4' : 'right-4'} z-50 px-3.5 py-2.5 bg-rose-600/90 hover:bg-rose-600 backdrop-blur text-white border border-rose-500/50 rounded-full shadow-xl hover:scale-105 active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-1.5`}
        title="Navigation Debugger Panel"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-rose-300 shrink-0 select-none animate-ping" />
        <span className="text-[10px] font-black uppercase tracking-wider select-none">
          {lang === 'ar' ? 'تشخيص التنقل 🛠️' : '🛠️ Nav Debugger'}
        </span>
      </button>

      {/* Navigation Debugger Panel */}
      <AnimatePresence>
        {showNavDebugPanel && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            className={`fixed top-[170px] ${lang === 'ar' ? 'left-4' : 'right-4'} w-[calc(100vw-2rem)] max-w-xs sm:w-80 sm:max-w-sm bg-slate-900/95 backdrop-blur-md border border-slate-700/60 rounded-2xl shadow-2xl z-[99999] p-4 font-sans text-slate-100 flex flex-col gap-3 max-h-[450px] overflow-y-auto`}
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center gap-1.5 text-rose-400 font-bold text-xs uppercase tracking-wider">
                <Compass className="w-4 h-4 animate-spin-slow" />
                <span>{lang === 'ar' ? 'مستكشف مسار التنقل' : 'Navigation Inspector'}</span>
              </div>
              <button
                onClick={() => setShowNavDebugPanel(false)}
                className="absolute right-4 top-4 p-6 z-[99999] hover:bg-rose-500/10 hover:scale-105 hover:text-rose-400 rounded-full text-slate-400 transition-all duration-300 ease-in-out active:scale-95 cursor-pointer flex items-center justify-center min-w-[48px] min-h-[48px]"
                id="close_nav_debug_panel"
              >
                <X className="w-8 h-8 active:scale-90 transition-transform" />
              </button>
            </div>

            {/* Current Modal Stack Info */}
            <div className="space-y-1">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                {lang === 'ar' ? 'طبقات الإطارات النشطة (modalStack):' : 'Active Modal Stack (layers):'}
              </span>
              {modalStack.length === 0 ? (
                <div className="text-xs text-emerald-400/80 italic py-1 bg-slate-950/40 rounded-lg px-2 border border-emerald-500/10">
                  {lang === 'ar' ? 'لا يوجد صفحات مكدسة (خالي برمجياً)' : 'Empty Stack (Home Canvas)'}
                </div>
              ) : (
                <div className="flex flex-wrap gap-1 py-1 max-h-24 overflow-y-auto">
                  {modalStack.map((modalId, idx) => (
                    <span
                      key={`${modalId}-${idx}`}
                      className="text-[10px] font-mono px-2 py-1 bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded-md"
                    >
                      {idx + 1}: {modalId}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Nav History Breadcrumbs */}
            <div className="space-y-1">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                {lang === 'ar' ? 'تاريخ التنقل المسجل (navHistory):' : 'Logged Nav History (breadcrumbs):'}
              </span>
              {navHistory.length === 0 ? (
                <div className="text-xs text-amber-400/80 italic py-1 bg-slate-950/40 rounded-lg px-2 border border-amber-500/10">
                  {lang === 'ar' ? 'تاريخ التنقل فارغ حالياً' : 'No history breadcrumbs stored'}
                </div>
              ) : (
                <div className="space-y-1 max-h-28 overflow-y-auto bg-slate-950/50 p-2 rounded-xl border border-slate-800 font-mono text-[9px] text-slate-300">
                  {navHistory.map((step, idx) => (
                    <div key={idx} className="flex items-center gap-1.5 border-b border-slate-900 last:border-0 pb-1 last:pb-0">
                      <span className="text-slate-500">[{idx}]</span>
                      <span className="text-sky-400 font-bold">{step.currentTab}</span>
                      {step.modalStack && step.modalStack.length > 0 && (
                        <span className="text-indigo-400">({step.modalStack.join(', ')})</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Force Clear Actions */}
            <div className="border-t border-slate-800 pt-3 mt-1 space-y-2">
              <button
                onClick={() => {
                  closeAllModals();
                  setNavHistory([]);
                  // Let pushState reset so we purge iframe stuck stacks
                  try {
                    window.history.pushState(null, '', window.location.pathname);
                  } catch (e) {
                    console.warn(e);
                  }
                  triggerNotification(
                    lang === 'ar' ? 'تم تنظيف كافة الطبقات والعودة للرئيسية! 🧹' : 'Force cleared all layers and returned to main page! 🧹',
                    lang === 'ar' ? 'تم إعادة تهيئة نظام التنقل كلياً بنجاح' : 'Navigation system successfully hard-reset',
                    'success'
                  );
                }}
                className="w-full py-2 px-3 bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-rose-950/20 active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center gap-1.5 uppercase tracking-wide"
                id="force_clear_nav_debug"
              >
                <ShieldAlert className="w-4 h-4 text-white" />
                <span>{lang === 'ar' ? 'تنظيف إجباري وإعادة التعيين' : 'FORCE CLEAR & RESET'}</span>
              </button>
              <p className="text-[9px] text-slate-500 leading-normal text-center">
                {lang === 'ar'
                  ? 'يقوم هذا الزر بمسح كافة الطبقات المعلقة وتاريخ التنقل برمجياً لفك تجميد الشاشة.'
                  : 'Instantly sweeps all stuck overlays and navigation logs to escape any deadlocked UI.'}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Container Workspace */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 py-8 relative">
        {/* Subtle decorative glow */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-600/10 rounded-full blur-[120px] pointer-events-none"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-[120px] pointer-events-none"></div>

        <div className="relative z-10">
          <AnimatePresence>
            {isPostingReel && (
              <ReelsUploader
                currentUser={currentUser}
                outings={outings}
                lang={lang}
                onClose={() => setModalState('posting_reel', false)}
                onPublish={(newReel) => {
                  setReels(prev => [newReel, ...prev]);
                  setModalState('posting_reel', false);
                }}
              />
            )}
            {isEditingProfile && currentUser && (
              <ProfileEditor
                currentUser={currentUser}
                lang={lang}
                onClose={() => setModalState('editing_profile', false)}
                onSave={async (updated) => {
                  try {
                    if (supabase) {
                      const { error } = await supabase
                        .from('users')
                        .update(updated)
                        .eq('id', currentUser.id);
                      if (error) {
                        console.warn("[ProfileEditor] Supabase update returned error, falling back to local storage:", error);
                      }
                    }
                  } catch (supabaseError) {
                    console.warn("[ProfileEditor] Supabase connection error during save:", supabaseError);
                  }
                  
                  // Always save locally to ensure 100% responsive and robust behavior
                  const freshUser = { ...currentUser, ...updated };
                  setCurrentUser(freshUser);
                  localStorage.setItem('yallamate_current_user', JSON.stringify(freshUser));
                  setProfiles(prev => prev.map(p => p.id === currentUser.id ? { ...p, ...updated } : p));
                  setModalState('editing_profile', false);
                  
                  triggerNotification(
                    lang === 'ar' ? 'تم تحديث الملف الشخصي بنجاح! ✨' : 'Profile updated successfully! ✨',
                    lang === 'ar' ? 'تم تحديث الملف الشخصي بنجاح! ✨' : 'Profile updated successfully! ✨',
                    'success'
                  );
                }}
              />
            )}
          </AnimatePresence>

          <AnimatePresence>
            {showSocialHub && currentUser && (
              <div key="social_hub_wrapper" className="fixed inset-0 z-[100] bg-white animate-in slide-in-from-bottom">
                <SocialHub 
                  currentUser={currentUser}
                  allProfiles={profiles}
                  outings={outings}
                  lang={lang}
                  onClose={() => triggerBack()}
                  onSelectOuting={(outing) => {
                    setSelectedOutingId(outing.id);
                    triggerBack();
                  }}
                  onViewProfile={(id) => setModalState('viewing_profile', true, id)}
                  onlineUsers={onlineUsers}
                />
              </div>
            )}
            {showDirectMessages && currentUser && (
              <DirectMessageView 
                currentUser={currentUser}
                lang={lang}
                onClose={() => triggerBack()}
                onCloseAll={closeAllModals}
                targetProfile={targetDmProfile || undefined}
                onlineUsers={onlineUsers}
                onViewProfile={(id) => setModalState('viewing_profile', true, id)}
                onUnsentChange={(hasUnsent) => { dmUnsentContentRef.current = hasUnsent; }}
                allProfiles={profiles}
              />
            )}
            
            {showSupabaseDiagnostics && (
              <SupabaseDiagnostics
                onClose={closeAllModals}
                lang={lang}
                runDatabaseMigration={runDatabaseMigration}
              />
            )}
            {showLocationDiagnostics && (
              <LocationDiagnostics
                outings={outings}
                onClose={closeAllModals}
              />
            )}
            <AIDeveloperConsole isOpen={showDevConsole} onClose={() => setShowDevConsole(false)} lang={lang} />
            
            <div className="fixed bottom-24 right-6 z-[90]">
                <button
                id="btn_ai_developer_console"
                onClick={() => setShowDevConsole(true)}
                className="p-4 bg-gradient-to-tr from-indigo-950 via-slate-900 to-indigo-900 text-indigo-400 hover:text-indigo-300 rounded-full shadow-[0_0_20px_rgba(99,102,241,0.3)] hover:shadow-[0_0_25px_rgba(139,92,246,0.5)] transition-all hover:scale-110 border border-indigo-500/30 flex items-center justify-center cursor-pointer group relative"
                title={lang === 'ar' ? "لوحة المهندس الذكي لإصلاح وتطوير التطبيق" : "AI Super-Engineer Development & Repair Console"}
                >
                <Terminal className="w-6 h-6 group-hover:rotate-12 transition-transform" />
                <span className="absolute -top-1 -right-1 bg-indigo-500 w-2.5 h-2.5 rounded-full border border-slate-950 animate-pulse" />
                </button>
            </div>
            
            {outingErrorModal && outingErrorModal.isOpen && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[100] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto"
                onClick={() => setOutingErrorModal(null)}
              >
                <motion.div
                  initial={{ scale: 0.95, y: 20 }}
                  animate={{ scale: 1, y: 0 }}
                  exit={{ scale: 0.95, y: 20 }}
                  className="bg-slate-900 border border-red-500/20 rounded-3xl p-6 md:p-8 w-full max-w-2xl shadow-2xl shadow-red-500/5 text-right font-sans leading-relaxed relative"
                  dir={lang === 'ar' ? 'rtl' : 'ltr'}
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    onClick={() => setOutingErrorModal(null)}
                    className="absolute top-4 left-4 p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition"
                  >
                    <X className="w-5 h-5" />
                  </button>

                  <div className="flex gap-4 items-start mb-6">
                    <div className="p-3 bg-red-500/20 text-red-500 rounded-2xl">
                      <AlertTriangle className="w-6 h-6 animate-pulse" />
                    </div>
                    <div>
                      <h3 className="text-xl font-extrabold text-red-400">
                        {lang === 'ar' ? 'فشل إنشاء أو نشر الطلعة' : 'Outing Creation / Saving Failed'}
                      </h3>
                      <p className="text-xs text-slate-400 mt-1">
                        {outingErrorModal.errorType}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="p-4 bg-slate-950/50 rounded-2xl border border-slate-850 space-y-2">
                      <div className="flex justify-between items-center text-[10px] text-slate-400 font-mono">
                        <span className="text-amber-500">Code: {outingErrorModal.errorCode}</span>
                        <span className="font-semibold">{lang === 'ar' ? 'قاعدة بيانات Supabase المباشرة' : 'Live Supabase Diagnostics'}</span>
                      </div>
                      <p className="text-sm font-mono text-slate-300 break-words font-medium">
                        {outingErrorModal.errorMessage}
                      </p>
                      {outingErrorModal.errorHint && outingErrorModal.errorHint !== 'N/A' && (
                        <p className="text-[11px] text-slate-400 italic">
                          <strong className="text-amber-500/80">Hint:</strong> {outingErrorModal.errorHint}
                        </p>
                      )}
                      {outingErrorModal.errorDetails && outingErrorModal.errorDetails !== 'N/A' && (
                        <p className="text-[11px] text-slate-400 italic">
                          <strong className="text-amber-500/80">Details:</strong> {outingErrorModal.errorDetails}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <button
                          onClick={() => {
                            const report = `=== YALLAMATE DATABASE OUTAGE REPORT ===
Time: ${new Date().toISOString()}
Error Type: ${outingErrorModal.errorType}
Supa Error: ${outingErrorModal.errorMessage}
Supa Code: ${outingErrorModal.errorCode}
Supa Hint: ${outingErrorModal.errorHint}
Supa Details: ${outingErrorModal.errorDetails}
Payload Attempted:
${outingErrorModal.payloadDump}
=======================================`;
                            navigator.clipboard.writeText(report);
                            triggerNotification(
                              lang === 'ar' ? 'تم نسخ تقرير الأخطاء للمطورين! 📋' : 'Error report copied to clipboard! 📋',
                              lang === 'ar' ? 'تم نسخ التقرير' : 'Report Copied',
                              'success'
                            );
                          }}
                          className="px-3 py-1.5 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 hover:text-indigo-300 font-bold rounded-lg text-xs transition cursor-pointer flex items-center gap-1"
                        >
                          {lang === 'ar' ? 'نسخ تقرير الأخطاء بالكامل 📋' : 'Copy Full Error Report 📋'}
                        </button>
                        <h4 className="text-xs font-bold text-slate-300">
                          {lang === 'ar' ? 'بيان البيانات المرسلة (Payload Dump)' : 'Payload Sent'}
                        </h4>
                      </div>
                      <pre className="p-3 bg-slate-950/40 rounded-xl text-[10px] font-mono text-slate-400 h-24 overflow-y-auto border border-slate-800 text-left">
                        {outingErrorModal.payloadDump}
                      </pre>
                    </div>

                    <div className="space-y-2 pt-2">
                      <div className="flex justify-between items-center">
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(outingErrorModal.sqlSolution);
                            triggerNotification(
                              lang === 'ar' ? 'تم نسخ كود SQL المخصص! 🔍' : 'Custom SQL Fix copied! 🔍',
                              lang === 'ar' ? 'تم نسخ كود SQL' : 'SQL Copied',
                              'success'
                            );
                          }}
                          className="px-3 py-1.5 bg-amber-500/15 hover:bg-amber-500/20 text-amber-400 hover:text-amber-300 font-bold rounded-lg text-xs transition cursor-pointer"
                        >
                          {lang === 'ar' ? 'نسخ كود التصحيح المخصص 🔍' : 'Copy Custom SQL Fix 🔍'}
                        </button>
                        <h4 className="text-xs font-extrabold text-amber-400 flex items-center gap-1.5">
                          {lang === 'ar' ? 'الحل التقني وكود التصحيح المتوقع' : 'Recommended SQL Fix Script'}
                        </h4>
                      </div>
                      <pre className="p-3 bg-amber-950/20 text-amber-300/90 rounded-2xl text-[10px] font-mono border border-amber-500/20 h-28 overflow-y-auto text-left">
                        {outingErrorModal.sqlSolution}
                      </pre>
                    </div>
                  </div>

                  <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-800">
                    <button
                      onClick={async () => {
                        setMigrationRunning(true);
                        try {
                          const res = await supabase?.rpc('execute_sql', { sql_query: outingErrorModal.sqlSolution });
                          if (res?.error) {
                            throw res.error;
                          }
                          if (res?.data && res.data.startsWith('SQL Error:')) {
                            throw new Error(res.data);
                          }
                          
                          triggerNotification(
                            lang === 'ar' ? 'تم تشغيل كود التصحيح بنجاح! 🎉' : 'Fix executed successfully! 🎉',
                            lang === 'ar' ? 'تم الإصلاح' : 'Fix Applied',
                            'success'
                          );
                          setOutingErrorModal(null);
                          // Re-scan
                          const checkResult = await verifyDatabaseIntegrity();
                          const rlsResult = await validateOutingRlsPolicies();
                          setDbCompletenessErrors([...checkResult.errors, ...rlsResult.errors]);
                        } catch (err: any) {
                          alert(lang === 'ar' ? `فشل التطبيق المباشر التلقائي: ${err.message}` : `Direct apply failed: ${err.message}`);
                        } finally {
                          setMigrationRunning(false);
                        }
                      }}
                      className="px-5 py-2.5 bg-red-500 hover:bg-red-400 text-slate-950 font-black rounded-xl text-xs transition cursor-pointer"
                    >
                      {lang === 'ar' ? 'تطبيق هذا التصحيح مباشرة تلقائياً 🛡️' : 'Apply This Fix Direct 🛡️'}
                    </button>
                    <button
                      onClick={() => setOutingErrorModal(null)}
                      className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-bold rounded-xl text-xs transition cursor-pointer"
                    >
                      {lang === 'ar' ? 'إغلاق' : 'Close'}
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {!currentUser || !currentUser.onboarding_completed || !emailVerified ? (
            <RegisterFlow emailVerified={emailVerified} onRegisterComplete={handleRegisterComplete} lang={lang} allProfiles={profiles} currentUser={currentUser} />
          ) : (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              {isCreatingOuting ? (
                <OutingCreator
                  currentUserId={currentUser.id}
                  creatorName={currentUser.name}
                  creatorAvatar={currentUser.avatar}
                  creatorGender={currentUser.gender || 'male'}
                  creatorTrust={currentUser.trustScore}
                  city={currentUser.location}
                  allProfiles={profiles}
                  friendsList={friendsList}
                  onSave={handleSaveOuting}
                  onCancel={() => {
                    setPrefillOuting(null);
                    setModalState('creating_outing', false);
                  }}
                  lang={lang}
                  prefill={prefillOuting || undefined}
                />
              ) : activeOuting ? (
                <OutingDetails
                  outing={activeOuting}
                  currentUser={currentUser}
                  allProfiles={profiles}
                  friendsList={friendsList}
                  onJoin={handleJoinOuting}
                  onLeave={handleLeaveOuting}
                  onSendMessage={handleSendMessage}
                  onCompleteReview={handleCompleteReview}
                  onEndOuting={handleEndOuting}
                  onUpdateOuting={async (updated) => {
                    setOutings(prev => prev.map(o => o.id === updated.id ? updated : o));
                    if (supabase) {
                      const sanitized = sanitizeOutingForDb(updated);
                      await supabase.from('outings').upsert([sanitized]);
                      
                      // Update role if user becomes driver
                      if (updated.logistics?.driverId === currentUser?.id) {
                         await supabase.from('outing_participants')
                           .update({ role: 'driver' })
                           .eq('outing_id', updated.id)
                           .eq('user_id', currentUser?.id);
                      }
                    }
                  }}
                  onViewProfile={(id) => setModalState('viewing_profile', true, id)}
                  onClose={() => triggerBack()}
                  lang={lang}
                />
              ) : (
                <div className="relative w-full">
                  {/* View 1: Main Platform Hub - Rendered directly and stably */}
                  <div className="flex-1 w-full overflow-y-auto pb-20 flex flex-col items-center">
                    <AnimatePresence mode="wait">
                      {currentTab === 'home' && (
                        <motion.div 
                          key="home" 
                          initial={{ opacity: 0, y: 15 }} 
                          animate={{ opacity: 1, y: 0 }} 
                          exit={{ opacity: 0, y: -15 }}
                          transition={{ type: "spring", stiffness: 380, damping: 35, mass: 0.8 }}
                          className="w-full max-w-lg"
                        >
                          <HomeView 
                            lang={lang} 
                            isOnline={isOnline}
                            unreadMessagesCount={unreadMessagesCount}
                            unreadNotificationsCount={appNotifications.filter(n => !n.read).length}
                            onChangeTab={setCurrentTab} 
                            currentUser={currentUser}
                            outings={outings}
                            companionReviews={companionReviews}
                            theme={theme}
                            pendingOps={pendingOps}
                            allProfiles={profiles}
                            onViewProfile={(id) => setModalState('viewing_profile', true, id)}
                            onInitiateCreateOuting={(prefill) => {
                              setPrefillOuting(prefill || null);
                              setModalState('creating_outing', true);
                            }}
                            onToggleNotifications={() => setModalState('notifications', true)}
                            onToggleSocialHub={() => setModalState('social_hub', true)}
                            onToggleLang={handleToggleLang}
                            onToggleTheme={() => setTheme(prev => prev === 'dark' ? 'light' : 'dark')}
                            showCityGuide={showCityGuide}
                            onToggleCityGuide={(val) => setModalState('city_guide', val)}
                            onSelectCommunity={() => {
                              setModalState('social_hub', true);
                            }}
                            onSelectOuting={(outingId) => setModalState('selected_outing', true, outingId)}
                          />
                        </motion.div>
                      )}
                      
                      {currentTab === 'social_feed' && (
                        <motion.div 
                          key="social_feed" 
                          initial={{ opacity: 0, y: 15 }} 
                          animate={{ opacity: 1, y: 0 }} 
                          exit={{ opacity: 0, y: -15 }}
                          transition={{ type: "spring", stiffness: 380, damping: 35, mass: 0.8 }}
                          className="w-full max-w-lg"
                        >
                          <ModernSocialFeed 
                            currentUser={currentUser}
                            lang={lang}
                            onViewProfile={(id) => setModalState('viewing_profile', true, id)}
                          />
                        </motion.div>
                      )}
 
                      {currentTab === 'explore' && (
                        <motion.div 
                          key="explore" 
                          initial={{ opacity: 0, y: 15 }} 
                          animate={{ opacity: 1, y: 0 }} 
                          exit={{ opacity: 0, y: -15 }}
                          transition={{ type: "spring", stiffness: 380, damping: 35, mass: 0.8 }}
                          className="w-full max-w-lg"
                        >
                          <ExploreView 
                            currentUser={currentUser}
                            outings={outings}
                            onSelectOuting={(id) => setModalState('selected_outing', true, id)}
                            lang={lang}
                            onInitiateCreateOuting={(prefill) => {
                              setPrefillOuting(prefill || null);
                              setModalState('creating_outing', true);
                            }}
                            userCoordinates={userCoordinates ? { lat: userCoordinates[0], lng: userCoordinates[1] } : null}
                            onChangeTab={setCurrentTab}
                          />
                        </motion.div>
                      )}
                      
                      {currentTab === 'reels' && (
                        <motion.div 
                          key="reels" 
                          initial={{ opacity: 0, y: 15 }} 
                          animate={{ opacity: 1, y: 0 }} 
                          exit={{ opacity: 0, y: -15 }}
                          transition={{ type: "spring", stiffness: 380, damping: 35, mass: 0.8 }}
                          className="h-full flex flex-col gap-4"
                        >
                          <MatesReels
                            currentUser={currentUser}
                            outings={outings}
                            initialReels={reels} 
                            lang={lang}
                            onNavigateHome={() => setCurrentTab('home')}
                            onViewOuting={(outingId) => {
                              setModalState('selected_outing', true, outingId);
                              setCurrentTab('explore');
                            }}
                            onPublishReel={handlePublishReel}
                            onFollowToggle={handleToggleFollow}
                            onAddFriend={async (targetId) => {
                              if (!currentUser) return;
                              const result = await FriendshipManager.sendRequest(currentUser, targetId);
                              if (result.success) {
                                triggerNotification(
                                  result.message === 'Already friends' ? 'أنتم أصدقاء بالفعل' : (result.message === 'Request already pending' ? 'الطلب قيد الانتظار' : 'تم إرسال طلب المتابعة بنجاح'),
                                  result.message === 'Already friends' ? 'Already buddies' : (result.message === 'Request already pending' ? 'Request pending' : 'Follow request sent successfully'),
                                  'success'
                                );
                              } else {
                                triggerNotification('فشل إرسال الطلب', 'Failed to send request', 'warning');
                              }
                            }}
                          />
                        </motion.div>
                      )}
                      
                      {currentTab === 'community' && (
                        <motion.div 
                          key="community" 
                          initial={{ opacity: 0, y: 15 }} 
                          animate={{ opacity: 1, y: 0 }} 
                          exit={{ opacity: 0, y: -15 }}
                          transition={{ type: "spring", stiffness: 380, damping: 35, mass: 0.8 }}
                          className="h-[84vh] flex flex-col rounded-3xl overflow-hidden border border-gray-100 shadow-xl"
                        >
                          <CommunityView
                            currentUser={currentUser}
                            allProfiles={profiles}
                            outings={outings}
                            lang={lang}
                            onClose={() => setCurrentTab('home')}
                          />
                        </motion.div>
                      )}

                      {currentTab === 'profile' && (
                        <motion.div 
                          key="profile" 
                          initial={{ opacity: 0, y: 15 }} 
                          animate={{ opacity: 1, y: 0 }} 
                          exit={{ opacity: 0, y: -15 }}
                          transition={{ type: "spring", stiffness: 380, damping: 35, mass: 0.8 }}
                          className="w-full max-w-lg"
                        >
                          <ProfileMoreView 
                            currentUser={currentUser}
                            allProfiles={profiles}
                            friendsList={friendsList}
                            lang={lang}
                            onEditProfile={() => setModalState('editing_profile', true)}
                            onUpdateArchetype={handleUpdateArchetype}
                            onInitiateCreateOuting={(prefill) => {
                              setPrefillOuting(prefill || null);
                              setModalState('creating_outing', true);
                            }}
                            outingsCount={(outings || []).filter(o => o.attendeeIds?.includes(currentUser.id) || o.creatorId === currentUser.id).length}
                            outings={outings}
                            companionReviews={companionReviews}
                            onAddReel={() => setModalState('posting_reel', true)}
                            reels={reels}
                            setReels={setReels}
                            onChangeTab={setCurrentTab}
                            onLogout={handleLogout}
                            theme={theme}
                            onToggleTheme={() => setTheme(prev => prev === 'dark' ? 'light' : 'dark')}
                            onToggleLang={handleToggleLang}
                            onProfileClick={(id) => setModalState('viewing_profile', true, id)}
                          />
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {!isCreatingOuting && !selectedOutingId && (
                      <BottomNavigation 
                        currentTab={currentTab as any} 
                        onChangeTab={(tab) => {
                          if (tab === 'create') {
                            setPrefillOuting(null);
                            setModalState('creating_outing', true);
                          } else {
                            setCurrentTab(tab);
                          }
                        }}
                        lang={lang}
                      />
                    )}
                  </div>

                  {/* Old reels overlay removed here because it was trapped in transform context */}
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Global User Profile Modal Overlay */}
      <AnimatePresence>
        {viewingProfileId && currentUser && (
          <UserProfileModal
            profile={profiles.find(p => p.id === viewingProfileId) || currentUser}
            currentUser={currentUser}
            allOutings={outings}
            allReels={reels}
            onClose={() => triggerBack()}
            onFollowToggle={handleToggleFollow}
            onFriendToggle={handleToggleFriend}
            isFollowing={currentUser.following?.includes(viewingProfileId) || false}
            isFriend={friendsList.includes(viewingProfileId)}
            lang={lang}
            onMessage={handleInitiatePrivateMessage}
            onLogout={handleLogout}
            onThemeToggle={() => setTheme(prev => prev === 'light' ? 'dark' : 'light')}
            onToggleLang={handleToggleLang}
            theme={theme}
            onEditProfile={() => {
              triggerBack();
              setModalState('editing_profile', true);
            }}
          />
        )}
      </AnimatePresence>

      {showNotifications && (
        <NotificationsModal
          notifications={appNotifications}
          lang={lang}
          onClose={() => triggerBack()}
          onMarkAllAsRead={() => setAppNotifications(prev => prev.map(n => ({ ...n, read: true })))}
          onReply={async (notifId, replyText) => {
            const notif = appNotifications.find(n => n.id === notifId);
            if (!notif || !currentUser) return;

            // Mark as read immediately for UX
            setAppNotifications(prev => prev.map(n => n.id === notifId ? { ...n, read: true } : n));

            try {
              // Decide if it's a social DM or an outing chat
              if (notif.type === 'new_comment' || notif.type === 'outing_invite') {
                // If we have an outingId associated, post to outing chat, otherwise it's a DM
                // The notification doesn't explicitly have outingId but let's assume if it has actorId we can try DM
                // In a real app, 'AppNotification' would have 'entityId' (outingId or chatId)
                
                const chatId = [currentUser.id, notif.actorId].sort().join('_');
                
                try {
                  if (!supabase) return;
                  await supabase.from('direct_messages').insert([{
                    chatId: chatId,
                    senderId: currentUser.id,
                    receiverId: notif.actorId,
                    content: replyText,
                    type: 'text',
                    timestamp: new Date().toISOString(),
                    reactions: {}
                  }]);
                } catch (e) {
                  handleFirestoreError(e, OperationType.CREATE, 'direct_messages');
                }

                triggerNotification(
                  'تم إرسال ردك بنجاح للدردشة المباشرة',
                  'Reply sent successfully to direct chat',
                  'success'
                );
              } else {
                triggerNotification(
                  'تم إرسال ردك بنجاح',
                  'Reply sent successfully',
                  'success'
                );
              }
            } catch (err) {
              console.error('Failed to send reply from notification:', err);
              triggerNotification(
                'فشل إرسال الرد، حاول من المحادثة مباشرة',
                'Failed to send reply, try from the chat directly',
                'warning'
              );
            }
          }}
          onAcceptFriendRequest={async (notifId, actorId) => {
            const notif = appNotifications.find(n => n.id === notifId);
            const requestId = notif?.targetId || notifId;
            
            const result = await FriendshipManager.acceptRequest(requestId, actorId, currentUser!.id);
            if (result.success) {
              triggerNotification(
                'تم قبول طلب الصداقة بنجاح',
                'Friend request accepted',
                'success'
              );
              setAppNotifications(prev => prev.map(n => {
                if (n.id === notifId) {
                  return { 
                    ...n, 
                    type: 'friend_request_accepted', 
                    message: lang === 'ar' ? 'أصبحتم أصدقاء الآن' : 'You are now friends', 
                    read: true 
                  };
                }
                return n;
              }));
              fetchFriends();
            } else {
              triggerNotification('فشل قبول الطلب', 'Failed to accept request', 'warning');
            }
          }}
          onDeclineFriendRequest={async (notifId) => {
            const notif = appNotifications.find(n => n.id === notifId);
            const requestId = notif?.targetId || notifId;
            
            const result = await FriendshipManager.rejectRequest(requestId);
            if (result.success) {
              setAppNotifications(prev => prev.filter(n => n.id !== notifId));
            } else {
              triggerNotification('فشل رفض الطلب', 'Failed to decline request', 'warning');
            }
          }}
          onNotificationClick={(notif) => {
            setAppNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, read: true } : n));
            
            if (notif.type === 'direct_message') {
              const actorProfile = profiles.find(p => p.id === notif.actorId);
              if (actorProfile) {
                setModalState('notifications', false);
                setModalState('direct_messages', true, actorProfile);
              }
            } else if (notif.type === 'outing_invite' || notif.type === 'outing_join_accepted') {
              if (notif.targetId) {
                setModalState('notifications', false);
                setModalState('selected_outing', true, notif.targetId);
              }
            } else if (notif.type === 'new_comment' || notif.type === 'like_post') {
              setModalState('notifications', false);
              setModalState('social_hub', true);
            } else if (notif.type === 'like_reel') {
              setModalState('notifications', false);
              setCurrentTab('reels');
            } else if (notif.type === 'new_follower' || notif.type === 'friend_request_accepted') {
              if (notif.actorId) {
                setModalState('notifications', false);
                setModalState('viewing_profile', true, notif.actorId);
              }
            }
          }}
        />
      )}
      {/* Leave Outing Confirmation Dialog */}
      <AnimatePresence>
        {leaveOutingConfirmId && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setLeaveOutingConfirmId(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-2xl relative w-full max-w-sm overflow-hidden"
              dir={lang === 'ar' ? 'rtl' : 'ltr'}
            >
              {(() => {
                const isOngoing = outings.find(o => o.id === leaveOutingConfirmId)?.status === 'ongoing';
                return (
                  <div className="flex flex-col items-center text-center space-y-4">
                    <div className={`p-4 rounded-full ${isOngoing ? 'bg-rose-100/50 text-rose-500' : 'bg-amber-100/50 text-amber-500'}`}>
                      <AlertTriangle className="w-8 h-8" />
                    </div>
                    
                    <div>
                      <h3 className="text-lg font-black text-slate-900 dark:text-white mb-2">
                        {lang === 'ar' ? 'تأكيد الانسحاب من الطلعة' : 'Confirm Leaving Outing'}
                      </h3>
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        {isOngoing 
                          ? (lang === 'ar' ? 'هذه الطلعة بدأت بالفعل ومستمرة. الانسحاب الآن سيؤدي إلى خصم 2.5 نقطة من معدل الثقة الخاص بك وتوجيه إنذار لحسابك.' : 'This outing is already ongoing! Leaving now will deduct 2.5 points from your Trust Score and add a warning to your profile.')
                          : (lang === 'ar' ? 'هل أنت متأكد من أنك تريد الانسحاب من هذه الطلعة؟ ستترك مقعدك شاغراً.' : 'Are you sure you want to leave this outing? You will free up your spot.')}
                      </p>
                    </div>

                    <div className="flex w-full gap-3 mt-4">
                      <button
                        onClick={() => setLeaveOutingConfirmId(null)}
                        className="flex-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold py-3 rounded-2xl transition-colors text-sm"
                      >
                        {lang === 'ar' ? 'إلغاء' : 'Cancel'}
                      </button>
                      <button
                        onClick={() => executeLeaveOuting(leaveOutingConfirmId)}
                        className={`flex-[1.5] text-white font-bold py-3 rounded-2xl transition-colors shadow-md text-sm ${isOngoing ? 'bg-rose-600 hover:bg-rose-700' : 'bg-slate-900 hover:bg-slate-800 flex dark:bg-indigo-600 dark:hover:bg-indigo-700'}`}
                      >
                        {lang === 'ar' ? 'تأكيد الانسحاب' : 'Confirm Leave'}
                      </button>
                    </div>
                  </div>
                );
              })()}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>

  );
}

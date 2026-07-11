import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { offlineSyncService } from '../services/offlineSyncService';
import { Profile } from '../types';
import { Language, translations } from '../data/translations';
import { haptic } from '../lib/haptics';
import { 
  Plus, X, Send, Image, MessageCircle, Mic, Play, Pause, Smile, 
  Search, UserPlus, Check, Trash2, Heart, MessageSquare, AlertCircle, Sparkles, SendToBack, Radio, ChevronRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { renderAvatar } from './MatesReels';

interface CommunityViewProps {
  currentUser: Profile;
  allProfiles: Profile[];
  outings?: any[]; // pass outings to CommunityView
  lang: Language;
  onClose?: () => void;
  onSelectOuting?: (outing: any) => void;
}

interface DirectMessage {
  id: string;
  chatId: string;
  senderId: string;
  receiverId: string;
  content: string;
  type: 'text' | 'image' | 'voice';
  timestamp: string;
  reactions?: Record<string, string>; // userId -> emoji
  imageSrc?: string;
  voiceDuration?: number; // seconds
}

interface FriendRequest {
  id: string;
  senderId: string;
  receiverId: string;
  status: 'pending' | 'accepted';
  senderName: string;
  senderAvatar: string;
}

export default function CommunityView({ currentUser, allProfiles, outings = [], lang, onClose, onSelectOuting }: CommunityViewProps) {
  const isAr = lang === 'ar';
  const t = translations[lang];

  const [activeTab, setActiveTab] = useState<'chats' | 'friends'>('chats');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Smart Match State
  const [smartMatches, setSmartMatches] = useState<any[]>([]);
  const [isGeneratingMatches, setIsGeneratingMatches] = useState(false);
  const [hasGeneratedMatches, setHasGeneratedMatches] = useState(false);
  
  // Real-time states
  const [friends, setFriends] = useState<Profile[]>([]);
  const [pendingRequests, setPendingRequests] = useState<FriendRequest[]>([]);
  const [sentRequests, setSentRequests] = useState<string[]>([]); // Array of receiverIds
  const [activeChatFriend, setActiveChatFriend] = useState<Profile | null>(() => {
    try {
      const savedId = localStorage.getItem('active_chat_friend_id');
      if (savedId) {
        return allProfiles.find(p => p.id === savedId) || null;
      }
    } catch {
      // Ignored
    }
    return null;
  });

  useEffect(() => {
    if (activeChatFriend) {
      localStorage.setItem('active_chat_friend_id', activeChatFriend.id);
    } else {
      localStorage.removeItem('active_chat_friend_id');
    }
  }, [activeChatFriend]);
  
  // Messages states
  const [chatMessages, setChatMessages] = useState<DirectMessage[]>([]);
  const [messageInput, setMessageInput] = useState('');
  const [selectedEmojiMessageId, setSelectedEmojiMessageId] = useState<string | null>(null);
  
  // Photo attach states
  const [photoUrlInput, setPhotoUrlInput] = useState('');
  const [showPhotoModal, setShowPhotoModal] = useState(false);

  // Simulated Voice Recorder states
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [voiceWaveforms, setVoiceWaveforms] = useState<number[]>([]);
  const recordingTimer = useRef<any>(null);

  // Audio Playback states (simulated playing voice notes)
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  const [voicePlaybackProgress, setVoicePlaybackProgress] = useState<Record<string, number>>({});
  const playbackTimers = useRef<Record<string, any>>({});

  // Reference for scrolling chat
  const chatBottomRef = useRef<HTMLDivElement | null>(null);

  // 1. Fetch friend requests & friendships from Supabase
  useEffect(() => {
    if (!currentUser) return;

    // Helper to fetch
    const fetchRequests = async () => {
      try {
        const cached = localStorage.getItem(`mates_cached_pending_reqs_${currentUser.id}`);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed && Array.isArray(parsed.pending)) setPendingRequests(parsed.pending);
          if (parsed && Array.isArray(parsed.sent)) setSentRequests(parsed.sent);
        }
      } catch (e) {}

      const { data } = await supabase
        .from('friend_requests')
        .select('*')
        .or(`"receiverId".eq.${currentUser.id},"senderId".eq.${currentUser.id}`);
      
      if (data) {
        const pending = data.filter(r => r.receiverId === currentUser.id && r.status === 'pending');
        const sent = data.filter(r => r.senderId === currentUser.id && r.status === 'pending').map(r => r.receiverId);
        setPendingRequests(pending);
        setSentRequests(sent);
        try {
          localStorage.setItem(`mates_cached_pending_reqs_${currentUser.id}`, JSON.stringify({ pending, sent }));
        } catch (e) {}
      }
    };
    fetchRequests();

    // Listen for changes
    const channel = supabase
      .channel('friend_requests_channel')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'friend_requests',
        filter: `receiverId=eq.${currentUser.id}`
      }, (payload) => {
          fetchRequests();
      })
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'friend_requests',
        filter: `senderId=eq.${currentUser.id}`
      }, (payload) => {
          fetchRequests();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUser]);

  // 2. Listen to real friendship records from Supabase
  useEffect(() => {
    if (!currentUser) return;

    const fetchFriends = async () => {
      try {
        const cached = localStorage.getItem(`mates_cached_friends_${currentUser.id}`);
        if (cached) {
          setFriends(JSON.parse(cached));
        }
      } catch (e) {}

      const { data } = await supabase
        .from('friend_requests')
        .select('"senderId", "receiverId"')
        .eq('status', 'accepted')
        .or(`"senderId".eq.${currentUser.id},"receiverId".eq.${currentUser.id}`);
      
      if (data) {
        const friendIds = data.map(r => r.senderId === currentUser.id ? r.receiverId : r.senderId);
        const uniqueFriendIds = Array.from(new Set(friendIds));
        const matchedFriends = (allProfiles || []).filter(p => uniqueFriendIds.includes(p.id));
        const finalFriends = Array.from(new Map(matchedFriends.map(f => [f.id, f])).values());
        setFriends(finalFriends);
        try {
          localStorage.setItem(`mates_cached_friends_${currentUser.id}`, JSON.stringify(finalFriends));
        } catch (e) {}
      }
    };
    fetchFriends();

    const channel = supabase
      .channel('friendships_channel')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'friend_requests',
        filter: `status=eq.accepted` // simplified filter
      }, () => fetchFriends())
      .subscribe();

    return () => {
        supabase.removeChannel(channel);
    };
  }, [currentUser, allProfiles]);

  const persistFriendsToStore = () => {
    // Left as empty stub as friendships are fully managed via the real-time Firestore listeners above!
  };

  // 3. Listen for Direct Messages when activeChatFriend is selected
  useEffect(() => {
    if (!currentUser || !activeChatFriend) {
      setChatMessages([]);
      return;
    }

    const currentChatId = [currentUser.id, activeChatFriend.id].sort().join('_');

    const mapDbMessage = (m: any): DirectMessage => {
      return {
        id: m.id,
        chatId: m.chatId,
        senderId: m.senderId,
        receiverId: m.receiverId,
        content: m.content || '',
        type: (m.type || 'text') as any,
        timestamp: m.timestamp,
        reactions: m.reactions || {},
        imageSrc: m.imageUrl || m.imageSrc,
        voiceDuration: m.locationUrl?.startsWith('voice_duration:') 
          ? parseInt(m.locationUrl.split(':')[1]) 
          : (m.voiceDuration || 4)
      };
    };

    const fetchMessages = async () => {
      try {
        const cached = localStorage.getItem(`mates_cached_msgs_${currentChatId}`);
        if (cached) {
          setChatMessages(JSON.parse(cached));
        }
      } catch (e) {}

      const { data } = await supabase
        .from('direct_messages')
        .select('*')
        .eq('chatId', currentChatId)
        .order('timestamp', { ascending: true })
        .limit(100);

      if (data) {
        if (data.length > 0) {
          const mapped = data.map(mapDbMessage);
          setChatMessages(mapped);
          try {
            localStorage.setItem(`mates_cached_msgs_${currentChatId}`, JSON.stringify(mapped));
          } catch (e) {}
        } else {
            setChatMessages([]);
            try {
              localStorage.setItem(`mates_cached_msgs_${currentChatId}`, JSON.stringify([]));
            } catch (e) {}
        }
      }
    };
    fetchMessages();

    // Subscribe to new messages
    const channel = supabase
      .channel('messages_channel_' + currentChatId)
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'direct_messages',
        filter: `chatId=eq.${currentChatId}`
      }, (payload) => {
        setChatMessages(prev => {
          if (payload.new && prev.some(m => m.id === payload.new.id)) return prev;
          const updated = [...prev, mapDbMessage(payload.new)];
          try {
            localStorage.setItem(`mates_cached_msgs_${currentChatId}`, JSON.stringify(updated));
          } catch (e) {}
          return updated;
        });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUser, activeChatFriend]);

  // Smooth scroll to bottom on message updates
  useEffect(() => {
    setTimeout(() => {
      chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  }, [chatMessages, activeChatFriend]);

  // 4. Friend Requests Interaction Actions
  const handleSendFriendRequest = async (receiverId: string) => {
    if (!currentUser || !supabase) return;
    try {
      setSentRequests(prev => [...prev, receiverId]);
      
      const targetProfile = allProfiles.find(p => p.id === receiverId);
      const isPublicProfile = !targetProfile || targetProfile.privacyStatus === 'public';

      if (isPublicProfile) {
        const payload1 = {
          id: crypto.randomUUID(),
          senderId: currentUser.id,
          receiverId: receiverId,
          senderName: currentUser.name,
          senderAvatar: currentUser.avatar,
          status: 'accepted',
          timestamp: new Date().toISOString()
        };
        const payload2 = {
          id: crypto.randomUUID(),
          senderId: receiverId,
          receiverId: currentUser.id,
          senderName: targetProfile?.name || 'Mate',
          senderAvatar: targetProfile?.avatar || '👤',
          status: 'accepted',
          timestamp: new Date().toISOString()
        };

        const { error } = await supabase.from('friend_requests').insert([payload1, payload2]);
        if (error) {
          console.warn('Direct send failed, queuing offline:', error);
          offlineSyncService.queueOutgoingFriendRequest(payload1);
          offlineSyncService.queueOutgoingFriendRequest(payload2);
        }
      } else {
        const payload = {
          id: crypto.randomUUID(),
          senderId: currentUser.id,
          receiverId: receiverId,
          senderName: currentUser.name,
          senderAvatar: currentUser.avatar,
          status: 'pending',
          timestamp: new Date().toISOString()
        };

        const { error } = await supabase.from('friend_requests').insert([payload]);
        if (error) {
          console.warn('Direct send failed, queuing offline:', error);
          offlineSyncService.queueOutgoingFriendRequest(payload);
        }
      }
    } catch (err) {
      console.error('Failed to send friend request:', err);
    }
  };

  const handleCancelFriendRequest = async (receiverId: string) => {
    if (!currentUser || !supabase) return;
    try {
      setSentRequests(prev => prev.filter(id => id !== receiverId));

      await supabase
        .from('friend_requests')
        .delete()
        .eq('senderId', currentUser.id)
        .eq('receiverId', receiverId)
        .eq('status', 'pending');
    } catch (err) {
      console.error('Failed to cancel friend request:', err);
    }
  };

  const handleAcceptFriendRequest = async (request: FriendRequest) => {
    if (!supabase) return;
    try {
      setPendingRequests(prev => prev.filter(r => r.id !== request.id));

      const payload = {
        requestId: request.id,
        currentUserId: currentUser?.id,
        senderId: request.senderId,
        senderName: request.senderName,
        senderAvatar: request.senderAvatar,
        receiverName: currentUser?.name,
        receiverAvatar: currentUser?.avatar
      };

      offlineSyncService.queueOutgoingFriendRequest(payload);
      haptic();
    } catch (err) {
      console.error('Failed to accept friend request:', err);
    }
  };

  const handleRejectFriendRequest = async (requestId: string) => {
    if (!supabase) return;
    try {
      setPendingRequests(prev => prev.filter(r => r.id !== requestId));
      
      const payload = {
        requestId,
        currentUserId: currentUser?.id
      };

      offlineSyncService.queueOutgoingFriendRequest(payload);
    } catch (err) {
      console.error('Failed to reject friend request:', err);
    }
  };

  const handleRemoveFriend = async (friendId: string) => {
    if (!currentUser || !supabase) return;
    if (confirm(isAr ? 'هل أنت متأكد من إزالة هذا الصديق؟' : 'Are you sure you want to remove this active buddy?')) {
      try {
        await supabase
          .from('friend_requests')
          .delete()
          .or(`and("senderId".eq.${currentUser.id},"receiverId".eq.${friendId}),and("senderId".eq.${friendId},"receiverId".eq.${currentUser.id})`);

        if (activeChatFriend?.id === friendId) {
          setActiveChatFriend(null);
        }
      } catch (err) {
        console.error("Failed to unfriend active buddy in Supabase:", err);
      }
    }
  };

  // 5. Send Instagram-Style Direct Messages
  const handleSendDM = async (type: 'text' | 'image' | 'voice', payload = '', voiceDur = 0) => {
    haptic();
    if (!currentUser || !activeChatFriend || !supabase) return;
    
    let textToSend = payload;
    let imgSource = '';

    if (type === 'text') {
      if (!messageInput.trim()) return;
      textToSend = messageInput;
      setMessageInput('');
    } else if (type === 'image') {
      imgSource = payload || 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=850&q=80';
      textToSend = isAr ? '📷 أرسل صورة' : '📷 Shared an image';
    }

    const chatId = [currentUser.id, activeChatFriend.id].sort().join('_');

    const dbPayload: any = {
      chatId,
      senderId: currentUser.id,
      receiverId: activeChatFriend.id,
      senderName: currentUser.name,
      senderAvatar: currentUser.avatar,
      content: textToSend,
      type,
      timestamp: new Date().toISOString(),
      reactions: {},
      imageUrl: type === 'image' ? imgSource : null,
      locationUrl: type === 'voice' ? `voice_duration:${voiceDur}` : null
    };

    const optimisticMsg: any = {
      id: `m_opt_${Date.now()}`,
      ...dbPayload,
      imageSrc: dbPayload.imageUrl,
      voiceDuration: voiceDur
    };
    
    // Add optimistic message instantly to UI state for buttery smooth interface
    setChatMessages(prev => [...prev, optimisticMsg]);
    
    try {
      await offlineSyncService.queueOutgoingMessage(dbPayload);
    } catch (err) {
      console.error('Failed to queue direct message:', err);
    }
  };

  const handleReactToMessage = async (msgId: string, emoji: string) => {
    if (!currentUser || !supabase) return;
    try {
      const matchedMsg = chatMessages.find(m => m.id === msgId);
      if (!matchedMsg) return;

      const updatedReactions = { ...(matchedMsg.reactions || {}) };
      
      // Toggle or set emoji reaction
      if (updatedReactions[currentUser.id] === emoji) {
        delete updatedReactions[currentUser.id];
      } else {
        updatedReactions[currentUser.id] = emoji;
      }

      await supabase
        .from('direct_messages')
        .update({ reactions: updatedReactions })
        .eq('id', msgId);
    } catch (err) {
      console.error('Failed to react to message:', err);
    }
    setSelectedEmojiMessageId(null);
  };

  // 6. Voice Message Simulator Mechanism
  const startRecordingVoice = () => {
    setIsRecording(true);
    setRecordingSeconds(0);
    setVoiceWaveforms([]);
    
    recordingTimer.current = setInterval(() => {
      setRecordingSeconds(prev => prev + 1);
      // Push mock random high peaks matching live waves
      setVoiceWaveforms(prev => [...prev, Math.floor(Math.random() * 80) + 15]);
    }, 1000);
  };

  const stopAndPostVoice = () => {
    if (recordingTimer.current) {
      clearInterval(recordingTimer.current);
    }
    setIsRecording(false);
    const totalDuration = recordingSeconds || 4;
    handleSendDM('voice', '🔊 Voice message', totalDuration);
  };

  const togglePlayVoiceMessage = (msgId: string, durationSec: number) => {
    // If playing already, pause
    if (playingVoiceId === msgId) {
      clearInterval(playbackTimers.current[msgId]);
      delete playbackTimers.current[msgId];
      setPlayingVoiceId(null);
      return;
    }

    // Stop active track first
    if (playingVoiceId) {
      clearInterval(playbackTimers.current[playingVoiceId]);
      delete playbackTimers.current[playingVoiceId];
    }

    setPlayingVoiceId(msgId);
    
    let currentProg = voicePlaybackProgress[msgId] || 0;
    if (currentProg >= 100) currentProg = 0;

    const intervalRate = 100 / durationSec;

    playbackTimers.current[msgId] = setInterval(() => {
      currentProg += intervalRate;
      if (currentProg >= 100) {
        currentProg = 100;
        clearInterval(playbackTimers.current[msgId]);
        setPlayingVoiceId(null);
      }
      setVoicePlaybackProgress(prev => ({ ...prev, [msgId]: currentProg }));
    }, 1000);
  };

  // Clean dynamic intervals on dismount
  useEffect(() => {
    return () => {
      if (recordingTimer.current) clearInterval(recordingTimer.current as any);
      Object.values(playbackTimers.current).forEach(t => clearInterval(t as any));
    };
  }, []);

  // Filter candidates to suggest and search friends
  const activeFriendIds = friends.map(f => f.id);
  const myOutings = (outings || []).filter(o => o.attendeeIds?.includes(currentUser.id) || o.creatorId === currentUser.id);

  const pendingSenderIds = pendingRequests.map(r => r.senderId);
  const baseCandidates = (allProfiles || []).filter(p => 
    p.id !== currentUser.id && 
    !activeFriendIds.includes(p.id) &&
    !pendingSenderIds.includes(p.id)
  );

  useEffect(() => {
    const fetchSmartMatches = async () => {
      if (activeTab === 'friends' && !hasGeneratedMatches && !isGeneratingMatches && baseCandidates.length > 0) {
        setIsGeneratingMatches(true);
        try {
          const res = await fetch('/api/community/smart-match', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ currentUser, candidates: baseCandidates })
          });
          if (res.ok) {
            const data = await res.json();
            if (data && data.matches) {
              setSmartMatches(data.matches);
            }
          }
        } catch (e) {
          console.error(e);
        } finally {
          setIsGeneratingMatches(false);
          setHasGeneratedMatches(true);
        }
      }
    };
    fetchSmartMatches();
  }, [activeTab, hasGeneratedMatches, baseCandidates, currentUser]);

  const potentialCandsList = baseCandidates.filter(p => 
    !searchQuery || p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );
  
  // Sort potentialCandsList based on smart matches if available
  const sortedCandsList = [...potentialCandsList].sort((a, b) => {
    const matchA = smartMatches.find(m => m.id === a.id);
    const matchB = smartMatches.find(m => m.id === b.id);
    const scoreA = matchA ? matchA.matchScore : 0;
    const scoreB = matchB ? matchB.matchScore : 0;
    return scoreB - scoreA;
  });


  return (
    <div className="flex flex-col h-[82vh] bg-gray-50 rounded-3xl overflow-hidden border border-gray-100 shadow-md p-1 relative" dir={isAr ? 'rtl' : 'ltr'}>
      <AnimatePresence mode="wait">
        {!activeChatFriend ? (
          <motion.div 
            key="dm_list_view"
            initial={{ opacity: 0, x: isAr ? 30 : -30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: isAr ? -30 : 30 }}
            className="flex flex-col flex-1 h-full"
          >
            {/* Header section */}
            <div className="p-4 bg-white border-b border-gray-100 flex items-center justify-between">
              <div>
                <h2 className="text-base font-black text-gray-900 flex items-center gap-2">
                  <Radio className="w-5 h-5 text-indigo-500 animate-pulse" />
                  {isAr ? 'دردشات المجتمع والرفقاء' : 'Community DM Lounge'}
                </h2>
                <p className="text-[10px] text-gray-500 font-bold">{isAr ? 'نظام مراسلات قوي على طراز انستغرام' : 'Fast, secure interactions'}</p>
              </div>
              <div className="flex items-center gap-3">
                <Sparkles className="w-5 h-5 text-indigo-500" />
                {onClose && (
                  <button onClick={onClose} className="p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
                    <X className="w-5 h-5" />
                  </button>
                )}
              </div>
            </div>

            {/* Segment switch */}
            <div className="p-3 bg-white flex border-b border-gray-100 gap-2">
              <button
                onClick={() => { setActiveTab('chats'); setSearchQuery(''); }}
                className={`flex-1 py-2 text-xs font-black rounded-xl transition ${activeTab === 'chats' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/15' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
              >
                💬 {isAr ? 'الدردشات المباشرة' : 'DMs'}
              </button>
              <button
                onClick={() => { setActiveTab('friends'); setSearchQuery(''); }}
                className={`flex-1 py-2 text-xs font-black rounded-xl transition ${activeTab === 'friends' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/15' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
              >
                👥 {isAr ? `الأصدقاء (${friends.length})` : `Buddies (${friends.length})`}
              </button>
            </div>

            {/* Search Input */}
            <div className="p-3 bg-white border-b border-gray-100">
              <div className="relative">
                <Search className={`absolute ${isAr ? 'right-3' : 'left-3'} top-2.5 w-4 h-4 text-gray-400`} />
                <input
                  type="text"
                  placeholder={isAr ? 'ابحث بالاسم عن رفقاء...' : 'Search for friends...'}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={`w-full ${isAr ? 'pr-9 pl-3' : 'pl-9 pr-3'} py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-900 focus:outline-none focus:ring-1 focus:ring-indigo-500`}
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              {activeTab === 'chats' ? (
                // LATEST CHAT LISTING
                friends.length === 0 && myOutings.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center space-y-2">
                    <MessageSquare className="w-8 h-8 text-indigo-300" />
                    <p className="text-xs font-black text-gray-500">{isAr ? 'لا يوجد أصدقاء أو مجموعات نشطة.' : 'No active buddies or chats.'}</p>
                    <p className="text-[10px] text-gray-400 max-w-[200px] leading-relaxed">{isAr ? 'اذهب لتبويب "الأصدقاء" للبحث أو أنشئ طلعة للدردشة والمشاركة.' : 'Switch to friends tab or create an outing to start chatting.'}</p>
                  </div>
                ) : (
                  <>
                    {myOutings
                      .filter(o => !searchQuery || o.titleEn?.toLowerCase().includes(searchQuery.toLowerCase()) || o.titleAr?.toLowerCase().includes(searchQuery.toLowerCase()))
                      .map((out) => (
                        <div
                          key={out.id}
                          onClick={() => {
                            if (onSelectOuting) onSelectOuting(out);
                            if (onClose) onClose();
                          }}
                          className="p-3 bg-white hover:bg-indigo-50/40 hover:border-indigo-200 border border-transparent rounded-2xl shadow-sm transition flex items-center justify-between cursor-pointer group mb-2"
                        >
                          <div className="flex items-center gap-3">
                            <div className="relative w-11 h-11 bg-gradient-to-tr from-indigo-500 to-purple-500 rounded-full flex items-center justify-center text-white font-bold text-lg">
                              {out.titleEn?.[0] || 'O'}
                            </div>
                            <div className="text-right">
                              <span className="text-xs font-black text-gray-900 block">{isAr ? out.titleAr || out.titleEn : out.titleEn}</span>
                              <span className="text-[10px] text-gray-500 font-medium block">
                                {isAr ? 'دردشة جماعية للطلعة' : 'Group Outing Chat'}
                              </span>
                            </div>
                          </div>
                          <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-indigo-400 transition" />
                        </div>
                    ))}

                    {friends
                      .filter(f => !searchQuery || f.name.toLowerCase().includes(searchQuery.toLowerCase()))
                      .map(fr => (
                      <div
                        key={fr.id}
                        onClick={() => setActiveChatFriend(fr)}
                        className="p-3 bg-white hover:bg-indigo-50/40 hover:border-indigo-200 border border-transparent rounded-2xl shadow-sm transition flex items-center justify-between cursor-pointer group"
                      >
                        <div className="flex items-center gap-3">
                          <div className="relative">
                            {renderAvatar(fr.avatar, "w-11 h-11 rounded-full object-cover")}
                            <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></span>
                          </div>
                          <div className="text-right">
                            <h4 className="text-xs font-black text-gray-900 flex items-center gap-1.5">
                              {fr.name}
                              {fr.verified && <span className="text-[10px] text-blue-500" title={isAr ? 'رفيق موثق' : 'Verified companion'}>✓</span>}
                            </h4>
                            <p className="text-[10px] text-slate-500 font-medium max-w-[170px] truncate">
                              {fr.archetype || (isAr ? 'مستعد لمشاركتك الطلعة 🌟' : 'Ready to hang out!')}
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-col items-end gap-1.5">
                          <span className="text-[9px] font-mono font-bold text-slate-400 bg-gray-100 px-2 py-0.5 rounded-full uppercase">
                            {fr.location}
                          </span>
                          <span className="text-[10px] text-indigo-600 font-bold group-hover:underline">
                            {isAr ? 'دردش الآن 💬' : 'Chat 💬'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </>
                )
              ) : (
                // FRIENDS DIRECTORY, SEARCH AND REQUESTS
                <div className="space-y-4">
                  {/* Requests Received segment */}
                  {pendingRequests.length > 0 && (
                    <div className="bg-indigo-50/50 border border-indigo-100 rounded-2xl p-3 space-y-3">
                      <span className="text-[10px] font-black text-indigo-800 tracking-wider block uppercase">
                        👉 {isAr ? 'طلبات الصداقة بانتظارك' : 'BUDDIES WAITING FOR YOU'} ({pendingRequests.length})
                      </span>
                      <div className="space-y-2">
                        {pendingRequests.map(req => (
                          <div key={req.id} className="flex items-center justify-between p-2.5 bg-white rounded-xl border border-indigo-100 shadow-xs">
                            <div className="flex items-center gap-2">
                              {renderAvatar(req.senderAvatar, "w-8 h-8 rounded-full")}
                              <span className="text-xs font-black text-slate-800">{req.senderName}</span>
                            </div>
                            <div className="flex items-center gap-1.5 flex-row-reverse">
                              <button
                                onClick={() => handleAcceptFriendRequest(req)}
                                className="px-4 py-1.5 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg text-xs font-semibold cursor-pointer transition shadow-xs w-20"
                              >
                                {isAr ? 'تأكيد' : 'Confirm'}
                              </button>
                              <button
                                onClick={() => handleRejectFriendRequest(req.id)}
                                className="px-4 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-900 rounded-lg text-xs font-semibold cursor-pointer transition w-20"
                              >
                                {isAr ? 'حذف' : 'Delete'}
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Friends section */}
                  {friends.length > 0 && (
                    <div className="space-y-2">
                      <span className="text-[10px] font-black text-gray-400 tracking-widest block uppercase">
                        {isAr ? 'أصدقاؤك الحاليين' : 'MY ACTIVE BUDDIES'}
                      </span>
                      {friends.map(fr => (
                        <div key={fr.id} className="flex items-center justify-between p-2.5 bg-white rounded-2xl border border-gray-100 shadow-xs">
                          <div className="flex items-center gap-2.5">
                            {renderAvatar(fr.avatar, "w-8 h-8 rounded-full object-cover")}
                            <div>
                              <span className="text-xs font-black text-slate-800 block leading-tight">{fr.name}</span>
                              <span className="text-[9px] text-indigo-600 font-bold">{isAr ? 'دروازه الدردشة نشطة' : 'Active Channel'}</span>
                            </div>
                          </div>
                          <button
                            onClick={() => handleRemoveFriend(fr.id)}
                            className="px-4 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-900 rounded-lg text-xs font-semibold cursor-pointer transition min-w-[80px]"
                          >
                            {isAr ? 'حذف' : 'Remove'}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Add New Buddies candidates Directory search list */}
                  <div className="space-y-2">
                    <span className="text-[10px] font-black text-gray-400 tracking-widest block uppercase">
                      🔍 {isAr ? 'رفقاء مقترحين للإضافة' : 'FIND NEW BUDDIES'}
                    </span>
                    {sortedCandsList.length === 0 ? (
                      <div className="text-center py-6 text-xs text-gray-400 italic">
                        {isAr ? 'لم نجد رفقاء متاحين للتوصية.' : 'No match candidates.'}
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {isGeneratingMatches && (
                          <div className="flex items-center justify-center gap-2 py-4 bg-indigo-50/50 rounded-2xl border border-indigo-100">
                            <span className="w-4 h-4 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin"></span>
                            <span className="text-xs font-black text-indigo-500">{isAr ? 'يتم الآن تحليل الاهتمامات بواسطة الذكاء الاصطناعي...' : 'AI analyzing interests...'}</span>
                          </div>
                        )}
                        {sortedCandsList.map(cand => {
                          const requestSent = sentRequests.includes(cand.id);
                          const aiMatch = smartMatches.find(m => m.id === cand.id);
                          return (
                            <div key={cand.id} className={`p-3 bg-white rounded-2xl border ${aiMatch && aiMatch.matchScore > 75 ? 'border-indigo-300 bg-indigo-50/30' : 'border-gray-100'} flex items-center justify-between`}>
                              <div className="flex flex-col flex-1">
                                <div className="flex items-center gap-2.5">
                                  {renderAvatar(cand.avatar, "w-9 h-9 rounded-full object-cover")}
                                  <div className={isAr ? "text-right" : "text-left"}>
                                    <span className="text-xs font-black text-gray-900 flex items-center gap-1">
                                      {cand.name}
                                      {aiMatch && aiMatch.matchScore > 75 && (
                                        <span className="bg-indigo-500 text-white text-[8px] px-1.5 py-0.5 rounded-full flex items-center gap-0.5" title="AI Match">
                                          <Sparkles className="w-2.5 h-2.5" /> {aiMatch.matchScore}%
                                        </span>
                                      )}
                                    </span>
                                    <span className="text-[10px] text-gray-500 font-medium block">
                                      {cand.gender === 'male' ? (isAr ? 'شاب' : 'Male') : (isAr ? 'فتاة' : 'Female')} ● {cand.location}
                                    </span>
                                  </div>
                                </div>
                                {aiMatch && aiMatch.reason && (
                                  <div className={`mt-2 text-[10px] text-indigo-600 font-medium bg-indigo-100/50 px-2 py-1.5 rounded-lg border border-indigo-100/50 ${isAr ? 'text-right' : 'text-left'}`}>
                                    🤖 {aiMatch.reason}
                                  </div>
                                )}
                              </div>

                              <button
                                onClick={() => requestSent ? handleCancelFriendRequest(cand.id) : handleSendFriendRequest(cand.id)}
                                className={`ml-2 px-4 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center justify-center min-w-[90px] self-start ${
                                  requestSent 
                                    ? 'bg-gray-100 text-gray-900 hover:bg-gray-200' 
                                    : 'bg-indigo-500 text-white hover:bg-indigo-600'
                                }`}
                              >
                                {requestSent ? (
                                  <span>{isAr ? 'إلغاء الطلب' : 'Requested'}</span>
                                ) : (
                                  <span>{isAr ? 'متابعة' : 'Follow'}</span>
                                )}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        ) : (
          // ACTIVE INSTAGRAM STYLE DM BOX
          <motion.div 
            key="direct_messenger_box"
            initial={{ opacity: 0, x: isAr ? -30 : 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: isAr ? 30 : -30 }}
            className="flex flex-col flex-1 h-full bg-white relative"
          >
            {/* Top Toolbar */}
            <div className="p-3 bg-white border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <button
                  onClick={() => setActiveChatFriend(null)}
                  className="p-1.5 hover:bg-gray-100 rounded-xl transition cursor-pointer text-gray-600"
                  title={isAr ? 'العودة للقائمة' : 'Back to chat list'}
                >
                  ✕
                </button>
                <div className="relative">
                  {renderAvatar(activeChatFriend.avatar, "w-10 h-10 rounded-full object-cover")}
                  <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-white rounded-full animate-pulse"></span>
                </div>
                <div className="text-right">
                  <h3 className="text-xs font-black text-gray-900 flex items-center gap-1">
                    {activeChatFriend.name}
                  </h3>
                  <p className="text-[9px] text-green-600 font-bold">{isAr ? 'نشط الآن (طلعات)' : 'Active now'}</p>
                </div>
              </div>

              {/* Header call buttons removed */}
              <div className="flex items-center gap-1">
                <span className="text-[10px] bg-indigo-50 text-indigo-700 px-2 py-1 rounded-full font-bold ml-1">
                  {activeChatFriend.location}
                </span>
              </div>
            </div>

            {/* Chats Messages Feed */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50">
              {chatMessages.map((msg, idx) => {
                const belongsToMe = msg.senderId === currentUser.id;
                const progressVal = voicePlaybackProgress[msg.id] || 0;
                
                return (
                  <div
                    key={`${msg.id || 'dm'}-${idx}`}
                    className={`flex flex-col ${belongsToMe ? 'items-end' : 'items-start'} relative group/msg w-full`}
                  >
                    <div className={`flex items-start gap-2 max-w-[80vw] ${belongsToMe ? 'flex-row-reverse' : 'flex-row'}`}>
                      {/* Avatar */}
                      {!belongsToMe && renderAvatar(activeChatFriend.avatar, "w-7 h-7 rounded-full object-cover self-end mb-1")}
                      
                      <div className="flex flex-col relative">
                        {/* Bubble */}
                        <div
                          onClick={() => setSelectedEmojiMessageId(selectedEmojiMessageId === msg.id ? null : msg.id)}
                          className={`p-3 rounded-2xl text-xs leading-relaxed transition-all relative ${
                            belongsToMe 
                              ? 'bg-gradient-to-tr from-indigo-600 to-indigo-500 text-white rounded-br-none shadow-sm' 
                              : 'bg-white border border-gray-100 text-slate-900 rounded-bl-none shadow-xs'
                          }`}
                        >
                          {/* Image rendering if applicable */}
                          {msg.type === 'image' && msg.imageSrc && (
                            <div className="mb-2 max-w-[200px] rounded-xl overflow-hidden shadow-xs border border-white/20">
                              <img src={msg.imageSrc} alt="Shared media" className="w-full h-auto object-cover" />
                            </div>
                          )}

                          {/* Voice Message player with soundwave */}
                          {msg.type === 'voice' ? (
                            <div className="flex items-center gap-3 min-w-[210px] py-1">
                              <button
                                onClick={(e) => { e.stopPropagation(); togglePlayVoiceMessage(msg.id, msg.voiceDuration || 4); }}
                                className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-colors ${belongsToMe ? 'bg-white/20 text-white hover:bg-white/30' : 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200'}`}
                              >
                                {playingVoiceId === msg.id ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
                              </button>
                              
                              <div className="flex-1">
                                <div className="h-1.5 w-full bg-gray-200/50 rounded-full overflow-hidden relative">
                                  {/* Progress line */}
                                  <div style={{ width: `${progressVal}%` }} className={`h-full absolute left-0 top-0 transition-all duration-300 ${belongsToMe ? 'bg-white' : 'bg-indigo-600'}`}></div>
                                </div>
                                <span className={`text-[9px] block mt-1 ${belongsToMe ? 'text-white/80' : 'text-slate-500'}`}>
                                  🎤 {isAr ? 'صوتية رفيقك' : 'Buddy Voice Note'} ({msg.voiceDuration || 4}s)
                                </span>
                              </div>
                            </div>
                          ) : (
                            <p className="whitespace-pre-line break-words font-medium">{msg.content}</p>
                          )}

                          {/* Message Reactions display bubble */}
                          {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                            <div className="absolute -bottom-2.5 right-2 bg-white border border-gray-100 rounded-full px-1.5 py-0.5 flex gap-0.5 shadow-md z-10 scale-95 border-indigo-100">
                              {Object.entries(msg.reactions).map(([uId, rEmoji]) => (
                                <span key={uId} className="text-[11px]" title={uId === currentUser.id ? 'My reaction' : 'Buddy reaction'}>
                                  {rEmoji}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Interactive Emojis Fast Reaction Picker overlay */}
                        <AnimatePresence>
                          {selectedEmojiMessageId === msg.id && (
                            <motion.div
                              initial={{ scale: 0.8, opacity: 0, y: -5 }}
                              animate={{ scale: 1, opacity: 1, y: 0 }}
                              exit={{ scale: 0.8, opacity: 0, y: -5 }}
                              className="absolute -top-12 left-0 right-0 mx-auto w-fit bg-slate-900 text-white p-1.5 rounded-full flex gap-1.5 shadow-xl z-50 border border-white/20"
                            >
                              {['❤️', '😂', '👍', '😮', '😢', '🙏'].map(em => (
                                <button
                                  key={em}
                                  onClick={(e) => { e.stopPropagation(); handleReactToMessage(msg.id, em); }}
                                  className="hover:scale-125 transition text-md p-1 leading-none cursor-pointer"
                                >
                                  {em}
                                </button>
                              ))}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={chatBottomRef}></div>
            </div>

            {/* Simulated Live Recording Overlay */}
            <AnimatePresence>
              {isRecording && (
                <motion.div
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 15 }}
                  className="absolute inset-x-0 bottom-16 bg-indigo-900/95 backdrop-blur text-white p-4 flex items-center justify-between rounded-t-3xl border-t border-indigo-700 shadow-2xl z-30"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-3.5 h-3.5 bg-red-500 rounded-full animate-ping"></span>
                    <span className="text-xs font-black font-mono">0:0{recordingSeconds}s</span>
                  </div>

                  {/* Ripple wav representation */}
                  <div className="flex items-end gap-1.5 h-10 w-44 justify-center">
                    {(voiceWaveforms.slice(-8).length > 0 ? voiceWaveforms.slice(-8) : [30, 60, 40, 80, 50]).map((h, i) => (
                      <div
                        key={i}
                        style={{ height: `${h}%` }}
                        className="w-1 px-0.5 bg-indigo-300 rounded-full transition-all duration-300"
                      ></div>
                    ))}
                  </div>

                  <button
                    onClick={stopAndPostVoice}
                    className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-white rounded-xl text-xs font-black cursor-pointer shadow-lg"
                  >
                    {isAr ? 'إرسال للصوت' : 'Send'}
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Footer Form controller box */}
            <div className="p-3 bg-white border-t border-gray-100 flex items-center gap-2">
              <button
                onClick={() => setShowPhotoModal(true)}
                className="w-10 h-10 rounded-full hover:bg-slate-100 flex items-center justify-center text-gray-500 transition cursor-pointer"
                title={isAr ? 'مشاركة صورة' : 'Share image'}
              >
                <Image className="w-5 h-5 text-indigo-500" />
              </button>

              <button
                onMouseDown={startRecordingVoice}
                onTouchStart={startRecordingVoice}
                className="w-10 h-10 rounded-full hover:bg-slate-100 flex items-center justify-center text-gray-500 transition cursor-pointer"
                title={isAr ? 'قم بالضغط المطول للتسجيل الصوتي' : 'Voice note'}
              >
                <Mic className="w-5 h-5 text-indigo-500" />
              </button>

              <input
                type="text"
                placeholder={isAr ? 'اكتب رسالة رفيق...' : 'Type a direct message...'}
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSendDM('text'); }}
                className="flex-1 px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800"
              />

              <button
                onClick={() => handleSendDM('text')}
                disabled={!messageInput.trim()}
                className="w-10 h-10 rounded-full bg-indigo-600 hover:bg-indigo-500 flex items-center justify-center text-white transition cursor-pointer disabled:opacity-40"
              >
                <Send className="w-5 h-5 rotate-[320deg] ml-0.5" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Share photo popup model drawer */}
      <AnimatePresence>
        {showPhotoModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-[100] p-4 animate-in fade-in duration-200">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-3xl p-6 max-w-sm w-full border border-gray-100 shadow-2xl relative space-y-4"
            >
              <div className="flex justify-between items-center pb-2 border-b">
                <span className="text-xs font-black text-gray-900">{isAr ? 'مشاركه رابط صورة رائع للطلعة' : 'Attach Spot Photo URL'}</span>
                <button onClick={() => setShowPhotoModal(false)} className="text-gray-500 hover:text-gray-900">✕</button>
              </div>

              <div className="space-y-3">
                <input
                  type="text"
                  placeholder="https://images.unsplash.com/photo-..."
                  value={photoUrlInput}
                  onChange={(e) => setPhotoUrlInput(e.target.value)}
                  className="w-full p-2.5 bg-gray-50 border rounded-xl text-xs"
                />
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => {
                      handleSendDM('image', photoUrlInput || 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=850&q=80');
                      setPhotoUrlInput('');
                      setShowPhotoModal(false);
                    }}
                    className="py-2 bg-indigo-600 text-white rounded-xl text-xs font-black"
                  >
                    {isAr ? 'إرسال الصورة' : 'Post image'}
                  </button>
                  <button
                    onClick={() => {
                      handleSendDM('image', 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&w=850&q=80');
                      setPhotoUrlInput('');
                      setShowPhotoModal(false);
                    }}
                    className="py-2 bg-slate-100 text-gray-700 rounded-xl text-[10px] font-bold"
                  >
                    {isAr ? 'رابط مقهى تجريبي' : 'Use demo Cafe'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

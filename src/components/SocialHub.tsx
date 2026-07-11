import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { offlineSyncService } from '../services/offlineSyncService';
import { FriendshipManager } from '../services/friendshipManager';
import { Profile } from '../types';
import { Language, translations } from '../data/translations';
import { haptic } from '../lib/haptics';
import { 
  Plus, X, Send, Image as ImageIcon, MessageCircle, Mic, Play, Pause, Smile, 
  Search, UserPlus, Check, CheckCheck, Trash2, Heart, MessageSquare, AlertCircle, Sparkles, SendToBack, Radio, ChevronRight, ArrowLeft
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { renderAvatar } from './MatesReels';
import FriendshipRequestsView from './FriendshipRequestsView';

interface SocialHubProps {
  currentUser: Profile;
  allProfiles: Profile[];
  allOutings?: any[];
  outings?: any[];
  lang: Language;
  onClose?: () => void;
  onSelectOuting?: (outing: any) => void;
  onViewProfile?: (userId: string) => void;
  onMessage?: (profile: Profile) => void;
  onFollowToggle?: (profileId: string) => void;
  friendsList?: string[];
  onlineUsers?: Set<string>;
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
  is_read?: boolean;
  read?: boolean;
}

interface FriendRequest {
  id: string;
  senderId: string;
  receiverId: string;
  status: 'pending' | 'accepted';
  senderName: string;
  senderAvatar: string;
}

export default function SocialHub({ 
  currentUser, 
  allProfiles, 
  allOutings = [], 
  outings = [],
  lang, 
  onClose, 
  onSelectOuting,
  onViewProfile,
  onlineUsers
}: SocialHubProps) {
  const isAr = lang === 'ar';
  const t = translations[lang];

  const [activeTab, setActiveTab] = useState<'chats' | 'friends'>('chats');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Real-time states
  const [friends, setFriends] = useState<Profile[]>([]);
  const [pendingRequests, setPendingRequests] = useState<FriendRequest[]>([]);
  const [sentRequests, setSentRequests] = useState<string[]>([]); // Array of receiverIds
  const [activeChatFriend, setActiveChatFriend] = useState<Profile | null>(null);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  
  // Messages states
  const [chatMessages, setChatMessages] = useState<DirectMessage[]>([]);
  const [messageInput, setMessageInput] = useState('');
  const messageInputRef = useRef(messageInput);
  useEffect(() => {
    messageInputRef.current = messageInput;
  }, [messageInput]);

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

  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (activeChatFriend && messageInputRef.current.trim().length > 0) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [activeChatFriend]);

  useEffect(() => {
    const handleInternalBack = (e: Event) => {
      const detail = (e as CustomEvent).detail;

      if (lightboxImage) {
        setLightboxImage(null);
        e.preventDefault();
        return;
      }
      if (showPhotoModal) {
        setShowPhotoModal(false);
        e.preventDefault();
        return;
      }
      if (activeChatFriend) {
        if (messageInputRef.current.trim().length > 0) {
          const confirmExit = window.confirm(
            isAr 
              ? 'لديك مسودة رسالة لم تُرسل بعد. هل أنت متأكد من الخروج والرجوع للقائمة؟' 
              : 'You have an unsent draft. Are you sure you want to go back to the list?'
          );
          if (!confirmExit) {
            if (detail) detail.blocked = true;
            e.preventDefault();
            return;
          }
        }
        setActiveChatFriend(null);
        e.preventDefault();
        return;
      }
    };

    window.addEventListener('request_internal_back', handleInternalBack);
    return () => window.removeEventListener('request_internal_back', handleInternalBack);
  }, [activeChatFriend, lightboxImage, showPhotoModal, isAr]);

  const mergedOutings = (outings && outings.length > 0) ? outings : allOutings;

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
      .channel('friend_requests_hub_channel')
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

      try {
        let uniqueFriendIds: string[] = [];

        // BYPASS standard SELECT * and use dedicated RPC for consistent visibility
        const { data, error } = await supabase.rpc('get_friendship_data', { p_user_id: currentUser.id });
        
        if (!error && data && data.friend_ids) {
          uniqueFriendIds = data.friend_ids as string[];
        } else {
           const { data: reqs } = await supabase.from('friend_requests').select('senderId, receiverId').eq('status', 'accepted').or(`senderId.eq.${currentUser.id},receiverId.eq.${currentUser.id}`);
           if (reqs) {
              uniqueFriendIds = Array.from(new Set(reqs.map(r => r.senderId === currentUser.id ? r.receiverId : r.senderId)));
           }
        }

        if (uniqueFriendIds.length > 0) {
          let matchedFriends = (allProfiles || []).filter(p => uniqueFriendIds.includes(p.id));
          
          if (matchedFriends.length < uniqueFriendIds.length) {
            const missingIds = uniqueFriendIds.filter(id => !matchedFriends.some(p => p.id === id));
            const { data: missingProfiles } = await supabase.from('users').select('*').in('id', missingIds);
            if (missingProfiles) {
              matchedFriends = [...matchedFriends, ...missingProfiles];
            }
          }
          
          const finalFriends = Array.from(new Map(matchedFriends.map(f => [f.id, f])).values());
          setFriends(finalFriends);
          try {
            localStorage.setItem(`mates_cached_friends_${currentUser.id}`, JSON.stringify(finalFriends));
          } catch (e) {}
        } else {
          setFriends([]);
        }
      } catch (err) {
        console.error('[SocialHub] RPC friendship sync failed:', err);
      }
    };
    fetchFriends();

    const channel = supabase
      .channel('hub_friendships_channel')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'friend_requests',
        filter: `status=eq.accepted`
      }, () => fetchFriends())
      .subscribe();

    return () => {
        supabase.removeChannel(channel);
    };
  }, [currentUser, allProfiles]);

  // Listen and fetch unread message counts in real-time
  useEffect(() => {
    if (!currentUser) return;

    const fetchUnreadCounts = async () => {
      try {
        const { data, error } = await supabase
          .from('direct_messages')
          .select('senderId, read, is_read')
          .eq('receiverId', currentUser.id);

        if (!error && data) {
          const counts: Record<string, number> = {};
          data.forEach(msg => {
            const isRead = msg.read === true || msg.is_read === true || msg.read === 'true' || msg.is_read === 'true';
            if (!isRead) {
              counts[msg.senderId] = (counts[msg.senderId] || 0) + 1;
            }
          });
          setUnreadCounts(counts);
        }
      } catch (err) {
        console.error('Error fetching unread counts:', err);
      }
    };

    fetchUnreadCounts();

    const channel = supabase
      .channel('unread_message_notifications')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'direct_messages',
        filter: `receiverId=eq.${currentUser.id}`
      }, (payload) => {
        if (payload.new) {
          const senderId = payload.new.senderId;
          if (activeChatFriend?.id !== senderId) {
            setUnreadCounts(prev => ({
              ...prev,
              [senderId]: (prev[senderId] || 0) + 1
            }));
            haptic();
          }
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUser, activeChatFriend]);

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
        is_read: m.is_read || m.read,
        read: m.read || m.is_read,
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
        
        // Mark as read in db and clear local count
        try {
          supabase
            .from('direct_messages')
            .update({ read: true, is_read: true })
            .eq('chatId', currentChatId)
            .eq('receiverId', currentUser.id)
            .then(() => {
              setUnreadCounts(prev => ({
                ...prev,
                [activeChatFriend.id]: 0
              }));
            });
        } catch (err) {
          console.error('[SocialHub] Failed to mark read:', err);
        }
      }
    };
    fetchMessages();

    // Subscribe to new messages
    const channel = supabase
      .channel('hub_messages_channel_' + currentChatId)
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'direct_messages',
        filter: `chatId=eq.${currentChatId}`
      }, (payload) => {
        if (payload.new && payload.new.receiverId === currentUser.id) {
          try {
            supabase
              .from('direct_messages')
              .update({ read: true, is_read: true })
              .eq('id', payload.new.id)
              .then(() => {});
          } catch (e) {}
        }
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

      const result = await FriendshipManager.acceptRequest(
        request.id,
        request.senderId,
        currentUser?.id,
        request.senderName,
        request.senderAvatar,
        currentUser?.name,
        currentUser?.avatar
      );

      if (!result.success) {
        console.warn('Direct accept failed, queuing offline...');
        const payload = {
          id: crypto.randomUUID(),
          requestId: request.id,
          currentUserId: currentUser?.id,
          senderId: request.senderId,
          senderName: request.senderName,
          senderAvatar: request.senderAvatar,
          receiverName: currentUser?.name,
          receiverAvatar: currentUser?.avatar
        };
        offlineSyncService.queueOutgoingFriendRequest(payload);
      }
      haptic();
    } catch (err) {
      console.error('Failed to accept friend request:', err);
    }
  };

  const handleRejectFriendRequest = async (requestId: string) => {
    if (!supabase) return;
    try {
      setPendingRequests(prev => prev.filter(r => r.id !== requestId));
      
      const { error } = await supabase
        .from('friend_requests')
        .delete()
        .eq('id', requestId);

      if (error) {
        console.warn('Direct reject failed, queuing offline...');
        const payload = {
          id: crypto.randomUUID(),
          requestId,
          currentUserId: currentUser?.id
        };
        offlineSyncService.queueOutgoingFriendRequest(payload);
      }
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

    const msgId = crypto.randomUUID();
    const dbPayload: any = {
      id: msgId,
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
      id: msgId,
      ...dbPayload,
      imageSrc: dbPayload.imageUrl,
      voiceDuration: voiceDur
    };
    
    // Add optimistic message instantly to UI state for buttery smooth interface
    setChatMessages(prev => [...prev, optimisticMsg]);
    
    try {
      const { error } = await supabase.from('direct_messages').insert([dbPayload]);
      if (error) {
        console.warn('Direct message insert failed, queueing offline:', error);
        await offlineSyncService.queueOutgoingMessage(dbPayload);
      }
    } catch (err) {
      console.warn('Direct message insert error, queueing offline:', err);
      await offlineSyncService.queueOutgoingMessage(dbPayload);
    }
  };

  const handleReactToMessage = async (msgId: string, emoji: string) => {
    if (!currentUser || !supabase) return;
    try {
      const matchedMsg = chatMessages.find(m => m.id === msgId);
      if (!matchedMsg) return;

      const updatedReactions = { ...(matchedMsg.reactions || {}) };
      
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
    if (playingVoiceId === msgId) {
      clearInterval(playbackTimers.current[msgId]);
      delete playbackTimers.current[msgId];
      setPlayingVoiceId(null);
      return;
    }

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

  useEffect(() => {
    return () => {
      if (recordingTimer.current) clearInterval(recordingTimer.current as any);
      Object.values(playbackTimers.current).forEach(t => clearInterval(t as any));
    };
  }, []);

  const activeFriendIds = friends.map(f => f.id);
  const myOutings = (mergedOutings || []).filter(o => o.attendeeIds?.includes(currentUser.id) || o.creatorId === currentUser.id);

  const pendingSenderIds = pendingRequests.map(r => r.senderId);
  const potentialCandsList = (allProfiles || []).filter(p => 
    p.id !== currentUser.id && 
    !activeFriendIds.includes(p.id) &&
    !pendingSenderIds.includes(p.id) &&
    (!searchQuery || p.name.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="flex flex-col h-full bg-slate-50 overflow-hidden relative" dir={isAr ? 'rtl' : 'ltr'}>
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
                  <button onClick={onClose} className="p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer">
                    <X className="w-5 h-5" />
                  </button>
                )}
              </div>
            </div>

            {/* Segment switch */}
            <div className="p-3 bg-white flex border-b border-gray-100 gap-2">
              <button
                onClick={() => { setActiveTab('chats'); setSearchQuery(''); }}
                className={`flex-1 py-2 text-xs font-black rounded-xl transition cursor-pointer ${activeTab === 'chats' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/15' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
              >
                💬 {isAr ? 'الدردشات المباشرة' : 'DMs'}
              </button>
              <button
                onClick={() => { setActiveTab('friends'); setSearchQuery(''); }}
                className={`flex-1 py-2 text-xs font-black rounded-xl transition cursor-pointer ${activeTab === 'friends' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/15' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
              >
                👥 {isAr ? `الأصدقاء (${friends?.length || 0})` : `Buddies (${friends?.length || 0})`}
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
                (!friends || (friends?.length || 0) === 0) && (!myOutings || (myOutings?.length || 0) === 0) ? (
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
                            <span className={`absolute bottom-0 right-0 w-3 h-3 border-2 border-white rounded-full ${onlineUsers?.has(fr.id) ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]' : 'bg-slate-300'}`}></span>
                          </div>
                          <div className="text-right">
                            <h4 className="text-xs font-black text-gray-900 flex items-center gap-1.5">
                              {fr.name}
                              {fr.verified && <span className="text-[10px] text-blue-500" title={isAr ? 'رفيق موثق' : 'Verified companion'}>✓</span>}
                            </h4>
                            {fr.moodText ? (
                              <div className="flex items-center gap-1 mt-1 text-[9px] text-indigo-600 bg-indigo-50/70 border border-indigo-100/50 px-1.5 py-0.5 rounded-lg w-fit">
                                <span>{fr.moodEmoji || '😊'}</span>
                                <span className="truncate max-w-[120px] font-bold">{fr.moodText}</span>
                              </div>
                            ) : (
                              <p className="text-[10px] text-slate-500 font-medium max-w-[170px] truncate">
                                {fr.archetype || (isAr ? 'مستعد لمشاركتك الطلعة 🌟' : 'Ready to hang out!')}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-col items-end gap-1.5">
                          <span className="text-[9px] font-mono font-bold text-slate-400 bg-gray-100 px-2 py-0.5 rounded-full uppercase">
                            {fr.location}
                          </span>
                          {unreadCounts[fr.id] > 0 ? (
                            <span className="text-[10px] bg-rose-500 text-white font-black px-2.5 py-0.5 rounded-full animate-pulse shadow-sm">
                              {unreadCounts[fr.id]}
                            </span>
                          ) : (
                            <span className="text-[10px] text-indigo-600 font-bold group-hover:underline">
                              {isAr ? 'دردش الآن 💬' : 'Chat 💬'}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </>
                )
              ) : (
                <div className="space-y-4">
                  {/* Requests Received segment */}
                  <FriendshipRequestsView currentUser={currentUser} lang={lang} />

                  {/* Friends section */}
                  {(friends && (friends?.length || 0) > 0) && (
                    <div className="space-y-2">
                      <span className="text-[10px] font-black text-gray-400 tracking-widest block uppercase">
                        {isAr ? 'أصدقاؤك الحاليين' : 'MY ACTIVE BUDDIES'}
                      </span>
                      {friends.map(fr => (
                        <div key={fr.id} className="flex items-center justify-between p-2.5 bg-white rounded-2xl border border-gray-100 shadow-xs">
                          <div 
                            className="flex items-center gap-2.5 cursor-pointer hover:opacity-80 transition"
                            onClick={() => onViewProfile && onViewProfile(fr.id)}
                          >
                            {renderAvatar(fr.avatar, "w-8 h-8 rounded-full object-cover")}
                            <div>
                              <span className="text-xs font-black text-slate-800 block leading-tight">{fr.name}</span>
                              {fr.moodText ? (
                                <span className="inline-flex items-center gap-1 text-[9px] text-indigo-600 font-black bg-indigo-50 border border-indigo-100/30 px-1.5 py-0.5 rounded-md mt-1">
                                  <span>{fr.moodEmoji || '😊'}</span>
                                  <span>{fr.moodText}</span>
                                </span>
                              ) : (
                                <span className="text-[9px] text-indigo-600 font-bold">{isAr ? 'دروازه الدردشة نشطة' : 'Active Channel'}</span>
                              )}
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
                    {(!potentialCandsList || potentialCandsList.length === 0) ? (
                      <div className="text-center py-6 text-xs text-gray-400 italic">
                        {isAr ? 'لم نجد رفقاء متاحين للتوصية.' : 'No match candidates.'}
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {potentialCandsList.map(cand => {
                          const requestSent = sentRequests.includes(cand.id);
                          return (
                            <div key={cand.id} className="p-3 bg-white rounded-2xl border border-gray-100 flex items-center justify-between">
                              <div 
                                className="flex items-center gap-2.5 cursor-pointer hover:opacity-80 transition"
                                onClick={() => onViewProfile && onViewProfile(cand.id)}
                              >
                                {renderAvatar(cand.avatar, "w-9 h-9 rounded-full object-cover")}
                                <div className="text-right">
                                  <span className="text-xs font-black text-gray-900 block">{cand.name}</span>
                                  <span className="text-[10px] text-gray-500 font-medium block">
                                    {cand.gender === 'male' ? (isAr ? 'شاب' : 'Male') : (isAr ? 'فتاة' : 'Female')} ● {cand.location}
                                  </span>
                                </div>
                              </div>

                              <button
                                onClick={() => requestSent ? handleCancelFriendRequest(cand.id) : handleSendFriendRequest(cand.id)}
                                className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center justify-center min-w-[90px] ${
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
                  onClick={() => window.dispatchEvent(new CustomEvent('request_internal_back'))}
                  className="p-1.5 hover:bg-gray-100 rounded-xl transition cursor-pointer text-gray-600"
                  title={isAr ? 'العودة للقائمة' : 'Back to chat list'}
                >
                  <ArrowLeft className={`w-5 h-5 ${isAr ? 'rotate-180' : ''}`} />
                </button>
                <div 
                  className="relative cursor-pointer hover:opacity-80 transition"
                  onClick={() => onViewProfile && onViewProfile(activeChatFriend.id)}
                >
                  {renderAvatar(activeChatFriend.avatar, "w-10 h-10 rounded-full object-cover")}
                  <span className={`absolute bottom-0 right-0 w-2.5 h-2.5 border-2 border-white rounded-full ${onlineUsers?.has(activeChatFriend.id) ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`}></span>
                </div>
                <div 
                  className="text-right cursor-pointer hover:opacity-80 transition"
                  onClick={() => onViewProfile && onViewProfile(activeChatFriend.id)}
                >
                  <h3 className="text-xs font-black text-gray-900 flex items-center gap-1">
                    {activeChatFriend.name}
                  </h3>
                  <p className={`text-[9px] font-bold ${onlineUsers?.has(activeChatFriend.id) ? 'text-emerald-600' : 'text-slate-400'}`}>
                    {onlineUsers?.has(activeChatFriend.id) 
                      ? (isAr ? 'نشط الآن (طلعات)' : 'Active now')
                      : (isAr ? 'غير متصل' : 'Offline')}
                  </p>
                </div>
              </div>

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
                      {!belongsToMe && renderAvatar(activeChatFriend.avatar, "w-7 h-7 rounded-full object-cover self-end mb-1")}
                      
                      <div className="flex flex-col relative">
                        <div
                          onClick={() => setSelectedEmojiMessageId(selectedEmojiMessageId === msg.id ? null : msg.id)}
                          className={`p-3 rounded-2xl text-xs leading-relaxed transition-all relative ${
                            belongsToMe 
                              ? 'bg-gradient-to-tr from-indigo-600 to-indigo-500 text-white rounded-br-none shadow-sm' 
                              : 'bg-white border border-gray-100 text-slate-900 rounded-bl-none shadow-xs'
                          }`}
                        >
                          {msg.type === 'image' && msg.imageSrc && (
                            <div 
                              className="mb-2 max-w-[200px] rounded-xl overflow-hidden shadow-xs border border-white/20 cursor-zoom-in"
                              onClick={(e) => { e.stopPropagation(); setLightboxImage(msg.imageSrc || null); }}
                            >
                              <img src={msg.imageSrc} alt="Shared media" className="w-full h-auto object-cover hover:scale-[1.02] transition-transform" />
                            </div>
                          )}

                          {msg.type === 'voice' ? (
                            <div className="flex items-center gap-3 min-w-[210px] py-1">
                              <button
                                onClick={(e) => { e.stopPropagation(); togglePlayVoiceMessage(msg.id, msg.voiceDuration || 4); }}
                                className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-colors ${belongsToMe ? 'bg-white/20 text-white hover:bg-white/30' : 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200'}`}
                              >
                                {playingVoiceId === msg.id ? <Pause className="w-4 h-4 fill-current animate-pulse" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
                              </button>
                              
                              <div className="flex-1">
                                <div className="h-1.5 w-full bg-gray-200/50 rounded-full overflow-hidden relative">
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

                        <div className={`flex items-center gap-1 mt-1 px-1 ${belongsToMe ? 'justify-end' : 'justify-start'}`}>
                          <span className="text-[9px] text-slate-400">
                            {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          {belongsToMe && (
                            (msg.is_read || msg.read) ? (
                              <CheckCheck className="w-3 h-3 text-blue-500" />
                            ) : (
                              <Check className="w-3 h-3 text-slate-300" />
                            )
                          )}
                        </div>

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
                <ImageIcon className="w-5 h-5 text-indigo-500" />
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
                  className="w-full p-2.5 bg-gray-50 border rounded-xl text-xs text-slate-800"
                />
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => {
                      handleSendDM('image', photoUrlInput || 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=850&q=80');
                      setPhotoUrlInput('');
                      setShowPhotoModal(false);
                    }}
                    className="py-2 bg-indigo-600 text-white rounded-xl text-xs font-black cursor-pointer"
                  >
                    {isAr ? 'إرسال الصورة' : 'Post image'}
                  </button>
                  <button
                    onClick={() => {
                      handleSendDM('image', 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&w=850&q=80');
                      setPhotoUrlInput('');
                      setShowPhotoModal(false);
                    }}
                    className="py-2 bg-slate-100 text-gray-700 rounded-xl text-[10px] font-bold cursor-pointer"
                  >
                    {isAr ? 'رابط مقهى تجريبي' : 'Use demo Cafe'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {lightboxImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[110] bg-black/95 flex flex-col items-center justify-center p-4 cursor-zoom-out"
            onClick={() => setLightboxImage(null)}
          >
            <button 
              onClick={(e) => { e.stopPropagation(); setLightboxImage(null); }}
              className="absolute top-6 right-6 p-2 bg-white/10 text-white rounded-full hover:bg-white/20 transition cursor-pointer"
            >
              <X className="w-6 h-6" />
            </button>
            <motion.img 
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              src={lightboxImage} 
              alt="Expanded Preview" 
              className="max-w-full max-h-[85vh] object-contain rounded-xl shadow-2xl"
              onClick={(e) => e.stopPropagation()}
              referrerPolicy="no-referrer"
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

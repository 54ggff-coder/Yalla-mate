import React, { useState, useEffect, useRef } from 'react';
import { useMessages } from '../hooks/useMessages';
import { Profile, Message } from '../types';
import { Language } from '../data/translations';
import { supabase } from '../lib/supabase';
import ProfilePreview from './ProfilePreview';
import { useGlobalAI } from '../contexts/GlobalAIContext';
import { offlineSyncService } from '../services/offlineSyncService';
import { 
  Send, 
  ArrowLeft, 
  Image as ImageIcon, 
  MapPin, 
  Smile, 
  MoreVertical, 
  Phone, 
  Video,
  Check,
  CheckCheck,
  Search,
  Users,
  FileText,
  Sparkles,
  Mic,
  Trash2,
  Pin,
  PinOff,
  X,
  Play,
  Pause,
  Download
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface DirectMessageViewProps {
  currentUser: Profile;
  lang: Language;
  onClose: () => void;
  onCloseAll: () => void;
  targetProfile?: Profile;
  onlineUsers?: Set<string>;
  onViewProfile?: (userId: string) => void;
  onUnsentChange?: (hasUnsent: boolean) => void;
  allProfiles?: Profile[];
}

// Custom High-Fidelity Voice Clip Player
function VoiceMessagePlayer({ voiceUrl, duration, isMine }: { voiceUrl: string; duration?: number; isMine: boolean }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const audio = new Audio(voiceUrl);
    audioRef.current = audio;

    const updateProgress = () => {
      if (audio.duration) {
        setProgress((audio.currentTime / audio.duration) * 100);
      }
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setProgress(0);
    };

    audio.addEventListener('timeupdate', updateProgress);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.pause();
      audio.removeEventListener('timeupdate', updateProgress);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [voiceUrl]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().then(() => {
        setIsPlaying(true);
      }).catch(err => console.error('Audio playback failed:', err));
    }
  };

  const formatTime = (secs: number) => {
    if (isNaN(secs)) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className={`flex items-center gap-3 p-2 rounded-xl border min-w-[210px] ${
      isMine 
        ? 'bg-indigo-700/50 border-white/15 text-white' 
        : 'bg-white border-gray-100 text-gray-800 shadow-xs'
    }`} dir="ltr">
      <button 
        onClick={togglePlay}
        className={`w-9 h-9 rounded-full flex items-center justify-center shadow-xs hover:scale-105 transition shrink-0 cursor-pointer ${
          isMine ? 'bg-white text-indigo-600' : 'bg-indigo-600 text-white'
        }`}
      >
        {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current translate-x-[1px]" />}
      </button>
      <div className="flex-1">
        <div className={`w-full h-1.5 rounded-full overflow-hidden ${isMine ? 'bg-white/20' : 'bg-gray-100'}`}>
          <div className={`h-full transition-all duration-100 ${isMine ? 'bg-white' : 'bg-indigo-600'}`} style={{ width: `${progress}%` }} />
        </div>
        <div className={`flex justify-between items-center text-[9px] mt-1 font-mono ${isMine ? 'text-white/80' : 'text-gray-400'}`}>
          <span>{isPlaying && audioRef.current ? formatTime(audioRef.current.currentTime) : '0:00'}</span>
          <span>{duration ? formatTime(duration) : '0:10'}</span>
        </div>
      </div>
    </div>
  );
}

export default function DirectMessageView({ currentUser, lang, onClose, onCloseAll, targetProfile, onlineUsers, onViewProfile, onUnsentChange, allProfiles }: DirectMessageViewProps) {
  const isAr = lang === 'ar';
  const [chats, setChats] = useState<any[]>([]);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [messages_, setMessages] = useState<any[]>([]);
  const { messages, loading: messagesLoading } = useMessages(selectedChatId, 'chat');
  
  // Custom states for new interactive capabilities
  const [isPartnerOnline, setIsPartnerOnline] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<any>(null);
  const presenceTimeoutRef = useRef<any>(null);

  useEffect(() => {
    setMessages(messages);
  }, [messages]);

  const [newMessage, setNewMessage] = useState('');
  const newMessageRef = useRef(newMessage);
  useEffect(() => {
    newMessageRef.current = newMessage;
    if (onUnsentChange) {
      onUnsentChange(newMessage.trim().length > 0);
    }
  }, [newMessage, onUnsentChange]);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (selectedChatId && newMessageRef.current.trim().length > 0) {
        e.preventDefault();
        e.returnValue = ''; // Trigger browser prompt
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [selectedChatId]);

  useEffect(() => {
    const handleInternalBack = (e: Event) => {
      const detail = (e as CustomEvent).detail;

      // If lightbox is open, close it first
      if (lightboxImage) {
        setLightboxImage(null);
        e.preventDefault();
        return;
      }
      
      // If we are deep inside a chat, go back to the chat list
      if (selectedChatId) {
        // GUARD: Check for unsent text
        if (newMessageRef.current.trim().length > 0) {
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
        
        setSelectedChatId(null);
        setNewMessage('');
        e.preventDefault();
        return;
      }
    };
    
    window.addEventListener('request_internal_back', handleInternalBack);
    return () => {
      window.removeEventListener('request_internal_back', handleInternalBack);
    };
  }, [selectedChatId, lightboxImage, isAr]);
  const [activePartner, setActivePartner] = useState<Profile | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [smartReplies, setSmartReplies] = useState<string[]>([]);
  
  const [isTyping, setIsTyping] = useState(false);
  const [partnerTyping, setPartnerTyping] = useState(false);
  const typingTimeoutRef = useRef<any>(null);
  const broadcastChannelRef = useRef<any>(null);

  // Helper presence timeout trigger
  const resetPresenceTimeout = () => {
    if (presenceTimeoutRef.current) clearTimeout(presenceTimeoutRef.current);
    presenceTimeoutRef.current = setTimeout(() => {
      setIsPartnerOnline(false);
    }, 15000); // Offline after 15 seconds of silence
  };

  // Explicit cleanup on unmount
  useEffect(() => {
    return () => {
      console.log('DirectMessageView: Explicitly cleaning up timers and listeners...');
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }
      if (presenceTimeoutRef.current) {
        clearTimeout(presenceTimeoutRef.current);
        presenceTimeoutRef.current = null;
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      
      // Stop any active camera/mic streams
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => {
          track.stop();
          console.log(`DirectMessageView: Stopped stream track: ${track.kind}`);
        });
        streamRef.current = null;
      }

      // Cleanup broadcast objects
      if (broadcastChannelRef.current) {
        broadcastChannelRef.current.unsubscribe();
        supabase.removeChannel(broadcastChannelRef.current);
        broadcastChannelRef.current = null;
      }
    };
  }, []);

  // Setup real-time typing indicators & peer presence using Supabase Presence
  useEffect(() => {
    if (!selectedChatId || !currentUser) return;
    
    setPartnerTyping(false);
    setIsPartnerOnline(false);
    
    const channel = supabase.channel(`presence:${selectedChatId}`, {
      config: {
        presence: {
          key: currentUser.id,
        },
      },
    });
    broadcastChannelRef.current = channel;
    
    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        let otherUserTyping = false;
        let otherUserOnline = false;
        Object.keys(state).forEach((uId) => {
          if (uId !== currentUser.id) {
            const presences = state[uId] as any[];
            if (presences && presences.length > 0) {
              otherUserOnline = true;
              if (presences.some((p: any) => p.isTyping)) {
                otherUserTyping = true;
              }
            }
          }
        });
        setPartnerTyping(otherUserTyping);
        setIsPartnerOnline(otherUserOnline);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            isTyping: false,
            onlineAt: new Date().toISOString()
          });
        }
      });
      
    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedChatId, currentUser]);

  const handleTyping = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setNewMessage(e.target.value);
    
    if (!isTyping) {
      setIsTyping(true);
      if (broadcastChannelRef.current) {
        broadcastChannelRef.current.track({
          isTyping: true,
          onlineAt: new Date().toISOString()
        });
      }
    }
    
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      if (broadcastChannelRef.current) {
        broadcastChannelRef.current.track({
          isTyping: false,
          onlineAt: new Date().toISOString()
        });
      }
    }, 1500);
  };

  const { getSmartChatReply } = useGlobalAI();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
    if (messages.length > 0) {
      const lastMsg = messages[messages.length - 1];
      if (lastMsg.senderId !== currentUser.id) {
        getSmartChatReply(
          messages.slice(-5).map(m => m.content), 
          'Social chatting'
        ).then(setSmartReplies);
      } else {
        setSmartReplies([]);
      }
    }
  }, [messages]);

  // Mark received messages as read
  useEffect(() => {
    if (!selectedChatId || !currentUser || !supabase) return;

    const markAsRead = async () => {
      try {
        await supabase
          .from('direct_messages')
          .update({ is_read: true, read: true })
          .eq('chatId', selectedChatId)
          .eq('receiverId', currentUser.id);
      } catch (err) {
        console.error('Failed to mark messages as read:', err);
      }
    };

    markAsRead();
  }, [selectedChatId, messages, currentUser]);

   // Fetch active chats
  useEffect(() => {
    if (!currentUser || !supabase) return;

    const fetchChats = async () => {
      if (!supabase) return;
      try {
        const { data: usersData, error: usersErr } = await supabase
          .from('users')
          .select('id, name, avatar, "displayName"');

        const { data, error } = await supabase
          .from('direct_messages')
          .select('id, "chatId", "senderId", "receiverId", content, timestamp, "senderName", "senderAvatar", is_read, read')
          .or(`"senderId".eq.${currentUser.id},"receiverId".eq.${currentUser.id}`)
          .order('timestamp', { ascending: false });
        
        if (error) throw error;
        if (data) {
          const uniqueChats = new Map<string, any>();
          
          data.forEach((msg: any) => {
            const cId = msg.chatId;
            if (!cId) return;
            
            if (!uniqueChats.has(cId)) {
              const isSender = msg.senderId === currentUser.id;
              const partnerId = isSender ? msg.receiverId : msg.senderId;
              const partnerProfile = usersData?.find((u: any) => u.id === partnerId);
              
              uniqueChats.set(cId, {
                id: cId,
                participantIds: [msg.senderId, msg.receiverId],
                lastMessage: msg.content,
                lastMessageTimestamp: msg.timestamp,
                partnerId: partnerId,
                unreadCount: 0,
                participants: {
                  [partnerId]: {
                    name: partnerProfile?.displayName || partnerProfile?.name || (isSender ? 'Mate' : msg.senderName || 'Mate'),
                    avatar: partnerProfile?.avatar || (isSender ? '👤' : msg.senderAvatar || '👤')
                  }
                }
              });
            }

            // Calculate unread count for received messages
            if (msg.receiverId === currentUser.id && !(msg.is_read || msg.read)) {
              const chat = uniqueChats.get(cId);
              if (chat) chat.unreadCount++;
            }
          });
          
          setChats(Array.from(uniqueChats.values()));
        }
      } catch (err) {
        console.error('Failed to fetch chats from Supabase:', err);
      }
    };

    fetchChats();

    const channel = supabase
      .channel('public:direct_messages_feed')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'direct_messages' }, () => {
        fetchChats();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUser]);

  // Unified DM Sender Supporting Text, Images, and Voice Clips
  const sendMessageEx = async (options?: { content?: string; imageUrl?: string; voiceUrl?: string; audioDuration?: number }) => {
    if (!selectedChatId || !activePartner || !supabase) return;

    const contentVal = options?.content ?? newMessage;
    if (!contentVal.trim() && !options?.imageUrl && !options?.voiceUrl) return;

    const msgData = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      chatId: selectedChatId,
      senderId: currentUser.id,
      receiverId: activePartner.id,
      content: contentVal,
      timestamp: new Date().toISOString(),
      imageUrl: options?.imageUrl,
      voiceUrl: options?.voiceUrl,
      audioDuration: options?.audioDuration,
      isPinned: false,
      is_pinned: false,
      type: options?.voiceUrl ? 'voice' : (options?.imageUrl ? 'image' : 'text')
    };
    
    if (!options) {
      setNewMessage('');
    }

    try {
      await offlineSyncService.queueOutgoingMessage(msgData);
      window.dispatchEvent(new CustomEvent('pending_messages_changed'));
      
      const chatUpdate = {
        participantIds: [currentUser.id, activePartner.id],
        lastMessage: contentVal,
        lastMessageTimestamp: new Date().toISOString(),
        participants: {
          [currentUser.id]: { name: currentUser.name, avatar: currentUser.avatar },
          [activePartner.id]: { name: activePartner.name, avatar: activePartner.avatar }
        }
      };

      await supabase
        .from('chats')
        .upsert({
          id: selectedChatId,
          ...chatUpdate
        });
    } catch (e) {
      console.error('Error sending DM or updating chat:', e);
    }
  };

  const handleSendMessage = () => sendMessageEx();

  // Highlight and Scroll to Selected Message in chat stream
  const scrollToMessage = (msgId: string) => {
    const el = document.getElementById(`msg-bubble-${msgId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('ring-4', 'ring-indigo-400', 'scale-[1.03]');
      setTimeout(() => {
        el.classList.remove('ring-4', 'ring-indigo-400', 'scale-[1.03]');
      }, 1500);
    }
  };

  // Toggle Pinned Status of Important Messages
  const togglePinMessage = async (msgId: string, currentPinStatus: boolean) => {
    if (!supabase) return;
    try {
      const { error } = await supabase
        .from('direct_messages')
        .update({ isPinned: !currentPinStatus, is_pinned: !currentPinStatus })
        .eq('id', msgId);
      if (error) throw error;
      setMessages(prev => prev.map(m => m.id === msgId ? { ...m, isPinned: !currentPinStatus, is_pinned: !currentPinStatus } : m));
    } catch (err) {
      console.error('Failed to pin/unpin message:', err);
    }
  };

  // Inline Media / Camera / Image Selector Upload
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64 = reader.result as string;
      await sendMessageEx({ 
        content: isAr ? '🖼️ صورة مرفقة' : '🖼️ Sent a photo', 
        imageUrl: base64 
      });
    };
    reader.readAsDataURL(file);
  };

  // Voice Recording Controller
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      
      const chunks: Blob[] = [];
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(chunks, { type: 'audio/webm' });
        try {
          const fileName = `voice_${Date.now()}_${Math.random().toString(36).substring(2, 11)}.webm`;
          const { data, error } = await supabase.storage
            .from('reels')
            .upload(fileName, audioBlob, {
              cacheControl: '3600',
              upsert: false,
              contentType: 'audio/webm'
            });
          
          if (error) throw error;
          
          const { data: publicUrlData } = supabase.storage
            .from('reels')
            .getPublicUrl(fileName);
            
          const publicUrl = publicUrlData.publicUrl;
          
          await sendMessageEx({
            content: isAr ? '🎤 رسالة صوتية' : '🎤 Voice message',
            voiceUrl: publicUrl,
            audioDuration: recordingDuration
          });
        } catch (storageErr) {
          console.error('Failed to upload voice message to storage, using fallback:', storageErr);
          const reader = new FileReader();
          reader.onloadend = async () => {
            const base64 = reader.result as string;
            await sendMessageEx({
              content: isAr ? '🎤 رسالة صوتية' : '🎤 Voice message',
              voiceUrl: base64,
              audioDuration: recordingDuration
            });
          };
          reader.readAsDataURL(audioBlob);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingDuration(0);
      
      timerRef.current = setInterval(() => {
        setRecordingDuration(prev => {
          if (prev >= 60) { // Limit to 60 seconds
            stopRecording(true);
            return prev;
          }
          return prev + 1;
        });
      }, 1000);
    } catch (err) {
      console.error('Failed to record audio:', err);
    }
  };

  const stopRecording = (shouldSend: boolean) => {
    if (timerRef.current) clearInterval(timerRef.current);
    
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      if (!shouldSend) {
        mediaRecorderRef.current.onstop = () => {};
      }
      mediaRecorderRef.current.stop();
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }

    setIsRecording(false);
  };

  const [selectedEmojiMessageId, setSelectedEmojiMessageId] = useState<string | null>(null);
  const pressTimer = useRef<any>(null);

  const handlePressStart = (msgId: string) => {
    pressTimer.current = setTimeout(() => {
      setSelectedEmojiMessageId(msgId);
    }, 500); 
  };

  const handlePressEnd = () => {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
    }
  };

  const handleReactToMessage = async (msgId: string, emoji: string) => {
    if (!currentUser || !supabase) return;
    try {
      const matchedMsg = messages.find(m => m.id === msgId);
      if (!matchedMsg) return;

      const updatedReactions = { ...(matchedMsg.reactions || {}) };
      
      if (updatedReactions[currentUser.id] === emoji) {
        delete updatedReactions[currentUser.id];
      } else {
        updatedReactions[currentUser.id] = emoji;
      }

      const { error } = await supabase
        .from('direct_messages')
        .update({ reactions: updatedReactions })
        .eq('id', msgId);
        
      if (error) throw error;
    } catch (err) {
      console.error('Failed to react to message:', err);
    }
    setSelectedEmojiMessageId(null);
  };

  const exportChatLog = () => {
    const logContent = messages.map(m => `[${new Date(m.timestamp).toLocaleString()}] ${m.senderId === currentUser.id ? 'Me' : activePartner?.name}: ${m.content}`).join('\n');
    const blob = new Blob([logContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chat_log_${activePartner?.name}.txt`;
    a.click();
  };

  return (
    <div className="fixed inset-0 bg-white z-[60] flex flex-col md:flex-row animate-in fade-in duration-300 animate-out duration-200" dir={isAr ? 'rtl' : 'ltr'}>
      
      {/* Sidebar: Chat List */}
      <AnimatePresence mode="wait">
        {!selectedChatId || window.innerWidth >= 768 ? (
          <motion.div 
            key="chat-sidebar"
            initial={{ opacity: 0, x: isAr ? 20 : -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: isAr ? 20 : -20 }}
            className={`w-full md:w-80 border-e border-gray-100 flex flex-col h-full bg-slate-50/30 ${selectedChatId && 'hidden md:flex'}`}
          >
            <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-white">
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => {
                    if (selectedChatId && newMessage.trim().length > 0) {
                      const confirmExit = window.confirm(
                        isAr 
                          ? 'لديك مسودة رسالة لم تُرسل بعد. هل أنت متأكد من الخروج؟' 
                          : 'You have an unsent draft. Are you sure you want to leave?'
                      );
                      if (!confirmExit) return;
                    }
                    onClose();
                  }} 
                  className="p-2 hover:bg-gray-100 rounded-full transition flex items-center justify-center cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
                <h1 className="text-lg font-black text-gray-900">{isAr ? 'الرسائل' : 'Direct'}</h1>
              </div>
              <button className="p-2 hover:bg-gray-100 rounded-full transition">
                <Users className="w-5 h-5 text-gray-600" />
              </button>
            </div>

            <div className="p-4">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-gray-400" />
                <input 
                  type="text" 
                  placeholder={isAr ? 'بحث في المحادثات...' : 'Search messages...'}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-gray-100 border-none rounded-xl py-2 px-9 text-xs focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {/* Previous Chat List Logic ... (No changes here, kept for structure) */}
              {(() => {
                const lowerQuery = searchQuery.toLowerCase();
                const filteredChats = chats.filter(chat => {
                  if(!searchQuery) return true;
                  const pId = chat.participantIds.find((id: string) => id !== currentUser.id);
                  const pName = chat.participants[pId]?.name || '';
                  return pName.toLowerCase().includes(lowerQuery) || (chat.lastMessage || '').toLowerCase().includes(lowerQuery);
                });

                const unchattedProfiles = (allProfiles || [])
                  .filter(p => p.id !== currentUser.id)
                  .filter(p => !chats.some(c => c.participantIds.includes(p.id)))
                  .filter(p => searchQuery && p.name.toLowerCase().includes(lowerQuery));

                if (filteredChats.length === 0 && (!searchQuery || unchattedProfiles.length === 0)) {
                  return (
                    <div className="text-center py-12 px-4">
                      <p className="text-xs text-slate-400">{isAr ? 'لا توجد محادثات نشطة بعد. ابدأ بمراسلة الرفقاء!' : 'No active chats yet. Start sliding into DMs!'}</p>
                    </div>
                  );
                }

                return (
                  <>
                    {filteredChats.map(chat => {
                      const partnerId = chat.participantIds.find((id: string) => id !== currentUser.id);
                      const partner = chat.participants[partnerId];
                      if (!partner) return null;
                      return (
                        <button
                          key={chat.id}
                          onClick={() => {
                            setSelectedChatId(chat.id);
                            setActivePartner({ id: partnerId, ...partner } as any);
                          }}
                          className={`w-full p-3 rounded-2xl flex items-center gap-3 transition-all ${selectedChatId === chat.id ? 'bg-indigo-50/70 shadow-xs' : 'hover:bg-white'}`}
                        >
                          <div 
                            className="w-12 h-12 bg-white rounded-full flex items-center justify-center text-xl border border-gray-100 shadow-xs shrink-0 relative overflow-hidden cursor-pointer"
                            onClick={(e) => { e.stopPropagation(); onViewProfile?.(partnerId); }}
                          >
                            {partner.avatar?.startsWith('http') || partner.avatar?.startsWith('data:') ? (
                              <img src={partner.avatar} alt="avatar" className="w-full h-full object-cover" />
                            ) : (
                              partner.avatar
                            )}
                            <span className={`absolute bottom-0 right-0 w-3 h-3 border-2 border-white rounded-full ${onlineUsers?.has(partnerId) ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]' : 'bg-slate-300'}`}></span>
                          </div>
                          <div className="flex-1 text-start overflow-hidden">
                            <div className="flex justify-between items-center">
                              <span className="text-sm font-black text-gray-900 truncate">{partner.name}</span>
                              <span className="text-[10px] text-gray-400">
                                {chat.lastMessageTimestamp 
                                  ? new Date(chat.lastMessageTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                  : 'now'}
                              </span>
                            </div>
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-[11px] text-gray-500 truncate flex-1">{chat.lastMessage}</p>
                              {chat.unreadCount > 0 && (
                                <span className="bg-indigo-600 text-white text-[9px] font-black min-w-[18px] h-[18px] rounded-full flex items-center justify-center px-1 shadow-sm">
                                  {chat.unreadCount}
                                </span>
                              )}
                            </div>
                          </div>
                        </button>
                      );
                    })}

                    {unchattedProfiles.length > 0 && (
                      <div className="mt-4 pt-4 border-t border-gray-100">
                        <h3 className="text-[10px] uppercase font-bold text-gray-400 mb-2 px-2">{isAr ? 'نتائج البحث' : 'More Results'}</h3>
                        <div className="space-y-1">
                          {unchattedProfiles.map(profile => (
                            <div 
                              key={profile.id}
                              onClick={() => {
                                const newChatId = [currentUser.id, profile.id].sort().join('_');
                                setSelectedChatId(newChatId);
                                setActivePartner({ id: profile.id, name: profile.name, avatar: profile.avatar } as any);
                                setSearchQuery('');
                              }}
                              className="!p-0 !bg-transparent !border-none"
                            >
                              <ProfilePreview 
                                profile={profile}
                                lang={lang}
                                onViewProfile={(id) => {
                                  onViewProfile?.(id);
                                }}
                                onlineUsers={onlineUsers}
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* Main Chat Area */}
      <AnimatePresence mode="wait">
        {selectedChatId ? (
          <motion.div 
            initial={{ opacity: 0, x: isAr ? -20 : 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: isAr ? -20 : 20 }}
            className="flex-1 flex flex-col h-full bg-white"
          >
            {activePartner ? (
              <>
                {/* Chat Header */}
                <div className="p-4 border-b border-gray-100 flex items-center justify-between shadow-xs sticky top-0 bg-white/85 backdrop-blur-md z-10">
                  <div className="flex items-center gap-3">
                    <button 
                      onClick={() => window.dispatchEvent(new CustomEvent('request_internal_back'))}
                      className="p-2 hover:bg-gray-100 rounded-full transition flex items-center justify-center cursor-pointer"
                    >
                      <ArrowLeft className={`w-5 h-5 ${isAr ? 'rotate-180' : ''}`} />
                    </button>
                    <div 
                      className="w-10 h-10 bg-slate-50 rounded-full flex items-center justify-center text-lg border border-gray-100 flex-shrink-0 cursor-pointer object-cover overflow-hidden hover:opacity-80 transition"
                      onClick={() => onViewProfile && onViewProfile(activePartner.id)}
                    >
                      {activePartner.avatar.startsWith('http') || activePartner.avatar.startsWith('data:') ? (
                        <img src={activePartner.avatar} alt="avatar" className="w-full h-full object-cover" />
                      ) : (
                        activePartner.avatar
                      )}
                    </div>
                    <div 
                      className="cursor-pointer hover:opacity-80 transition"
                      onClick={() => onViewProfile && onViewProfile(activePartner.id)}
                    >
                      <h2 className="text-sm font-black text-gray-900 flex items-center gap-2">
                        {activePartner.name}
                        {partnerTyping && (
                          <span className="text-[10px] text-gray-400 font-normal italic animate-pulse">
                            {isAr ? 'يكتب...' : 'is typing...'}
                          </span>
                        )}
                      </h2>
                      <span className={`text-[10px] flex items-center gap-1 ${(isPartnerOnline || (onlineUsers && activePartner ? onlineUsers.has(activePartner.id) : false)) ? 'text-emerald-500 font-medium' : 'text-gray-400'}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${(isPartnerOnline || (onlineUsers && activePartner ? onlineUsers.has(activePartner.id) : false)) ? 'bg-emerald-500 animate-pulse' : 'bg-gray-300'}`} />
                        {(isPartnerOnline || (onlineUsers && activePartner ? onlineUsers.has(activePartner.id) : false)) 
                          ? (isAr ? 'متصل الآن' : 'Active Now') 
                          : (isAr ? 'نشط مؤخراً' : 'Active recently')}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={onCloseAll} className="p-2.5 hover:bg-gray-100 rounded-full transition text-slate-600" title={isAr ? 'خروج' : 'Exit'}>
                      <X className="w-4.5 h-4.5" />
                    </button>
                    <button onClick={exportChatLog} className="p-2.5 hover:bg-gray-100 rounded-full transition text-slate-600" title={isAr ? 'تصدير المحادثة' : 'Export Chat'}>
                      <FileText className="w-4.5 h-4.5" />
                    </button>
                    <button className="p-2.5 hover:bg-gray-100 rounded-full transition text-slate-600">
                      <Phone className="w-4.5 h-4.5" />
                    </button>
                    <button className="p-2.5 hover:bg-gray-100 rounded-full transition text-slate-600">
                      <Video className="w-4.5 h-4.5" />
                    </button>
                    <button className="p-2.5 hover:bg-gray-100 rounded-full transition text-slate-600">
                      <MoreVertical className="w-4.5 h-4.5" />
                    </button>
                  </div>
                </div>

                {/* Pinned Messages Bar */}
                {messages.some(m => m.isPinned) && (
                  <div className="bg-amber-50/70 border-b border-amber-100 px-4 py-2 flex items-center gap-2 text-xs text-amber-900 justify-between shrink-0">
                    <div className="flex items-center gap-2 overflow-x-auto no-scrollbar scroll-smooth flex-1 py-0.5">
                      <Pin className="w-3.5 h-3.5 text-amber-600 shrink-0 select-none pb-[1px]" />
                      <span className="font-bold shrink-0">{isAr ? 'الرسائل المثبتة:' : 'Pinned:'}</span>
                      {messages.filter(m => m.isPinned).map((pMsg, pIdx) => (
                        <button
                          key={pMsg.id || pIdx}
                          onClick={() => scrollToMessage(pMsg.id)}
                          className="bg-white/90 px-2.5 py-1 rounded-lg border border-amber-200/50 hover:bg-white hover:border-amber-300 transition text-[11px] truncate max-w-[150px] font-medium shadow-xs flex items-center gap-1 cursor-pointer"
                        >
                          {pMsg.imageUrl && <ImageIcon className="w-3 h-3 text-amber-600 shrink-0" />}
                          {pMsg.voiceUrl && <Mic className="w-3 h-3 text-amber-600 shrink-0" />}
                          <span>{pMsg.content}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Messages Area */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <div className="text-center py-6">
                <div className="w-16 h-16 bg-gray-50 rounded-full mx-auto flex items-center justify-center text-3xl mb-3">
                  {activePartner.avatar}
                </div>
                <h3 className="text-sm font-black text-gray-900">{activePartner.name}</h3>
                <p className="text-[10px] text-gray-400 mt-1">{isAr ? 'أنت تتابع بعضكم البعض منذ يونيو ٢٠٢٤' : `You've been following each other since June 2024`}</p>
              </div>

              {messages.map((msg, idx) => {
                const isMine = msg.senderId === currentUser.id;
                const mId = msg.id || `dm_${idx}`;
                return (
                  <div key={mId} className={`flex ${isMine ? 'justify-end' : 'justify-start'} relative group/msg`}>
                    
                    {/* Pin and React buttons for my messages */}
                    {isMine && (
                      <div className="flex items-center gap-0.5 shrink-0 mx-1">
                        <button
                          onClick={(e) => { e.stopPropagation(); setSelectedEmojiMessageId(selectedEmojiMessageId === mId ? null : mId); }}
                          className="opacity-0 group-hover/msg:opacity-100 transition p-1.5 text-gray-400 hover:text-indigo-500 rounded-full hover:bg-gray-100 self-center cursor-pointer"
                          title={isAr ? 'تفاعل' : 'React'}
                        >
                          <Smile className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); togglePinMessage(mId, !!msg.isPinned); }}
                          className="opacity-0 group-hover/msg:opacity-100 transition p-1.5 text-gray-400 hover:text-amber-500 rounded-full hover:bg-gray-100 self-center cursor-pointer"
                          title={msg.isPinned ? (isAr ? 'إلغاء التثبيت' : 'Unpin Message') : (isAr ? 'تثبيت الرسالة' : 'Pin Message')}
                        >
                          <Pin className={`w-3.5 h-3.5 ${msg.isPinned ? 'fill-amber-500 text-amber-500' : ''}`} />
                        </button>
                      </div>
                    )}

                    {/* React button for other's messages */}
                    {!isMine && (
                      <div className="flex items-center gap-0.5 shrink-0 mx-1 order-2">
                        <button
                          onClick={(e) => { e.stopPropagation(); setSelectedEmojiMessageId(selectedEmojiMessageId === mId ? null : mId); }}
                          className="opacity-0 group-hover/msg:opacity-100 transition p-1.5 text-gray-400 hover:text-indigo-500 rounded-full hover:bg-gray-100 self-center cursor-pointer"
                          title={isAr ? 'تفاعل' : 'React'}
                        >
                          <Smile className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}

                    <div className="max-w-[75%] space-y-1 relative">
                      <div 
                        id={`msg-bubble-${mId}`}
                        onMouseDown={() => handlePressStart(mId)}
                        onMouseUp={handlePressEnd}
                        onTouchStart={() => handlePressStart(mId)}
                        onTouchEnd={handlePressEnd}
                        onDoubleClick={() => setSelectedEmojiMessageId(selectedEmojiMessageId === mId ? null : mId)}
                        onClick={() => setSelectedEmojiMessageId(selectedEmojiMessageId === mId ? null : mId)}
                        className={`p-3 rounded-2xl text-sm transition-all cursor-pointer relative ${
                          isMine 
                            ? 'bg-indigo-600 text-white rounded-te-none shadow-md hover:bg-indigo-700' 
                            : 'bg-gray-100 text-gray-800 rounded-ts-none hover:bg-gray-200'
                        }`}
                      >
                        {/* 1. Voice Player */}
                        {msg.voiceUrl ? (
                          <VoiceMessagePlayer voiceUrl={msg.voiceUrl} duration={msg.audioDuration} isMine={isMine} />
                        ) : msg.imageUrl ? (
                          /* 2. Photo Message with Lightbox handler */
                          <div 
                            className="relative rounded-xl overflow-hidden shadow-xs cursor-zoom-in group/img" 
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setLightboxImage(msg.imageUrl || null); }}
                          >
                            <img 
                              src={msg.imageUrl} 
                              alt="Attached snippet" 
                              className="w-full h-auto object-cover max-h-48 group-hover/img:scale-[1.02] transition duration-200" 
                              referrerPolicy="no-referrer"
                              onClick={(e) => { e.preventDefault(); e.stopPropagation(); setLightboxImage(msg.imageUrl || null); }}
                            />
                            {msg.content !== (isAr ? '🖼️ صورة مرفقة' : '🖼️ Sent a photo') && (
                              <div className="p-2 text-xs bg-black/60 text-white font-medium">
                                {msg.content}
                              </div>
                            )}
                          </div>
                        ) : (
                          /* 3. Normal Text Message */
                          <div className={msg.isPinned ? (isAr ? 'pl-5' : 'pr-5') : ''}>
                            {msg.content}
                          </div>
                        )}

                        {/* Pin status icon overlay inside bubble */}
                        {msg.isPinned && (
                          <div className={`absolute top-1.5 ${isAr ? 'left-1.5' : 'right-1.5'} bg-amber-500 p-0.5 rounded-full shadow-md`} title={isAr ? 'مثبتة' : 'Pinned'}>
                            <Pin className="w-2.5 h-2.5 text-white fill-white" />
                          </div>
                        )}

                        {/* Direct Message Active Reactions Display */}
                        {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                          <div className={`absolute -bottom-2.5 ${isMine ? 'right-2' : 'left-2'} bg-white border border-gray-100 rounded-full px-2 py-0.5 flex gap-0.5 shadow-md z-10 scale-90`}>
                            {Object.entries(msg.reactions).map(([uId, rEmoji]) => (
                              <span key={uId} className="text-[10px]" title={uId === currentUser.id ? 'My reaction' : 'Partner reaction'}>
                                {rEmoji as string}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Direct Message Floating Emoji Quick-Reactions Panel */}
                      <AnimatePresence>
                        {selectedEmojiMessageId === mId && (
                          <motion.div
                            initial={{ scale: 0.8, opacity: 0, y: -5 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.8, opacity: 0, y: -5 }}
                            className="absolute -top-12 left-0 right-0 mx-auto w-fit bg-slate-900 text-white p-1.5 rounded-full flex gap-1.5 shadow-xl z-50 border border-white/20"
                          >
                            {['👍', '😂', '🔥', '❤️', '😮', '🙏'].map(em => (
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

                      <div className={`flex items-center gap-1 text-[9px] text-gray-400 ${isMine ? 'justify-end' : 'justify-start'}`}>
                        <span>{new Date(msg.timestamp || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        {isMine && (
                          (msg.is_read || msg.read) ? (
                            <span title={isAr ? 'مقروءة' : 'Read'} className="flex shrink-0">
                              <CheckCheck className="w-3.5 h-3.5 text-blue-500 font-black animate-in fade-in zoom-in duration-300" />
                            </span>
                          ) : (
                            <span title={isAr ? 'تم الإرسال' : 'Sent'} className="flex shrink-0">
                              <Check className="w-3.5 h-3.5 text-white/50" />
                            </span>
                          )
                        )}
                      </div>
                    </div>

                    {!isMine && (
                      <button
                        onClick={(e) => { e.stopPropagation(); togglePinMessage(mId, !!msg.isPinned); }}
                        className="opacity-0 group-hover/msg:opacity-100 transition p-1.5 text-gray-400 hover:text-amber-500 rounded-full hover:bg-gray-100 self-center mx-1 shrink-0 cursor-pointer"
                        title={msg.isPinned ? (isAr ? 'إلغاء التثبيت' : 'Unpin Message') : (isAr ? 'تثبيت الرسالة' : 'Pin Message')}
                      >
                        <Pin className={`w-3.5 h-3.5 ${msg.isPinned ? 'fill-amber-500 text-amber-500' : ''}`} />
                      </button>
                    )}

                  </div>
                );
              })}
              
              {/* Partner typing bubble indicator */}
              {partnerTyping && (
                <div className="flex justify-start relative group/msg animate-in slide-in-from-bottom-2 fade-in">
                  <div className="bg-gray-100 text-gray-800 p-4 rounded-2xl rounded-ts-none flex gap-1 items-center h-10 w-16 space-x-1">
                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"></span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Smart Replies */}
            <AnimatePresence>
              {smartReplies.length > 0 && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="px-4 pb-2 flex gap-2 overflow-x-auto no-scrollbar"
                >
                  <Sparkles className="w-4 h-4 text-indigo-500 shrink-0 self-center" />
                  {smartReplies.map((reply, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        setNewMessage(reply);
                        setSmartReplies([]);
                      }}
                      className="whitespace-nowrap px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-full text-xs font-medium border border-indigo-100 hover:bg-indigo-100 transition shadow-xs shrink-0 cursor-pointer"
                    >
                      {reply}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Input Area */}
            <div className="p-4 border-t border-gray-100 bg-white">
              {isRecording ? (
                /* High-Fidelity Voice Clips Recorder Panel */
                <div className="flex items-center justify-between gap-3 bg-red-50 p-2.5 rounded-3xl border border-red-100 animate-pulse">
                  <div className="flex items-center gap-2 px-2 text-red-600">
                    <span className="relative flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-red-600"></span>
                    </span>
                    <span className="text-xs font-black font-mono">
                      {Math.floor(recordingDuration / 60)}:{(recordingDuration % 60).toString().padStart(2, '0')}
                    </span>
                    <span className="text-[11px] font-black">
                      {isAr ? 'جاري تسجيل الصوت...' : 'Recording Audio...'}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => stopRecording(false)}
                      className="p-2 bg-gray-200 text-gray-700 rounded-full hover:bg-gray-300 transition cursor-pointer flex items-center justify-center p-2 rounded-full"
                      title={isAr ? 'إلغاء التسجيل' : 'Cancel Recording'}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => stopRecording(true)}
                      className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full transition font-black text-xs shadow-md shadow-indigo-500/20 cursor-pointer"
                    >
                      {isAr ? 'إرسال' : 'Send'}
                    </button>
                  </div>
                </div>
              ) : (
                /* Standard Message Input Interface */
                <div className="flex items-center gap-2 bg-gray-50 p-2 rounded-3xl border border-gray-100 focus-within:border-indigo-200 transition-colors">
                  <button className="p-2 text-slate-400 hover:text-indigo-600 transition">
                    <Smile className="w-5 h-5" />
                  </button>
                  <textarea
                    value={newMessage}
                    onChange={handleTyping}
                    onInput={(e) => handleTyping(e as any)}
                    placeholder={isAr ? 'اكتب رسالة...' : 'Write a message...'}
                    rows={1}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                    className="flex-1 bg-transparent border-none focus:ring-0 text-xs py-2 resize-none placeholder-gray-400"
                  />
                  <div className="flex items-center gap-1 pr-1">
                    {/* Voice Recording Activation Button */}
                    <button 
                      onClick={startRecording}
                      className="p-2 text-slate-400 hover:text-indigo-600 transition cursor-pointer"
                      title={isAr ? 'تسجيل رسالة صوتية' : 'Record Voice Msg'}
                    >
                      <Mic className="w-5 h-5" />
                    </button>
                    {/* Hidden input for picture selector */}
                    <input
                      id="dm-image-uploader"
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleImageUpload}
                    />
                    <button 
                      onClick={() => document.getElementById('dm-image-uploader')?.click()}
                      className="p-2 text-slate-400 hover:text-indigo-600 transition cursor-pointer"
                      title={isAr ? 'إرفاق صورة' : 'Attach Photo'}
                    >
                      <ImageIcon className="w-5 h-5" />
                    </button>
                    <button className="p-2 text-slate-400 hover:text-indigo-600 transition">
                      <MapPin className="w-5 h-5" />
                    </button>
                    <button 
                      onClick={handleSendMessage}
                      disabled={!newMessage.trim()}
                      className="p-2.5 bg-indigo-600 text-white rounded-full hover:bg-indigo-700 transition disabled:opacity-50 disabled:hover:bg-indigo-600 cursor-pointer"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-4">
            <div className="w-20 h-20 bg-indigo-50 text-indigo-400 rounded-full flex items-center justify-center">
              <Send className="w-10 h-10" />
            </div>
            <div className="space-y-1">
              <h2 className="text-lg font-black text-gray-900">{isAr ? 'رسائلك الخاصة' : 'Your Messages'}</h2>
              <p className="text-xs text-slate-400 max-w-xs">{isAr ? 'أرسل رسائل وصور وفيديوهات خاصة إلى أصدقائك ورفقائك في الطلعات.' : 'Send private photos and messages to a friend or group.'}</p>
            </div>
            <button 
              onClick={() => {}} 
              className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-black shadow-lg shadow-indigo-500/20 hover:bg-indigo-700 transition"
            >
              {isAr ? 'إرسال رسالة جديدة' : 'Send Message'}
            </button>
          </div>
        )}
      </motion.div>
    ) : null}
  </AnimatePresence>

      {/* Lightbox / Immersive Full-screen Media Image Preview */}
      <AnimatePresence>
        {lightboxImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/95 flex flex-col items-center justify-center p-4 cursor-zoom-out"
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
            <div className="mt-4 flex gap-4">
              <a 
                href={lightboxImage} 
                download="mates_shared_photo.png"
                onClick={(e) => e.stopPropagation()}
                className="px-4 py-2 bg-indigo-600 text-white text-xs font-black rounded-xl hover:bg-indigo-700 transition flex items-center gap-1.5 shadow-lg shadow-indigo-600/20"
              >
                <Download className="w-4 h-4" />
                <span>{isAr ? 'تنزيل الصورة' : 'Download Photo'}</span>
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}

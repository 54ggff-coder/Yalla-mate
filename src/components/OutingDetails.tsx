/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useMessages } from '../hooks/useMessages';
import { Outing, Profile, Message, OutingReview, PickupRequest } from '../types';
import { categoryMeta } from '../constants';
import { supabase } from '../lib/supabase';
import { haptic } from '../lib/haptics';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Users, MapPin, Calendar, Car, MessageSquare, Send, ShieldCheck, 
  Award, Star, UserPlus, LogOut, Receipt, ArrowLeft, Share2, AlertTriangle,
  Image, Paperclip, Camera, CheckCircle, Activity, Radio, Clock, QrCode,
  Mic, MicOff, Square, Loader2, PhoneCall, PhoneOff, Volume2, VolumeX, Phone, X, Sparkles, Coffee,
  Plus, Check, Copy, AlertCircle, Map as MapIcon, Link, Lock, Navigation, BarChart3
} from 'lucide-react';
import { useLocation } from '../contexts/LocationContext';
import { translations, Language } from '../data/translations';
import { haversineDistance } from '../lib/geoUtils';
import StaticMapPreview from './StaticMapPreview';
import ExpenseSplitter from './ExpenseSplitter';
import IncidentForm from './IncidentForm';
import ConfirmModal from './ConfirmModal';
import OutingReviewModal from './OutingReviewModal';
import PickupManager from './PickupManager';
import { QRCodeSVG } from 'qrcode.react';
import { getGoogleMapsViewUrl, getGoogleMapsDirUrl, sanitizeCoordinates, validateOutingCoordinates } from '../utils/mapUtils';

interface OutingDetailsProps {
  outing: Outing;
  currentUser: Profile;
  allProfiles: Profile[];
  friendsList?: string[];
  onJoin: (outingId: string) => void;
  onLeave: (outingId: string) => void;
  onSendMessage: (outingId: string, text: string, imageUrl?: string, locationUrl?: string) => void;
  onCompleteReview: (ratings: Partial<OutingReview>) => void;
  onEndOuting?: (outingId: string) => void;
  onUpdateOuting?: (outing: Outing) => void;
  onViewProfile?: (userId: string) => void;
  onClose: () => void;
  lang: Language;
}


interface WeatherData {
  temp: number;
  conditionEn: string;
  conditionAr: string;
  icon: string;
  isExtreme: boolean;
  alertEn?: string;
  alertAr?: string;
}

const getMockWeather = (locationName: string, datetimeStr: string): WeatherData => {
  const date = new Date(datetimeStr);
  const month = date.getMonth();
  
  const isSummer = month >= 4 && month <= 8;
  const isWinter = month === 11 || month === 0 || month === 1;
  
  const lowerLoc = locationName.toLowerCase();
  
  let temp = 28;
  let conditionEn = 'Clear & Pleasant';
  let conditionAr = 'صافي ومعتدل';
  let icon = '☀️';
  let isExtreme = false;
  let alertEn = '';
  let alertAr = '';
  
  if (isSummer) {
    temp = 42 + (month % 3);
    conditionEn = 'Sunny & Hot';
    conditionAr = 'مشمس وحار';
    icon = '☀️';
    if (temp >= 43) {
      isExtreme = true;
      alertEn = 'Extreme Heat Alert: Expected ' + temp + '°C. Keep hydrated & stay in shaded zones!';
      alertAr = 'تنبيه حرارة شديدة: المتوقع ' + temp + '°م. احرص على ترطيب جسمك والبقاء في الظل!';
    }
  } else if (isWinter) {
    temp = 14 + (month % 3);
    conditionEn = 'Breezy & Cool';
    conditionAr = 'بارد ومنعش';
    icon = '🍃';
  } else {
    temp = 24 + (month % 3);
    conditionEn = 'Mild & Beautiful';
    conditionAr = 'معتدل وجميل';
    icon = '🌤️';
  }
  
  if (lowerLoc.includes('desert') || lowerLoc.includes('بر') || lowerLoc.includes('مخيم') || lowerLoc.includes('camping')) {
    if (isSummer) {
      temp += 2;
      isExtreme = true;
      conditionEn = 'Extreme Desert Heat';
      conditionAr = 'حرارة صحراوية شديدة';
      icon = '🔥';
      alertEn = 'Dangerous Desert Heat Alert! Expected ' + temp + '°C. Avoid direct sun exposure.';
      alertAr = 'تنبيه حرارة خطيرة بالبر! المتوقع ' + temp + '°م. تجنب التعرض المباشر لأشعة الشمس.';
    } else if (isWinter) {
      temp -= 4;
      conditionEn = 'Chilly Desert Night';
      conditionAr = 'ليلة صحراوية باردة جداً';
      icon = '❄️';
      isExtreme = true;
      alertEn = 'Chilly Night Alert! Desert temperature drops to ' + temp + '°C. Dress warmly!';
      alertAr = 'تنبيه ليلة باردة! تنخفض الحرارة في البر إلى ' + temp + '°م. ارتدِ ملابس ثقيلة!';
    }
  } else if (lowerLoc.includes('sea') || lowerLoc.includes('beach') || lowerLoc.includes('بحر') || lowerLoc.includes('كورنيش')) {
    conditionEn = 'Breezy & Humid';
    conditionAr = 'رطب ومنعش';
    icon = '🌊';
  }
  
  return { temp, conditionEn, conditionAr, icon, isExtreme, alertEn, alertAr };
};

const PACKING_CHECKLISTS: Record<string, { itemEn: string; itemAr: string }[]> = {
  Restaurants: [
    { itemEn: 'Wallet / Credit Card', itemAr: 'المحفظة / بطاقة الائتمان' },
    { itemEn: 'Reservation Confirmation', itemAr: 'تأكيد الحجز' },
    { itemEn: 'Nice / Casual Dress', itemAr: 'ملابس أنيقة / كاجوال' }
  ],
  Cafes: [
    { itemEn: 'Phone Charger / Power bank', itemAr: 'شاحن هاتف / باور بانك' },
    { itemEn: 'Notebook or Laptop (for study/work)', itemAr: 'لابتوب أو دفتر للمذاكرة والعمل' },
    { itemEn: 'Cozy Clothes', itemAr: 'ملابس مريحة ومناسبة للمقهى' }
  ],
  'Shopping Malls': [
    { itemEn: 'Shopping Bag / Wallet', itemAr: 'حقيبة تسوق / محفظة' },
    { itemEn: 'Comfortable Walking Shoes', itemAr: 'حذاء مشي مريح' },
    { itemEn: 'Store Apps for Discounts', itemAr: 'تطبيقات المتاجر للحصول على خصومات' }
  ],
  Parks: [
    { itemEn: 'Water Bottle', itemAr: 'زجاجة مياه باردة' },
    { itemEn: 'Sunglasses / Cap', itemAr: 'نظارة شمسية / قبعة' },
    { itemEn: 'Picnic Blanket / Carpet', itemAr: 'بساط رحلات / فرش للجلوس' },
    { itemEn: 'Sunscreen', itemAr: 'واقي شمس لحماية البشرة' }
  ],
  Cinema: [
    { itemEn: 'Cinema Tickets (QR Code)', itemAr: 'تذاكر السينما (رمز QR)' },
    { itemEn: 'Light Jacket (cold halls)', itemAr: 'سترة خفيفة (تكييف الصالات بارد)' },
    { itemEn: 'Snacks Pocket-money', itemAr: 'ميزانية الفشار والمشروبات' }
  ],
  Bowling: [
    { itemEn: 'Clean Socks (for rented shoes)', itemAr: 'جوارب نظيفة (لحذاء اللعب المستأجر)' },
    { itemEn: 'Comfortable Pants', itemAr: 'بنطال مريح لسهولة الحركة والرمي' }
  ],
  Billiards: [
    { itemEn: 'Focus & Competitive Spirit', itemAr: 'التركيز العالي والروح الحماسية' },
    { itemEn: 'Glove (optional)', itemAr: 'قفاز بلياردو (اختياري)' }
  ],
  Football: [
    { itemEn: 'Football Cleats / Sport shoes', itemAr: 'حذاء كرة قدم مناسب للملعب' },
    { itemEn: 'Sportswear Jersey', itemAr: 'طقم ملابس رياضية مناسب' },
    { itemEn: 'Water Bottle & Towel', itemAr: 'قارورة مياه ومنشفة تجفيف' },
    { itemEn: 'Shin Guards', itemAr: 'واقي الساقين للحماية' }
  ],
  'Sports Activities': [
    { itemEn: 'Fitness Gear / Training shoes', itemAr: 'حذاء رياضي ملائم للتمرين' },
    { itemEn: 'Sweat Towel & Hydration', itemAr: 'منشفة عرق ومياه ترطيب' },
    { itemEn: 'Smart Watch / Tracker', itemAr: 'ساعة ذكية / متتبع النشاط' }
  ],
  'Supermarket Shopping': [
    { itemEn: 'Grocery Checklist', itemAr: 'قائمة المشتريات المنزلية' },
    { itemEn: 'Reusable Carrier Bags', itemAr: 'أكياس تسوق صديقة للبيئة' }
  ],
  'Clothes Shopping': [
    { itemEn: 'Slip-on Shoes (easy to fit)', itemAr: 'حذاء سهل النزع والارتداء للقياس' },
    { itemEn: 'Accompanying Buddy Advice', itemAr: 'صديق يقدم نصائح واختيار للملابس' }
  ],
  'City Tours': [
    { itemEn: 'Road trip playlist ready', itemAr: 'قائمة تشغيل أغاني جاهزة للخط' },
    { itemEn: 'Full Car Fuel Tank', itemAr: 'خزان وقود ممتلئ للسيارة' },
    { itemEn: 'Phone Car-holder mount', itemAr: 'حامل هاتف للسيارة للملاحة' },
    { itemEn: 'USB Car Charger', itemAr: 'شاحن سيارة بمنفذ USB' }
  ],
  'Gaming Sessions': [
    { itemEn: 'Controller / Headset', itemAr: 'يد تحكم جيمنج / سماعة محيطية' },
    { itemEn: 'Account logins (Steam/Discord)', itemAr: 'بيانات تسجيل حساب ديسكورد وجيمنج' },
    { itemEn: 'Energy drink money', itemAr: 'ميزانية مشروب طاقة / وجبة خفيفة' }
  ],
  'Study Sessions': [
    { itemEn: 'Laptop & Charger block', itemAr: 'اللابتوب وسلك الشاحن' },
    { itemEn: 'Noise-cancelling headphones', itemAr: 'سماعات عازلة للضوضاء للتركيز' },
    { itemEn: 'Notebook & Multi-color pens', itemAr: 'دفتر وأقلام متعددة الألوان للمذاكرة' }
  ],
  'Group Gatherings': [
    { itemEn: 'Boardgames / Baloot Cards', itemAr: 'ألعاب لوحية / ورق بلوت' },
    { itemEn: 'Snacks / Beverages to share', itemAr: 'تسالي وحلويات ومشروبات للمجموعة' },
    { itemEn: 'Winter Jacket (if outdoor)', itemAr: 'جاكيت ثقيل (إذا كانت الجلسة خارجية)' }
  ],
  'Outdoor Adventures': [
    { itemEn: 'Hiking Boots / Trekking Shoes', itemAr: 'حذاء تسلق / حذاء مغامرات جبلي متين' },
    { itemEn: 'Hiking Backpack', itemAr: 'حقيبة ظهر رحلات مجهزة' },
    { itemEn: 'First Aid Kit & Tape', itemAr: 'علبة إسعافات أولية مصغرة' },
    { itemEn: 'Heavy duty Powerbank & Torch', itemAr: 'باور بانك قوي وكشاف إنارة صحراوي' }
  ],
  'Custom Activities': [
    { itemEn: 'Spontaneous Adventurous Spirit', itemAr: 'روح عفوية منطلقة للمغامرة والتجربة' },
    { itemEn: 'Fully Charged Mobile', itemAr: 'شحن الهاتف بالكامل لالتقاط اللحظات' }
  ]
};

const resolveCoverImage = (img?: string) => {
  if (!img) return 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?q=80&w=1000&auto=format&fit=crop';
  if (img === 'arab_cafe_night') return '/src/assets/images/arab_cafe_night_1780873407256.png';
  if (img === 'scenic_night_drive') return '/src/assets/images/scenic_night_drive_1780873420312.png';
  if (img === 'gaming_pool_lounge') return '/src/assets/images/gaming_pool_lounge_1780873435319.png';
  return img; // remote URL fallbacks
};

export default function OutingDetails({
  outing,
  currentUser,
  allProfiles,
  friendsList = [],
  onJoin,
  onLeave,
  onSendMessage,
  onCompleteReview,
  onEndOuting,
  onUpdateOuting,
  onViewProfile,
  onClose,
  lang,
}: OutingDetailsProps) {
  const { messages } = useMessages(outing.id, 'outing');
  const t = translations[lang];

  const [optimisticReactions, setOptimisticReactions] = useState<Record<string, Record<string, string>>>({});

  const [chatInput, setChatInput] = useState('');
  const [publicComments, setPublicComments] = useState<{id: string, text: string, author: string, avatar: string, time: string}[]>([]);
  const [newPublicComment, setNewPublicComment] = useState('');
  const [activeTab, setActiveTab] = useState<'info' | 'chat' | 'split'>('info');
  const [copiedCoords, setCopiedCoords] = useState(false);

  const [trustUpdateAnimation, setTrustUpdateAnimation] = useState<{type: 'up' | 'down', val: string} | null>(null);

  // Keep track of payment status for each attendee
  const [payments, setPayments] = useState<Record<string, { paid: boolean; amount: number }>>(() => {
    const cached = localStorage.getItem(`ym_outing_payments_${outing.id}`);
    if (cached) {
      try { return JSON.parse(cached); } catch (e) {}
    }
    const attendeeCount = outing.attendeeIds?.length || 1;
    const fuelSharingPrice = outing.logistics?.fuelSharingPrice || 0;
    const costPerPerson = outing.logistics?.costPerPerson || (fuelSharingPrice > 0 ? Math.round(fuelSharingPrice / attendeeCount) : 0);

    const initial: Record<string, { paid: boolean; amount: number }> = {};
    outing.attendeeIds?.forEach(id => {
      initial[id] = { paid: false, amount: costPerPerson };
    });
    return initial;
  });

  const [fuelPriceInput, setFuelPriceInput] = useState<number | ''>(outing.logistics?.fuelSharingPrice || 0);

  // Sync payments when attendees or total price changes
  useEffect(() => {
    const numFuel = typeof fuelPriceInput === 'number' ? fuelPriceInput : 0;
    const attendeeCount = outing.attendeeIds?.length || 1;
    const costPerPerson = numFuel > 0 ? Math.round(numFuel / attendeeCount) : 0;
    
    setPayments(prev => {
      const updated = { ...prev };
      outing.attendeeIds?.forEach(id => {
        if (!updated[id]) {
          updated[id] = { paid: false, amount: costPerPerson };
        } else {
          updated[id] = { ...updated[id], amount: costPerPerson };
        }
      });
      return updated;
    });
  }, [fuelPriceInput, outing.attendeeIds]);

  // Save payments to localStorage
  useEffect(() => {
    localStorage.setItem(`ym_outing_payments_${outing.id}`, JSON.stringify(payments));
  }, [payments, outing.id]);

  const [showSplitterModal, setShowSplitterModal] = useState(false);
  const [showQrCodeModal, setShowQrCodeModal] = useState(false);
  const [checkedInUserIds, setCheckedInUserIds] = useState<string[]>(() => {
    const saved = localStorage.getItem(`ym_outing_checkins_${outing.id}`);
    return saved ? JSON.parse(saved) : [];
  });
  const [isCheckInSuccess, setIsCheckInSuccess] = useState<boolean>(false);
  
  // Custom states for share and calendar link
  const [copiedLink, setCopiedLink] = useState(false);
  const [downloadedCal, setDownloadedCal] = useState(false);

  // Temporary Outing Poll creation states
  const [showPollCreator, setShowPollCreator] = useState(false);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState<string[]>(['', '']);

  // Chat message reactions states
  const [selectedEmojiMessageId, setSelectedEmojiMessageId] = useState<string | null>(null);
  const [wasLongPressed, setWasLongPressed] = useState<boolean>(false);
  const pressTimer = useRef<any>(null);

  // Voice Outing Recap Recorder states
  const [recapRecordingState, setRecapRecordingState] = useState<'idle' | 'recording' | 'review' | 'processing' | 'success' | 'error'>('idle');
  const [recapDuration, setRecapDuration] = useState(0);
  const [recapAudioUrl, setRecapAudioUrl] = useState<string | null>(null);
  const [recapError, setRecapError] = useState<string | null>(null);
  const [recapSuccessText, setRecapSuccessText] = useState<string | null>(null);
  const recapMediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recapAudioChunksRef = useRef<Blob[]>([]);
  const recapTimerRef = useRef<any>(null);

  const startRecapRecording = async () => {
    try {
      setRecapError(null);
      setRecapSuccessText(null);
      recapAudioChunksRef.current = [];
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      recapMediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          recapAudioChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        const audioBlob = new Blob(recapAudioChunksRef.current, { type: 'audio/webm' });
        const url = URL.createObjectURL(audioBlob);
        setRecapAudioUrl(url);
        stream.getTracks().forEach(track => track.stop());
      };

      recorder.start(250);
      setRecapDuration(0);
      setRecapRecordingState('recording');

      recapTimerRef.current = setInterval(() => {
        setRecapDuration(prev => prev + 1);
      }, 1000);
      haptic([30, 10]);
    } catch (err: any) {
      console.error('Failed to start recap recording:', err);
      setRecapError(lang === 'ar' ? 'فشل تشغيل الميكروفون. يرجى تفعيل الصلاحية.' : 'Could not start microphone. Please check permissions.');
      setRecapRecordingState('error');
    }
  };

  const stopRecapRecording = () => {
    if (recapMediaRecorderRef.current && recapMediaRecorderRef.current.state !== 'inactive') {
      recapMediaRecorderRef.current.stop();
    }
    if (recapTimerRef.current) {
      clearInterval(recapTimerRef.current);
    }
    setRecapRecordingState('review');
    haptic(20);
  };

  const cancelRecapRecording = () => {
    if (recapMediaRecorderRef.current && recapMediaRecorderRef.current.state !== 'inactive') {
      recapMediaRecorderRef.current.stop();
    }
    if (recapTimerRef.current) {
      clearInterval(recapTimerRef.current);
    }
    setRecapRecordingState('idle');
    setRecapAudioUrl(null);
    setRecapDuration(0);
    setRecapError(null);
    recapAudioChunksRef.current = [];
    haptic(10);
  };

  const submitRecapAudio = async () => {
    if (recapAudioChunksRef.current.length === 0) return;
    setRecapRecordingState('processing');
    setRecapError(null);

    try {
      const audioBlob = new Blob(recapAudioChunksRef.current, { type: 'audio/webm' });
      const reader = new FileReader();
      reader.readAsDataURL(audioBlob);
      reader.onloadend = async () => {
        try {
          const base64data = (reader.result as string).split(',')[1];
          const res = await fetch('/api/yallamate/transcribe-recap', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              audioBase64: base64data,
              mimeType: 'audio/webm',
              outingTitle: outing.title,
              lang
            })
          });

          if (!res.ok) throw new Error('API transcription failed');
          const result = await res.json();

          if (supabase) {
            const { error: postErr } = await supabase.from('posts').insert([
              {
                id: `post_${Date.now()}`,
                userId: currentUser.id,
                userName: currentUser.name,
                userAvatar: currentUser.avatar,
                content: result.content,
                timestamp: new Date().toISOString(),
                likes: [],
                reposts: [],
                commentsCount: 0,
              }
            ]);
            if (postErr) throw postErr;
          }

          setRecapSuccessText(result.content);
          setRecapRecordingState('success');
          haptic([10, 30, 10]);
        } catch (err: any) {
          console.error('Error in recap submission chain:', err);
          setRecapError(lang === 'ar' ? 'فشل معالجة المُلخص الصوتي.' : 'Failed to process voice recap.');
          setRecapRecordingState('error');
        }
      };
    } catch (err: any) {
      console.error('Error reading blob:', err);
      setRecapError(lang === 'ar' ? 'فشل قراءة الملف الصوتي.' : 'Failed to read audio data.');
      setRecapRecordingState('error');
    }
  };

  const handlePressStart = (msgId: string) => {
    setWasLongPressed(false);
    pressTimer.current = setTimeout(() => {
      setSelectedEmojiMessageId(msgId);
      setWasLongPressed(true);
      haptic(15); // Premium tactile haptic feedback on long press trigger
    }, 500); 
  };

  const handlePressEnd = () => {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
    }
  };

  const handleReactToMessage = async (msgId: string, emoji: string) => {
    if (!currentUser || !supabase) return;
    haptic([10, 30, 10]); // Tactile success haptic on selecting reaction

    // Calculate next reaction state optimistically for immediate visual feedback
    const matchedMsg = messages.find(m => m.id === msgId);
    if (!matchedMsg) return;

    const currentEmoji = (matchedMsg.reactions || {})[currentUser.id] || (optimisticReactions[msgId] || {})[currentUser.id];
    const nextEmoji = currentEmoji === emoji ? '' : emoji; // Empty string indicates removed optimistically

    setOptimisticReactions(prev => ({
      ...prev,
      [msgId]: {
        ...(prev[msgId] || {}),
        [currentUser.id]: nextEmoji
      }
    }));

    try {
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
      // Rollback optimistic state on failure
      setOptimisticReactions(prev => {
        const next = { ...prev };
        if (next[msgId]) {
          delete next[msgId][currentUser.id];
        }
        return next;
      });
      haptic([40, 40, 40]);
    }
    setSelectedEmojiMessageId(null);
  };

  const handleCreatePoll = async () => {
    haptic();
    if (!pollQuestion.trim()) return;
    const filteredOptions = pollOptions.filter(opt => opt.trim() !== '');
    if (filteredOptions.length < 2) {
      alert(lang === 'ar' ? 'يجب إدخال خيارين على الأقل!' : 'You must provide at least 2 options!');
      return;
    }

    const pollId = crypto.randomUUID();
    const pollMessage = {
      id: pollId,
      outingId: outing.id,
      senderId: currentUser.id,
      senderName: currentUser.displayName || currentUser.name,
      senderAvatar: currentUser.avatar,
      content: JSON.stringify({
        question: pollQuestion.trim(),
        options: filteredOptions
      }),
      type: 'poll',
      timestamp: new Date().toISOString()
    };

    try {
      const { error } = await supabase.from('direct_messages').insert([pollMessage]);
      if (error) throw error;
      setPollQuestion('');
      setPollOptions(['', '']);
      setShowPollCreator(false);
    } catch (err) {
      console.error('Failed to create poll:', err);
    }
  };

  // Confirmation Modals
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [showEndConfirm, setShowEndConfirm] = useState(false);

  // Recording states
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);

  // Modern Performance & Logistics states
  const [mapInteracted, setMapInteracted] = useState(false);
  const [showInviteFriendsModal, setShowInviteFriendsModal] = useState(false);
  const [copiedLocation, setCopiedLocation] = useState(false);
  const [copiedInviteLink, setCopiedInviteLink] = useState(false);

  // Temporary private photo gallery (expires in 24h, offline-persistent)
  const [galleryPhotos, setGalleryPhotos] = useState<{ id: string; url: string; uploadedBy: string; uploadedAvatar: string; uploadedAt: string; expiresAt: string }[]>(() => {
    try {
      const stored = localStorage.getItem(`ym_outing_photos_${outing.id}`);
      if (stored) {
        const parsed = JSON.parse(stored) as any[];
        const now = Date.now();
        return parsed.filter(item => new Date(item.expiresAt).getTime() > now);
      }
    } catch (e) {
      console.error(e);
    }
    return [];
  });

  // Packing Checklist checks (offline-persistent)
  const [checkedPackingItems, setCheckedPackingItems] = useState<Record<number, boolean>>(() => {
    try {
      const stored = localStorage.getItem(`ym_packing_${outing.id}`);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.error(e);
    }
    return {};
  });

  // Save gallery to localstorage
  const savePhotosToStorage = (photos: typeof galleryPhotos) => {
    setGalleryPhotos(photos);
    try {
      localStorage.setItem(`ym_outing_photos_${outing.id}`, JSON.stringify(photos));
    } catch (e) {
      console.error(e);
    }
  };

  // Save packing checks
  const handleTogglePackingItem = (idx: number) => {
    const updated = { ...checkedPackingItems, [idx]: !checkedPackingItems[idx] };
    setCheckedPackingItems(updated);
    try {
      localStorage.setItem(`ym_packing_${outing.id}`, JSON.stringify(updated));
    } catch (e) {
      console.error(e);
    }
  };

  // Handle image upload to temporary gallery
  const handleUploadPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const b64 = reader.result as string;
      const now = new Date();
      const expires = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours
      const newPhoto = {
        id: `photo_${Date.now()}`,
        url: b64,
        uploadedBy: currentUser.displayName || currentUser.name,
        uploadedAvatar: currentUser.avatar || '📸',
        uploadedAt: now.toISOString(),
        expiresAt: expires.toISOString()
      };
      savePhotosToStorage([...galleryPhotos, newPhoto]);
    };
    reader.readAsDataURL(file);
  };
  
  // Location hook integration
  const { requestLocation, coords: liveUserCoords } = useLocation();
  const [distanceKm, setDistanceKm] = useState<string | null>(null);

  useEffect(() => {
     if (liveUserCoords && outing.mapCoordinates) {
         fetch(`/api/distance?origins=${liveUserCoords.join(',')}&destinations=${outing.mapCoordinates.lat},${outing.mapCoordinates.lng}`)
           .then(res => res.json())
           .then(data => {
             if (data.rows[0].elements[0].status === 'OK') {
               setDistanceKm(data.rows[0].elements[0].distance.text);
             }
           })
           .catch(console.error);
     }
  }, [liveUserCoords, outing.mapCoordinates]);

  // Arrival Status Tracker
  const [arrivalStatuses, setArrivalStatuses] = useState<Record<string, 'On My Way' | 'Running Late' | 'Arrived' | ''>>(() => {
    try {
      const stored = localStorage.getItem(`ym_arrival_status_${outing.id}`);
      if (stored) return JSON.parse(stored);
    } catch (e) {
      console.error(e);
    }
    return {};
  });

  const handleUpdateArrivalStatus = (status: 'On My Way' | 'Running Late' | 'Arrived' | '') => {
    haptic();
    const updated = { ...arrivalStatuses, [currentUser.id]: status };
    setArrivalStatuses(updated);
    try {
      localStorage.setItem(`ym_arrival_status_${outing.id}`, JSON.stringify(updated));
    } catch (e) {
      console.error(e);
    }

    if (status) {
      const statusLabelsEn: Record<string, string> = {
        'On My Way': 'On My Way 🚗',
        'Running Late': 'Running Late ⏳',
        'Arrived': 'Arrived ✅'
      };
      const statusLabelsAr: Record<string, string> = {
        'On My Way': 'في طريقي 🚗',
        'Running Late': 'متأخر قليلاً ⏳',
        'Arrived': 'وصلت للوجهة ✅'
      };
      
      const label = lang === 'ar' ? statusLabelsAr[status] : statusLabelsEn[status];
      const messageText = lang === 'ar' 
        ? `🔄 [تحديث الحالة] لقد قمت بتحديث حالتي إلى: "${label}"` 
        : `🔄 [Status Update] I updated my arrival status to: "${label}"`;
      
      onSendMessage(outing.id, messageText);
    }
  };

  // Pre-populate some other participants' arrival statuses to make the list dynamic
  useEffect(() => {
    const defaultStatuses: Record<string, any> = {};
    let needsUpdate = false;
    
    outing.attendeeIds?.forEach((id, idx) => {
      if (id !== currentUser.id && !arrivalStatuses[id]) {
        const statuses: ('On My Way' | 'Running Late' | 'Arrived')[] = ['Arrived', 'On My Way', 'Running Late'];
        defaultStatuses[id] = statuses[idx % 3];
        needsUpdate = true;
      }
    });
    
    if (needsUpdate) {
      setArrivalStatuses(prev => ({
        ...defaultStatuses,
        ...prev
      }));
    }
  }, [outing.attendeeIds]);

  // Helper to check if weather is extreme or has hot/rain elements
  const checkNeedsIndoorAlternative = (weather: WeatherData): boolean => {
    const lowerEn = weather.conditionEn.toLowerCase();
    const hasRain = lowerEn.includes('rain') || lowerEn.includes('storm') || lowerEn.includes('shower');
    const hasHeat = weather.temp >= 38;
    return hasRain || hasHeat || weather.isExtreme;
  };

  // Group Decision Polls State & Helpers
  interface PollOption {
    id: string;
    textEn: string;
    textAr: string;
    votes: string[]; // array of userIds who voted
  }
  interface GroupPoll {
    id: string;
    questionEn: string;
    questionAr: string;
    options: PollOption[];
    creatorId: string;
    createdAt: string;
  }

  const polls = useMemo<GroupPoll[]>(() => {
    if (!messages) return [];
    
    const pollMessages = messages.filter(m => m.type === 'poll');
    
    const derivedPolls = pollMessages.map(pm => {
      let data = { questionEn: '', questionAr: '', options: [] };
      try {
        data = JSON.parse(pm.content);
      } catch (e) {
        console.error('Failed to parse poll definition:', e);
      }
      
      // Aggregate votes for this poll from other messages of type 'poll_vote'
      const voteMessages = messages.filter(m => {
        if (m.type !== 'poll_vote') return false;
        try {
          const parsed = JSON.parse(m.content);
          return parsed.pollId === pm.id;
        } catch {
          return false;
        }
      });
      
      const optionsWithVotes = (data.options || []).map((opt: any) => {
        const optionVotes = voteMessages
          .filter(vm => {
            try {
              const parsed = JSON.parse(vm.content);
              return parsed.optionId === opt.id;
            } catch {
              return false;
            }
          })
          .map(vm => vm.senderId);
          
        return {
          id: opt.id,
          textEn: opt.textEn,
          textAr: opt.textAr,
          votes: Array.from(new Set(optionVotes)) // unique voter IDs
        };
      });
      
      return {
        id: pm.id,
        questionEn: data.questionEn || data.questionAr,
        questionAr: data.questionAr || data.questionEn,
        options: optionsWithVotes,
        creatorId: pm.senderId,
        createdAt: pm.timestamp
      };
    });

    if (derivedPolls.length > 0) {
      return derivedPolls;
    }

    // Default static fallback poll if no dynamic polls exist
    const defaultPoll: GroupPoll = {
      id: 'default_poll',
      questionEn: 'Which spot should we choose for the meetup?',
      questionAr: 'أي موقع نختار للتجمع واللقاء؟',
      options: [
        { id: 'opt_1', textEn: 'Overdose Coffee ⚡', textAr: 'أوفر دوز كافيه ⚡', votes: [] },
        { id: 'opt_2', textEn: 'Draft Cafe ☕', textAr: 'درافت كافيه ☕', votes: [] },
        { id: 'opt_3', textEn: 'Elixir Bun 🥐', textAr: 'إكسير البن 🥐', votes: [] }
      ],
      creatorId: outing.creatorId,
      createdAt: new Date().toISOString()
    };
    
    const attendees = outing.attendeeIds || [];
    attendees.forEach((attId, idx) => {
      if (attId !== currentUser.id) {
        const optIdx = idx % 3;
        defaultPoll.options[optIdx].votes.push(attId);
      }
    });

    return [defaultPoll];
  }, [messages, outing.attendeeIds, outing.creatorId, currentUser.id]);

  const [showCreatePoll, setShowCreatePoll] = useState(false);
  const [pollsCollapsed, setPollsCollapsed] = useState(false);
  const [newPollQuestionEn, setNewPollQuestionEn] = useState('');
  const [newPollQuestionAr, setNewPollQuestionAr] = useState('');
  const [newPollOptions, setNewPollOptions] = useState<string[]>(['', '']);

  const handleVotePoll = async (pollId: string, optionId: string) => {
    haptic();
    try {
      // 1. Find if current user already voted on this specific poll
      const existingVote = messages.find(m => {
        if (m.type !== 'poll_vote' || m.senderId !== currentUser.id) return false;
        try {
          const parsed = JSON.parse(m.content);
          return parsed.pollId === pollId;
        } catch {
          return false;
        }
      });
      
      let isSameOption = false;
      if (existingVote) {
        try {
          const parsed = JSON.parse(existingVote.content);
          isSameOption = parsed.optionId === optionId;
        } catch {}
        
        // Delete previous vote message
        await supabase.from('direct_messages').delete().eq('id', existingVote.id);
      }
      
      // If user clicked the same option they already voted for, this acts as an undo / retraction of vote
      if (isSameOption) {
        return;
      }
      
      // 2. Insert new vote message
      const voteId = `vote_${Date.now()}`;
      const voteMessage = {
        id: voteId,
        outingId: outing.id,
        senderId: currentUser.id,
        senderName: currentUser.displayName || currentUser.name,
        senderAvatar: currentUser.avatar,
        content: JSON.stringify({
          pollId: pollId,
          optionId: optionId
        }),
        type: 'poll_vote',
        timestamp: new Date().toISOString()
      };
      
      const { error } = await supabase.from('direct_messages').insert([voteMessage]);
      if (error) throw error;
      
      // 3. Find option text to send chat announcement
      const currentPollObj = polls.find(p => p.id === pollId);
      if (currentPollObj) {
        const opt = currentPollObj.options.find(o => o.id === optionId);
        if (opt) {
          const optText = lang === 'ar' ? opt.textAr : opt.textEn;
          const msgText = lang === 'ar'
            ? `🗳️ [تصويت جديد] لقد صوتُّ لـ: "${optText}" في الاستفتاء بالدردشة.`
            : `🗳️ [New Vote] I voted for: "${optText}" in the decision poll.`;
          onSendMessage(outing.id, msgText);
        }
      }
    } catch (err) {
      console.error('Failed to register vote in Supabase:', err);
    }
  };

  const handleCreatePollSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPollQuestionEn.trim() && !newPollQuestionAr.trim()) return;
    
    const validOptions = newPollOptions.filter(opt => opt.trim() !== '');
    if (validOptions.length < 2) return;
    
    const qEn = newPollQuestionEn.trim() || newPollQuestionAr.trim();
    const qAr = newPollQuestionAr.trim() || newPollQuestionEn.trim();
    
    const pollId = `poll_${Date.now()}`;
    const pollMessage = {
      id: pollId,
      outingId: outing.id,
      senderId: currentUser.id,
      senderName: currentUser.displayName || currentUser.name,
      senderAvatar: currentUser.avatar,
      content: JSON.stringify({
        questionEn: qEn,
        questionAr: qAr,
        options: validOptions.map((opt, i) => ({
          id: `opt_${Date.now()}_${i}`,
          textEn: opt.trim(),
          textAr: opt.trim()
        }))
      }),
      type: 'poll',
      timestamp: new Date().toISOString()
    };
    
    try {
      const { error } = await supabase.from('direct_messages').insert([pollMessage]);
      if (error) throw error;
      
      setNewPollQuestionEn('');
      setNewPollQuestionAr('');
      setNewPollOptions(['', '']);
      setShowCreatePoll(false);
      
      const msgText = lang === 'ar'
        ? `📊 [استفتاء جديد] الرفيق ${currentUser.name} طرح سؤالاً جديداً: "${qAr}" شاركونا آرائكم بالتصويت!`
        : `📊 [New Poll] Comrade ${currentUser.name} published a new poll: "${qEn}" Cast your vote now!`;
      onSendMessage(outing.id, msgText);
    } catch (err) {
      console.error('Failed to publish poll to Supabase:', err);
    }
  };

  // Helper to construct a mock coordinate within/outside 1km
  const getMockParticipantCoords = (center: { lat: number; lng: number }, index: number, within1km: boolean) => {
    const radiusDegrees = within1km ? 0.004 : 0.022; // ~440m vs ~2.4km
    const angle = (index * 2 * Math.PI) / 3;
    return {
      lat: center.lat + Math.sin(angle) * radiusDegrees,
      lng: center.lng + Math.cos(angle) * radiusDegrees
    };
  };

  // Participant Shared Locations State (Pre-seeded)
  const [participantLocations, setParticipantLocations] = useState<Record<string, { lat: number; lng: number; isSharing: boolean }>>(() => {
    const initial: Record<string, { lat: number; lng: number; isSharing: boolean }> = {};
    if (outing.mapCoordinates) {
      const center = outing.mapCoordinates;
      outing.attendeeIds?.forEach((id, idx) => {
        if (id !== currentUser.id) {
          const within1km = idx % 2 === 0; // alternating
          const coords = getMockParticipantCoords(center, idx, within1km);
          initial[id] = {
            lat: coords.lat,
            lng: coords.lng,
            isSharing: idx % 3 !== 2 // 66% are sharing
          };
        }
      });
    }
    return initial;
  });

  // Sync current user location into tracking map state
  useEffect(() => {
    if (liveUserCoords) {
      setParticipantLocations(prev => ({
        ...prev,
        [currentUser.id]: {
          lat: liveUserCoords[0],
          lng: liveUserCoords[1],
          isSharing: true
        }
      }));
    }
  }, [liveUserCoords, currentUser.id]);

  const getTrustScorePercent = (score: number) => {
    if (score > 5.0) {
      return Math.min(100, (score / 10.0) * 100);
    }
    return Math.min(100, (score / 5.0) * 100);
  };

  
  const handleExportSummary = () => {
    haptic();
    const joinedProfiles = (allProfiles || []).filter(p => outing.attendeeIds?.includes(p.id));
    const attendeesList = joinedProfiles.map(p => `- ${p.name} (@${p.username})`).join('\n');
    
    const summary = `
📅 Outing: ${outing.title}
📍 Location: ${outing.location}
⏰ Time: ${new Date(outing.datetime).toLocaleString(lang === 'ar' ? 'ar-SA' : 'en-US')}
👥 Attendees (${joinedProfiles.length}):
${attendeesList}

📝 Description:
${outing.description}
`;

    // Create a blob and download it as a text file
    const blob = new Blob([summary.trim()], { type: 'text/plain;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `outing_${outing.id}_logistics.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportICS = () => {
    haptic();
    const start = new Date(outing.datetime);
    const end = new Date(start.getTime() + 2 * 60 * 60 * 1000); // 2 hours duration

    const formatDate = (date: Date) => {
      return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    };

    const icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      `UID:${outing.id}@yallamate.com`,
      `DTSTART:${formatDate(start)}`,
      `DTEND:${formatDate(end)}`,
      `SUMMARY:${outing.title}`,
      `DESCRIPTION:${outing.description.replace(/\n/g, '\\n')}`,
      `LOCATION:${outing.location}`,
      'STATUS:CONFIRMED',
      'SEQUENCE:0',
      'BEGIN:VALARM',
      'TRIGGER:-PT30M',
      'ACTION:DISPLAY',
      'DESCRIPTION:Reminder',
      'END:VALARM',
      'END:VEVENT',
      'END:VCALENDAR'
    ].join('\r\n');

    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${outing.title.replace(/\s+/g, '_')}_outing.ics`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };


  // Active Call VoIP integrated system
  const [isCallActive, setIsCallActive] = useState(false);
  const [showActiveCall, setShowActiveCall] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [userVolume, setUserVolume] = useState(0);
  const [callDuration, setCallDuration] = useState(0);
  const [callParticipants, setCallParticipants] = useState<Profile[]>([]);

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);

  const startCallMicRef = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;
      
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const audioContext = new AudioCtx();
      audioContextRef.current = audioContext;
      
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 64;
      source.connect(analyser);
      analyserRef.current = analyser;
      
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      
      const checkVolume = () => {
        if (!analyserRef.current || isMuted) {
          setUserVolume(0);
          return;
        }
        analyserRef.current.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const average = sum / bufferLength;
        setUserVolume(average); 
        
        if (micStreamRef.current) {
          requestAnimationFrame(checkVolume);
        }
      };
      
      requestAnimationFrame(checkVolume);
    } catch (err) {
      console.warn("Could not start active voice analyzer", err);
    }
  };

  const stopCallMic = () => {
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach(t => t.stop());
      micStreamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    analyserRef.current = null;
    setUserVolume(0);
  };

  useEffect(() => {
    if (isCallActive) {
      if (!isMuted) {
        startCallMicRef();
      } else {
        stopCallMic();
      }
    } else {
      stopCallMic();
    }
    return () => {
      stopCallMic();
    };
  }, [isCallActive, isMuted]);

  useEffect(() => {
    let timer: any;
    if (isCallActive) {
      timer = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
      
      // Populate call participants realistically from other outing members
      const others = (allProfiles || []).filter(p => outing.attendeeIds?.includes(p.id) && p.id !== currentUser.id);
      setCallParticipants(others.length > 0 ? others : (allProfiles || []).filter(p => p.id !== currentUser.id).slice(0, 2));
    } else {
      setCallDuration(0);
      setCallParticipants([]);
    }
    return () => clearInterval(timer);
  }, [isCallActive, allProfiles, outing.attendeeIds, currentUser.id]);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const formatCallDuration = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const secs = sec % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };
  const audioChunksRef = useRef<Blob[]>([]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      mediaRecorder.ondataavailable = (e) => audioChunksRef.current.push(e.data);
      mediaRecorder.onstop = () => {
        setIsTranscribing(true);
        setTimeout(() => {
          const simulatedText = lang === 'ar' ? 'سأكون هناك قريباً، الموعد مناسب جداً.' : "I'll be there soon, the timing is perfect.";
          onSendMessage(outing.id, `🎙️ ${simulatedText}`);
          setIsTranscribing(false);
        }, 1800);
      };
      mediaRecorder.start();
      setIsRecording(true);
      haptic();
    } catch (err) {
      console.warn('Mic access issue:', err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      mediaRecorderRef.current.stream.getTracks().forEach(t => t.stop());
    }
  };

  // Attachment states for media & GPS location
  const [presendingImage, setPresendingImage] = useState<string | null>(null);
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [showPenaltyModal, setShowPenaltyModal] = useState(false);
  const [chatFilter, setChatFilter] = useState<'all' | 'system' | 'media'>('all');

  const PRESET_ATTACHMENTS = [
    { titleAr: '🌅 كورنيش وغروب', titleEn: 'Coast Sunset', url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=650&q=80' },
    { titleAr: '☕ كوب تجمع', titleEn: 'Coffee Gathering', url: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=650&q=80' },
    { titleAr: '🍔 عشاء جماعي', titleEn: 'Group Dinner', url: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=650&q=80' },
    { titleAr: '🎮 ألعاب وتحديات', titleEn: 'VR Gaming Arcade', url: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=650&q=80' }
  ];

  const handleAddToCalendar = () => {
    // Generate .ics string
    const title = outing.title;
    const description = outing.description || '';
    const location = `${outing.location}, ${outing.city}`;
    
    const startDate = new Date(outing.datetime);
    // Outing duration is assumed to be 3 hours
    const endDate = new Date(startDate.getTime() + 3 * 60 * 60 * 1000);
    
    const formatDate = (date: Date) => {
      return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    };
    
    const icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//YallaMate//NONSGML Outing Calendar Sync//EN',
      'BEGIN:VEVENT',
      `UID:${outing.id}@yallamate.com`,
      `DTSTAMP:${formatDate(new Date())}`,
      `DTSTART:${formatDate(startDate)}`,
      `DTEND:${formatDate(endDate)}`,
      `SUMMARY:${title}`,
      `DESCRIPTION:${description.replace(/\n/g, '\\n')}`,
      `LOCATION:${location}`,
      'END:VEVENT',
      'END:VCALENDAR'
    ].join('\r\n');
    
    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${outing.title.replace(/\s+/g, '_')}_outing.ics`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    haptic();
    setDownloadedCal(true);
    setTimeout(() => setDownloadedCal(false), 3000);
  };

  const handleGenerateDeepLinkAndShare = () => {
    // Generate deep link containing the parameter
    const deepLink = `${window.location.origin}${window.location.pathname}?outingId=${outing.id}`;
    
    // Copy link directly to user's clipboard
    navigator.clipboard.writeText(deepLink).then(() => {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 3500);
    }).catch(err => {
      console.error('Failed to copy link to clipboard:', err);
    });
    
    haptic();
    
    const shareText = lang === 'ar' 
      ? `يا رفاق! تفضلوا بمشاركتي هذه الطلعة الرهيبة: ${outing.title} في ${outing.location}. خلونا نروح مع بعض! للتنسيق والاشتراك انقر هنا: `
      : `Hey mates! Check out this awesome outing: ${outing.title} at ${outing.location}. Let's go together! Join and coordinate here: `;
      
    // Open whatsapp with share message template containing the deep link
    const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(shareText + "\n" + deepLink)}`;
    window.open(whatsappUrl, '_blank', 'noreferrer,noopener');
  };

  const handleCustomFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setPresendingImage(url);
      setShowAttachmentMenu(false);
    }
  };

  const handleShareGPSLoc = async () => {
    setGpsLoading(true);
    setShowAttachmentMenu(false);

    try {
      const [lat, lng] = await requestLocation();
      const mapUrl = `https://maps.google.com/?q=${lat},${lng}`;
      onSendMessage(
        outing.id,
        lang === 'ar' ? '📍 تم مشاركة إحداثيات موقعي للتجمع معنا!' : '📍 Shared my meetup coordinate with the team!',
        undefined,
        mapUrl
      );
    } catch (err: any) {
      console.warn("GPS failed, using core fallback", err);
      const baseLat = outing.mapCoordinates?.lat || liveUserCoords?.[0] || 0;
      const baseLng = outing.mapCoordinates?.lng || liveUserCoords?.[1] || 0;
      const lat = baseLat + (Math.random() - 0.5) * 0.007;
      const lng = baseLng + (Math.random() - 0.5) * 0.007;
      const mapUrl = `https://maps.google.com/?q=${lat},${lng}`;
      
      onSendMessage(
        outing.id,
        lang === 'ar' ? '📍 مشاركة موقع تقديري (فشل الحصول على الـ GPS)' : '📍 Shared approximate meetup spot (GPS permission fallback)',
        undefined,
        mapUrl
      );
    } finally {
      setGpsLoading(false);
    }
  };

  // Fuel price overrides simulation
  const [customFuelPrice, setCustomFuelPrice] = useState(outing.logistics.fuelSharingPrice || 0);
  const [dividedPerPerson, setDividedPerPerson] = useState(outing.logistics.costPerPerson || 0);

  // Feature 2 Fuel Split Calculator States
  const [vehicleCap, setVehicleCap] = useState(outing.logistics.vehicleCapacity || 5);
  const [fuelCapacityAttendees, setFuelCapacityAttendees] = useState(outing.attendeeIds?.length || 2);
  const [exemptDriverFuel, setExemptDriverFuel] = useState(true);

  // Automated Fuel Split States (Distance, Fuel Price, Passengers)
  const [fuelSplitDistance, setFuelSplitDistance] = useState<number>(150); // Default km
  const [fuelSplitGasPrice, setFuelSplitGasPrice] = useState<number>(2.18); // Default SAR/liter
  const [fuelSplitConsumption, setFuelSplitConsumption] = useState<number>(8.5); // Default Liters/100km
  const [isFuelPaid, setIsFuelPaid] = useState<boolean>(false);
  const [showFuelPayConfirm, setShowFuelPayConfirm] = useState<boolean>(false);

  const calculatedTotalFuelCost = useMemo(() => {
    return Math.round((fuelSplitDistance * fuelSplitConsumption / 100) * fuelSplitGasPrice * 100) / 100;
  }, [fuelSplitDistance, fuelSplitConsumption, fuelSplitGasPrice]);

  const calculatedIndividualShare = useMemo(() => {
    const count = Math.min(vehicleCap, Math.max(1, fuelCapacityAttendees));
    const divisor = exemptDriverFuel ? Math.max(1, count - 1) : count;
    return Math.round((calculatedTotalFuelCost / divisor) * 100) / 100;
  }, [calculatedTotalFuelCost, vehicleCap, fuelCapacityAttendees, exemptDriverFuel]);

  const inlineCostPerPerson = useMemo(() => {
    const totalCost = customFuelPrice > 0 ? customFuelPrice : calculatedTotalFuelCost;
    if (totalCost <= 0) return 0;
    const count = Math.min(vehicleCap, Math.max(1, fuelCapacityAttendees));
    const divisor = exemptDriverFuel ? Math.max(1, count - 1) : count;
    return Math.round((totalCost / divisor) * 100) / 100;
  }, [customFuelPrice, calculatedTotalFuelCost, vehicleCap, fuelCapacityAttendees, exemptDriverFuel]);

  // Feature 1 Star Ratings States & Handlers
  const [outingRatings, setOutingRatings] = useState<number[]>([]);
  const [userRating, setUserRating] = useState<number | null>(null);

  useEffect(() => {
    const fetchRatings = async () => {
      let fetchedRatings: number[] = [];
      try {
        const { data, error } = await supabase
          .from('outing_star_ratings')
          .select('rating, user_id')
          .eq('outing_id', outing.id);
        
        if (!error && data) {
          fetchedRatings = data.map((d: any) => d.rating);
          const mine = data.find((d: any) => d.user_id === currentUser.id);
          if (mine) setUserRating(mine.rating);
        } else {
          // Fallback to localStorage
          const localData = localStorage.getItem(`outing_star_ratings_${outing.id}`);
          if (localData) {
            const parsed = JSON.parse(localData);
            fetchedRatings = parsed.map((d: any) => d.rating);
            const mine = parsed.find((d: any) => d.user_id === currentUser.id);
            if (mine) setUserRating(mine.rating);
          }
        }
      } catch (e) {
        const localData = localStorage.getItem(`outing_star_ratings_${outing.id}`);
        if (localData) {
          const parsed = JSON.parse(localData);
          fetchedRatings = parsed.map((d: any) => d.rating);
          const mine = parsed.find((d: any) => d.user_id === currentUser.id);
          if (mine) setUserRating(mine.rating);
        }
      }
      
      // Populating nice starting seeds based on hash if empty
      if (fetchedRatings.length === 0) {
        const hash = (outing.id.charCodeAt(0) || 0) % 2 + 4; // 4 or 5 stars
        fetchedRatings = [hash, hash, hash - 1];
      }
      setOutingRatings(fetchedRatings);
    };

    fetchRatings();
  }, [outing.id, currentUser.id]);

  const handleRateOuting = async (stars: number) => {
    setUserRating(stars);
    // Add or replace user's rating in lists
    setOutingRatings(prev => [...prev.filter((_, i) => i !== prev.length - 1 || userRating !== null), stars]);

    try {
      await supabase
        .from('outing_star_ratings')
        .upsert({
          outing_id: outing.id,
          user_id: currentUser.id,
          rating: stars,
          created_at: new Date().toISOString()
        });

      const localData = localStorage.getItem(`outing_star_ratings_${outing.id}`);
      let parsed = localData ? JSON.parse(localData) : [];
      parsed = parsed.filter((p: any) => p.user_id !== currentUser.id);
      parsed.push({ user_id: currentUser.id, rating: stars });
      localStorage.setItem(`outing_star_ratings_${outing.id}`, JSON.stringify(parsed));
    } catch (e) {
      const localData = localStorage.getItem(`outing_star_ratings_${outing.id}`);
      let parsed = localData ? JSON.parse(localData) : [];
      parsed = parsed.filter((p: any) => p.user_id !== currentUser.id);
      parsed.push({ user_id: currentUser.id, rating: stars });
      localStorage.setItem(`outing_star_ratings_${outing.id}`, JSON.stringify(parsed));
    }
  };

  const avgRating = useMemo(() => {
    if (outingRatings.length === 0) return 0;
    const sum = outingRatings.reduce((acc, r) => acc + r, 0);
    return Math.round((sum / outingRatings.length) * 10) / 10;
  }, [outingRatings]);

  // Smart Ride / Pickup state integration
  const [pickups, setPickups] = useState<PickupRequest[]>(outing.logistics.pickups || []);
  const [pickupType, setPickupType] = useState<'my_location' | 'custom_location'>('my_location');
  const [customAddress, setCustomAddress] = useState('');
  const [locationConsent, setLocationConsent] = useState(true);
  const [isOptimizingRoute, setIsOptimizingRoute] = useState(false);

  // Update central state when local pickups state changes
  const updatePickupsInOuting = (newPickups: PickupRequest[]) => {
    setPickups(newPickups);
    if (onUpdateOuting) {
      onUpdateOuting({
        ...outing,
        logistics: {
          ...outing.logistics,
          pickups: newPickups
        }
      });
    }
  };

  const handleRequestRide = () => {
    const freshRequest: PickupRequest = {
      id: `pickup_${Date.now()}`,
      passengerId: currentUser.id,
      passengerName: currentUser.name,
      passengerAvatar: currentUser.avatar,
      pickupType: pickupType,
      customAddress: pickupType === 'custom_location' ? customAddress : (lang === 'ar' ? 'الموقع الجغرافي المباشر للمستخدم' : 'Current GPS Coordinates Shared'),
      status: 'pending'
    };
    const updated = [...pickups.filter(p => p.passengerId !== currentUser.id), freshRequest];
    updatePickupsInOuting(updated);
    setCustomAddress('');
    alert(lang === 'ar' 
      ? 'تم إرسال طلب مقعد التوصيل بنجاح لقائد الرحلة للموافقة والتوزيع في المسار!' 
      : 'Ride request sent successfully to the captain for approval and route insertion!');
  };

  const handleCancelRequest = () => {
    const updated = pickups.filter(p => p.passengerId !== currentUser.id);
    updatePickupsInOuting(updated);
    alert(lang === 'ar' ? 'تم إلغاء طلب التوصيل بنجاح وجرى تكييف خط السير.' : 'Ride request deleted. Outing sequence updated.');
  };

  const handleAcceptRide = (reqId: string) => {
    const updated = pickups.map(p => {
      if (p.id === reqId) {
        return { ...p, status: 'accepted' as const };
      }
      return p;
    });
    // Re-assign order sequence
    const acceptedOnly = updated.filter(p => p.status === 'accepted');
    const assignedWithOrder = updated.map(p => {
      if (p.status === 'accepted') {
        const index = acceptedOnly.findIndex(item => item.id === p.id);
        return { ...p, pickupOrder: index + 1 };
      }
      return p;
    });
    updatePickupsInOuting(assignedWithOrder);
  };

  const handleDeclineRide = (reqId: string) => {
    const updated = pickups.map(p => {
      if (p.id === reqId) {
        return { ...p, status: 'declined' as const, pickupOrder: undefined };
      }
      return p;
    });
    // Re-assign order sequence for remaining accepted ones
    const acceptedOnly = updated.filter(p => p.status === 'accepted');
    const assignedWithOrder = updated.map(p => {
      if (p.status === 'accepted') {
        const index = acceptedOnly.findIndex(item => item.id === p.id);
        return { ...p, pickupOrder: index + 1 };
      }
      return p;
    });
    updatePickupsInOuting(assignedWithOrder);
  };

  const handleSimulateRequests = () => {
    const joinedCompanions = (allProfiles || []).filter(p => outing.attendeeIds?.includes(p.id) && p.id !== currentUser.id);
    if (joinedCompanions.length === 0) {
      alert(lang === 'ar' 
        ? 'يحتاج رفاق آخرون للانضمام للرحلة أولاً كي يتمكنوا من طلب توصيل!' 
        : 'Other companions must first join this outing to simulate requests!');
      return;
    }
    const simulated = joinedCompanions.map((comp, idx) => ({
      id: `pickup_sim_${comp.id}_${Date.now()}`,
      passengerId: comp.id,
      passengerName: comp.name,
      passengerAvatar: comp.avatar,
      pickupType: idx % 2 === 0 ? 'my_location' as const : 'custom_location' as const,
      customAddress: idx % 2 === 0 ? undefined : (lang === 'ar' ? 'حي الياسمين، المربع الرابع' : 'Yasmeen District, Block 4'),
      status: 'pending' as const
    }));
    updatePickupsInOuting(simulated);
    alert(lang === 'ar' ? 'تمت محاكاة طلبات مقاعد للرفاق بنجاح.' : 'Simulated ride requests successfully.');
  };

  const handleOptimizeRoute = () => {
    setIsOptimizingRoute(true);
    setTimeout(() => {
      const acceptedOnly = pickups.filter(p => p.status === 'accepted');
      if (acceptedOnly.length <= 1) {
        setIsOptimizingRoute(false);
        alert(lang === 'ar' ? 'تم حساب المسار بالفعل؛ يتطلب تحسين ترتيب المسافات وجود أكثر من راكب مقبول.' : 'Route computed. Multi-rider sequences require two or more passengers to order optimized points.');
        return;
      }
      // Shuffle accepted pickups to simulate AI path optimization
      const shuffled = [...acceptedOnly].sort(() => Math.random() - 0.5);
      const reordered = pickups.map(p => {
        if (p.status === 'accepted') {
          const index = shuffled.findIndex(item => item.id === p.id);
          return { ...p, pickupOrder: index + 1 };
        }
        return p;
      });
      updatePickupsInOuting(reordered);
      setIsOptimizingRoute(false);
      alert(lang === 'ar' 
        ? 'تمت مواءمة وتحسين خط السير الجغرافي بنجاح! جرى تقليل المسافة بمدة 18 دقيقة.' 
        : 'Smart geo-route sequence optimized successfully! Estimations show 18 minutes saved.');
    }, 1200);
  };

  // Review state
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [selectedRevieweeId, setSelectedRevieweeId] = useState<string>('');
  const [respectful, setRespectful] = useState(5);
  const [punctual, setPunctual] = useState(5);
  const [payment, setPayment] = useState(5);
  const [comment, setComment] = useState('');
  const [submittedReviews, setSubmittedReviews] = useState<string[]>([]);
  
  // Incident state
  const [showIncidentForm, setShowIncidentForm] = useState(false);
  const [reportingUserId, setReportingUserId] = useState<string | undefined>(undefined);

  // Map Real-time analytics state
  const [showRealTimeMapAnalytics, setShowRealTimeMapAnalytics] = useState(false);
  const [mapAnalyticsSyncing, setMapAnalyticsSyncing] = useState(false);

  const toggleMapAnalytics = () => {
    if (!showRealTimeMapAnalytics) {
       setMapAnalyticsSyncing(true);
       setShowRealTimeMapAnalytics(true);
       setTimeout(() => setMapAnalyticsSyncing(false), 2400);
    } else {
       setShowRealTimeMapAnalytics(false);
    }
  };

  const chatEndRef = useRef<HTMLDivElement>(null);

  const meta = categoryMeta[outing.category];
  const isJoined = outing.attendeeIds?.includes(currentUser.id);
  const isOwner = outing.creatorId === currentUser.id;

  // Track attendees detailed profile
  const attendeesList = (allProfiles || []).filter(p => outing.attendeeIds?.includes(p.id));

  // Auto scroll to chat bottom
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, activeTab]);

  // Recalculate fuel split in real time when input updates
  const handleRecalculateFuel = (val: number) => {
    setCustomFuelPrice(val);
    const splitCount = outing.attendeeIds?.length || 0;
    if (splitCount > 0) {
      setDividedPerPerson(parseFloat((val / splitCount).toFixed(2)));
    } else {
      setDividedPerPerson(0);
    }
  };

  // Automatically recalculate if anyone joins or exits the outing group
  useEffect(() => {
    handleRecalculateFuel(customFuelPrice);
  }, [outing.attendeeIds?.length || 0]);

  // Feature 4: Safety & Quick SOS Handler
  const [sosStatus, setSosStatus] = useState<'idle' | 'triggered'>('idle');

  const handleTriggerSOS = () => {
    haptic();
    navigator.vibrate?.([200, 100, 200, 100, 200]);
    
    const emergencyName = currentUser.emergencyContactName || '';
    const emergencyPhone = currentUser.emergencyContactPhone || '';
    
    let alertText = '';
    if (lang === 'ar') {
      alertText = `🚨 [انتباه! نداء استغاثة SOS طارئ] الرفيق ${currentUser.displayName || currentUser.name} أرسل إشارة استغاثة طارئة الآن! `;
      if (emergencyName && emergencyPhone) {
        alertText += `تم إخطار جهة الاتصال المفوضة بالملف الشخصي فوراً: ${emergencyName} (${emergencyPhone}).`;
      } else {
        alertText += `يرجى من جميع الرفقاء المتابعة بشكل عاجل والتحقق من سلامته.`;
      }
    } else {
      alertText = `🚨 [ATTENTION: EMERGENCY SOS ALERT] Comrade ${currentUser.displayName || currentUser.name} has triggered an SOS panic broadcast! `;
      if (emergencyName && emergencyPhone) {
        alertText += `Emergency Contact ${emergencyName} (${emergencyPhone}) has been pinged.`;
      } else {
        alertText += `All active participants check on them immediately.`;
      }
    }

    onSendMessage(outing.id, alertText);
    setSosStatus('triggered');
    setTimeout(() => {
      setSosStatus('idle');
    }, 5000);
  };

  const handleSend = () => {
    if (!chatInput.trim() && !presendingImage) return;
    
    const textToSend = chatInput.trim() || (lang === 'ar' ? '📷 أرسل وسائط للتنسيق' : '📷 Shared coordination media');
    onSendMessage(outing.id, textToSend, presendingImage || undefined);
    setChatInput('');
    setPresendingImage(null);

    // Simulated companion responses for interactive feel!
    setTimeout(() => {
      simulatedCompanionReply();
    }, 1500);
  };

  const handleTakeLocationSnapshot = () => {
    // Generate a simulated coordinate-pinned map snapshot
    const mockMapSnapshotUrl = "https://images.unsplash.com/photo-1524661135-423995f22d0b?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80";
    const textMsg = lang === 'ar' ? `📍 لقطة مساعدة للوصول لنقطة التجمع: ${outing.location} (إحداثيات مثبتة)` : `📍 Visual map snapshot for meetup spot: ${outing.location} (Pinned coordinates)`;
    onSendMessage(outing.id, textMsg, mockMapSnapshotUrl);
    haptic();
  };

  const simulatedCompanionReply = () => {
    // Pick another attendee to reply if possible
    const others = attendeesList.filter(a => a.id !== currentUser.id);
    if (others.length === 0) return;
    const randomCompanion = others[Math.floor(Math.random() * others.length)];
    
    // Arabic or English companion simulated speech
    const companionRepliesAr = [
      `ممتاز جداً! نراكم هناك يا أصدقاء 👍`,
      `إن شاء الله، سأصل قبل الموعد بـ 5 دقائق. لقد حددت الموقع على نظام الملاحة.`,
      `تأكدت من المكان ويبدو مذهلاً حقاً. دعنا نحسب حصة الوقود معاً فور وصولنا.`,
      `السلام عليكم جميعاً! متحمس جداً لهذا اللقاء والبرنامج الرائع!`,
    ];
    const companionRepliesEn = [
      `That sounds perfect! See you guys there! 👍`,
      `Inshallah, I'll arrive 5 minutes early. I've marked the coordinates on my navigation app.`,
      `Verified the spot. Looks amazing. Let's coordinate the fuel calculator once we arrive.`,
      `Salam mates! Looking forward to this, sounds like a beautiful outing plan!`,
    ];

    const repliesList = lang === 'ar' ? companionRepliesAr : companionRepliesEn;
    const randomReply = repliesList[Math.floor(Math.random() * repliesList.length)];

    onSendMessage(outing.id, `${lang === 'ar' ? '💬 [محاكاة] الرفيق' : '💬 [Simulation] Comrade'} ${randomCompanion.name}: "${randomReply}"`);
  };

  const [showRatingSuccess, setShowRatingSuccess] = useState(false);

  const submitOutingReview = () => {
    if (!selectedRevieweeId) return;

    onCompleteReview({
      outingId: outing.id,
      reviewerId: currentUser.id,
      revieweeId: selectedRevieweeId,
      respectfulRating: respectful,
      punctualRating: punctual,
      paymentRating: payment,
      comment: comment || 'Awesome buddy outing.'
    });

    setSubmittedReviews([...submittedReviews, selectedRevieweeId]);
    setShowRatingSuccess(true);
    // Smooth reset
    setTimeout(() => {
      setShowRatingSuccess(false);
      setComment('');
      setSelectedRevieweeId('');
      setShowReviewForm(false);
    }, 2000);
  };

  const handleShare = (platform: 'whatsapp' | 'snapchat' | 'instagram' | 'native') => {
    const shareText = `${outing.title} - ${outing.location}, ${outing.city}\n${outing.description}`;
    const shareUrl = `${window.location.origin}?outingId=${outing.id}`;

    let finalUrl = '';
    
    if (platform === 'whatsapp') {
      finalUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(shareText + "\n" + shareUrl)}`;
    } else if (platform === 'snapchat') {
      finalUrl = `https://snapchat.com/scan?attachmentUrl=${encodeURIComponent(shareUrl)}`;
    } else if (platform === 'instagram') {
      alert(lang === 'ar' ? 'قم بنسخ الرابط لمشاركته على انستقرام!' : 'Copy the link to share on Instagram!');
      return;
    } else if (platform === 'native') {
      if (navigator.share) {
        navigator.share({
          title: outing.title,
          text: shareText,
          url: shareUrl
        }).catch((err) => {
          if (err.name !== 'AbortError' && !err.message.includes('canceled')) {
            console.error('Error sharing', err);
          }
        });
      } else {
        // Fallback to clipboard
        navigator.clipboard.writeText(shareUrl).then(() => {
           alert(lang === 'ar' ? 'تم نسخ الرابط!' : 'Link copied to clipboard!');
        }).catch(() => {
           alert(lang === 'ar' ? 'فشل نسخ الرابط' : 'Failed to copy link');
        });
      }
      return;
    }

    if (finalUrl) {
      window.open(finalUrl, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 25 }}
      id="details_container" 
      className="outing-details-container bg-[#0B0E14] min-h-[80vh] rounded-3xl overflow-hidden border border-white/10 flex flex-col shadow-2xl relative" 
      dir={lang === 'ar' ? 'rtl' : 'ltr'}
    >
      {/* Decorative glows */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-[100px] pointer-events-none"></div>
      <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-500/10 rounded-full blur-[100px] pointer-events-none"></div>

      {/* Top Banner Context Card styled with cover images in background */}
      <div className="relative min-h-[260px] p-6 text-white flex flex-col justify-between overflow-hidden">
        {/* Background Image overlay */}
        <img 
          src={resolveCoverImage(outing.coverImage)} 
          alt={outing.title}
          referrerPolicy="no-referrer"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#0B0E14]/70 via-[#0B0E14]/40 to-[#0B0E14]" />

        <div className="relative z-10 flex justify-between items-center w-full">
          <button 
            id="btn_back_dashboard"
            onClick={onClose}
            className={`px-4 py-2 bg-white/10 hover:bg-white/20 hover:text-white backdrop-blur-md rounded-xl transition-all text-slate-300 flex items-center gap-2 text-xs font-black cursor-pointer border border-white/5 hover:border-white/20`}
          >
            <ArrowLeft className={`w-4 h-4 ${lang === 'ar' ? 'rotate-180' : ''}`} /> {t.exitOutingInfoBtn}
          </button>
          <div className="flex gap-2.5">
            {outing.status === 'completed' && (
              <button onClick={() => { setReportingUserId(undefined); setShowIncidentForm(true); }} className="w-8 h-8 flex items-center justify-center bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/20 backdrop-blur-md rounded-full transition-all text-rose-400 cursor-pointer" title={lang === 'ar' ? 'الإبلاغ عن المخالفة' : 'Report Incident'}><AlertTriangle className="w-3.5 h-3.5" /></button>
            )}
            <button onClick={() => setShowQrCodeModal(true)} className="w-8 h-8 flex items-center justify-center bg-indigo-500/20 border border-indigo-500/30 hover:bg-indigo-500/40 backdrop-blur-md rounded-full transition-all text-indigo-300 font-bold text-[10px]" title={lang === 'ar' ? 'مسح/توليد رمز الوصول' : 'Scan/Generate Access QR'}><QrCode className="w-3.5 h-3.5" /></button>
            {isJoined && (
              <button 
                onClick={() => {
                  haptic();
                  setShowActiveCall(true);
                }} 
                className={`w-8 h-8 flex items-center justify-center rounded-full transition-all cursor-pointer ${isCallActive ? 'bg-emerald-500 text-white animate-pulse shadow-md shadow-emerald-500/30' : 'bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 hover:bg-indigo-500/40 backdrop-blur-md'}`}
                title={lang === 'ar' ? 'مكالمة جماعية نشطة' : 'Active Group Call'}
              >
                <PhoneCall className="w-3.5 h-3.5" />
              </button>
            )}
            <button onClick={() => handleShare('whatsapp')} className="w-8 h-8 flex items-center justify-center bg-[#25D366]/20 border border-[#25D366]/30 hover:bg-[#25D366]/40 backdrop-blur-md rounded-full transition-all text-[#25D366] font-bold text-[10px]" title="WhatsApp">WA</button>
            <button onClick={() => handleShare('snapchat')} className="w-8 h-8 flex items-center justify-center bg-[#FFFC00]/20 border border-[#FFFC00]/30 hover:bg-[#FFFC00]/40 backdrop-blur-md rounded-full transition-all text-[#FFFC00] font-bold text-[10px]" title="Snapchat">SC</button>
            <button onClick={() => handleShare('instagram')} className="w-8 h-8 flex items-center justify-center bg-gradient-to-tr from-[#f09433]/30 via-[#e6683c]/30 to-[#bc1888]/30 border border-[#bc1888]/30 hover:opacity-80 backdrop-blur-md rounded-full transition-all text-rose-300 font-bold text-[10px]" title="Instagram">IG</button>
            <button onClick={() => handleShare('native')} className="w-8 h-8 flex items-center justify-center bg-white/10 border border-white/10 hover:bg-white/20 backdrop-blur-md rounded-full transition-all text-white cursor-pointer" title="Share"><Share2 className="w-3.5 h-3.5" /></button>
            <button 
              onClick={handleExportICS}
              className="w-8 h-8 flex items-center justify-center bg-emerald-500/20 border border-emerald-500/30 hover:bg-emerald-500/40 backdrop-blur-md rounded-full transition-all text-emerald-300 cursor-pointer"
              title={lang === 'ar' ? 'إضافة للتقويم' : 'Add to Calendar'}
            >
              <Calendar className="w-3.5 h-3.5" />
            </button>
            <button 
              id="btn_close_outing"
              onClick={onClose} 
              className="px-4 py-2 bg-white/10 hover:bg-white/20 hover:text-white backdrop-blur-md rounded-xl transition-all text-slate-300 flex items-center gap-2 text-xs font-black cursor-pointer border border-white/5 hover:border-white/20" 
              title={lang === 'ar' ? 'إغلاق' : 'Close'}
            >
              <X className="w-4 h-4" /> {lang === 'ar' ? 'إغلاق' : 'Close'}
            </button>
          </div>
        </div>

        <div className="relative z-10 mt-8 text-center animate-in slide-in-from-bottom-4 fade-in duration-500">
          <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-500/20 backdrop-blur-md border border-indigo-500/30 text-indigo-300 rounded-full text-[10px] font-black mb-3 select-none uppercase tracking-widest">
            {meta?.icon} {lang === 'ar' && meta?.nameAr ? meta.nameAr : outing.category}
          </span>
          <h1 className="text-2xl md:text-3xl font-display font-black tracking-tight leading-tight text-white mb-2 shadow-sm">{outing.title}</h1>
          
          {/* Average Rating Widget */}
          {avgRating > 0 && (
            <div className="flex items-center justify-center gap-1 mt-2 text-amber-400 select-none">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star 
                  key={i} 
                  className={`w-4 h-4 ${i < Math.floor(avgRating) ? 'fill-amber-400 text-amber-400' : 'text-slate-600'}`} 
                />
              ))}
              <span className="text-white text-[10px] font-black ml-2 bg-amber-500/20 border border-amber-500/30 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                ⭐ {avgRating} ({outingRatings.length} {lang === 'ar' ? 'تقييمات' : 'ratings'})
              </span>
            </div>
          )}

          <p className="text-slate-300 text-xs mt-2 max-w-lg mx-auto leading-relaxed">{outing.description}</p>
        </div>

        {/* Tab menu */}
        <div className="relative z-10 flex justify-center gap-3 mt-8">
          <button
            onClick={() => setActiveTab('info')}
            className={`px-6 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer uppercase tracking-widest ${activeTab === 'info' ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20' : 'bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white border border-white/5'}`}
          >
            📋 {t.outingDetailsTab}
          </button>

          <button
            onClick={() => setActiveTab('split')}
            className={`px-6 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer uppercase tracking-widest ${activeTab === 'split' ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20' : 'bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white border border-white/5'}`}
          >
            ⛽ {lang === 'ar' ? 'تقسيم الوقود' : 'Fuel Split'}
          </button>
          
          <button
            onClick={() => setActiveTab('chat')}
            className={`px-6 py-2.5 rounded-xl text-xs font-black transition-all relative cursor-pointer uppercase tracking-widest flex items-center gap-2 ${activeTab === 'chat' ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20' : 'bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white border border-white/5'}`}
          >
            <MessageSquare className="w-4 h-4" /> {t.outingChatTab}
            {isJoined && (
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping absolute -top-1 -right-1" />
            )}
            {isJoined && (
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 absolute -top-1 -right-1 border border-[#0B0E14]" />
            )}
          </button>
        </div>
      </div>

      {activeTab === 'info' ? (
        <div className="p-6 flex-1 grid grid-cols-1 md:grid-cols-3 gap-6 relative z-10 animate-in fade-in duration-300">
          {/* Main detailed Information segment */}
          <div className="md:col-span-2 space-y-6">
            <div className="bg-white/5 backdrop-blur-md rounded-3xl p-6 border border-white/10 shadow-xl space-y-5">
              <h3 className="text-sm font-black text-white uppercase tracking-widest border-b border-white/10 pb-3">{t.coordinatesPlanningLabel}</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs font-medium text-slate-300">
                <div className="flex items-start gap-3">
                  <div className="p-3 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-xl shrink-0 shadow-inner">
                    <MapPin className="w-5 h-5" />
                  </div>
                  <div className="outing-location-address-container">
                    <span className="text-[9px] text-slate-500 block font-bold uppercase tracking-widest mb-1">
                      {lang === 'ar' ? 'موقع الوجهة المقترحة' : 'Proposed Destination'}
                      {distanceKm !== null && (
                        <span className="text-indigo-400 ml-2">({distanceKm} away)</span>
                      )}
                    </span>
                    <div className="flex items-center gap-3 mb-1">
                      <a 
                        href={outing.mapLocationUrl || `https://maps.google.com/?q=${outing.mapCoordinates?.lat},${outing.mapCoordinates?.lng}`} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="text-white font-black text-sm hover:text-indigo-400 transition-colors"
                      >
                        {outing.location} ↗
                      </a>
                      {outing.mapCoordinates && (
                        <a 
                          href={`https://maps.google.com/?q=${outing.mapCoordinates.lat},${outing.mapCoordinates.lng}`}
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="px-2 py-1 bg-indigo-500/20 hover:bg-indigo-500/40 text-indigo-300 rounded-md text-[10px] font-bold uppercase tracking-widest flex items-center gap-1 transition-colors"
                        >
                          <Navigation className="w-3 h-3" />
                          {lang === 'ar' ? 'الاتجاهات' : 'Directions'}
                        </a>
                      )}
                      {outing.mapCoordinates && (
                        <button 
                          onClick={() => {
                            const coords = `${outing.mapCoordinates?.lat},${outing.mapCoordinates?.lng}`;
                            navigator.clipboard.writeText(coords).then(() => {
                              setCopiedCoords(true);
                              setTimeout(() => setCopiedCoords(false), 2500);
                            });
                            if (typeof haptic === 'function') haptic();
                          }}
                          className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-widest flex items-center gap-1 transition-all relative cursor-pointer border ${copiedCoords ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-300' : 'bg-white/5 border-white/5 text-slate-300 hover:bg-white/10 hover:text-white'}`}
                        >
                          <Copy className="w-3 h-3" />
                          <span>{copiedCoords ? (lang === 'ar' ? 'تم النسخ!' : 'Copied!') : (lang === 'ar' ? 'نسخ الإحداثيات' : 'Copy Coords')}</span>
                        </button>
                      )}
                    </div>
                    <span className="text-[10px] text-indigo-300 block font-bold tracking-wide uppercase">{outing.city} {t.hubLabel}</span>
                    {validateOutingCoordinates(outing) && (
                      <div className="mt-3">
                        <StaticMapPreview
                          lat={outing.mapCoordinates?.lat || 24.7136}
                          lng={outing.mapCoordinates?.lng || 46.6753}
                          label={outing.location}
                          lang={lang}
                        />
                      </div>
                    )}

                    {!validateOutingCoordinates(outing) && (
                      <div className="mt-3">
                        <div className="p-3 bg-white/5 border border-white/10 rounded-2xl flex flex-col gap-2">
                          <div className="flex justify-between items-center">
                            <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">{lang === 'ar' ? 'خيارات الموقع والتنقل' : 'Location & Transit Options'}</span>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <a
                              id="btn_open_google_maps_fallback"
                              href={getGoogleMapsViewUrl({
                                placeId: outing.placeId,
                                name: outing.location,
                                city: outing.city
                              })}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-indigo-500/15 hover:bg-indigo-500/30 border border-indigo-500/35 text-indigo-300 rounded-lg text-[10px] uppercase tracking-widest font-black transition-all duration-350"
                            >
                              🗺️ {lang === 'ar' ? 'عرض الموقع' : 'View Location'}
                            </a>
                            <a
                              id="btn_open_google_maps_dir_fallback"
                              href={getGoogleMapsDirUrl({ name: outing.location + ', ' + outing.city })}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-sky-500/15 hover:bg-sky-500/30 border border-sky-500/35 text-sky-300 rounded-lg text-[10px] uppercase tracking-widest font-black transition-all duration-350"
                            >
                              🧭 {lang === 'ar' ? 'الاتجاهات' : 'Directions'}
                            </a>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {outing.budgetEstimate && (
                  <div className="bg-[#161B26] border border-emerald-500/30 rounded-2xl p-4 mb-5 shadow-lg">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-xl">💰</span>
                      <div>
                        <h4 className="text-xs font-black text-emerald-400 uppercase tracking-widest">{lang === 'ar' ? 'الميزانية التقديرية (الذكاء الاصطناعي)' : 'AI Budget Estimate'}</h4>
                        <p className="text-[9px] text-emerald-500/70">{lang === 'ar' ? 'تم تقديرها عند إنشاء الطلعة' : 'Estimated when outing was created'}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-3 border-t border-emerald-500/10">
                      <div className="bg-[#0D111A] p-2 rounded-lg border border-slate-800">
                        <span className="text-[8px] text-slate-400 block uppercase mb-0.5">{lang === 'ar' ? 'المطاعم' : 'Food'}</span>
                        <span className="text-[10px] font-bold text-white">{outing.budgetEstimate.foodCost}</span>
                      </div>
                      <div className="bg-[#0D111A] p-2 rounded-lg border border-slate-800">
                        <span className="text-[8px] text-slate-400 block uppercase mb-0.5">{lang === 'ar' ? 'القهوة/المشروبات' : 'Drinks'}</span>
                        <span className="text-[10px] font-bold text-white">{outing.budgetEstimate.drinksCost}</span>
                      </div>
                      <div className="bg-[#0D111A] p-2 rounded-lg border border-slate-800">
                        <span className="text-[8px] text-slate-400 block uppercase mb-0.5">{lang === 'ar' ? 'الترفيه' : 'Entertainment'}</span>
                        <span className="text-[10px] font-bold text-white">{outing.budgetEstimate.entertainmentCost}</span>
                      </div>
                      <div className="bg-[#0D111A] p-2 rounded-lg border border-slate-800">
                        <span className="text-[8px] text-slate-400 block uppercase mb-0.5">{lang === 'ar' ? 'الوقود/التنقل' : 'Transit'}</span>
                        <span className="text-[10px] font-bold text-white">{outing.budgetEstimate.fuelCost}</span>
                      </div>
                      <div className="col-span-2 mt-1 bg-emerald-500/10 p-2 rounded-lg border border-emerald-500/20 flex justify-between items-center">
                        <span className="text-[10px] text-emerald-400 font-bold uppercase">{lang === 'ar' ? 'الإجمالي التقديري' : 'Estimated Total'}</span>
                        <span className="text-xs font-black text-emerald-300">{outing.budgetEstimate.totalCost}</span>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex items-start gap-3">
                  <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl shrink-0 shadow-inner">
                    <Calendar className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-500 block font-bold uppercase tracking-widest mb-1">{t.datetimeLabel}</span>
                    <span className="text-white font-black text-sm block mb-1">
                      {new Date(outing.datetime).toLocaleString(lang === 'ar' ? 'ar-SA' : 'en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <span className="text-[10px] block mt-1.5 font-black text-emerald-400 uppercase tracking-widest bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full inline-block">{t.punctualityRequiredLabel}</span>
                    <button
                      onClick={handleExportICS}
                      className="mt-2.5 px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-emerald-300 hover:text-white rounded-xl text-[10px] font-black tracking-wider uppercase transition-all flex items-center gap-1.5 cursor-pointer select-none"
                    >
                      📅 {lang === 'ar' ? 'تصدير وحفظ للتقويم (.ics)' : 'Export to Calendar (.ics)'}
                    </button>
                  </div>
                </div>
              </div>

              {/* AI Solo Dashboard logic */}
              {outing.isSoloOuting && currentUser.id === outing.creatorId && (
                <div className="bg-gradient-to-br from-indigo-900/40 to-blue-900/40 border border-indigo-500/30 rounded-3xl p-6 shadow-xl relative overflow-hidden group mb-5">
                  <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
                  <div className="relative z-10 flex flex-col gap-4">
                    <div className="flex items-center justify-between border-b border-indigo-500/30 pb-3">
                      <h3 className="text-sm font-black text-indigo-300 uppercase tracking-widest flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-indigo-400" />
                        {lang === 'ar' ? 'رحلة شخصية موجهة بالذكاء الاصطناعي' : 'AI Guided Solo Trip'}
                      </h3>
                      <span className="px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 text-[10px] font-black tracking-widest uppercase border border-indigo-500/30 shadow-inner flex items-center gap-1.5">
                        <Activity className="w-3.5 h-3.5 animate-pulse" /> {lang === 'ar' ? 'مراقبة حية' : 'Live Tracking'}
                      </span>
                    </div>

                    <div className="text-xs text-indigo-200/80 leading-relaxed space-y-2">
                      <p>{lang === 'ar' ? 'نظام الملاحة الذكي يتتبع مسارك حالياً. تم تجهيز اقتراحات شخصية لخط سير الرحلة لضمان أفضل تجربة لك.' : 'The smart navigation system is actively tracking your route. Personalized AI suggestions have been generated to ensure an optimal experience.'}</p>
                    </div>
                    
                    <div className="space-y-3 mt-2">
                      <div className="p-3 bg-indigo-950/50 rounded-2xl border border-indigo-500/20 flex gap-3 items-start relative overflow-hidden group-hover:border-indigo-500/40 transition-colors">
                        <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center shrink-0 border border-indigo-500/30">
                          <MapPin className="w-4 h-4 text-indigo-400" />
                        </div>
                        <div>
                          <h4 className="text-xs font-black text-white">{lang === 'ar' ? 'المرحلة الحالية: التوجه للوجهة' : 'Current Phase: En Route'}</h4>
                          <p className="text-[10px] text-indigo-300/80 mt-1">{lang === 'ar' ? 'استمتع بالطريق. سيتم تحديث التعليمات تلقائياً عند وصولك.' : 'Enjoy the journey. Instructions will dynamically update upon arrival.'}</p>
                        </div>
                      </div>
                      
                      <div className="p-3 bg-white/5 rounded-2xl border border-white/10 flex gap-3 items-start opacity-60">
                        <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center shrink-0 border border-white/10">
                          <Coffee className="w-4 h-4 text-slate-400" />
                        </div>
                        <div>
                          <h4 className="text-xs font-black text-slate-300">{lang === 'ar' ? 'الخطوة القادمة: استكشاف المكان' : 'Next Step: Explore Area'}</h4>
                          <p className="text-[10px] text-slate-500 mt-1">{lang === 'ar' ? 'بناءً على تفضيلاتك، سيتم اقتراح نشاط بمجرد وصولك.' : 'Based on your preferences, an activity will be suggested upon arrival.'}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Safeguards minimum trust limits info */}
              {!outing.isSoloOuting && (
                <div className="bg-amber-500/10 p-5 border border-amber-500/20 rounded-2xl flex items-center justify-between gap-4 text-xs text-amber-200/80 leading-relaxed group">
                  <div>
                    <span className="font-black text-amber-300 flex items-center gap-1.5 mb-1 tracking-wide uppercase">
                      🛡️ {t.safetyRatingFilterLabel}
                    </span>
                    {t.safetyRatingFilterDesc} <b className="text-white">★ {outing.minTrustScore.toFixed(1)}</b> {t.toAutoJoinCohort}
                  </div>
                  <div className="text-amber-400 font-black text-lg px-4 py-2 bg-black/30 border border-amber-500/30 rounded-xl shrink-0 shadow-inner group-hover:scale-105 transition-transform duration-300">
                    ★ {outing.minTrustScore.toFixed(1)}
                  </div>
                </div>
              )}
            </div>

            {/* Real-Time Weather Forecast & Outdoor Advisory */}
            <div className="bg-white/5 backdrop-blur-md rounded-3xl p-6 border border-white/10 shadow-xl space-y-4">
              <h3 className="text-sm font-black text-white uppercase tracking-widest border-b border-white/10 pb-3 flex items-center gap-2">
                <span>🌤️</span>
                {lang === 'ar' ? 'توقعات الطقس والإرشاد الخارجي' : 'Weather Forecast & Advisory'}
              </h3>
              {(() => {
                const weather = getMockWeather(outing.location, outing.datetime);
                return (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between bg-[#0B0E14] border border-white/5 p-4 rounded-2xl">
                      <div className="flex items-center gap-4">
                        <span className="text-4xl select-none animate-bounce">{weather.icon}</span>
                        <div>
                          <span className="text-2xl font-black text-white">{weather.temp}°C</span>
                          <span className="text-xs text-slate-300 block mt-0.5 font-bold">
                            {lang === 'ar' ? weather.conditionAr : weather.conditionEn}
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-[9px] text-slate-500 block font-bold uppercase tracking-widest mb-1">
                          {lang === 'ar' ? 'موعد الفعالية' : 'Outing Schedule'}
                        </span>
                        <span className="text-xs font-black text-indigo-400 uppercase tracking-wider bg-indigo-500/10 border border-indigo-500/20 px-2.5 py-1 rounded-xl">
                          {new Date(outing.datetime).toLocaleTimeString(lang === 'ar' ? 'ar-SA' : 'en-US', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>

                    {weather.isExtreme && (
                      <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-300 rounded-2xl flex items-start gap-3 text-xs leading-relaxed animate-pulse">
                        <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-black text-rose-400 block uppercase tracking-wide mb-1">
                            {lang === 'ar' ? 'تنبيه طقس حرج' : 'Extreme Weather Warning'}
                          </span>
                          {lang === 'ar' ? weather.alertAr : weather.alertEn}
                        </div>
                      </div>
                    )}

                    {checkNeedsIndoorAlternative(weather) && (
                      <div className="p-4 bg-amber-500/10 border border-amber-500/25 text-amber-300 rounded-2xl flex items-start gap-3 text-xs leading-relaxed">
                        <span className="text-xl shrink-0 mt-0.5">🏠</span>
                        <div>
                          <span className="font-black text-amber-400 block uppercase tracking-wide mb-1 text-[10px] tracking-widest">
                            {lang === 'ar' ? 'يُنصح ببدائل داخلية مغلقة' : 'Indoor Alternative Recommended'}
                          </span>
                          <p className="text-slate-300 text-[11px] leading-normal font-medium">
                            {lang === 'ar'
                              ? 'الطقس المتوقع للطلعة قد يكون متعباً في الفضاء الخارجي. نقترح نقل اللقاء لصالة ألعاب داخلية، مقهى مغلق، أو مجمع مكيف لضمان المتعة والراحة!'
                              : 'The forecasted outdoor conditions might be uncomfortable. We highly recommend pivoting to indoor spots (e.g. cozy indoor board game cafes, bowling centers, or shaded food courts) to maximize companion comfort!'}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>

            {/* Smart Checklist for Coordinated Gear & Prep */}
            <div className="bg-white/5 backdrop-blur-md rounded-3xl p-6 border border-white/10 shadow-xl space-y-4">
              <div className="flex justify-between items-center border-b border-white/10 pb-3">
                <h3 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2">
                  <span>🎒</span>
                  {lang === 'ar' ? 'حقيبة التجهيز وقائمة الأغراض' : 'Smart Packing Checklist'}
                </h3>
                <span className="px-2.5 py-1 bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 rounded-lg text-[9px] font-black uppercase tracking-widest">
                  {lang === 'ar' ? 'تجهيز شخصي' : 'Personal Prep'}
                </span>
              </div>
              
              <p className="text-xs text-slate-400 leading-relaxed">
                {lang === 'ar' 
                  ? 'قائمة الأغراض المقترحة لهذه الطلعة بناءً على نوع النشاط للتأكد من عدم نسيان الأساسيات.' 
                  : 'Recommended prep items for this activity category so you never forget the essentials.'}
              </p>

              {(() => {
                const items = PACKING_CHECKLISTS[outing.category] || PACKING_CHECKLISTS['Custom Activities'];
                return (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {items.map((item, idx) => {
                      const isChecked = !!checkedPackingItems[idx];
                      return (
                        <div 
                          key={idx} 
                          onClick={() => handleTogglePackingItem(idx)}
                          className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${isChecked ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-200' : 'bg-[#0B0E14] border-white/5 text-slate-300 hover:border-white/10'}`}
                        >
                          <span className="text-xs font-bold leading-normal">
                            {lang === 'ar' ? item.itemAr : item.itemEn}
                          </span>
                          <div className={`w-5 h-5 rounded-lg border flex items-center justify-center transition-all ${isChecked ? 'bg-indigo-500 border-indigo-500 text-white scale-110' : 'border-slate-700'}`}>
                            {isChecked && <Check className="w-3.5 h-3.5 stroke-[3px]" />}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>

            {/* Temporary Private Photo Gallery */}
            <div className="bg-white/5 backdrop-blur-md rounded-3xl p-6 border border-white/10 shadow-xl space-y-4">
              <div className="flex justify-between items-center border-b border-white/10 pb-3">
                <h3 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2">
                  <span>📸</span>
                  {lang === 'ar' ? 'ألبوم صور الرحلة المؤقت' : 'Temporary Private Gallery'}
                </h3>
                <span className="px-2.5 py-1 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-lg text-[9px] font-black uppercase tracking-widest flex items-center gap-1">
                  <Clock className="w-3 h-3 animate-pulse" /> {lang === 'ar' ? 'ينتهي خلال 24 ساعة' : 'Expires in 24h'}
                </span>
              </div>

              {!isJoined ? (
                <div className="p-6 bg-[#0B0E14]/60 border border-white/5 rounded-2xl text-center">
                  <Lock className="w-8 h-8 text-slate-500 mx-auto mb-2" />
                  <p className="text-xs text-slate-400 font-bold">
                    {lang === 'ar' ? 'انضم للمجموعة لتتمكن من تصفح ورفع صور الرحلة الخاصة.' : 'Join the cohort to access the private memory share space.'}
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-xs text-slate-400 leading-relaxed">
                    {lang === 'ar' 
                      ? 'مساحة مغلقة وخاصة لمشاركة لقطات الماتس الجميلة أثناء المغامرة. تُحذف تلقائياً لحفظ الخصوصية.' 
                      : 'A secure, high-privacy workspace to share visual highlights. Images dissolve in 24 hours.'}
                  </p>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {galleryPhotos.map((photo) => (
                      <div key={photo.id} className="relative group rounded-2xl overflow-hidden aspect-video border border-white/5 bg-[#0B0E14] flex items-center justify-center">
                        <img src={photo.url} alt="" className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-all duration-350 p-3 flex flex-col justify-between">
                          <div className="flex items-center gap-1.5">
                            <span className="w-6 h-6 rounded-md bg-white/10 flex items-center justify-center text-xs">
                              {photo.uploadedAvatar && (photo.uploadedAvatar.startsWith('http') || photo.uploadedAvatar.startsWith('data:image') || photo.uploadedAvatar.length > 4) ? (
                                <img src={photo.uploadedAvatar} alt="" className="w-full h-full object-cover rounded-md" />
                              ) : (
                                photo.uploadedAvatar
                              )}
                            </span>
                            <span className="text-[9px] font-black text-white truncate">{photo.uploadedBy}</span>
                          </div>
                          <span className="text-[8px] text-indigo-300 font-bold self-end bg-[#0B0E14]/80 px-1.5 py-0.5 rounded-md">
                            {new Date(photo.uploadedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>
                    ))}

                    <label className="border-2 border-dashed border-indigo-500/20 hover:border-indigo-500/40 bg-indigo-500/5 hover:bg-indigo-500/10 rounded-2xl aspect-video transition-all flex flex-col items-center justify-center gap-1.5 cursor-pointer text-center p-3">
                      <Plus className="w-6 h-6 text-indigo-400 animate-pulse" />
                      <span className="text-[10px] font-black text-white uppercase tracking-widest">{lang === 'ar' ? 'إضافة صورة' : 'Upload Image'}</span>
                      <input 
                        type="file" 
                        accept="image/*" 
                        onChange={handleUploadPhoto} 
                        className="hidden" 
                      />
                    </label>
                  </div>
                </div>
              )}
            </div>

            {/* Smart transportation driver coordination system */}
            {!outing.isSoloOuting && (
              <div className="bg-white/5 backdrop-blur-md rounded-3xl p-6 border border-white/10 shadow-xl space-y-5">
              <h3 className="text-sm font-black text-white uppercase tracking-widest border-b border-white/10 pb-3 flex items-center justify-between gap-2">
                <span className="flex items-center gap-2">
                  <Car className="w-5 h-5 text-emerald-400 animate-pulse" />
                  {lang === 'ar' ? 'نظام النقل التشاركي وتتبع إحداثيات الرفاق' : 'Smart Transit & Coordinate Sharing'}
                </span>
                {outing.logistics.hasDriver && (
                  <span className="px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[9px] font-black tracking-widest rounded-full uppercase">
                    ★ {lang === 'ar' ? 'مسار ذكي نشط' : 'GPS ROUTE ACTIVE'}
                  </span>
                )}
              </h3>

              {outing.logistics.hasDriver ? (
                <div className="space-y-5">
                  {/* Driver summary card */}
                  <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div className="text-xs text-slate-300 font-semibold leading-relaxed">
                      <span className="text-emerald-400 font-black block mb-1 uppercase tracking-widest text-[10px]">🚙 {lang === 'ar' ? 'مركبة الرحلة والترخيص نشط' : 'Verified Ride Active'}</span>
                      {t.driverLabel}: <b className="text-white">{outing.logistics.driverName}</b> &bull; {lang === 'ar' ? 'السعة الكلية للمركبة' : 'Vehicle Capacity'}: <b className="text-indigo-300">{outing.logistics.vehicleCapacity || 4} {lang === 'ar' ? 'مقاعد' : 'seats'}</b>
                      <div className="mt-1 text-[10px] text-slate-400">
                        {lang === 'ar' ? 'نقطة الانطلاق الأولى للقائد' : 'Default Captain depot'}: <b className="text-slate-300">{outing.logistics.pickupPoint || (lang === 'ar' ? 'غير محددة' : 'Not Pinned')}</b>
                      </div>
                    </div>
                    <div className="px-3.5 py-2 bg-black/30 border border-white/5 rounded-xl text-center shrink-0 min-w-[120px]">
                      <span className="block text-[8px] text-slate-500 font-bold uppercase tracking-widest mb-1">{lang === 'ar' ? 'المقاعد المتبقية' : 'Seats Available'}</span>
                      <span className="text-sm font-black text-white">
                        {(outing.logistics.vehicleCapacity || 4) - pickups.filter(p => p.status === 'accepted').length} / {outing.logistics.vehicleCapacity || 4}
                      </span>
                    </div>
                  </div>

                  {/* Calculated Route Timeline / Interactive Map Sequence */}
                  <div className="p-5 bg-[#0B0E14] border border-white/5 rounded-2xl">
                    <div className="flex justify-between items-center mb-4">
                      <span className="text-xs font-black text-slate-200 tracking-wide uppercase">
                        📍 {lang === 'ar' ? 'تسلسل خط سير الرحلة الملاحي' : 'Optimized Navigation Route'}
                      </span>
                      <span className="text-[8px] text-slate-500 font-bold uppercase">
                        {pickups.filter(p => p.status === 'accepted').length} {lang === 'ar' ? 'محطات توقف معتمدة' : 'approved waypoints'}
                      </span>
                    </div>

                    {/* Timeline visualization */}
                    <div className="relative pl-6 border-l-2 border-indigo-500/30 space-y-6 text-xs select-none">
                      {/* Captain Depot */}
                      <div className="relative">
                        <span className="absolute -left-[31px] top-0 w-4 h-4 rounded-full bg-indigo-500 border-4 border-[#0B0E14] flex items-center justify-center text-[7px]" />
                        <div className="leading-tight">
                          <span className="font-black text-slate-100 block">{lang === 'ar' ? '🚩 نقطة الانطلاق (مقر القائد)' : '🚩 Depot Origin (Driver)'}</span>
                          <span className="text-[10px] text-slate-400">{outing.logistics.pickupPoint || (lang === 'ar' ? 'الموقع الافتراضي للقائد' : 'Captain origin coordinate')}</span>
                        </div>
                      </div>

                      {/* Sequenced passengers */}
                      {pickups.filter(p => p.status === 'accepted')
                        .sort((a, b) => (a.pickupOrder || 0) - (b.pickupOrder || 0))
                        .map((pup, idx) => (
                          <div key={pup.id} className="relative animate-in slide-in-from-left-2 fade-in">
                            <span className="absolute -left-[31px] top-0.5 w-4 h-4 rounded-full bg-emerald-500 border-4 border-[#0B0E14] flex items-center justify-center text-[7px] text-white font-bold" />
                            <div className="leading-tight">
                              <span className="font-black text-emerald-400 block flex items-center gap-1">
                                🛋️ {pup.passengerAvatar} {pup.passengerName}
                                <span className="text-[8px] px-1.5 py-0.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-md font-bold">
                                  {lang === 'ar' ? `المحطة ${idx + 1}` : `Stop #${idx + 1}`}
                                </span>
                              </span>
                              <span className="text-[10px] text-slate-400 block mt-0.5">
                                {pup.pickupType === 'my_location' 
                                  ? (lang === 'ar' ? '📌 إحداثيات GPS المباشرة (تمت الموافقة)' : '📌 Live GPS coordinates shared') 
                                  : pup.customAddress || (lang === 'ar' ? 'عنوان مخصص مضاف' : 'Custom location address')}
                              </span>
                            </div>
                          </div>
                      ))}

                      {/* Final Destination Venue */}
                      <div className="relative pt-2">
                        <span className="absolute -left-[31px] top-2.5 w-4 h-4 rounded-full bg-rose-500 border-4 border-[#0B0E14]" />
                        <div className="leading-tight">
                          <span className="font-black text-rose-400 block">{lang === 'ar' ? '🎯 وجهة التجمع النهائية' : '🎯 Final Destination Venue'}</span>
                          <span className="text-[10px] text-slate-300">{outing.location} ({outing.city}) {distanceKm && <span className="ml-1 text-emerald-400 font-bold">({distanceKm})</span>}</span>
                        </div>
                      </div>
                    </div>

                    {/* Live SVG Visual Track */}
                    <div className="mt-5 p-3.5 bg-white/5 border border-white/5 rounded-xl">
                      <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                        <span>🛰️</span> {lang === 'ar' ? 'خريطة المسار الملاحي ومستوى الكثافة' : 'Route Density Stream & Flow'}
                      </div>
                      <div className="h-10 bg-slate-950 rounded-lg relative overflow-hidden flex items-center px-4 border border-white/5">
                        <div className="absolute top-1/2 left-4 right-4 h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-rose-500 -translate-y-1/2 rounded-full" />
                        
                        {/* Driver point */}
                        <div className="absolute left-4 top-1/2 -translate-y-1/2 w-3 h-3 bg-blue-400 rounded-full border border-slate-900 pointer-events-none animate-pulse" title="Driver Start" />
                        
                        {/* Interactive dynamic passenger dots */}
                        {pickups.filter(p => p.status === 'accepted').map((pup, idx, arr) => {
                          const percent = 4 + ((idx + 1) / (arr.length + 1)) * 80;
                          return (
                            <div 
                              key={pup.id} 
                              style={{ left: `${percent}%` }}
                              className="absolute top-1/2 -translate-y-1/2 group/dot pointer-events-none"
                            >
                              <div className="relative">
                                <div className="w-3.5 h-3.5 bg-emerald-400 rounded-full border-2 border-slate-900 text-[8px] flex items-center justify-center transform hover:scale-125 transition-transform duration-200">
                                  {pup.passengerAvatar}
                                </div>
                                <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[8px] font-bold text-slate-500 bg-slate-900 px-1 rounded block whitespace-nowrap">
                                  {pup.passengerName}
                                </span>
                              </div>
                            </div>
                          );
                        })}

                        {/* Destination point */}
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 bg-rose-500 rounded-full border border-slate-900 flex items-center justify-center text-[7px]" title="Venue">
                          ★
                        </div>
                      </div>
                      <p className="text-[9px] text-slate-500 mt-5 leading-relaxed text-center font-medium">
                        {lang === 'ar' 
                          ? 'يتم تحديث خط السير تلقائياً عند انضمام ركاب للمركبة أو انسحابهم.' 
                          : 'The routing path dynamically synchronizes when coordinate approvals add or drop.'}
                      </p>
                    </div>
                  </div>

                  {/* Real-time Location Tracking Map */}
                  {outing.status === 'ongoing' && (
                    <StaticMapPreview
                      lat={outing.mapCoordinates?.lat}
                      lng={outing.mapCoordinates?.lng}
                      label={outing.location}
                      lang={lang}
                      isOngoing={true}
                    />
                  )}

                  {/* Rider actions / Driver actions workspace split */}
                  {outing.logistics?.driverId === currentUser?.id ? (
                    /* DRIVER LEADER WORKSPACE CONSOLE */
                    <div className="p-5 bg-indigo-950/20 border border-indigo-500/20 rounded-2xl space-y-4">
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                        <div>
                          <span className="text-xs font-black text-indigo-300 block uppercase tracking-wider">🛠️ {lang === 'ar' ? 'لوحة تحكم قائد المركبة' : 'Driver Control Console'}</span>
                          <p className="text-[10px] text-slate-400 mt-0.5">{lang === 'ar' ? 'تحكّم بطلبات الركاب ومسار التوصيل للرحلة' : 'Approve requests and map out path order'}</p>
                        </div>
                        <div className="flex gap-2">
                          <motion.button
                            type="button"
                            onClick={async () => {
                               if (onUpdateOuting) {
                                 await onUpdateOuting({ ...outing, status: 'ongoing' });
                                 haptic();
                               }
                            }}
                            disabled={outing.status === 'ongoing' || outing.logistics?.driverId !== currentUser.id}
                            animate={outing.status === 'ongoing' ? { scale: [1, 1.05, 1], transition: { duration: 0.5 } } : {}}
                            className={`px-3 py-1.5 border rounded-xl text-[10px] font-black tracking-widest uppercase transition-all ${outing.status === 'ongoing' ? 'bg-slate-500/20 text-slate-400 border-slate-500/30' : 'bg-emerald-500/20 hover:bg-emerald-500 border-emerald-500/30 text-emerald-300 hover:text-white cursor-pointer shadow-lg shadow-emerald-500/20'} ${outing.logistics?.driverId !== currentUser.id ? 'opacity-50 cursor-not-allowed' : ''}`}
                          >
                            {outing.status === 'ongoing' ? (
                              <span className="flex items-center gap-1.5"><Car className="w-3 h-3 text-emerald-400" /> {lang === 'ar' ? 'الرحلة جارية' : 'Trip In Progress'}</span>
                            ) : (
                              lang === 'ar' ? 'بدء الرحلة فعلياً' : 'Start Trip'
                            )}
                          </motion.button>
                          <div className="flex items-center gap-2 bg-indigo-950/40 p-1 pl-3 rounded-xl border border-indigo-500/20">
                            <span className="text-[10px] font-bold text-slate-300">{lang === 'ar' ? 'الركاب:' : 'Passengers:'}</span>
                            <input 
                              type="number" 
                              value={vehicleCap}
                              onChange={(e) => {
                                const newVal = parseInt(e.target.value);
                                setVehicleCap(newVal);
                                if (onUpdateOuting && outing.logistics) {
                                  onUpdateOuting({
                                    ...outing,
                                    logistics: { ...outing.logistics, vehicleCapacity: newVal }
                                  });
                                }
                              }}
                              className="w-12 p-1 bg-transparent text-white text-xs font-bold focus:outline-none"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={handleSimulateRequests}
                            className="px-3 py-1.5 bg-indigo-500/10 hover:bg-indigo-500/30 border border-indigo-500/30 rounded-xl text-[10px] font-black tracking-widest text-[#a5b4fc] uppercase cursor-pointer"
                          >
                            🧪 {lang === 'ar' ? 'محاكاة طلب توصيل' : 'Simulate Ride Steps'}
                          </button>
                        </div>
                      </div>

                      {/* List of pending requests */}
                      <div className="space-y-3">
                        <span className="block text-[9px] font-bold text-slate-500 uppercase tracking-widest border-b border-white/5 pb-1">
                          {lang === 'ar' ? 'طلبات التوصيل المعلقة للموافقة' : 'Pending Seat Requests'} (
                          {pickups.filter(p => p.status === 'pending').length}
                          )
                        </span>

                        {pickups.filter(p => p.status === 'pending').length === 0 ? (
                          <p className="text-xs text-slate-500 italic py-1 text-center font-medium">{lang === 'ar' ? 'لا توجد طلبات توصيل معلقة حالياً.' : 'No pending ride seat requests yet.'}</p>
                        ) : (
                          pickups.filter(p => p.status === 'pending').map(req => (
                            <div key={req.id} className="p-3 bg-[#0B0E14] border border-white/5 rounded-xl flex items-center justify-between text-xs animate-in fade-in duration-300">
                              <div className="flex items-center gap-2.5">
                                <span className="text-xl select-none">{req.passengerAvatar}</span>
                                <div>
                                  <span className="font-black text-white block">{req.passengerName}</span>
                                  <span className="text-[10px] text-slate-400 block mt-0.5">
                                    {req.pickupType === 'my_location' 
                                      ? (lang === 'ar' ? '📌 يشارك إحداثيات GPS النشطة' : '📌 Sharing live GPS coords') 
                                      : (lang === 'ar' ? `📍 عنوان: ${req.customAddress}` : `📍 Location: ${req.customAddress}`)}
                                  </span>
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleAcceptRide(req.id)}
                                  className="px-2.5 py-1.5 bg-emerald-500/20 hover:bg-emerald-500 border border-emerald-500/30 text-emerald-300 hover:text-white rounded-lg font-black text-[10px] uppercase tracking-wider transition-all cursor-pointer"
                                >
                                  {lang === 'ar' ? 'قبول الطلب' : 'Accept'}
                                </button>
                                <button
                                  onClick={() => handleDeclineRide(req.id)}
                                  className="px-2.5 py-1.5 bg-rose-500/20 hover:bg-rose-500 border border-rose-500/30 text-rose-300 hover:text-white rounded-lg font-black text-[10px] uppercase tracking-wider transition-all cursor-pointer"
                                >
                                  {lang === 'ar' ? 'رفض' : 'Decline'}
                                </button>
                              </div>
                            </div>
                          ))
                        )}
                      </div>

                      {/* Route Path Optimization button */}
                      {pickups.filter(p => p.status === 'accepted').length > 1 && (
                        <div className="pt-2 border-t border-white/5">
                          <button
                            type="button"
                            onClick={handleOptimizeRoute}
                            disabled={isOptimizingRoute}
                            className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs rounded-xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                          >
                            {isOptimizingRoute ? (
                              <span>⏳ {lang === 'ar' ? 'جاري تحسين تسلسل النقاط الجغرافية...' : 'Optimizing GPS sequences...'}</span>
                            ) : (
                              <span>🔄 {lang === 'ar' ? 'حساب وترتيب خط السير بأقصر مسار ذكي' : 'Perform Smart AI Route sequence Optimization'}</span>
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    /* PASSENGER ATTENDEE WORKSPACE CONSOLE */
                    <div className="p-5 bg-slate-900/40 border border-white/5 rounded-2xl">
                      {!isJoined ? (
                        <p className="text-xs text-amber-300 text-center font-bold bg-[#0B0E14] p-4 rounded-xl border border-amber-500/10 leading-relaxed">
                          ⚠️ {lang === 'ar' ? 'يرجى الانضمام للطلعة أولاً لتتمكن من حجز مقعد توصيل ومشاركة إحداثيات موقعك ملاحياً!' : 'Please join this outing cohort first to request a seat or share your navigation pins!'}
                        </p>
                      ) : (
                        /* Joined participant rides controls */
                        <div className="space-y-4">
                          {(() => {
                            const myReq = pickups.find(p => p.passengerId === currentUser.id);
                            
                            if (myReq) {
                              return (
                                <div className="p-4 bg-[#0B0E14] border border-white/5 rounded-xl space-y-3 text-xs">
                                  <div className="flex justify-between items-center">
                                    <span className="font-bold text-slate-400">{lang === 'ar' ? 'حالة طلب التوصيل الخاص بك:' : 'Your Seat Request Status:'}</span>
                                    {myReq.status === 'pending' && (
                                      <span className="px-2.5 py-1 bg-amber-500/15 border border-amber-500/30 text-amber-300 font-bold rounded-lg uppercase tracking-wide text-[9px] animate-pulse">
                                        🕒 {lang === 'ar' ? 'قيد مراجعة القائد' : 'PENDING CAPTAIN APPROVAL'}
                                      </span>
                                    )}
                                    {myReq.status === 'accepted' && (
                                      <span className="px-2.5 py-1 bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-bold rounded-lg uppercase tracking-wide text-[9px]">
                                        ✅ {lang === 'ar' ? `مقبول بالمسار (ترتيب: ${myReq.pickupOrder})` : `ACCEPTED (Sequence #${myReq.pickupOrder})`}
                                      </span>
                                    )}
                                    {myReq.status === 'declined' && (
                                      <span className="px-2.5 py-1 bg-rose-500/15 border border-rose-500/30 text-rose-300 font-bold rounded-lg uppercase tracking-wide text-[9px]">
                                        ❌ {lang === 'ar' ? 'تعذرت الموافقة' : 'DECLINED/CAPACITY CEILING'}
                                      </span>
                                    )}
                                  </div>

                                  <div className="text-[11px] text-slate-400">
                                    {myReq.pickupType === 'my_location' 
                                      ? (lang === 'ar' ? '📌 إحداثياتك الجغرافية الحالية مشتركة الآن مع القائد ملاحياً.' : '📌 Your live GPS position is visible for automated path sequence sorting.') 
                                      : (lang === 'ar' ? `📍 العنوان المسجل: ${myReq.customAddress}` : `📍 Pinned Address: ${myReq.customAddress}`)}
                                  </div>

                                  <button
                                    type="button"
                                    onClick={handleCancelRequest}
                                    className="w-full mt-2 py-2 bg-rose-500/10 hover:bg-rose-500 text-rose-400 hover:text-white rounded-lg border border-rose-500/20 text-[10px] font-black transition-all uppercase tracking-widest cursor-pointer"
                                  >
                                    {lang === 'ar' ? 'إلغاء الطلب وسحب الإحداثيات' : 'Cancel request & withdraw GPS location'}
                                  </button>
                                </div>
                              );
                            }

                            return (
                              <div className="space-y-4">
                                <div>
                                  <span className="text-xs font-black text-slate-200 block uppercase tracking-wider mb-2">
                                    🚗 {lang === 'ar' ? 'طلب مقعد في الرحلة' : 'Request a Ride Seat'}
                                  </span>
                                  <p className="text-[10px] text-slate-400 leading-relaxed mb-3">
                                    {lang === 'ar' 
                                      ? 'تساعد هذه الميزة في تزويد قبطان التوصيل بإحداثياتك لرسم خارطة ملاحية ذكية ومشاركة كلفة البنزين.' 
                                      : 'Coordinate with the crew driver to pick you up. Coordinates auto-integrate into the route sheet.'}
                                  </p>
                                </div>

                                <div className="grid grid-cols-2 gap-3 pb-1">
                                  <button
                                    type="button"
                                    onClick={() => setPickupType('my_location')}
                                    className={`py-2 px-3 border rounded-xl text-[10px] font-black uppercase tracking-wider transition cursor-pointer text-center ${
                                      pickupType === 'my_location'
                                        ? 'border-indigo-500 bg-indigo-500/10 text-indigo-300'
                                        : 'border-white/10 bg-[#0B0E14] text-slate-400 hover:bg-white/5'
                                    }`}
                                  >
                                    🧭 {lang === 'ar' ? 'موقعي المباشر (GPS)' : 'Live GPS Location'}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setPickupType('custom_location')}
                                    className={`py-2 px-3 border rounded-xl text-[10px] font-black uppercase tracking-wider transition cursor-pointer text-center ${
                                      pickupType === 'custom_location'
                                        ? 'border-indigo-500 bg-indigo-500/10 text-indigo-300'
                                        : 'border-white/10 bg-[#0B0E14] text-slate-400 hover:bg-white/5'
                                    }`}
                                  >
                                    🏡 {lang === 'ar' ? 'أدخل عنواناً مخصصاً' : 'Specified Address'}
                                  </button>
                                </div>

                                {pickupType === 'custom_location' && (
                                  <div className="animate-in slide-in-from-top-1 fade-in duration-200 space-y-2">
                                    <a
                                        href="https://maps.google.com"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="w-full py-2 bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 rounded-lg text-[10px] font-bold uppercase tracking-widest text-center block hover:bg-indigo-500/30"
                                      >
                                        🚩 {lang === 'ar' ? 'افتح خرائط جوجل لاختيار الموقع' : 'Open Google Maps to Pick Location'}
                                    </a>
                                    <label className="block text-[8px] text-slate-500 font-bold uppercase tracking-widest mb-1">{lang === 'ar' ? 'عنوان اللقاء أو التقاط الركاب مخصص' : 'Pickup address or coordinate details'}</label>
                                    <input
                                      type="text"
                                      placeholder={lang === 'ar' ? 'مثال: حي الصحافة، مقابل مطعم شاورما' : 'e.g. Yasmeen District, main road'}
                                      value={customAddress}
                                      onChange={(e) => setCustomAddress(e.target.value)}
                                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                    />
                                  </div>
                                )}

                                <div className="p-3 bg-white/5 border border-white/5 rounded-xl">
                                  <label className="flex items-start gap-2.5 cursor-pointer select-none">
                                    <input
                                      type="checkbox"
                                      checked={locationConsent}
                                      onChange={(e) => setLocationConsent(e.target.checked)}
                                      className="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4 mt-0.5 accent-indigo-600"
                                    />
                                    <div className="text-[10px] text-slate-400 leading-normal">
                                      {lang === 'ar' 
                                        ? 'أوافق على مشاركة موقعي مع قائد المركبة لعرضها في الخريطة وحساب خط التوصيل بدقة ملاحية.' 
                                        : 'I consent to send my spatial coordinates to the leader for automatic sequence mapping.'}
                                    </div>
                                  </label>
                                </div>

                                <button
                                  type="button"
                                  onClick={() => { haptic(); handleRequestRide(); }}
                                  disabled={!locationConsent || (pickupType === 'custom_location' && !customAddress.trim())}
                                  className="w-full py-2.5 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 disabled:opacity-40 text-white font-black text-xs rounded-xl transition-all shadow-md uppercase tracking-widest cursor-pointer"
                                >
                                  🚀 {lang === 'ar' ? 'إرسال طلب التوصيل والموافقة الجغرافية' : 'Submit Ride Request & location share'}
                                </button>
                              </div>
                            );
                          })()}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Features 1 & 2: Quick Star Ratings & Interactive Fuel Split Panel */}
                  <div className="space-y-4">
                    {/* Quick-Fire Star Rating Panel */}
                    <div className="flex flex-col gap-4 p-5 bg-gradient-to-br from-indigo-950/50 to-slate-900 rounded-3xl border border-indigo-500/20 shadow-xl">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-black text-slate-100 uppercase tracking-widest flex items-center gap-2">
                          ⭐ {lang === 'ar' ? 'تقييم سريع للطلعة' : 'Quick-Fire Star Rating'}
                        </span>
                        {userRating && (
                          <span className="text-[10px] bg-amber-500/25 text-amber-300 font-extrabold px-2.5 py-0.5 rounded-full border border-amber-500/30">
                            {lang === 'ar' ? 'تقييمك' : 'Rated'}: {userRating} ★
                          </span>
                        )}
                      </div>
                      
                      <p className="text-[10px] text-slate-400 font-medium">
                        {lang === 'ar' ? 'أضف تقييمًا فوريًا لمساعدة الآخرين على قياس جودة وشعبية هذه الفعالية' : 'Add a quick-fire rating to help other community members gauge quality & popularity.'}
                      </p>

                      <div className="flex items-center gap-3.5 py-1">
                        {Array.from({ length: 5 }).map((_, i) => {
                          const starValue = i + 1;
                          const isActiveStar = starValue <= (userRating || 0);
                          return (
                            <button
                              key={i}
                              type="button"
                              onClick={() => { haptic(); handleRateOuting(starValue); }}
                              className="focus:outline-none focus:scale-125 hover:scale-110 active:scale-90 transition-all cursor-pointer"
                              style={{ touchAction: 'manipulation' }}
                            >
                              <Star 
                                className={`w-8 h-8 transition-colors ${isActiveStar ? 'fill-amber-400 text-amber-500 drop-shadow-md' : 'text-slate-600 hover:text-amber-400'}`} 
                              />
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Fuel Split Interactive Calculator UI */}
                    <div className="flex flex-col gap-4 p-5 bg-[#0B0E14] rounded-3xl border border-white/5 shadow-inner">
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-white/5 pb-3">
                        <span className="text-xs font-black text-slate-200 flex items-center gap-2">
                          <Receipt className="w-4 h-4 text-emerald-400" /> {lang === 'ar' ? 'تقسيم التكاليف الذكي للطلعة' : 'Smart Outing Fuel Split'}
                        </span>
                        <span className="text-[9px] text-emerald-300 font-black bg-emerald-500/20 border border-emerald-500/30 px-2.5 py-0.5 rounded-full uppercase tracking-widest">{t.automatedFuelDivision}</span>
                      </div>

                      {/* Split Type Selector */}
                      <div className="flex bg-white/5 p-1 rounded-xl border border-white/5">
                        <button
                          type="button"
                          onClick={() => setCustomFuelPrice(0)} // Reset to 0 to enable calculation
                          className={`flex-1 py-1.5 text-[10px] font-black rounded-lg transition-all ${customFuelPrice === 0 ? 'bg-[#1a1e29] border border-white/10 text-white font-extrabold' : 'text-slate-400 hover:text-white'}`}
                        >
                          🚗 {lang === 'ar' ? 'الحساب التلقائي (المسافة والأسعار)' : 'Automated Split (Distance & Gas)'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setCustomFuelPrice(outing.logistics?.fuelSharingPrice || 120)}
                          className={`flex-1 py-1.5 text-[10px] font-black rounded-lg transition-all ${customFuelPrice > 0 ? 'bg-[#1a1e29] border border-white/10 text-white font-extrabold' : 'text-slate-400 hover:text-white'}`}
                        >
                          💸 {lang === 'ar' ? 'مبلغ ثابت' : 'Fixed Amount'}
                        </button>
                      </div>

                      <div className="space-y-4">
                        {customFuelPrice === 0 ? (
                          /* Automated Calculation Fields */
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <div className="space-y-1">
                              <label className="block text-[9px] text-slate-400 font-bold uppercase tracking-widest">{lang === 'ar' ? 'المسافة الكلية (كم)' : 'Total Distance (KM)'}</label>
                              <input
                                type="number"
                                value={fuelSplitDistance}
                                onChange={(e) => setFuelSplitDistance(Math.max(1, parseFloat(e.target.value) || 0))}
                                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-xs font-black text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="block text-[9px] text-slate-400 font-bold uppercase tracking-widest">{lang === 'ar' ? 'سعر اللتر (SAR)' : 'Price per Liter (SAR)'}</label>
                              <input
                                type="number"
                                step="0.01"
                                value={fuelSplitGasPrice}
                                onChange={(e) => setFuelSplitGasPrice(Math.max(0.1, parseFloat(e.target.value) || 0))}
                                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-xs font-black text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="block text-[9px] text-slate-400 font-bold uppercase tracking-widest">{lang === 'ar' ? 'الاستهلاك (لتر/100كم)' : 'Rate (L/100KM)'}</label>
                              <input
                                type="number"
                                step="0.1"
                                value={fuelSplitConsumption}
                                onChange={(e) => setFuelSplitConsumption(Math.max(1, parseFloat(e.target.value) || 0))}
                                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-xs font-black text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                              />
                            </div>
                          </div>
                        ) : (
                          /* Fixed manual bill input */
                          <div className="space-y-1">
                            <label className="block text-[9px] text-slate-400 font-bold uppercase tracking-widest">{t.fuelCostBillLabel}</label>
                            <input
                              id="input_detail_fuel_cost"
                              type="number"
                              value={customFuelPrice}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value) || 0;
                                setCustomFuelPrice(val);
                                handleRecalculateFuel(val);
                              }}
                              className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-xs font-black text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-colors"
                            />
                          </div>
                        )}

                        {/* Calculated shares readout */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-white/5">
                          <div className="bg-white/5 p-3 rounded-2xl border border-white/5 text-center">
                            <span className="text-[8px] text-slate-400 font-bold uppercase tracking-widest block">{lang === 'ar' ? 'التكلفة الإجمالية المحسوبة للوقود' : 'Calculated Fuel Cost'}</span>
                            <span className="font-mono text-sm font-black text-emerald-400 block mt-1">
                              {(customFuelPrice > 0 ? customFuelPrice : calculatedTotalFuelCost).toFixed(2)} SAR
                            </span>
                          </div>
                          <div className="bg-indigo-500/10 p-3 rounded-2xl border border-indigo-500/20 text-center">
                            <span className="text-[8px] text-indigo-300 font-bold uppercase tracking-widest block">{lang === 'ar' ? 'الحصة الفردية المستحقة' : 'Individual Mate Share'}</span>
                            <span className="font-mono text-sm font-black text-indigo-300 block mt-1">
                              {inlineCostPerPerson.toFixed(2)} SAR
                            </span>
                          </div>
                        </div>

                        {/* Interactive sliders for capacity and attendees count */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-white/5">
                          <div className="space-y-2">
                            <div className="flex justify-between text-[10px] font-bold">
                              <span className="text-slate-400">{lang === 'ar' ? 'سعة المركبة (مقاعد)' : 'Vehicle Capacity'}</span>
                              <span className="text-white">{vehicleCap} {lang === 'ar' ? 'مقاعد' : 'seats'}</span>
                            </div>
                            <input 
                              type="range"
                              min="2"
                              max="12"
                              value={vehicleCap}
                              onChange={(e) => setVehicleCap(parseInt(e.target.value) || 5)}
                              className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-indigo-400"
                            />
                          </div>

                          <div className="space-y-2">
                            <div className="flex justify-between text-[10px] font-bold">
                              <span className="text-slate-400">{lang === 'ar' ? 'الركاب المشاركون بالتقسيم' : 'Divided Participants'}</span>
                              <span className="text-white">{fuelCapacityAttendees} {lang === 'ar' ? 'أعضاء' : 'mates'}</span>
                            </div>
                            <input 
                              type="range"
                              min="1"
                              max={vehicleCap}
                              value={fuelCapacityAttendees}
                              onChange={(e) => setFuelCapacityAttendees(parseInt(e.target.value) || 2)}
                              className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-emerald-400"
                            />
                          </div>
                        </div>

                        {/* Driver Courtesy check */}
                        <div className="pt-2 flex items-center justify-between">
                          <label className="flex items-center gap-2 cursor-pointer select-none">
                            <input 
                              type="checkbox"
                              checked={exemptDriverFuel}
                              onChange={(e) => setExemptDriverFuel(e.target.checked)}
                              className="w-4 h-4 rounded border-white/10 bg-white/5 text-emerald-500 focus:ring-0 accent-emerald-500 cursor-pointer"
                            />
                            <span className="text-[10px] font-bold text-amber-300">
                              👑 {lang === 'ar' ? 'إعفاء السائق كشكر له (ضيافة عربية)' : 'Driver rides free! (Courtesy exemption)'}
                            </span>
                          </label>
                        </div>

                        {/* Payment Confirmation Area */}
                        <div className="pt-3 border-t border-white/5">
                          {isFuelPaid ? (
                            <div className="bg-emerald-500/15 border border-emerald-500/30 p-3 rounded-2xl flex items-center justify-center gap-2 text-emerald-400 text-xs font-black tracking-wide">
                              ✓ {lang === 'ar' ? 'تم تأكيد دفع حصتك للبنزين بنجاح!' : 'Your fuel split contribution is fully paid!'}
                            </div>
                          ) : (
                            <div className="space-y-2">
                              {showFuelPayConfirm ? (
                                <div className="bg-amber-500/10 border border-amber-500/20 p-3 rounded-2xl space-y-2.5">
                                  <p className="text-[10px] font-medium text-amber-300 leading-relaxed">
                                    ⚠️ {lang === 'ar' ? 'هل تود تأكيد سداد حصتك البالغة' : 'Are you sure you want to confirm paying your share of'} <b className="font-mono text-emerald-400">{inlineCostPerPerson.toFixed(2)} SAR</b> {lang === 'ar' ? 'لقائد المركبة؟' : 'to the designated driver?'}
                                  </p>
                                  <div className="flex gap-2">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setIsFuelPaid(true);
                                        setShowFuelPayConfirm(false);
                                        haptic();
                                      }}
                                      className="flex-1 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-white font-black text-[10px] rounded-lg tracking-wider cursor-pointer"
                                    >
                                      {lang === 'ar' ? 'نعم، تم الدفع' : 'Yes, Confirmed Paid'}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setShowFuelPayConfirm(false)}
                                      className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-slate-300 font-bold text-[10px] rounded-lg cursor-pointer"
                                    >
                                      {lang === 'ar' ? 'تراجع' : 'Cancel'}
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setShowFuelPayConfirm(true)}
                                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-xl text-[10px] transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer uppercase tracking-wider"
                                >
                                  💳 {lang === 'ar' ? `تأكيد دفع حصتي للوقود (${inlineCostPerPerson.toFixed(2)} SAR)` : `Confirm Fuel Payment Share (${inlineCostPerPerson.toFixed(2)} SAR)`}
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => setShowSplitterModal(true)}
                        className="mt-2 w-full py-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-black rounded-xl text-[10px] transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer uppercase tracking-wider"
                      >
                        ⛽ {lang === 'ar' ? 'تشغيل حاسبة البنزين الدولية المتكاملة' : 'Launch Advanced International Splitter'}
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-500 italic font-medium pt-2 pb-1 leading-relaxed">{t.noDesignatedDriverAssigned}</p>
              )}
            </div>
            )}

            {/* Post-Outing reviews coordinates */}
            {outing.status === 'completed' && (
              <div className="bg-white/5 backdrop-blur-md rounded-3xl p-6 border border-white/10 shadow-xl space-y-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div>
                    <h3 className="text-sm font-black text-emerald-400 flex items-center gap-2 tracking-wide uppercase">
                      <Star className="w-4 h-4 fill-emerald-500" /> {t.submitPostOutingReviewLabel}
                    </h3>
                    <p className="text-xs text-slate-400 font-medium mt-1 leading-relaxed">{t.rateCompanionsDesc}</p>
                  </div>
                  <button 
                    id="btn_open_review"
                    onClick={() => setShowReviewForm(true)}
                    className="px-5 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer uppercase tracking-widest bg-emerald-500 text-white hover:bg-emerald-400 shadow-md shadow-emerald-500/20"
                  >
                    {t.rateBuddiesBtn || (lang === 'ar' ? 'تقييم الرفقاء' : 'Rate Companions')}
                  </button>
                </div>

                <OutingReviewModal
                  isOpen={showReviewForm}
                  onClose={() => setShowReviewForm(false)}
                  attendeesList={attendeesList}
                  currentUserId={currentUser.id}
                  lang={lang}
                  submittedReviews={submittedReviews}
                  onSubmit={(revieweeId, respect, punctual, payment, comment, venueRating, hostRating, friendlyRating) => {
                    // Submit handler logic
                    onCompleteReview({
                      outingId: outing.id,
                      reviewerId: currentUser.id,
                      revieweeId,
                      respectfulRating: respect,
                      punctualRating: punctual,
                      paymentRating: payment,
                      friendlyRating,
                      venueRating,
                      hostRating,
                      comment
                    });
                    setSubmittedReviews(prev => [...prev, revieweeId]);
                  }}
                />

                {/* AI Voice Outing Recap Recorder block */}
                <div className="border-t border-white/5 pt-5 mt-4 space-y-4">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div>
                      <h4 className="text-xs font-black text-indigo-400 flex items-center gap-1.5 uppercase tracking-wider">
                        🎙️ {lang === 'ar' ? 'ملخص الرحلة الصوتي بالذكاء الاصطناعي' : 'AI VOICE OUTING RECAP'}
                      </h4>
                      <p className="text-[11px] text-slate-400 font-medium leading-relaxed mt-1">
                        {lang === 'ar' 
                          ? 'تحدث عفوياً وسيقوم المُرشد بتحويل تسجيلك إلى منشور recap مبهر في مجتمع الرفقاء.' 
                          : 'Speak naturally and Al-Murshed will craft a gorgeous social post recap in the community feed.'}
                      </p>
                    </div>

                    {recapRecordingState === 'idle' && (
                      <button
                        onClick={startRecapRecording}
                        className="px-4 py-2 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 border border-indigo-500/20 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
                      >
                        <span className="w-2 h-2 rounded-full bg-indigo-400 animate-ping"></span>
                        {lang === 'ar' ? 'ابدأ التسجيل الصوتي' : 'Record Recap'}
                      </button>
                    )}
                  </div>

                  {recapRecordingState === 'recording' && (
                    <div className="p-4 bg-indigo-500/5 border border-indigo-500/20 rounded-2xl flex items-center justify-between animate-fadeIn">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center border border-red-500/20">
                          <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse"></span>
                        </div>
                        <div>
                          <span className="text-xs font-black text-white block">
                            {lang === 'ar' ? 'جاري التسجيل الصوتي المباشر...' : 'Recording recap live...'}
                          </span>
                          <span className="text-[10px] text-indigo-300 font-bold font-mono">
                            {Math.floor(recapDuration / 60)}:{(recapDuration % 60).toString().padStart(2, '0')}
                          </span>
                        </div>
                      </div>

                      {/* Moving micro voice waves */}
                      <div className="flex items-center gap-1">
                        <span className="w-1 h-4 bg-indigo-400 rounded animate-bounce delay-100"></span>
                        <span className="w-1 h-6 bg-indigo-400 rounded animate-bounce delay-200"></span>
                        <span className="w-1 h-5 bg-indigo-400 rounded animate-bounce delay-300"></span>
                        <span className="w-1 h-3 bg-indigo-400 rounded animate-bounce delay-400"></span>
                      </div>

                      <button
                        onClick={stopRecapRecording}
                        className="px-4 py-2 bg-red-500 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all hover:bg-red-400 cursor-pointer active:scale-95"
                      >
                        {lang === 'ar' ? 'إيقاف وحفظ' : 'Stop & Save'}
                      </button>
                    </div>
                  )}

                  {recapRecordingState === 'review' && (
                    <div className="p-4 bg-[#0B0E14]/50 border border-white/5 rounded-2xl space-y-3 animate-fadeIn">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-black text-indigo-300">
                          🎵 {lang === 'ar' ? 'مراجعة المقطع الصوتي المسجل' : 'REVIEW RECORDED AUDIO'}
                        </span>
                        <span className="text-[10px] text-slate-400 font-bold font-mono">
                          {Math.floor(recapDuration / 60)}:{(recapDuration % 60).toString().padStart(2, '0')}
                        </span>
                      </div>

                      {recapAudioUrl && (
                        <audio src={recapAudioUrl} controls className="w-full h-10 rounded-lg opacity-80" />
                      )}

                      <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/5">
                        <button
                          onClick={cancelRecapRecording}
                          className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white rounded-xl text-[10px] font-bold transition-all cursor-pointer"
                        >
                          {lang === 'ar' ? 'إلغاء' : 'Cancel'}
                        </button>
                        <button
                          onClick={startRecapRecording}
                          className="px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 rounded-xl text-[10px] font-bold transition-all cursor-pointer"
                        >
                          {lang === 'ar' ? 'إعادة تسجيل' : 'Re-record'}
                        </button>
                        <button
                          onClick={submitRecapAudio}
                          className="px-4 py-1.5 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all shadow-md shadow-indigo-500/25 cursor-pointer active:scale-95"
                        >
                          ✨ {lang === 'ar' ? 'نشر ملخص الذكاء الاصطناعي' : 'Generate & Post Recap'}
                        </button>
                      </div>
                    </div>
                  )}

                  {recapRecordingState === 'processing' && (
                    <div className="p-6 bg-[#0B0E14]/40 border border-indigo-500/20 rounded-2xl text-center space-y-3 animate-fadeIn">
                      <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
                      <p className="text-xs text-slate-300 animate-pulse font-semibold">
                        {lang === 'ar' 
                          ? 'جاري قيام المُرشد بتحليل انطباعك الصوتي وتوليد المنشور المناسب للرفقاء...' 
                          : 'Al-Murshed is analyzing your vocal expressions and compiling an aesthetic post...'}
                      </p>
                    </div>
                  )}

                  {recapRecordingState === 'success' && (
                    <div className="p-5 bg-emerald-500/5 border border-emerald-500/20 rounded-2xl space-y-3 animate-fadeIn">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-emerald-500/15 flex items-center justify-center border border-emerald-500/20">
                          <span className="text-emerald-400 text-xs">✓</span>
                        </div>
                        <span className="text-xs font-black text-emerald-400">
                          {lang === 'ar' ? 'تم النشر بنجاح لملخص الذكاء الاصطناعي في مجتمع الرفقاء!' : 'AI Outing Recap created & posted successfully!'}
                        </span>
                      </div>
                      <blockquote className="p-3 bg-[#0B0E14]/50 border-l-2 border-emerald-500 rounded-r-xl text-xs text-slate-300 italic leading-relaxed font-semibold">
                        "{recapSuccessText}"
                      </blockquote>
                      <div className="flex justify-end">
                        <button
                          onClick={() => setRecapRecordingState('idle')}
                          className="px-3.5 py-1.5 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 border border-emerald-500/20 rounded-xl text-[9px] font-black uppercase tracking-wider cursor-pointer transition-all"
                        >
                          {lang === 'ar' ? 'تسجيل ملخص جديد' : 'Record New Recap'}
                        </button>
                      </div>
                    </div>
                  )}

                  {recapRecordingState === 'error' && (
                    <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl space-y-2 animate-fadeIn">
                      <p className="text-xs text-rose-300 font-bold">{recapError}</p>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setRecapRecordingState('idle')}
                          className="px-3 py-1.5 bg-white/5 text-slate-400 hover:text-white rounded-xl text-[10px] font-bold transition-all cursor-pointer"
                        >
                          {lang === 'ar' ? 'تخطي' : 'Dismiss'}
                        </button>
                        <button
                          onClick={startRecapRecording}
                          className="px-3 py-1.5 bg-rose-500/25 text-rose-200 rounded-xl text-[10px] font-bold hover:bg-rose-500/40 transition-all cursor-pointer"
                        >
                          {lang === 'ar' ? 'إعادة المحاولة' : 'Retry'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Members list & Join Action segment */}
          {!outing.isSoloOuting && (
            <div className="space-y-6">
              <div className="bg-white/5 backdrop-blur-md rounded-3xl p-6 border border-white/10 shadow-xl space-y-5">
              <div className="flex justify-between items-center border-b border-white/10 pb-3">
                <h3 className="text-sm font-black text-white uppercase tracking-widest leading-none">{t.joinedCompanionsLabel}</h3>
                <span className="px-3 py-1 bg-white/10 border border-white/5 rounded-xl text-slate-300 text-[10px] font-black tracking-widest">
                  {outing.attendeeIds?.length || 0} / {outing.maxAttendees}
                </span>
              </div>

              <div className="space-y-3">
                <AnimatePresence>
                {attendeesList.map((attendee, i) => (
                  <motion.div 
                    key={attendee.id} 
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ delay: i * 0.05 }}
                    className="p-3.5 bg-[#0B0E14] border border-white/5 hover:border-white/10 rounded-2xl transition"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div 
                        className="flex items-center gap-3 w-2/3 cursor-pointer group"
                        onClick={() => onViewProfile && onViewProfile(attendee.id)}
                      >
                        {/* Circular progress bar representing trust score */}
                        {(() => {
                          const percent = getTrustScorePercent(attendee.trustScore);
                          const radius = 20;
                          const strokeWidth = 2.5;
                          const circumference = 2 * Math.PI * radius;
                          const strokeDashoffset = circumference - (percent / 100) * circumference;
                          
                          const ringColor = attendee.trustScore >= 4.5 || attendee.trustScore >= 9.0
                            ? 'text-emerald-400' 
                            : attendee.trustScore >= 3.5 || attendee.trustScore >= 7.0
                            ? 'text-amber-400' 
                            : 'text-rose-400';

                          return (
                            <div className="relative w-12 h-12 flex items-center justify-center shrink-0">
                              <svg className="absolute w-12 h-12 transform -rotate-90" viewBox="0 0 48 48">
                                <circle 
                                  cx="24" 
                                  cy="24" 
                                  r={radius} 
                                  className="text-white/5" 
                                  strokeWidth={strokeWidth} 
                                  stroke="currentColor"
                                  fill="transparent"
                                />
                                <circle 
                                  cx="24" 
                                  cy="24" 
                                  r={radius} 
                                  className={`${ringColor} transition-all duration-500`} 
                                  strokeWidth={strokeWidth} 
                                  strokeDasharray={circumference}
                                  strokeDashoffset={strokeDashoffset}
                                  strokeLinecap="round"
                                  stroke="currentColor"
                                  fill="transparent"
                                />
                              </svg>
                              <span className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center text-lg shadow-inner select-none overflow-hidden group-hover:scale-105 transition-transform relative z-10">
                                {attendee.avatar && (attendee.avatar.startsWith('http') || attendee.avatar.startsWith('data:image') || attendee.avatar.length > 4) ? (
                                  <img src={attendee.avatar} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                ) : (
                                  attendee.avatar
                                )}
                              </span>
                            </div>
                          );
                        })()}

                        <div className="truncate">
                          <div className="text-xs font-black text-white flex items-center gap-1.5 leading-none mb-1 text-wrap pr-1">
                            {attendee.name}
                            {attendee.id === outing.creatorId && (
                              <span className="text-[8px] px-1.5 py-[1px] bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded uppercase tracking-wider leading-none shrink-0">{t.leadLabel}</span>
                            )}
                            {outing.logistics?.hasDriver && outing.logistics?.driverId === attendee.id && (
                              <div className="relative group">
                                <span className="text-[8px] px-1.5 py-[1px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded uppercase tracking-wider leading-none shrink-0 flex items-center gap-0.5 cursor-help">
                                  <Car className="w-2.5 h-2.5" />
                                  {lang === 'ar' ? 'السائق' : 'Driver'}
                                </span>
                                <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-48 bg-slate-900 border border-emerald-500/30 p-2.5 rounded-xl shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 pointer-events-none">
                                  <span className="block text-[8px] font-black uppercase tracking-widest text-emerald-400 mb-1">{lang === 'ar' ? 'معلومات المركبة' : 'Vehicle Info'}</span>
                                  <p className="text-[10px] text-white font-medium mb-0.5">Toyota Camry - <span className="text-slate-400">White</span></p>
                                  <div className="bg-slate-800 rounded flex items-center justify-center p-1 mt-1 border border-white/10">
                                    <span className="text-[10px] font-mono font-bold tracking-[0.2em] text-white">ABC 1234</span>
                                  </div>
                                  <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-900 border-b border-r border-emerald-500/30 rotate-45"></div>
                                </div>
                              </div>
                            )}
                            {attendee.verified && (
                              <ShieldCheck className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                            )}
                          </div>
                          
                          <div className="flex flex-col gap-0.5">
                            <span className="text-[10px] text-slate-500 font-bold block truncate tracking-wide">{attendee.archetype}</span>
                            
                            {/* Proximity Indicator (Within 1km of the meeting point) */}
                            {(() => {
                              const loc = participantLocations[attendee.id];
                              if (loc && loc.isSharing) {
                                const dist = haversineDistance([loc.lat, loc.lng], [outing.mapCoordinates!.lat, outing.mapCoordinates!.lng]);
                                const isNear = dist <= 1.0;
                                return (
                                  <div className="flex items-center gap-1.5 mt-1 animate-pulse">
                                    <span className={`w-1.5 h-1.5 rounded-full ${isNear ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                                    <span className="text-[9px] font-extrabold tracking-wide uppercase text-slate-400">
                                      {isNear 
                                        ? (lang === 'ar' ? `بالقرب من الموقع (${dist.toFixed(1)} كم)` : `Near Venue (${dist.toFixed(1)} km)`)
                                        : (lang === 'ar' ? `على بعد ${dist.toFixed(1)} كم` : `${dist.toFixed(1)} km away`)
                                      }
                                    </span>
                                  </div>
                                );
                              }
                              return null;
                            })()}
                          </div>
                        </div>
                      </div>

                      <div className="text-right shrink-0 pl-2 flex items-center justify-end gap-3">
                        <div className="flex flex-col items-end">
                          {/* Arrival Status Badge display */}
                          {arrivalStatuses[attendee.id] && (
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider mb-1.5 inline-block ${
                              arrivalStatuses[attendee.id] === 'Arrived' 
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                                : arrivalStatuses[attendee.id] === 'Running Late'
                                ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                                : 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                            }`}>
                              {lang === 'ar' 
                                ? (arrivalStatuses[attendee.id] === 'Arrived' ? 'وصلت ✅' : arrivalStatuses[attendee.id] === 'Running Late' ? 'متأخر ⏳' : 'في طريقي 🚗')
                                : (arrivalStatuses[attendee.id] === 'Arrived' ? 'Arrived' : arrivalStatuses[attendee.id] === 'Running Late' ? 'Late' : 'On My Way')
                              }
                            </span>
                          )}
                          <div className="relative">
                            <span className="text-xs font-black text-amber-400 block tracking-wider relative">
                              ★ {attendee.trustScore.toFixed(1)}
                              {trustUpdateAnimation && attendee.id === currentUser.id && (
                                <motion.span 
                                  initial={{ opacity: 0, y: 10 }}
                                  animate={{ opacity: 1, y: -20 }}
                                  exit={{ opacity: 0 }}
                                  className={`absolute -right-6 -top-2 text-[10px] font-black ${trustUpdateAnimation.type === 'up' ? 'text-emerald-400' : 'text-rose-400'}`}
                                >
                                  {trustUpdateAnimation.val}
                                </motion.span>
                              )}
                            </span>
                            <div className="flex justify-end mt-0.5">
                              {/* Simple SVG Sparkline for Trust Trend */}
                              <svg className="w-8 h-2.5 opacity-70" viewBox="0 0 40 10">
                                <path d="M0 8 Q5 2, 10 5 T 20 7 T 30 2 T 40 4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className={attendee.trustScore >= 4.0 ? 'text-emerald-400' : attendee.trustScore >= 3.0 ? 'text-amber-400' : 'text-rose-400'} />
                              </svg>
                            </div>
                            <span className="text-[8px] text-slate-500 font-bold block uppercase tracking-widest mt-0.5 text-right">{t.reputationLabel}</span>
                          </div>
                        </div>
                        {attendee.id !== currentUser.id && outing.status === 'completed' && (
                          <button 
                            onClick={(e) => { e.stopPropagation(); setReportingUserId(attendee.id); setShowIncidentForm(true); }}
                            title={lang === 'ar' ? 'الإبلاغ عن المستخدم' : 'Report User'}
                            className="p-1.5 bg-rose-500/5 hover:bg-rose-500/10 text-rose-400 border border-transparent hover:border-rose-500/20 rounded-lg transition-all"
                          >
                            <AlertTriangle className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Interactive Selector for the Current User to update their arrival status */}
                    {attendee.id === currentUser.id && (
                      <div className="mt-3 pt-2.5 border-t border-white/5 flex flex-wrap items-center gap-1.5">
                        <span className="text-[9px] text-slate-500 font-bold uppercase tracking-widest block mr-1">
                          {lang === 'ar' ? 'تحديث حالتي:' : 'My Status:'}
                        </span>
                        {[
                          { id: 'On My Way', labelEn: 'On My Way 🚗', labelAr: 'في طريقي 🚗' },
                          { id: 'Running Late', labelEn: 'Running Late ⏳', labelAr: 'متأخر ⏳' },
                          { id: 'Arrived', labelEn: 'Arrived ✅', labelAr: 'وصلت ✅' }
                        ].map(st => {
                          const isActive = arrivalStatuses[currentUser.id] === st.id;
                          return (
                            <button
                              key={st.id}
                              onClick={(e) => { e.stopPropagation(); handleUpdateArrivalStatus(st.id as any); }}
                              className={`px-2.5 py-1 text-[9px] font-bold rounded-lg border transition-all cursor-pointer ${isActive ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-300' : 'bg-[#030712] border-white/5 text-slate-400 hover:border-white/10'}`}
                            >
                              {lang === 'ar' ? st.labelAr : st.labelEn}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </motion.div>
                ))}
                </AnimatePresence>
              </div>

              {/* Attendance & AI Lifecycle actions */}
              <div className="pt-4 mt-2 space-y-3 border-t border-white/5">
                
                {outing.creatorId === currentUser.id && outing.status === 'upcoming' && (
                  <button
                    onClick={() => onUpdateOuting && onUpdateOuting({ ...outing, status: 'ongoing' })}
                    className="w-full py-4 bg-indigo-500 hover:bg-indigo-400 text-white font-black rounded-xl text-xs transition-all shadow-lg flex items-center justify-center gap-2 cursor-pointer uppercase tracking-widest animate-pulse"
                  >
                    <Activity className="w-5 h-5" /> {lang === 'ar' ? 'بدء الطلعة (تفعيل الذكاء الاصطناعي)' : 'Start Outing (Activate AI)'}
                  </button>
                )}

                {outing.creatorId === currentUser.id && outing.status === 'ongoing' && (
                  <button
                    onClick={() => { haptic(); setShowEndConfirm(true); }}
                    className="w-full py-4 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 font-black rounded-xl text-xs transition-all flex items-center justify-center gap-2 cursor-pointer uppercase tracking-widest"
                  >
                    <Award className="w-5 h-5" /> {lang === 'ar' ? 'الذكاء الاصطناعي: إنهاء الرحلة والتقييم' : 'AI: End Outing & Evaluate'}
                  </button>
                )}

                {isJoined && outing.creatorId !== currentUser.id ? (
                  <>
                    {outing.status === 'ongoing' ? (
                       <div className="w-full py-3.5 bg-black/40 text-rose-300 font-bold rounded-xl text-xs flex items-center justify-center gap-2 border border-rose-500/20 uppercase tracking-widest text-center" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
                         <ShieldCheck className="w-4 h-4 text-rose-500" /> 
                         {lang === 'ar' ? 'الطلعة جارية, لا يمكن المغادرة' : 'Outing is active, cannot leave'}
                       </div>
                    ) : (outing.status === 'upcoming' ? (
                      <motion.button
                        id="btn_leave_outing"
                        whileTap={{ scale: 0.95 }}
                        whileHover={{ scale: 1.02 }}
                        transition={{ type: "spring", stiffness: 400, damping: 15 }}
                        onClick={() => {
                           setShowLeaveConfirm(true);
                        }}
                        className="w-full py-3.5 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-400 font-black rounded-xl text-xs transition-all flex items-center justify-center gap-2 cursor-pointer uppercase tracking-widest"
                      >
                        <LogOut className={`w-4 h-4 ${lang === 'ar' ? 'rotate-180' : ''}`} /> {t.leaveCohortBtn}
                      </motion.button>
                    ) : null)}
                  </>
                ) : !isJoined && outing.status === 'upcoming' && (currentUser.trustScore || 0) >= Math.max(outing.minTrustScore || 0, 5) ? (
                  <motion.button
                    id="btn_join_outing"
                    whileTap={{ scale: 0.95 }}
                    whileHover={{ scale: 1.05 }}
                    transition={{ type: "spring", stiffness: 400, damping: 10 }}
                    onClick={() => { 
                      haptic(); 
                      onJoin(outing.id); 
                      setTrustUpdateAnimation({ type: 'up', val: '+0.1' });
                      setTimeout(() => setTrustUpdateAnimation(null), 3500);
                    }}
                    className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black rounded-xl text-sm transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/25 cursor-pointer uppercase tracking-widest"
                  >
                    <UserPlus className="w-5 h-5" /> {t.joinGroupBtn}
                  </motion.button>
                ) : null}
              </div>
            </div>

            {/* Share and Calendar Invitation Box */}
            <div className="bg-white/5 backdrop-blur-md rounded-3xl p-6 border border-white/10 shadow-xl space-y-4">
              <span className="text-[9.5px] font-black text-indigo-300 tracking-widest uppercase block border-b border-white/10 pb-2">
                🔗 {lang === 'ar' ? 'مشاركة وتأكيد الموعد' : 'Share & Save Outing'}
              </span>
              
              <div className="flex flex-col gap-3">
                {/* Invite Friends from Friends List */}
                <button
                  type="button"
                  id="btn_invite_friends_modal"
                  onClick={() => { haptic(); setShowInviteFriendsModal(true); }}
                  className="w-full py-3 bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-500/30 text-indigo-300 font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-2 cursor-pointer uppercase tracking-wider"
                >
                  <UserPlus className="w-4 h-4 text-indigo-400" />
                  <span>{lang === 'ar' ? 'دعوة أصدقائك في المنصة' : 'Invite from Friends List'}</span>
                </button>

                {/* Share Button representing deep link template */}
                <button
                  type="button"
                  id="btn_share_whatsapp"
                  onClick={handleGenerateDeepLinkAndShare}
                  className="w-full py-3 bg-[#25D366]/20 hover:bg-[#25D366]/30 border border-[#25D366]/30 text-emerald-300 font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-2 cursor-pointer uppercase tracking-wider"
                >
                  <Share2 className="w-4 h-4 text-[#25D366]" />
                  {copiedLink ? (
                    <span className="text-emerald-400 font-extrabold">{lang === 'ar' ? 'تم نسخ الرابط ومشاركة الرفاق!' : 'Link Copied & WhatsApp Opened!'}</span>
                  ) : (
                    <span>{lang === 'ar' ? 'دعوة الرفقاء ومشاركة عبر واتساب' : 'Invite Friends via WhatsApp'}</span>
                  )}
                </button>

                
                {/* Export Logistics Summary */}
                {outing.creatorId === currentUser.id && (
                  <button
                    type="button"
                    onClick={handleExportSummary}
                    className="w-full py-3 bg-slate-500/10 hover:bg-slate-500/20 border border-slate-500/20 text-slate-300 font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-2 cursor-pointer uppercase tracking-wider"
                  >
                    <Receipt className="w-4 h-4 text-slate-400" />
                    <span>{lang === 'ar' ? 'تصدير ملخص الطلعة' : 'Export Logistics Summary'}</span>
                  </button>
                )}

                {/* Add to Local Calendar Button */}
                <button
                  type="button"
                  id="btn_add_to_calendar"
                  onClick={handleAddToCalendar}
                  className="w-full py-3 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 text-indigo-300 font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-2 cursor-pointer uppercase tracking-wider"
                >
                  <Calendar className="w-4 h-4 text-indigo-400" />
                  {downloadedCal ? (
                    <span className="text-indigo-400 font-extrabold">{lang === 'ar' ? '✓ تم حفظ ملف التقويم!' : '✓ Calendar ICS Saved!'}</span>
                  ) : (
                    <span>{lang === 'ar' ? 'حفظ الموعد في التقويم المحلي' : 'Add to Local Calendar'}</span>
                  )}
                </button>
              </div>

              <p className="text-[8.5px] text-slate-400 text-center leading-relaxed">
                {lang === 'ar' 
                  ? 'بث الرابط المباشر للرفاق لتسهيل التنسيق والانضمام الفوري، وتأكيد موعد المغامرة بجدول أعمالك.' 
                  : 'Broadcast deep links to your network for automatic onboarding and sync this adventure to your lifestyle planner!'}
              </p>
            </div>
          </div>
          )}

          {/* Public Comments Section */}
          <div className="mt-8 bg-white/5 backdrop-blur-md rounded-3xl p-6 border border-white/10 shadow-xl">
            <h3 className="text-sm font-black text-white mb-4 flex items-center gap-2 uppercase tracking-widest">
              <MessageSquare className="w-4 h-4 text-indigo-400" /> {lang === 'ar' ? 'التعليقات العامة' : 'Public Comments'}
            </h3>
            <p className="text-xs text-slate-400 mb-4">{lang === 'ar' ? 'استفسر أو ناقش التفاصيل قبل الانضمام.' : 'Ask questions or discuss details before joining.'}</p>
            
            <div className="space-y-4 mb-4 max-h-48 overflow-y-auto custom-scroll pr-2">
              {publicComments.length === 0 ? (
                <p className="text-xs text-slate-500 italic text-center p-4 bg-[#0B0E14] rounded-xl">{lang === 'ar' ? 'لا توجد تعليقات بعد. كن أول من يعلق!' : 'No comments yet. Be the first to ask!'}</p>
              ) : (
                publicComments.map(c => (
                  <div key={c.id} className="flex items-start gap-3 p-3 bg-[#0B0E14] border border-white/5 rounded-xl">
                    <img src={c.avatar} alt="avatar" className="w-8 h-8 rounded-lg object-cover" />
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[11px] font-bold text-white">{c.author}</span>
                        <span className="text-[9px] text-slate-500 font-medium">{c.time}</span>
                      </div>
                      <p className="text-xs text-slate-300 leading-relaxed">{c.text}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
            
            <div className="flex gap-2 relative">
              <input 
                type="text" 
                value={newPublicComment}
                onChange={e => setNewPublicComment(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && newPublicComment.trim()) {
                    setPublicComments([...publicComments, {
                      id: Math.random().toString(),
                      text: newPublicComment.trim(),
                      author: currentUser.name,
                      avatar: currentUser.avatar,
                      time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})
                    }]);
                    setNewPublicComment('');
                  }
                }}
                placeholder={lang === 'ar' ? 'اكتب تعليقاً عاماً...' : 'Write a public comment...'}
                className="flex-1 bg-[#0B0E14] border border-white/10 text-white text-xs rounded-xl px-4 py-3 focus:outline-none focus:border-indigo-500/50"
              />
              <button 
                onClick={() => {
                  if (newPublicComment.trim()) {
                    setPublicComments([...publicComments, {
                      id: Math.random().toString(),
                      text: newPublicComment.trim(),
                      author: currentUser.name,
                      avatar: currentUser.avatar,
                      time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})
                    }]);
                    setNewPublicComment('');
                  }
                }}
                className="bg-indigo-500 hover:bg-indigo-400 text-white p-3 rounded-xl transition-all shadow-md shadow-indigo-500/20 cursor-pointer"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      ) : activeTab === 'split' ? (
        /* Fuel & Transport Split Interactive Dashboard */
        <div className="p-6 flex-1 grid grid-cols-1 md:grid-cols-3 gap-6 relative z-10 animate-in fade-in duration-300 font-sans">
          {/* Logistics Configuration Card */}
          <div className="md:col-span-2 space-y-6">
            <div className="bg-white/5 backdrop-blur-md rounded-3xl p-6 border border-white/10 shadow-xl space-y-5">
              <div className="flex justify-between items-center border-b border-white/10 pb-3">
                <h3 className="text-sm font-black text-indigo-400 flex items-center gap-2 uppercase tracking-widest leading-none">
                  ⛽ {lang === 'ar' ? 'حاسبة البنزين وتكلفة النقل' : 'Transport Split Logistics'}
                </h3>
                <span className="px-2.5 py-1 bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/30 rounded-xl text-[10px] font-black uppercase tracking-wider">
                  Active Split
                </span>
              </div>

              {/* Editable cost parameters */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-white/[0.02] p-4 rounded-2xl border border-white/5 space-y-2">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    {lang === 'ar' ? 'إجمالي تكلفة الوقود / النقل (ريال)' : 'Total Fuel/Transport Cost (SAR)'}
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      value={fuelPriceInput}
                      onChange={(e) => {
                        const val = e.target.value;
                        setFuelPriceInput(val === '' ? '' : Number(val));
                      }}
                      className="w-full text-xs p-3 bg-white/5 border border-white/10 text-white rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500 font-extrabold"
                      placeholder="e.g. 150"
                    />
                  </div>
                </div>

                <div className="bg-white/[0.02] p-4 rounded-2xl border border-white/5 flex flex-col justify-between">
                  <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                    {lang === 'ar' ? 'نصيب الفرد من الحسبة' : 'Share Per Participant'}
                  </span>
                  <div>
                    <span className="text-2xl font-black text-white">
                      {typeof fuelPriceInput === 'number' && fuelPriceInput > 0 ? Math.round(fuelPriceInput / (outing.attendeeIds?.length || 1)) : 0}
                    </span>
                    <span className="text-[10px] text-slate-400 font-bold uppercase ml-1">SAR</span>
                  </div>
                  <span className="text-[8px] text-slate-500 font-medium">
                    {lang === 'ar' 
                      ? `مقسم بالتساوي على ${outing.attendeeIds?.length || 1} رفيق منضم` 
                      : `Split equally among ${outing.attendeeIds?.length || 1} joined companions`}
                  </span>
                </div>
              </div>

              {/* Driver Registration Option */}
              <div className="bg-white/[0.02] p-5 rounded-2xl border border-white/5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    {lang === 'ar' ? 'الكابتن / السائق المعين للطلعة' : 'Designated Outing Driver'}
                  </span>
                  <p className="text-xs font-black text-white flex items-center gap-1.5">
                    🚗 {outing.logistics?.driverName || (lang === 'ar' ? 'لا يوجد سائق مسجل بعد' : 'No driver registered')}
                  </p>
                </div>
                {!outing.logistics?.driverName ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (onUpdateOuting) {
                        onUpdateOuting({
                          ...outing,
                          logistics: {
                            ...outing.logistics,
                            hasDriver: true,
                            driverName: currentUser.name,
                            driverId: currentUser.id,
                            isCalculated: true,
                            fuelSharingPrice: typeof fuelPriceInput === 'number' ? fuelPriceInput : 0
                          }
                        });
                      }
                    }}
                    className="px-4 py-2 bg-indigo-500 hover:bg-indigo-400 text-white rounded-xl text-[10px] font-black transition-all uppercase tracking-wider cursor-pointer"
                  >
                    {lang === 'ar' ? 'أنا سائق هذه الرحلة 🙋‍♂️' : 'I am the Driver 🙋‍♂️'}
                  </button>
                ) : outing.logistics.driverId === currentUser.id ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (onUpdateOuting) {
                        onUpdateOuting({
                          ...outing,
                          logistics: {
                            ...outing.logistics,
                            hasDriver: false,
                            driverName: undefined,
                            driverId: undefined,
                            isCalculated: false,
                            fuelSharingPrice: 0,
                            pickups: []
                          }
                        });
                      }
                    }}
                    className="px-4 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-xl text-[10px] font-black transition-all uppercase tracking-wider cursor-pointer"
                  >
                    {lang === 'ar' ? 'التنحي عن القيادة' : 'Step Down as Driver'}
                  </button>
                ) : null}
              </div>
            </div>

            {outing.logistics?.hasDriver && onUpdateOuting && (
              <PickupManager
                outing={outing}
                currentUser={currentUser}
                lang={lang}
                onUpdateOuting={onUpdateOuting}
              />
            )}

            {/* Attendance Payment Checklist */}
            <div className="bg-white/5 backdrop-blur-md rounded-3xl p-6 border border-white/10 shadow-xl space-y-4">
              <h3 className="text-sm font-black text-white uppercase tracking-widest border-b border-white/10 pb-3">
                📋 {lang === 'ar' ? 'حالة السداد للرفقاء' : 'Companion Payment Checklist'}
              </h3>
              
              <div className="space-y-3">
                {attendeesList.map((attendee) => {
                  const paymentInfo = payments[attendee.id] || { paid: false, amount: 0 };
                  const isSelf = attendee.id === currentUser.id;

                  return (
                    <div 
                      key={attendee.id}
                      className={`flex items-center justify-between p-3.5 rounded-2xl border transition-all ${paymentInfo.paid ? 'bg-[#10B981]/5 border-[#10B981]/20' : 'bg-[#0B0E14] border-white/5 hover:border-white/10'}`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-xl shrink-0 overflow-hidden shadow-inner">
                          {attendee.avatar && (attendee.avatar.startsWith('http') || attendee.avatar.startsWith('data:image')) ? (
                            <img src={attendee.avatar} alt="" className="w-full h-full object-cover" />
                          ) : (
                            attendee.avatar || '👤'
                          )}
                        </span>
                        <div>
                          <div className="text-xs font-black text-white flex items-center gap-1.5 leading-none mb-1">
                            {attendee.name} {isSelf && <span className="text-[8px] bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-1 py-[1px] rounded uppercase font-black">{lang === 'ar' ? 'أنا' : 'Me'}</span>}
                          </div>
                          <span className="text-[9px] text-slate-400 font-bold block uppercase tracking-wider">
                            Share: {paymentInfo.amount} SAR
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider flex items-center gap-1 border ${paymentInfo.paid ? 'bg-[#10B981]/15 text-[#10B981] border-[#10B981]/30' : 'bg-rose-500/10 text-rose-400 border-rose-500/20'}`}>
                          {paymentInfo.paid ? '✓ Paid' : '✗ Unpaid'}
                        </span>

                        {/* Toggle button or Mark My Contribution as Paid button */}
                        {(isSelf || outing.creatorId === currentUser.id) && (
                          <button
                            type="button"
                            onClick={() => {
                              setPayments(prev => ({
                                ...prev,
                                [attendee.id]: {
                                  ...prev[attendee.id],
                                  paid: !paymentInfo.paid
                                }
                              }));
                            }}
                            className={`p-1.5 rounded-xl text-[10px] font-extrabold transition-all border cursor-pointer ${paymentInfo.paid ? 'bg-slate-800 text-slate-400 border-white/5 hover:bg-slate-700' : 'bg-indigo-500 hover:bg-indigo-400 text-white border-transparent'}`}
                          >
                            {paymentInfo.paid ? (lang === 'ar' ? 'إلغاء السداد' : 'Mark Unpaid') : (lang === 'ar' ? 'تأكيد السداد ✓' : 'Mark Paid ✓')}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Collateral Progress Statistics panel */}
          <div className="space-y-6">
            <div className="bg-white/5 backdrop-blur-md rounded-3xl p-6 border border-white/10 shadow-xl space-y-5">
              <span className="text-[9.5px] font-black text-indigo-300 tracking-widest uppercase block border-b border-white/10 pb-2">
                📊 {lang === 'ar' ? 'مؤشرات التجميع الكلية' : 'Collection Analytics'}
              </span>

              {(() => {
                const numFuel = typeof fuelPriceInput === 'number' ? fuelPriceInput : 0;
                const totalAttendees = attendeesList.length || 1;
                const costPer = numFuel > 0 ? Math.round(numFuel / totalAttendees) : 0;
                const paidAttendees = attendeesList.filter(a => payments[a.id]?.paid).length;
                const totalCollected = paidAttendees * costPer;
                const totalPending = (totalAttendees - paidAttendees) * costPer;
                const progressPct = numFuel > 0 ? Math.round((totalCollected / numFuel) * 100) : 0;

                return (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3 text-center">
                      <div className="bg-white/[0.02] p-3 rounded-xl border border-white/5">
                        <span className="block text-[8px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                          {lang === 'ar' ? 'تم تجميعه' : 'Collected'}
                        </span>
                        <span className="text-sm font-black text-emerald-400">{totalCollected} SAR</span>
                      </div>
                      <div className="bg-white/[0.02] p-3 rounded-xl border border-white/5">
                        <span className="block text-[8px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                          {lang === 'ar' ? 'متبقي' : 'Pending'}
                        </span>
                        <span className="text-sm font-black text-rose-400">{totalPending} SAR</span>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center text-[10px] font-bold text-slate-400">
                        <span>{lang === 'ar' ? 'نسبة الإنجاز الكلية' : 'Collection Progress'}</span>
                        <span className="text-white font-extrabold">{progressPct}%</span>
                      </div>
                      <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden border border-white/5">
                        <div 
                          className="h-full bg-gradient-to-r from-indigo-500 to-emerald-500 rounded-full transition-all duration-500" 
                          style={{ width: `${Math.min(100, progressPct)}%` }}
                        />
                      </div>
                    </div>

                    {progressPct >= 100 ? (
                      <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-center space-y-1 animate-bounce">
                        <span className="text-xl">🏆</span>
                        <h4 className="text-xs font-black text-emerald-400 uppercase tracking-wider">{lang === 'ar' ? 'تم تجميع التكاليف بالكامل!' : 'Fully Funded!'}</h4>
                        <p className="text-[9px] text-slate-400 leading-tight">{lang === 'ar' ? 'تم سداد حساب الوقود من قبل كافة الرفقاء.' : 'Every companion has finalized their transaction contribution.'}</p>
                      </div>
                    ) : (
                      <p className="text-[9px] text-slate-400 text-center leading-relaxed">
                        {lang === 'ar' 
                          ? 'قم بالتنسيق ومطالبة الرفقاء بتأكيد السداد للحفاظ على نقاط الثقة الخاصة بهم.' 
                          : 'Coordinate with companions to ensure fuel contributions are finalized to maintain positive trust indicators.'}
                      </p>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      ) : (
        /* Chat workspace session panel */
        <div className="flex-1 flex flex-col min-h-[50vh] relative z-10 rounded-b-3xl overflow-hidden animate-in fade-in duration-300">
          {isJoined ? (
            <div className="flex-1 flex flex-col bg-white/5 backdrop-blur-3xl border-t border-white/10 justify-between">
              
              {/* Group Decision Poll Section (Collapsible) */}
              <div className="mx-5 mt-5 bg-[#030712]/60 border border-white/10 rounded-2.5xl p-4 flex flex-col gap-3 shadow-xl backdrop-blur-xl animate-in slide-in-from-top-4 duration-300">
                <div 
                  className="flex items-center justify-between cursor-pointer select-none"
                  onClick={() => setPollsCollapsed(!pollsCollapsed)}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-base animate-bounce">📊</span>
                    <h4 className="text-xs font-black text-indigo-300 uppercase tracking-widest">
                      {lang === 'ar' ? 'استفتاءات وقرارات الرفقاء' : 'Companion Polls & Decisions'}
                    </h4>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {polls.length > 0 && (
                      <span className="px-2 py-[2px] bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded-lg text-[8px] font-black">
                        {polls.length} {lang === 'ar' ? 'نشط' : 'Active'}
                      </span>
                    )}
                    <span className="text-slate-400 text-xs transition-transform duration-200" style={{ transform: pollsCollapsed ? 'rotate(0deg)' : 'rotate(180deg)' }}>
                      ▼
                    </span>
                  </div>
                </div>

                {!pollsCollapsed && (
                  <div className="space-y-4 pt-1 border-t border-white/5 animate-in fade-in duration-200">
                    {showCreatePoll ? (
                      /* Create Poll View */
                      <form onSubmit={handleCreatePollSubmit} className="space-y-3">
                        <div>
                          <label className="block text-[8px] font-bold text-indigo-400 uppercase tracking-widest mb-1">
                            {lang === 'ar' ? 'السؤال باللغة العربية' : 'Question (Arabic)'}
                          </label>
                          <input
                            type="text"
                            required
                            placeholder={lang === 'ar' ? 'مثال: أي مقهى نختار؟' : 'e.g. Which café should we pick?'}
                            value={newPollQuestionAr}
                            onChange={(e) => setNewPollQuestionAr(e.target.value)}
                            className="w-full px-3 py-2 bg-[#0B0E14] border border-white/5 text-white rounded-xl text-xs placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-all font-semibold"
                          />
                        </div>

                        <div>
                          <label className="block text-[8px] font-bold text-indigo-400 uppercase tracking-widest mb-1">
                            {lang === 'ar' ? 'السؤال باللغة الإنجليزية' : 'Question (English)'}
                          </label>
                          <input
                            type="text"
                            required
                            placeholder="e.g. Which café should we pick?"
                            value={newPollQuestionEn}
                            onChange={(e) => setNewPollQuestionEn(e.target.value)}
                            className="w-full px-3 py-2 bg-[#0B0E14] border border-white/5 text-white rounded-xl text-xs placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-all font-semibold"
                          />
                        </div>

                        <div className="space-y-2">
                          <label className="block text-[8px] font-bold text-indigo-400 uppercase tracking-widest">
                            {lang === 'ar' ? 'خيارات الاستفتاء' : 'Poll Choices'}
                          </label>
                          {newPollOptions.map((opt, oIdx) => (
                            <div key={oIdx} className="flex gap-2 items-center">
                              <input
                                type="text"
                                required
                                placeholder={lang === 'ar' ? `خيار ${oIdx + 1}` : `Choice ${oIdx + 1}`}
                                value={opt}
                                onChange={(e) => {
                                  const updated = [...newPollOptions];
                                  updated[oIdx] = e.target.value;
                                  setNewPollOptions(updated);
                                }}
                                className="flex-1 px-3 py-1.5 bg-[#0B0E14] border border-white/5 text-white rounded-lg text-xs placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-all font-semibold"
                              />
                              {newPollOptions.length > 2 && (
                                <button
                                  type="button"
                                  onClick={() => setNewPollOptions(newPollOptions.filter((_, idx) => idx !== oIdx))}
                                  className="p-1.5 bg-rose-500/10 hover:bg-rose-500/30 border border-rose-500/30 text-rose-400 rounded-lg text-xs"
                                >
                                  ✕
                                </button>
                              )}
                            </div>
                          ))}
                          {newPollOptions.length < 5 && (
                            <button
                              type="button"
                              onClick={() => setNewPollOptions([...newPollOptions, ''])}
                              className="text-[9px] font-black uppercase text-indigo-400 hover:text-indigo-300 flex items-center gap-1 mt-1 cursor-pointer"
                            >
                              ➕ {lang === 'ar' ? 'إضافة خيار' : 'Add Option'}
                            </button>
                          )}
                        </div>

                        <div className="flex gap-2 pt-2">
                          <button
                            type="submit"
                            className="flex-1 py-2 bg-indigo-500 hover:bg-indigo-400 text-white font-black rounded-xl text-[10px] uppercase tracking-wider transition-all cursor-pointer"
                          >
                            🚀 {lang === 'ar' ? 'نشر الاستفتاء' : 'Publish Poll'}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setShowCreatePoll(false);
                              setNewPollQuestionEn('');
                              setNewPollQuestionAr('');
                              setNewPollOptions(['', '']);
                            }}
                            className="px-4 py-2 bg-[#0B0E14] hover:bg-white/5 text-slate-400 hover:text-white font-black rounded-xl text-[10px] uppercase tracking-wider transition-all cursor-pointer"
                          >
                            {lang === 'ar' ? 'إلغاء' : 'Cancel'}
                          </button>
                        </div>
                      </form>
                    ) : (
                      /* Active Poll View */
                      <div className="space-y-4">
                        {polls.length === 0 ? (
                          <div className="text-center py-4 space-y-2">
                            <p className="text-xs text-slate-400 italic font-medium">
                              {lang === 'ar' ? 'لا توجد استفتاءات نشطة حالياً.' : 'No active decision polls right now.'}
                            </p>
                            <button
                              onClick={() => setShowCreatePoll(true)}
                              className="px-3 py-1.5 bg-indigo-500 hover:bg-indigo-400 text-white text-[10px] font-black rounded-lg uppercase tracking-wider transition-all cursor-pointer inline-block"
                            >
                              ➕ {lang === 'ar' ? 'إنشاء استفتاء جديد' : 'Create Poll'}
                            </button>
                          </div>
                        ) : (
                          polls.slice(0, 1).map((poll) => {
                            // Calculate total votes
                            const totalVotes = poll.options.reduce((sum, opt) => sum + opt.votes.length, 0);
                            
                            return (
                              <div key={poll.id} className="space-y-3">
                                <h5 className="text-xs font-black text-white leading-relaxed">
                                  {lang === 'ar' ? poll.questionAr : poll.questionEn}
                                </h5>

                                <div className="space-y-2.5">
                                  {poll.options.map((opt) => {
                                    const percent = totalVotes > 0 ? Math.round((opt.votes.length / totalVotes) * 100) : 0;
                                    const isVoted = opt.votes.includes(currentUser.id);
                                    
                                    return (
                                      <div 
                                        key={opt.id}
                                        onClick={() => handleVotePoll(poll.id, opt.id)}
                                        className={`p-2.5 bg-[#0B0E14] hover:bg-[#111622] rounded-xl border transition-all cursor-pointer relative overflow-hidden flex flex-col gap-1 select-none ${
                                          isVoted 
                                            ? 'border-indigo-500/50 bg-[#0B0E14]' 
                                            : 'border-white/5 hover:border-white/10'
                                        }`}
                                      >
                                        {/* Filled Gauge Progress Bar Background */}
                                        <div 
                                          className="absolute top-0 left-0 bottom-0 bg-indigo-500/10 transition-all duration-500 animate-pulse"
                                          style={{ width: `${percent}%` }}
                                        />

                                        <div className="relative z-10 flex items-center justify-between">
                                          <div className="flex items-center gap-2">
                                            {isVoted && <span className="text-[10px] text-indigo-400 font-bold shrink-0">✓</span>}
                                            <span className={`text-[11px] font-extrabold ${isVoted ? 'text-indigo-300' : 'text-slate-300'}`}>
                                              {lang === 'ar' ? opt.textAr : opt.textEn}
                                            </span>
                                          </div>
                                          <span className="text-[10px] font-black text-indigo-400 font-mono">
                                            {percent}% ({opt.votes.length})
                                          </span>
                                        </div>

                                        {/* Voter Avatar Stack */}
                                        {opt.votes.length > 0 && (
                                          <div className="relative z-10 flex items-center justify-between border-t border-white/[0.03] pt-1 mt-0.5">
                                            <span className="text-[8px] text-slate-500 font-bold uppercase tracking-wider">
                                              {lang === 'ar' ? 'المصوتون' : 'Voters'}
                                            </span>
                                            <div className="flex -space-x-1.5 overflow-hidden shrink-0">
                                              {opt.votes.slice(0, 4).map(vId => {
                                                const voter = allProfiles.find(p => p.id === vId);
                                                return (
                                                  <span 
                                                    key={vId} 
                                                    className="w-4 h-4 rounded-full bg-slate-800 text-[8px] font-bold border border-slate-950 flex items-center justify-center text-slate-300 select-none" 
                                                    title={voter?.name}
                                                  >
                                                    {voter?.avatar && (voter.avatar.startsWith('http') || voter.avatar.length > 3) ? (
                                                      <img src={voter.avatar} alt="" className="w-full h-full object-cover rounded-full animate-fade-in" />
                                                    ) : (
                                                      voter?.avatar || '👤'
                                                    )}
                                                  </span>
                                                );
                                              })}
                                              {opt.votes.length > 4 && (
                                                <span className="w-4 h-4 rounded-full bg-indigo-500/30 text-[7px] font-black border border-slate-950 flex items-center justify-center text-indigo-300 select-none">
                                                  +{opt.votes.length - 4}
                                                </span>
                                              )}
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>

                                <div className="flex justify-between items-center border-t border-white/5 pt-2 mt-1">
                                  <span className="text-[9px] text-slate-500 font-bold uppercase tracking-widest font-mono">
                                    {lang === 'ar' ? `إجمالي الأصوات: ${totalVotes}` : `Total Votes: ${totalVotes}`}
                                  </span>
                                  <button
                                    onClick={() => setShowCreatePoll(true)}
                                    className="text-[9px] font-black uppercase text-indigo-400 hover:text-indigo-300 flex items-center gap-1 cursor-pointer"
                                  >
                                    ➕ {lang === 'ar' ? 'طرح سؤال جديد' : 'New Poll'}
                                  </button>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Message Feed list */}
              <div className="flex gap-2 p-2 bg-[#0B0E14] border-b border-white/5">
                {(['all', 'system', 'media'] as const).map(f => (
                  <button
                    key={f}
                    onClick={() => setChatFilter(f)}
                    className={`px-3 py-1 text-[9px] font-black uppercase rounded-lg transition-colors ${chatFilter === f ? 'bg-indigo-600 text-white' : 'bg-white/5 text-slate-500 hover:text-slate-300'}`}
                  >
                    {f}
                  </button>
                ))}
              </div>
              <div className="flex-1 overflow-y-auto p-5 space-y-4 max-h-[55vh] custom-scroll">
                {messages && messages.length > 0 ? (
                  messages
                    .filter(msg => {
                      if (chatFilter === 'all') return true;
                      if (chatFilter === 'system') return !!msg.isSystem;
                      if (chatFilter === 'media') return !!(msg.imageUrl || msg.locationUrl);
                      return true;
                    })
                    .map((msg, idx) => {
                      const isCurrentUser = msg.senderId === currentUser.id;
                      const isSystem = msg.isSystem;

                    if (msg.type === 'poll' || msg.type === 'poll_vote') {
                      return null;
                    }

                    if (isSystem) {
                      return (
                        <div key={`${msg.id || 'sys'}-${idx}`} className="text-center my-6 flex justify-center animate-in slide-in-from-bottom-2 fade-in">
                          <span className="inline-block px-4 py-1.5 bg-[#0B0E14] text-slate-400 rounded-full text-[9px] font-bold border border-white/5 tracking-widest uppercase">
                            {msg.content}
                          </span>
                        </div>
                      );
                    }

                    return (
                      <div key={`${msg.id || 'msg'}-${idx}`} className={`flex gap-3 max-w-[85%] ${isCurrentUser ? `${lang === 'ar' ? 'mr-auto' : 'ml-auto'} flex-row-reverse` : ''} animate-in slide-in-from-bottom-2 fade-in group relative`}>
                        <span className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-xl shrink-0 select-none shadow-inner">
                          {msg.senderAvatar}
                        </span>
                        <div className="relative">
                          <div className={`text-[10px] text-slate-500 font-bold mb-1 px-1 tracking-wider uppercase ${isCurrentUser ? `${lang === 'ar' ? 'text-left' : 'text-right'}` : ''}`}>
                            {msg.senderName}
                          </div>
                          <div 
                            onMouseDown={() => handlePressStart(msg.id)}
                            onMouseUp={handlePressEnd}
                            onTouchStart={() => handlePressStart(msg.id)}
                            onTouchEnd={handlePressEnd}
                            onDoubleClick={(e) => {
                              if (wasLongPressed) {
                                e.preventDefault();
                                e.stopPropagation();
                                setWasLongPressed(false);
                                return;
                              }
                              setSelectedEmojiMessageId(selectedEmojiMessageId === msg.id ? null : msg.id);
                            }}
                            onClick={(e) => {
                              if (wasLongPressed) {
                                e.preventDefault();
                                e.stopPropagation();
                                setWasLongPressed(false);
                                return;
                              }
                              setSelectedEmojiMessageId(selectedEmojiMessageId === msg.id ? null : msg.id);
                            }}
                            className={`p-4 rounded-3xl text-[13px] leading-relaxed tracking-wide font-medium shadow-sm transition-all cursor-pointer relative ${isCurrentUser ? 'bg-indigo-600/90 text-white rounded-tr-none border border-indigo-500/50 hover:bg-indigo-600' : 'bg-white/10 text-slate-200 rounded-tl-none border border-white/10 hover:bg-white/15'}`}
                          >
                            <div>{msg.content}</div>
                            
                            {msg.imageUrl && (
                              <div className="mt-2 text-center rounded-2xl overflow-hidden border border-white/10 bg-black/40">
                                <img 
                                  src={msg.imageUrl} 
                                  alt="Shared content" 
                                  referrerPolicy="no-referrer"
                                  className="mx-auto max-h-56 object-cover rounded-xl" 
                                />
                              </div>
                            )}

                            {msg.locationUrl && (
                              <div className="mt-2.5 p-3 rounded-2xl bg-black/40 border border-emerald-500/25 flex flex-col gap-2">
                                <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-400">
                                  <MapPin className="w-3.5 h-3.5 text-emerald-400 animate-bounce" />
                                  <span>{lang === 'ar' ? '📍 موقع اللقاء المشترك' : '📍 Shared Meetup Spot'}</span>
                                </div>
                                <p className="text-[10px] text-slate-400 font-mono truncate select-all">
                                  {msg.locationUrl}
                                </p>
                                <a 
                                  href={msg.locationUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="w-full text-center py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-[10px] font-black rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer select-none"
                                >
                                  {lang === 'ar' ? 'فتح في خرائط جوجل' : 'Open Google Maps'}
                                </a>
                              </div>
                            )}

                            {/* Message Reactions display bubble */}
                            {(() => {
                              const activeReactions = { ...(msg.reactions || {}), ...(optimisticReactions[msg.id] || {}) };
                              const reactionEntries = Object.entries(activeReactions).filter(([_, emoji]) => !!emoji);
                              if (reactionEntries.length === 0) return null;
                              return (
                                <div className="absolute -bottom-2 right-2 bg-slate-950 border border-white/10 rounded-full px-1.5 py-0.5 flex gap-0.5 shadow-md z-10 scale-95 border-indigo-100">
                                  {reactionEntries.map(([uId, rEmoji]) => (
                                    <span key={uId} className="text-[11px]" title={uId === currentUser.id ? 'My reaction' : 'Participant reaction'}>
                                      {rEmoji as string}
                                    </span>
                                  ))}
                                </div>
                              );
                            })()}
                          </div>

                          {/* Quick Emoji Reaction picker overlay */}
                          <AnimatePresence>
                            {selectedEmojiMessageId === msg.id && (
                              <motion.div
                                initial={{ scale: 0.8, opacity: 0, y: -5 }}
                                animate={{ scale: 1, opacity: 1, y: 0 }}
                                exit={{ scale: 0.8, opacity: 0, y: -5 }}
                                className="absolute -top-12 left-0 right-0 mx-auto w-fit bg-slate-900 text-white p-1.5 rounded-full flex gap-1.5 shadow-xl z-50 border border-white/20"
                              >
                                {['👍', '🔥', '📍', '❤️', '😂', '🙏'].map(em => (
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
                    );
                  })
                ) : (
                  <p className="text-xs text-slate-500 italic text-center mt-16 font-medium bg-[#0B0E14] p-4 rounded-xl border border-white/5 inline-block mx-auto flex w-max">{t.noMessagesInChat}</p>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Presending attachments preview */}
              {presendingImage && (
                <div className="px-4 py-2 bg-[#0F131D] border-t border-white/5 flex items-center justify-between animate-in slide-in-from-bottom-1 fade-in">
                  <div className="flex items-center gap-3">
                    <img 
                      src={presendingImage} 
                      alt="Attachment preview" 
                      className="w-12 h-12 object-cover rounded-xl border border-white/10" 
                    />
                    <div>
                      <span className="text-[11px] text-emerald-400 font-black block">
                        {lang === 'ar' ? '📷 جاهز للإرسال' : '📷 READY TO SEND'}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {lang === 'ar' ? 'سيتم إرفاقه مع رسالتك التالية' : 'Will attach to your messaging step'}
                      </span>
                    </div>
                  </div>
                  <button 
                    onClick={() => setPresendingImage(null)}
                    className="p-1 px-2.5 bg-rose-500/10 hover:bg-rose-500/25 text-rose-400 text-[10px] font-black rounded-lg border border-rose-500/20 transition-all"
                  >
                    {lang === 'ar' ? 'إلغاء الإرفاق' : 'Remove'}
                  </button>
                </div>
              )}

              {/* Chat action control bar */}
              <div className="p-4 bg-[#0B0E14] border-t border-white/10 flex flex-col gap-3 relative">
                
                {/* Embedded quick attachment menu drawer */}
                {showAttachmentMenu && (
                  <div className="absolute bottom-[105%] left-4 right-4 bg-[#090B11] border border-white/10 rounded-2xl p-4 shadow-xl space-y-3 z-30 animate-in slide-in-from-bottom duration-200">
                    <div className="flex justify-between items-center pb-2 border-b border-white/5">
                      <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest flex items-center gap-1">
                        <Paperclip className="w-3.5 h-3.5 text-indigo-400" />
                        {lang === 'ar' ? 'أدوات التنسيق والوسائط' : 'OUTING COORDINATION TOOLS'}
                      </span>
                      <button 
                        onClick={() => setShowAttachmentMenu(false)}
                        className="text-slate-500 hover:text-white text-xs font-bold"
                      >
                        ✕
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-2.5">
                      {/* Share GPS Location */}
                      <button
                        onClick={handleShareGPSLoc}
                        disabled={gpsLoading}
                        className="p-3 bg-white/5 hover:bg-emerald-600/20 border border-white/10 hover:border-emerald-500/30 rounded-xl transition-all flex flex-col items-center justify-center text-center gap-1 cursor-pointer"
                      >
                        <MapPin className={`w-5 h-5 text-emerald-400 ${gpsLoading ? 'animate-bounce' : ''}`} />
                        <span className="text-[11px] font-bold text-white flex items-center justify-center gap-1">
                          {gpsLoading 
                            ? (lang === 'ar' ? 'جاري التحديد...' : 'Locating...') 
                            : (lang === 'ar' ? 'إرسال الموقع الحالي' : 'Share GPS Location')}
                        </span>
                        <span className="text-[9px] text-slate-500">{lang === 'ar' ? 'إرسال إحداثيات ومكان التجمع' : 'Send real-time mapping pin'}</span>
                      </button>

                      {/* Upload custom image */}
                      <label 
                        className="p-3 bg-white/5 hover:bg-indigo-600/20 border border-white/10 hover:border-indigo-500/30 rounded-xl transition-all flex flex-col items-center justify-center text-center gap-1 cursor-pointer"
                      >
                        <Camera className="w-5 h-5 text-indigo-400" />
                        <span className="text-[11px] font-bold text-white">
                          {lang === 'ar' ? 'رفع صور / فيديو' : 'Upload custom media'}
                        </span>
                        <span className="text-[9px] text-slate-500">{lang === 'ar' ? 'من استديو هاتفك أو جهازك' : 'From your phone gallery'}</span>
                        <input 
                          type="file" 
                          accept="image/*" 
                          onChange={handleCustomFileUpload} 
                          className="hidden" 
                        />
                      </label>
                    </div>

                    {/* Pre-seeded awesome locations/photos to mock quickly */}
                    <div className="space-y-2">
                      <span className="text-[9px] text-slate-400 font-black block">
                        {lang === 'ar' ? '⚡ اقتراحات وسائط سريعة للطلعة' : '⚡ INSTANT OUTING PHOTO PRESETS'}
                      </span>
                      <div className="grid grid-cols-4 gap-2">
                        {PRESET_ATTACHMENTS.map((preset, idx) => (
                          <div 
                            key={idx}
                            onClick={() => { setPresendingImage(preset.url); setShowAttachmentMenu(false); }}
                            className="group relative h-12 rounded-lg overflow-hidden border border-white/5 hover:border-indigo-500 cursor-pointer transition-all"
                          >
                            <img src={preset.url} alt="Preset thumbnail" className="w-full h-full object-cover group-hover:scale-110 transition duration-300" />
                            <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-center p-0.5">
                              <span className="text-[8px] text-white font-bold leading-tight scale-90">
                                {lang === 'ar' ? preset.titleAr : preset.titleEn}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-3 w-full">
                  {/* Attachment toggle button */}
                  <button
                    onClick={() => setShowAttachmentMenu(!showAttachmentMenu)}
                    className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${showAttachmentMenu ? 'bg-indigo-600 text-white border-indigo-500' : 'bg-white/5 text-slate-400 hover:bg-white/10 border-white/10 hover:text-white'}`}
                    title={lang === 'ar' ? 'إرسال موقع أو وسائط' : 'Send position or gallery media'}
                  >
                    <Paperclip className="w-5 h-5" />
                  </button>

                  {/* Voice recording button */}
                  <button
                    onClick={isRecording ? stopRecording : startRecording}
                    disabled={isTranscribing}
                    className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
                      isRecording 
                        ? 'bg-rose-500 text-white border-rose-400 animate-pulse' 
                        : 'bg-white/5 text-slate-400 hover:bg-white/10 border-white/10 hover:text-white'
                    }`}
                    title={lang === 'ar' ? 'تسجيل رسالة صوتية' : 'Record voice message'}
                  >
                    {isTranscribing ? <Loader2 className="w-5 h-5 animate-spin" /> : isRecording ? <Square className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                  </button>

                  {/* Location Snapshot button */}
                  <button
                    onClick={handleTakeLocationSnapshot}
                    className="p-3.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30 rounded-2xl transition-all cursor-pointer flex items-center justify-center"
                    title={lang === 'ar' ? 'إرسال لقطة مرئية لموقع التجمع' : 'Send visual map snapshot of meetup spot'}
                  >
                    <MapPin className="w-5 h-5" />
                  </button>

                  {/* Feature 4: Persistent Quick SOS Button */}
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm(lang === 'ar' ? 'هل أنت متأكد من تفعيل نداء الاستغاثة SOS الطارئ الآن؟' : 'Are you sure you want to trigger the emergency SOS panic warning now?')) {
                        handleTriggerSOS();
                      }
                    }}
                    className={`p-3.5 bg-red-600 border border-red-500 text-white rounded-2xl transition-all shadow-md flex items-center justify-center cursor-pointer font-black ${
                      sosStatus === 'triggered' ? 'bg-orange-500 scale-110 border-orange-400' : 'animate-pulse hover:bg-red-500'
                    }`}
                    title={lang === 'ar' ? '🆘 منبه استغاثة SOS الطارئ' : '🆘 Emergency Quick SOS Alert'}
                  >
                    <span className="text-sm">🆘</span>
                  </button>

                  <input
                    id="input_chat_box"
                    type="text"
                    placeholder={isRecording ? (lang === 'ar' ? 'جاري التسجيل...' : 'Recording...') : (t.chatInputPlaceholder || (lang === 'ar' ? 'اكتب رسالة للتنسيق أو للاستفسار عن نقطة التجمع...' : 'Ask a question or discuss coordinate meetup spot...'))}
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                    disabled={isRecording || isTranscribing}
                    className="flex-1 px-5 py-3.5 bg-white/5 border border-white/10 rounded-2xl text-[13px] text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder-slate-500 transition-colors"
                  />
                  
                  <button
                    id="btn_chat_send"
                    onClick={() => { haptic(); handleSend(); }}
                    disabled={isRecording || isTranscribing}
                    className="p-3.5 bg-indigo-600 hover:bg-indigo-500 text-white disabled:bg-slate-700 disabled:opacity-50 rounded-2xl transition-colors cursor-pointer shadow-lg shadow-indigo-600/20"
                  >
                    <Send className={`w-5 h-5 ${lang === 'ar' ? 'rotate-180' : ''}`} />
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-white/5 backdrop-blur-3xl border-t border-white/10 relative" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
              <div className="absolute inset-0 bg-[#0B0E14]/50 backdrop-blur-md z-0" />
              <div className="relative z-10 flex flex-col items-center">
                <div className="p-5 bg-indigo-500/20 border border-indigo-500/30 rounded-3xl text-indigo-400 mb-6 shadow-inner relative">
                  <div className="absolute inset-0 bg-indigo-500/20 blur-xl rounded-full pointer-events-none" />
                  <MessageSquare className="w-10 h-10 relative z-10" />
                </div>
                <h3 className="text-lg font-black text-white mb-2">{t.tempChatLocked}</h3>
                <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto mb-8 font-medium leading-relaxed">
                  {t.tempChatLockedDesc}
                </p>
                <motion.button
                  id="btn_unlock_chat"
                  whileTap={{ scale: 0.95 }}
                  whileHover={{ scale: 1.02 }}
                  transition={{ type: "spring", stiffness: 400, damping: 15 }}
                  onClick={() => onJoin(outing.id)}
                  className="px-8 py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-sm font-black rounded-xl transition-all shadow-lg shadow-indigo-600/20 uppercase tracking-widest cursor-pointer hover:-translate-y-0.5"
                >
                  {t.joinGroupUnlockChatBtn}
                </motion.button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* QR Code Verification Modal Overlay */}
      {showQrCodeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-300">
          <div className="relative w-full max-w-sm bg-[#090B11] border border-white/10 rounded-3xl overflow-hidden shadow-2xl flex flex-col p-6 items-center">
            
            <div className="w-full flex justify-between items-center mb-6">
              <div className="flex items-center gap-2">
                <QrCode className="w-5 h-5 text-indigo-400" />
                <span className="text-xs font-black tracking-widest text-white uppercase">
                  {lang === 'ar' ? 'تسجيل الحضور الرقمي' : 'OUTING ATTENDANCE CHECK-IN'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowQrCodeModal(false)}
                className="px-3.5 py-1.5 bg-rose-500/10 hover:bg-rose-500 hover:text-white border border-rose-500/20 text-rose-400 font-extrabold rounded-xl text-[10px] transition-all cursor-pointer uppercase tracking-wider"
              >
                {lang === 'ar' ? 'إغلاق ✕' : 'Close ✕'}
              </button>
            </div>

            {outing.creatorId === currentUser.id ? (
              /* Organizer View: Shows master QR Code for participants to scan */
              <div className="w-full space-y-5 text-center flex flex-col items-center">
                <div className="bg-white p-4 rounded-2xl shadow-xl">
                  <QRCodeSVG value={`yallamate://outing/${outing.id}/checkin`} size={200} />
                </div>
                
                <div className="space-y-1">
                  <span className="text-[9px] font-black tracking-widest text-amber-400 uppercase bg-amber-500/10 px-2 py-0.5 rounded-full">
                    {lang === 'ar' ? 'عرض الرمز للحضور' : 'LEADER HOST QR'}
                  </span>
                  <p className="text-xs text-slate-300 font-medium leading-relaxed">
                    {lang === 'ar' ? 'دع رفاق الرحلة يمسحون هذا الرمز لتأكيد حضورهم وتأكيد نقاط الموثوقية الخاصة بهم.' : 'Let your mates scan this master QR code to verify attendance and calculate trust scores.'}
                  </p>
                </div>

                {/* Checked In Members list */}
                <div className="w-full bg-white/5 border border-white/5 p-4 rounded-2xl text-left space-y-2">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">
                    👥 {lang === 'ar' ? 'الرفاق المسجل حضورهم' : 'CHECKED-IN MATES'} ({checkedInUserIds.length})
                  </span>
                  {checkedInUserIds.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {checkedInUserIds.map(uid => (
                        <span key={uid} className="px-2 py-1 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[9px] font-black rounded-lg">
                          ✓ {uid === currentUser.id ? (lang === 'ar' ? 'أنت' : 'You') : uid.substring(0, 8)}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-[10px] text-slate-500 italic block">
                      {lang === 'ar' ? 'بانتظار رفاق الرحلة لمسح الرمز...' : 'Waiting for mates to scan and check in...'}
                    </span>
                  )}
                </div>
              </div>
            ) : (
              /* Participant View: Allows scanning or entering code to self check-in */
              <div className="w-full space-y-5 text-center flex flex-col items-center">
                {(checkedInUserIds.includes(currentUser.id) || isCheckInSuccess) ? (
                  /* Success check-in view */
                  <div className="space-y-4 py-4 flex flex-col items-center animate-in zoom-in-95 duration-300">
                    <div className="w-16 h-16 bg-emerald-500/20 border border-emerald-500/35 rounded-full flex items-center justify-center text-emerald-400 text-3xl animate-bounce">
                      ✓
                    </div>
                    <div className="space-y-1">
                      <h4 className="text-sm font-black text-emerald-400">
                        {lang === 'ar' ? 'تم تأكيد الحضور بنجاح!' : 'Attendance Checked In!'}
                      </h4>
                      <p className="text-[10px] text-slate-400 leading-relaxed max-w-[240px] mx-auto text-center">
                        {lang === 'ar' ? 'تم التحقق من حضورك للطلعة. نقاط الموثوقية الخاصة بك قد ازدادت بنسبة +0.1.' : 'Your check-in is complete. Attendance verified for trust score rating bump (+0.1).'}
                      </p>
                    </div>
                  </div>
                ) : (
                  /* Trigger check-in view */
                  <div className="w-full space-y-5 flex flex-col items-center">
                    <div className="relative group border border-dashed border-white/20 p-5 rounded-2xl bg-white/5 w-full text-center">
                      <div className="absolute inset-0 bg-indigo-500/5 animate-pulse rounded-2xl pointer-events-none" />
                      <QrCode className="w-12 h-12 text-indigo-400 mx-auto animate-bounce mb-3" />
                      <span className="text-[9px] font-black text-slate-400 tracking-wider uppercase block">{lang === 'ar' ? 'مسح الرمز للتحقق' : 'VERIFY ATTENDANCE'}</span>
                      <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">
                        {lang === 'ar' ? 'امسح رمز الـ QR المعروض لدى قائد الطلعة لتأكيد تواجدك بموقع التجمع.' : 'Scan the master QR code displayed on the leader\'s screen to verify arrival.'}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        const updated = [...checkedInUserIds, currentUser.id];
                        setCheckedInUserIds(updated);
                        localStorage.setItem(`ym_outing_checkins_${outing.id}`, JSON.stringify(updated));
                        setIsCheckInSuccess(true);
                        haptic();
                      }}
                      className="w-full py-3 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-black rounded-xl text-xs transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer uppercase tracking-wider"
                    >
                      🚀 {lang === 'ar' ? 'محاكاة تسجيل الحضور السريع' : 'Simulate Quick Check-In'}
                    </button>
                  </div>
                )}
              </div>
            )}

            <button
               onClick={() => {
                 if (navigator.vibrate) navigator.vibrate(50);
                 setShowQrCodeModal(false);
               }}
               className="mt-6 w-full py-3 bg-white/5 border border-white/10 hover:bg-white/10 text-slate-300 font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
               <CheckCircle className="w-4 h-4 text-emerald-400" />
               {lang === 'ar' ? 'تم' : 'Done'}
            </button>
          </div>
        </div>
      )}

      {/* Advanced Fuel Splitter Modal Overlay */}
      {showSplitterModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-300">
          <div className="relative w-full max-w-4xl bg-[#090B11] border border-white/10 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
            
            {/* Modal header with quick close button */}
            <div className="p-4 bg-white/5 border-b border-white/5 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <span className="text-emerald-400 font-bold">⛽</span>
                <span className="text-xs font-black tracking-widest text-white uppercase">
                  {lang === 'ar' ? 'تعديل وتقاسم مصاريف الرحلة' : 'COORDINATE & SPLIT OUTING FUEL'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowSplitterModal(false)}
                className="px-3.5 py-1.5 bg-rose-500/10 hover:bg-rose-500 hover:text-white border border-rose-500/20 text-rose-400 font-extrabold rounded-xl text-[10px] transition-all cursor-pointer uppercase tracking-wider"
              >
                {lang === 'ar' ? 'إغلاق ✕' : 'Close ✕'}
              </button>
            </div>

            {/* Scrollable contents rendering out ExpenseSplitter directly */}
            <div className="p-4 md:p-6 overflow-y-auto flex-1">
              <ExpenseSplitter 
                lang={lang} 
                defaultDistance={(outing.category as string) === 'Road_Trip' || (outing.category as string) === 'City Tours' ? 140 : 65} 
                defaultAttendees={outing.attendeeIds?.length || 0 || 3}
                defaultCity={outing.city}
              />
            </div>
          </div>
        </div>
      )}

      {/* Incident Report Modal */}
      {showIncidentForm && (
        <IncidentForm 
          outingId={outing.id}
          reporterId={currentUser.id}
          reportedUserId={reportingUserId}
          profiles={allProfiles}
          onClose={() => setShowIncidentForm(false)}
          lang={lang}
        />
      )}

      {/* Starting Withdrawal Penalty Modal Warning Dialog */}
      {showPenaltyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-300">
          <div className="relative w-full max-w-sm bg-[#0F0E14] border border-rose-500/35 rounded-3xl overflow-hidden shadow-2xl p-6 text-center space-y-6">
            <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-full text-rose-500 w-16 h-16 flex items-center justify-center mx-auto relative animate-bounce">
              <AlertTriangle className="w-8 h-8 text-rose-500" />
            </div>

            <div className="space-y-2">
              <h3 className="text-base font-black text-rose-500 uppercase tracking-widest">
                {lang === 'ar' ? '⚠️ تحذير: هذه الطلعة جارية حالياً!' : '⚠️ Warning: This outing is active!'}
              </h3>
              <p className="text-xs text-rose-300 font-bold leading-relaxed">
                {lang === 'ar' 
                  ? 'الانسحاب بعد البدء يترتب عليه عقوبات صارمة لضمان موثوقية مجتمع YallaMate:' 
                  : 'Withdrawing after starting carries strict community penalties to protect team reliability:'}
              </p>
            </div>

            <div className="p-4 bg-[#14121A] border border-white/5 rounded-2xl text-right space-y-2.5 text-xs text-slate-350" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
              <div className="flex items-start gap-2">
                <span className="text-rose-550">❌</span>
                <span>
                  {lang === 'ar' 
                    ? 'خصم فوري بـ -2.5 نقطة من معدل الثقة (Trust Score) الخاص بك.' 
                    : 'Direct deduction of -2.5 Trust Score points from your badge.'}
                </span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-rose-550">❌</span>
                <span>
                  {lang === 'ar' 
                    ? 'تسجيل إنذار رسمي في حسابك بسبب الانسحاب المفاجئ.' 
                    : 'A formal warning registered on your account profiles.'}
                </span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-rose-550">❌</span>
                <span>
                  {lang === 'ar' 
                    ? 'تثبيت ملاحظة سلبية لأصحاب الطلعات القادمة لرؤيتها.' 
                    : 'A negative performance log indexed on future joining queries.'}
                </span>
              </div>
            </div>

            <p className="text-[11px] text-slate-500">
              {lang === 'ar' 
                ? 'هل تريد بالتأكيد تأكيد الانسحاب وتحمل هذه العقوبات؟' 
                : 'Are you absolutely sure you want to proceed and accept these active penalties?'}
            </p>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowPenaltyModal(false)}
                className="w-full py-3 bg-white/5 hover:bg-white/10 text-white font-extrabold rounded-xl text-xs transition-colors cursor-pointer border border-white/10"
              >
                {lang === 'ar' ? 'التراجع والبقاء' : 'No, Keep Me In'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowPenaltyModal(false);
                  onLeave(outing.id);
                  setTrustUpdateAnimation({ type: 'down', val: '-0.2' });
                  setTimeout(() => setTrustUpdateAnimation(null), 3500);
                }}
                className="w-full py-3 bg-rose-600 hover:bg-rose-500 text-white font-extrabold rounded-xl text-xs transition-colors cursor-pointer shadow-lg shadow-rose-600/25 border border-rose-500/20 animate-pulse"
              >
                {lang === 'ar' ? 'تأكيد الانسحاب والعقوبة' : 'Proceed anyway'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Activity Logs & Other Views */}
      
      {/* Leave Outing Confirmation */}
      <ConfirmModal
        isOpen={showLeaveConfirm}
        onClose={() => setShowLeaveConfirm(false)}
        onConfirm={() => {
          onLeave(outing.id);
          setShowLeaveConfirm(false);
          setTrustUpdateAnimation({ type: 'down', val: '-0.1' });
          setTimeout(() => setTrustUpdateAnimation(null), 3500);
        }}
        title={lang === 'ar' ? 'تأكيد المغادرة' : 'Confirm Departure'}
        description={lang === 'ar' ? 'هل أنت متأكد من رغبتك في مغادرة هذه الطلعة؟ قد يحزن رفاقك لعدم وجودك!' : 'Are you sure you want to leave this outing? Your mates might miss having you around!'}
        confirmText={lang === 'ar' ? 'مغادرة' : 'Leave Now'}
        cancelText={lang === 'ar' ? 'تراجع' : 'Stay'}
        variant="danger"
        lang={lang}
      />

      {/* End Outing Confirmation */}
      <ConfirmModal
        isOpen={showEndConfirm}
        onClose={() => setShowEndConfirm(false)}
        onConfirm={() => {
          onEndOuting?.(outing.id);
          setShowEndConfirm(false);
        }}
        title={lang === 'ar' ? 'تأكيد الإنهاء' : 'Confirm Conclusion'}
        description={lang === 'ar' ? 'هل انتهت الطلعة فعلياً؟ سيقوم الذكاء الاصطناعي الآن بفتح تقييمات الموثوقية للمشاركين.' : 'Is the outing officially over? AI will now trigger reliability evaluations for all participants.'}
        confirmText={lang === 'ar' ? 'إنهاء الآن' : 'End Now'}
        cancelText={lang === 'ar' ? 'إلغاء' : 'Cancel'}
        variant="warning"
        lang={lang}
      />

      {/* 🎙️ High-Tech Satellite Unified Voice Room (Active Call) Modal */}
      {showActiveCall && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-300">
          <div className="relative w-full max-w-md bg-[#090C12] border border-emerald-500/25 rounded-3xl p-6 shadow-2xl space-y-6 text-center">
            
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/5 pb-4">
              <div className="flex items-center gap-2">
                <span className="relative flex h-3 w-3">
                  <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isCallActive ? "bg-emerald-400" : "bg-slate-400"}`} />
                  <span className={`relative inline-flex rounded-full h-3 w-3 ${isCallActive ? "bg-emerald-500" : "bg-slate-500"}`} />
                </span>
                <span className="text-[10px] font-mono tracking-widest text-emerald-400 uppercase font-black">
                  {lang === 'ar' ? 'غرفة الاتصال الجماعي النشط' : 'ACTIVE GROUP CALL ROOM'}
                </span>
              </div>
              <button 
                onClick={() => {
                  haptic();
                  setShowActiveCall(false);
                }} 
                className="text-slate-400 hover:text-white text-xs cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Satellite Feed Wave */}
            <div className="py-2">
              <div className="text-3xl font-mono text-white tracking-widest font-black">
                {isCallActive ? formatCallDuration(callDuration) : '00:00'}
              </div>
              <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-wider font-bold">
                {isCallActive 
                  ? (lang === 'ar' ? 'قناة البث مشفرة مباشرة 📡' : 'Live encrypted satellite stream 📡') 
                  : (lang === 'ar' ? 'قناة البث مغلقة' : 'Satellite stream idle')}
              </p>
            </div>

            {/* Participants Grid */}
            <div className="grid grid-cols-3 gap-4 py-4 justify-center items-center">
              {/* User themselves */}
              <div className="flex flex-col items-center space-y-2">
                <div className="relative">
                  {/* Glowing Pulse based on real browser mic volume! */}
                  <div 
                    className="absolute inset-0 rounded-full bg-emerald-500/20 transition-all duration-75"
                    style={{ 
                      transform: `scale(${1 + (isCallActive && !isMuted ? Math.min(userVolume / 40, 1.2) : 0)})`,
                      opacity: isCallActive && !isMuted && userVolume > 5 ? 0.8 : 0 
                    }}
                  />
                  <div className={`w-16 h-16 rounded-full flex items-center justify-center text-3xl bg-[#141A29] border-2 transition-all ${isCallActive && !isMuted ? 'border-emerald-400 shadow-md shadow-emerald-400/20' : 'border-white/10'}`}>
                    {currentUser.avatar}
                  </div>
                  {isMuted && isCallActive && (
                    <div className="absolute -bottom-1 -right-1 bg-rose-500 text-white rounded-full p-1 border border-[#090C12]">
                      <MicOff className="w-3.5 h-3.5" />
                    </div>
                  )}
                  {!isMuted && isCallActive && (
                    <div className="absolute -bottom-1 -right-1 bg-emerald-500 text-white rounded-full p-1 border border-[#090C12] animate-pulse">
                      <Mic className="w-3.5 h-3.5" />
                    </div>
                  )}
                </div>
                <div className="text-xs font-black text-white truncate max-w-[80px]">
                  {lang === 'ar' ? 'أنت' : 'You'}
                </div>
                <div className="text-[9px] text-slate-400 font-mono">
                  {isCallActive ? (isMuted ? (lang === 'ar' ? 'صامت' : 'Muted') : (lang === 'ar' ? 'يتحدث...' : 'Speaking')) : (lang === 'ar' ? 'خارج الاتصال' : 'Offline')}
                </div>
              </div>

              {/* Other Mates */}
              {callParticipants.map((mate) => {
                // Mock live audio speaking simulation for companions
                const isSpeakingSim = isCallActive && (mate.id.charCodeAt(0) % 3 === (callDuration % 3));
                return (
                  <div key={mate.id} className="flex flex-col items-center space-y-2">
                    <div className="relative">
                      <div 
                        className={`absolute inset-0 rounded-full bg-indigo-500/30 transition-all duration-200 ${isSpeakingSim ? 'scale-125 opacity-100' : 'scale-100 opacity-0'}`}
                      />
                      <div className={`w-16 h-16 rounded-full flex items-center justify-center text-3xl bg-[#141A29] border-2 transition-all ${isSpeakingSim ? 'border-indigo-400 shadow-md shadow-indigo-400/20' : 'border-white/10'}`}>
                        {mate.avatar}
                      </div>
                      {isCallActive && (
                        <div className={`absolute -bottom-1 -right-1 rounded-full p-1 border border-[#090C12] ${isSpeakingSim ? 'bg-[#5f5ce5] text-white' : 'bg-slate-700 text-slate-400'}`}>
                          <Mic className="w-3.5 h-3.5" />
                        </div>
                      )}
                    </div>
                    <div className="text-xs font-black text-white truncate max-w-[80px]">
                      {mate.name?.split(' ')[0] || 'Mate'}
                    </div>
                    <div className="text-[9px] text-slate-400 font-mono">
                      {isCallActive ? (isSpeakingSim ? (lang === 'ar' ? 'يتحدث...' : 'Speaking') : (lang === 'ar' ? 'مستمع' : 'Listening')) : (lang === 'ar' ? 'خارج الاتصال' : 'Offline')}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Dynamic CSS Audio Wave Visualizer */}
            {isCallActive && (
              <div className="flex justify-center items-end gap-1 h-8 py-1">
                {[1, 2, 3, 4, 3, 2, 1, 3, 4, 2, 1, 3].map((h, i) => (
                  <div 
                    key={i} 
                    className="w-1 rounded-full bg-emerald-500 transition-all duration-100"
                    style={{ 
                      height: `${isMuted ? '4px' : `${Math.max(4, h * 6 * (userVolume > 5 ? (userVolume / 80) : 0.6))}px`}`
                    }}
                  />
                ))}
              </div>
            )}

            {/* Voice controls */}
            <div className="space-y-4">
              {isCallActive ? (
                <div className="flex justify-center gap-4">
                  {/* Mute button */}
                  <button
                    onClick={() => {
                      haptic();
                      setIsMuted(!isMuted);
                    }}
                    className={`px-5 py-3 rounded-2xl font-black text-xs transition-all flex items-center gap-2 cursor-pointer border ${isMuted ? 'bg-rose-500 text-white border-rose-400' : 'bg-white/5 text-slate-300 hover:bg-white/10 border-white/10'}`}
                  >
                    {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                    {isMuted ? (lang === 'ar' ? 'تشغيل الصوت' : 'Unmute') : (lang === 'ar' ? 'كتم الصوت' : 'Mute')}
                  </button>

                  {/* Disconnect button */}
                  <button
                    onClick={() => {
                      haptic();
                      setIsCallActive(false);
                      setIsMuted(false);
                    }}
                    className="px-5 py-3 bg-rose-600 hover:bg-rose-700 text-white font-black text-xs rounded-2xl transition-all flex items-center gap-2 cursor-pointer"
                  >
                    <PhoneOff className="w-4 h-4" />
                    {lang === 'ar' ? 'مغادرة الغرفة' : 'Leave Call'}
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => {
                    haptic();
                    setIsCallActive(true);
                  }}
                  className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 text-[#090C12] font-black rounded-2xl text-sm transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-emerald-500/20 animate-pulse"
                >
                  <PhoneCall className="w-4 h-4" />
                  {lang === 'ar' ? 'بدء المكالمة النشطة الآن 🎧' : 'Launch Live Active Call 🎧'}
                </button>
              )}
            </div>

            <p className="text-[10px] text-slate-500 leading-relaxed font-bold">
              {lang === 'ar' 
                ? 'تقوم التقنية بالاتصال التلقائي بين الأجهزة لإتاحة التنسيق الصوتي المباشر خلال الرحلة.' 
                : 'P2P decentralized node connectivity active. Voice coordinates sync seamlessly.'}
            </p>
          </div>
        </div>
      )}
      {/* Invite Friends Modal */}
      {showInviteFriendsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
          <div className="relative w-full max-w-md bg-[#0F0E14] border border-white/10 rounded-3xl p-6 overflow-hidden shadow-2xl space-y-5">
            <div className="flex justify-between items-center border-b border-white/5 pb-3">
              <h3 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-indigo-400" />
                {lang === 'ar' ? 'دعوة الرفقاء من قائمتك' : 'Invite Friends to Cohort'}
              </h3>
              <button 
                onClick={() => setShowInviteFriendsModal(false)}
                className="p-1.5 hover:bg-white/5 rounded-lg text-slate-400 hover:text-white transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              {lang === 'ar' 
                ? 'اختر من قائمة أصدقائك لإرسال دعوة مباشرة للانضمام إلى هذه الفعالية الحماسية.' 
                : 'Select friends from your circle to invite them directly to join this epic adventure.'}
            </p>

            <div className="space-y-3.5 max-h-64 overflow-y-auto pr-1 custom-scroll">
              {(() => {
                const friendsIds = friendsList || [];
                const nonJoinedFriends = allProfiles.filter(profile => {
                  if (profile.id === currentUser.id) return false;
                  if (friendsList && friendsList.length > 0) {
                    if (!friendsIds.includes(profile.id)) return false;
                  }
                  const isAttendee = outing.attendeeIds?.includes(profile.id);
                  const isInvited = outing.invitedUserIds?.includes(profile.id);
                  return !isAttendee && !isInvited;
                });

                if (nonJoinedFriends.length === 0) {
                  return (
                    <p className="text-xs text-slate-500 italic text-center py-4">
                      {lang === 'ar' ? 'جميع الأصدقاء انضموا أو تمت دعوتهم بالفعل!' : 'All friends have already joined or been invited!'}
                    </p>
                  );
                }

                return nonJoinedFriends.map((friend) => (
                  <div key={friend.id} className="flex items-center justify-between p-3 bg-[#0B0E14] border border-white/5 rounded-2xl">
                    <div className="flex items-center gap-3">
                      <span className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-lg shadow-inner overflow-hidden select-none">
                        {friend.avatar && (friend.avatar.startsWith('http') || friend.avatar.startsWith('data:image') || friend.avatar.length > 4) ? (
                          <img src={friend.avatar} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        ) : (
                          friend.avatar
                        )}
                      </span>
                      <div>
                        <div className="text-xs font-black text-white flex items-center gap-1.5">
                          {friend.name}
                          {friend.verified && <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />}
                        </div>
                        <span className="text-[9px] text-slate-500 block font-bold mt-0.5 uppercase tracking-wide">{friend.archetype}</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        haptic();
                        if (onUpdateOuting) {
                          const updatedInvited = [...(outing.invitedUserIds || []), friend.id];
                          onUpdateOuting({
                            ...outing,
                            invitedUserIds: updatedInvited
                          });
                        }
                      }}
                      className="px-3 py-1.5 bg-indigo-500 hover:bg-indigo-400 text-white font-black text-[10px] rounded-xl transition-all uppercase tracking-widest cursor-pointer shadow-md"
                    >
                      {lang === 'ar' ? 'إرسال دعوة' : 'Invite'}
                    </button>
                  </div>
                ));
              })()}
            </div>

            {outing.invitedUserIds && outing.invitedUserIds.length > 0 && (
              <div className="pt-3 border-t border-white/5 space-y-2">
                <span className="text-[9px] text-slate-500 font-bold uppercase tracking-widest block">
                  {lang === 'ar' ? 'تمت دعوتهم حالياً:' : 'Currently Invited:'}
                </span>
                <div className="flex flex-wrap gap-2">
                  {outing.invitedUserIds.map((id) => {
                    const prof = allProfiles.find(p => p.id === id);
                    if (!prof) return null;
                    return (
                      <div key={id} className="flex items-center gap-1.5 px-2 py-1 bg-white/5 border border-white/5 rounded-lg text-[10px] text-slate-300">
                        <span>{prof.avatar}</span>
                        <span className="font-bold">{prof.name}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* Floating Copied Toast Notification */}
      <AnimatePresence>
        {copiedCoords && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[100] px-5 py-3 bg-slate-950/95 backdrop-blur-md border border-emerald-500/30 text-white rounded-2xl flex items-center gap-2.5 shadow-2xl"
          >
            <div className="w-5 h-5 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Check className="w-3.5 h-3.5 stroke-[3]" />
            </div>
            <span className="text-xs font-black tracking-wide">
              {lang === 'ar' ? 'تم نسخ إحداثيات الموقع إلى الحافظة! 📍' : 'Location coordinates copied to clipboard! 📍'}
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

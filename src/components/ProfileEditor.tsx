import React, { useState, useMemo, useEffect } from 'react';
import { Camera, X, Check, ShieldCheck, PhoneCall, AlertCircle, Loader2, AlertTriangle, CheckCircle, User, Image, Sparkles, Lock } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Profile } from '../types';
import { Language } from '../data/translations';
import PersonalityQuiz from './PersonalityQuiz';
import { PREDEFINED_HOBBIES, arabCitiesList, foreignCitiesList } from '../constants';
import { supabase } from '../lib/supabase';
import { avatarUpload } from '../services/storageService';
import { storage } from '../lib/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

const readFileAsDataURL = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
};

const HOBBY_TRANSLATIONS: Record<string, string> = {
  'Reading': 'القراءة 📚',
  'Gaming': 'ألعاب الفيديو 🎮',
  'Football': 'كرة القدم ⚽',
  'Photography': 'التصوير 📷',
  'Travel': 'السفر ✈️',
  'Cooking': 'الطبخ 🍳',
  'Hiking': 'التنزه الجبلي 🥾',
  'Swimming': 'السباحة 🏊',
  'Music': 'الموسيقى 🎵',
  'Drawing': 'الرسم 🎨',
  'Volunteering': 'العمل التطوعي 🤝',
  'Fitness': 'اللياقة البدنية 💪',
  'Coding': 'البرمجة 💻',
  'Movies': 'الأفلام السينمائية 🍿',
  'Board Games': 'ألعاب الطاولة 🎲',
  'Padel': 'البادل 🎾',
  'Cycling': 'ركوب الدراجات 🚲'
};

interface ProfileEditorProps {
  currentUser: Profile;
  lang: Language;
  onClose: () => void;
  onSave: (updatedProfile: Partial<Profile>) => void;
}

export default function ProfileEditor({ currentUser, lang, onClose, onSave }: ProfileEditorProps) {
  const [name, setName] = useState(currentUser.name);
  const [username, setUsername] = useState(currentUser.username || '');
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'valid' | 'taken' | 'reserved'>('idle');
  const [usernameSuggestions, setUsernameSuggestions] = useState<string[]>([]);
  const [usernameError, setUsernameError] = useState('');
  const [moodEmoji, setMoodEmoji] = useState(currentUser.moodEmoji || '😊');
  const [moodText, setMoodText] = useState(currentUser.moodText || '');
  const [hobbies, setHobbies] = useState<string[]>(currentUser.hobbies || []);
  const [hobbyInput, setHobbyInput] = useState('');

  // Real-time unique username checking with debounce for Profile Editor
  useEffect(() => {
    if (!username) {
      setUsernameStatus('idle');
      setUsernameError('');
      setUsernameSuggestions([]);
      return;
    }

    const sanitized = username.toLowerCase().replace(/[^a-z0-9_]/g, '');
    if (sanitized !== username) {
      setUsername(sanitized);
      return;
    }

    if (sanitized.length < 3) {
      setUsernameStatus('idle');
      setUsernameError(lang === 'ar' ? 'اسم المستخدم يجب أن يكون ٣ أحرف على الأقل' : 'Username must be at least 3 characters');
      setUsernameSuggestions([]);
      return;
    }

    const reserved = ['admin', 'system', 'root', 'moderator', 'yallamate', 'yallamates', 'support', 'help', 'info', 'staff', 'bot', 'yalla', 'mate', 'mates', 'null', 'undefined', 'anonymous', 'owner', 'official'];
    if (reserved.includes(sanitized)) {
      setUsernameStatus('reserved');
      setUsernameError(lang === 'ar' ? 'اسم المستخدم هذا محجوز ومحمي' : 'This username is reserved and protected');
      setUsernameSuggestions([]);
      return;
    }

    if (sanitized === currentUser.username?.toLowerCase()) {
      setUsernameStatus('valid');
      setUsernameError('');
      setUsernameSuggestions([]);
      return;
    }

    setUsernameStatus('checking');
    setUsernameError('');

    const delayDebounce = setTimeout(async () => {
      try {
        const { data, error } = await supabase
          .from('users')
          .select('id')
          .eq('username', sanitized)
          .maybeSingle();

        if (!error && data && data.id !== currentUser.id) {
          setUsernameStatus('taken');
          setUsernameError(lang === 'ar' ? 'اسم المستخدم مأخوذ بالفعل!' : 'Username is already taken!');
          const suffix1 = Math.floor(100 + Math.random() * 900);
          const sug1 = sanitized + suffix1;
          const sug2 = sanitized + '_mate';
          const sug3 = sanitized + '_ym';
          setUsernameSuggestions([sug1, sug2, sug3]);
        } else {
          setUsernameStatus('valid');
          setUsernameError('');
          setUsernameSuggestions([]);
        }
      } catch (err) {
        console.error('Error checking username uniqueness in editor:', err);
        setUsernameStatus('valid'); // fallback
      }
    }, 500);

    return () => clearTimeout(delayDebounce);
  }, [username, lang, currentUser.username, currentUser.id]);
  
  const filteredHobbies = useMemo(() => 
    PREDEFINED_HOBBIES.filter(h => h.toLowerCase().includes(hobbyInput.toLowerCase()) && !hobbies.includes(h)),
  [hobbyInput, hobbies]);
  const [avatarInput, setAvatarInput] = useState(currentUser.avatar);
  useEffect(() => {
    setAvatarInput(currentUser.avatar);
  }, [currentUser.avatar]);
  const [isUploading, setIsUploading] = useState(false);

  const handleAvatarUpload = async (file: File) => {
    console.log('[ProfileEditor] Starting avatar upload:', file.name);
    try {
      setIsUploading(true);
      let downloadUrl = '';
      
      try {
        console.log('[ProfileEditor] Uploading to Supabase Storage via storageService...');
        downloadUrl = await avatarUpload(file, currentUser.id);
        console.log('[ProfileEditor] Supabase Storage upload successful:', downloadUrl);
      } catch (supabaseErr: any) {
        console.warn('[ProfileEditor] Supabase Storage upload failed, trying Firebase Storage fallback:', supabaseErr.message || supabaseErr);
        try {
          const fileExt = file.name.split('.').pop() || 'png';
          const storageRef = ref(storage, `users/${currentUser.id}/avatars/avatar_${Date.now()}.${fileExt}`);
          console.log('[ProfileEditor] Uploading to Firebase Storage...');
          
          // Timeout promise to fail fast if Firebase is unresponsive
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Firebase Storage upload timed out')), 4000)
          );
          
          const snapshot = await Promise.race([
            uploadBytes(storageRef, file),
            timeoutPromise
          ]) as any;
          
          downloadUrl = await getDownloadURL(snapshot.ref);
          console.log('[ProfileEditor] Firebase Storage upload successful:', downloadUrl);
        } catch (storageErr: any) {
          console.warn('[ProfileEditor] Firebase Storage upload failed or timed out, falling back to local Base64 conversion:', storageErr.message || storageErr);
          // Fallback: Read as base64 data URL
          downloadUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = (err) => reject(err);
            reader.readAsDataURL(file);
          });
          console.log('[ProfileEditor] Base64 fallback successful.');
        }
      }
      
      // Update local state ONLY. Persistence will happen when the user clicks 'Save Profile'.
      setAvatarInput(downloadUrl);
      setShowPhotoPicker(false);
    } catch (err) {
      console.error('[ProfileEditor] Error uploading or converting avatar:', err);
      alert(lang === 'ar' ? 'حدث خطأ غير متوقع أثناء رفع الصورة.' : 'An unexpected error occurred during avatar upload.');
    } finally {
      setIsUploading(false);
    }
  };

  const [coverInput, setCoverInput] = useState(currentUser.coverPhoto || '');
  const [archetype, setArchetype] = useState(currentUser.archetype);
  const [showQuiz, setShowQuiz] = useState(false);
  
  const [privacyStatus, setPrivacyStatus] = useState(currentUser.privacyStatus || 'public');
  const [dmStatus, setDmStatus] = useState(currentUser.dmStatus || 'everyone');
  const [notificationEnabled, setNotificationEnabled] = useState(currentUser.notificationEnabled ?? true);
  const [notificationPreferences, setNotificationPreferences] = useState(currentUser.notificationPreferences || {
    friendRequests: true,
    outingAlerts: true,
    messages: true
  });
  
  // Photo Picker states & inputs
  const [showPhotoPicker, setShowPhotoPicker] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const cameraInputRef = React.useRef<HTMLInputElement>(null);

  // Emergency contacts state
  const [emergencyContactName, setEmergencyContactName] = useState(currentUser.emergencyContactName || '');
  const [emergencyContactPhone, setEmergencyContactPhone] = useState(currentUser.emergencyContactPhone || '');

  // Additional editable profile fields
  const [bio, setBio] = useState(currentUser.bio || '');
  const [location, setLocation] = useState(currentUser.location || 'Riyadh');
  const [gender, setGender] = useState<'male' | 'female'>(currentUser.gender || 'male');
  const [favoriteFood, setFavoriteFood] = useState(currentUser.favoriteFood || '');
  const [favoritePlayground, setFavoritePlayground] = useState(currentUser.favoritePlayground || '');
  const [sportsTeam, setSportsTeam] = useState(currentUser.sportsTeam || '');
  const [musicPreference, setMusicPreference] = useState(currentUser.musicPreference || '');

  const displayCitiesList = lang === 'ar' ? arabCitiesList : foreignCitiesList;

  const [activeTab, setActiveTab] = useState<'basic' | 'media' | 'interests' | 'safety'>('basic');

  // Verification state & modal triggers
  const [isVerified, setIsVerified] = useState(currentUser.verified);
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [verifyingProgress, setVerifyingProgress] = useState(0);

  const startVerificationMock = () => {
    setCameraActive(true);
    let progressValue = 0;
    const interval = setInterval(() => {
      progressValue += 20;
      setVerifyingProgress(progressValue);
      if (progressValue >= 100) {
        clearInterval(interval);
        setTimeout(() => {
          setIsVerified(true);
          setCameraActive(false);
          setShowVerificationModal(false);
        }, 1000);
      }
    }, 600);
  };

  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'synced' | 'error'>('idle');
  const isMountedRef = React.useRef(false);

  useEffect(() => {
    if (!isMountedRef.current) {
      isMountedRef.current = true;
      return;
    }

    if (usernameStatus === 'checking' || usernameStatus === 'taken' || usernameStatus === 'reserved') {
      return;
    }

    setSyncStatus('syncing');

    const updatedData: Partial<Profile> = {
      name,
      username: username.trim() === '' ? null : username.trim(),
      avatar: avatarInput,
      coverPhoto: coverInput,
      archetype,
      verified: isVerified,
      emergencyContactName,
      emergencyContactPhone,
      hobbies,
      privacyStatus,
      dmStatus,
      notificationEnabled,
      notificationPreferences,
      bio,
      location,
      city: location,
      gender,
      favoriteFood,
      favoritePlayground,
      sportsTeam,
      musicPreference
    };

    const debounceTimer = setTimeout(async () => {
      try {
        if (supabase) {
          const { error } = await supabase
            .from('users')
            .update(updatedData)
            .eq('id', currentUser.id);
          if (error) throw error;
        }

        const freshUser = { ...currentUser, ...updatedData };
        localStorage.setItem('yallamate_current_user', JSON.stringify(freshUser));

        // Dispatch custom sync event to notify parent AppContent without closing modal
        window.dispatchEvent(new CustomEvent('yallamate_user_sync', { detail: updatedData }));

        setSyncStatus('synced');
      } catch (err) {
        console.error('[ProfileEditor AutoSave] error:', err);
        setSyncStatus('error');
      }
    }, 500);

    return () => clearTimeout(debounceTimer);
  }, [
    name,
    username,
    usernameStatus,
    avatarInput,
    coverInput,
    archetype,
    isVerified,
    emergencyContactName,
    emergencyContactPhone,
    hobbies,
    privacyStatus,
    dmStatus,
    notificationEnabled,
    notificationPreferences,
    bio,
    location,
    gender,
    favoriteFood,
    favoritePlayground,
    sportsTeam,
    musicPreference
  ]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-[#0B0E14]/90 backdrop-blur-md z-[80] flex items-center justify-center p-4 overflow-y-auto"
    >
      <AnimatePresence>
        {showQuiz && (
          <PersonalityQuiz
            lang={lang}
            onComplete={(newArchetype) => {
              setArchetype(newArchetype);
              setShowQuiz(false);
            }}
            onClose={() => setShowQuiz(false)}
          />
        )}
      </AnimatePresence>
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        transition={{ type: 'spring', damping: 25, stiffness: 350 }}
        className="bg-[#111622] border border-white/10 w-full max-w-sm rounded-[32px] p-6 shadow-[0_0_40px_rgba(0,0,0,0.8)] relative my-8"
        dir={lang === 'ar' ? 'rtl' : 'ltr'}
      >
        <button
          onClick={onClose}
          className={`absolute top-5 ${lang === 'ar' ? 'left-5' : 'right-5'} p-2 bg-white/5 hover:bg-white/10 rounded-full text-slate-400 hover:text-white transition-all cursor-pointer z-10`}
        >
          <X className="w-4 h-4" />
        </button>

        <h3 className="text-sm font-black text-white uppercase tracking-widest mb-3 px-1 flex items-center justify-between">
          <span className="flex items-center gap-2">
            {lang === 'ar' ? 'تعديل الملف الشخصي' : 'Edit Profile'}
            {syncStatus === 'syncing' && (
              <span className="text-[9px] text-amber-400 lowercase font-mono font-bold flex items-center gap-1 animate-pulse">
                <Loader2 className="w-2.5 h-2.5 animate-spin text-amber-400 shrink-0" />
                {lang === 'ar' ? 'مزامنة...' : 'syncing...'}
              </span>
            )}
            {syncStatus === 'synced' && (
              <span className="text-[9px] text-emerald-400 lowercase font-mono font-bold flex items-center gap-0.5">
                <Check className="w-2.5 h-2.5 text-emerald-400 shrink-0" />
                {lang === 'ar' ? 'تم الحفظ' : 'saved'}
              </span>
            )}
            {syncStatus === 'error' && (
              <span className="text-[9px] text-rose-400 lowercase font-mono font-bold flex items-center gap-0.5">
                <AlertCircle className="w-2.5 h-2.5 text-rose-400 shrink-0" />
                {lang === 'ar' ? 'فشل الحفظ' : 'error'}
              </span>
            )}
          </span>
          <span className="text-[10px] font-mono text-indigo-400">Yalla Mate</span>
        </h3>

        {/* Modern Horizontal Scrollable Tab Bar */}
        <div className="flex gap-1 overflow-x-auto pb-3 mb-4 border-b border-white/5 no-scrollbar scrollbar-none" style={{ scrollbarWidth: 'none' }}>
          {[
            { id: 'basic', labelAr: '👨‍💼 الهوية', labelEn: '👨‍💼 Identity' },
            { id: 'media', labelAr: '🖼️ الوسائط', labelEn: '🖼️ Media' },
            { id: 'interests', labelAr: '🎯 التفضيلات', labelEn: '🎯 Preferences' },
            { id: 'safety', labelAr: '🔐 الأمان', labelEn: '🔐 Safety' }
          ].map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all whitespace-nowrap shrink-0 cursor-pointer border ${
                activeTab === tab.id
                  ? 'bg-indigo-600/25 text-indigo-300 border-indigo-500/30 shadow-md shadow-indigo-600/5'
                  : 'bg-white/[0.02] text-slate-400 border-transparent hover:bg-white/5'
              }`}
            >
              {lang === 'ar' ? tab.labelAr : tab.labelEn}
            </button>
          ))}
        </div>

        <div className="space-y-5">
          {/* TAB 1: IDENTITY & BASIC INFO */}
          {activeTab === 'basic' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              {/* Display name */}
              <div className="space-y-1 text-right" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
                <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest px-1">
                  {lang === 'ar' ? 'اسم العرض' : 'Display Name'}
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-2xl text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all font-bold"
                  dir="auto"
                />
              </div>

              {/* Unique Username */}
              <div className="space-y-1 text-right" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
                <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest px-1">
                  {lang === 'ar' ? 'اسم المستخدم الفريد (@)' : 'Unique Username (@)'}
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className={`w-full px-4 py-2.5 bg-white/5 border rounded-2xl text-xs text-white focus:outline-none transition-all font-mono ${
                      usernameStatus === 'valid'
                        ? 'border-emerald-500/50 focus:ring-1 focus:ring-emerald-500'
                        : usernameStatus === 'taken' || usernameStatus === 'reserved'
                        ? 'border-rose-500/50 focus:ring-1 focus:ring-rose-500'
                        : 'border-white/10 focus:ring-1 focus:ring-indigo-500'
                    }`}
                    dir="ltr"
                  />
                  <div className="absolute inset-y-0 right-3 flex items-center">
                    {usernameStatus === 'checking' && (
                      <Loader2 className="w-3.5 h-3.5 text-slate-400 animate-spin" />
                    )}
                    {usernameStatus === 'valid' && (
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                    )}
                    {(usernameStatus === 'taken' || usernameStatus === 'reserved') && (
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                    )}
                  </div>
                </div>
                {usernameError && (
                  <p className="text-[10px] font-bold text-rose-400 mt-1 px-1">{usernameError}</p>
                )}
                {usernameSuggestions.length > 0 && (
                  <div className="mt-2 space-y-1.5 bg-white/[0.02] border border-white/5 p-2.5 rounded-2xl">
                    <p className="text-[8px] font-extrabold text-slate-500 uppercase tracking-wider mb-1">
                      {lang === 'ar' ? 'اقتراحات متاحة:' : 'Available Suggestions:'}
                    </p>
                    <div className="flex gap-1 flex-wrap">
                      {usernameSuggestions.map((sug, sIdx) => (
                        <button
                          key={sIdx}
                          type="button"
                          onClick={() => setUsername(sug)}
                          className="bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 border border-indigo-500/20 text-[9px] font-bold px-2 py-0.5 rounded-full cursor-pointer transition-all duration-150"
                        >
                          @{sug}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Bio */}
              <div className="space-y-1 text-right" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
                <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest px-1">
                  {lang === 'ar' ? 'النبذة الشخصية (Bio)' : 'Bio / About Me'}
                </label>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-2xl text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all font-medium placeholder-slate-600 resize-none"
                  placeholder={lang === 'ar' ? 'اكتب نبذة قصيرة عن نفسك...' : 'Write a short bio about yourself...'}
                  dir="auto"
                />
              </div>

              {/* Gender Switcher */}
              <div className="space-y-1 text-right" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
                <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest px-1">
                  {lang === 'ar' ? 'الجنس' : 'Gender'}
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setGender('male')}
                    className={`py-2 px-3 border rounded-xl font-bold text-[10px] uppercase tracking-wider transition-all cursor-pointer ${
                      gender === 'male'
                        ? 'border-indigo-500 bg-indigo-500/20 text-indigo-300 shadow-inner'
                        : 'border-white/10 bg-[#0B0E14] hover:bg-white/5 text-slate-400'
                    }`}
                  >
                    🧔 {lang === 'ar' ? 'ذكر' : 'Male'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setGender('female')}
                    className={`py-2 px-3 border rounded-xl font-bold text-[10px] uppercase tracking-wider transition-all cursor-pointer ${
                      gender === 'female'
                        ? 'border-purple-500 bg-purple-500/20 text-purple-300 shadow-inner'
                        : 'border-white/10 bg-[#0B0E14] hover:bg-white/5 text-slate-400'
                    }`}
                  >
                    👩 {lang === 'ar' ? 'أنثى' : 'Female'}
                  </button>
                </div>
              </div>

              {/* Location / City Selection */}
              <div className="space-y-1 text-right" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
                <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest px-1">
                  {lang === 'ar' ? 'المدينة الحالية' : 'Current City'}
                </label>
                <select
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="w-full px-4 py-2.5 bg-[#0B0E14] border border-white/10 rounded-2xl text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 font-bold"
                >
                  {displayCitiesList.map((ac) => (
                    <option key={ac.nameEn} value={ac.nameEn}>
                      {lang === 'ar' ? ac.nameAr : ac.nameEn}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* TAB 2: PROFILE PICTURES & COVER */}
          {activeTab === 'media' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              {/* Avatar Preview & Edit */}
              <div className="flex flex-col items-center gap-3">
                <div 
                  onClick={() => { if (!isUploading) setShowPhotoPicker(true); }}
                  className="w-24 h-24 rounded-[2rem] bg-indigo-500/10 border-2 border-indigo-500/30 flex items-center justify-center text-4xl shadow-lg shadow-indigo-500/10 overflow-hidden relative cursor-pointer group hover:border-indigo-400 transition-all duration-300 hover:scale-105"
                >
                  {isUploading ? (
                    <div className="flex flex-col items-center justify-center gap-1.5">
                      <Loader2 className="w-5 h-5 text-indigo-400 animate-spin" />
                      <span className="text-[8px] text-indigo-300 font-bold uppercase">{lang === 'ar' ? 'جاري الرفع...' : 'Uploading...'}</span>
                    </div>
                  ) : avatarInput.startsWith('http') || avatarInput.startsWith('blob') ? (
                    <img src={avatarInput} className="w-full h-full object-cover" alt="Preview avatar" />
                  ) : (
                    <span className="group-hover:scale-110 transition-transform select-none">{avatarInput}</span>
                  )}
                  
                  {!isUploading && (
                    <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300">
                      <Camera className="w-5 h-5 text-indigo-300 mb-1" />
                      <span className="text-[8px] text-white font-extrabold tracking-wider uppercase">{lang === 'ar' ? 'تعديل الصورة' : 'Change'}</span>
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-xl text-xs font-bold transition-all shadow-sm"
                >
                  {isUploading ? (lang === 'ar' ? 'جاري الرفع...' : 'Uploading...') : (lang === 'ar' ? 'تغيير الصورة الشخصية' : 'Change Profile Picture')}
                </button>

                {/* Hidden native input elements for Photo, Gallery & Camera */}
                <input 
                  type="file" 
                  ref={fileInputRef}
                  accept="image/*" 
                  className="hidden" 
                  onChange={async (e) => {
                    if (e.target.files && e.target.files[0]) {
                      const file = e.target.files[0];
                      await handleAvatarUpload(file);
                    }
                  }}
                />
                <input 
                  type="file" 
                  ref={cameraInputRef}
                  accept="image/*" 
                  capture="user"
                  className="hidden" 
                  onChange={async (e) => {
                    if (e.target.files && e.target.files[0]) {
                      const file = e.target.files[0];
                      await handleAvatarUpload(file);
                    }
                  }}
                />

                <button
                  type="button"
                  disabled={isUploading}
                  onClick={() => setShowPhotoPicker(true)}
                  className="px-4 py-1.5 bg-indigo-500/10 border border-indigo-500/20 rounded-full text-[10px] text-indigo-300 font-extrabold tracking-wide uppercase hover:bg-indigo-500/20 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
                >
                  {isUploading ? (lang === 'ar' ? 'جاري رفع الملف...' : 'Uploading File...') : (lang === 'ar' ? 'تغيير الصورة الشخصية ✨' : 'Change Profile Picture ✨')}
                </button>

                <div className="w-full space-y-1 text-right" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
                  <label className="block text-[8px] font-bold text-slate-500 uppercase tracking-widest px-1">
                    {lang === 'ar' ? 'أو أدخل رابط صورة مخصص' : 'Or Enter Custom Image URL'}
                  </label>
                  <input
                    type="text"
                    value={avatarInput}
                    onChange={(e) => setAvatarInput(e.target.value)}
                    placeholder={lang === 'ar' ? 'أدخل رابط الصورة هنا...' : 'Enter Image URL...'}
                    className="w-full px-4 py-2.5 bg-[#0B0E14] border border-white/5 rounded-2xl text-[10px] text-white focus:outline-none focus:border-indigo-500/50 text-center transition-all font-mono"
                    dir="auto"
                  />
                </div>
              </div>

              {/* Cover Photo Preview & Edit */}
              <div className="flex flex-col items-center gap-3">
                <div className="w-full space-y-1 text-right" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
                  <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest px-1">
                    {lang === 'ar' ? 'صورة الغلاف (Cover Photo)' : 'Cover Photo'}
                  </label>
                  <div 
                    className="w-full h-24 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden relative cursor-pointer group hover:border-indigo-400 transition-all duration-300"
                    onClick={() => {
                      const input = document.createElement('input');
                      input.type = 'file';
                      input.accept = 'image/*';
                      input.onchange = async (e: any) => {
                        if (e.target.files && e.target.files[0]) {
                          const file = e.target.files[0];
                          try {
                            const base64 = await readFileAsDataURL(file);
                            setCoverInput(base64);
                          } catch (err) {
                            console.error("Error reading cover photo:", err);
                          }
                        }
                      };
                      input.click();
                    }}
                  >
                    {coverInput ? (
                      <img src={coverInput} className="w-full h-full object-cover" alt="Cover preview" />
                    ) : (
                      <span className="text-[10px] text-slate-500 font-bold">{lang === 'ar' ? 'اضغط لإضافة صورة غلاف 🖼️' : 'Tap to add cover photo 🖼️'}</span>
                    )}
                    <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300">
                      <Camera className="w-5 h-5 text-indigo-300 mb-1" />
                      <span className="text-[8px] text-white font-extrabold tracking-wider uppercase">{lang === 'ar' ? 'تعديل الغلاف' : 'Change Cover'}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: PREFERENCES & INTERESTS */}
          {activeTab === 'interests' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              {/* Archetype */}
              <div className="space-y-1 text-right" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
                <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest px-1">
                  {lang === 'ar' ? 'النمط الشخصي' : 'Archetype'}
                </label>
                <div className="flex items-center gap-2">
                  <input 
                    type="text" 
                    value={archetype}
                    readOnly
                    className="flex-1 px-4 py-2.5 bg-[#0B0E14] border border-white/10 rounded-2xl text-xs text-white focus:outline-none font-mono font-bold"
                  />
                  <button
                    type="button"
                    onClick={() => setShowQuiz(true)}
                    className="px-4 py-2.5 bg-indigo-600 rounded-2xl text-[10px] text-white font-black hover:bg-indigo-500 transition-all cursor-pointer"
                  >
                    {lang === 'ar' ? 'إعادة الاختبار' : 'Retake'}
                  </button>
                </div>
              </div>

              {/* Current Mood / Emoji Status */}
              <div className="bg-[#182030] border border-indigo-500/10 rounded-3xl p-4 space-y-3 text-right" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
                <div className="flex items-center justify-between">
                  <label className="block text-[10px] font-black text-indigo-400 uppercase tracking-widest">
                    {lang === 'ar' ? 'المزاج الحالي والوضعية' : 'Current Mood & Status'}
                  </label>
                  <span className="text-xl px-1.5 py-0.5 bg-white/5 rounded-lg select-none">{moodEmoji}</span>
                </div>
                
                <div className="grid grid-cols-6 gap-1.5">
                  {['😊', '😎', '☕', '🚀', '😴', '🍿', '🔥', '🧗', '🍔', '🎨', '🎮', '✈️', '🤔', '🎉', '🧘', '🍕', '⚽', '🎒'].map((em) => (
                    <button
                      type="button"
                      key={em}
                      onClick={() => setMoodEmoji(em)}
                      className={`h-8 rounded-xl flex items-center justify-center text-md transition-all active:scale-95 cursor-pointer border ${moodEmoji === em ? 'bg-indigo-600/30 border-indigo-400 scale-105' : 'bg-white/5 hover:bg-white/10 border-white/5'}`}
                    >
                      {em}
                    </button>
                  ))}
                </div>

                <input
                  type="text"
                  value={moodText}
                  onChange={(e) => setMoodText(e.target.value)}
                  maxLength={40}
                  placeholder={lang === 'ar' ? 'اكتب حالتك (مثال: مستعد للقهوة ☕)' : 'Enter status (e.g. Up for Padel 🎾)'}
                  className="w-full px-4 py-2.5 bg-[#0B0E14] border border-white/10 rounded-2xl text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all font-medium"
                  dir="auto"
                />
              </div>

              {/* Hobbies & Interests */}
              <div className="space-y-2 text-right" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
                <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest px-1">
                  {lang === 'ar' ? 'الهوايات والاهتمامات' : 'Hobbies & Interests'}
                </label>
                
                <div className="flex flex-wrap gap-1.5 min-h-[36px] p-2 bg-white/5 border border-white/10 rounded-2xl">
                  {hobbies.length === 0 ? (
                    <span className="text-[10px] text-slate-500 font-bold px-2 py-1 select-none">
                      {lang === 'ar' ? 'لا توجد اهتمامات مضافة بعد' : 'No interests added yet'}
                    </span>
                  ) : (
                    <AnimatePresence>
                      {hobbies.map(h => {
                        const translatedHobby = lang === 'ar' ? (HOBBY_TRANSLATIONS[h] || h) : h;
                        return (
                          <motion.span 
                            key={h} 
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.8, opacity: 0 }}
                            transition={{ type: "spring", stiffness: 500, damping: 30 }}
                            className="px-2 py-1 bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-500/35 text-indigo-300 rounded-xl text-[10px] font-black flex items-center gap-1.5 shadow-sm hover:border-indigo-400 transition-all select-none"
                          >
                            {translatedHobby}
                            <X 
                              className="w-3 h-3 cursor-pointer text-indigo-400 hover:text-white transition-colors" 
                              onClick={() => setHobbies(hobbies.filter(i => i !== h))} 
                            />
                          </motion.span>
                        );
                      })}
                    </AnimatePresence>
                  )}
                </div>

                <div className="relative">
                  <input
                    type="text"
                    value={hobbyInput}
                    onChange={(e) => setHobbyInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ',') {
                        e.preventDefault();
                        const trimmed = hobbyInput.trim().replace(/,$/, '');
                        if (trimmed && !hobbies.includes(trimmed)) {
                          setHobbies([...hobbies, trimmed]);
                          setHobbyInput('');
                        }
                      }
                    }}
                    placeholder={lang === 'ar' ? 'اكتب اهتماماً مخصصاً أو اضغط Enter...' : 'Type interest & hit Enter...'}
                    className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-2xl text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition-all font-bold placeholder-slate-600"
                  />
                  
                  <AnimatePresence>
                    {hobbyInput.trim().length > 0 && (
                      <motion.div 
                        initial={{ opacity: 0, y: -5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -5 }}
                        className="absolute top-full right-0 left-0 bg-[#121625] border border-white/10 rounded-2xl mt-1.5 z-20 shadow-2xl max-h-40 overflow-y-auto divide-y divide-white/5 p-1 scrollbar-thin"
                      >
                        {(() => {
                          const list = PREDEFINED_HOBBIES.filter(h => {
                            const translated = lang === 'ar' ? (HOBBY_TRANSLATIONS[h] || h) : h;
                            const matchQuery = h.toLowerCase().includes(hobbyInput.toLowerCase()) || 
                                               translated.toLowerCase().includes(hobbyInput.toLowerCase());
                            return matchQuery && !hobbies.includes(h);
                          });

                          if (list.length === 0) {
                            return (
                              <button
                                type="button"
                                onClick={() => {
                                  const val = hobbyInput.trim();
                                  if (!hobbies.includes(val)) {
                                    setHobbies([...hobbies, val]);
                                  }
                                  setHobbyInput('');
                                }}
                                className="block w-full text-right px-4 py-2 text-[10px] font-black text-indigo-400 hover:bg-white/5 transition-colors cursor-pointer"
                              >
                                {lang === 'ar' ? `اضافة "${hobbyInput}" كاهتمام مخصص ✨` : `Add "${hobbyInput}" as custom interest ✨`}
                              </button>
                            );
                          }

                          return list.map(h => {
                            const label = lang === 'ar' ? (HOBBY_TRANSLATIONS[h] || h) : h;
                            return (
                              <button
                                type="button"
                                key={h}
                                onClick={() => {
                                  setHobbies([...hobbies, h]);
                                  setHobbyInput('');
                                }}
                                className="block w-full text-right px-4 py-2 text-xs text-slate-300 hover:text-white hover:bg-white/10 transition-colors font-bold cursor-pointer"
                              >
                                + {label}
                              </button>
                            );
                          });
                        })()}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
                
                {/* Quick Suggestions Shelf */}
                <div className="pt-1">
                  <span className="text-[8px] font-bold text-slate-500 block mb-1">
                    {lang === 'ar' ? 'توصيات سريعة للمطابقة:' : 'Recommended for Matching:'}
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {PREDEFINED_HOBBIES.filter(h => !hobbies.includes(h)).slice(0, 5).map(h => {
                      const label = lang === 'ar' ? (HOBBY_TRANSLATIONS[h] || h) : h;
                      return (
                        <button
                          type="button"
                          key={h}
                          onClick={() => setHobbies([...hobbies, h])}
                          className="px-2 py-0.5 bg-white/5 hover:bg-indigo-600/20 border border-white/5 hover:border-indigo-500/30 text-slate-400 hover:text-indigo-300 rounded-lg text-[9px] font-bold transition-all cursor-pointer"
                        >
                          + {label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Favorite Food */}
              <div className="space-y-1 text-right" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
                <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest px-1">
                  {lang === 'ar' ? 'الأكلة المفضلة 🍔' : 'Favorite Food 🍔'}
                </label>
                <input
                  type="text"
                  value={favoriteFood}
                  onChange={(e) => setFavoriteFood(e.target.value)}
                  placeholder={lang === 'ar' ? 'مثال: شاورما، برجر' : 'e.g. Shawarma, Sushi'}
                  className="w-full px-4 py-2 bg-[#0B0E14] border border-white/10 rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-bold"
                  dir="auto"
                />
              </div>

              {/* Favorite Playground / Spot */}
              <div className="space-y-1 text-right" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
                <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest px-1">
                  {lang === 'ar' ? 'المكان/الملعب المفضل 🧗' : 'Favorite Spot / Playground 🧗'}
                </label>
                <input
                  type="text"
                  value={favoritePlayground}
                  onChange={(e) => setFavoritePlayground(e.target.value)}
                  placeholder={lang === 'ar' ? 'مثال: ملعب بادل، مقهى...' : 'e.g. Padel Court, Starbucks'}
                  className="w-full px-4 py-2 bg-[#0B0E14] border border-white/10 rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-bold"
                  dir="auto"
                />
              </div>

              {/* Sports Team */}
              <div className="space-y-1 text-right" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
                <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest px-1">
                  {lang === 'ar' ? 'النادي الرياضي المفضل ⚽' : 'Favorite Sports Team ⚽'}
                </label>
                <input
                  type="text"
                  value={sportsTeam}
                  onChange={(e) => setSportsTeam(e.target.value)}
                  placeholder={lang === 'ar' ? 'مثال: الهلال، النصر، ريال مدريد' : 'e.g. Al-Hilal, Real Madrid'}
                  className="w-full px-4 py-2 bg-[#0B0E14] border border-white/10 rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-bold"
                  dir="auto"
                />
              </div>

              {/* Music Preference */}
              <div className="space-y-1 text-right" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
                <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest px-1">
                  {lang === 'ar' ? 'الفنان أو النوع الموسيقي المفضل 🎵' : 'Favorite Artist or Genre 🎵'}
                </label>
                <input
                  type="text"
                  value={musicPreference}
                  onChange={(e) => setMusicPreference(e.target.value)}
                  placeholder={lang === 'ar' ? 'مثال: عبدالمجيد، راشد، هادئ...' : 'e.g. Rashed, Lo-Fi, Pop'}
                  className="w-full px-4 py-2 bg-[#0B0E14] border border-white/10 rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-bold"
                  dir="auto"
                />
              </div>
            </div>
          )}

          {/* TAB 4: SAFETY, PRIVACY & SOS */}
          {activeTab === 'safety' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              {/* Privacy & Notifications */}
              <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-4">
                <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider block border-b border-white/5 pb-2">
                  {lang === 'ar' ? 'إعدادات الحساب' : 'Account Settings'}
                </span>
                
                {/* Notifications Toggle */}
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-300">{lang === 'ar' ? 'الإشعارات العامة' : 'Enable Notifications'}</span>
                    <button
                      type="button"
                      onClick={() => setNotificationEnabled(!notificationEnabled)}
                      className={`w-10 h-6 rounded-full transition-colors cursor-pointer ${notificationEnabled ? 'bg-indigo-600' : 'bg-slate-600'}`}
                    >
                        <div className={`w-4 h-4 rounded-full bg-white transition-transform ${notificationEnabled ? 'translate-x-5' : 'translate-x-1'}`} />
                    </button>
                  </div>
                  
                  {notificationEnabled && (
                    <div className="pl-2 pr-2 border-l-2 border-indigo-500/30 flex flex-col gap-3 ml-2 mt-1 mb-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-slate-400">{lang === 'ar' ? 'طلبات الصداقة' : 'Friend Requests'}</span>
                        <button
                          type="button"
                          onClick={() => setNotificationPreferences({...notificationPreferences, friendRequests: !notificationPreferences.friendRequests})}
                          className={`w-8 h-5 rounded-full transition-colors cursor-pointer ${notificationPreferences.friendRequests ? 'bg-indigo-500' : 'bg-slate-700'}`}
                        >
                            <div className={`w-3 h-3 rounded-full bg-white transition-transform ${notificationPreferences.friendRequests ? 'translate-x-4' : 'translate-x-1'}`} />
                        </button>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-slate-400">{lang === 'ar' ? 'تنبيهات الطلعات' : 'Outing Alerts'}</span>
                        <button
                          type="button"
                          onClick={() => setNotificationPreferences({...notificationPreferences, outingAlerts: !notificationPreferences.outingAlerts})}
                          className={`w-8 h-5 rounded-full transition-colors cursor-pointer ${notificationPreferences.outingAlerts ? 'bg-indigo-500' : 'bg-slate-700'}`}
                        >
                            <div className={`w-3 h-3 rounded-full bg-white transition-transform ${notificationPreferences.outingAlerts ? 'translate-x-4' : 'translate-x-1'}`} />
                        </button>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-slate-400">{lang === 'ar' ? 'الرسائل' : 'Messages'}</span>
                        <button
                          type="button"
                          onClick={() => setNotificationPreferences({...notificationPreferences, messages: !notificationPreferences.messages})}
                          className={`w-8 h-5 rounded-full transition-colors cursor-pointer ${notificationPreferences.messages ? 'bg-indigo-500' : 'bg-slate-700'}`}
                        >
                            <div className={`w-3 h-3 rounded-full bg-white transition-transform ${notificationPreferences.messages ? 'translate-x-4' : 'translate-x-1'}`} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Privacy Toggle */}
                <div className="flex items-center justify-between p-3 bg-[#0B0E14] border border-white/5 rounded-2xl">
                  <div>
                    <label className="block text-xs font-black text-white">{lang === 'ar' ? 'حساب عام' : 'Public Profile'}</label>
                    <span className="text-[10px] text-slate-400 font-medium">
                      {lang === 'ar' ? 'يسمح بقبول طلبات الصداقة تلقائياً' : 'Auto-accept friend requests'}
                    </span>
                  </div>
                  <button 
                    type="button"
                    onClick={() => setPrivacyStatus(privacyStatus === 'public' ? 'private' : 'public')}
                    className={`w-12 h-6 rounded-full transition-colors flex items-center shrink-0 cursor-pointer ${privacyStatus === 'public' ? 'bg-indigo-500' : 'bg-white/10 border border-white/5'}`}
                  >
                      <div className={`w-4 h-4 rounded-full bg-white transition-transform ${privacyStatus === 'public' ? 'translate-x-7' : 'translate-x-1'}`} />
                  </button>
                </div>
                
                {/* DM Status Select */}
                <div className="space-y-1">
                  <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest">{lang === 'ar' ? 'الرسائل المباشرة' : 'Direct Messages'}</label>
                  <select
                    value={dmStatus}
                    onChange={(e) => setDmStatus(e.target.value as 'everyone' | 'followers')}
                    className="w-full px-3 py-2 bg-[#0B0E14] border border-white/10 rounded-xl text-xs text-white font-bold"
                  >
                    <option value="everyone">{lang === 'ar' ? 'للجميع' : 'Everyone'}</option>
                    <option value="followers">{lang === 'ar' ? 'للمتابعين فقط' : 'Followers Only'}</option>
                  </select>
                </div>
              </div>

              {/* Verification section */}
              <div className="p-4 bg-white/5 border border-white/10 rounded-2xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-white uppercase tracking-wider">
                    {lang === 'ar' ? 'توثيق الهوية لضمان الأمان 🔐' : 'Account Verification Badge 🔐'}
                  </span>
                  {isVerified ? (
                    <span className="bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 text-[9px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1.5 shrink-0">
                      <ShieldCheck className="w-3.5 h-3.5 animate-pulse" />
                      {lang === 'ar' ? 'موثق' : 'Verified ID'}
                    </span>
                  ) : (
                    <span className="bg-rose-500/20 text-rose-400 border border-rose-500/30 text-[9px] font-bold px-2 py-0.5 rounded-full flex items-center shrink-0">
                      {lang === 'ar' ? 'غير موثق' : 'Unverified'}
                    </span>
                  )}
                </div>

                <p className="text-[10px] text-slate-400 leading-normal text-right">
                  {lang === 'ar' 
                    ? 'توثيق الحساب يحميك من الحسابات الوهمية ويفتح لك ميزة الانضمام للمشاوير المشتركة المختلطة.' 
                    : 'Account checking grants higher trust and prevents fake/bot account parameters.'}
                </p>

                {!isVerified && (
                  <button
                    type="button"
                    onClick={() => setShowVerificationModal(true)}
                    className="w-full py-2 bg-indigo-600/20 hover:bg-indigo-600 border border-indigo-500/30 text-indigo-300 hover:text-white rounded-xl text-[10px] font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <ShieldCheck className="w-3.5 h-3.5" />
                    {lang === 'ar' ? 'ابدأ توثيق الهوية فوراً' : 'Verify My Identity Now'}
                  </button>
                )}
              </div>

              {/* Emergency contacts block */}
              <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-2 text-right">
                <span className="text-[10px] font-bold text-rose-400 uppercase tracking-wider flex items-center gap-1">
                  <PhoneCall className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                  {lang === 'ar' ? 'رقم الطوارئ الموثوق (مشاركة الموقع)' : 'Trusted Emergency SOS Connection'}
                </span>
                <p className="text-[9px] text-slate-400 leading-relaxed">
                  {lang === 'ar' 
                    ? 'يستخدم للتواصل الفوري ومشاركة الموقع بزر طوارئ نقرة واحدة أثناء الطلعات في حال حدوث أي مستجد طارئ.' 
                    : 'Used to send emergency location sharing instantly with a trusted pal upon any unexpected situations.'}
                </p>
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div className="space-y-1 text-right">
                    <span className="text-[8px] text-slate-500 font-bold block">{lang === 'ar' ? 'اسم الشخص' : 'Contact Name'}</span>
                    <input
                      type="text"
                      value={emergencyContactName}
                      onChange={(e) => setEmergencyContactName(e.target.value)}
                      placeholder={lang === 'ar' ? 'مثال: أبو محمد' : 'e.g. Papa'}
                      className="w-full px-3 py-2 bg-[#0B0E14] border border-white/10 rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                  <div className="space-y-1 text-right">
                    <span className="text-[8px] text-slate-500 font-bold block">{lang === 'ar' ? 'رقم الهاتف' : 'Phone Number'}</span>
                    <input
                      type="text"
                      value={emergencyContactPhone}
                      onChange={(e) => setEmergencyContactPhone(e.target.value)}
                      placeholder="+966..."
                      className="w-full px-3 py-2 bg-[#0B0E14] border border-white/10 rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Persistent Save Button always at the bottom of the form container */}
          <button
            disabled={usernameStatus !== 'valid'}
            onClick={() => onSave({ 
              name, 
              username: username.trim() === '' ? null : username.trim(),
              avatar: avatarInput,
              coverPhoto: coverInput,
              archetype,
              verified: isVerified,
              emergencyContactName,
              emergencyContactPhone,
              hobbies,
              privacyStatus,
              dmStatus,
              notificationEnabled,
              notificationPreferences,
              moodEmoji,
              moodText,
              bio,
              location,
              city: location, // Sync both city and location fields to fix geocoding & suggestions discrepancy!
              gender,
              favoriteFood,
              favoritePlayground,
              sportsTeam,
              musicPreference
            })}
            className="w-full mt-4 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-50 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl flex items-center justify-center gap-2 cursor-pointer transition-all border border-indigo-400/30 hover:-translate-y-0.5"
          >
            <Check className="w-4 h-4" />
            {lang === 'ar' ? 'حفظ التعديلات' : 'Save Profile'}
          </button>
        </div>
      </motion.div>

      {/* Account ID/Verification check visual modal */}
      <AnimatePresence>
        {showVerificationModal && (
          <div className="fixed inset-0 bg-black/95 z-[99] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-[#111622] border border-white/10 rounded-3xl p-6 max-w-sm w-full text-center space-y-5"
            >
              <h4 className="text-md font-black text-white flex items-center justify-center gap-1.5">
                <ShieldCheck className="w-5 h-5 text-indigo-400" />
                {lang === 'ar' ? 'التحقق السريع ومكافحة الانتحال' : 'Verify Identity Check'}
              </h4>

              {cameraActive ? (
                <div className="space-y-4">
                  {/* Mock Camera live viewport */}
                  <div className="relative w-40 h-40 mx-auto rounded-full overflow-hidden border-4 border-indigo-500 animate-pulse bg-slate-900 flex items-center justify-center">
                    <span className="text-4xl">🧑‍💻</span>
                    <div className="absolute inset-0 border-t-2 border-indigo-400 h-full w-full bg-indigo-500/5 animate-bounce"></div>
                  </div>
                  <div>
                    <span className="text-xs text-indigo-400 font-black block">{lang === 'ar' ? 'جاري مطابقة تفاصيل ملامح الوجه...' : 'Analyzing face landmarks...'}</span>
                    <div className="w-24 h-1.5 bg-white/5 rounded-full mx-auto mt-2 overflow-hidden border border-white/10">
                      <div className="bg-indigo-50 h-full rounded-full" style={{ width: `${verifyingProgress}%` }} />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="p-3.5 bg-indigo-500/5 border border-indigo-500/20 rounded-2xl text-[10px] text-slate-300 leading-normal text-left space-y-1.5">
                    <p className="font-bold text-white flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5 text-indigo-400" /> {lang === 'ar' ? 'كيف يعمل؟' : 'How does it protect?'}</p>
                    <p>{lang === 'ar' ? '1. نقوم بتطابق سريع لصورتك لضمان عدم إنشاء حسابات روبوتية وهمية.' : '1. Prevents bots and ensures actual real human companions.'}</p>
                    <p>{lang === 'ar' ? '2. تحصل على شارة زرقاء فورا في صفحتك وتجذب رفاق ملتزمين.' : '2. Instantly boosts profile visibility and updates reputation.'}</p>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowVerificationModal(false)}
                      className="flex-1 py-2 rounded-xl bg-white/5 border border-white/5 text-xs font-bold text-slate-400 hover:text-white"
                    >
                      {lang === 'ar' ? 'إلغاء' : 'Cancel'}
                    </button>
                    <button
                      onClick={startVerificationMock}
                      className="flex-1 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-black text-xs text-white"
                    >
                      {lang === 'ar' ? 'تفعيل الكاميرا 📸' : 'Open Camera 📸'}
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Photo Picker Drawer */}
      <AnimatePresence>
        {showPhotoPicker && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[99] flex items-end sm:items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, y: 100 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 100 }}
              className="bg-[#111622] border border-white/10 w-full max-w-sm rounded-[32px] p-6 shadow-2xl relative text-right"
              dir={lang === 'ar' ? 'rtl' : 'ltr'}
            >
              <button
                onClick={() => setShowPhotoPicker(false)}
                className={`absolute top-4 ${lang === 'ar' ? 'left-4' : 'right-4'} p-1.5 bg-white/5 hover:bg-white/10 rounded-full text-slate-400 hover:text-white cursor-pointer`}
              >
                <X className="w-4 h-4" />
              </button>

              <h4 className="text-sm font-black text-white uppercase tracking-widest mb-4">
                {lang === 'ar' ? 'تعديل الصورة الشخصية' : 'Change Profile Photo'}
              </h4>

              <div className="space-y-3">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full p-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl flex items-center gap-3 text-xs text-white font-bold transition-all cursor-pointer"
                >
                  <span className="text-xl">🖼️</span>
                  <div className="text-right flex-1">
                    <p>{lang === 'ar' ? 'إضافة من معرض الصور (الاستوديو)' : 'Choose from Gallery (Photos)'}</p>
                    <p className="text-[10px] text-slate-400 font-medium">{lang === 'ar' ? 'اختر صورة من مكتبة هاتفك الشخصية' : 'Select a photo from your library'}</p>
                  </div>
                </button>

                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full p-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl flex items-center gap-3 text-xs text-white font-bold transition-all cursor-pointer"
                >
                  <span className="text-xl">📁</span>
                  <div className="text-right flex-1">
                    <p>{lang === 'ar' ? 'إضافة من ملفات الهاتف (المستندات)' : 'Upload from Phone Files'}</p>
                    <p className="text-[10px] text-slate-400 font-medium">{lang === 'ar' ? 'تصفح الملفات والذاكرة الداخلية لهاتفك' : 'Pick a photo from internal storage'}</p>
                  </div>
                </button>

                <button
                  onClick={() => cameraInputRef.current?.click()}
                  className="w-full p-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl flex items-center gap-3 text-xs text-white font-bold transition-all cursor-pointer"
                >
                  <span className="text-xl">📸</span>
                  <div className="text-right flex-1">
                    <p>{lang === 'ar' ? 'التقاط صورة مباشرة بالكاميرا' : 'Take selfie with Camera'}</p>
                    <p className="text-[10px] text-slate-400 font-medium">{lang === 'ar' ? 'افتح الكاميرا الأمامية لالتقاط ملامحك فورا' : 'Capture a brand new selfie'}</p>
                  </div>
                </button>

                <div className="border-t border-white/10 pt-4 text-right">
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold mb-2">
                    {lang === 'ar' ? 'أو اختر رمزاً كرتونياً سريعاً:' : 'Or select a quick emoji preset:'}
                  </p>
                  <div className="grid grid-cols-8 gap-2">
                    {['🔥', '🦅', '🦁', '🌟', '🦄', '🏄‍♂️', '🚀', '🎸', '🎨', '🍕', '🎮', '🐯', '🦊', '🐱', '🐶', '✈️'].map((em) => (
                      <button
                        type="button"
                        key={em}
                        onClick={() => {
                          setAvatarInput(em);
                          setShowPhotoPicker(false);
                        }}
                        className="w-8 h-8 rounded-xl bg-white/5 hover:bg-indigo-600 border border-white/5 flex items-center justify-center text-md transition-all active:scale-95 cursor-pointer"
                      >
                        {em}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

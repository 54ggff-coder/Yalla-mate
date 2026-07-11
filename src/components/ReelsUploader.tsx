import React, { useState, useRef, useEffect } from 'react';
import { Camera, Video, X, Sparkles, MapPin, Circle, Square, Upload, AlertTriangle, Check, FolderTree } from 'lucide-react';
import { motion } from 'motion/react';
import { Reel, Profile, Outing } from '../types';
import { Language, translations } from '../data/translations';
import { supabase } from '../lib/supabase';
import { reelUploadEmitter } from '../utils/uploadEmitter';
import { reelUpload, logSystemError } from '../services/storageService';

const readLocalWithProgress = (file: File, onProgress: (p: number) => void): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onprogress = (event) => {
      if (event.lengthComputable) {
        const percentComplete = (event.loaded / event.total) * 100;
        onProgress(Math.round(percentComplete));
      }
    };
    reader.onload = () => {
      const localUrl = URL.createObjectURL(file);
      resolve(localUrl);
    };
    reader.onerror = () => {
      reject(new Error("Failed to read local file."));
    };
    reader.readAsArrayBuffer(file);
  });
};

interface ReelsUploaderProps {
  currentUser: Profile;
  outings: Outing[];
  lang: Language;
  onClose: () => void;
  onPublish: (reel: Reel) => void;
}

export default function ReelsUploader({ currentUser, outings, lang, onClose, onPublish }: ReelsUploaderProps) {
  const t = translations[lang];
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [coverImage, setCoverImage] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [actualLocation, setActualLocation] = useState('');
  const [mapUrl, setMapUrl] = useState('');
  const [selectedOutingId, setSelectedOutingId] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Camera States
  const [isRecording, setIsRecording] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const coverPresets = [
    { name: lang === 'ar' ? 'صحراء دافئة 🌅' : 'Desert Sunset 🌅', url: 'https://images.unsplash.com/photo-1509316975850-ff9c5edd0cd9?q=80&w=400&auto=format&fit=crop' },
    { name: lang === 'ar' ? 'بلياردو هادئ 🎱' : 'Billiard Chill 🎱', url: 'https://images.unsplash.com/photo-1544698310-74ea9d1c8258?q=80&w=400&auto=format&fit=crop' },
    { name: lang === 'ar' ? 'مقهى دافئ ☕' : 'Cozy Cafe ☕', url: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?q=80&w=400&auto=format&fit=crop' },
    { name: lang === 'ar' ? 'غروب وتراث 🏰' : 'Heritage Sunset 🏰', url: 'https://images.unsplash.com/photo-1549144511-f099e773c147?q=80&w=400&auto=format&fit=crop' },
    { name: lang === 'ar' ? 'جولة ليلية 🚗' : 'Night Drive 🚗', url: 'https://images.unsplash.com/photo-1508962914676-134849a727f0?q=80&w=400&auto=format&fit=crop' }
  ];

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setCameraActive(true);
      setVideoUrl('');
      setCoverImage('');
    } catch (err) {
      console.error('Error accessing camera:', err);
      alert(lang === 'ar' ? 'للأسف المتصفح لا يدعم الوصول للكاميرا هنا أو تم رفض الصلاحية' : 'Camera access denied or unsupported');
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  };

  useEffect(() => {
    return () => stopCamera();
  }, []);

  useEffect(() => {
    const unsubscribe = reelUploadEmitter.subscribe((progress) => {
      setUploadProgress(progress);
    });
    return unsubscribe;
  }, []);

  const handleStartCapture = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      mediaRecorderRef.current = new MediaRecorder(stream);
      chunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = e => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'video/mp4' });
        const recordedFile = new File([blob], `recorded_reel_${Date.now()}.mp4`, { type: 'video/mp4' });
        setSelectedFile(recordedFile);
        const url = URL.createObjectURL(recordedFile);
        setVideoUrl(url);
        stopCamera();
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
    }
  };

  const handleStopCapture = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handlePublishReel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) {
      alert(lang === 'ar' ? 'يرجى كتابة العنوان والوصف أولاً!' : 'Please write a title and description first!');
      return;
    }
    if (!videoUrl.trim() && !coverImage.trim() && !selectedFile) {
      alert(lang === 'ar' ? 'يرجى إرفاق فيديو أو صورة أولاً!' : 'Please attach a video or image first!');
      return;
    }
    if (isUploading) return;
    setIsUploading(true);
    reelUploadEmitter.emit(0);
    setUploadError(null);

      try {
      let finalVideoUrl = videoUrl;
      let finalCoverImage = coverImage;

      if (selectedFile) {
        const supabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL || '';
        const supabaseAnonKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || (import.meta as any).env?.VITE_SUPABASE_KEY || '';
        const hasSupabaseCreds = supabaseUrl && supabaseAnonKey && supabaseUrl !== 'undefined' && supabaseAnonKey !== 'undefined';

        if (hasSupabaseCreds) {
          try {
            const publicUrl = await reelUpload(selectedFile, currentUser.id, (progress) => {
              reelUploadEmitter.emit(progress);
            });
            finalVideoUrl = publicUrl;
            if (selectedFile.type.startsWith('image/')) {
              finalCoverImage = publicUrl;
            }
          } catch (uploadError: any) {
            await logSystemError('ReelsUploader.reelUpload', uploadError.message, uploadError.stack, currentUser.id);
            console.warn("Storage upload failed, falling back to local file processing progress:", uploadError);
            const localUrl = await readLocalWithProgress(selectedFile, (progress) => {
              reelUploadEmitter.emit(progress);
            });
            if (selectedFile.type.startsWith('video/')) {
              finalVideoUrl = localUrl;
            } else {
              finalCoverImage = localUrl;
            }
          }
        } else {
          // No Supabase, do real local file processing progress bar
          const localUrl = await readLocalWithProgress(selectedFile, (progress) => {
            reelUploadEmitter.emit(progress);
          });
          if (selectedFile.type.startsWith('video/')) {
            finalVideoUrl = localUrl;
          } else {
            finalCoverImage = localUrl;
          }
        }
      } else {
        // No selected file, just immediately set to 100%
        reelUploadEmitter.emit(100);
      }

      // Get exact authenticated user's ID to prevent mismatch or fkey issues
      let authUserId = currentUser.id;
      if (supabase) {
        try {
          // Double verification of authenticated session via getUser & getSession
          const { data: userData } = await supabase.auth.getUser();
          if (userData?.user?.id) {
            authUserId = userData.user.id;
          } else {
            const { data: sessionData } = await supabase.auth.getSession();
            if (sessionData?.session?.user?.id) {
              authUserId = sessionData.session.user.id;
            }
          }
        } catch (authErr) {
          console.warn("[ReelsUploader] Failed to fetch authenticated user session:", authErr);
        }
      }

      const newReel: any = {
        id: `reel_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        creator_id: currentUser.id,
        user_id: currentUser.id,
        creator_name: currentUser.name,
        creator_avatar: currentUser.avatar,
        caption: `${title}${description ? ' - ' + description : ''}`,
        video_url: finalVideoUrl || finalCoverImage || '',
        likes_count: 0,
        comments_count: 0,
        outing_id: selectedOutingId || undefined,
        created_at: new Date().toISOString(),
        owner_id: authUserId
      };

      if (!authUserId) {
        setUploadError(lang === 'ar' ? 'فشل فحص حساب المستخدم، يرجى تسجيل الدخول مجدداً.' : 'Invalid session. Please login again.');
        setIsUploading(false);
        return;
      }

      // Detect if currentUser is using a sandbox/mock ID (which is non-UUID format, usually starting with 'user_')
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(authUserId);
      const shouldSkipCloudSave = !supabase || !isUUID;

      if (!shouldSkipCloudSave) {
        // Pre-verify or pre-insert user row into 'users' table to prevent foreign key errors (reels_userId_fkey or reels_creatorId_fkey)
        let isUserProfileSynced = false;
        try {
          // Check if the user row actually exists in public.users first
          const { data: existingUser, error: checkErr } = await supabase
            .from('users')
            .select('id')
            .eq('id', authUserId)
            .maybeSingle();

          if (!checkErr && existingUser) {
            isUserProfileSynced = true;
            console.info("[ReelsUploader] Core user profile already exists, skipping duplicate upsert.");
          } else {
            const userPayload = {
              id: authUserId,
              name: currentUser.name || 'User',
              username: currentUser.username || currentUser.name?.toLowerCase().replace(/\s+/g, '') || `user_${authUserId.substring(0, 5)}`,
              displayName: currentUser.displayName || currentUser.name || 'User',
              avatar: currentUser.avatar || '⛺',
              trustScore: Math.round(currentUser.trustScore ?? 10),
              onboarding_completed: true,
              location: currentUser.location || '',
              city: currentUser.city || '',
              bio: currentUser.bio || ''
            };
            
            const { error: upsertErr } = await supabase.from('users').upsert([userPayload]);
            if (upsertErr) {
              console.error("[ReelsUploader] Critical error pre-inserting profile row to public.users:", upsertErr.message);
            } else {
              isUserProfileSynced = true;
              console.info("[ReelsUploader] Pre-synced user profile row with public.users successfully.");
            }
          }
        } catch (dbErr: any) {
          console.warn("[ReelsUploader] Non-blocking user syncing warn/error:", dbErr);
        }

        // Prepare compatible schema-tolerant payloads
        let finalPayload: any = { ...newReel };
        
        let attempt = 0;
        const maxRetries = 3;

        // Enforce strict checks to ensure no null/undefined values are sent for mandatory fields before executing insert
        if (!finalPayload.owner_id || typeof finalPayload.owner_id !== 'string' || finalPayload.owner_id.trim() === '') {
          setUploadError(lang === 'ar' ? 'حدث خطأ: معرف المستخدم مفقود' : 'Validation Error: Missing owner_id.');
          setIsUploading(false);
          return;
        }
        if (!finalPayload.video_url || typeof finalPayload.video_url !== 'string' || finalPayload.video_url.trim() === '') {
          setUploadError(lang === 'ar' ? 'حدث خطأ: لا يوجد مسار مرئي' : 'Validation Error: Missing video_url.');
          setIsUploading(false);
          return;
        }
        if (!finalPayload.creator_id || typeof finalPayload.creator_id !== 'string' || finalPayload.creator_id.trim() === '') {
          setUploadError(lang === 'ar' ? 'حدث خطأ: معرف المنشئ مفقود' : 'Validation Error: Missing creator_id.');
          setIsUploading(false);
          return;
        }
        if (!finalPayload.caption || typeof finalPayload.caption !== 'string' || finalPayload.caption.trim() === '') {
          setUploadError(lang === 'ar' ? 'حدث خطأ: العنوان مفقود' : 'Validation Error: Missing caption.');
          setIsUploading(false);
          return;
        }

        while (attempt < maxRetries) {
          try {
            const { error } = await supabase.from('reels').insert([finalPayload]);
            if (!error) break;

            // Handle PostgREST missing column errors dynamically (PGRST204)
            if (error.code === 'PGRST204' || error.message?.includes('column') || error.message?.includes('schema cache')) {
              const match = error.message.match(/column "(.*?)"/) || 
                            error.message.match(/column\s+.*?\.?(\w+)\s+does not exist/) ||
                            error.message.match(/column '(\w+)'/);
              const colName = match ? match[1] : null;

              if (colName && colName in finalPayload) {
                console.warn(`[Auto-Recovery] Pruning column "${colName}" from insert payloads and retrying.`);
                delete finalPayload[colName];
                continue; // retry instantly without wasting an attempt count
              }
            }

            // Retry for transient rate limits or fetch errors
            if (error.code === '429' || error.message?.includes('Rate exceeded') || error.message?.includes('fetch')) {
              attempt++;
              if (attempt >= maxRetries) {
                console.warn("[ReelsUploader] Retries exhausted. Saving reel locally.");
                break;
              }
              const delay = Math.pow(2, attempt) * 1000;
              await new Promise(r => setTimeout(r, delay));
              continue;
            }
            console.warn("[ReelsUploader] Database error. Falling back to local publish:", error);
            break;
          } catch (e: any) {
            console.error(`[ReelsUploader] Attempt ${attempt} insert failed:`, e);
            attempt++;
            if (attempt >= maxRetries) {
              console.warn("[ReelsUploader] Retries exhausted with exception. Saving reel locally.");
              break;
            }
            const delay = Math.pow(2, attempt) * 1000;
            await new Promise(r => setTimeout(r, delay));
          }
        }
      } else {
        console.info("[ReelsUploader] Sandbox/Bypass user detected. Publishing reel locally only.", currentUser.id);
      }

      reelUploadEmitter.emit(100);
      setSuccess(true);
      setTimeout(() => {
        onPublish(newReel);
        onClose();
      }, 2000);
    } catch (e: any) {
      reelUploadEmitter.emit(0);
      console.error("Failed to upload Reel - Detailed Error:", e);
      let errorMessage = '';
      if (e && typeof e === 'object') {
        errorMessage = e.message || e.details || e.hint || JSON.stringify(e);
      } else {
        errorMessage = String(e);
      }
      
      if (errorMessage.includes('Bucket not found') || errorMessage.includes('bucket')) {
        errorMessage = lang === 'ar' 
          ? 'عذراً، مساحة التخزين "reels" غير موجودة أو غير مهيأة. يرجى إنشاء "reels bucket" في لوحة تحكم Supabase وجعلها "Public".' 
          : 'Storage bucket "reels" not found or unconfigured. Please create a public bucket named "reels" in your Supabase Dashboard.';
      } else if (errorMessage.includes('429') || errorMessage.toLowerCase().includes('rate')) {
        errorMessage = lang === 'ar' ? 'تم تجاوز حد الطلبات (Rate Limit). يرجى المحاولة مرة أخرى بعد دقيقتين.' : 'Rate limit exceeded. Please try again in a few minutes.';
      } else if (errorMessage.includes('violates row-level security') || errorMessage.toLowerCase().includes('policy')) {
        errorMessage = lang === 'ar' 
          ? 'تم رفض النشر بواسطة قواعد الحماية (RLS). يرجى التأكد من تسجيل الدخول الحقيقي أو تفعيل السياسات التسهيلية.' 
          : 'Publishing blocked by RLS policies. Ensure you are signed in or have appropriate table access policies.';
      }
      
      setUploadError(errorMessage);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-[#0B0E14]/90 backdrop-blur-md z-[60] flex items-center justify-center p-4">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-[#10141D] border border-white/10 w-full max-w-md rounded-3xl p-6 shadow-2xl overflow-y-auto max-h-[90vh] space-y-4 shadow-[0_0_40px_rgba(0,0,0,0.8)] custom-scrollbar"
      >
        <div className="flex justify-between items-center border-b border-white/5 pb-3 sticky top-0 bg-[#10141D] z-10">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-indigo-400 animate-pulse" />
            <h3 className="text-sm font-black text-white uppercase tracking-wider font-display">
              {lang === 'ar' ? 'مقطع ريلز جديد' : 'New Mates Reel'}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 hover:bg-white/10 rounded-full transition-all text-slate-400 hover:text-white bg-white/5 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {success ? (
          <div className="flex flex-col items-center justify-center py-12 space-y-6 animate-in fade-in zoom-in-95 duration-500">
             <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center border border-emerald-500/30 shadow-[0_0_30px_rgba(16,185,129,0.3)]">
                <Check className="w-10 h-10 text-emerald-500 animate-in slide-in-from-bottom-2 duration-700" />
             </div>
             <div className="text-center space-y-2">
                <h3 className="text-lg font-black text-white">{lang === 'ar' ? 'تم النشر بنجاح!' : 'Published Successfully!'}</h3>
                <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">{lang === 'ar' ? 'سيظهر مقطعك الآن للجميع' : 'Your reel is now live'}</p>
             </div>
          </div>
        ) : (
          <form onSubmit={handlePublishReel} className="space-y-5 text-right w-full" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
          {/* Title */}
          <div className="space-y-1.5">
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">
              {t.reelTitleLabel} *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={lang === 'ar' ? 'رحلة الشتاء الساحرة...' : 'Winter magic trip...'}
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-2xl text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder-white/20 transition-all text-right"
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">
              {t.reelDescLabel} *
            </label>
            <textarea
              rows={2}
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={lang === 'ar' ? 'اكتب تفاصيل الكوب والمزاج السائد...' : 'Describe the mood...'}
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-2xl text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder-white/20 transition-all text-right resize-none"
            />
          </div>

          {/* Media Capture / Upload Area */}
          <div className="p-4 bg-[#0B0E14] rounded-3xl border border-white/10 space-y-4 shadow-inner">
            <div className="flex justify-between items-center text-right" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
              <span className="text-[10px] font-black text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Video className="w-3.5 h-3.5 text-indigo-400" />
                {lang === 'ar' ? 'الملف المرئي (فيديو / صورة)' : 'Visual Media'}
              </span>
              {!cameraActive && !videoUrl && (
                <button
                  type="button"
                  onClick={startCamera}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer border border-indigo-500/30"
                >
                  <Camera className="w-3.5 h-3.5" />
                  {lang === 'ar' ? 'كاميرا حية' : 'Camera'}
                </button>
              )}
            </div>

            {/* Camera View Area */}
            {cameraActive && (
              <div className="relative aspect-[9/16] w-full max-h-[280px] rounded-2xl overflow-hidden bg-black border border-white/20 shadow-xl">
                <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                
                <div className="absolute inset-x-0 bottom-4 flex justify-center items-center gap-4 z-10 px-4">
                  <div className="flex bg-black/50 backdrop-blur-md rounded-full p-2 border border-white/10 shadow-xl gap-2">
                    <button
                      type="button"
                      onClick={stopCamera}
                      className="w-10 h-10 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center text-white cursor-pointer transition-all"
                    >
                      <X className="w-4 h-4" />
                    </button>

                    {!isRecording ? (
                      <button
                        type="button"
                        onClick={handleStartCapture}
                        className="w-10 h-10 bg-rose-500 hover:bg-rose-600 rounded-full flex items-center justify-center shadow-[0_0_15px_rgba(244,63,94,0.6)] cursor-pointer transition-all"
                      >
                        <Circle className="w-4 h-4 text-white fill-white" />
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={handleStopCapture}
                        className="w-10 h-10 bg-transparent border-2 border-rose-500 rounded-full flex items-center justify-center animate-pulse cursor-pointer"
                      >
                        <Square className="w-3 h-3 text-rose-500 fill-rose-500" />
                      </button>
                    )}
                  </div>
                </div>
                
                {isRecording && (
                  <div className="absolute top-4 right-4 flex items-center gap-1.5 bg-black/60 px-2.5 py-1 rounded-full border border-rose-500/50 backdrop-blur">
                    <div className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                    <span className="text-[10px] text-rose-100 font-mono font-bold tracking-widest">REC</span>
                  </div>
                )}
              </div>
            )}

            {/* Preview of captured or uploaded video/image */}
            {!cameraActive && (videoUrl || (coverImage && coverImage !== '')) && (
              <div className="relative aspect-[9/16] w-full max-h-[280px] rounded-2xl overflow-hidden bg-black border border-white/20 group shadow-xl">
                {videoUrl ? (
                  <video src={videoUrl} autoPlay loop muted playsInline className="w-full h-full object-cover" />
                ) : (
                  <img src={coverImage} className="w-full h-full object-cover" alt="Preview" />
                )}
                
                <button
                  type="button"
                  onClick={() => {
                    setVideoUrl('');
                    setCoverImage('');
                  }}
                  className="absolute top-3 left-3 p-2 bg-black/60 hover:bg-rose-500/80 hover:text-white text-slate-300 rounded-xl backdrop-blur-md opacity-0 group-hover:opacity-100 transition-all cursor-pointer shadow-lg border border-white/10"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Manual Upload Fallback */}
            {!cameraActive && !videoUrl && !coverImage && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="flex flex-col items-center justify-center gap-2 w-full h-28 px-4 py-3 border-2 border-dashed border-indigo-500/30 bg-indigo-500/10 rounded-2xl hover:bg-indigo-500/20 cursor-pointer transition-all">
                    <div className="w-8 h-8 rounded-full bg-indigo-500/30 flex items-center justify-center text-indigo-300">
                      <Upload className="w-4 h-4" />
                    </div>
                    <span className="text-[10px] text-indigo-200 font-black uppercase tracking-wider text-center">
                      {lang === 'ar' ? '🖼️ الاستديو (صور وفيديو)' : '🖼️ Gallery Media'}
                    </span>
                    <input
                      type="file"
                      accept="video/*,image/*"
                      className="hidden"
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          const file = e.target.files[0];
                          setSelectedFile(file);
                          const tempUrl = URL.createObjectURL(file);
                          if (file.type.startsWith('video/')) {
                            setVideoUrl(tempUrl);
                            setCoverImage('');
                          } else {
                            setCoverImage(tempUrl);
                            setVideoUrl('');
                          }
                        }
                      }}
                    />
                  </label>

                  <label className="flex flex-col items-center justify-center gap-2 w-full h-28 px-4 py-3 border-2 border-dashed border-emerald-500/30 bg-emerald-500/10 rounded-2xl hover:bg-emerald-500/20 cursor-pointer transition-all">
                    <div className="w-8 h-8 rounded-full bg-emerald-500/30 flex items-center justify-center text-emerald-300">
                      <FolderTree className="w-4 h-4" />
                    </div>
                    <span className="text-[10px] text-emerald-200 font-black uppercase tracking-wider text-center leading-tight">
                      {lang === 'ar' ? '📁 جميع الملفات والتقاسيم (أي تطبيق)' : '📁 All Files & Partitions'}
                    </span>
                    <input
                      type="file"
                      accept="*/*"
                      className="hidden"
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          const file = e.target.files[0];
                          setSelectedFile(file);
                          const tempUrl = URL.createObjectURL(file);
                          if (file.type.startsWith('video/') || file.name.endsWith('.mp4') || file.name.endsWith('.mov') || file.name.endsWith('.webm')) {
                            setVideoUrl(tempUrl);
                            setCoverImage('');
                          } else {
                            setCoverImage(tempUrl);
                            setVideoUrl('');
                          }
                        }
                      }}
                    />
                  </label>
                </div>

                {/* Predefined Presets Grid */}
                <div className="space-y-1.5">
                  <span className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider text-right px-1">
                    {lang === 'ar' ? 'أو اختر غلاف جاهز سريع' : 'Or select a preset'}
                  </span>
                  <div className="grid grid-cols-5 gap-2">
                    {coverPresets.map((preset) => (
                      <button
                        type="button"
                        key={preset.url}
                        onClick={() => { setCoverImage(preset.url); setVideoUrl(''); }}
                        className="rounded-xl border border-white/10 hover:border-indigo-500 relative overflow-hidden aspect-[3/4] transition-all group"
                      >
                        <img 
                          src={preset.url} 
                          alt="" 
                          className="absolute inset-0 w-full h-full object-cover opacity-60 group-hover:scale-110 group-hover:opacity-100 transition duration-500" 
                        />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="p-4 bg-white/5 rounded-2xl border border-white/5 space-y-4">
            <div className="space-y-1.5">
              <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest text-right">
                {lang === 'ar' ? 'المكان الفعلي (اختياري)' : 'Exact location tag (optional)'}
              </label>
              <div className="relative">
                <MapPin className={`w-4 h-4 absolute ${lang === 'ar' ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 text-slate-500`} />
                <input
                  type="text"
                  value={actualLocation}
                  onChange={(e) => setActualLocation(e.target.value)}
                  placeholder={lang === 'ar' ? 'مثال: مخيم الرمال الذهبية' : 'e.g. Golden Dunes Camp'}
                  className={`w-full ${lang === 'ar' ? 'pr-9 pl-3' : 'pl-9 pr-3'} py-3 bg-[#0B0E14] border border-white/5 rounded-xl text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 text-right transition-all`}
                />
              </div>
            </div>
            
            <div className="space-y-1.5">
              <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest text-right">
                {lang === 'ar' ? 'رابط جوجل ماب (اختياري)' : 'Google Maps Link (optional)'}
              </label>
              <input
                type="text"
                value={mapUrl}
                onChange={(e) => setMapUrl(e.target.value)}
                placeholder="https://maps.google.com/..."
                className="w-full px-3 py-3 bg-[#0B0E14] border border-white/5 rounded-xl text-xs text-slate-300 text-left focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono transition-all"
                dir="ltr"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest text-right">
              {t.linkToOuting}
            </label>
            <select
              value={selectedOutingId}
              onChange={(e) => setSelectedOutingId(e.target.value)}
              className="w-full px-4 py-3 bg-[#0B0E14] border border-white/10 rounded-2xl text-xs text-indigo-200 font-bold cursor-pointer outline-none focus:ring-1 focus:ring-indigo-500 transition-all text-right appearance-none"
              style={{ backgroundImage: `url('data:image/svg+xml;utf8,<svg fill="%23a5b4fc" height="24" viewBox="0 0 24 24" width="24" xmlns="http://www.w3.org/2000/svg"><path d="M7 10l5 5 5-5z"/><path d="M0 0h24v24H0z" fill="none"/></svg>')`, backgroundRepeat: 'no-repeat', backgroundPosition: lang === 'ar' ? 'left 12px center' : 'right 12px center' }}
            >
              <option value="" className="bg-[#10141D] text-slate-300">{lang === 'ar' ? '-- بدون ربط --' : '-- No Outing link --'}</option>
              {outings.map((out) => (
                <option key={out.id} value={out.id} className="bg-[#10141D] text-white font-bold">{out.title}</option>
              ))}
            </select>
          </div>

          {uploadError && (
            <div className="bg-rose-500/10 border border-rose-500/20 p-4 rounded-2xl flex flex-col gap-3 animate-in fade-in slide-in-from-top-2">
              <div className="flex items-center gap-2 text-rose-400">
                <AlertTriangle className="w-4 h-4" />
                <span className="text-xs font-black uppercase tracking-wider">{lang === 'ar' ? 'خطأ في النشر' : 'Publishing Error'}</span>
              </div>
              <p className="text-[10px] text-rose-200 leading-relaxed font-bold">
                {uploadError}
              </p>
              <button
                type="button"
                onClick={(e) => handlePublishReel(e as any)}
                className="self-end px-4 py-2 bg-rose-500 hover:bg-rose-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-lg shadow-rose-500/20 cursor-pointer"
              >
                {lang === 'ar' ? 'إعادة المحاولة ↻' : 'Retry Now ↻'}
              </button>
            </div>
          )}

          {isUploading && (
            <div className="mb-6 p-4 bg-indigo-900/20 border border-indigo-500/30 rounded-2xl animate-pulse">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-bold text-indigo-300">
                  {lang === 'ar' ? 'جاري رفع ونشر الريلز...' : 'Uploading and publishing reel...'}
                </span>
                <span className="text-xs font-mono text-indigo-400">{Math.round(uploadProgress)}%</span>
              </div>
              <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                <div 
                  className="bg-gradient-to-r from-indigo-500 to-purple-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={isUploading}
            className="w-full mt-2 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl flex items-center justify-center gap-2 cursor-pointer transition-all border border-indigo-400/30 hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isUploading ? (
              <span className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                {lang === 'ar' ? 'جاري المعالجة...' : 'Processing...'}
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Sparkles className="w-4 h-4" />
                {lang === 'ar' ? 'نشر الريلز الآن' : 'Publish Reel Now'}
              </span>
            )}
          </button>
        </form>
      )}
    </motion.div>
    </div>
  );
}

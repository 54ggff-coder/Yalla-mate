/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Shield, Sparkles, Phone, CheckCircle, ArrowRight, Smile, MapPin, ArrowLeft, AlertTriangle, Mail, Loader2, Clock } from 'lucide-react';
import { Profile } from '../types';
import { quizQuestions, OutingArchetypes, countryCodes, arabCitiesList, foreignCitiesList } from '../constants';
import { translations, Language } from '../data/translations';
import { supabase } from '../lib/supabase';
import { useLocation } from '../contexts/LocationContext';
import { toUUID } from '../utils/uuid';
import { auth, db as firestoreDb, logAuthDebug } from '../lib/firebase';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  GoogleAuthProvider, 
  signInWithPopup, 
  sendEmailVerification, 
  sendPasswordResetEmail,
  onAuthStateChanged,
  RecaptchaVerifier,
  signInWithPhoneNumber
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';

function generateUUID() {
  let d = new Date().getTime();
  let d2 = ((typeof performance !== 'undefined') && performance.now && (performance.now() * 1000)) || 0;
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    let r = Math.random() * 16;
    if (d > 0) {
      r = (d + r) % 16 | 0;
      d = Math.floor(d / 16);
    } else {
      r = (d2 + r) % 16 | 0;
      d2 = Math.floor(d2 / 16);
    }
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

interface RegisterFlowProps {
  onRegisterComplete: (profile: Profile) => void;
  lang: Language;
  allProfiles: Profile[];
  currentUser?: Profile | null;
  emailVerified: boolean;
}

export default function RegisterFlow({ emailVerified, onRegisterComplete, lang, allProfiles, currentUser }: RegisterFlowProps) {
  const { coords, address, setProfileCity } = useLocation();

  const [step, setStep] = useState<'welcome' | 'signup_details' | 'verify' | 'quiz' | 'result' | 'email_verification_pending'>('welcome');
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('signup');
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState('');
  const [resetSent, setResetSent] = useState(false);
  const [registeredUuid, setRegisteredUuid] = useState<string>('');
  const [diagnosticUser, setDiagnosticUser] = useState<any>(null);

  const currentCityOption = { nameEn: 'Current Location', nameAr: 'موقعك الحالي (اكتشاف تلقائي)', countryEn: 'Auto' };
  const displayCitiesList = lang === 'ar' 
    ? [currentCityOption, ...arabCitiesList]
    : [currentCityOption, ...foreignCitiesList];

  const [name, setName] = useState('');
  const [city, setCity] = useState(displayCitiesList[0].nameEn);
  const [gender, setGender] = useState<'male' | 'female'>('male');

  useEffect(() => {
    if (city && city !== 'Current Location') {
      setProfileCity(city);
    } else {
      setProfileCity(null);
    }
  }, [city, setProfileCity]);

  const [username, setUsername] = useState('');
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'valid' | 'taken' | 'reserved'>('idle');
  const [usernameSuggestions, setUsernameSuggestions] = useState<string[]>([]);
  const [usernameError, setUsernameError] = useState('');
  const [authError, setAuthError] = useState('');
  const [resendTimer, setResendTimer] = useState(0);

  // Phone Authentication States
  const [authMethod, setAuthMethod] = useState<'email' | 'phone'>('email');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [phoneCountryCode, setPhoneCountryCode] = useState('+966');
  const [verificationId, setVerificationId] = useState<any>(null);
  const [smsCode, setSmsCode] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [isSendingCode, setIsSendingCode] = useState(false);
  const [isVerifyingCode, setIsVerifyingCode] = useState(false);

  // Countdown timer for email verification resend
  useEffect(() => {
    if (resendTimer <= 0) return;
    const interval = setInterval(() => {
      setResendTimer((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [resendTimer]);

  // Real-time unique username checking with debounce
  useEffect(() => {
    if (!username) {
      setUsernameStatus('idle');
      setUsernameError('');
      setUsernameSuggestions([]);
      return;
    }

    const clean = username.toLowerCase().replace(/[^a-z509_]/g, '').trim();
    // Keep it alphanumeric and underscores only
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

    setUsernameStatus('checking');
    setUsernameError('');

    const delayDebounce = setTimeout(async () => {
      try {
        const { data, error } = await supabase
          .from('users')
          .select('id')
          .eq('username', sanitized)
          .maybeSingle();

        if (!error && data) {
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
        console.error('Error checking username uniqueness:', err);
        setUsernameStatus('valid'); // fallback
      }
    }, 500);

    return () => clearTimeout(delayDebounce);
  }, [username, lang]);

  const [registeredMethod, setRegisteredMethod] = useState<'google' | 'email' | 'whatsapp' | 'snapchat' | ''>('');
  const [registeredValue, setRegisteredValue] = useState('');
  const [resending, setResending] = useState(false);
  const [resendStatus, setResendStatus] = useState<'' | 'success' | 'error'>('');

  const resendVerificationEmail = async () => {
    if (resending || resendTimer > 0) return;
    setResending(true);
    setResendStatus('');
    setVerificationError('');
    try {
      if (auth.currentUser) {
        await sendEmailVerification(auth.currentUser);
        setResendStatus('success');
        setResendTimer(60);
        setVerificationError(lang === 'ar' ? 'تم إعادة إرسال رابط التحقق بنجاح!' : 'Verification link has been resent successfully!');
      } else {
        throw new Error('User not logged in.');
      }
    } catch (error: any) {
      console.error('Error resending email:', error);
      setResendStatus('error');
      if (error.code === 'auth/too-many-requests') {
        setVerificationError(lang === 'ar' ? 'تم تجاوز حد إرسال البريد. يرجى الانتظار دقيقة.' : 'Email resend rate limit exceeded. Please wait a minute.');
      } else {
        setVerificationError(lang === 'ar' ? 'حدث خطأ أثناء إعادة إرسال البريد.' : 'An error occurred while resending the email.');
      }
    } finally {
      setResending(false);
    }
  };

  useEffect(() => {
    if (currentUser) {
      if (!emailVerified) {
        if (step !== 'email_verification_pending') {
          setStep('email_verification_pending');
        }
      } else if (step === 'email_verification_pending' || step === 'welcome') {
        setStep('signup_details');
      }
    } else {
      if (step === 'email_verification_pending' || step === 'signup_details' || step === 'quiz') {
        setStep('welcome');
      }
    }
  }, [currentUser, emailVerified, step]);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [verificationError, setVerificationError] = useState('');

  const cleanupUnverifiedDbUsers = async () => {
    try {
      if (!supabase) return;
      console.log('[Cleanup] Finding and removing unverified users...');
      
      // Select users who are unverified (email_confirmed_at is null)
      const { data: unverifiedUsers, error } = await supabase
        .from('users')
        .select('id, email')
        .is('email_confirmed_at', null);
        
      if (error) {
        console.error('[Cleanup] Error fetching unverified users:', error);
        return;
      }
      
      if (unverifiedUsers && unverifiedUsers.length > 0) {
        // Exclude the currently logged-in user so we don't disrupt their registration process
        const currentUid = auth.currentUser?.uid;
        const targetIds = unverifiedUsers
          .filter(u => u.id !== currentUid)
          .map(u => u.id);
          
        if (targetIds.length > 0) {
          console.log('[Cleanup] Deleting unverified database profiles:', targetIds);
          const { error: deleteError } = await supabase
            .from('users')
            .delete()
            .in('id', targetIds);
            
          if (deleteError) {
            console.error('[Cleanup] Error deleting profiles:', deleteError);
          } else {
            console.log('[Cleanup] Cleaned up', targetIds.length, 'unverified users successfully.');
          }
        }
      }
    } catch (e) {
      console.error('[Cleanup] Exception during unverified user cleanup:', e);
    }
  };

  const verifyEmailOtp = async () => {
    setVerificationError('');
    setIsAuthenticating(true);

    try {
      if (auth.currentUser) {
        await auth.currentUser.reload();
        if (auth.currentUser.emailVerified) {
          setRegisteredMethod('email');
          setRegisteredValue(auth.currentUser.email || email);
          setRegisteredUuid(toUUID(auth.currentUser.uid || generateUUID()));
          setStep('signup_details');
          
          // Also run cleanup to keep db perfectly optimized
          await cleanupUnverifiedDbUsers();
        } else {
          setVerificationError(lang === 'ar' ? 'لم يتم تأكيد البريد بعد. يرجى مراجعة صندوق الوارد.' : 'Email is not confirmed yet. Please check your inbox.');
        }
      } else {
        throw new Error('User not logged in.');
      }
    } catch (err: any) {
      console.error('Verification Check Error:', err);
      setVerificationError(err.message || 'Error checking verification status.');
    } finally {
      setIsAuthenticating(false);
    }
  };

  useEffect(() => {
    if (step !== 'email_verification_pending' || !registeredUuid) return;

    // Run unverified users cleanup when this verification page mounts
    cleanupUnverifiedDbUsers();

    // Fetch initial state once
    supabase.from('users').select('*').eq('id', registeredUuid).single().then(({ data }) => {
        setDiagnosticUser(data);
    });

    const channel = supabase.channel('user_conf_change')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'users',
          filter: `id=eq.${registeredUuid}`,
        },
        (payload: any) => {
          setDiagnosticUser(payload.new); // Update diagnostic status
          if (payload.new.email_confirmed_at) {
            // Confirmed!
            setStep('signup_details');
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [step, registeredUuid]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        console.log('[Register] Firebase Auth state changed:', user.uid);
        setRegisteredUuid(toUUID(user.uid));
        if (user.email) {
          setEmail(user.email);
          setRegisteredValue(user.email);
        }
        
        if (user.emailVerified) {
          if (step === 'email_verification_pending') {
            setStep('signup_details');
          }
        }
        // Also check DB record for status
        if (supabase) {
          const { data: dbUser } = await supabase.from('users').select('*').eq('id', toUUID(user.uid)).maybeSingle();
          if (dbUser) {
            setDiagnosticUser(dbUser);
          }
        }
      }
    });
    return () => unsubscribe();
  }, [step]);

  useEffect(() => {
    if (address && city === 'Current Location') {
      setCity(address.city || address.town || address.village || (lang === 'ar' ? 'الموقع المتوقع' : 'Detected City'));
    }
  }, [address, city, lang]);
  
  const { requestLocation } = useLocation();
  useEffect(() => {
    requestLocation();
  }, [requestLocation]);

  useEffect(() => {
    if (currentUser) {
      if (currentUser.onboarding_completed) {
        return;
      }
      if (!registeredMethod) {
        const isGoogle = currentUser.phone?.startsWith('Google:');
        const isEmail = currentUser.phone?.startsWith('Email:');
        if (isGoogle) {
          setRegisteredMethod('google');
          setRegisteredValue(currentUser.phone?.replace('Google: ', '') || '');
        } else if (isEmail) {
          setRegisteredMethod('email');
          setRegisteredValue(currentUser.phone?.replace('Email: ', '') || '');
        } else {
          setRegisteredMethod('email');
          setRegisteredValue(currentUser.phone || '');
        }
      }
      setName(prev => prev || currentUser.name || '');
      setStep('signup_details');
    }
  }, [currentUser, registeredMethod]);

  const [idSubmitted, setIdSubmitted] = useState(false);
  const [avatar, setAvatar] = useState('⛺');
  
  // Custom gallery states and refs
  const [avatarTab, setAvatarTab] = useState<'emoji' | 'photo'>('emoji');
  const hiddenFileInputRef = useRef<HTMLInputElement>(null);
  const photoAvatars = [
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=150&auto=format&fit=crop', // Female Premium 1
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=150&auto=format&fit=crop', // Male Premium 1
    'https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=150&auto=format&fit=crop', // Female Premium 2
    'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?q=80&w=150&auto=format&fit=crop', // Male Premium 2
    'https://images.unsplash.com/photo-1544005313-94ddf0286df2?q=80&w=150&auto=format&fit=crop', // Female Premium 3
    'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=150&auto=format&fit=crop'  // Male Premium 3
  ];

  const handleCustomAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          setAvatar(reader.result);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const t = translations[lang];

  // Quiz State
  const [currentQuizIndex, setCurrentQuizIndex] = useState(0);
  const [scoreTracker, setScoreTracker] = useState<Record<string, number>>({});
  const [archetypeResult, setArchetypeResult] = useState('');

  const avatars = ['⛺', '☕', '🎮', '🎨', '⚽', '🍿', '🏎️', '🍔', '🚀', '🕶️'];

  const triggerNextStep = () => {
    if (step === 'verify') {
      setStep('quiz');
    }
  };

  const handleAuthSuccess = async (method: 'google' | 'email' | 'whatsapp', idVal: string, displayName?: string, userId?: string) => {
    setRegisteredMethod(method);
    setRegisteredValue(idVal);
    if (userId) {
      setRegisteredUuid(toUUID(userId));
    }
    if (displayName) {
      setName(prev => prev || displayName);
    }

    if (supabase) {
      try {
        const session = await supabase.auth.getSession();
        const authUser = session.data.session?.user;
        if (authUser) {
          const mappedAuthId = toUUID(authUser.id);
          setRegisteredUuid(mappedAuthId);
          const { data: dbUser } = await supabase.from('users').select('*').eq('id', mappedAuthId).maybeSingle();
          if (dbUser && dbUser.onboarding_completed) {
            onRegisterComplete(dbUser);
            return;
          }
        }
      } catch (err) {
        console.error("Direct profile check failed:", err);
      }
    }

    if (authMode === 'login') {
      // Find matching profile (by name, email, etc.)
      let matched: Profile | undefined = undefined;

      if (displayName) {
        matched = allProfiles.find(p => p.name.toLowerCase() === displayName.toLowerCase());
      }
      if (!matched && idVal) {
        matched = allProfiles.find(p => p.phone && p.phone.toLowerCase().includes(idVal.toLowerCase()));
      }

      // Fallback behavior: if they log in but no pre-registered user is found,
      // instead of failing, let's auto-transition to signup so sandbox users can explore easily!
      if (matched) {
        onRegisterComplete(matched);
      } else {
        const msg = lang === 'ar'
          ? `لم نعثر على حساب مسجل مسبقاً لهذه البيانات. تم تلقائياً توجيهك إلى صفحة إكمال البيانات لإنشاء حساب جديد فوراً!`
          : `We did not find an active registered account with these details. You have been seamlessly redirected to complete your profile creation!`;
        alert(msg);
        setAuthMode('signup');
        setStep('signup_details');
      }
    } else {
      // Sign up -> complete remaining details (Name, city, gender, avatar)
      setStep('signup_details');
    }
  };

  const [isAuthenticating, setIsAuthenticating] = useState(false);

  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      const origin = event.origin;
      if (!origin.endsWith('.run.app') && !origin.includes('localhost')) {
        return;
      }

      if (event.data?.type === 'OAUTH_AUTH_SUCCESS') {
        const session = event.data.session;
        const user = session?.user;
        if (user) {
          handleAuthSuccess('google', user.email || '', user.user_metadata?.full_name || 'علي الخضر', user.id);
        } else {
          // If no user found from event, and auth fails completely, we cannot proceed.
          alert(lang === 'ar' ? 'فشل التحقق من الهوية.' : 'Identity verification failed.');
          return;
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [allProfiles, authMode, lang]);

  const handleGoogleLogin = async () => {
    if (isAuthenticating) return;
    setIsAuthenticating(true);
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      
      handleAuthSuccess('google', user.email || '', user.displayName || 'مستخدم جديد', user.uid);
    } catch (e: any) {
      console.warn('[Google Auth] Native popup login failed, invoking preview-safe simulated Google login fallback:', e);
      logAuthDebug('RegisterFlow.tsx -> handleGoogleLogin', 'Google Sign-In', e);
      
      const useSimulated = window.confirm(
        lang === 'ar' 
          ? "تم حظر نافذة تسجيل الدخول من Google بواسطة المتصفح (شائع داخل إطار المعاينة). هل ترغب في استخدام تسجيل دخول Google تجريبي وسريع للتجربة والتطوير؟" 
          : "Google login popup was blocked or failed (common inside preview iframes). Would you like to use a simulated Google login for demo and development purposes?"
      );
      
      if (useSimulated) {
        sessionStorage.setItem('yallamate_skip_verify', 'true');
        handleAuthSuccess('google', 'owner_google_demo@gmail.com', lang === 'ar' ? 'علي الخضر (جوجل)' : 'Ali Al-Khidr (Google)', 'simulated_google_uid_12345');
      } else {
        if (e?.code === 'auth/operation-not-allowed') {
          const errorMsg = lang === 'ar' 
            ? "طريقة تسجيل الدخول باستخدام Google غير مفعلة في لوحة تحكم Firebase Console لمشروعك. يرجى الانتقال إلى قسم Authentication وتفعيل Google Sign-In."
            : "Google Sign-In is not enabled in your Firebase Console. Please open the Firebase Console, go to 'Authentication' -> 'Sign-in method', and enable 'Google'.";
          alert(errorMsg);
        } else {
          alert(lang === 'ar' ? "فشل تسجيل الدخول: " + e.message : "Login failed: " + e.message);
        }
      }
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSendingCode) return;
    setIsSendingCode(true);
    setPhoneError('');
    setAuthError('');
    
    try {
      const sanitizedPhone = phoneNumber.trim().replace(/^0+/, ''); // remove leading zeros if user typed them
      if (!sanitizedPhone) {
        setPhoneError(lang === 'ar' ? 'يرجى إدخال رقم الهاتف' : 'Please enter a phone number');
        setIsSendingCode(false);
        return;
      }
      const fullNumber = phoneCountryCode + sanitizedPhone;
      
      // Create/get invisible Recaptcha Verifier
      let appVerifier = (window as any).recaptchaVerifier;
      if (!appVerifier) {
        appVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
          size: 'invisible',
          callback: () => {
            // reCAPTCHA solved
          },
          'expired-callback': () => {
            setPhoneError(lang === 'ar' ? 'انتهت صلاحية التحقق من الكابتشا. يرجى المحاولة لاحقاً.' : 'reCAPTCHA expired. Please try again.');
          }
        });
        (window as any).recaptchaVerifier = appVerifier;
      }
      
      const confirmation = await signInWithPhoneNumber(auth, fullNumber, appVerifier);
      setVerificationId(confirmation);
      setPhoneError('');
    } catch (err: any) {
      console.error('Error sending SMS verification code:', err);
      logAuthDebug('RegisterFlow.tsx -> handleSendCode', 'Phone Auth Send', err);
      if (err.code === 'auth/invalid-phone-number') {
        setPhoneError(lang === 'ar' ? 'رقم الهاتف غير صالح. يرجى التأكد من الرقم.' : 'Invalid phone number. Please check the number.');
      } else if (err.code === 'auth/operation-not-allowed') {
        setPhoneError(lang === 'ar' 
          ? 'طريقة تسجيل الدخول بالهاتف غير مفعلة في لوحة تحكم Firebase Console. يرجى تفعيلها من Authentication -> Sign-in method -> Phone.'
          : 'Phone authentication is not enabled in your Firebase Console. Please open the Firebase Console, go to "Authentication" -> "Sign-in method", and enable "Phone".'
        );
      } else if (err.code === 'auth/too-many-requests') {
        setPhoneError(lang === 'ar' ? 'تم تجاوز حد إرسال الرسائل لرقم الهاتف هذا. يرجى المحاولة لاحقاً.' : 'Too many requests for this phone number. Please try again later.');
      } else {
        setPhoneError(lang === 'ar' ? `حدث خطأ: ${err.message}` : `Error: ${err.message}`);
      }
      // If recapture failed or got stale, clear it to recreate next time
      try {
        if ((window as any).recaptchaVerifier) {
          ((window as any).recaptchaVerifier).clear();
          (window as any).recaptchaVerifier = null;
        }
      } catch (e) {}
    } finally {
      setIsSendingCode(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isVerifyingCode || !verificationId) return;
    setIsVerifyingCode(true);
    setPhoneError('');
    
    try {
      const result = await verificationId.confirm(smsCode.trim());
      const user = result.user;
      console.log('[Auth] Phone verification successful:', user.uid);
      
      // Clear state
      setVerificationId(null);
      setSmsCode('');
      
      const fullNumber = phoneCountryCode + phoneNumber.trim().replace(/^0+/, '');
      handleAuthSuccess('whatsapp', fullNumber, user.displayName || (lang === 'ar' ? 'مستكشف يلا' : 'Yalla Mate'), toUUID(user.uid));
    } catch (err: any) {
      console.error('Error confirming SMS verification code:', err);
      logAuthDebug('RegisterFlow.tsx -> handleVerifyCode', 'Phone Auth Confirm', err);
      if (err.code === 'auth/invalid-verification-code') {
        setPhoneError(lang === 'ar' ? 'رمز التحقق المدخل غير صحيح!' : 'The verification code entered is invalid!');
      } else {
        setPhoneError(lang === 'ar' ? `حدث خطأ أثناء تأكيد الرمز: ${err.message}` : `Error verifying code: ${err.message}`);
      }
    } finally {
      setIsVerifyingCode(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isAuthenticating) return;
    setIsAuthenticating(true);
    setAuthError('');
    
    try {
      if (authMode === 'signup') {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await sendEmailVerification(userCredential.user);
        
        console.log('[Auth] Firebase signup successful, waiting for user to verify email link.');
        setRegisteredUuid(toUUID(userCredential.user.uid));
        setStep('email_verification_pending');
      } else {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        
        if (!userCredential.user.emailVerified) {
          console.warn('[Login] Email unconfirmed. Sending new verification email.');
          await sendEmailVerification(userCredential.user);
          setRegisteredUuid(toUUID(userCredential.user.uid));
          setStep('email_verification_pending');
          setAuthError(lang === 'ar' ? 'البريد الإلكتروني غير مؤكد. يرجى التحقق من بريدك لفتح الرابط لتأكيد الحساب.' : 'Email is not confirmed yet. Please check your email and click the verification link.');
          return;
        }

        handleAuthSuccess('email', email, userCredential.user.displayName || email.split('@')[0], toUUID(userCredential.user.uid));
      }
    } catch (err: any) {
      logAuthDebug(
        `RegisterFlow.tsx -> handleEmailAuth (${authMode === 'signup' ? 'Sign Up' : 'Log In'})`, 
        'Email & Password', 
        err
      );
      if (err.code === 'auth/operation-not-allowed') {
        setAuthError(lang === 'ar' 
          ? 'طريقة تسجيل الدخول بالبريد الإلكتروني وكلمة المرور غير مفعلة في لوحة تحكم Firebase Console. يرجى الانتقال إلى قسم Authentication -> Sign-in method وتفعيل Email/Password.'
          : 'Email/Password authentication is not enabled in your Firebase Console. Please open the Firebase Console, go to "Authentication" -> "Sign-in method", and enable "Email/Password".'
        );
      } else if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found') {
        setAuthError(lang === 'ar' ? 'البريد الإلكتروني أو كلمة المرور غير صحيحة' : 'Incorrect email or password.');
      } else if (err.code === 'auth/email-already-in-use') {
        setAuthError(lang === 'ar' ? 'هذا البريد الإلكتروني مسجل بالفعل. يرجى تسجيل الدخول.' : 'This email is already registered. Please log in.');
        setAuthMode('login');
      } else if (err.code === 'auth/too-many-requests') {
        setAuthError(lang === 'ar' ? 'تم تجاوز الحد المسموح به. يرجى المحاولة لاحقاً.' : 'Rate limit exceeded! Please try again later.');
      } else {
        setAuthError(lang === 'ar' ? "فشل تسجيل الدخول: " + err.message : "Login failed: " + err.message);
      }
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsAuthenticating(true);
    setAuthError('');
    try {
      await sendPasswordResetEmail(auth, forgotPasswordEmail);
      setResetSent(true);
    } catch (err: any) {
      logAuthDebug('RegisterFlow.tsx -> handleResetPassword', 'Email & Password (Password Reset)', err);
      if (err.code === 'auth/operation-not-allowed') {
        setAuthError(lang === 'ar'
          ? 'عملية إعادة تعيين كلمة المرور غير مسموح بها. يرجى التحقق من تفعيل Email/Password في Firebase Console لمشروعك.'
          : 'Password reset is not allowed. Please verify that Email/Password is enabled in your Firebase Console.'
        );
      } else if (err.code === 'auth/too-many-requests') {
        setAuthError(lang === 'ar' ? 'تم تجاوز الحد المسموح به. يرجى الانتظار بضع دقائق والمحاولة مرة أخرى.' : 'Rate limit exceeded! Please wait a few minutes and try again.');
      } else {
        setAuthError(err.message || 'Failed to complete the operation');
      }
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleSelectOption = (archetypeScore: Record<string, number>) => {
    // Update score tracker
    const updatedTracker = { ...scoreTracker };
    Object.entries(archetypeScore).forEach(([archetype, value]) => {
      updatedTracker[archetype] = (updatedTracker[archetype] || 0) + value;
    });
    setScoreTracker(updatedTracker);

    if (currentQuizIndex < quizQuestions.length - 1) {
      setCurrentQuizIndex(currentQuizIndex + 1);
    } else {
      // Analyze archetype results
      let bestArchetype = 'The Coffee Connoisseur';
      let highestScore = -1;
      Object.keys(updatedTracker).forEach((archetype) => {
        const score = updatedTracker[archetype];
        if (score > highestScore) {
          highestScore = score;
          bestArchetype = archetype;
        }
      });
      setArchetypeResult(bestArchetype);
      setStep('result');
    }
  };

  const finalizeRegistration = () => {
    let contactLabel = '';
    if (registeredMethod === 'whatsapp') {
      contactLabel = `WhatsApp: ${registeredValue}`;
    } else if (registeredMethod === 'google') {
      contactLabel = `Google: ${registeredValue}`;
    } else if (registeredMethod === 'snapchat') {
      contactLabel = `Snapchat: @${registeredValue}`;
    } else if (registeredMethod === 'email') {
      contactLabel = `Email: ${registeredValue}`;
    } else {
      contactLabel = 'No Contact Linked';
    }

    const finalProfile: Profile = {
      id: registeredUuid || currentUser?.id || generateUUID(),
      name: name || 'YallaMate Explorer',
      username: username && username.trim() !== '' ? username.trim() : (name.toLowerCase().replace(/\s+/g, '_') + '_' + Math.random().toString(36).substring(2, 9)),
      displayName: name || 'YallaMate Explorer',
      phone: contactLabel,
      location: city,
      avatar: avatar,
      archetype: archetypeResult || 'The Coffee Connoisseur (ذوّاق القهوة)',
      gender: gender,
      trustScore: 5, // Start onboarding with a fresh profile on the new 5-point starting reputation scale!
      verified: idSubmitted, // If they uploaded simulated documents
      interests: quizQuestions.flatMap(q => q.options.flatMap(o => o.textEn.split(' ')))
        .filter(w => w.length > 5 && !w.includes('the')).slice(0, 3), 
      badges: idSubmitted ? ['Verified Account', 'Punctual Starter'] : ['Punctual Starter'],
      warningCount: 0,
      suspended: false,
      followers: [],
      following: [],
      privacyStatus: 'public',
      dmStatus: 'everyone',
      hideFollowers: false,
      onboarding_completed: true,
      warnings: 0,
    };
    onRegisterComplete(finalProfile);
  };

  const stepsOrder = ['welcome', 'email_verification_pending', 'signup_details', 'verify', 'quiz', 'result'];
  const currentStepIndex = stepsOrder.indexOf(step);
  const progressPercent = Math.max(0, (currentStepIndex / (stepsOrder.length - 1)) * 100);

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col justify-between p-4 selection:bg-emerald-500 selection:text-slate-950">
      <div className="w-full max-w-md mx-auto my-auto bg-slate-900/40 backdrop-blur-2xl border border-white/10 rounded-3xl shadow-2xl p-6 relative overflow-hidden">
        {/* Visual Progress Indicator */}
        {step !== 'welcome' && step !== 'result' && (
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-slate-800">
            <motion.div 
              className="h-full bg-emerald-500"
              initial={{ width: 0 }}
              animate={{ width: `${progressPercent}%` }}
              transition={{ duration: 0.5, ease: "easeInOut" }}
            />
          </div>
        )}
        
        <AnimatePresence mode="wait">
          {step === 'email_verification_pending' && (
            <motion.div
              key="email_verification_pending"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="p-8 text-center flex flex-col items-center gap-6"
              dir={lang === 'ar' ? 'rtl' : 'ltr'}
            >
              {/* Premium Live Pulsing Animation Ring */}
              <div className="relative w-24 h-24 flex items-center justify-center mb-2">
                <div className="absolute inset-0 rounded-full bg-emerald-500/10 animate-ping duration-1000 opacity-75" />
                <div className="absolute inset-2 rounded-full border-2 border-emerald-500/30 border-t-emerald-400 animate-spin" style={{ animationDuration: '2s' }} />
                <div className="relative w-16 h-16 bg-emerald-500/15 border border-emerald-500/30 rounded-2xl flex items-center justify-center shadow-[0_0_25px_rgba(16,185,129,0.2)]">
                  <Mail className="w-8 h-8 text-emerald-400 animate-bounce duration-1000" />
                </div>
              </div>

              <div>
                <h2 className="text-2xl font-black text-white tracking-tight leading-tight">
                  {lang === 'ar' ? 'بانتظار تأكيد البريد الإلكتروني...' : 'Enforcing Email Verification...'}
                </h2>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-[10px] font-mono tracking-wider text-emerald-400 uppercase font-black mt-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  {lang === 'ar' ? 'فحص تلقائي نشط بالوقت الفعلي' : 'Active Real-Time Monitoring'}
                </div>
              </div>

              <div className="w-full text-left bg-white/5 p-6 rounded-2.5xl border border-white/10 space-y-4" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
                <div>
                  <h4 className="text-[10px] uppercase tracking-widest text-slate-500 font-extrabold mb-1">
                    {lang === 'ar' ? 'عنوان البريد الإلكتروني المستهدف' : 'Target Verification Destination'}
                  </h4>
                  <p className="text-sm font-mono font-black text-white bg-slate-950/40 p-3 rounded-xl border border-white/5 truncate flex items-center gap-1">
                    <span className="text-emerald-400">@</span> {email || lang === 'ar' ? 'لم يتم تحديد البريد' : 'No email detected'}
                  </p>
                </div>

                <div className="text-sm text-slate-300 leading-relaxed bg-[#0B0E14] shadow-inner p-4 rounded-xl border border-white/5">
                  <p className="font-bold mb-3 text-slate-200">
                    {lang === 'ar' ? 'قم بالضغط على الرابط المرسل إلى بريدك لتأكيد حسابك، ثم اضغط على زر التحقق هنا.' : 'Click the link sent to your email to confirm your account, then click the check button here.'}
                  </p>
                  <div className="flex gap-2 justify-center flex-wrap">
                    <button 
                      onClick={verifyEmailOtp}
                      disabled={isAuthenticating}
                      className="bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-white px-8 py-3 rounded-xl font-black uppercase tracking-widest transition-all shadow-md shadow-emerald-500/20 cursor-pointer text-xs"
                    >
                      {isAuthenticating ? <Loader2 className="w-5 h-5 animate-spin" /> : (lang === 'ar' ? 'تحديث حالة التحقق' : 'Check Verification')}
                    </button>
                    
                    <button 
                      onClick={() => {
                        sessionStorage.setItem('yallamate_skip_verify', 'true');
                        setRegisteredMethod('email');
                        setRegisteredValue(email || 'demo@yallamate.com');
                        setRegisteredUuid(toUUID(auth.currentUser?.uid || generateUUID()));
                        setStep('signup_details');
                        window.dispatchEvent(new Event('yallamate_force_verify'));
                      }}
                      className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-3 rounded-xl font-black uppercase tracking-widest transition-all shadow-md shadow-indigo-500/20 cursor-pointer text-xs"
                    >
                      {lang === 'ar' ? 'تخطي التحقق (عرض تجريبي)' : 'Skip Verification (Demo)'}
                    </button>
                  </div>
                </div>

                {verificationError && (
                  <p className="text-xs text-rose-400 font-black mt-2 text-center bg-rose-500/10 border border-rose-500/20 p-2.5 rounded-xl animate-shake">
                    ⚠️ {verificationError}
                  </p>
                )}

                {/* Diagnostic box if present */}
                {diagnosticUser && (
                  <div className="p-3 bg-slate-950/80 border border-white/5 rounded-xl text-[10px] text-slate-400 flex items-center justify-between font-mono">
                    <span className="text-slate-500">{lang === 'ar' ? 'حالة التوثيق بقاعدة البيانات:' : 'Database confirmation state:'}</span>
                    <span className="font-bold flex items-center gap-1 text-amber-400">
                      <Clock className="w-3 h-3 animate-spin" />
                      {diagnosticUser.email_confirmed_at ? 'CONFIRMED' : 'WAITING_FOR_HOOK'}
                    </span>
                  </div>
                )}
              </div>

              {/* Action Rows */}
              <div className="w-full space-y-3">
                <button
                  onClick={resendVerificationEmail}
                  disabled={resending || resendTimer > 0}
                  className={`w-full py-4 rounded-xl font-black text-sm uppercase tracking-wide border transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer shadow-md ${
                    resendTimer > 0
                      ? 'bg-slate-800 text-slate-500 border-slate-700 cursor-not-allowed'
                      : 'bg-emerald-500 text-slate-950 border-emerald-500 hover:bg-emerald-400 active:scale-[0.99]'
                  }`}
                >
                  {resending && <Loader2 className="w-4 h-4 animate-spin" />}
                  {resending 
                    ? (lang === 'ar' ? 'جاري الإرسال...' : 'Sending Verification...') 
                    : resendTimer > 0
                      ? (lang === 'ar' ? `إعادة الإرسال خلال ${resendTimer} ثانية` : `Resend in ${resendTimer}s`)
                      : (lang === 'ar' ? 'إعادة إرسال البريد الإلكتروني' : 'Resend Verification Email')}
                </button>

                <button
                  onClick={async () => {
                    const user = auth.currentUser;
                    if (user) {
                      try {
                         await user.delete();
                      } catch(e) {
                         console.error('Error deleting unverified user:', e);
                      }
                    }
                    if (supabase) {
                      await supabase.auth.signOut();
                    }
                    await auth.signOut();
                    localStorage.removeItem('yallamate_current_user');
                    setStep('welcome');
                    setAuthMode('login');
                  }}
                  className="w-full bg-slate-900 border border-white/10 hover:border-white/25 hover:bg-slate-800 text-rose-400 hover:text-rose-500 py-3.5 rounded-xl font-bold text-xs transition-all tracking-wider uppercase active:scale-[0.98] cursor-pointer"
                >
                  {lang === 'ar' ? 'حذف الحساب وإلغاء العملية' : 'Delete Account & Cancel'}
                </button>
              </div>
            </motion.div>
          )}

          {step === 'welcome' && (
            <motion.div
              key="welcome"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="p-8 text-center"
            >
              {showForgotPassword ? (
                <div className="text-left" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
                  <button
                    onClick={() => {
                      setShowForgotPassword(false);
                      setResetSent(false);
                    }}
                    className="mb-6 flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-white transition-colors uppercase tracking-widest"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    {lang === 'ar' ? 'عودة للتسجيل' : 'Back to Login'}
                  </button>
                  <h2 className="text-2xl font-black text-white mb-2">
                    {lang === 'ar' ? 'استعادة كلمة المرور' : 'Reset Password'}
                  </h2>
                  <p className="text-slate-400 text-sm mb-8">
                    {lang === 'ar' ? 'أدخل بريدك الإلكتروني وسنرسل لك رابطاً لاستعادة كلمة المرور.' : 'Enter your email address and we will send you a password reset link.'}
                  </p>

                  {resetSent ? (
                    <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-6 text-center">
                      <CheckCircle className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
                      <h3 className="text-emerald-400 font-bold mb-2">
                        {lang === 'ar' ? 'تم إرسال الرابط بنجاح' : 'Reset Link Sent'}
                      </h3>
                      <p className="text-slate-300 text-sm">
                        {lang === 'ar' ? 'تحقق من بريدك الإلكتروني.' : 'Check your email inbox.'}
                      </p>
                    </div>
                  ) : (
                    <form onSubmit={handleResetPassword} className="space-y-4">
                      <div>
                        <input
                          type="email"
                          required
                          placeholder={lang === 'ar' ? 'البريد الإلكتروني' : 'Email Address'}
                          value={forgotPasswordEmail}
                          onChange={(e) => setForgotPasswordEmail(e.target.value)}
                          className="w-full px-5 py-3.5 bg-white/5 border border-white/10 rounded-2xl focus:outline-none focus:ring-1 focus:ring-emerald-500 text-white text-sm"
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={isAuthenticating || !forgotPasswordEmail}
                        className="w-full py-4 bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 disabled:opacity-50 text-slate-950 font-black rounded-2xl transition cursor-pointer text-sm uppercase tracking-wider shadow-lg shadow-emerald-500/20"
                      >
                        {isAuthenticating ? '...' : (lang === 'ar' ? 'إرسال رابط الاستعادة' : 'Send Reset Link')}
                      </button>
                    </form>
                  )}
                </div>
              ) : (
                <>
                  <div className="flex bg-white/5 backdrop-blur-md rounded-xl p-1 mb-6 border border-white/10 shadow-inner">
                    <button
                      onClick={() => setAuthMode('login')}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-black transition-all ${authMode === 'login' ? 'bg-emerald-500 text-slate-950 shadow-lg' : 'text-slate-400 hover:text-white'}`}
                >
                  {lang === 'ar' ? 'تسجيل الدخول' : 'Log In'}
                </button>
                <button
                  onClick={() => setAuthMode('signup')}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-black transition-all ${authMode === 'signup' ? 'bg-emerald-500 text-slate-950 shadow-lg' : 'text-slate-400 hover:text-white'}`}
                >
                  {lang === 'ar' ? 'إنشاء حساب' : 'Sign Up'}
                </button>
              </div>

              <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 mb-6 shadow-inner">
                <Sparkles className="w-10 h-10 text-emerald-400 animate-pulse" />
              </div>
              
              <h1 className="text-3xl font-display font-black text-white tracking-tight">
                {authMode === 'signup' ? t.welcomeTitle : (lang === 'ar' ? 'مرحباً بعودتك' : 'Welcome Back')} <span className="text-emerald-400">{authMode === 'signup' ? t.welcomeSubtitle : ''}</span>
              </h1>
              {authMode === 'signup' && (
                <p className="text-[10px] font-black text-emerald-300 mt-2 uppercase tracking-widest bg-emerald-500/10 inline-block px-3 py-1 rounded-full border border-emerald-500/20">
                  {t.welcomeTagline}
                </p>
              )}
              
              {authMode === 'signup' && (
                <div className="bg-white/[0.02] border border-white/10 shadow-inner backdrop-blur-md rounded-2xl p-5 mt-6 text-left space-y-3 text-xs text-slate-300" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
                  <div className="flex items-center gap-2 font-black text-white mb-2 uppercase tracking-widest text-[10px]">
                    <Shield className="w-4 h-4 text-emerald-400" /> {t.keyPrinciplesTitle}
                  </div>
                  <div className="grid grid-cols-2 gap-3 mt-1 font-medium text-slate-400">
                    <div className="flex gap-2"><span className="text-emerald-400 font-bold">•</span> {t.principle1}</div>
                    <div className="flex gap-2"><span className="text-emerald-400 font-bold">•</span> {t.principle2}</div>
                    <div className="flex gap-2"><span className="text-emerald-400 font-bold">•</span> {t.principle3}</div>
                    <div className="flex gap-2"><span className="text-emerald-400 font-bold">•</span> {t.principle4}</div>
                  </div>
                </div>
              )}

              {/* Authentication Method Selector Tabs */}
              <div className="flex bg-white/5 p-1 rounded-xl border border-white/5 mb-6 mt-6 max-w-xs mx-auto">
                <button
                  type="button"
                  onClick={() => {
                    setAuthMethod('email');
                    setPhoneError('');
                    setAuthError('');
                  }}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    authMethod === 'email'
                      ? 'bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 font-extrabold shadow'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  ✉️ {lang === 'ar' ? 'البريد الإلكتروني' : 'Email'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAuthMethod('phone');
                    setPhoneError('');
                    setAuthError('');
                  }}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    authMethod === 'phone'
                      ? 'bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 font-extrabold shadow'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  📱 {lang === 'ar' ? 'رقم الهاتف' : 'Phone'}
                </button>
              </div>

              {authMethod === 'email' ? (
                <form onSubmit={handleEmailAuth} className="space-y-4 mt-2" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
                  <div>
                    <input
                      type="email"
                      required
                      placeholder={lang === 'ar' ? 'البريد الإلكتروني' : 'Email Address'}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full px-5 py-3.5 bg-white/5 border border-white/10 rounded-2xl focus:outline-none focus:ring-1 focus:ring-emerald-500 text-white text-sm"
                    />
                  </div>
                  <div>
                    <input
                      type="password"
                      required
                      placeholder={lang === 'ar' ? 'كلمة المرور' : 'Password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full px-5 py-3.5 bg-white/5 border border-white/10 rounded-2xl focus:outline-none focus:ring-1 focus:ring-emerald-500 text-white text-sm"
                    />
                    {authMode === 'login' && (
                      <div className="flex justify-end mt-2">
                        <button
                          type="button"
                          onClick={() => setShowForgotPassword(true)}
                          className="text-xs text-emerald-400 hover:text-emerald-300 font-medium transition-colors"
                        >
                          {lang === 'ar' ? 'نسيت كلمة المرور؟' : 'Forgot Password?'}
                        </button>
                      </div>
                    )}
                  </div>
                  {authError && (
                    <div className="text-xs text-rose-400 font-black text-center bg-rose-500/10 border border-rose-500/20 p-3 rounded-2xl">
                      ⚠️ {authError}
                    </div>
                  )}
                  <button
                    type="submit"
                    disabled={isAuthenticating}
                    className="w-full py-4 bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 disabled:opacity-50 text-slate-950 font-black rounded-2xl transition cursor-pointer text-sm uppercase tracking-wider shadow-lg shadow-emerald-500/20"
                  >
                    {authMode === 'signup' 
                      ? (lang === 'ar' ? 'إنشاء حساب عبر البريد' : 'Register with Email')
                      : (lang === 'ar' ? 'تسجيل الدخول' : 'Sign In')}
                  </button>
                </form>
              ) : (
                <div className="space-y-4 mt-2" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
                  {verificationId === null ? (
                    <form onSubmit={handleSendCode} className="space-y-4">
                      <div>
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 text-right">
                          {lang === 'ar' ? 'رقم الهاتف المتنقل المفعّل' : 'Active Mobile Phone Number'}
                        </label>
                        <div className="flex gap-2">
                          <select
                            value={phoneCountryCode}
                            onChange={(e) => setPhoneCountryCode(e.target.value)}
                            className="px-3 py-3.5 bg-slate-950 border border-white/10 rounded-2xl focus:outline-none focus:ring-1 focus:ring-emerald-500 text-white text-sm shrink-0"
                          >
                            {countryCodes.map((cc) => (
                              <option key={cc.code} value={cc.code} className="bg-slate-900 text-white">
                                {cc.code} ({lang === 'ar' ? cc.nameAr : cc.nameEn})
                              </option>
                            ))}
                          </select>
                          <input
                            type="tel"
                            required
                            placeholder={lang === 'ar' ? 'مثال: 51234567' : 'e.g. 51234567'}
                            value={phoneNumber}
                            onChange={(e) => setPhoneNumber(e.target.value.replace(/[^0-9]/g, ''))}
                            className="w-full px-5 py-3.5 bg-white/5 border border-white/10 rounded-2xl focus:outline-none focus:ring-1 focus:ring-emerald-500 text-white text-sm"
                          />
                        </div>
                      </div>

                      {phoneError && (
                        <div className="text-xs text-rose-400 font-black text-center bg-rose-500/10 border border-rose-500/20 p-3 rounded-2xl">
                          ⚠️ {phoneError}
                        </div>
                      )}

                      <button
                        type="submit"
                        disabled={isSendingCode || !phoneNumber}
                        className="w-full py-4 bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 disabled:opacity-50 text-slate-950 font-black rounded-2xl transition cursor-pointer text-sm uppercase tracking-wider shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2"
                      >
                        {isSendingCode && <Loader2 className="w-5 h-5 animate-spin" />}
                        {isSendingCode 
                          ? (lang === 'ar' ? 'جاري إرسال الرمز...' : 'Sending SMS Code...') 
                          : (lang === 'ar' ? 'إرسال رمز التحقق برقم الجوال' : 'Send Code to Phone Number')}
                      </button>
                    </form>
                  ) : (
                    <form onSubmit={handleVerifyCode} className="space-y-4">
                      <div>
                        <label className="block text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-2.5 text-center">
                          {lang === 'ar' 
                            ? `أدخل رمز التحقق المكون من 6 أرقام المرسل إلى ${phoneCountryCode}${phoneNumber}` 
                            : `Enter the 6-digit code sent to ${phoneCountryCode}${phoneNumber}`}
                        </label>
                        <input
                          type="text"
                          maxLength={6}
                          required
                          placeholder="------"
                          value={smsCode}
                          onChange={(e) => setSmsCode(e.target.value.replace(/[^0-9]/g, ''))}
                          className="w-full text-center px-5 py-3.5 bg-white/5 border border-white/10 rounded-2xl focus:outline-none focus:ring-1 focus:ring-emerald-500 text-white text-lg font-mono font-black tracking-[0.25em]"
                        />
                      </div>

                      {phoneError && (
                        <div className="text-xs text-rose-400 font-black text-center bg-rose-500/10 border border-rose-500/20 p-3 rounded-2xl">
                          ⚠️ {phoneError}
                        </div>
                      )}

                      <div className="space-y-2">
                        <button
                          type="submit"
                          disabled={isVerifyingCode || smsCode.length < 6}
                          className="w-full py-4 bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 disabled:opacity-50 text-slate-950 font-black rounded-2xl transition cursor-pointer text-sm uppercase tracking-wider shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2"
                        >
                          {isVerifyingCode && <Loader2 className="w-5 h-5 animate-spin" />}
                          {isVerifyingCode 
                            ? (lang === 'ar' ? 'جاري التحقق من الرمز...' : 'Verifying SMS Code...') 
                            : (lang === 'ar' ? 'تأكيد الرمز وتفعيل الحساب' : 'Verify Code & Sign In')}
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setVerificationId(null);
                            setSmsCode('');
                            setPhoneError('');
                          }}
                          className="w-full py-2 bg-transparent text-slate-400 hover:text-white text-xs font-semibold"
                        >
                          {lang === 'ar' ? 'تغيير رقم الجوال أو إعادة المحاولة' : 'Change Phone Number or Retry'}
                        </button>
                      </div>
                    </form>
                  )}

                  {/* reCAPTCHA Invisible Anchor container required by Firebase */}
                  <div id="recaptcha-container" className="flex justify-center mt-2"></div>
                </div>
              )}

              <div className="relative py-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-white/10"></div>
                </div>
                <div className="relative flex justify-center">
                  <span className="bg-[#0B0E14] px-4 text-[10px] text-slate-500 uppercase tracking-widest font-black">
                    {lang === 'ar' ? 'أو عبر الحسابات المرتبطة' : 'Or continue with'}
                  </span>
                </div>
              </div>

              {/* Google Mail Account */}
              <button
                type="button"
                id="btn_get_started_google"
                onClick={handleGoogleLogin}
                disabled={isAuthenticating}
                className="w-full flex items-center justify-center gap-3 py-4 bg-white/5 hover:bg-white/10 active:bg-white/15 disabled:opacity-50 text-white font-black rounded-2xl transition border border-white/10 cursor-pointer text-xs uppercase tracking-wider shadow-sm hover:border-emerald-500/30"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31l3.41 2.64c2-1.84 3.44-4.54 3.44-7.96z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.41-2.64c-.95.63-2.16 1-3.87 1-2.9 0-5.36-1.96-6.24-4.6L2.3 17.72A10.99 10.99 0 0 0 12 23z" fill="#34A853"/>
                  <path d="M5.76 14.1c-.22-.66-.35-1.37-.35-2.1s.13-1.44.35-2.1L2.3 7.28A10.99 10.99 0 0 0 1 12c0 1.77.42 3.48 1.3 4.72l3.46-2.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.24 1 3.1 3.72 1.3 7.28l3.46 2.62c.88-2.64 3.34-4.52 6.24-4.52z" fill="#EA4335"/>
                </svg>
                <span>
                  {authMode === 'signup' 
                    ? (lang === 'ar' ? 'التسجيل عبر بريد Google' : 'Sign up using Google Mail') 
                    : (lang === 'ar' ? 'الدخول عبر بريد Google' : 'Login using Google Mail')}
                </span>
              </button>
            </>
          )}
        </motion.div>
      )}

          {step === 'signup_details' && (
            <motion.div
              key="signup_details"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="p-8"
              dir={lang === 'ar' ? 'rtl' : 'ltr'}
            >
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-2xl font-display font-black text-white">
                    {lang === 'ar' ? 'إكمال بيانات الحساب' : 'Complete Profile'}
                  </h2>
                  <p className="text-xs text-slate-400 mt-2 font-medium">
                    {lang === 'ar' 
                      ? 'اختر اسمك والمدينة التي تقيم بها وصورتك التعبيرية المفضلة للمتابعة' 
                      : 'Customize your public name, city and avatar to complete registration'}
                  </p>
                </div>
                <button
                  onClick={() => setStep('welcome')}
                  className="px-3 py-1.5 bg-white/5 border border-white/10 hover:bg-white/10 rounded-xl text-[10px] font-black uppercase text-slate-300 font-mono tracking-widest cursor-pointer transition"
                >
                  {lang === 'ar' ? 'رجوع' : 'Back'}
                </button>
              </div>

              <div className="space-y-5 mt-8">
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">
                    {lang === 'ar' ? 'الاسم الكامل أو المستعار' : 'Full Name or Handle'}
                  </label>
                  <input
                    type="text"
                    required
                    placeholder={t.namePlaceholder}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-5 py-3.5 bg-white/5 border border-white/10 rounded-2xl focus:outline-none focus:ring-1 focus:ring-indigo-500 text-white text-sm"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">{t.cityLabel}</label>
                  <select
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="w-full px-5 py-3.5 text-white bg-[#0B0E14] border border-white/10 rounded-2xl focus:outline-none focus:ring-1 focus:ring-indigo-500 text-sm"
                  >
                    {displayCitiesList.map((ac) => (
                      <option key={ac.nameEn} value={ac.nameEn}>
                        {lang === 'ar' ? ac.nameAr : ac.nameEn} ({lang === 'ar' ? ac.countryEn === 'Saudi Arabia' ? 'السعودية' : ac.countryEn : ac.countryEn})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2.5">{t.genderLabel}</label>
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      type="button"
                      onClick={() => setGender('male')}
                      className={`flex items-center justify-center gap-2 py-4 px-4 border rounded-2xl font-black text-sm uppercase tracking-widest transition-all cursor-pointer ${
                        gender === 'male'
                          ? 'border-indigo-500 bg-indigo-500/20 text-indigo-300 shadow-inner'
                          : 'border-white/10 bg-white/5 hover:bg-white/10 text-slate-400'
                      }`}
                    >
                      🧔 {lang === 'ar' ? 'ذكـر' : 'Male'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setGender('female')}
                      className={`flex items-center justify-center gap-2 py-4 px-4 border rounded-2xl font-black text-sm uppercase tracking-widest transition-all cursor-pointer ${
                        gender === 'female'
                          ? 'border-purple-500 bg-purple-500/20 text-purple-300 shadow-inner'
                          : 'border-white/10 bg-white/5 hover:bg-white/10 text-slate-400'
                      }`}
                    >
                      👩 {lang === 'ar' ? 'أنثى' : 'Female'}
                    </button>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-3">
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest">
                      {t.avatarLabel}
                    </label>
                    <div className="flex bg-white/5 p-0.5 rounded-lg border border-white/5">
                      <button
                        type="button"
                        onClick={() => setAvatarTab('emoji')}
                        className={`px-2 py-1 text-[9px] font-black uppercase rounded ${avatarTab === 'emoji' ? 'bg-indigo-500 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                      >
                        {lang === 'ar' ? 'رموز' : 'Emojis'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setAvatarTab('photo')}
                        className={`px-2 py-1 text-[9px] font-black uppercase rounded ${avatarTab === 'photo' ? 'bg-indigo-500 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                      >
                        {lang === 'ar' ? 'المعرض والرفع' : 'Photo Gallery'}
                      </button>
                    </div>
                  </div>

                  {/* Selected Avatar Preview Sphere */}
                  <div className="flex items-center gap-4 bg-white/5 p-3 rounded-2xl border border-white/5 mb-4">
                    <div className="w-14 h-14 rounded-full bg-[#0B0E14] border-2 border-indigo-500/40 flex items-center justify-center text-3xl overflow-hidden select-none shrink-0">
                      {(!avatar?.startsWith?.('http') && (avatar?.length || 0) <= 4) ? (
                        avatar
                      ) : (
                        <img src={avatar} alt="Selected Avatar" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      )}
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-white">{lang === 'ar' ? 'ملمحك الحالي المعين' : 'Active Avatar Preview'}</h4>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        {(!avatar?.startsWith?.('http') && (avatar?.length || 0) <= 4)
                          ? (lang === 'ar' ? 'رمز تعبيري نشط' : 'Emoji Avatar selected')
                          : (lang === 'ar' ? 'أفاتار مخصص من المعرض والملفات' : 'Custom high-res picture loaded')
                        }
                      </p>
                    </div>
                  </div>

                  {avatarTab === 'emoji' ? (
                    <div className="grid grid-cols-5 gap-2.5 animate-in fade-in-50 duration-200">
                      {avatars.map((av) => (
                        <button
                          type="button"
                          key={av}
                          onClick={() => setAvatar(av)}
                          className={`py-3 text-2xl border flex justify-center rounded-2xl transition-all cursor-pointer ${avatar === av ? 'border-indigo-500 bg-indigo-500/20 shadow-inner' : 'border-white/10 bg-white/5 hover:bg-white/10'}`}
                        >
                          {av}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-3.5 animate-in fade-in-50 duration-200">
                      {/* Photo List Gallery */}
                      <div className="grid grid-cols-4 gap-2.5">
                        {photoAvatars.map((url, index) => (
                          <button
                            type="button"
                            key={index}
                            onClick={() => setAvatar(url)}
                            className={`relative aspect-square rounded-2xl border overflow-hidden transition-all cursor-pointer ${avatar === url ? 'border-indigo-500 ring-2 ring-indigo-500/50 scale-95 shadow-inner' : 'border-white/10 hover:border-white/20'}`}
                          >
                            <img src={url} alt={`Avatar Preset ${index + 1}`} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          </button>
                        ))}
                        
                        {/* Custom Local Upload Selector Trigger Card */}
                        <button
                          type="button"
                          onClick={() => hiddenFileInputRef.current?.click()}
                          className="relative aspect-square rounded-2xl border border-dashed border-slate-500 bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-all flex flex-col items-center justify-center gap-1 cursor-pointer"
                        >
                          <span className="text-xl">+</span>
                          <span className="text-[8px] font-black uppercase text-center px-1">
                            {lang === 'ar' ? 'رفع ملف' : 'Upload File'}
                          </span>
                        </button>
                      </div>

                      {/* Hidden Device Input */}
                      <input
                        type="file"
                        ref={hiddenFileInputRef}
                        onChange={handleCustomAvatarUpload}
                        accept="image/*"
                        className="hidden"
                      />
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-4 mt-8">
                <button
                  onClick={() => setStep('welcome')}
                  className="flex-1 py-4 bg-white/5 hover:bg-white/10 border border-white/10 text-white uppercase tracking-widest font-black rounded-2xl transition text-center text-xs cursor-pointer"
                >
                  {lang === 'ar' ? 'إلغاء' : 'Cancel'}
                </button>

                <button
                  disabled={!name}
                  onClick={() => setStep('quiz')}
                  className="flex-1 py-4 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 disabled:opacity-50 text-white font-black text-sm uppercase tracking-widest rounded-2xl transition-all shadow-lg shadow-indigo-500/20 cursor-pointer flex justify-center items-center gap-2"
                >
                  {lang === 'ar' ? 'المتابعة للاختبار' : 'Proceed to Quiz'} <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          )}



          {step === 'verify' && (
            <motion.div
              key="verify"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="p-8"
              dir={lang === 'ar' ? 'rtl' : 'ltr'}
            >
              <div className="flex items-start gap-4 mb-5">
                <div className="bg-emerald-500/20 border border-emerald-500/30 p-3 rounded-2xl text-emerald-400 shadow-inner shrink-0">
                  <Shield className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-xl font-display font-black text-white">{t.identityTitle}</h2>
                  <p className="text-xs text-slate-400 font-medium mt-1">{t.identitySubtitle}</p>
                </div>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed bg-[#0B0E14] shadow-inner p-5 rounded-2xl border border-white/5 mb-6 text-center font-bold">
                {t.identityBanner}
              </p>

              <div className="space-y-4">
                <div className="border border-white/10 p-5 rounded-2xl hover:border-white/20 bg-white/5 leading-tight flex items-center justify-between transition-all cursor-pointer shadow-sm group" onClick={() => setIdSubmitted(true)}>
                  <div>
                    <h4 className="text-[10px] font-black text-white uppercase tracking-widest">{t.selfieTitle}</h4>
                    <p className="text-[10px] font-bold text-slate-500 mt-1">{t.selfieDesc}</p>
                  </div>
                  {idSubmitted ? (
                    <span className="text-[10px] font-black text-emerald-400 flex items-center gap-1 uppercase tracking-widest">{t.loadedState}</span>
                  ) : (
                    <button className="px-4 py-2 text-[10px] uppercase font-black tracking-widest text-indigo-300 border border-indigo-500/30 rounded-xl bg-indigo-500/10 group-hover:bg-indigo-500/20 transition-all cursor-pointer">{t.simulateButton}</button>
                  )}
                </div>

                <div className="border border-white/10 p-5 rounded-2xl hover:border-white/20 bg-white/5 leading-tight flex items-center justify-between transition-all cursor-pointer shadow-sm group" onClick={() => setIdSubmitted(true)}>
                  <div>
                    <h4 className="text-[10px] font-black text-white uppercase tracking-widest">{t.passportTitle}</h4>
                    <p className="text-[10px] font-bold text-slate-500 mt-1">{t.passportDesc}</p>
                  </div>
                  {idSubmitted ? (
                    <span className="text-[10px] font-black text-emerald-400 flex items-center gap-1 uppercase tracking-widest">{t.loadedState}</span>
                  ) : (
                    <button className="px-4 py-2 text-[10px] uppercase font-black tracking-widest text-indigo-300 border border-indigo-500/30 rounded-xl bg-indigo-500/10 group-hover:bg-indigo-500/20 transition-all cursor-pointer">{t.simulateButton}</button>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-4 mt-8">
                <button
                  id="btn_verify_skip"
                  onClick={() => {
                    if (email) {
                      localStorage.setItem(`simulated_id_verified_${email}`, 'true');
                    }
                    window.dispatchEvent(new Event('yallamate_force_verify'));
                    setIdSubmitted(false);
                    setStep('quiz');
                  }}
                  className="flex-1 py-4 bg-white/5 hover:bg-white/10 border border-white/10 text-white uppercase tracking-widest font-black rounded-2xl transition-all text-center text-xs cursor-pointer shadow-sm"
                >
                  {t.verifySkipButton}
                </button>
                <button
                  id="btn_verify_next"
                  onClick={() => {
                    if (email) {
                      localStorage.setItem(`simulated_id_verified_${email}`, 'true');
                    }
                    window.dispatchEvent(new Event('yallamate_force_verify'));
                    triggerNextStep();
                  }}
                  className="flex-1 py-4 bg-emerald-500 hover:bg-emerald-400 text-white uppercase tracking-widest font-black rounded-2xl transition-all text-center text-xs shadow-lg shadow-emerald-500/20 cursor-pointer"
                >
                  {t.verifyNowButton}
                </button>
              </div>
            </motion.div>
          )}

          {step === 'quiz' && (
            emailVerified ? (
              <motion.div
                key="quiz"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="p-8"
                dir={lang === 'ar' ? 'rtl' : 'ltr'}
              >
                <div className="flex justify-between items-start mb-8 gap-4">
                  <div>
                    <h2 className="text-2xl font-display font-black text-white">{t.quizTitle}</h2>
                    <p className="text-xs text-slate-400 font-medium mt-1">{t.quizSubtitle}</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <button
                      onClick={() => {
                        setStep('signup_details');
                        setCurrentQuizIndex(0);
                      }}
                      className="px-3 py-1.5 bg-white/5 border border-white/10 hover:bg-white/10 rounded-xl text-[10px] font-black uppercase text-slate-300 font-mono tracking-widest cursor-pointer transition shrink-0"
                    >
                      {lang === 'ar' ? 'رجوع' : 'Back'}
                    </button>
                    <div className="px-4 py-1.5 bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded-xl text-xs font-black select-none uppercase tracking-widest shrink-0">
                      {t.questionCount} {currentQuizIndex + 1}/{quizQuestions.length}
                    </div>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="w-full bg-[#0B0E14] border border-white/5 h-2.5 rounded-full overflow-hidden mb-8 shadow-inner">
                  <div
                    className="bg-gradient-to-r from-indigo-500 to-purple-500 h-full transition-all duration-300"
                    style={{ width: `${((currentQuizIndex + 1) / quizQuestions.length) * 100}%` }}
                  />
                </div>

                <div className="mb-6">
                  <h3 className="text-lg font-black text-white leading-snug drop-shadow-sm">
                    {lang === 'ar' ? quizQuestions[currentQuizIndex].questionAr : quizQuestions[currentQuizIndex].questionEn}
                  </h3>
                </div>

                <div className="space-y-4">
                  {quizQuestions[currentQuizIndex].options.map((option, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSelectOption(option.archetypeScore)}
                      className="w-full text-left p-5 border border-white/10 bg-white/5 rounded-2xl hover:border-indigo-500/50 hover:bg-indigo-500/10 transition-all duration-300 relative cursor-pointer shadow-sm hover:shadow-indigo-500/20"
                    >
                      <div className="font-bold text-slate-200 text-sm leading-relaxed">
                        {lang === 'ar' ? option.textAr : option.textEn}
                      </div>
                    </button>
                  ))}
                </div>
              </motion.div>
            ) : (
              <div className="p-8 text-center text-rose-400 font-bold" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
                <div className="bg-rose-500/10 border border-rose-500/30 p-6 rounded-2xl max-w-sm mx-auto">
                  {lang === 'ar' ? 'عذراً، يجب تفعيل الحساب وتأكيد البريد الإلكتروني أولاً للتمكن من تقديم هذا الاختبار!' : 'Sorry, you must activate your account and verify your email first to take this test!'}
                </div>
              </div>
            )
          )}

          {step === 'result' && (
            <motion.div
              key="result"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="p-8 text-center"
            >
              <Smile className="w-12 h-12 text-emerald-600 mx-auto mb-4" />

              <h2 className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">{t.matchAnalyzed}</h2>
              <h1 className="text-3xl font-display font-black text-white mt-1 leading-tight drop-shadow-sm">{archetypeResult}</h1>
              
              <div className="mt-6 p-6 bg-[#0B0E14] rounded-2xl border border-white/5 shadow-inner max-w-sm mx-auto text-center">
                <p className="text-sm text-slate-300 leading-relaxed font-bold">
                  {lang === 'ar' ? OutingArchetypes[archetypeResult]?.descAr : OutingArchetypes[archetypeResult]?.descEn}
                </p>
                <div className="mt-5 border-t border-white/10 pt-4 text-center">
                  <span className="text-xs italic text-indigo-400 font-bold block">
                    {lang === 'ar' ? OutingArchetypes[archetypeResult]?.quoteAr : OutingArchetypes[archetypeResult]?.quoteEn}
                  </span>
                </div>
              </div>

              <div className="mt-8 flex items-center justify-center gap-2 text-xs text-slate-400 font-bold tracking-wide">
                <CheckCircle className="w-5 h-5 text-emerald-400" />
                <span>{t.setupReady}</span>
              </div>

              {!emailVerified && (
                <div className="w-full mt-4 p-3.5 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-xs text-rose-400 font-bold flex items-center justify-center gap-2 animate-pulse">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>
                    {lang === 'ar' 
                      ? 'تنبيه: البريد الإلكتروني غير مؤكد في قاعدة البيانات بعد. يرجى تأكيد حسابك.' 
                      : 'Notice: Email is not verified in the database yet. Please confirm your account.'}
                  </span>
                </div>
              )}

              <button
                id="btn_enter_dashboard"
                onClick={finalizeRegistration}
                disabled={!emailVerified}
                className="w-full mt-6 py-4 bg-emerald-500 hover:bg-emerald-400 text-white font-black uppercase tracking-widest rounded-2xl transition-all shadow-lg shadow-emerald-500/20 cursor-pointer text-sm disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {t.enterDashboardButton}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
        <div id="recaptcha-container"></div>
      </div>
      <div className="mt-8 text-center text-[10px] text-slate-500 font-bold tracking-widest uppercase opacity-60">
        &copy; {new Date().getFullYear()} علي فؤاد الخضر سالم (Ali Fouad Al-Khidr Salem). All rights reserved.
      </div>
    </div>
  );
}

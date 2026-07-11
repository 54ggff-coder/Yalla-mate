import React, { useState, useEffect } from 'react';
import { 
  Mail, Search, Send, FileText, LogOut, CheckCircle2, 
  AlertCircle, Inbox, ChevronRight, Plus, RefreshCw, 
  User, Calendar, MapPin, Eye, ArrowLeft, Loader2, Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Profile, Outing } from '../types';
import { Language } from '../data/translations';
import { 
  signInGmail, 
  getGmailToken, 
  listGmailMessages, 
  getGmailMessageDetails, 
  sendGmailMessage, 
  createGmailDraft, 
  disconnectGmail,
  DetailedGmailMessage,
  initGmailAuth
} from '../services/gmailService';
import { auth } from '../lib/firebase';

interface GmailCompanionProps {
  currentUser: Profile;
  outings: Outing[];
  lang: Language;
}

export default function GmailCompanion({ currentUser, outings, lang }: GmailCompanionProps) {
  const isAr = lang === 'ar';
  
  // Auth State
  const [token, setToken] = useState<string | null>(getGmailToken());
  const [needsAuth, setNeedsAuth] = useState(!getGmailToken());
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [connectedEmail, setConnectedEmail] = useState<string | null>(auth.currentUser?.email || null);

  // General App States
  const [activeSubTab, setActiveSubTab] = useState<'inbox' | 'invite' | 'compose'>('inbox');
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('subject:(Yalla OR Outing OR Companion OR Plan) OR "Yalla Mate"');
  const [messages, setMessages] = useState<DetailedGmailMessage[]>([]);
  const [selectedMessage, setSelectedMessage] = useState<DetailedGmailMessage | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Invite Tab State
  const [selectedOutingId, setSelectedOutingId] = useState<string>('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [isSendingInvite, setIsSendingInvite] = useState(false);

  // Compose Tab State
  const [composeTo, setComposeTo] = useState('');
  const [composeSubject, setComposeSubject] = useState('');
  const [composeBody, setComposeBody] = useState('');
  const [isSendingCustom, setIsSendingCustom] = useState(false);

  // Confirmation Modal State (MANDATORY security rule!)
  const [confirmAction, setConfirmAction] = useState<{
    type: 'send_invite' | 'draft_invite' | 'send_custom' | 'draft_custom';
    to: string;
    subject: string;
    htmlBody: string;
    onConfirm: () => Promise<void>;
  } | null>(null);

  // Listen to auth state to sync with in-memory token
  useEffect(() => {
    const unsubscribe = initGmailAuth(
      (user, cachedToken) => {
        setToken(cachedToken);
        setNeedsAuth(false);
        setConnectedEmail(user.email);
      },
      () => {
        setToken(null);
        setNeedsAuth(true);
      }
    );
    return () => unsubscribe();
  }, []);

  // Fetch messages when authenticated
  useEffect(() => {
    if (token && activeSubTab === 'inbox') {
      loadInbox();
    }
  }, [token, activeSubTab]);

  const loadInbox = async (customQuery?: string) => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const q = customQuery !== undefined ? customQuery : searchQuery;
      const msgs = await listGmailMessages(q);
      setMessages(msgs);
    } catch (err: any) {
      console.error('Error loading Gmail inbox:', err);
      setErrorMsg(isAr ? 'عذرًا، فشل تحميل الرسائل من Gmail. يرجى التحقق من اتصالك وإعادة المحاولة.' : 'Failed to fetch messages from Gmail. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = async () => {
    setIsLoggingIn(true);
    setErrorMsg(null);
    try {
      const result = await signInGmail();
      if (result) {
        setToken(result.accessToken);
        setNeedsAuth(false);
        setConnectedEmail(result.user.email);
        setSuccessMsg(isAr ? 'تم ربط حساب Google بنجاح!' : 'Successfully connected Google Account!');
        setTimeout(() => setSuccessMsg(null), 4000);
      }
    } catch (err: any) {
      console.error('Login failed:', err);
      setErrorMsg(isAr ? 'فشل الاتصال بحساب Google. يرجى المحاولة مرة أخرى.' : 'Google Sign-In failed. Please try again.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleDisconnect = async () => {
    await disconnectGmail();
    setToken(null);
    setNeedsAuth(true);
    setMessages([]);
    setSelectedMessage(null);
    setSuccessMsg(isAr ? 'تم فصل حساب Gmail بأمان.' : 'Gmail disconnected successfully.');
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  // Generate Email Invitation HTML (Stunningly formatted tables, off-whites, and deep indigo details)
  const generateInviteHtml = (outing: Outing) => {
    const formattedDate = outing.datetime 
      ? new Date(outing.datetime).toLocaleDateString(isAr ? 'ar-EG' : 'en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })
      : '';

    const viewButtonUrl = `https://ais-pre-kgvwge577hxpso5aeo5uil-897317058198.europe-west2.run.app`; // Points to Shared App URL

    return `
      <div style="font-family: 'Inter', system-ui, -apple-system, sans-serif; background-color: #f8fafc; padding: 40px 20px; color: #1e293b; direction: ${isAr ? 'rtl' : 'ltr'}; text-align: ${isAr ? 'right' : 'left'};">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 24px; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.05); overflow: hidden; border: 1px solid #f1f5f9;">
          <!-- Banner Header -->
          <div style="background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); padding: 35px; text-align: center; color: #ffffff;">
            <div style="font-size: 24px; font-weight: 900; letter-spacing: -0.025em; margin-bottom: 8px;">
              ${isAr ? 'Yalla Mate يلا طلعنا 🚀' : 'Yalla Mate Outings 🚀'}
            </div>
            <div style="font-size: 13px; font-weight: 600; opacity: 0.9; text-transform: uppercase; letter-spacing: 0.05em;">
              ${isAr ? 'دعوة للانضمام إلى تجمع مميز!' : 'You\'re Invited to a Gathering!'}
            </div>
          </div>
          
          <!-- Content Body -->
          <div style="padding: 40px;">
            <p style="font-size: 15px; line-height: 1.6; margin-bottom: 25px; color: #475569;">
              ${isAr 
                ? `مرحباً، لقد قام صديقك <strong>${outing.creatorName || 'أحد الرفقاء'}</strong> بدعوتك للانضمام إلى طلعة جديدة منسقة بعناية عبر تطبيق <strong>Yalla Mate</strong>!` 
                : `Hello, your friend <strong>${outing.creatorName || 'A Companion'}</strong> has invited you to join a carefully-curated outing on <strong>Yalla Mate</strong>!`
              }
            </p>
            
            <!-- Outing Card -->
            <div style="background-color: #f8fafc; border-radius: 16px; border: 1px solid #e2e8f0; padding: 25px; margin-bottom: 30px;">
              <h2 style="font-size: 18px; font-weight: 800; color: #1e293b; margin-top: 0; margin-bottom: 12px; letter-spacing: -0.025em;">
                ${outing.title}
              </h2>
              <p style="font-size: 13px; color: #64748b; line-height: 1.5; margin-bottom: 20px;">
                ${outing.description || (isAr ? 'لا يوجد وصف.' : 'No description provided.')}
              </p>
              
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 6px 0; font-size: 13px; color: #64748b; font-weight: 600; width: 100px;">
                    ${isAr ? '📅 التوقيت:' : '📅 When:'}
                  </td>
                  <td style="padding: 6px 0; font-size: 13px; color: #1e293b; font-weight: 700;">
                    ${formattedDate}
                  </td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; font-size: 13px; color: #64748b; font-weight: 600;">
                    ${isAr ? '📍 المكان:' : '📍 Where:'}
                  </td>
                  <td style="padding: 6px 0; font-size: 13px; color: #1e293b; font-weight: 700;">
                    ${outing.location} ${outing.city ? `(${outing.city})` : ''}
                  </td>
                </tr>
                ${outing.category ? `
                <tr>
                  <td style="padding: 6px 0; font-size: 13px; color: #64748b; font-weight: 600;">
                    ${isAr ? '🏷️ التصنيف:' : '🏷️ Category:'}
                  </td>
                  <td style="padding: 6px 0; font-size: 13px; color: #1e293b; font-weight: 700;">
                    ${outing.category}
                  </td>
                </tr>` : ''}
                ${outing.minTrustScore ? `
                <tr>
                  <td style="padding: 6px 0; font-size: 13px; color: #64748b; font-weight: 600;">
                    ${isAr ? '★ معدل الأمان:' : '★ Trust Rate:'}
                  </td>
                  <td style="padding: 6px 0; font-size: 13px; color: #10b981; font-weight: 800;">
                    ★ ${outing.minTrustScore.toFixed(1)}+
                  </td>
                </tr>` : ''}
              </table>
            </div>

            <!-- Call To Action Button -->
            <div style="text-align: center; margin-bottom: 35px;">
              <a href="${viewButtonUrl}" target="_blank" style="display: inline-block; background-color: #4f46e5; color: #ffffff; padding: 14px 30px; font-size: 14px; font-weight: 700; border-radius: 12px; text-decoration: none; box-shadow: 0 4px 12px rgba(79, 70, 229, 0.25);">
                ${isAr ? 'عرض تفاصيل الطلعة والمشاركة ➜' : 'View Outing Details & RSVP ➜'}
              </a>
            </div>
            
            <hr style="border: 0; border-top: 1px solid #e2e8f0; margin-bottom: 25px;" />
            
            <p style="font-size: 11px; color: #94a3b8; text-align: center; line-height: 1.5; margin: 0;">
              ${isAr 
                ? 'تصلك هذه الرسالة بناءً على دعوة مرسلة من صديقك عبر نظام Yalla Mate الاجتماعي الآمن.' 
                : 'You are receiving this invitation from your friend through the secure Yalla Mate Social platform.'
              }
              <br/>
              © 2026 Yalla Mate. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    `;
  };

  // Submit trigger to request user confirmation (MANDATORY SECURITY COMPLIANCE)
  const triggerInviteConfirm = (type: 'send_invite' | 'draft_invite') => {
    setErrorMsg(null);
    if (!inviteEmail || !selectedOutingId) {
      setErrorMsg(isAr ? 'يرجى إدخال بريد إلكتروني صالح واختيار طلعة.' : 'Please enter a valid email and select an outing.');
      return;
    }
    const outing = outings.find(o => o.id === selectedOutingId);
    if (!outing) return;

    const subject = isAr 
      ? `دعوة طلعة خاصة من ${outing.creatorName || 'صديقك'}: ${outing.title} 🚀`
      : `Outing Invitation from ${outing.creatorName || 'your friend'}: ${outing.title} 🚀`;
    const htmlBody = generateInviteHtml(outing);

    setConfirmAction({
      type,
      to: inviteEmail,
      subject,
      htmlBody,
      onConfirm: async () => {
        setIsSendingInvite(true);
        try {
          if (type === 'send_invite') {
            await sendGmailMessage(inviteEmail, subject, htmlBody);
            setSuccessMsg(isAr ? 'تم إرسال دعوة Gmail بنجاح!' : 'Gmail invitation sent successfully!');
          } else {
            await createGmailDraft(inviteEmail, subject, htmlBody);
            setSuccessMsg(isAr ? 'تم حفظ المسودة بنجاح في بريدك على Gmail!' : 'Draft successfully saved in your Gmail drafts!');
          }
          setInviteEmail('');
          setTimeout(() => setSuccessMsg(null), 5000);
        } catch (err: any) {
          console.error(err);
          setErrorMsg(err.message || 'Gmail Operation Failed.');
        } finally {
          setIsSendingInvite(false);
          setConfirmAction(null);
        }
      }
    });
  };

  const triggerCustomConfirm = (type: 'send_custom' | 'draft_custom') => {
    setErrorMsg(null);
    if (!composeTo || !composeSubject || !composeBody) {
      setErrorMsg(isAr ? 'يرجى تعبئة جميع الحقول المخصصة لإرسال الرسالة.' : 'Please fill in all custom compose fields.');
      return;
    }

    const htmlBody = `
      <div style="font-family: sans-serif; padding: 20px; line-height: 1.6; color: #333; direction: ${isAr ? 'rtl' : 'ltr'};">
        <div style="max-width: 600px; margin: 0 auto; background: #fff; border: 1px solid #ddd; border-radius: 8px; padding: 25px;">
          <h3 style="color: #4f46e5; margin-top: 0; border-b: 1px solid #eee; padding-bottom: 10px;">Yalla Mate Messenger</h3>
          <p style="white-space: pre-wrap;">${composeBody}</p>
          <hr style="border: 0; border-top: 1px solid #eee; margin-top: 30px;" />
          <p style="font-size: 11px; color: #999;">Sent on behalf of ${connectedEmail} via Yalla Mate Smart Dashboard.</p>
        </div>
      </div>
    `;

    setConfirmAction({
      type,
      to: composeTo,
      subject: composeSubject,
      htmlBody,
      onConfirm: async () => {
        setIsSendingCustom(true);
        try {
          if (type === 'send_custom') {
            await sendGmailMessage(composeTo, composeSubject, htmlBody);
            setSuccessMsg(isAr ? 'تم إرسال رسالتك المخصصة عبر Gmail!' : 'Custom email successfully sent via Gmail!');
          } else {
            await createGmailDraft(composeTo, composeSubject, htmlBody);
            setSuccessMsg(isAr ? 'تم حفظ رسالتك كمسودة في Gmail!' : 'Custom draft successfully saved in Gmail drafts!');
          }
          setComposeTo('');
          setComposeSubject('');
          setComposeBody('');
          setTimeout(() => setSuccessMsg(null), 5000);
        } catch (err: any) {
          console.error(err);
          setErrorMsg(err.message || 'Gmail Operation Failed.');
        } finally {
          setIsSendingCustom(false);
          setConfirmAction(null);
        }
      }
    });
  };

  // Login UI Container
  if (needsAuth) {
    return (
      <div className="bg-white dark:bg-slate-950 p-8 rounded-3xl border border-gray-150 dark:border-slate-800 text-center space-y-6 max-w-md mx-auto my-12" dir={isAr ? 'rtl' : 'ltr'}>
        <div className="w-16 h-16 bg-indigo-50 dark:bg-indigo-950/40 rounded-full flex items-center justify-center mx-auto text-indigo-600 dark:text-indigo-400">
          <Mail className="w-8 h-8" />
        </div>
        
        <div className="space-y-2">
          <h3 className="text-lg font-black text-gray-900 dark:text-white">
            {isAr ? 'تفعيل ميزات Gmail 📬' : 'Unlock Gmail Integration 📬'}
          </h3>
          <p className="text-xs text-gray-500 dark:text-slate-400 leading-relaxed">
            {isAr 
              ? 'تسمح لك هذه الميزة بالبحث وقراءة رسائل بريدك المتعلقة بالتجمعات، وإرسال دعوات منسقة لأصدقائك بضغطة زر وحفظ المسودات، وذلك عبر تفويض أمن بالكامل بموافقتك.' 
              : 'Allows you to search/read inbox coordination emails, send styled outing invitations directly to companions, or create drafts securely, with your permission.'
            }
          </p>
        </div>

        <div className="bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800/80 p-4 rounded-2xl text-start flex items-start gap-2.5 text-[11px] text-gray-600 dark:text-slate-400">
          <Info className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
          <span>
            {isAr
              ? 'نحن نلتزم بسياسة الخصوصية التامة. تُحفظ رموز الوصول (Tokens) مؤقتاً في ذاكرة المتصفح فقط ولا يتم تخزينها في أي خادم خارجي.'
              : 'Tokens are stored strictly in-memory in your browser, never on external servers, prioritizing your credentials security.'
            }
          </span>
        </div>

        <button
          onClick={handleLogin}
          disabled={isLoggingIn}
          className="w-full flex items-center justify-center gap-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:opacity-90 active:scale-95 py-3.5 rounded-2xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer disabled:opacity-50"
        >
          {isLoggingIn ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>{isAr ? 'جاري الاتصال بـ Google...' : 'Connecting to Google...'}</span>
            </>
          ) : (
            <>
              <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="w-4 h-4">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                <path fill="none" d="M0 0h48v48H0z"></path>
              </svg>
              <span>{isAr ? 'تسجيل الدخول باستخدام Google' : 'Sign In with Google'}</span>
            </>
          )}
        </button>

        {errorMsg && (
          <div className="p-3.5 bg-red-500/10 rounded-xl border border-red-500/20 text-[11px] text-red-600 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
            <span>{errorMsg}</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-24" dir={isAr ? 'rtl' : 'ltr'}>
      {/* Header Profile Info Panel */}
      <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800/80 rounded-3xl p-5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-500 shrink-0">
            <Mail className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-black text-gray-950 dark:text-white">
              {isAr ? 'مساعد بريد Gmail الذكي 💌' : 'Smart Gmail Companion 💌'}
            </h3>
            <p className="text-[10px] text-gray-500 dark:text-slate-400 font-bold">
              {isAr ? `متصل بحساب: ${connectedEmail}` : `Connected: ${connectedEmail}`}
            </p>
          </div>
        </div>

        <button 
          onClick={handleDisconnect}
          className="text-[10px] text-rose-500 font-black flex items-center gap-1 bg-rose-500/5 hover:bg-rose-500/10 px-3 py-2 rounded-xl transition-colors shrink-0 max-w-fit"
        >
          <LogOut className="w-3.5 h-3.5" />
          {isAr ? 'فصل حساب بريد Gmail' : 'Disconnect Gmail Account'}
        </button>
      </div>

      {/* Sub tabs bar */}
      <div className="flex bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800/80 p-1 shadow-sm">
        {(['inbox', 'invite', 'compose'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => {
              setActiveSubTab(tab);
              setErrorMsg(null);
            }}
            className={`flex-1 py-2.5 text-[11px] font-black uppercase tracking-wider rounded-xl transition-all ${
              activeSubTab === tab 
                ? 'bg-indigo-600 text-white shadow-sm' 
                : 'text-gray-400 dark:text-slate-500 hover:text-gray-700 dark:hover:text-slate-300'
            }`}
          >
            {tab === 'inbox' && (isAr ? '📬 صندوق الوارد' : '📬 Inbox')}
            {tab === 'invite' && (isAr ? '🚀 دعوة بريدية' : '🚀 Outing Invite')}
            {tab === 'compose' && (isAr ? '✍️ إنشاء مخصص' : '✍️ Compose Custom')}
          </button>
        ))}
      </div>

      {/* Status messages */}
      <AnimatePresence mode="wait">
        {successMsg && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-4 bg-green-500/15 border border-green-500/20 rounded-2xl text-xs font-bold text-green-600 dark:text-green-400 flex items-center gap-2 shadow-sm"
          >
            <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
            <span>{successMsg}</span>
          </motion.div>
        )}

        {errorMsg && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-4 bg-red-500/15 border border-red-500/20 rounded-2xl text-xs font-bold text-red-600 dark:text-red-400 flex items-center gap-2 shadow-sm"
          >
            <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
            <span>{errorMsg}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main tab content */}
      <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800/80 rounded-3xl p-6 shadow-sm min-h-[300px]">
        {activeSubTab === 'inbox' && (
          <div className="space-y-4">
            {/* Search Input */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && loadInbox()}
                  placeholder={isAr ? 'ابحث في رسائل Gmail (مثال: Yalla Mate)...' : 'Search Gmail messages (e.g. subject:outing)...'}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-gray-200 dark:border-slate-800/80 rounded-2xl pl-10 pr-4 py-3 text-xs font-medium text-gray-800 dark:text-white outline-none focus:border-indigo-500 focus:bg-white"
                />
              </div>
              <button
                onClick={() => loadInbox()}
                disabled={isLoading}
                className="bg-slate-900 dark:bg-slate-800 text-white p-3.5 rounded-2xl hover:opacity-90 active:scale-95 transition-all cursor-pointer flex items-center justify-center disabled:opacity-50"
              >
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              </button>
            </div>

            {/* Selected Message Detail Overlay */}
            {selectedMessage ? (
              <div className="space-y-4 border border-indigo-100 dark:border-slate-800 p-6 rounded-3xl bg-slate-50/50 dark:bg-slate-950/30 relative">
                <button
                  onClick={() => setSelectedMessage(null)}
                  className="flex items-center gap-1.5 text-xs font-bold text-gray-400 hover:text-indigo-600 transition-colors"
                >
                  <ArrowLeft className={`w-4 h-4 ${isAr ? 'rotate-180' : ''}`} />
                  {isAr ? 'العودة لصندوق الوارد' : 'Back to Inbox'}
                </button>

                <div className="border-b border-gray-100 dark:border-slate-800/80 pb-4 space-y-2">
                  <h2 className="text-sm font-black text-gray-950 dark:text-white leading-tight">
                    {selectedMessage.subject}
                  </h2>
                  <div className="flex flex-wrap gap-2 text-[10px] text-gray-500 dark:text-slate-400 font-bold">
                    <span>{isAr ? 'من:' : 'From:'} {selectedMessage.from}</span>
                    <span>&bull;</span>
                    <span>{isAr ? 'التاريخ:' : 'Date:'} {new Date(selectedMessage.date).toLocaleString(isAr ? 'ar-EG' : 'en-US')}</span>
                  </div>
                  
                  {/* Label pills */}
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {selectedMessage.labels.map(l => (
                      <span key={l} className="px-2 py-0.5 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100/50 dark:border-indigo-900/50 text-indigo-600 dark:text-indigo-400 rounded text-[9px] font-black uppercase tracking-wider">
                        {l}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Email HTML Safe Decoded Box */}
                <div 
                  className="prose dark:prose-invert prose-xs max-w-none max-h-[400px] overflow-y-auto bg-white dark:bg-slate-950 border border-gray-100 dark:border-slate-800 p-4 rounded-2xl"
                  dangerouslySetInnerHTML={{ __html: selectedMessage.body }}
                />
              </div>
            ) : (
              /* Message List */
              <div className="space-y-2.5 max-h-[500px] overflow-y-auto pr-1">
                {isLoading ? (
                  <div className="text-center py-16 space-y-3">
                    <Loader2 className="w-8 h-8 animate-spin mx-auto text-indigo-500" />
                    <p className="text-xs font-bold text-gray-400">{isAr ? 'جاري جلب رسائل بريد Gmail المنسقة...' : 'Acquiring relevant Gmail updates...'}</p>
                  </div>
                ) : messages.length > 0 ? (
                  messages.map(msg => (
                    <div
                      key={msg.id}
                      onClick={() => setSelectedMessage(msg)}
                      className="p-4 bg-slate-50 dark:bg-slate-950/50 border border-slate-100 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-950 rounded-2xl transition-all cursor-pointer flex items-start justify-between gap-3 group shadow-sm"
                    >
                      <div className="space-y-1 text-start overflow-hidden flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest truncate max-w-[150px]">
                            {msg.from.split('<')[0].trim() || 'Sender'}
                          </span>
                          <span className="text-[9px] text-gray-400">&bull;</span>
                          <span className="text-[9px] text-gray-400 truncate">
                            {new Date(msg.date).toLocaleDateString(isAr ? 'ar-EG' : 'en-US')}
                          </span>
                        </div>
                        <h4 className="text-xs font-black text-gray-900 dark:text-white truncate group-hover:text-indigo-600 transition-colors">
                          {msg.subject}
                        </h4>
                        <p className="text-[10px] text-gray-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                          {msg.snippet}
                        </p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-gray-300 dark:text-slate-700 group-hover:text-indigo-500 transition-colors self-center shrink-0" />
                    </div>
                  ))
                ) : (
                  <div className="text-center py-16 bg-slate-50/50 dark:bg-slate-950/30 rounded-3xl border border-dashed border-gray-200 dark:border-slate-800">
                    <Inbox className="w-8 h-8 text-gray-350 dark:text-slate-650 mx-auto mb-2" />
                    <h4 className="text-xs font-black text-gray-500 dark:text-slate-400">
                      {isAr ? 'لا توجد رسائل مطابقة' : 'No matching messages found'}
                    </h4>
                    <p className="text-[10px] text-gray-400 max-w-xs mx-auto mt-1">
                      {isAr 
                        ? 'جرّب البحث عن كلمات أخرى أو كتابة موضوع محدد.' 
                        : 'Try searching other terms or write an empty string to view recent inbox.'
                      }
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {activeSubTab === 'invite' && (
          <div className="space-y-6 text-start">
            <div className="space-y-1 border-b border-gray-150 dark:border-slate-850 pb-3">
              <h3 className="text-sm font-black text-gray-950 dark:text-white uppercase tracking-widest">
                {isAr ? 'إنشاء دعوة بريدية فاخرة 🚀' : 'Create Stunning Email Invite 🚀'}
              </h3>
              <p className="text-xs text-gray-500 dark:text-slate-400">
                {isAr 
                  ? 'اختر طلعة مجهزة من حسابك لإرسالها بتنسيق بريد إلكتروني تفاعلي فائق الجمال لأصدقائك عبر Gmail.' 
                  : 'Choose an outing to generate a beautiful, responsive HTML email invite containing timing, location, maps, and RSVP buttons.'
                }
              </p>
            </div>

            <div className="space-y-4">
              {/* Outing Selector */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-wider block">
                  {isAr ? '١. اختر الطلعة النشطة:' : '1. Select Outing:'}
                </label>
                {outings.length > 0 ? (
                  <select
                    value={selectedOutingId}
                    onChange={(e) => setSelectedOutingId(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-gray-200 dark:border-slate-800 rounded-2xl px-4 py-3 text-xs font-bold text-gray-800 dark:text-white outline-none focus:border-indigo-500 focus:bg-white cursor-pointer"
                  >
                    <option value="">{isAr ? '-- حدد الطلعة --' : '-- Select Outing --'}</option>
                    {outings.map(o => (
                      <option key={o.id} value={o.id}>
                        {o.title} &bull; {o.location} ({o.city})
                      </option>
                    ))}
                  </select>
                ) : (
                  <p className="text-xs text-slate-400 italic">
                    {isAr ? 'لم تشارك في أي طلعة بعد. بادر بإنشاء طلعة أولاً.' : 'No active outings found. Go ahead and plan one first!'}
                  </p>
                )}
              </div>

              {/* Recipient Email */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-wider block">
                  {isAr ? '٢. البريد الإلكتروني للمستلم:' : '2. Recipient Email Address:'}
                </label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="companion@example.com"
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-gray-200 dark:border-slate-800 rounded-2xl px-4 py-3 text-xs font-bold text-gray-850 dark:text-white outline-none focus:border-indigo-500 focus:bg-white"
                />
              </div>

              {/* Preview Box if Outing Selected */}
              {selectedOutingId && (
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-indigo-500 uppercase tracking-wider block">
                    {isAr ? '🔍 معاينة البريد الصادر:' : '🔍 Outgoing Email Preview:'}
                  </label>
                  <div className="border border-indigo-100 dark:border-slate-800/80 rounded-2xl p-4 bg-slate-50/50 dark:bg-slate-950/20 max-h-[250px] overflow-y-auto">
                    {(() => {
                      const outing = outings.find(o => o.id === selectedOutingId);
                      if (!outing) return null;
                      return (
                        <div className="text-xs space-y-3">
                          <div className="border-b border-indigo-50 pb-2">
                            <span className="font-bold text-indigo-600">Subject: </span>
                            <span className="text-gray-700 dark:text-slate-300">
                              {isAr 
                                ? `دعوة طلعة خاصة من ${outing.creatorName || 'صديقك'}: ${outing.title} 🚀`
                                : `Outing Invitation from ${outing.creatorName || 'your friend'}: ${outing.title} 🚀`}
                            </span>
                          </div>
                          <div className="space-y-2">
                            <div className="font-black text-gray-900 dark:text-white text-sm">{outing.title}</div>
                            <p className="text-[11px] text-gray-500">{outing.description}</p>
                            <div className="grid grid-cols-2 gap-2 text-[10px] font-bold text-gray-600 dark:text-slate-400">
                              <div>📍 {outing.location}</div>
                              <div>📅 {outing.datetime ? new Date(outing.datetime).toLocaleDateString() : ''}</div>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              )}

              {/* Submit Buttons */}
              <div className="grid grid-cols-2 gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => triggerInviteConfirm('draft_invite')}
                  disabled={isSendingInvite || !selectedOutingId || !inviteEmail}
                  className="bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-white hover:bg-slate-200 dark:hover:bg-slate-700 transition-all cursor-pointer font-black py-3 rounded-2xl text-xs flex items-center justify-center gap-2 disabled:opacity-40"
                >
                  <FileText className="w-4 h-4" />
                  {isAr ? 'حفظ كمسودة في Gmail' : 'Save Gmail Draft'}
                </button>
                <button
                  type="button"
                  onClick={() => triggerInviteConfirm('send_invite')}
                  disabled={isSendingInvite || !selectedOutingId || !inviteEmail}
                  className="bg-indigo-600 text-white hover:bg-indigo-700 transition-all cursor-pointer font-black py-3 rounded-2xl text-xs flex items-center justify-center gap-2 disabled:opacity-40 shadow-md shadow-indigo-500/20"
                >
                  {isSendingInvite ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  {isAr ? 'إرسال عبر Gmail الآن' : 'Send via Gmail Now'}
                </button>
              </div>
            </div>
          </div>
        )}

        {activeSubTab === 'compose' && (
          <div className="space-y-6 text-start">
            <div className="space-y-1 border-b border-gray-150 dark:border-slate-850 pb-3">
              <h3 className="text-sm font-black text-gray-950 dark:text-white uppercase tracking-widest">
                {isAr ? 'إنشاء وتصميم رسالة حرة ✍️' : 'Compose Custom Email ✍️'}
              </h3>
              <p className="text-xs text-gray-500 dark:text-slate-400">
                {isAr 
                  ? 'اكتب رسالة حرة وقم بإرسالها أو حفظها كمسودة لأي صديق ببريد إلكتروني منسق مباشرة.' 
                  : 'Write a custom message, format it cleanly, and send or save draft directly using your connected Gmail API.'
                }
              </p>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-wider block">
                  {isAr ? 'إلى البريد الإلكتروني:' : 'To Email Address:'}
                </label>
                <input
                  type="email"
                  value={composeTo}
                  onChange={(e) => setComposeTo(e.target.value)}
                  placeholder="buddy@example.com"
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-gray-200 dark:border-slate-800 rounded-2xl px-4 py-3 text-xs font-bold text-gray-850 dark:text-white outline-none focus:border-indigo-500 focus:bg-white"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-wider block">
                  {isAr ? 'عنوان الرسالة (الموضوع):' : 'Email Subject:'}
                </label>
                <input
                  type="text"
                  value={composeSubject}
                  onChange={(e) => setComposeSubject(e.target.value)}
                  placeholder={isAr ? 'تنسيق تفاصيل تجمعنا القادم' : 'Meeting Details / Plans Update'}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-gray-200 dark:border-slate-800 rounded-2xl px-4 py-3 text-xs font-bold text-gray-850 dark:text-white outline-none focus:border-indigo-500 focus:bg-white"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-wider block">
                  {isAr ? 'محتوى الرسالة (نص حر):' : 'Message Body:'}
                </label>
                <textarea
                  rows={5}
                  value={composeBody}
                  onChange={(e) => setComposeBody(e.target.value)}
                  placeholder={isAr ? 'مرحباً، أود تذكيرك بالترتيبات للتجمع القادم...' : 'Hi buddy, wanted to drop a quick line about our next adventure...'}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-gray-200 dark:border-slate-800 rounded-2xl px-4 py-3 text-xs font-medium text-gray-850 dark:text-white outline-none focus:border-indigo-500 focus:bg-white resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => triggerCustomConfirm('draft_custom')}
                  disabled={isSendingCustom || !composeTo || !composeSubject || !composeBody}
                  className="bg-slate-100 dark:bg-slate-800 text-slate-850 dark:text-white hover:bg-slate-200 dark:hover:bg-slate-700 transition-all cursor-pointer font-black py-3 rounded-2xl text-xs flex items-center justify-center gap-2 disabled:opacity-40"
                >
                  <FileText className="w-4 h-4" />
                  {isAr ? 'حفظ كمسودة في Gmail' : 'Save Draft to Gmail'}
                </button>
                <button
                  type="button"
                  onClick={() => triggerCustomConfirm('send_custom')}
                  disabled={isSendingCustom || !composeTo || !composeSubject || !composeBody}
                  className="bg-indigo-600 text-white hover:bg-indigo-700 transition-all cursor-pointer font-black py-3 rounded-2xl text-xs flex items-center justify-center gap-2 disabled:opacity-40 shadow-md shadow-indigo-500/20"
                >
                  {isSendingCustom ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  {isAr ? 'إرسال بريد Gmail مخصص' : 'Send via Gmail'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Confirmation Modal Overlay (MANDATORY security best-practice compliance) */}
      {confirmAction && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-gray-150 dark:border-slate-800 max-w-md w-full shadow-2xl space-y-4 animate-in zoom-in-95 duration-200 text-start relative" dir={isAr ? 'rtl' : 'ltr'}>
            
            <div className="flex items-center gap-2.5 text-indigo-600 dark:text-indigo-400">
              <Mail className="w-5 h-5 shrink-0" />
              <h4 className="text-sm font-black uppercase tracking-wider">
                {isAr ? 'تأكيد العملية عبر Gmail 🔒' : 'Confirm Gmail Authorization 🔒'}
              </h4>
            </div>

            <p className="text-xs text-gray-600 dark:text-slate-300 leading-relaxed">
              {confirmAction.type.startsWith('send_') ? (
                isAr 
                  ? `هل أنت متأكد تماماً من رغبتك في إرسال هذا البريد الإلكتروني نيابة عنك إلى <strong>${confirmAction.to}</strong>؟`
                  : `Are you sure you want to send this email on your behalf to <strong>${confirmAction.to}</strong>?`
              ) : (
                isAr 
                  ? `هل تريد حفظ هذه الرسالة كمسودة في حسابك على Gmail لتعديلها أو إرسالها لاحقاً؟`
                  : `Would you like to save this draft in your Gmail account so you can view/send it later?`
              )}
            </p>

            <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl border border-gray-200 dark:border-slate-800 text-[11px] font-bold text-gray-500 dark:text-slate-400 space-y-1">
              <div><span className="text-indigo-600 dark:text-indigo-400">To:</span> {confirmAction.to}</div>
              <div><span className="text-indigo-600 dark:text-indigo-400">Subject:</span> {confirmAction.subject}</div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setConfirmAction(null)}
                className="flex-1 bg-slate-100 dark:bg-slate-800 text-gray-800 dark:text-white hover:opacity-90 rounded-2xl py-3 text-xs font-black uppercase tracking-wider transition-opacity cursor-pointer text-center"
              >
                {isAr ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                onClick={confirmAction.onConfirm}
                className="flex-1 bg-indigo-600 text-white hover:bg-indigo-700 rounded-2xl py-3 text-xs font-black uppercase tracking-wider transition-all cursor-pointer text-center shadow-md"
              >
                {isAr ? 'تأكيد ومتابعة' : 'Confirm & Proceed'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import React, { useState } from 'react';
import { Settings, Shield, Bell, Moon, LogOut, ChevronRight, X, User, Globe, Sun, BatteryCharging } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Language } from '../data/translations';
import { haptic } from '../lib/haptics';

interface SettingsModalProps {
  lang: Language;
  onClose: () => void;
  onThemeToggle: () => void;
  onLogout: () => void;
  onEditProfile?: () => void;
  onToggleLang?: () => void;
  theme?: string;
}

export default function SettingsModal({ lang, onClose, onThemeToggle, onLogout, onEditProfile, onToggleLang, theme = 'dark' }: SettingsModalProps) {
  const [activeMenu, setActiveMenu] = useState<'main' | 'account' | 'notifications' | 'privacy'>('main');
  const isAr = lang === 'ar';

  const [notificationsEnabled, setNotificationsEnabled] = useState(() => {
    return localStorage.getItem('notifications_enabled') !== 'false';
  });

  const [snoozeDuration, setSnoozeDuration] = useState(() => {
    return localStorage.getItem('yallamate_notifications_snooze_duration') || 'none';
  });

  const [snoozeUntil, setSnoozeUntil] = useState(() => {
    return localStorage.getItem('yallamate_notifications_snooze_until') || '';
  });

  const [lowPowerMode, setLowPowerMode] = useState(() => {
    return localStorage.getItem('yallamate_low_power_mode') === 'true';
  });

  const [userStatus, setUserStatus] = useState<'available' | 'busy'>(() => {
    return (localStorage.getItem('yallamate_user_status') as 'available' | 'busy') || 'available';
  });

  const [smartRulesEnabled, setSmartRulesEnabled] = useState(() => {
    return localStorage.getItem('yallamate_smart_rules_enabled') !== 'false';
  });

  const [prioritizeDMs, setPrioritizeDMs] = useState(() => {
    return localStorage.getItem('yallamate_prioritize_dms') !== 'false';
  });

  const [autoSnoozeAtNight, setAutoSnoozeAtNight] = useState(() => {
    return localStorage.getItem('yallamate_auto_snooze_night') !== 'false';
  });

  const handleToggleSmartRules = () => {
    const val = !smartRulesEnabled;
    setSmartRulesEnabled(val);
    localStorage.setItem('yallamate_smart_rules_enabled', String(val));
    haptic();
  };

  const handleTogglePrioritizeDMs = () => {
    const val = !prioritizeDMs;
    setPrioritizeDMs(val);
    localStorage.setItem('yallamate_prioritize_dms', String(val));
    haptic();
  };

  const handleToggleAutoSnooze = () => {
    const val = !autoSnoozeAtNight;
    setAutoSnoozeAtNight(val);
    localStorage.setItem('yallamate_auto_snooze_night', String(val));
    haptic();
  };

  const handleUserStatusChange = (status: 'available' | 'busy') => {
    setUserStatus(status);
    localStorage.setItem('yallamate_user_status', status);
    haptic();
  };

  const handleToggleNotifications = () => {
    const newVal = !notificationsEnabled;
    setNotificationsEnabled(newVal);
    localStorage.setItem('notifications_enabled', String(newVal));
    haptic();
  };

  const handleSnoozeChange = (duration: string) => {
    haptic();
    setSnoozeDuration(duration);
    localStorage.setItem('yallamate_notifications_snooze_duration', duration);
    if (duration === 'none') {
      setSnoozeUntil('');
      localStorage.removeItem('yallamate_notifications_snooze_until');
      window.dispatchEvent(new CustomEvent('yallamate_snooze_change', { detail: { snoozed: false } }));
    } else {
      const now = new Date();
      let until = new Date();
      if (duration === '1h') {
        until.setHours(now.getHours() + 1);
      } else if (duration === '8h') {
        until.setHours(now.getHours() + 8);
      } else if (duration === 'tomorrow') {
        until.setDate(now.getDate() + 1);
        until.setHours(8, 0, 0, 0); // Until 8 AM tomorrow
      }
      const untilStr = until.toISOString();
      setSnoozeUntil(untilStr);
      localStorage.setItem('yallamate_notifications_snooze_until', untilStr);
      window.dispatchEvent(new CustomEvent('yallamate_snooze_change', { detail: { snoozed: true, until: untilStr } }));
    }
  };

  const handleToggleLowPower = () => {
    const newVal = !lowPowerMode;
    setLowPowerMode(newVal);
    localStorage.setItem('yallamate_low_power_mode', String(newVal));
    window.dispatchEvent(new CustomEvent('yallamate_low_power_mode_change', { detail: { enabled: newVal } }));
    haptic();
  };

  const menuItems = [
    { id: 'account', icon: User, labelAr: 'إعدادات الحساب', labelEn: 'Account Settings', color: 'text-blue-400', bg: 'bg-blue-400/10' },
    { id: 'privacy', icon: Shield, labelAr: 'الخصوصية والأمان', labelEn: 'Privacy & Security', color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
  ];

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center bg-[#07090E]/90 backdrop-blur-md sm:p-4"
    >
      <motion.div 
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="w-full sm:max-w-md h-[85vh] sm:h-auto sm:max-h-[85vh] bg-[#111622] rounded-t-[32px] sm:rounded-[32px] border border-white/10 flex flex-col shadow-2xl relative"
        dir={isAr ? 'rtl' : 'ltr'}
      >
        <div className="flex items-center justify-between p-5 border-b border-white/5">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-indigo-400" />
            <h3 className="text-sm font-black text-white tracking-widest uppercase">
              {activeMenu === 'main' 
                ? (isAr ? 'الإعدادات المتقدمة' : 'Advanced Settings') 
                : (isAr ? 'رجوع' : 'Back')}
            </h3>
          </div>
          <button 
            onClick={() => activeMenu === 'main' ? onClose() : setActiveMenu('main')}
            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto flex-1 space-y-4 scrollbar-none">
          <AnimatePresence mode="wait">
            {activeMenu === 'main' && (
              <motion.div 
                key="main"
                initial={{ opacity: 0, x: isAr ? 20 : -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: isAr ? -20 : 20 }}
                className="space-y-4"
              >
                <div className="space-y-2">
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-2 block">
                    {isAr ? 'عام' : 'General'}
                  </span>
                  {menuItems.map(item => (
                    <button
                      key={item.id}
                      onClick={() => { 
                        haptic(); 
                        if (item.id === 'account' && onEditProfile) {
                          onEditProfile();
                        } else {
                          setActiveMenu(item.id as any); 
                        }
                      }}
                      className="w-full flex items-center justify-between p-3.5 bg-white/5 hover:bg-white/10 border border-white/5 rounded-2xl transition-all cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${item.bg} ${item.color}`}>
                          <item.icon className="w-4 h-4" />
                        </div>
                        <span className="text-xs font-bold text-slate-200">
                          {isAr ? item.labelAr : item.labelEn}
                        </span>
                      </div>
                      <ChevronRight className={`w-4 h-4 text-slate-500 ${isAr ? 'rotate-180' : ''}`} />
                    </button>
                  ))}
                </div>

                <div className="space-y-2 pt-2">
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-2 block">
                    {isAr ? 'تفضيلات التطبيق' : 'App Preferences'}
                  </span>
                  
                  {/* Notifications Toggle */}
                  <div className="w-full flex flex-col p-3.5 bg-white/5 border border-white/5 rounded-2xl transition-all space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-amber-500/10 text-amber-400">
                          <Bell className="w-4 h-4" />
                        </div>
                        <div className="flex flex-col items-start">
                          <span className="text-xs font-bold text-slate-200">
                            {isAr ? 'الإشعارات والتنبيهات' : 'Push Notifications'}
                          </span>
                          <span className="text-[9px] text-slate-500">
                            {isAr ? 'تلقي تنبيهات الطلعات والرسائل' : 'Get alerts for outings & messages'}
                          </span>
                        </div>
                      </div>
                      <button 
                        onClick={handleToggleNotifications}
                        className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer outline-none flex items-center ${notificationsEnabled ? 'bg-indigo-500' : 'bg-slate-700'}`}
                      >
                        <motion.div 
                          layout
                          className="w-4 h-4 bg-white rounded-full shadow-md mx-1"
                          animate={{ x: notificationsEnabled ? 18 : 0 }}
                          transition={{ type: "spring", stiffness: 500, damping: 30 }}
                        />
                      </button>
                    </div>

                    {notificationsEnabled && (
                      <div className="border-t border-white/5 pt-3 space-y-2">
                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block">
                          {isAr ? 'تأجيل تنبيهات الطلعات' : 'Snooze Outing Alerts'}
                        </span>
                        <div className="flex flex-wrap gap-2">
                          {[
                            { value: 'none', labelEn: 'None', labelAr: 'تعطيل' },
                            { value: '1h', labelEn: '1 Hour', labelAr: 'ساعة' },
                            { value: '8h', labelEn: '8 Hours', labelAr: '٨ ساعات' },
                            { value: 'tomorrow', labelEn: 'Tomorrow', labelAr: 'للغد' },
                          ].map((dur) => {
                            const isSelected = snoozeDuration === dur.value;
                            return (
                              <button
                                key={dur.value}
                                onClick={() => handleSnoozeChange(dur.value)}
                                className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer ${isSelected ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'bg-white/5 text-slate-400 hover:bg-white/10'}`}
                              >
                                {isAr ? dur.labelAr : dur.labelEn}
                              </button>
                            );
                          })}
                        </div>
                        {snoozeUntil && snoozeDuration !== 'none' && (
                          <span className="text-[9px] text-amber-400 block mt-1">
                            {isAr 
                              ? `تنبيهات صامتة حتى: ${new Date(snoozeUntil).toLocaleString('ar-SA', { hour: '2-digit', minute: '2-digit', weekday: 'short' })}` 
                              : `Silenced until: ${new Date(snoozeUntil).toLocaleString('en-US', { hour: '2-digit', minute: '2-digit', weekday: 'short' })}`}
                          </span>
                        )}

                        {/* AI Smart Rules Sub-Panel */}
                        <div className="border-t border-white/5 pt-3.5 mt-2 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest block">
                              🧠 {isAr ? 'قواعد المُرشد الذكية للتنبيهات' : 'Al-Murshed Smart Rules'}
                            </span>
                            <button
                              onClick={handleToggleSmartRules}
                              className={`px-2 py-1 rounded-lg text-[8px] font-black uppercase tracking-wider transition-all ${smartRulesEnabled ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30' : 'bg-white/5 text-slate-500'}`}
                            >
                              {smartRulesEnabled ? (isAr ? 'مفعّلة' : 'Enabled') : (isAr ? 'معطلة' : 'Disabled')}
                            </button>
                          </div>

                          {smartRulesEnabled && (
                            <div className="bg-[#0B0E14]/40 border border-white/5 p-3 rounded-xl space-y-3 animate-fadeIn">
                              {/* Status Selector */}
                              <div className="space-y-1.5">
                                <span className="text-[8px] font-bold text-slate-400 uppercase block tracking-wider">
                                  {isAr ? 'حالتك الحالية المقروءة للذكاء الاصطناعي:' : 'Your Status (Read by AI):'}
                                </span>
                                <div className="grid grid-cols-2 gap-2">
                                  <button
                                    onClick={() => handleUserStatusChange('available')}
                                    className={`px-2.5 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer ${userStatus === 'available' ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20' : 'bg-white/5 text-slate-400 hover:bg-white/10'}`}
                                  >
                                    <span className={`w-1.5 h-1.5 rounded-full ${userStatus === 'available' ? 'bg-emerald-400 animate-ping' : 'bg-slate-400'}`}></span>
                                    {isAr ? 'متاح للطلعات' : 'Available'}
                                  </button>
                                  <button
                                    onClick={() => handleUserStatusChange('busy')}
                                    className={`px-2.5 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer ${userStatus === 'busy' ? 'bg-amber-500/15 text-amber-400 border border-amber-500/20' : 'bg-white/5 text-slate-400 hover:bg-white/10'}`}
                                  >
                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                                    {isAr ? 'مشغول / صامت' : 'Busy'}
                                  </button>
                                </div>
                                <p className="text-[8px] text-slate-500 leading-tight">
                                  {userStatus === 'busy' 
                                    ? (isAr ? '⚡ يقوم المُرشد تلقائياً بتأجيل إشعارات النبضات وتفاصيل التجمعات غير العاجلة.' : '⚡ Al-Murshed will automatically snooze generic outings or chat messages to respect your focus.')
                                    : (isAr ? '✨ حالة الاستقبال كاملة، ستصلك كل التنبيهات مع أولويات ذكية.' : '✨ Fully open; AI will deliver active notifications with optimized prioritization.')}
                                </p>
                              </div>

                              {/* Rule Toggles */}
                              <div className="space-y-2 pt-2 border-t border-white/5">
                                <div className="flex items-center justify-between gap-4">
                                  <div>
                                    <span className="text-[9px] font-bold text-slate-300 block">
                                      {isAr ? 'منح الأولوية للرسائل والطلبات العاجلة' : 'Prioritize Urgent DMs & Requests'}
                                    </span>
                                    <span className="text-[8px] text-slate-500 block leading-tight mt-0.5">
                                      {isAr ? 'تجاوز الصامت دائماً لرسائل رفقاء الرحلات النشطة' : 'Always bypass quiet hours for mutual trip coordinate updates'}
                                    </span>
                                  </div>
                                  <button 
                                    onClick={handleTogglePrioritizeDMs}
                                    className={`w-8 h-4 rounded-full transition-colors relative cursor-pointer flex items-center shrink-0 ${prioritizeDMs ? 'bg-indigo-500' : 'bg-slate-700'}`}
                                  >
                                    <motion.div 
                                      layout
                                      className="w-3 h-3 bg-white rounded-full shadow-sm mx-0.5"
                                      animate={{ x: prioritizeDMs ? 14 : 0 }}
                                      transition={{ type: "spring", stiffness: 500, damping: 30 }}
                                    />
                                  </button>
                                </div>

                                <div className="flex items-center justify-between gap-4">
                                  <div>
                                    <span className="text-[9px] font-bold text-slate-300 block">
                                      {isAr ? 'الصامت الذكي التلقائي ليلاً' : 'Auto-Snooze Alerts During Sleep'}
                                    </span>
                                    <span className="text-[8px] text-slate-500 block leading-tight mt-0.5">
                                      {isAr ? 'كتم الطلعات غير العاجلة تلقائياً بين 11:00 م و 7:00 ص' : 'Mutes updates between 23:00 and 07:00 based on local time'}
                                    </span>
                                  </div>
                                  <button 
                                    onClick={handleToggleAutoSnooze}
                                    className={`w-8 h-4 rounded-full transition-colors relative cursor-pointer flex items-center shrink-0 ${autoSnoozeAtNight ? 'bg-indigo-500' : 'bg-slate-700'}`}
                                  >
                                    <motion.div 
                                      layout
                                      className="w-3 h-3 bg-white rounded-full shadow-sm mx-0.5"
                                      animate={{ x: autoSnoozeAtNight ? 14 : 0 }}
                                      transition={{ type: "spring", stiffness: 500, damping: 30 }}
                                    />
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Theme Toggle */}
                  <div className="w-full flex items-center justify-between p-3.5 bg-white/5 border border-white/5 rounded-2xl transition-all">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-indigo-500/10 text-indigo-400">
                        {theme === 'dark' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
                      </div>
                      <div className="flex flex-col items-start">
                        <span className="text-xs font-bold text-slate-200">
                          {isAr ? 'المظهر الليلي' : 'Dark Theme'}
                        </span>
                        <span className="text-[9px] text-slate-500">
                          {isAr ? 'تفعيل الوضع المظلم لحماية العين' : 'Enable eye-friendly dark colors'}
                        </span>
                      </div>
                    </div>
                    <button 
                      onClick={() => { haptic(); onThemeToggle(); }}
                      className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer outline-none flex items-center ${theme === 'dark' ? 'bg-indigo-500' : 'bg-slate-700'}`}
                    >
                      <motion.div 
                        layout
                        className="w-4 h-4 bg-white rounded-full shadow-md mx-1"
                        animate={{ x: theme === 'dark' ? 18 : 0 }}
                        transition={{ type: "spring", stiffness: 500, damping: 30 }}
                      />
                    </button>
                  </div>

                  {/* Language Toggle */}
                  <div className="w-full flex items-center justify-between p-3.5 bg-white/5 border border-white/5 rounded-2xl transition-all">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-emerald-500/10 text-emerald-400">
                        <Globe className="w-4 h-4" />
                      </div>
                      <div className="flex flex-col items-start">
                        <span className="text-xs font-bold text-slate-200">
                          {isAr ? 'لغة التطبيق' : 'App Language'}
                        </span>
                        <span className="text-[9px] text-slate-500">
                          {isAr ? 'تبديل لغة الواجهة' : 'Switch interface language'}
                        </span>
                      </div>
                    </div>
                    <button 
                      onClick={() => { haptic(); if (onToggleLang) onToggleLang(); }}
                      className="px-3 py-1.5 bg-indigo-500/15 hover:bg-indigo-500/20 border border-indigo-500/20 rounded-xl text-[10px] font-black uppercase text-indigo-400 cursor-pointer transition-all active:scale-95"
                    >
                      {lang === 'ar' ? 'العربية' : 'English'}
                    </button>
                  </div>

                  {/* Low-Power Mode Toggle */}
                  <div className="w-full flex items-center justify-between p-3.5 bg-white/5 border border-white/5 rounded-2xl transition-all">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-teal-500/10 text-teal-400">
                        <BatteryCharging className="w-4 h-4" />
                      </div>
                      <div className="flex flex-col items-start">
                        <span className="text-xs font-bold text-slate-200">
                          {isAr ? 'وضع توفير الطاقة' : 'Low-Power Mode'}
                        </span>
                        <span className="text-[9px] text-slate-500 max-w-[200px] text-start">
                          {isAr ? 'تعطيل تتبع الموقع المباشر وتقليل التحديثات لتوفير البطارية' : 'Disables live GPS tracking & reduces background sync frequency'}
                        </span>
                      </div>
                    </div>
                    <button 
                      onClick={handleToggleLowPower}
                      className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer outline-none flex items-center ${lowPowerMode ? 'bg-teal-500' : 'bg-slate-700'}`}
                    >
                      <motion.div 
                        layout
                        className="w-4 h-4 bg-white rounded-full shadow-md mx-1"
                        animate={{ x: lowPowerMode ? 18 : 0 }}
                        transition={{ type: "spring", stiffness: 500, damping: 30 }}
                      />
                    </button>
                  </div>
                </div>

                <div className="pt-6">
                  <button
                    onClick={() => {
                      haptic();
                      if (confirm(isAr ? 'هل أنت متأكد من تسجيل الخروج؟' : 'Are you sure you want to log out?')) {
                        onLogout();
                      }
                    }}
                    className="w-full flex items-center justify-center gap-2 p-4 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded-2xl transition-all font-bold text-xs cursor-pointer uppercase tracking-wider"
                  >
                    <LogOut className={`w-4 h-4 ${isAr ? 'rotate-180' : ''}`} />
                    {isAr ? 'تسجيل الخروج' : 'Log Out'}
                  </button>
                </div>
              </motion.div>
            )}

            {activeMenu !== 'main' && (
              <motion.div
                key="submenu"
                initial={{ opacity: 0, x: isAr ? -20 : 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: isAr ? 20 : -20 }}
                className="py-10 text-center space-y-4"
              >
                <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4 border border-white/10">
                  <Settings className="w-8 h-8 text-slate-400 animate-spin-slow" />
                </div>
                <h4 className="text-sm font-bold text-white">
                  {isAr ? 'قريباً...' : 'Coming Soon...'}
                </h4>
                <p className="text-[10px] text-slate-400 px-8 leading-relaxed">
                  {isAr ? 'هذا القسم قيد التطوير وسيتم توفيره في التحديث القادم.' : 'This section is under active development and will be available in the next update.'}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </motion.div>
  );
}

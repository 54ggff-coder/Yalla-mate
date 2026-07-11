import React, { useEffect } from 'react';
import { motion } from 'motion/react';
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from 'lucide-react';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  ar: string;
  en: string;
  duration?: number; // duration in ms
}

interface GlobalActionToastProps {
  toasts: ToastMessage[];
  onRemove: (id: string) => void;
  lang: 'ar' | 'en';
}

export default function GlobalActionToast({ toasts, onRemove, lang }: GlobalActionToastProps) {
  const isAr = lang === 'ar';

  return (
    <div 
      className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-3 max-w-sm w-full pointer-events-none"
      dir={isAr ? 'rtl' : 'ltr'}
    >
      {toasts.map((toast) => (
        <ToastItem 
          key={toast.id} 
          toast={toast} 
          onClose={() => onRemove(toast.id)} 
          isAr={isAr} 
        />
      ))}
    </div>
  );
}

interface ToastItemProps {
  key?: string;
  toast: ToastMessage;
  onClose: () => void;
  isAr: boolean;
}

function ToastItem({ toast, onClose, isAr }: ToastItemProps) {
  const { type, ar, en, duration = 4500 } = toast;

  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, duration);
    return () => clearTimeout(timer);
  }, [onClose, duration]);

  const getTheme = () => {
    switch (type) {
      case 'success':
        return {
          bg: 'bg-emerald-950/95 border-emerald-500/50 text-emerald-100',
          icon: <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />,
          barBg: 'bg-emerald-400',
        };
      case 'error':
        return {
          bg: 'bg-rose-950/95 border-rose-500/50 text-rose-100',
          icon: <XCircle className="w-5 h-5 text-rose-400 shrink-0" />,
          barBg: 'bg-rose-400',
        };
      case 'warning':
        return {
          bg: 'bg-amber-950/95 border-amber-500/50 text-amber-100',
          icon: <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />,
          barBg: 'bg-amber-400',
        };
      case 'info':
      default:
        return {
          bg: 'bg-indigo-950/95 border-indigo-500/50 text-indigo-100',
          icon: <Info className="w-5 h-5 text-indigo-400 shrink-0" />,
          barBg: 'bg-indigo-400',
        };
    }
  };

  const theme = getTheme();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -20, scale: 0.95 }}
      layout
      className={`pointer-events-auto flex items-start gap-3 p-4 rounded-xl border backdrop-blur-md shadow-2xl relative overflow-hidden ${theme.bg}`}
    >
      {theme.icon}
      
      <div className="flex-1 pr-4">
        <p className="text-xs font-black leading-snug">
          {isAr ? ar : en}
        </p>
      </div>

      <button 
        onClick={onClose}
        className="text-white/40 hover:text-white/80 transition-colors p-0.5 rounded-md hover:bg-white/5 cursor-pointer"
      >
        <X className="w-4 h-4" />
      </button>

      {/* Countdown progress indicator bar */}
      <motion.div 
        initial={{ width: '100%' }}
        animate={{ width: '0%' }}
        transition={{ duration: duration / 1000, ease: 'linear' }}
        className={`absolute bottom-0 left-0 h-1 ${theme.barBg}`}
      />
    </motion.div>
  );
}

import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertCircle, X } from 'lucide-react';
import { Language } from '../data/translations';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmText: string;
  cancelText: string;
  variant?: 'danger' | 'warning' | 'info';
  lang: Language;
}

export default function ConfirmModal({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title, 
  description, 
  confirmText, 
  cancelText, 
  variant = 'danger',
  lang 
}: ConfirmModalProps) {
  const isAr = lang === 'ar';

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/80 backdrop-blur-md"
          />
          
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className="relative bg-white dark:bg-[#12121A] rounded-[2.5rem] w-full max-w-sm overflow-hidden shadow-2xl border border-gray-100 dark:border-white/10"
            dir={isAr ? 'rtl' : 'ltr'}
          >
            <div className="p-8 text-center space-y-6">
              <div className={`w-20 h-20 rounded-full mx-auto flex items-center justify-center border-4 ${
                variant === 'danger' ? 'bg-rose-50 border-rose-100 text-rose-500' : 
                variant === 'warning' ? 'bg-amber-50 border-amber-100 text-amber-500' :
                'bg-indigo-50 border-indigo-100 text-indigo-500'
              }`}>
                <AlertCircle className="w-10 h-10" />
              </div>

              <div className="space-y-2">
                <h3 className="text-xl font-black text-gray-900 dark:text-white leading-tight">
                  {title}
                </h3>
                <p className="text-sm text-gray-500 dark:text-slate-400 font-medium leading-relaxed">
                  {description}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  onClick={onClose}
                  className="py-4 px-6 bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 text-gray-600 dark:text-white rounded-2xl font-black text-xs transition-all uppercase tracking-widest cursor-pointer"
                >
                  {cancelText}
                </button>
                <button
                  onClick={() => {
                    onConfirm();
                    onClose();
                  }}
                  className={`py-4 px-6 rounded-2xl font-black text-sm transition-all shadow-lg text-white cursor-pointer ${
                    variant === 'danger' ? 'bg-rose-600 hover:bg-rose-500 shadow-rose-600/20' :
                    variant === 'warning' ? 'bg-amber-600 hover:bg-amber-500 shadow-amber-600/20' :
                    'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-600/20'
                  }`}
                >
                  {confirmText}
                </button>
              </div>
            </div>

            <button 
              onClick={onClose}
              className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

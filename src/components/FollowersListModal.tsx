import React from 'react';
import { Profile } from '../types';
import { Language } from '../data/translations';
import { X } from 'lucide-react';
import { motion } from 'motion/react';

interface FollowersListModalProps {
  title: string;
  userIds: string[];
  allProfiles: Profile[];
  lang: Language;
  onClose: () => void;
  onProfileClick: (id: string) => void;
}

export default function FollowersListModal({ title, userIds, allProfiles, lang, onClose, onProfileClick }: FollowersListModalProps) {
  const isAr = lang === 'ar';
  const profiles = allProfiles.filter(p => userIds.includes(p.id));

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="bg-[#10141D] rounded-3xl p-6 shadow-2xl relative w-full max-w-sm overflow-hidden flex flex-col max-h-[80vh]"
        dir={isAr ? 'rtl' : 'ltr'}
      >
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-black text-white">{title}</h3>
          <button onClick={onClose} className="p-2 bg-white/5 rounded-full text-white hover:bg-white/10">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
          {profiles.length > 0 ? (
            profiles.map(p => (
              <div 
                key={p.id} 
                className="flex items-center gap-3 p-3 bg-white/5 rounded-2xl cursor-pointer hover:bg-white/10 transition-colors"
                onClick={() => {
                  onProfileClick(p.id);
                  onClose();
                }}
              >
                <span className="w-10 h-10 bg-slate-800 rounded-full flex items-center justify-center text-xl shrink-0 overflow-hidden border border-white/10">
                  {p.avatar && (p.avatar.startsWith('http') || p.avatar.startsWith('data:image') || p.avatar.length > 4) ? (
                    <img src={p.avatar} alt={p.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    p.avatar || '👤'
                  )}
                </span>
                <div className="flex-1">
                  <h4 className="text-white font-bold text-sm">{p.name}</h4>
                  {p.username && <p className="text-slate-400 text-xs">@{p.username}</p>}
                </div>
              </div>
            ))
          ) : (
            <p className="text-center text-slate-400 py-4 text-sm">{isAr ? 'لا يوجد أحد هنا بعد' : 'No one here yet'}</p>
          )}
        </div>
      </motion.div>
    </div>
  );
}

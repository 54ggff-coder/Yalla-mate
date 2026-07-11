import React from 'react';
import { Profile } from '../types';
import { ShieldCheck } from 'lucide-react';
import { Language } from '../data/translations';
import UserAvatar from './UserAvatar';

interface ProfilePreviewProps {
  profile: Profile;
  lang: Language;
  onViewProfile: (userId: string) => void;
  onlineUsers?: Set<string>;
}

export default function ProfilePreview({ profile, lang, onViewProfile, onlineUsers }: ProfilePreviewProps) {
  const isAr = lang === 'ar';
  const isOnline = onlineUsers?.has(profile.id);

  return (
    <div className="flex items-center justify-between p-3 bg-white/5 border border-white/5 rounded-2xl backdrop-blur-sm group hover:bg-white/10 transition-colors">
      <div 
        className="flex items-center gap-3 cursor-pointer overflow-hidden flex-1"
        onClick={() => onViewProfile(profile.id)}
      >
        <div className="relative shrink-0">
          <UserAvatar 
            avatar={profile.avatar}
            className="w-12 h-12 text-xl bg-black/40 rounded-full border border-white/10 shadow-inner group-hover:border-indigo-500/50 transition-all"
          />
          {isOnline && (
            <span className="absolute bottom-0 right-0 w-3 h-3 border-2 border-[#0B0E14] rounded-full bg-emerald-500 shadow-sm animate-pulse"></span>
          )}
        </div>
        
        <div className="flex flex-col text-left truncate">
          <div className="flex items-center gap-1.5">
            <h4 className="text-sm font-black text-white truncate">{profile.name}</h4>
            {profile.verified && <ShieldCheck className="w-3.5 h-3.5 text-indigo-400 shrink-0" />}
          </div>
          <p className="text-[10px] text-slate-400 font-bold truncate">@{profile.username}</p>
        </div>
      </div>
      
      <button 
        onClick={() => onViewProfile(profile.id)}
        className="shrink-0 px-4 py-2 bg-white/5 hover:bg-white/20 text-[10px] font-black text-white rounded-xl transition-all shadow-sm border border-white/10 uppercase tracking-widest ml-3 cursor-pointer"
      >
        {isAr ? 'عرض' : 'View'}
      </button>
    </div>
  );
}

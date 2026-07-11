import React from 'react';

interface UserAvatarProps {
  avatar?: string;
  className?: string;
  onClick?: (e: React.MouseEvent) => void;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'custom';
}

export function openUserProfile(userId: string) {
  window.dispatchEvent(new CustomEvent('ym-open-profile', { detail: { userId } }));
}

export default function UserAvatar({ avatar = '👤', className = '', onClick, size = 'custom' }: UserAvatarProps) {
  const isImg = typeof avatar === 'string' && (
    avatar.startsWith('http') || 
    avatar.startsWith('data:') || 
    avatar.startsWith('blob:') || 
    avatar.length > 5
  );

  let sizeClasses = '';
  if (size === 'sm') sizeClasses = 'w-8 h-8 text-sm';
  else if (size === 'md') sizeClasses = 'w-10 h-10 text-lg';
  else if (size === 'lg') sizeClasses = 'w-12 h-12 text-xl';
  else if (size === 'xl') sizeClasses = 'w-20 h-20 text-4xl';

  const defaultClasses = `rounded-2xl flex items-center justify-center overflow-hidden border border-white/10 shrink-0 select-none bg-slate-850 text-white transition-all ${sizeClasses} ${className}`;

  if (isImg) {
    return (
      <div className={defaultClasses} onClick={onClick}>
        <img 
          src={avatar} 
          alt="Avatar" 
          className="w-full h-full object-cover" 
          referrerPolicy="no-referrer"
          onError={(e) => {
            // fallback
            const target = e.target as HTMLImageElement;
            target.style.display = 'none';
            if (target.parentElement) {
              const span = document.createElement('span');
              span.innerText = '👤';
              target.parentElement.appendChild(span);
            }
          }}
        />
      </div>
    );
  }

  return (
    <div className={defaultClasses} onClick={onClick}>
      <span>{avatar || '👤'}</span>
    </div>
  );
}

import React, { useState } from 'react';
import { AppNotification } from '../types';
import { translations, Language } from '../data/translations';
import { Bell, Heart, UserPlus, MessageSquare, ArrowLeft, Check, X, Send, ChevronDown, ChevronUp } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface NotificationsModalProps {
  notifications: AppNotification[];
  lang: Language;
  onClose: () => void;
  onMarkAllAsRead?: () => void;
  onReply?: (notifId: string, replyText: string) => void;
  onAcceptFriendRequest?: (notifId: string, actorId: string) => void;
  onDeclineFriendRequest?: (notifId: string) => void;
  onNotificationClick?: (notif: AppNotification) => void;
}

export default function NotificationsModal({ 
  notifications, 
  lang, 
  onClose, 
  onMarkAllAsRead, 
  onReply, 
  onAcceptFriendRequest, 
  onDeclineFriendRequest,
  onNotificationClick
}: NotificationsModalProps) {
  const t = translations[lang];
  const isAr = lang === 'ar';
  
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [filter, setFilter] = useState<'unread' | 'all'>('unread');
  const [expandedGroups, setExpandedGroups] = useState<{ [key: string]: boolean }>({
    follows: true,
    messages: true,
    likes: true,
    general: true
  });

  const toggleGroup = (key: string) => {
    setExpandedGroups(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'like_post':
      case 'like_reel':
        return <Heart className="w-4 h-4 text-rose-500 fill-current" />;
      case 'new_follower':
      case 'friend_request_accepted':
        return <UserPlus className="w-4 h-4 text-indigo-400" />;
      case 'friend_request':
        return <UserPlus className="w-4 h-4 text-emerald-400" />;
      case 'new_comment':
      case 'direct_message':
        return <MessageSquare className="w-4 h-4 text-blue-400" />;
      default:
        return <Bell className="w-4 h-4 text-emerald-400" />;
    }
  };

  const handleSendReply = (notifId: string) => {
    if (replyText.trim() && onReply) {
      onReply(notifId, replyText);
      setReplyingTo(null);
      setReplyText('');
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/60 backdrop-blur-sm shadow-2xl cursor-pointer"
    >
      <motion.div 
        initial={{ opacity: 0, y: 40, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 40, scale: 0.98 }}
        transition={{ type: "spring", stiffness: 350, damping: 30 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-[#0B0E14] w-full max-w-lg sm:rounded-3xl h-[80vh] sm:h-[70vh] flex flex-col shadow-2xl border border-white/10 cursor-default"
      >
        
        <div className="flex items-center justify-between p-4 border-b border-white/5 relative z-10 bg-[#0B0E14]">
          <button 
            onClick={onClose}
            className="w-10 h-10 bg-white/5 hover:bg-white/10 rounded-full flex items-center justify-center transition-colors text-white cursor-pointer"
            title={isAr ? "رجوع" : "Back"}
          >
            <ArrowLeft className={`w-5 h-5 ${isAr ? 'rotate-180' : ''}`} />
          </button>
          <div className="flex flex-col items-center">
            <div className="font-black text-white text-sm">{isAr ? 'الإشعارات' : 'Notifications'}</div>
            {onMarkAllAsRead && notifications.filter(n => !n.read).length > 0 && (
              <button 
                onClick={onMarkAllAsRead}
                className="text-[9px] text-indigo-400 font-bold uppercase tracking-wider hover:text-indigo-300 cursor-pointer transition-colors mt-0.5"
              >
                {isAr ? '✓ تحديد كمقروء' : '✓ Mark all read'}
              </button>
            )}
          </div>
          <button 
            onClick={onClose}
            className="w-10 h-10 bg-white/5 hover:bg-white/10 rounded-full flex items-center justify-center transition-colors text-white cursor-pointer"
            title={isAr ? "إغلاق" : "Close"}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filter sub-header */}
        <div className="flex border-b border-white/5 bg-[#0B0E14] px-4 py-2 gap-2 shrink-0">
          <button
            onClick={() => setFilter('unread')}
            className={`flex-1 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${filter === 'unread' ? 'bg-indigo-600 text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}
          >
            {isAr ? 'الجديدة وغير المقروءة' : 'Unread / New'} ({notifications.filter(n => !n.read).length})
          </button>
          <button
            onClick={() => setFilter('all')}
            className={`flex-1 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${filter === 'all' ? 'bg-[#1e2230] text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}
          >
            {isAr ? 'الكل' : 'All'} ({notifications.length})
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-4 space-y-3" dir={isAr ? 'rtl' : 'ltr'}>
          {(() => {
            const list = filter === 'unread' ? notifications.filter(n => !n.read) : notifications;
            
            if (list.length === 0) {
              return (
                <div className="text-center py-20 text-slate-500 flex flex-col items-center">
                   <Bell className="w-12 h-12 mb-4 opacity-20" />
                   <p className="text-sm font-bold uppercase tracking-widest">{isAr ? 'لا توجد إشعارات' : 'No notifications yet'}</p>
                   <p className="text-[10px] mt-2 opacity-50">{isAr ? 'ستظهر هنا إشعارات تفاعل مجتمعك' : 'Your community interactions will appear here'}</p>
                </div>
              );
            }

            const grouped = {
              follows: [] as AppNotification[],
              messages: [] as AppNotification[],
              likes: [] as AppNotification[],
              general: [] as AppNotification[]
            };

            list.forEach((notif) => {
              if (['new_follower', 'friend_request', 'friend_request_accepted'].includes(notif.type)) {
                grouped.follows.push(notif);
              } else if (['direct_message', 'new_comment', 'outing_invite', 'outing_join_accepted'].includes(notif.type)) {
                grouped.messages.push(notif);
              } else if (['like_post', 'like_reel'].includes(notif.type)) {
                grouped.likes.push(notif);
              } else {
                grouped.general.push(notif);
              }
            });

            const categories = [
              {
                key: 'follows',
                labelEn: 'Follows & Friend Requests',
                labelAr: 'المتابعات وطلبات الصداقة',
                items: grouped.follows,
                icon: <UserPlus className="w-4 h-4 text-indigo-400" />
              },
              {
                key: 'messages',
                labelEn: 'Messages & Comments',
                labelAr: 'الرسائل والتعليقات',
                items: grouped.messages,
                icon: <MessageSquare className="w-4 h-4 text-blue-400" />
              },
              {
                key: 'likes',
                labelEn: 'Likes & Reactions',
                labelAr: 'الإعجابات والتفاعلات',
                items: grouped.likes,
                icon: <Heart className="w-4 h-4 text-rose-400 fill-rose-500/25" />
              },
              {
                key: 'general',
                labelEn: 'General & Alerts',
                labelAr: 'عام وتنبيهات أخرى',
                items: grouped.general,
                icon: <Bell className="w-4 h-4 text-emerald-400" />
              }
            ] as const;

            return (
              <div className="space-y-4">
                {categories.map((cat) => {
                  if (cat.items.length === 0) return null;
                  const isExpanded = expandedGroups[cat.key] !== false;

                  return (
                    <div key={cat.key} className="border border-white/5 rounded-2xl bg-white/[0.02] overflow-hidden">
                      {/* Header */}
                      <button
                        onClick={() => toggleGroup(cat.key)}
                        className="w-full flex items-center justify-between p-3 px-4 hover:bg-white/5 transition-colors cursor-pointer select-none"
                      >
                        <div className="flex items-center gap-2">
                          <span className="p-1 rounded-lg bg-white/5 shrink-0">
                            {cat.icon}
                          </span>
                          <span className="text-xs font-black text-white shrink-0">
                            {isAr ? cat.labelAr : cat.labelEn}
                          </span>
                          <span className="text-[10px] h-5 min-w-5 px-1.5 flex items-center justify-center font-black bg-indigo-500/20 text-indigo-300 rounded-full shrink-0">
                            {cat.items.length}
                          </span>
                        </div>
                        <div className="text-gray-400">
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4" />
                          ) : (
                            <ChevronDown className="w-4 h-4" />
                          )}
                        </div>
                      </button>

                      {/* Expanded Section Items */}
                      {isExpanded && (
                        <div className="p-3 border-t border-white/5 space-y-3 bg-[#0F1219]/30">
                          {cat.items.map((notif, idx) => (
                            <div 
                              key={`${notif.id}-${idx}`} 
                              onClick={() => {
                                if (onNotificationClick && !['friend_request'].includes(notif.type)) {
                                  onNotificationClick(notif);
                                }
                              }}
                              className={`flex flex-col gap-2 p-3.5 rounded-xl border transition-colors ${!['friend_request'].includes(notif.type) ? 'cursor-pointer hover:border-indigo-500/40' : ''} ${notif.read ? 'bg-white/5 border-white/5 text-gray-300' : 'bg-indigo-500/10 border-indigo-500/30 shadow-md'}`}
                            >
                              <div className="flex items-start gap-3">
                                <div className="relative shrink-0">
                                  <span className="w-9 h-9 rounded-full bg-black flex items-center justify-center text-lg overflow-hidden shrink-0">
                                    {notif.actorAvatar && notif.actorAvatar.startsWith('http') ? (
                                      <img src={notif.actorAvatar} alt="" className="w-full h-full object-cover" />
                                    ) : (
                                      notif.actorAvatar
                                    )}
                                  </span>
                                  <span className="absolute -bottom-1 -right-1 bg-[#0B0E14] p-0.5 rounded-full border border-white/10 shadow-lg">
                                    {getIcon(notif.type)}
                                  </span>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="text-xs leading-relaxed font-medium text-white break-words">
                                    <span className="font-black text-indigo-300">{notif.actorName}</span> {notif.message}
                                  </div>
                                  <div className="flex items-center justify-between mt-2">
                                    <div className="text-[10px] text-slate-500 font-bold tracking-wider uppercase">
                                      {notif.timestamp}
                                    </div>
                                    {/* Interaction Buttons directly on the notification */}
                                    <div className="flex items-center gap-2">
                                      {notif.type === 'friend_request' && onAcceptFriendRequest && onDeclineFriendRequest && (
                                        <div className="flex gap-2">
                                          <button 
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              onDeclineFriendRequest(notif.id);
                                            }}
                                            className="bg-white/10 hover:bg-rose-500/20 hover:text-rose-400 text-gray-400 p-1.5 rounded-full transition-colors cursor-pointer"
                                          >
                                            <X className="w-3.5 h-3.5" />
                                          </button>
                                          <button 
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              onAcceptFriendRequest(notif.id, notif.actorId);
                                            }}
                                            className="bg-indigo-600 hover:bg-indigo-500 text-white px-2.5 py-1.5 rounded-full flex items-center gap-1 text-[10px] font-black transition-colors cursor-pointer"
                                          >
                                            <Check className="w-3 h-3" />
                                            {isAr ? 'قبول' : 'Accept'}
                                          </button>
                                        </div>
                                      )}
                                      
                                      {['new_comment', 'outing_invite'].includes(notif.type) && onReply && replyingTo !== notif.id && (
                                        <button 
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setReplyingTo(notif.id);
                                          }}
                                          className="text-[10px] font-black text-indigo-400 hover:text-indigo-300 flex items-center gap-1 bg-white/5 hover:bg-white/10 transition-colors px-2.5 py-1 rounded-full cursor-pointer"
                                        >
                                          <MessageSquare className="w-3 h-3" />
                                          {isAr ? 'رد' : 'Reply'}
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                              
                              {/* Expandable Reply Input Box */}
                              {replyingTo === notif.id && (
                                <div 
                                  onClick={(e) => e.stopPropagation()}
                                  className="mt-3 flex gap-2 items-center animate-in fade-in slide-in-from-top-2"
                                >
                                   <input
                                     type="text"
                                     value={replyText}
                                     onChange={(e) => setReplyText(e.target.value)}
                                     placeholder={isAr ? 'أكتب ردك هنا...' : 'Write your reply...'}
                                     className="flex-1 bg-[#1A1D24] text-white text-xs px-4 py-2 rounded-xl border border-white/10 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all"
                                     autoFocus
                                     onKeyDown={(e) => e.key === 'Enter' && handleSendReply(notif.id)}
                                   />
                                   <button 
                                     onClick={() => handleSendReply(notif.id)}
                                     className="w-8 h-8 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl flex items-center justify-center transition-all cursor-pointer"
                                   >
                                     <Send className={`w-3.5 h-3.5 ${isAr ? 'rotate-180' : ''}`} />
                                   </button>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
      </motion.div>
    </motion.div>
  );
}

import React from 'react';
import { Activity, Users, MessageSquare, UserPlus, Compass, Sparkles, Clock, CheckCircle2, Heart, ArrowRight } from 'lucide-react';
import { Profile, Outing, AppNotification } from '../types';
import { Language } from '../data/translations';

interface ActivityStreamProps {
  notifications?: AppNotification[];
  outings?: Outing[];
  currentUser: Profile;
  lang: Language;
  onSelectOuting?: (id: string) => void;
}

interface StreamItem {
  id: string;
  type: 'join' | 'comment' | 'friend' | 'create' | 'like';
  actorName: string;
  actorAvatar: string;
  actionTextAr: string;
  actionTextEn: string;
  targetTitle?: string;
  timeAgoAr: string;
  timeAgoEn: string;
  icon: React.ReactNode;
  bgClass: string;
  targetId?: string;
}

export default function ActivityStream({ notifications = [], outings = [], currentUser, lang, onSelectOuting }: ActivityStreamProps) {
  const isAr = lang === 'ar';

  // Build a lively combined list of activities from notifications, outings, and fallback live feed
  const streamItems: StreamItem[] = React.useMemo(() => {
    const items: StreamItem[] = [];

    // 1. From real notifications
    notifications.slice(0, 5).forEach((n, idx) => {
      let icon = <Sparkles className="w-4 h-4 text-indigo-600" />;
      let bgClass = "bg-indigo-50 border-indigo-100";
      let actionTextAr = "قام بإجراء جديد";
      let actionTextEn = "performed an action";

      if (n.type === 'outing_join_accepted' || n.type === 'outing_invite') {
        icon = <Users className="w-4 h-4 text-emerald-600" />;
        bgClass = "bg-emerald-50 border-emerald-100";
        actionTextAr = "انضم إلى الطلعة";
        actionTextEn = "joined outing";
      } else if (n.type === 'new_comment') {
        icon = <MessageSquare className="w-4 h-4 text-sky-600" />;
        bgClass = "bg-sky-50 border-sky-100";
        actionTextAr = "علّق على المقطع";
        actionTextEn = "commented on reel";
      } else if (n.type === 'friend_request' || n.type === 'friend_request_accepted') {
        icon = <UserPlus className="w-4 h-4 text-rose-600" />;
        bgClass = "bg-rose-50 border-rose-100";
        actionTextAr = n.type === 'friend_request_accepted' ? "قبل طلب الصداقة" : "أرسل طلب صداقة";
        actionTextEn = n.type === 'friend_request_accepted' ? "accepted friend request" : "sent friend request";
      } else if (n.type === 'like_reel' || n.type === 'like_post') {
        icon = <Heart className="w-4 h-4 text-amber-600" />;
        bgClass = "bg-amber-50 border-amber-100";
        actionTextAr = "أعجب بمنشورك";
        actionTextEn = "liked your post";
      }

      items.push({
        id: n.id || `notif_${idx}`,
        type: n.type === 'new_comment' ? 'comment' : (n.type.includes('friend') ? 'friend' : 'join'),
        actorName: n.actorName || 'زميل في المجتمع',
        actorAvatar: n.actorAvatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100',
        actionTextAr: n.message || actionTextAr,
        actionTextEn: n.message || actionTextEn,
        timeAgoAr: "قبل دقائق",
        timeAgoEn: "Just now",
        icon,
        bgClass,
        targetId: n.targetId
      });
    });

    // 2. From recent outings created or joined
    outings.slice(0, 3).forEach((o, idx) => {
      items.push({
        id: `outing_act_${o.id}`,
        type: 'create',
        actorName: o.creatorName || 'منظم فعاليات',
        actorAvatar: o.creatorAvatar || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100',
        actionTextAr: `أنشأ طلعة جديدة: "${o.title}" في ${o.city || 'الرياض'}`,
        actionTextEn: `created a new outing: "${o.title}" in ${o.city || 'Riyadh'}`,
        targetTitle: o.title,
        timeAgoAr: "قبل ٢٥ دقيقة",
        timeAgoEn: "25m ago",
        icon: <Compass className="w-4 h-4 text-amber-600" />,
        bgClass: "bg-amber-50 border-amber-100",
        targetId: o.id
      });
    });

    // 3. Ensure we always have engaging live community feed items if list is short
    if (items.length < 4) {
      items.push(
        {
          id: 'live_1',
          type: 'join',
          actorName: 'سارة خالد',
          actorAvatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100',
          actionTextAr: 'انضمت إلى طلعة "قهوة البون ونقاشات ريادة الأعمال"',
          actionTextEn: 'joined "Specialty Coffee & Startup Talk" outing',
          timeAgoAr: "قبل ١٢ دقيقة",
          timeAgoEn: "12m ago",
          icon: <Users className="w-4 h-4 text-emerald-600" />,
          bgClass: "bg-emerald-50 border-emerald-100"
        },
        {
          id: 'live_2',
          type: 'comment',
          actorName: 'فهد العتيبي',
          actorAvatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100',
          actionTextAr: 'علّق على ريلز الكشتة: "الأجواء خيالية ما شاء الله، وين المكان؟"',
          actionTextEn: 'commented on Kashta Reel: "Insane vibes! Where is this spot?"',
          timeAgoAr: "قبل ٣٥ دقيقة",
          timeAgoEn: "35m ago",
          icon: <MessageSquare className="w-4 h-4 text-sky-600" />,
          bgClass: "bg-sky-50 border-sky-100"
        },
        {
          id: 'live_3',
          type: 'friend',
          actorName: 'محمد الدوسري',
          actorAvatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100',
          actionTextAr: 'قبل طلب الصداقة وأصبح متاحاً للطلعَات المشتركة',
          actionTextEn: 'accepted friend request & is open for hangout invites',
          timeAgoAr: "قبل ساعة",
          timeAgoEn: "1h ago",
          icon: <UserPlus className="w-4 h-4 text-rose-600" />,
          bgClass: "bg-rose-50 border-rose-100"
        }
      );
    }

    return items;
  }, [notifications, outings]);

  return (
    <div className="w-full bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-100 dark:border-slate-800 shadow-xl mb-6 relative overflow-hidden">
      {/* Background Subtle Gradient */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 dark:bg-indigo-500/10 rounded-full blur-3xl -z-10 pointer-events-none" />

      <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100 dark:border-slate-800/80">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
            <Activity className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h3 className="text-base font-black text-slate-900 dark:text-white tracking-tight">
              {isAr ? 'بث النشاط المباشر في المجتمع' : 'Activity Stream'}
            </h3>
            <p className="text-[10px] font-bold text-slate-400">
              {isAr ? 'آخر انضمامات الطلعات، تعليقات الريلز، وطلبات الأصدقاء' : 'Recent joins, reel comments & friend requests'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-[10px] font-extrabold text-emerald-700 dark:text-emerald-400">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
          <span>{isAr ? 'مباشر Live' : 'Live'}</span>
        </div>
      </div>

      <div className="space-y-2.5 max-h-[320px] overflow-y-auto pr-1">
        {streamItems.map((item) => (
          <div
            key={item.id}
            onClick={() => {
              if (item.targetId && onSelectOuting) {
                onSelectOuting(item.targetId);
              }
            }}
            className={`p-3 rounded-2xl border transition-all duration-200 flex items-center justify-between gap-3 ${
              item.targetId && onSelectOuting ? 'cursor-pointer hover:scale-[1.01] hover:shadow-md' : ''
            } bg-slate-50/70 dark:bg-slate-800/50 border-slate-100 dark:border-slate-800 hover:bg-white dark:hover:bg-slate-800`}
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="relative shrink-0">
                <img
                  src={item.actorAvatar}
                  alt={item.actorName}
                  className="w-9 h-9 rounded-full object-cover border-2 border-white dark:border-slate-700 shadow-xs"
                />
                <div className={`absolute -bottom-1 -right-1 p-1 rounded-full border border-white dark:border-slate-800 shadow-xs ${item.bgClass}`}>
                  {item.icon}
                </div>
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-black text-slate-900 dark:text-slate-100 truncate">
                    {item.actorName}
                  </span>
                </div>
                <p className="text-[11px] font-medium text-slate-600 dark:text-slate-300 line-clamp-1">
                  {isAr ? item.actionTextAr : item.actionTextEn}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1 font-mono">
                <Clock className="w-3 h-3 text-slate-300 dark:text-slate-500" />
                {isAr ? item.timeAgoAr : item.timeAgoEn}
              </span>
              {item.targetId && onSelectOuting && (
                <ArrowRight className={`w-3.5 h-3.5 text-indigo-400 ${isAr ? 'rotate-180' : ''}`} />
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

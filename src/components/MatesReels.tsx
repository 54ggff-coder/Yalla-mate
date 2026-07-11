/**
 * @license
 * Copyright (c) 2026 Ali Fouad Al-Khidir Salem (علي فؤاد الخضر سالم). All rights reserved.
 * Protected Code.
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Reel, Profile, Outing } from '../types';
import { translations, Language } from '../data/translations';
import { Heart, Eye, Plus, MapPin, X, Sparkles, 
  ExternalLink, Share2, Compass, Bookmark, Check, Camera, ArrowLeft, Home, MessageSquare, Trash2,
  Pin, Edit, Copy, Flag, CornerDownLeft
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../lib/supabase';
import ReelsUploader from './ReelsUploader';
import { reelsLikesService } from '../services/reelsLikesService';
import { reelsService } from '../services/reelsService';
import { mergeLocalLikesWithServer } from '../lib/localLikesCache';
import LocationIndicator from './LocationIndicator';
import { Haptics } from '../utils/haptics';

interface MatesReelsProps {
  currentUser: Profile;
  outings: Outing[];
  initialReels: Reel[];
  lang: Language;
  onNavigateHome: () => void;
  onViewOuting: (outingId: string) => void;
  onPublishReel?: (reel: Reel) => void;
  onFollowToggle?: (targetId: string) => void;
  onAddFriend?: (targetId: string) => void;
  triggerNotification?: (ar: string, en: string, type?: 'success' | 'info' | 'warning') => void;
}

// Global avatar rendering utility
export function renderAvatar(avatarStr: string, cssClass = "w-9 h-9 rounded-full flex items-center justify-center select-none shrink-0") {
  const isEmoji = !avatarStr || (!avatarStr.startsWith('http') && avatarStr.length <= 4);
  if (isEmoji) {
    return <div className={`${cssClass} bg-indigo-500/10 border border-indigo-500/20 text-base font-sans`}>{avatarStr || '⛺'}</div>;
  }
  return <img src={avatarStr} alt="Avatar" className={`${cssClass} object-cover border border-white/10`} referrerPolicy="no-referrer" />;
}

import { toUUID } from '../utils/uuid';

// Sub-component to manage interactive video playback and overlays safely
interface ReelPlayerItemProps {
  key?: React.Key;
  reel: Reel;
  isActive: boolean;
  currentUser: Profile;
  lang: Language;
  onViewOuting: (outingId: string) => void;
  handleLikeReel: (reelId: string) => void;
  handleDeleteReel?: (reelId: string, videoUrl: string, thumbnailUrl: string) => void;
  onToggleBookmark: (reelId: string) => void;
  onAddFriend: (creatorId: string) => void;
  triggerNotification?: (ar: string, en: string, type?: 'success' | 'info' | 'warning') => void;
}

function ReelPlayerItem({
  reel,
  isActive,
  currentUser,
  lang,
  onViewOuting,
  handleLikeReel,
  handleDeleteReel,
  onToggleBookmark,
  onAddFriend,
  triggerNotification,
}: ReelPlayerItemProps) {
  // ...
  // In interaction bar:
  // <button onClick={(e) => { e.stopPropagation(); onAddFriend(reel.owner_id || reel.creator_id); }} ...>
  // <button onClick={(e) => { e.stopPropagation(); setIsFavorited(!isFavorited); onToggleBookmark(reel.id); }} ...>
  const isAr = lang === 'ar';
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoError, setVideoError] = useState(false);

  const [isCommentDrawerOpen, setIsCommentDrawerOpen] = useState(false);
  const [comments, setComments] = useState<any[]>([]);
  
  // Hybrid local-cloud metadata for comments (pinning, liking, nested replies, sorting)
  const [commentsMeta, setCommentsMeta] = useState<{
    likes: Record<string, number>;
    userLiked: Record<string, boolean>;
    pinnedId: string | null;
    replies: any[];
  }>(() => {
    try {
      const saved = localStorage.getItem(`yallamate_reel_comments_meta_${reel.id}`);
      return saved ? JSON.parse(saved) : { likes: {}, userLiked: {}, pinnedId: null, replies: [] };
    } catch (e) {
      return { likes: {}, userLiked: {}, pinnedId: null, replies: [] };
    }
  });

  // Automatically persist comments metadata to localStorage
  useEffect(() => {
    if (reel.id) {
      localStorage.setItem(`yallamate_reel_comments_meta_${reel.id}`, JSON.stringify(commentsMeta));
    }
  }, [commentsMeta, reel.id]);

  const [sortingMode, setSortingMode] = useState<'popular' | 'recent'>('recent');
  const [replyingTo, setReplyingTo] = useState<any | null>(null);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editCommentText, setEditCommentText] = useState<string>('');

  const [likesCount, setLikesCount] = useState<number>(reel.liked_by_ids?.length || 0);
  const [hasLiked, setHasLiked] = useState<boolean>(reel.liked_by_ids?.includes(currentUser.id) || false);
  const [isLoadingLikes, setIsLoadingLikes] = useState(false);

  // Sync likes state with props update from parent/global state
  useEffect(() => {
    if (reel.liked_by_ids) {
      setHasLiked(reel.liked_by_ids.includes(currentUser.id));
      setLikesCount(reel.liked_by_ids.length);
    }
  }, [reel.liked_by_ids, currentUser.id]);

  // Fetch comments and listen to real-time additions robustly
  useEffect(() => {
    if (!reel?.id) return;
    
    let isMounted = true;
    
    const fetchComments = async () => {
      try {
        const { data: commentsData, error: commentsErr } = await supabase
          .from('reels_comments')
          .select('*, users!user_id(name, avatar)')
          .eq('reel_id', reel.id)
          .order('created_at', { ascending: false });

        if (isMounted) {
          if (commentsErr) {
            console.warn(`[Comments] Join fetch failed for ${reel.id}, trying fallback:`, commentsErr);
            // Fallback: fetch without join
            const { data: simpleData } = await supabase.from('reels_comments').select('*').eq('reel_id', reel.id).order('created_at', { ascending: false });
            if (isMounted && simpleData) {
              setComments(
                simpleData.map(c => ({ ...c, profiles: { name: 'Mates User', avatar: '' } }))
              );
            }
          } else if (commentsData) {
            const mapped = commentsData.map(c => ({
              ...c,
              profiles: c.users || { name: 'Mates User', avatar: '' }
            }));
            setComments(mapped);
          }
        }
      } catch (err) {
        console.error(`Critical error fetching comments for reel ${reel.id}:`, err);
      }
    };

    const fetchLikesPerReel = async () => {
        try {
            const count = await reelsLikesService.getReelLikesCount(reel.id);
            const userLiked = await reelsLikesService.hasUserLiked(reel.id, currentUser.id);
            if (isMounted) {
                setLikesCount(count);
                setHasLiked(userLiked);
            }
        } catch (err) {
            console.error(err);
        }
    };

    fetchComments();
    fetchLikesPerReel();

    // Realtime subscription for updates
    const channel = supabase
      .channel(`reels-data-feed-${reel.id}`)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'reels_comments',
        filter: `reel_id=eq.${reel.id}`
      }, () => {
        fetchComments();
      })
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'reels_likes',
        filter: `reel_id=eq.${reel.id}`
      }, () => {
        fetchLikesPerReel();
      })
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  }, [reel?.id, currentUser.id]);

  // Play or pause video when active frame slides
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (isActive) {
      video.currentTime = 0;
      const playPromise = video.play();
      if (playPromise !== undefined) {
        playPromise.catch(() => {
          // Normal browser auto-play prevention, click will unmute/play
        });
      }
    } else {
      video.pause();
    }
  }, [isActive]);

  const [isFavorited, setIsFavorited] = useState(false);

  // Check if bookmarked when reel is active or changes
  useEffect(() => {
    if (currentUser && reel.id) {
      const checkBookmark = async () => {
        const { data, error } = await supabase
          .from('reels_bookmarks')
          .select('*')
          .eq('user_id', currentUser.id)
          .eq('reel_id', reel.id);
        if (!error && data && data.length > 0) {
          setIsFavorited(true);
        } else {
          setIsFavorited(false);
        }
      };
      checkBookmark();
    }
  }, [currentUser, reel.id]);

  const handlePostComment = async (content: string) => {
    if (!content.trim() || !currentUser) return;
    
    // Optimistic Update
    const optimisticComment = {
      id: `local_${Date.now()}`,
      user_id: currentUser.id,
      reel_id: reel.id,
      content: content.trim(),
      created_at: new Date().toISOString(),
      profiles: { name: currentUser.name || 'User', avatar: currentUser.avatar || '' }
    };
    setComments(prev => [optimisticComment, ...prev]);

    try {
      const { error } = await supabase
        .from('reels_comments')
        .insert([{ 
          user_id: currentUser.id, 
          reel_id: reel.id, 
          content: content.trim(), 
          created_at: new Date().toISOString() 
        }]);

      if (error) throw error;
      console.log('[Comments] Successfully posted comment to DB');
    } catch (err) {
      console.error('Failed to post comment:', err);
    }
  };

  const handleLikeComment = (commentId: string) => {
    setCommentsMeta(prev => {
      const userLiked = { ...prev.userLiked };
      const likes = { ...prev.likes };
      const wasLiked = !!userLiked[commentId];
      userLiked[commentId] = !wasLiked;
      likes[commentId] = (likes[commentId] || 0) + (wasLiked ? -1 : 1);
      if (likes[commentId] < 0) likes[commentId] = 0;
      return { ...prev, userLiked, likes };
    });
  };

  const handlePinComment = (commentId: string) => {
    setCommentsMeta(prev => {
      const isCurrentPinned = prev.pinnedId === commentId;
      return { ...prev, pinnedId: isCurrentPinned ? null : commentId };
    });
    if (triggerNotification) {
      const isCurrentPinned = commentsMeta.pinnedId === commentId;
      triggerNotification(
        isCurrentPinned ? 'تم إلغاء تثبيت التعليق' : 'تم تثبيت التعليق في الأعلى! 📌',
        isCurrentPinned ? 'Comment unpinned' : 'Comment pinned to the top! 📌',
        'info'
      );
    }
  };

  const handlePostReply = (content: string, parentId: string) => {
    if (!content.trim() || !currentUser) return;
    const newReply = {
      id: `reply_${Date.now()}`,
      parent_id: parentId,
      user_id: currentUser.id,
      reel_id: reel.id,
      content: content.trim(),
      created_at: new Date().toISOString(),
      profiles: { name: currentUser.name || 'Mates User', avatar: currentUser.avatar || '' }
    };
    setCommentsMeta(prev => ({
      ...prev,
      replies: [newReply, ...prev.replies]
    }));
    setReplyingTo(null);
  };

  const handleDeleteComment = async (commentId: string) => {
    if (commentId.startsWith('reply_')) {
      setCommentsMeta(prev => ({
        ...prev,
        replies: prev.replies.filter(r => r.id !== commentId)
      }));
    } else {
      setComments(prev => prev.filter(c => c.id !== commentId));
      if (commentsMeta.pinnedId === commentId) {
        setCommentsMeta(prev => ({ ...prev, pinnedId: null }));
      }
      try {
        await supabase.from('reels_comments').delete().eq('id', commentId);
      } catch (err) {
        console.error('Error deleting comment from DB:', err);
      }
    }
  };

  const handleStartEdit = (commentId: string, currentContent: string) => {
    setEditingCommentId(commentId);
    setEditCommentText(currentContent);
  };

  const handleSaveEdit = async (commentId: string) => {
    if (!editCommentText.trim()) return;

    if (commentId.startsWith('reply_')) {
      setCommentsMeta(prev => ({
        ...prev,
        replies: prev.replies.map(r => r.id === commentId ? { ...r, content: editCommentText.trim() } : r)
      }));
    } else {
      setComments(prev => prev.map(c => c.id === commentId ? { ...c, content: editCommentText.trim() } : c));
      try {
        await supabase.from('reels_comments').update({ content: editCommentText.trim() }).eq('id', commentId);
      } catch (err) {
        console.error('Error editing comment in DB:', err);
      }
    }
    setEditingCommentId(null);
    setEditCommentText('');
  };

  const handleReportComment = (commentId: string) => {
    if (triggerNotification) {
      triggerNotification(
        'تم إرسال بلاغك. شكراً لمساعدتنا في الحفاظ على سلامة المجتمع! 🛡️',
        'Report submitted. Thank you for helping keep our community safe! 🛡️',
        'success'
      );
    }
  };

  const handleCopyComment = (content: string) => {
    try {
      navigator.clipboard.writeText(content);
      if (triggerNotification) {
        triggerNotification(
          'تم نسخ التعليق إلى الحافظة! 📋',
          'Comment copied to clipboard! 📋',
          'success'
        );
      }
    } catch (e) {
      console.error('Clipboard copy failed:', e);
    }
  };

  const sortedComments = useMemo(() => {
    let parents = [...comments];

    parents.sort((a, b) => {
      const isAPinned = commentsMeta.pinnedId === a.id;
      const isBPinned = commentsMeta.pinnedId === b.id;
      if (isAPinned && !isBPinned) return -1;
      if (!isAPinned && isBPinned) return 1;

      if (sortingMode === 'popular') {
        const aLikes = commentsMeta.likes[a.id] || 0;
        const bLikes = commentsMeta.likes[b.id] || 0;
        if (aLikes !== bLikes) {
          return bLikes - aLikes;
        }
      }

      const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
      const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
      return bTime - aTime;
    });

    return parents;
  }, [comments, commentsMeta, sortingMode]);

  const internalHandleLike = async () => {
    if (!currentUser) return;
    
    // Optimistic State update
    const previousHasLiked = hasLiked;
    const previousLikesCount = likesCount;

    setHasLiked(!previousHasLiked);
    setLikesCount(prev => prev + (previousHasLiked ? -1 : 1));

    try {
      const success = await reelsLikesService.toggleLike(reel.id, currentUser.id);
      if (!success) throw new Error('Toggle failed');
    } catch (err) {
      console.error('Like toggle failed:', err);
      // Rollback
      setHasLiked(previousHasLiked);
      setLikesCount(previousLikesCount);
      // triggerNotification?.('فشل الإعجاب', 'Like failed', 'warning');
    }
  };

  return (
    <motion.div 
      className="w-full h-full relative flex flex-col justify-end overflow-hidden snap-start shrink-0 cursor-pointer"
      animate={{ scale: isActive ? 1 : 0.98, opacity: isActive ? 1 : 0.9 }}
      whileHover={{ scale: 1.005 }}
      whileTap={{ scale: 0.995 }}
      transition={{ type: 'spring', stiffness: 200, damping: 25 }}
    >
      {/* Background static image fallback / cover */}
      <img
        src={reel.video_url || 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?q=80&w=400&auto=format&fit=crop'}
        alt={reel.caption}
        referrerPolicy="no-referrer"
        className="absolute inset-0 w-full h-full object-cover select-none pointer-events-none z-0"
      />

      {/* Actual moving MP4 Video layer */}
      {reel.video_url && !videoError && (
        <video
          ref={videoRef}
          src={reel.video_url}
          loop
          muted
          playsInline
          onError={() => setVideoError(true)}
          className="absolute inset-0 w-full h-full object-cover select-none pointer-events-none z-10 transition-all duration-500 ease-out"
        />
      )}

      {/* Cinematic Vignette overlays */}
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/45 to-transparent z-20 pointer-events-none" />
      <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/60 to-transparent z-20 pointer-events-none" />

      {/* Right-Side Interaction Bar */}
      <div className="absolute right-4 bottom-28 z-40 flex flex-col items-center gap-6">
        {(() => {
          const creatorId = reel.owner_id || reel.creator_id;
          const isMe = currentUser && currentUser.id === creatorId;
          const isFollowing = currentUser && currentUser.following?.includes(creatorId);
          
          if (isMe) {
            return (
              <div className="flex flex-col items-center gap-1 select-none">
                <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-indigo-505/60">
                  {renderAvatar(reel.creator_avatar || '')}
                </div>
              </div>
            );
          }

          return (
            <button 
              onClick={(e) => { 
                e.stopPropagation(); 
                onAddFriend(creatorId); 
              }} 
              className="flex flex-col items-center gap-1 group relative transition-transform active:scale-90 cursor-pointer"
              title={isFollowing ? (isAr ? 'متابع' : 'Following') : (isAr ? 'متابعة' : 'Follow')}
            >
              <div className={`w-12 h-12 rounded-full overflow-hidden border-2 transition ${
                isFollowing ? 'border-emerald-500' : 'border-white/20 group-hover:border-white'
              }`}>
                {renderAvatar(reel.creator_avatar || '')}
              </div>
              <div className={`w-5 h-5 rounded-full flex items-center justify-center -mt-3.5 border-2 border-slate-950 transition-colors ${
                isFollowing ? 'bg-emerald-500' : 'bg-indigo-600'
              }`}>
                {isFollowing ? (
                  <Check className="w-3 h-3 text-white" />
                ) : (
                  <Plus className="w-3 h-3 text-white" />
                )}
              </div>
            </button>
          );
        })()}
        
        <button 
          onClick={(e) => { 
            e.stopPropagation();
            internalHandleLike(); 
          }} 
          className="flex flex-col items-center gap-1 group"
        >
          <Heart className={`w-8 h-8 transition ${hasLiked ? 'fill-rose-500 text-rose-500' : 'text-white'}`} />
          <span className="text-[10px] font-bold text-white">{likesCount}</span>
        </button>


        <button 
          onClick={(e) => { 
            e.stopPropagation();
            console.log(`Comment button clicked for reel: ${reel.id}`);
            setIsCommentDrawerOpen(true); 
          }} 
          className="flex flex-col items-center gap-1 group"
        >
          <MessageSquare className="w-8 h-8 text-white" />
          <span className="text-[10px] font-bold text-white">{comments.length}</span>
        </button>
        
        <button onClick={(e) => { e.stopPropagation(); setIsFavorited(!isFavorited); onToggleBookmark(reel.id); }} className="flex flex-col items-center gap-1 group">
          <Bookmark className={`w-8 h-8 transition ${isFavorited ? 'fill-amber-500 text-amber-500' : 'text-white'}`} />
        </button>

        <button 
          onClick={(e) => {
            e.stopPropagation();
            const textToCopy = `📍 شاهد فلاش جديد على تطبيق يالاميت!\n🔗 الموقع: ${reel.actual_location || ''}\n📝 التعليق: ${reel.caption}`;
            navigator.clipboard.writeText(textToCopy);
            alert(isAr ? '✓ تم نسخ الرابط لمشاركته مع أصدقائك!' : '✓ Copy info to share!');
          }}
          className="flex flex-col items-center gap-1 group"
        >
          <Share2 className="w-8 h-8 text-white hover:text-indigo-400 transition" />
        </button>
        
        {reel.map_url && (
          <a href={reel.map_url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="flex flex-col items-center gap-1 group">
            <MapPin className="w-8 h-8 text-white" />
          </a>
        )}
        
        {currentUser && (reel.owner_id === currentUser.id || reel.creator_id === currentUser.id) && handleDeleteReel && (
          <button 
            onClick={(e) => {
              e.stopPropagation();
              handleDeleteReel(reel.id, reel.video_url, (reel as any).thumbnail_url || '');
            }} 
            className="flex flex-col items-center gap-1 group mt-2"
          >
            <Trash2 className="w-8 h-8 text-red-500 hover:text-rose-400 transition drop-shadow-md" />
          </button>
        )}
      </div>


      {/* Bottom semi-transparent cinematic card overlay details and descriptive location tags */}
      <div 
        className={`absolute bottom-6 left-4 right-4 z-30 flex flex-col gap-3 max-w-[85%] ${
          isAr ? 'mr-4 ml-auto text-right' : 'ml-4 mr-auto text-left'
        }`}
        dir={isAr ? 'rtl' : 'ltr'}
      >
        <div className="bg-black/40 backdrop-blur-lg border border-white/10 rounded-2xl p-4.5 space-y-3.5 shadow-2xl transition-all duration-300 hover:bg-black/55 hover:scale-[1.01]">
          {/* Creator name outside the card for clean look */}
          <div className={`flex items-center gap-2 text-xs font-black text-white mb-2 ${isAr ? 'justify-start' : 'justify-start'}`}>
            <span className="bg-white/20 backdrop-blur-md text-white px-2 py-0.5 rounded text-[10px] font-mono tracking-tight shadow-sm border border-white/10">@{reel.creator_name ? reel.creator_name.split(' ')[0] : 'User'}</span>
            <span className="text-white/70 font-mono text-[9px]">● {isAr ? 'نشط الآن' : 'active now'}</span>
          </div>

          <div className="bg-black/30 backdrop-blur-lg border border-white/5 rounded-2xl p-4 space-y-2 shadow-2xl transition-all duration-300">
            {/* Connected Outing Badge trigger */}
            {reel.outing_id && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onViewOuting(reel.outing_id!);
                }}
                className="flex items-center gap-1.5 bg-indigo-600/80 hover:bg-indigo-500 border border-indigo-400/20 text-white text-[9px] font-black px-2 py-1 rounded-full select-none cursor-pointer transition shadow-lg shrink-0 hover:scale-[1.02]"
              >
                <Compass className="w-3 h-3 text-amber-300" />
                <span>{isAr ? '🔗 متصل بطلعة' : '🔗 Connected Outing'}</span>
              </button>
            )}

            {/* Title and descriptions */}
            <div className={`space-y-1 ${isAr ? 'text-right' : 'text-left'}`}>
              <h4 className="text-sm font-black text-white leading-snug drop-shadow-md">
                {reel.caption}
              </h4>
            </div>

            {/* Linked Geographical location badge */}
            {reel.actual_location ? (
              <div className="bg-white/5 border border-white/5 rounded-xl p-2 flex flex-col gap-1 shadow">
                <div className="flex items-center gap-1 text-amber-400">
                  <MapPin className="w-3 h-3 text-amber-400" />
                  <span className="text-[8px] font-black font-sans uppercase tracking-wider">
                    {isAr ? 'الموقع' : 'VENUE'}
                  </span>
                </div>

                <div className="flex justify-between items-center gap-2">
                  <span className="text-[10px] text-white font-bold truncate max-w-[150px]">
                    {reel.actual_location}
                  </span>

                  {reel.map_url && (
                    <a
                      href={reel.map_url}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="px-2 py-0.5 bg-white/10 hover:bg-white/20 text-white text-[9px] font-bold rounded-lg flex items-center gap-1 transition-all"
                    >
                      <span>{isAr ? 'خرائط' : 'Maps'}</span>
                    </a>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-[9px] text-slate-400 italic">
                {isAr ? 'لم يربط موقع' : 'No venue associated.'}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Real-time Comment Drawer overlay */}
      <AnimatePresence>
        {isCommentDrawerOpen && (
          <motion.div 
            initial={{ opacity: 0, y: "100%" }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: "100%" }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="absolute inset-0 bg-black/95 backdrop-blur-md z-50 flex flex-col justify-end"
            onClick={() => {
              setIsCommentDrawerOpen(false);
              setReplyingTo(null);
              setEditingCommentId(null);
            }}
          >
            <div 
              className="bg-[#0F131E] border-t border-white/10 rounded-t-[32px] p-5 h-[80%] flex flex-col justify-between"
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between pb-3 border-b border-white/5 shrink-0" dir={isAr ? 'rtl' : 'ltr'}>
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-indigo-400" />
                  <span className="text-sm font-black text-white">{isAr ? 'مجلس التعليقات التفاعلية' : 'Interactive Discussion'}</span>
                  <span className="text-[10px] bg-indigo-500/20 text-indigo-400 px-2 py-0.5 rounded-full font-mono font-bold">
                    {comments.length + (commentsMeta.replies?.length || 0)}
                  </span>
                </div>
                
                {/* Sorting Pills */}
                <div className="flex gap-1.5">
                  <button
                    onClick={() => setSortingMode('recent')}
                    className={`px-3 py-1 rounded-full text-[10px] font-black tracking-wide uppercase transition-all duration-150 ${
                      sortingMode === 'recent'
                        ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
                        : 'bg-white/5 text-slate-400 hover:text-white'
                    }`}
                  >
                    {isAr ? 'الأحدث' : 'Recent'}
                  </button>
                  <button
                    onClick={() => setSortingMode('popular')}
                    className={`px-3 py-1 rounded-full text-[10px] font-black tracking-wide uppercase transition-all duration-150 ${
                      sortingMode === 'popular'
                        ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
                        : 'bg-white/5 text-slate-400 hover:text-white'
                    }`}
                  >
                    {isAr ? 'الأكثر تفاعلاً' : 'Popular'}
                  </button>
                </div>

                <button 
                  onClick={() => {
                    setIsCommentDrawerOpen(false);
                    setReplyingTo(null);
                    setEditingCommentId(null);
                  }}
                  className="w-7 h-7 bg-white/5 hover:bg-white/10 text-slate-300 rounded-full flex items-center justify-center text-xs transition active:scale-95 cursor-pointer pb-0.5"
                >
                  ✕
                </button>
              </div>

              {/* Comments Scrollable Area */}
              <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-1 scrollbar-thin" dir={isAr ? 'rtl' : 'ltr'}>
                {sortedComments.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center text-slate-500 space-y-2">
                    <MessageSquare className="w-10 h-10 text-slate-600 animate-pulse" />
                    <p className="text-xs">{isAr ? 'كن أول من يترك بصمته اللطيفة بالتعليق!' : 'Be the first to share positive vibes here!'}</p>
                  </div>
                ) : (
                  sortedComments.map((c, i) => {
                    const isPinned = commentsMeta.pinnedId === c.id;
                    const cLikes = commentsMeta.likes[c.id] || 0;
                    const cUserLiked = !!commentsMeta.userLiked[c.id];
                    const parentReplies = commentsMeta.replies?.filter(r => r.parent_id === c.id) || [];
                    const isCurrentUserComment = currentUser && c.user_id === currentUser.id;
                    const isReelOwner = currentUser && reel.creator_id === currentUser.id;

                    return (
                      <div key={c.id || i} className="space-y-3 animate-in fade-in duration-200">
                        {/* Parent Comment Card */}
                        <div className={`flex gap-3 text-xs items-start p-3 rounded-2xl transition-all duration-200 border ${
                          isPinned ? 'bg-indigo-500/10 border-indigo-500/20' : 'bg-white/[0.01] border-white/5'
                        }`}>
                          {renderAvatar(c.profiles?.avatar || '', "w-8 h-8 rounded-full border border-white/10 shrink-0 select-none")}
                          
                          <div className="space-y-1 text-right flex-1 overflow-hidden">
                            {/* Meta & User Header */}
                            <div className="flex items-center gap-2 justify-start flex-row-reverse flex-wrap">
                              <span className="font-extrabold text-white">{c.profiles?.name || 'Mates User'}</span>
                              
                              {isPinned && (
                                <span className="bg-amber-500/15 text-amber-400 border border-amber-500/25 text-[8px] font-black px-1.5 py-0.5 rounded-md flex items-center gap-0.5 shrink-0">
                                  <Pin className="w-2.5 h-2.5 rotate-45" />
                                  {isAr ? 'مثبت' : 'Pinned'}
                                </span>
                              )}

                              {isReelOwner && c.user_id === reel.creator_id && (
                                <span className="bg-indigo-500/15 text-indigo-400 border border-indigo-500/25 text-[8px] font-black px-1.5 py-0.5 rounded-md shrink-0">
                                  {isAr ? 'صاحب المقطع' : 'Creator'}
                                </span>
                              )}

                              <span className="text-[9px] text-slate-500 font-mono">
                                {c.created_at ? new Date(c.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                              </span>

                              {/* Friend Adding Button */}
                              {currentUser && c.user_id !== currentUser.id && (
                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onAddFriend(c.user_id);
                                  }}
                                  className={`transition-all p-1 rounded-full cursor-pointer flex items-center justify-center shrink-0 ${
                                    currentUser.following?.includes(c.user_id) 
                                    ? 'bg-emerald-500 text-white shadow-md' 
                                    : 'bg-indigo-600 text-white hover:bg-indigo-500 shadow-md transform active:scale-90'
                                  }`}
                                >
                                  {currentUser.following?.includes(c.user_id) ? (
                                    <Check className="w-2.5 h-2.5 stroke-[3]" />
                                  ) : (
                                    <Plus className="w-2.5 h-2.5 stroke-[3]" />
                                  )}
                                </button>
                              )}
                            </div>

                            {/* Content or Edit Textarea */}
                            {editingCommentId === c.id ? (
                              <div className="space-y-1.5 mt-1.5">
                                <textarea
                                  value={editCommentText}
                                  onChange={(e) => setEditCommentText(e.target.value)}
                                  className="w-full bg-[#0B0E14] border border-white/15 p-2 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500 font-medium"
                                  rows={2}
                                />
                                <div className="flex gap-1.5 justify-end">
                                  <button
                                    onClick={() => setEditingCommentId(null)}
                                    className="px-2.5 py-1 bg-white/5 hover:bg-white/10 text-slate-300 rounded-lg text-[9px] font-extrabold cursor-pointer"
                                  >
                                    {isAr ? 'إلغاء' : 'Cancel'}
                                  </button>
                                  <button
                                    onClick={() => handleSaveEdit(c.id)}
                                    className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-[9px] font-extrabold cursor-pointer"
                                  >
                                    {isAr ? 'حفظ' : 'Save'}
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <p className="text-slate-200 text-right pr-0.5 leading-relaxed break-words text-[11px] font-medium">{c.content}</p>
                            )}

                            {/* Inline Micro-Actions */}
                            <div className="flex items-center gap-3.5 pt-2 justify-start flex-row-reverse text-slate-400">
                              {/* Like Button */}
                              <button 
                                onClick={() => handleLikeComment(c.id)}
                                className={`flex items-center gap-1 transition-all hover:scale-105 active:scale-90 text-[10px] font-black ${
                                  cUserLiked ? 'text-rose-500' : 'text-slate-400 hover:text-rose-400'
                                }`}
                              >
                                <Heart className={`w-3.5 h-3.5 ${cUserLiked ? 'fill-current' : ''}`} />
                                <span>{cLikes > 0 ? cLikes : (isAr ? 'أعجبني' : 'Like')}</span>
                              </button>

                              {/* Reply Button */}
                              <button 
                                onClick={() => setReplyingTo(c)}
                                className="flex items-center gap-1 text-[10px] font-black hover:text-indigo-400"
                              >
                                {isAr ? 'رد' : 'Reply'}
                              </button>

                              {/* Pin Button for Reel Owner */}
                              {isReelOwner && (
                                <button 
                                  onClick={() => handlePinComment(c.id)}
                                  className={`flex items-center gap-1 text-[10px] font-black ${
                                    isPinned ? 'text-amber-400' : 'text-slate-400 hover:text-amber-400'
                                  }`}
                                >
                                  <Pin className="w-3 h-3 rotate-45" />
                                  <span>{isPinned ? (isAr ? 'إلغاء التثبيت' : 'Unpin') : (isAr ? 'تثبيت' : 'Pin')}</span>
                                </button>
                              )}

                              {/* Edit Button */}
                              {isCurrentUserComment && (
                                <button 
                                  onClick={() => handleStartEdit(c.id, c.content)}
                                  className="flex items-center gap-0.5 text-[10px] font-black hover:text-teal-400"
                                >
                                  <Edit className="w-3 h-3" />
                                  <span>{isAr ? 'تعديل' : 'Edit'}</span>
                                </button>
                              )}

                              {/* Delete Button (Owner or Writer) */}
                              {(isCurrentUserComment || isReelOwner) && (
                                <button 
                                  onClick={() => handleDeleteComment(c.id)}
                                  className="flex items-center gap-0.5 text-[10px] font-black hover:text-rose-400"
                                >
                                  <Trash2 className="w-3 h-3" />
                                  <span>{isAr ? 'حذف' : 'Delete'}</span>
                                </button>
                              )}

                              {/* Copy Button */}
                              <button 
                                onClick={() => handleCopyComment(c.content)}
                                className="hover:text-slate-200"
                                title={isAr ? 'نسخ' : 'Copy'}
                              >
                                <Copy className="w-3 h-3" />
                              </button>

                              {/* Report Button */}
                              <button 
                                onClick={() => handleReportComment(c.id)}
                                className="hover:text-amber-500"
                                title={isAr ? 'إبلاغ' : 'Report'}
                              >
                                <Flag className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Nested Replies Rendering */}
                        {parentReplies.length > 0 && (
                          <div className={`space-y-2 ${isAr ? 'mr-8 border-r border-white/5 pr-3' : 'ml-8 border-l border-white/5 pl-3'}`}>
                            {parentReplies.map((rep, rIdx) => {
                              const repUserLiked = !!commentsMeta.userLiked[rep.id];
                              const repLikes = commentsMeta.likes[rep.id] || 0;
                              const isCurrentUserReply = currentUser && rep.user_id === currentUser.id;

                              return (
                                <div key={rep.id || rIdx} className="flex gap-2.5 text-xs items-start p-2.5 bg-white/[0.005] border border-white/[0.03] rounded-xl relative animate-in slide-in-from-top duration-200">
                                  {/* Connector Icon */}
                                  <div className="absolute top-3 shrink-0 text-slate-600" style={{ [isAr ? 'right' : 'left']: '-18px' }}>
                                    <CornerDownLeft className={`w-3.5 h-3.5 ${isAr ? '' : 'scale-x-[-1]'}`} />
                                  </div>

                                  {renderAvatar(rep.profiles?.avatar || '', "w-6 h-6 rounded-full border border-white/10 shrink-0 select-none")}

                                  <div className="space-y-1 text-right flex-1 overflow-hidden">
                                    <div className="flex items-center gap-1.5 justify-start flex-row-reverse">
                                      <span className="font-extrabold text-white text-[10px]">{rep.profiles?.name || 'Mates User'}</span>
                                      <span className="text-[8px] bg-white/5 text-slate-400 px-1 py-0.2 rounded font-black">
                                        {isAr ? 'رد' : 'Reply'}
                                      </span>
                                      <span className="text-[8px] text-slate-500 font-mono">
                                        {new Date(rep.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                      </span>
                                    </div>

                                    {editingCommentId === rep.id ? (
                                      <div className="space-y-1.5 mt-1">
                                        <textarea
                                          value={editCommentText}
                                          onChange={(e) => setEditCommentText(e.target.value)}
                                          className="w-full bg-[#0B0E14] border border-white/15 p-1.5 rounded-lg text-xs text-white focus:outline-none focus:border-indigo-500 font-medium"
                                          rows={2}
                                        />
                                        <div className="flex gap-1 justify-end">
                                          <button
                                            onClick={() => setEditingCommentId(null)}
                                            className="px-2 py-0.5 bg-white/5 hover:bg-white/10 text-slate-300 rounded-md text-[8px] font-extrabold cursor-pointer"
                                          >
                                            {isAr ? 'إلغاء' : 'Cancel'}
                                          </button>
                                          <button
                                            onClick={() => handleSaveEdit(rep.id)}
                                            className="px-2 py-0.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-md text-[8px] font-extrabold cursor-pointer"
                                          >
                                            {isAr ? 'حفظ' : 'Save'}
                                          </button>
                                        </div>
                                      </div>
                                    ) : (
                                      <p className="text-slate-300 text-right pr-0.5 leading-relaxed text-[10px] font-medium break-words">{rep.content}</p>
                                    )}

                                    {/* Nested Reply Action Shelf */}
                                    <div className="flex items-center gap-3 pt-1 justify-start flex-row-reverse text-slate-500">
                                      <button 
                                        onClick={() => handleLikeComment(rep.id)}
                                        className={`flex items-center gap-0.5 text-[9px] font-black ${
                                          repUserLiked ? 'text-rose-500' : 'text-slate-500 hover:text-rose-400'
                                        }`}
                                      >
                                        <Heart className={`w-3 h-3 ${repUserLiked ? 'fill-current' : ''}`} />
                                        <span>{repLikes > 0 ? repLikes : (isAr ? 'أعجبني' : 'Like')}</span>
                                      </button>

                                      {isCurrentUserReply && (
                                        <button 
                                          onClick={() => handleStartEdit(rep.id, rep.content)}
                                          className="flex items-center gap-0.5 text-[9px] font-black hover:text-teal-400"
                                        >
                                          <Edit className="w-2.5 h-2.5" />
                                          <span>{isAr ? 'تعديل' : 'Edit'}</span>
                                        </button>
                                      )}

                                      {(isCurrentUserReply || isReelOwner) && (
                                        <button 
                                          onClick={() => handleDeleteComment(rep.id)}
                                          className="flex items-center gap-0.5 text-[9px] font-black hover:text-rose-400"
                                        >
                                          <Trash2 className="w-2.5 h-2.5" />
                                          <span>{isAr ? 'حذف' : 'Delete'}</span>
                                        </button>
                                      )}

                                      <button onClick={() => handleCopyComment(rep.content)} className="hover:text-slate-200">
                                        <Copy className="w-2.5 h-2.5" />
                                      </button>

                                      <button onClick={() => handleReportComment(rep.id)} className="hover:text-amber-500">
                                        <Flag className="w-2.5 h-2.5" />
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              {/* Replying Status Anchor */}
              {replyingTo && (
                <div className="px-4 py-2 bg-indigo-500/10 border-t border-b border-indigo-500/20 text-indigo-300 text-[10px] font-black flex justify-between items-center shrink-0 animate-in slide-in-from-bottom duration-150" dir={isAr ? 'rtl' : 'ltr'}>
                  <span>
                    {isAr 
                      ? `الرد على تعليق رفيقك @${replyingTo.profiles?.name || 'Mates User'}...` 
                      : `Replying to @${replyingTo.profiles?.name || 'Mates User'}'s comment...`}
                  </span>
                  <button 
                    onClick={() => setReplyingTo(null)}
                    className="w-4 h-4 bg-white/5 hover:bg-white/10 text-white rounded-full flex items-center justify-center text-[8px] font-black"
                  >
                    ✕
                  </button>
                </div>
              )}

              {/* Input section with Dynamic Send / Reply behavior */}
              <div className="pt-3 border-t border-white/5 flex gap-2 items-center shrink-0" dir={isAr ? 'rtl' : 'ltr'}>
                {renderAvatar(currentUser.avatar || '', "w-8 h-8 rounded-full border border-white/15 select-none")}
                <div className="flex-1 relative flex gap-2">
                  <input
                    type="text"
                    id="reels-comment-input-field"
                    required
                    placeholder={
                      replyingTo 
                        ? (isAr ? 'اكتب ردك اللطيف هنا...' : 'Type your thoughtful reply...') 
                        : (isAr ? 'اكتب تعليقاً لطيفاً ومحفزاً للجميع...' : 'Write a supportive vibes comment...')
                    }
                    className="w-full bg-[#0B0E14] border border-white/10 p-3 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-medium"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        const val = e.currentTarget.value.trim();
                        if (val) {
                          if (replyingTo) {
                            handlePostReply(val, replyingTo.id);
                          } else {
                            handlePostComment(val);
                          }
                          e.currentTarget.value = '';
                        }
                      }
                    }}
                  />
                  <button
                    onClick={(e) => {
                      const input = document.getElementById('reels-comment-input-field') as HTMLInputElement;
                      const val = input?.value?.trim();
                      if (val) {
                        if (replyingTo) {
                          handlePostReply(val, replyingTo.id);
                        } else {
                          handlePostComment(val);
                        }
                        input.value = '';
                      }
                    }}
                    className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-black transition active:scale-95 flex items-center justify-center cursor-pointer shrink-0"
                  >
                    {isAr ? 'إرسال' : 'Post'}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function MatesReels({ 
  currentUser, 
  outings, 
  initialReels, 
  lang, 
  onNavigateHome, 
  onViewOuting, 
  onPublishReel, 
  onFollowToggle, 
  onAddFriend,
  triggerNotification 
}: MatesReelsProps) {
  const isAr = lang === 'ar';
  const [reels, setReels] = useState<Reel[]>([]);

  // Sync with prop updates from App.tsx
  useEffect(() => {
    if (initialReels && initialReels.length > 0) {
      console.log('[MatesReels] Syncing with prop reels:', initialReels.length);
      const formatted = initialReels.map(r => ({
        ...r,
        id: r.id,
        video_url: r.video_url || (r as any).videoUrl || '',
        caption: r.caption || (r as any).title || '',
        creator_name: r.creator_name || (r as any).creatorName || 'Mates User',
        creator_avatar: r.creator_avatar || (r as any).creatorAvatar || '',
        liked_by_ids: mergeLocalLikesWithServer(r.id, r.liked_by_ids || (r as any).reels_likes?.map((l: any) => l.user_id) || [], currentUser?.id),
        actual_location: r.actual_location || (r as any).actualLocation || '',
        map_url: r.map_url || (r as any).mapUrl || ''
      }));
      setReels(formatted);
    }
  }, [initialReels]);

  // Fetch reels from Supabase on mount
  useEffect(() => {
    const fetchReelsData = async () => {
      if (!supabase) return;
      console.log('[MatesReels] Refreshing reels from Supabase...');
      
      try {
        // Try fetching with reels_likes join
        let { data, error } = await supabase
          .from('reels')
          .select('*, reels_likes(user_id)')
          .order('created_at', { ascending: false });
          
        if (error) {
          console.warn('[MatesReels] Joint select failed, fetching reels and likes separately:', error.message);
          // Fallback: Fetch reels only first
          const { data: reelsOnly, error: reelsErr } = await supabase
            .from('reels')
            .select('*')
            .order('created_at', { ascending: false });
            
          if (reelsErr) {
            console.error('[MatesReels] Failed to fetch reels even without join:', reelsErr.message);
            // Try loading from local IndexedDB cache as final fallback
            try {
              const { getCachedReels } = await import('../services/db');
              const cached = await getCachedReels();
              if (cached && cached.length > 0) {
                console.log('[MatesReels] Loaded reels from IndexedDB cache');
                setReels(cached);
              }
            } catch (dbErr) {
              console.warn('[MatesReels] Failed to read from IndexedDB cache:', dbErr);
            }
            return;
          }
          
          if (reelsOnly) {
            // Fetch all likes for these reels
            const reelIds = reelsOnly.map(r => r.id);
            let likesData: any[] = [];
            if (reelIds.length > 0) {
              const { data: lData } = await supabase
                .from('reels_likes')
                .select('reel_id, user_id')
                .in('reel_id', reelIds);
              likesData = lData || [];
            }
            
            data = reelsOnly.map(r => ({
              ...r,
              reels_likes: likesData.filter(l => l.reel_id === r.id)
            }));
          }
        }
        
        if (data) {
          const formattedReels = data.map((r: any) => {
            return {
              ...r,
              id: r.id,
              video_url: r.video_url || r.videoUrl || '',
              caption: r.caption || r.title || '',
              creator_name: r.creator_name || r.creatorName || 'Anonymous Mate',
              creator_avatar: r.creator_avatar || r.creatorAvatar || '👤',
              liked_by_ids: mergeLocalLikesWithServer(r.id, Array.isArray(r.reels_likes) ? r.reels_likes.map((l: any) => l.user_id) : [], currentUser?.id),
              actual_location: r.actual_location || r.actualLocation || '',
              map_url: r.map_url || r.mapUrl || ''
            };
          });
          setReels(formattedReels);
          
          // Save to IndexedDB cache for offline support and fast loading
          try {
            const { saveReelsToCache } = await import('../services/db');
            saveReelsToCache(formattedReels).catch(e => console.warn('[MatesReels] Failed to cache reels:', e));
          } catch (dbErr) {
            console.warn('[MatesReels] Failed to write to IndexedDB cache:', dbErr);
          }
        }
      } catch (e) {
        console.error('[MatesReels] Fetch crash:', e);
        try {
          const { getCachedReels } = await import('../services/db');
          const cached = await getCachedReels();
          if (cached && cached.length > 0) {
            setReels(cached);
          }
        } catch (dbErr) {
          console.warn('[MatesReels] Failed to read from IndexedDB cache after crash:', dbErr);
        }
      }
    };
    
    fetchReelsData();

    // Refresh data when window is refocused to ensure consistency
    window.addEventListener('focus', fetchReelsData);
    return () => window.removeEventListener('focus', fetchReelsData);
  }, []);

  const [activeIndex, setActiveIndex] = useState(0);
  const [isPostingReel, setIsPostingReel] = useState(false);
  const [currentFilter, setCurrentFilter] = useState<'newest' | 'foryou' | 'following'>('foryou');


  const handleLikeReel = async (reelId: string) => {
    let user;
    try {
      const { data: authData } = await supabase.auth.getUser();
      user = authData?.user;
    } catch (e) {
      console.error("[handleLikeReel] Auth error:", e);
    }
    
    // If no Supabase user, fallback to currentUser from props
    const currentUserId = currentUser?.id || user?.id;
    if (!currentUserId) {
      console.warn("[handleLikeReel] No user identified.");
      return;
    }

    const dbUserId = toUUID(currentUserId);
    
    // Determine the current was-liked state to toggle
    const targetReel = reels.find(r => r.id === reelId);
    const wasLiked = targetReel?.liked_by_ids?.includes(currentUserId) || false;
    const nextLikedState = !wasLiked;

    if (nextLikedState) {
      Haptics.success();
    } else {
      Haptics.light();
    }

    // Quick optimistic update in state
    setReels(prev => prev.map(r => {
      if (r.id === reelId) {
        const likedBy = r.liked_by_ids || [];
        return {
          ...r,
          liked_by_ids: nextLikedState 
            ? (likedBy.includes(currentUserId) ? likedBy : [...likedBy, currentUserId])
            : likedBy.filter(id => id !== currentUserId)
        };
      }
      return r;
    }));

    // Delegate network update to robust service
    const success = await reelsLikesService.toggleLike(reelId, dbUserId);
    
    // Optionally trigger a rollback if failed 
    if (!success) {
      console.warn("[handleLikeReel] Reverting like due to network failure");
      // Revert the state
      setReels(prev => prev.map(r => {
        if (r.id === reelId) {
          const likedBy = r.liked_by_ids || [];
          return {
            ...r,
            liked_by_ids: wasLiked // Revert to original state
              ? (likedBy.includes(currentUserId) ? likedBy : [...likedBy, currentUserId])
              : likedBy.filter(id => id !== currentUserId)
          };
        }
        return r;
      }));
    }
  };

    const handleDeleteReel = async (reelId: string, videoUrl: string, thumbnailUrl: string) => {
    if (!currentUser) return;
    
    // Add confirmation
    if (!confirm('Are you sure you want to delete this reel? This cannot be undone.')) return;

    try {
      console.log(`Attempting to delete Reel ${reelId}...`);
      
      // 1. Storage files cleanup
      const paths = [videoUrl, thumbnailUrl].map(url => {
          if (url && typeof url === 'string' && url.includes('supabase.co')) {
             const match = url.match(/storage\/v1\/object\/public\/reels\/(.+)$/);
             return match ? match[1] : null;
          }
          return null;
      }).filter(Boolean) as string[];
      
      if (paths.length > 0) {
        await supabase.storage.from('reels').remove(paths);
      }
      
      // 2. Delete from reels table using service
      await reelsService.deleteReel(reelId);

      console.log('Successfully deleted reel from DB.');

      // 3. Update UI state instantly
      setReels(prev => prev.filter(r => r.id !== reelId));
    } catch (err) {
      console.error('Failed to delete reel:', err);
      alert('Failed to delete reel.');
    }
  };

  const handleUpdateReel = async (reelId: string, newCaption: string) => {
    try {
      await reelsService.editReel(reelId, newCaption);
      
      // Update local state instantly
      setReels(prev => prev.map(r => r.id === reelId ? { ...r, caption: newCaption } : r));
    } catch (err) {
      console.error('Failed to update reel:', err);
      alert('Failed to update reel.');
    }
  };


  const handleToggleBookmark = async (reelId: string) => {
    if (!currentUser) return;
    
    // Detect if user is sandbox
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(currentUser.id);
    if (!isUUID) {
      console.info("[handleToggleBookmark] Sandbox user. No persistence.");
      return;
    }

    try {
      const { data, error } = await supabase
        .from('reels_bookmarks')
        .select('*')
        .eq('user_id', currentUser.id)
        .eq('reel_id', reelId);
      
      if (error) throw error;
      
      if (data && data.length > 0) {
        await supabase
          .from('reels_bookmarks')
          .delete()
          .eq('user_id', currentUser.id)
          .eq('reel_id', reelId);
      } else {
        await supabase
          .from('reels_bookmarks')
          .insert([{ user_id: currentUser.id, reel_id: reelId, created_at: new Date().toISOString() }]);
      }
    } catch (err) {
      console.error('Failed to toggle bookmark:', err);
    }
  };

  const handleAddFriend = async (creatorId: string) => {
    if (!currentUser || creatorId === currentUser.id) return;

    if (onAddFriend) {
      onAddFriend(creatorId);
      return;
    }

    if (onFollowToggle) {
      onFollowToggle(creatorId);
      return;
    }

    try {
      const followerUUID = toUUID(currentUser.id);
      const followingUUID = toUUID(creatorId);

      const { data: existingFollow } = await supabase
        .from('follows')
        .select('id')
        .eq('follower_id', followerUUID)
        .eq('following_id', followingUUID)
        .maybeSingle();

      if (existingFollow) {
        // Unfollow
        await supabase
          .from('follows')
          .delete()
          .eq('id', existingFollow.id);
        alert(isAr ? 'تم إلغاء المتابعة بنجاح' : 'Unfollowed successfully!');
      } else {
        // Follow
        const { error } = await supabase
          .from('follows')
          .insert([{
            follower_id: followerUUID,
            following_id: followingUUID,
            created_at: new Date().toISOString()
          }]);
        if (error) throw error;
        alert(isAr ? 'تمت المتابعة بنجاح' : 'Following successfully!');
      }
    } catch (err) {
      console.error('Failed to add friend:', err);
    }
  };

  const handleReelPublished = (newReel: Reel) => {
    setReels(prev => [newReel, ...prev]);
    if (onPublishReel) {
      onPublishReel(newReel);
    }
    setActiveIndex(0);
    setIsPostingReel(false);
  };

  // Filtered/sorted list of reels based on active filter tab
  const filteredReels = reels;

  const displayedReels = [...filteredReels].sort((a, b) => {
    if (currentFilter === 'newest') {
      const numA = parseInt(a.id.replace(/\D/g, '')) || 0;
      const numB = parseInt(b.id.replace(/\D/g, '')) || 0;
      return numB - numA;
    }
    if (currentFilter === 'foryou') {
      const getScore = (reel: any) => {
        let score = 0;
        
        // 1. Core Profile Interest keyword intersection
        if (currentUser.interests && currentUser.interests.length > 0) {
          (currentUser.interests || []).forEach(interest => {
            const regex = new RegExp(interest, 'gi');
            if (regex.test(reel.title || '') || regex.test(reel.description || '')) {
              score += 30; // Core interests weight
            }
          });
        }
        
        // 2. Physical City localization alignment
        if (currentUser.location && reel.actualLocation) {
          if (reel.actualLocation.toLowerCase().includes(currentUser.location.toLowerCase())) {
            score += 20; // Localization weight
          }
        }
        
        // 3. Community Engagement popularity signals
        if (reel.likedByIds) {
          score += reel.likedByIds?.length || 0 * 3;
        }
        
        return score;
      };
      
      const scoreA = getScore(a);
      const scoreB = getScore(b);
      if (scoreA !== scoreB) {
        return scoreB - scoreA;
      }
    }
    return 0; // default initial sequence ordering
  });

  // Reset active index and scroll position when filter changes
  useEffect(() => {
    setActiveIndex(0);
    const container = containerRef.current;
    if (container) {
      container.scrollTop = 0;
    }
  }, [currentFilter]);

  // Snap-Y Scroll tracking handler
  const containerRef = useRef<HTMLDivElement>(null);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const container = e.currentTarget;
    const scrollTop = container.scrollTop;
    const clientHeight = container.clientHeight;
    if (clientHeight > 0) {
      const index = Math.round(scrollTop / clientHeight);
      if (index !== activeIndex && index >= 0 && index < displayedReels.length) {
        setActiveIndex(index);
      }
    }
  };

  // Keyboard Navigation hooks
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isPostingReel) return;
      
      const container = containerRef.current;
      if (!container) return;
      
      if (e.key === 'ArrowUp' && activeIndex > 0) {
        e.preventDefault();
        const nextIdx = activeIndex - 1;
        setActiveIndex(nextIdx);
        container.scrollTo({ top: nextIdx * container.clientHeight, behavior: 'smooth' });
      } else if (e.key === 'ArrowDown' && activeIndex < displayedReels.length - 1) {
        e.preventDefault();
        const nextIdx = activeIndex + 1;
        setActiveIndex(nextIdx);
        container.scrollTo({ top: nextIdx * container.clientHeight, behavior: 'smooth' });
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeIndex, displayedReels.length, isPostingReel]);

  const activeReel = displayedReels[activeIndex] || displayedReels[0];

  return (
    <div 
      className="fixed inset-x-0 top-0 bottom-[64px] bg-black z-30 flex flex-col overflow-hidden select-none"
      dir={isAr ? 'rtl' : 'ltr'}
      id="mates_reels_fullscreen"
    >
      {/* Premium Glassy Header with Back button, Feed Filters, and Add Reel button */}
      <div className="absolute top-4 inset-x-4 z-50 flex items-center justify-between pointer-events-none">
        {/* Glassy Back Button */}
        <button
          onClick={() => {
            Haptics.light();
            if (onNavigateHome) onNavigateHome();
          }}
          className="pointer-events-auto p-2.5 bg-black/40 backdrop-blur-md border border-white/15 rounded-full text-white hover:bg-black/60 active:scale-95 transition-all cursor-pointer flex items-center justify-center shadow-lg"
        >
          <ArrowLeft className={`w-5 h-5 ${isAr ? 'rotate-180' : ''}`} />
        </button>

        {/* Feed Filter Switches (For You, Newest, Following) */}
        <div className="pointer-events-auto flex items-center bg-black/40 backdrop-blur-md border border-white/15 rounded-full p-1 shadow-lg">
          {(['foryou', 'newest', 'following'] as const).map((filter) => (
            <button
              key={filter}
              onClick={() => {
                Haptics.light();
                setCurrentFilter(filter);
              }}
              className={`px-3 py-1.5 rounded-full text-xs font-black transition-all cursor-pointer select-none ${
                currentFilter === filter
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              {filter === 'foryou'
                ? (isAr ? 'لك' : 'For You')
                : filter === 'newest'
                ? (isAr ? 'الأحدث' : 'Newest')
                : (isAr ? 'المتابَعون' : 'Following')}
            </button>
          ))}
        </div>

        {/* Create/Add Reel Button */}
        <button
          onClick={() => {
            Haptics.medium();
            setIsPostingReel(true);
          }}
          className="pointer-events-auto p-2 bg-emerald-600 hover:bg-emerald-500 backdrop-blur-md border border-emerald-500/20 rounded-full text-white active:scale-95 transition-all cursor-pointer flex items-center justify-center shadow-lg gap-1 px-3.5 py-2 font-black text-[10px] uppercase tracking-widest"
        >
          <Camera className="w-3.5 h-3.5" />
          <span>{isAr ? 'أنشئ' : 'Post'}</span>
        </button>
      </div>
      <div className="absolute top-[80px] left-0 right-0 z-40 flex justify-center pointer-events-none">
        <div className="pointer-events-auto">
          <LocationIndicator lang={lang} className="!bg-black/30 !text-white !border-white/20 backdrop-blur-md scale-90" />
        </div>
      </div>

      {/* Hide visual clutter using dynamic webkit selector styling */}
      <style>{`
        #reels-scroller::-webkit-scrollbar {
          display: none;
        }
      `}</style>
 
      {/* Immersive Snapchat/TikTok Vertical Snap loop container */}
      <div 
        ref={containerRef}
        id="reels-scroller"
        onScroll={handleScroll}
        className="w-full h-full overflow-y-scroll snap-y snap-mandatory relative bg-black flex-1"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {displayedReels.length > 0 ? (
          displayedReels.map((reel, idx) => {
            const isActive = idx === activeIndex;
            return (
              <ReelPlayerItem
                key={reel.id}
                reel={reel}
                isActive={isActive}
                currentUser={currentUser}
                lang={lang}
                onViewOuting={onViewOuting}
                handleLikeReel={(reelId) => handleLikeReel(reelId)}
                handleDeleteReel={(reelId) => handleDeleteReel(reelId, reel.video_url, (reel as any).thumbnail_url || '')}
                onToggleBookmark={handleToggleBookmark}
                onAddFriend={handleAddFriend}
              />
            );
          })
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-center px-6 text-white bg-slate-950 gap-4">
            <Compass className="w-16 h-16 text-indigo-500 animate-spin" />
            <h4 className="text-base font-black">
              {isAr ? 'لا توجد فلاشات معروضة حالياً' : 'No reels to broadcast here.'}
            </h4>
            <p className="text-xs text-slate-400 max-w-xs leading-relaxed">
              {currentFilter === 'following'
                ? (isAr ? 'أنت لا تتابع أحداً حالياً. ابدأ بمتابعة رفاق المحتوى بالضغط على زر المتابعة بالجانب!' : 'You are not following anyone yet. Track more mates using the follow buttons on their profile or reels!')
                : (isAr ? 'لم يتم العثور على مقاطع مطابقة.' : 'No materials found matching this scope.')}
            </p>
            {currentFilter === 'following' && (
              <button
                onClick={() => setCurrentFilter('foryou')}
                className="px-4 py-2 bg-indigo-500 hover:bg-indigo-400 text-xs font-black rounded-xl transition cursor-pointer"
              >
                {isAr ? 'تصفح قسم "لك"' : 'Explore "For You" Instead'}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Camera Reels publisher */}
      <AnimatePresence>
        {isPostingReel && (
          <ReelsUploader
            currentUser={currentUser}
            outings={outings}
            lang={lang}
            onClose={() => setIsPostingReel(false)}
            onPublish={handleReelPublished}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

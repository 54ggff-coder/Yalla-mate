import React, { useState, useEffect } from 'react';
import { Profile } from '../types';
import { Language } from '../data/translations';
import { supabase } from '../lib/supabase';
import { 
  Heart, 
  MessageCircle, 
  Share2, 
  Bookmark, 
  MoreHorizontal, 
  Repeat, 
  Image as ImageIcon,
  Send,
  Sparkles,
  MapPin,
  Clock,
  Smile
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { FeedItemSkeleton } from './Skeleton';
import { getPlaceholderImage } from '../utils/imageUtils';

interface Post {
  id: string;
  userId: string;
  userName: string;
  userAvatar: string;
  content: string;
  imageUrl?: string;
  location?: string;
  timestamp: string;
  likes: string[];
  reposts: string[];
  commentsCount: number;
  category?: string;
}

interface ModernSocialFeedProps {
  currentUser: Profile;
  lang: Language;
  onViewProfile: (userId: string) => void;
  onSelectOuting?: (id: string) => void;
}

export default function ModernSocialFeed({ currentUser, lang, onViewProfile, onSelectOuting }: ModernSocialFeedProps) {
  const isAr = lang === 'ar';
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [newPostContent, setNewPostContent] = useState('');
  const [isPosting, setIsPosting] = useState(false);

  useEffect(() => {
    const fetchPosts = async () => {
      if (!supabase) return;
      try {
        const { data, error } = await supabase
          .from('posts')
          .select('*')
          .order('timestamp', { ascending: false })
          .limit(20);
        
        if (error) throw error;
        if (data) {
          const normalized = data.map((item: any) => ({
            ...item,
            likes: item.likes || [],
            reposts: item.reposts || [],
            commentsCount: item.commentsCount || 0
          }));
          setPosts(normalized);
        }
      } catch (err) {
        console.error('Failed to fetch posts from Supabase:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchPosts();

    if (supabase) {
      const channel = supabase
        .channel('public:posts')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'posts' }, () => {
          fetchPosts();
        })
        .subscribe();
      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, []);

  const [postError, setPostError] = useState<string | null>(null);

  const handleCreatePost = async () => {
    if (!newPostContent.trim() || isPosting || !supabase) return;
    setIsPosting(true);
    setPostError(null);

    try {
      const { error } = await supabase.from('posts').insert([
        {
          id: `post_${Date.now()}`,
          userId: currentUser.id,
          userName: currentUser.name,
          userAvatar: currentUser.avatar,
          content: newPostContent,
          timestamp: new Date().toISOString(),
          likes: [],
          reposts: [],
          commentsCount: 0,
        }
      ]);
      if (error) throw error;
      setNewPostContent('');
    } catch (e: any) {
      console.error('Error creating post in Supabase:', e);
      setPostError(isAr ? `فشل النشر: ${e.message || 'خطأ في قاعدة البيانات'}` : `Post failed: ${e.message || 'Database error'}`);
    } finally {
      setIsPosting(false);
    }
  };

  const handleLike = async (postId: string, currentLikes: string[]) => {
    if (!supabase) return;
    const isLiked = currentLikes.includes(currentUser.id);
    const newLikes = isLiked
      ? currentLikes.filter(id => id !== currentUser.id)
      : [...currentLikes, currentUser.id];
    
    try {
      // Optimistic update
      setPosts(prev => prev.map(p => p.id === postId ? { ...p, likes: newLikes } : p));

      const { error } = await supabase
        .from('posts')
        .update({ likes: newLikes })
        .eq('id', postId);
      
      if (error) throw error;
    } catch (e) {
      console.error('Error liking post in Supabase:', e);
      // Revert optimization on failure
      const { data } = await supabase
        .from('posts')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(20);
      if (data) {
        setPosts(data.map((item: any) => ({
          ...item,
          likes: item.likes || [],
          reposts: item.reposts || [],
          commentsCount: item.commentsCount || 0
        })));
      }
    }
  };

  return (
    <div className="max-w-xl mx-auto space-y-4" dir={isAr ? 'rtl' : 'ltr'}>
      
      {/* Create Post Card */}
      <div className="bg-white border border-gray-100 rounded-3xl p-4 shadow-sm">
        <div className="flex gap-3">
          <div className="w-10 h-10 bg-slate-50 rounded-full flex items-center justify-center text-xl shrink-0 border border-gray-100">
            {currentUser.avatar}
          </div>
          <div className="flex-1 space-y-3">
            <textarea
              value={newPostContent}
              onChange={(e) => setNewPostContent(e.target.value)}
              placeholder={isAr ? 'عن ماذا تتطلع اليوم؟' : "What's on your outing agenda?"}
              className="w-full bg-transparent border-none focus:ring-0 text-sm py-2 resize-none placeholder-gray-400 min-h-[80px]"
            />
            
            <div className="flex items-center justify-between pt-2 border-t border-gray-50">
              <div className="flex items-center gap-1">
                <button className="p-2 text-indigo-500 hover:bg-indigo-50 rounded-full transition">
                  <ImageIcon className="w-4.5 h-4.5" />
                </button>
                <button className="p-2 text-indigo-500 hover:bg-indigo-50 rounded-full transition">
                  <MapPin className="w-4.5 h-4.5" />
                </button>
                <button className="p-2 text-indigo-500 hover:bg-indigo-50 rounded-full transition">
                  <Smile className="w-4.5 h-4.5" />
                </button>
              </div>
              <div className="flex items-center gap-3">
                {postError && (
                  <span className="text-[10px] text-rose-500 font-bold bg-rose-50 px-2 py-1 rounded-lg animate-pulse">
                    {postError}
                  </span>
                )}
                <button 
                  onClick={handleCreatePost}
                  disabled={!newPostContent.trim() || isPosting}
                  className="px-5 py-2 bg-indigo-600 text-white rounded-full text-xs font-black shadow-lg shadow-indigo-500/20 hover:bg-indigo-700 transition disabled:opacity-50"
                >
                  {isPosting ? <Repeat className="w-4 h-4 animate-spin" /> : (isAr ? 'نشر' : 'Post')}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="space-y-4">
          <FeedItemSkeleton />
          <FeedItemSkeleton />
          <FeedItemSkeleton />
        </div>
      ) : (
        <div className="space-y-3">
          {posts.map(post => (
            <motion.div 
              key={post.id} 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white border border-gray-100 rounded-3xl overflow-hidden shadow-sm hover:shadow-md transition-shadow group"
            >
              <div className="p-4 space-y-3">
                {/* Post Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <button 
                      onClick={() => onViewProfile(post.userId)}
                      className="w-10 h-10 bg-slate-50 rounded-full flex items-center justify-center text-xl shrink-0 border border-gray-100"
                    >
                      {post.userAvatar}
                    </button>
                    <div>
                      <div className="flex items-center gap-1">
                         <h4 className="text-xs font-black text-gray-900">{post.userName}</h4>
                         <span className="w-1 h-1 bg-gray-300 rounded-full mx-1" />
                         <span className="text-[10px] text-gray-400">12h</span>
                      </div>
                      <div className="flex items-center gap-1 text-[9px] text-slate-400">
                        <MapPin className="w-2.5 h-2.5" />
                        <span>{post.location || (isAr ? 'القرب منك' : 'Nearby')}</span>
                      </div>
                    </div>
                  </div>
                  <button className="p-2 text-gray-400 hover:text-gray-600 rounded-full">
                    <MoreHorizontal className="w-4 h-4" />
                  </button>
                </div>

                {/* Post Content */}
                <div className="space-y-4">
                  <p className="text-sm text-gray-800 leading-relaxed">
                    {post.content}
                  </p>
                  
                  {post.imageUrl && (
                    <div className="rounded-2xl overflow-hidden border border-gray-50 max-h-96">
                      <img src={post.imageUrl} alt="" className="w-full h-full object-cover" />
                    </div>
                  )}
                </div>

                {/* Post Actions */}
                <div className="flex items-center justify-between pt-2 border-t border-gray-50 -mx-1">
                  <div className="flex items-center gap-4">
                    <button 
                      onClick={() => handleLike(post.id, post.likes)}
                      className={`flex items-center gap-1.5 p-1.5 transition ${post.likes?.includes(currentUser.id) ? 'text-rose-500' : 'text-slate-500 hover:text-rose-500'}`}
                    >
                      <Heart className={`w-4.5 h-4.5 ${post.likes?.includes(currentUser.id) && 'fill-current'}`} />
                      <span className="text-[11px] font-black">{post.likes?.length || 0}</span>
                    </button>
                    
                    <button className="flex items-center gap-1.5 p-1.5 text-slate-500 hover:text-indigo-600 transition">
                      <MessageCircle className="w-4.5 h-4.5" />
                      <span className="text-[11px] font-black">{post.commentsCount}</span>
                    </button>
                    
                    <button className="flex items-center gap-1.5 p-1.5 text-slate-500 hover:text-emerald-500 transition">
                      <Repeat className="w-4.5 h-4.5" />
                      <span className="text-[11px] font-black">{post.reposts?.length || 0}</span>
                    </button>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <button className="p-1.5 text-slate-500 hover:text-indigo-600 transition">
                      <Bookmark className="w-4.5 h-4.5" />
                    </button>
                    <button className="p-1.5 text-slate-500 hover:text-indigo-600 transition">
                      <Share2 className="w-4.5 h-4.5" />
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

import React from 'react';
import { Reel, Profile } from '../types';
import { Language } from '../data/translations';
import { Camera, Compass, Play, Eye, Heart, MessageCircle, ArrowLeft, Trash2, Edit2 } from 'lucide-react';
import { motion } from 'motion/react';
import { supabase } from '../lib/supabase';
import { deleteReelService } from '../lib/supabaseUtils';

interface MyPostsViewProps {
  currentUser: Profile;
  userReels: Reel[];
  lang: Language;
  onClose: () => void;
  onDeleteReel?: (reelId: string) => void;
  onUpdateReel?: (reelId: string, updates: Partial<Reel>) => void;
}

export default function MyPostsView({ currentUser, userReels, lang, onClose, onDeleteReel, onUpdateReel }: MyPostsViewProps) {
  const isAr = lang === 'ar';

  const handleDelete = async (reelId: string) => {
    if (!supabase) return;
    if (!confirm('Are you sure you want to delete this reel? This cannot be undone.')) return;
    
    try {
      const reelToDelete = userReels.find(r => r.id === reelId);
      const videoUrl = reelToDelete?.video_url;
      const thumbnailUrl = (reelToDelete as any)?.thumbnail_url;

      const { success, error } = await deleteReelService(reelId, videoUrl, thumbnailUrl);
      if (!success) throw error;

      onDeleteReel?.(reelId);
    } catch (err) {
      console.error('Failed to delete reel:', err);
      alert('Failed to delete reel.');
    }
  };

  const handleEdit = async (reelId: string, currentCaption: string) => {
    const newCaption = prompt('Edit caption:', currentCaption);
    if (newCaption === null || newCaption === currentCaption) return;

    try {
      const { error } = await supabase.from('reels').update({ caption: newCaption }).eq('id', reelId);
      if (error) throw error;
      
      // Since MyPostsView relies on parent passing userReels, 
      // I'll need to notify parent of the update.
      onUpdateReel?.(reelId, { caption: newCaption });
      alert(isAr ? 'تم تحديث الوصف بنجاح!' : 'Caption updated successfully!');
    } catch (err) {
      console.error('Failed to update reel:', err);
      alert('Failed to update reel.');
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300" dir={isAr ? 'rtl' : 'ltr'}>
      <div className="flex items-center justify-between px-2">
        <div>
          <h2 className="text-xl font-black text-white flex items-center gap-2">
            <Camera className="w-6 h-6 text-rose-500" /> {isAr ? 'منشوراتي' : 'My Posts'}
          </h2>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">
            {isAr ? `لديك ${userReels.length} من المقاطع المنشورة` : `You have ${userReels.length} published reels`}
          </p>
        </div>
        <button 
          onClick={onClose}
          className="p-2.5 bg-white/5 hover:bg-white/10 rounded-full text-slate-400 hover:text-white transition-all border border-white/5"
        >
          <ArrowLeft className={`w-5 h-5 ${isAr ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {userReels.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 px-2">
          {userReels.map((reel) => (
            <motion.div 
              key={reel.id} 
              layout
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="aspect-[9/16] bg-[#10141D] rounded-3xl relative overflow-hidden group border border-white/5 shadow-xl"
            >
              <img 
                src={reel.video_url || 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?q=80&w=400&auto=format&fit=crop'} 
                className="absolute inset-0 w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-all duration-500 group-hover:scale-105" 
                alt={reel.caption}
              />
              
              {/* Play Icon Overlay */}
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center border border-white/30">
                  <Play className="w-6 h-6 text-white fill-white ml-1" />
                </div>
              </div>

              {/* Stats & Title Overlay */}
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent p-4 flex flex-col justify-end min-h-[50%]">
                <h4 className="text-xs font-black text-white mb-2 line-clamp-1">{reel.caption}</h4>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1">
                    <Heart className="w-3 h-3 text-rose-500 fill-rose-500" />
                    <span className="text-[10px] font-bold text-white">{reel.liked_by_ids?.length || 0}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <MessageCircle className="w-3 h-3 text-emerald-400" />
                    <span className="text-[10px] font-bold text-white">{reel.comments_count || 0}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Eye className="w-3 h-3 text-sky-400" />
                    <span className="text-[10px] font-bold text-white">{reel.views || 0}</span>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="absolute top-2 right-2 flex flex-col gap-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleEdit(reel.id, reel.caption);
                  }}
                  className="p-2 bg-black/60 hover:bg-emerald-500 text-white rounded-xl backdrop-blur-md opacity-0 group-hover:opacity-100 transition-all cursor-pointer border border-white/10"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(reel.id);
                  }}
                  className="p-2 bg-black/60 hover:bg-rose-500 text-white rounded-xl backdrop-blur-md opacity-0 group-hover:opacity-100 transition-all cursor-pointer border border-white/10"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center p-12 bg-white/5 rounded-3xl border border-dashed border-white/10 text-center">
          <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mb-4 border border-white/10 shadow-inner">
            <Camera className="w-8 h-8 text-slate-500 opacity-50" />
          </div>
          <h3 className="text-sm font-black text-white mb-2">{isAr ? 'لم تنشر أي مقاطع بعد' : 'No posts published yet'}</h3>
          <p className="text-[10px] text-slate-400 max-w-[200px] leading-relaxed">
            {isAr ? 'ابدأ بمشاركة لحظاتك المميزة في الطلعات لتظهر هنا.' : 'Start sharing your special moments from outings to see them here.'}
          </p>
        </div>
      )}
    </div>
  );
}

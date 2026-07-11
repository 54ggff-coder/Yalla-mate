import { supabase } from '../lib/supabase';
import { recordLocalLikeAction } from '../lib/localLikesCache';

// Optimistic Likes Cache Map
// Key: reel_id, Value: Set of user_ids who liked it
const optimisticLikesCache = new Map<string, Set<string>>();

// Sync localStorage for persistence
const STORAGE_KEY = 'pending_likes_map';

const loadPendingLikes = (): Record<string, string[]> => {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : {};
  } catch { return {}; }
};

const savePendingLikes = (data: Record<string, string[]>) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
};

export const reelsLikesService = {
  async toggleLike(reelId: string, userId: string): Promise<boolean> {
    if (!optimisticLikesCache.has(reelId)) {
      optimisticLikesCache.set(reelId, new Set<string>());
    }
    const likesSet = optimisticLikesCache.get(reelId)!;

    // 1. Check if user already liked the reel using SELECT
    let exists = false;
    try {
      const { data, error } = await supabase
        .from('reels_likes')
        .select('id')
        .eq('reel_id', reelId)
        .eq('user_id', userId)
        .maybeSingle();
      
      if (!error && data) {
        exists = true;
      } else {
        // Fallback to cache state if no DB record found
        exists = likesSet.has(userId);
      }
    } catch (err) {
      console.warn('[reelsLikesService] Check like existence failed, using cache:', err);
      exists = likesSet.has(userId);
    }

    const isAddingLike = !exists;

    if (isAddingLike) {
      likesSet.add(userId);
    } else {
      likesSet.delete(userId);
    }

    // Persist optimistic change in localStorage
    const pending = loadPendingLikes();
    pending[reelId] = Array.from(likesSet);
    savePendingLikes(pending);

    recordLocalLikeAction(userId, reelId, isAddingLike);

    try {
      if (isAddingLike) {
        // Insert if it does not exist
        const { error } = await supabase.from('reels_likes').insert([{
          reel_id: reelId,
          user_id: userId
        }]);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('reels_likes')
          .delete()
          .match({ reel_id: reelId, user_id: userId });
        if (error) throw error;
      }
      return true; 
    } catch (e: any) {
      // Check for PGRST205 - Schema Cache Issue
      if (e && (e.code === 'PGRST205' || e.message?.includes('schema cache'))) {
          console.warn('[reelsLikesService] PGRST205 detected. Reloading schema cache and retrying...');
          await supabase.rpc('execute_sql', { sql_query: "NOTIFY pgrst, 'reload schema';" });
          
          // Retry
          if (isAddingLike) {
             const { error } = await supabase.from('reels_likes').insert([{
                reel_id: reelId,
                user_id: userId
              }]);
              if (error) throw error;
          } else {
             const { error } = await supabase.from('reels_likes')
                .delete()
                .match({ reel_id: reelId, user_id: userId });
             if (error) throw error;
          }
          return true;
      }

      // Rollback on failure
      if (isAddingLike) { likesSet.delete(userId); } else { likesSet.add(userId); }
      const pending = loadPendingLikes();
      pending[reelId] = Array.from(likesSet);
      savePendingLikes(pending);

      recordLocalLikeAction(userId, reelId, !isAddingLike);
      console.error('[reelsLikesService] Failed to sync like on network:', e);
      return false;
    }
  },
  // ... rest of the methods

  /**
   * Checks if a specific user has liked a reel.
   */
  async hasUserLiked(reelId: string, userId: string): Promise<boolean> {
    const { data, error } = await supabase
      .from('reels_likes')
      .select('id')
      .eq('reel_id', reelId)
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      console.warn(`[reelsLikesService] Failed to check like for ${reelId}:`, error);
      return false;
    }
    return !!data;
  },

  /**
   * Fetches the total like count for a reel using a count aggregator.
   * This is more performant and avoids PGRST205 join errors.
   */
  async getReelLikesCount(reelId: string): Promise<number> {
    const { count, error } = await supabase
      .from('reels_likes')
      .select('id', { count: 'exact', head: true })
      .eq('reel_id', reelId);
    
    if (error) {
      console.warn(`[reelsLikesService] Failed to fetch count for ${reelId}:`, error);
      return 0;
    }
    return count || 0;
  },

  /**
   * Hydrates optimistic cache with initial likes from server
   */
  hydrateOptimisticLikes(reelId: string, userIds: string[]) {
    // Only set if not already tracked or if we want to sync
    optimisticLikesCache.set(reelId, new Set(userIds));
  },

  /**
   * Retrieves the current optimistc state calculation
   */
  getLikesCountAndStatus(reelId: string, userId: string | undefined): { count: number; hasLiked: boolean } {
    const likesSet = optimisticLikesCache.get(reelId);
    if (!likesSet) {
      return { count: 0, hasLiked: false };
    }
    return {
      count: likesSet.size,
      hasLiked: userId ? likesSet.has(userId) : false
    };
  }
};

/**
 * Local-First Cache for Reels Likes (Delta Cache)
 * Uses localStorage to store intent (liked = true, unliked = false)
 * to ensure immediate UI updates and guard against latency and PostgREST schema cache errors.
 */

const LOCAL_LIKES_KEY = 'mates_reels_likes_delta_v1';

export type DeltaLikes = {
  [userId: string]: {
    [reelId: string]: boolean; // true = liked, false = unliked
  };
};

export function getLocalDeltaLikes(): DeltaLikes {
  try {
    const data = localStorage.getItem(LOCAL_LIKES_KEY);
    return data ? JSON.parse(data) : {};
  } catch (e) {
    console.error('[localLikesCache] Failed to load local likes delta', e);
    return {};
  }
}

export function saveLocalDeltaLikes(delta: DeltaLikes) {
  try {
    localStorage.setItem(LOCAL_LIKES_KEY, JSON.stringify(delta));
  } catch (e) {
    console.error('[localLikesCache] Failed to save local likes delta', e);
  }
}

/**
 * Record a user's action to like or unlike a reel locally.
 */
export function recordLocalLikeAction(userId: string, reelId: string, liked: boolean) {
  const delta = getLocalDeltaLikes();
  if (!delta[userId]) {
    delta[userId] = {};
  }
  delta[userId][reelId] = liked;
  saveLocalDeltaLikes(delta);
}

/**
 * Merges server-side likes with the local-first delta likes cache for a given user.
 * This guarantees that even if Supabase encounters PGRST205 or network drops,
 * the active user sees their selected likes accurately and persistently.
 */
export function mergeLocalLikesWithServer(
  reelId: string,
  serverLikedByIds: string[],
  currentUserId?: string
): string[] {
  if (!currentUserId) return serverLikedByIds;
  
  const delta = getLocalDeltaLikes();
  const userDelta = delta[currentUserId];
  if (!userDelta) return serverLikedByIds;

  const localState = userDelta[reelId];
  if (localState === undefined) {
    // No local interaction in this cache, respect server
    return serverLikedByIds;
  }

  const isIncludedInServer = serverLikedByIds.includes(currentUserId);

  if (localState === true) {
    if (!isIncludedInServer) {
      // Locally liked but not on server yet -> Add current user to list
      return [...serverLikedByIds, currentUserId];
    }
  } else if (localState === false) {
    if (isIncludedInServer) {
      // Locally unliked but server still has it -> Remove current user from list
      return serverLikedByIds.filter(id => id !== currentUserId);
    }
  }

  return serverLikedByIds;
}

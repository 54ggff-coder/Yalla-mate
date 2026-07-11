-- Refactor Friendship and Direct Message Synchronization Logic
-- Dedicated RPC functions to bypass standard SELECT * and handle schema cache latency

-- 1. Add read column and pin/voice columns to direct_messages if missing
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'direct_messages' AND column_name = 'read') THEN
        ALTER TABLE public.direct_messages ADD COLUMN read BOOLEAN DEFAULT FALSE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'direct_messages' AND column_name = 'isPinned') THEN
        ALTER TABLE public.direct_messages ADD COLUMN "isPinned" BOOLEAN DEFAULT FALSE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'direct_messages' AND column_name = 'voiceUrl') THEN
        ALTER TABLE public.direct_messages ADD COLUMN "voiceUrl" text;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'direct_messages' AND column_name = 'audioDuration') THEN
        ALTER TABLE public.direct_messages ADD COLUMN "audioDuration" integer;
    END IF;
END $$;

-- 1b. Clean duplicate friend_requests and apply unique constraint to support ON CONFLICT
DO $$
BEGIN
    -- Remove any duplicate requests keeping the latest one
    DELETE FROM public.friend_requests a
    USING public.friend_requests b
    WHERE a.id < b.id 
      AND a."senderId" = b."senderId" 
      AND a."receiverId" = b."receiverId";

    -- Ensure unique constraint exists for ON CONFLICT ("senderId", "receiverId")
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints 
        WHERE table_name = 'friend_requests' 
          AND constraint_name = 'friend_requests_sender_receiver_unique'
    ) THEN
        ALTER TABLE public.friend_requests 
        ADD CONSTRAINT friend_requests_sender_receiver_unique UNIQUE ("senderId", "receiverId");
    END IF;
END $$;

-- 2. Friendship data RPC
DROP FUNCTION IF EXISTS get_friendship_data(UUID);
DROP FUNCTION IF EXISTS get_friendship_data(TEXT);
CREATE OR REPLACE FUNCTION get_friendship_data(p_user_id TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_friends_count INT;
    v_following_count INT;
    v_followers_count INT;
    v_friend_ids TEXT[];
    v_following_ids TEXT[];
    v_follower_ids TEXT[];
BEGIN
    -- Friends
    SELECT ARRAY_AGG(CASE WHEN "senderId" = p_user_id THEN "receiverId" ELSE "senderId" END)
    INTO v_friend_ids
    FROM public.friend_requests
    WHERE ("senderId" = p_user_id OR "receiverId" = p_user_id) AND status = 'accepted';
    
    v_friends_count := COALESCE(ARRAY_LENGTH(v_friend_ids, 1), 0);

    -- Following
    SELECT ARRAY_AGG(following_id)
    INTO v_following_ids
    FROM public.follows
    WHERE follower_id = p_user_id;
    
    v_following_count := COALESCE(ARRAY_LENGTH(v_following_ids, 1), 0);

    -- Followers
    SELECT ARRAY_AGG(follower_id)
    INTO v_follower_ids
    FROM public.follows
    WHERE following_id = p_user_id;

    v_followers_count := COALESCE(ARRAY_LENGTH(v_follower_ids, 1), 0);

    RETURN jsonb_build_object(
        'friend_ids', COALESCE(v_friend_ids, '{}'::TEXT[]),
        'following_ids', COALESCE(v_following_ids, '{}'::TEXT[]),
        'follower_ids', COALESCE(v_follower_ids, '{}'::TEXT[]),
        'counts', jsonb_build_object(
            'friends', v_friends_count,
            'following', v_following_count,
            'followers', v_followers_count
        )
    );
END;
$$;

-- 3. Unread counts RPC
DROP FUNCTION IF EXISTS get_unread_counts(UUID);
DROP FUNCTION IF EXISTS get_unread_counts(TEXT);
CREATE OR REPLACE FUNCTION get_unread_counts(p_user_id TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_unread_messages INT;
BEGIN
    SELECT COUNT(*)
    INTO v_unread_messages
    FROM public.direct_messages
    WHERE "receiverId" = p_user_id AND (read IS FALSE OR read IS NULL);

    RETURN jsonb_build_object(
        'unread_messages', v_unread_messages
    );
END;
$$;

-- 4. Cleanup legacy fake likes and reload schema
DELETE FROM public.reels_comments WHERE content = '__SYSTEM_LIKE__';
ALTER TABLE IF EXISTS public.reels_likes REPLICA IDENTITY FULL;
NOTIFY pgrst, 'reload schema';

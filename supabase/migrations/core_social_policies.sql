-- Policies from socialService.ts
ALTER TABLE public.friend_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "friend_requests_select" ON public.friend_requests;
CREATE POLICY "friend_requests_select" ON public.friend_requests FOR SELECT USING (auth.uid()::text = "senderId" OR auth.uid()::text = "receiverId");
DROP POLICY IF EXISTS "friend_requests_insert" ON public.friend_requests;
CREATE POLICY "friend_requests_insert" ON public.friend_requests FOR INSERT WITH CHECK (auth.uid()::text = "senderId");
DROP POLICY IF EXISTS "friend_requests_update" ON public.friend_requests;
CREATE POLICY "friend_requests_update" ON public.friend_requests FOR UPDATE USING (auth.uid()::text = "receiverId" OR auth.uid()::text = "senderId");

ALTER TABLE public.direct_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "direct_messages_select" ON public.direct_messages;
CREATE POLICY "direct_messages_select" ON public.direct_messages FOR SELECT USING (auth.uid()::text = "senderId" OR auth.uid()::text = "receiverId");
DROP POLICY IF EXISTS "direct_messages_insert" ON public.direct_messages;
CREATE POLICY "direct_messages_insert" ON public.direct_messages FOR INSERT WITH CHECK (auth.uid()::text = "senderId");
DROP POLICY IF EXISTS "direct_messages_update" ON public.direct_messages;
CREATE POLICY "direct_messages_update" ON public.direct_messages FOR UPDATE USING (auth.uid()::text = "receiverId" OR auth.uid()::text = "senderId");

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users_select" ON public.users;
CREATE POLICY "users_select" ON public.users FOR SELECT USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "users_insert" ON public.users;
CREATE POLICY "users_insert" ON public.users FOR INSERT WITH CHECK (auth.uid()::text = id);
DROP POLICY IF EXISTS "users_update" ON public.users;
CREATE POLICY "users_update" ON public.users FOR UPDATE USING (auth.uid()::text = id);
DROP POLICY IF EXISTS "users_delete" ON public.users;
CREATE POLICY "users_delete" ON public.users FOR DELETE USING (auth.uid()::text = id);

ALTER TABLE public.outings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "outings_select" ON public.outings;
CREATE POLICY "outings_select" ON public.outings FOR SELECT USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "outings_insert" ON public.outings;
CREATE POLICY "outings_insert" ON public.outings FOR INSERT WITH CHECK (auth.uid()::text = "creatorId");
DROP POLICY IF EXISTS "outings_update" ON public.outings;
CREATE POLICY "outings_update" ON public.outings FOR UPDATE USING (auth.uid()::text = "creatorId" OR auth.uid()::text = ANY("attendeeIds"));
DROP POLICY IF EXISTS "outings_delete" ON public.outings;
CREATE POLICY "outings_delete" ON public.outings FOR DELETE USING (auth.uid()::text = "creatorId" OR array_length("attendeeIds", 1) IS NULL OR array_length("attendeeIds", 1) = 0);

ALTER TABLE public.reels ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "reels_select" ON public.reels;
CREATE POLICY "reels_select" ON public.reels FOR SELECT USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "reels_insert" ON public.reels;
CREATE POLICY "reels_insert" ON public.reels FOR INSERT WITH CHECK (auth.uid()::text = owner_id OR auth.uid()::text = creator_id);
DROP POLICY IF EXISTS "reels_update" ON public.reels;
CREATE POLICY "reels_update" ON public.reels FOR UPDATE USING (auth.uid()::text = owner_id OR auth.uid()::text = creator_id);
DROP POLICY IF EXISTS "reels_delete" ON public.reels;
CREATE POLICY "reels_delete" ON public.reels FOR DELETE USING (auth.uid()::text = owner_id OR auth.uid()::text = creator_id);

ALTER TABLE public.reels_likes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "reels_likes_select" ON public.reels_likes;
CREATE POLICY "reels_likes_select" ON public.reels_likes FOR SELECT USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "reels_likes_insert" ON public.reels_likes;
CREATE POLICY "reels_likes_insert" ON public.reels_likes FOR INSERT WITH CHECK (auth.uid()::text = user_id);
DROP POLICY IF EXISTS "reels_likes_delete" ON public.reels_likes;
CREATE POLICY "reels_likes_delete" ON public.reels_likes FOR DELETE USING (auth.uid()::text = user_id);

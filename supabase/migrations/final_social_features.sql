-- notifications
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id),
  actor_id uuid REFERENCES auth.users(id),
  type text,
  title text,
  body text,
  reference_id uuid,
  is_read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own notifications" ON public.notifications FOR SELECT USING (auth.uid() = user_id);

-- reels_comment_replies
CREATE TABLE IF NOT EXISTS public.reels_comment_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id uuid REFERENCES public.reels_comments(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id),
  reply text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.reels_comment_replies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can add replies" ON public.reels_comment_replies FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can edit/delete their own replies" ON public.reels_comment_replies FOR ALL USING (auth.uid() = user_id);

-- reels_comment_reactions
CREATE TABLE IF NOT EXISTS public.reels_comment_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id uuid REFERENCES public.reels_comments(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id),
  reaction text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(comment_id, user_id, reaction)
);
ALTER TABLE public.reels_comment_reactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can add/remove their own reactions" ON public.reels_comment_reactions FOR ALL USING (auth.uid() = user_id);

-- voice_messages
CREATE TABLE IF NOT EXISTS public.voice_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid,
  sender_id uuid REFERENCES auth.users(id),
  audio_url text,
  duration integer,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.voice_messages ENABLE ROW LEVEL SECURITY;
-- Assuming conversation_members table exists to check access
CREATE POLICY "Conversation members can access voice messages" ON public.voice_messages FOR SELECT USING (EXISTS (SELECT 1 FROM public.conversation_members WHERE conversation_id = voice_messages.conversation_id AND user_id = auth.uid()));

-- call_sessions
CREATE TABLE IF NOT EXISTS public.call_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid,
  caller_id uuid REFERENCES auth.users(id),
  receiver_id uuid REFERENCES auth.users(id),
  call_type text,
  status text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.call_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Call participants can access sessions" ON public.call_sessions FOR SELECT USING (auth.uid() = caller_id OR auth.uid() = receiver_id);

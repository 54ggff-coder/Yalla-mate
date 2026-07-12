-- 1. AI User Memory
CREATE TABLE IF NOT EXISTS public.ai_user_memory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id),
  preference_type text, -- place_type, activity, city, outing_type
  preference_value text,
  confidence float DEFAULT 0.5,
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.ai_user_memory ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own memory" ON public.ai_user_memory FOR ALL USING (auth.uid() = user_id);

-- 2. AI Recommendation Events
CREATE TABLE IF NOT EXISTS public.ai_recommendation_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id),
  recommendation_id uuid,
  action text, -- opened, saved, ignored, joined, rated
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.ai_recommendation_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can insert their own events" ON public.ai_recommendation_events FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 3. Place Quality Score
CREATE TABLE IF NOT EXISTS public.place_quality_score (
  place_id uuid PRIMARY KEY REFERENCES public.places(id),
  score float DEFAULT 0,
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.place_quality_score ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view quality scores" ON public.place_quality_score FOR SELECT USING (true);

-- 4. AI Admin Reports
CREATE TABLE IF NOT EXISTS public.ai_admin_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_type text, -- error, improvement, interaction
  content text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.ai_admin_reports ENABLE ROW LEVEL SECURITY;

-- 5. AI Usage Limits
CREATE TABLE IF NOT EXISTS public.ai_usage_limits (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id),
  requests_count integer DEFAULT 0,
  date date DEFAULT CURRENT_DATE
);
ALTER TABLE public.ai_usage_limits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their usage" ON public.ai_usage_limits FOR SELECT USING (auth.uid() = user_id);
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
-- Outings System
CREATE TABLE IF NOT EXISTS public.outings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id uuid REFERENCES auth.users(id),
  title text NOT NULL,
  description text,
  category text, -- Restaurant, Cafe, Cinema, Shopping, Car Trip, Sports, Games, Photography, Hiking, Events
  place_id uuid REFERENCES public.places(id),
  latitude float,
  longitude float,
  city text,
  country text,
  date date,
  time time,
  max_members integer,
  status text DEFAULT 'draft', -- draft, open, full, started, completed, cancelled
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.outings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view outings" ON public.outings FOR SELECT USING (true);
CREATE POLICY "Users can create outings" ON public.outings FOR INSERT WITH CHECK (auth.uid() = creator_id);
CREATE POLICY "Users can update their own outings" ON public.outings FOR UPDATE USING (auth.uid() = creator_id);

CREATE TABLE IF NOT EXISTS public.outing_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  outing_id uuid REFERENCES public.outings(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id),
  status text DEFAULT 'requested', -- requested, accepted, rejected, left
  joined_at timestamptz DEFAULT now(),
  UNIQUE(outing_id, user_id)
);
ALTER TABLE public.outing_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view outing members" ON public.outing_members FOR SELECT USING (true);
CREATE POLICY "Outing creator can manage members" ON public.outing_members FOR ALL USING (auth.uid() IN (SELECT creator_id FROM public.outings WHERE id = outing_id));
CREATE POLICY "Users can request to join" ON public.outing_members FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.outing_transport (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  outing_id uuid REFERENCES public.outings(id) ON DELETE CASCADE,
  driver_id uuid REFERENCES auth.users(id),
  has_car boolean DEFAULT false,
  available_seats integer,
  pickup_location text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.outing_transport ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.outing_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  outing_id uuid REFERENCES public.outings(id) ON DELETE CASCADE,
  created_by uuid REFERENCES auth.users(id),
  title text,
  amount float,
  category text, -- fuel, food, tickets, other
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.outing_expenses ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.expense_members (
  expense_id uuid REFERENCES public.outing_expenses(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id),
  share_amount float,
  paid boolean DEFAULT false,
  PRIMARY KEY (expense_id, user_id)
);
ALTER TABLE public.expense_members ENABLE ROW LEVEL SECURITY;
-- 1. place_sources
CREATE TABLE IF NOT EXISTS public.place_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text,
  source_type text,
  source_url text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.place_sources ENABLE ROW LEVEL SECURITY;

-- 2. places (extended)
CREATE TABLE IF NOT EXISTS public.places (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text,
  category text,
  description text,
  image_url text,
  latitude float,
  longitude float,
  city text,
  country text,
  price_level text,
  source text,
  source_url text,
  google_maps_url text,
  social_url text,
  rating float,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.places ENABLE ROW LEVEL SECURITY;

-- 3. place_scores
CREATE TABLE IF NOT EXISTS public.place_scores (
  place_id uuid REFERENCES public.places(id) ON DELETE CASCADE PRIMARY KEY,
  distance_score float,
  rating_score float,
  activity_score float,
  price_score float,
  final_score float,
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.place_scores ENABLE ROW LEVEL SECURITY;

-- 4. place_cache
CREATE TABLE IF NOT EXISTS public.place_cache (
  place_id uuid REFERENCES public.places(id) ON DELETE CASCADE PRIMARY KEY,
  source_type text,
  last_updated timestamptz DEFAULT now()
);
ALTER TABLE public.place_cache ENABLE ROW LEVEL SECURITY;

-- 5. ai_place_recommendations
CREATE TABLE IF NOT EXISTS public.ai_place_recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id),
  place_id uuid REFERENCES public.places(id) ON DELETE CASCADE,
  score float,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.ai_place_recommendations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own recommendations" ON public.ai_place_recommendations FOR SELECT USING (auth.uid() = user_id);
-- 1. Profiles (Ensure it aligns with existing structure)
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id),
  username text UNIQUE,
  full_name text,
  avatar_url text,
  bio text,
  country text,
  city text,
  interests text[],
  hobbies text[],
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 2. User Interests
CREATE TABLE IF NOT EXISTS public.user_interests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id),
  interest_name text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, interest_name)
);
ALTER TABLE public.user_interests ENABLE ROW LEVEL SECURITY;

-- 3. User Verification
CREATE TABLE IF NOT EXISTS public.user_verification (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE REFERENCES auth.users(id),
  email_verified boolean DEFAULT false,
  phone_verified boolean DEFAULT false,
  profile_completed boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.user_verification ENABLE ROW LEVEL SECURITY;

-- 4. User Trust Score
CREATE TABLE IF NOT EXISTS public.user_trust_score (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE REFERENCES auth.users(id),
  score integer DEFAULT 0,
  reasons text[],
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.user_trust_score ENABLE ROW LEVEL SECURITY;

-- 5. User Badges
CREATE TABLE IF NOT EXISTS public.user_badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id),
  badge_name text,
  earned_at timestamptz DEFAULT now()
);
ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;

-- 6. Reports
CREATE TABLE IF NOT EXISTS public.reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid REFERENCES auth.users(id),
  reported_user_id uuid REFERENCES auth.users(id),
  type text, -- user, comment, reel, outing
  reason text,
  status text DEFAULT 'pending',
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

-- 7. Profile Visibility
CREATE TABLE IF NOT EXISTS public.profile_visibility (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id),
  visibility text DEFAULT 'everyone' -- everyone, friends, participants
);
ALTER TABLE public.profile_visibility ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own profiles" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can update their own profiles" ON public.profiles FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can manage their interests" ON public.user_interests FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can view verification status" ON public.user_verification FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can view trust scores" ON public.user_trust_score FOR SELECT USING (true);

CREATE POLICY "Users can view badges" ON public.user_badges FOR SELECT USING (true);

CREATE POLICY "Users can report" ON public.reports FOR INSERT WITH CHECK (auth.uid() = reporter_id);

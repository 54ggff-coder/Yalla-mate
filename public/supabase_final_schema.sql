-- Missing users table
CREATE TABLE IF NOT EXISTS public.users (
  id uuid PRIMARY KEY REFERENCES auth.users(id),
  email text,
  username text UNIQUE,
  name text,
  "displayName" text,
  avatar text,
  onboarding_completed boolean DEFAULT false,
  "trustScore" numeric DEFAULT 0,
  email_confirmed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Missing friend_requests table
CREATE TABLE IF NOT EXISTS public.friend_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "senderId" uuid REFERENCES public.users(id),
  "receiverId" uuid REFERENCES public.users(id),
  status text DEFAULT 'pending',
  "senderName" text,
  "senderAvatar" text,
  created_at timestamptz DEFAULT now(),
  UNIQUE("senderId", "receiverId")
);

-- Missing direct_messages table
CREATE TABLE IF NOT EXISTS public.direct_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "chatId" text,
  "senderId" uuid REFERENCES public.users(id),
  "receiverId" uuid REFERENCES public.users(id),
  content text,
  type text DEFAULT 'text',
  timestamp timestamptz DEFAULT now(),
  "senderName" text,
  "senderAvatar" text,
  is_read boolean DEFAULT false,
  read boolean DEFAULT false,
  "isPinned" boolean DEFAULT false,
  is_pinned boolean DEFAULT false,
  reactions jsonb DEFAULT '{}'::jsonb
);

-- Missing outings table
CREATE TABLE IF NOT EXISTS public.outings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  category text,
  location text,
  city text,
  datetime timestamptz,
  "creatorId" uuid REFERENCES public.users(id),
  "creatorName" text,
  "creatorAvatar" text,
  "creatorTrust" numeric,
  "maxAttendees" integer,
  "attendeeIds" uuid[] DEFAULT '{}',
  "minTrustScore" numeric,
  status text DEFAULT 'upcoming',
  logistics jsonb DEFAULT '{}'::jsonb,
  "coverImage" text,
  "genderRestriction" text,
  "mapCoordinates" jsonb,
  "mapLocationUrl" text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.outing_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  outing_id uuid REFERENCES public.outings(id) ON DELETE CASCADE,
  user_id uuid REFERENCES public.users(id),
  role text,
  status text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(outing_id, user_id)
);

-- Missing reels table
CREATE TABLE IF NOT EXISTS public.reels (
  id text PRIMARY KEY,
  creator_id uuid REFERENCES public.users(id),
  user_id uuid REFERENCES public.users(id),
  owner_id uuid REFERENCES public.users(id),
  creator_name text,
  creator_avatar text,
  caption text,
  video_url text,
  likes_count integer DEFAULT 0,
  comments_count integer DEFAULT 0,
  outing_id uuid REFERENCES public.outings(id),
  created_at timestamptz DEFAULT now()
);

-- Missing reels_likes table
CREATE TABLE IF NOT EXISTS public.reels_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reel_id text REFERENCES public.reels(id) ON DELETE CASCADE,
  user_id uuid REFERENCES public.users(id),
  created_at timestamptz DEFAULT now(),
  UNIQUE(reel_id, user_id)
);

-- Missing reels_comments table
CREATE TABLE IF NOT EXISTS public.reels_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reel_id text REFERENCES public.reels(id) ON DELETE CASCADE,
  user_id uuid REFERENCES public.users(id),
  content text,
  created_at timestamptz DEFAULT now()
);

-- Additional missing tables for other features
CREATE TABLE IF NOT EXISTS public.reels_comment_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id uuid REFERENCES public.reels_comments(id) ON DELETE CASCADE,
  user_id uuid REFERENCES public.users(id),
  reply text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.users(id),
  actor_id uuid REFERENCES public.users(id),
  type text,
  title text,
  body text,
  reference_id text,
  is_read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.places (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text,
  description text,
  city text,
  category text,
  image_url text,
  address text,
  rating float,
  google_maps_url text,
  created_at timestamptz DEFAULT now()
);

-- Apply RLS Policies

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users_select" ON public.users;
CREATE POLICY "users_select" ON public.users FOR SELECT USING (true);
DROP POLICY IF EXISTS "users_insert" ON public.users;
CREATE POLICY "users_insert" ON public.users FOR INSERT WITH CHECK (auth.uid() = id);
DROP POLICY IF EXISTS "users_update" ON public.users;
CREATE POLICY "users_update" ON public.users FOR UPDATE USING (auth.uid() = id);

ALTER TABLE public.friend_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "friend_requests_select" ON public.friend_requests;
CREATE POLICY "friend_requests_select" ON public.friend_requests FOR SELECT USING (auth.uid() = "senderId" OR auth.uid() = "receiverId");
DROP POLICY IF EXISTS "friend_requests_insert" ON public.friend_requests;
CREATE POLICY "friend_requests_insert" ON public.friend_requests FOR INSERT WITH CHECK (auth.uid() = "senderId");
DROP POLICY IF EXISTS "friend_requests_update" ON public.friend_requests;
CREATE POLICY "friend_requests_update" ON public.friend_requests FOR UPDATE USING (auth.uid() = "receiverId" OR auth.uid() = "senderId");

ALTER TABLE public.direct_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "direct_messages_select" ON public.direct_messages;
CREATE POLICY "direct_messages_select" ON public.direct_messages FOR SELECT USING (auth.uid() = "senderId" OR auth.uid() = "receiverId");
DROP POLICY IF EXISTS "direct_messages_insert" ON public.direct_messages;
CREATE POLICY "direct_messages_insert" ON public.direct_messages FOR INSERT WITH CHECK (auth.uid() = "senderId");
DROP POLICY IF EXISTS "direct_messages_update" ON public.direct_messages;
CREATE POLICY "direct_messages_update" ON public.direct_messages FOR UPDATE USING (auth.uid() = "receiverId" OR auth.uid() = "senderId");

ALTER TABLE public.outings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "outings_select" ON public.outings;
CREATE POLICY "outings_select" ON public.outings FOR SELECT USING (true);
DROP POLICY IF EXISTS "outings_insert" ON public.outings;
CREATE POLICY "outings_insert" ON public.outings FOR INSERT WITH CHECK (auth.uid() = "creatorId");
DROP POLICY IF EXISTS "outings_update" ON public.outings;
CREATE POLICY "outings_update" ON public.outings FOR UPDATE USING (auth.uid() = "creatorId" OR auth.uid() = ANY("attendeeIds"));
DROP POLICY IF EXISTS "outings_delete" ON public.outings;
CREATE POLICY "outings_delete" ON public.outings FOR DELETE USING (auth.uid() = "creatorId");

ALTER TABLE public.reels ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "reels_select" ON public.reels;
CREATE POLICY "reels_select" ON public.reels FOR SELECT USING (true);
DROP POLICY IF EXISTS "reels_insert" ON public.reels;
CREATE POLICY "reels_insert" ON public.reels FOR INSERT WITH CHECK (auth.uid() = owner_id OR auth.uid() = creator_id);
DROP POLICY IF EXISTS "reels_update" ON public.reels;
CREATE POLICY "reels_update" ON public.reels FOR UPDATE USING (auth.uid() = owner_id OR auth.uid() = creator_id);
DROP POLICY IF EXISTS "reels_delete" ON public.reels;
CREATE POLICY "reels_delete" ON public.reels FOR DELETE USING (auth.uid() = owner_id OR auth.uid() = creator_id);

ALTER TABLE public.reels_likes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "reels_likes_select" ON public.reels_likes;
CREATE POLICY "reels_likes_select" ON public.reels_likes FOR SELECT USING (true);
DROP POLICY IF EXISTS "reels_likes_insert" ON public.reels_likes;
CREATE POLICY "reels_likes_insert" ON public.reels_likes FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "reels_likes_delete" ON public.reels_likes;
CREATE POLICY "reels_likes_delete" ON public.reels_likes FOR DELETE USING (auth.uid() = user_id);

ALTER TABLE public.reels_comments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "reels_comments_select" ON public.reels_comments;
CREATE POLICY "reels_comments_select" ON public.reels_comments FOR SELECT USING (true);
DROP POLICY IF EXISTS "reels_comments_insert" ON public.reels_comments;
CREATE POLICY "reels_comments_insert" ON public.reels_comments FOR INSERT WITH CHECK (auth.uid() = user_id);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "notifications_select" ON public.notifications;
CREATE POLICY "notifications_select" ON public.notifications FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "notifications_insert" ON public.notifications;
CREATE POLICY "notifications_insert" ON public.notifications FOR INSERT WITH CHECK (auth.uid() = actor_id);
DROP POLICY IF EXISTS "notifications_update" ON public.notifications;
CREATE POLICY "notifications_update" ON public.notifications FOR UPDATE USING (auth.uid() = user_id);

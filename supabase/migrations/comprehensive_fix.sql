-- Missing users table (Replacing profiles)
CREATE TABLE IF NOT EXISTS public.users (
  id uuid PRIMARY KEY REFERENCES auth.users(id),
  email text,
  username text UNIQUE,
  name text,
  "displayName" text,
  avatar text,
  onboarding_completed boolean DEFAULT false,
  "trustScore" integer DEFAULT 0,
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

-- Drop duplicate or confusing tables if they are empty
-- DROP TABLE IF EXISTS public.profiles CASCADE;


-- Missing conversation_members table
CREATE TABLE IF NOT EXISTS public.conversation_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid,
  user_id uuid REFERENCES public.users(id),
  joined_at timestamptz DEFAULT now(),
  UNIQUE(conversation_id, user_id)
);

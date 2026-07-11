-- =======================================================
-- YALLA MATE - SUPABASE SETUP SCRIPT (PART 1 OF 2)
-- =======================================================
-- This script initializes ALL tables, storage buckets, and triggers.
-- Run this first in the Supabase SQL Editor.

-- 1. EXTENSIONS & PREREQUISITES
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. ROBUST TYPE CHECK & CLEANUP
-- This ensures all tables that require TEXT IDs (for app-generated strings) are correctly typed.
DO $$ 
DECLARE
  t text;
  tables_to_check text[] := ARRAY['outings','reels','posts','chats','direct_messages','communities','community_messages','friend_requests','follows','companion_reviews','incident_reports','place_reviews', 'reels_likes'];
BEGIN
  FOREACH t IN ARRAY tables_to_check LOOP
    -- Check if table exists AND has an 'id' column of type 'uuid'
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = t 
      AND column_name = 'id' 
      AND data_type = 'uuid'
    ) THEN
      RAISE NOTICE 'Detected % has UUID primary key. Dropping CASCADE to convert to TEXT.', t;
      EXECUTE 'DROP TABLE IF EXISTS public.' || t || ' CASCADE';
    END IF;
  END LOOP;

  -- Special check for foreign keys that might be stuck as UUID
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'reels' AND column_name = 'outingId' AND data_type = 'uuid'
  ) THEN
    DROP TABLE IF EXISTS public.reels CASCADE;
  END IF;
END $$;

-- 3. TABLES INITIALIZATION

-- Users
CREATE TABLE IF NOT EXISTS public.users (
  id uuid references auth.users not null primary key,
  name text,
  username text unique,
  "displayName" text,
  bio text,
  phone text,
  location text,
  city text,
  avatar text,
  archetype text,
  "trustScore" numeric default 9.5,
  "reputationScore" integer default 0,
  verified boolean default false,
  interests text[],
  "joinedAt" timestamp with time zone default timezone('utc'::text, now()),
  "lastActive" timestamp with time zone default timezone('utc'::text, now()),
  "followersCount" integer default 0,
  "followingCount" integer default 0,
  "friendsCount" integer default 0,
  preferences jsonb,
  badges text[],
  "warningCount" integer default 0,
  suspended boolean default false,
  gender text,
  hobbies text[],
  "favoriteFood" text,
  "favoritePlayground" text,
  "musicPreference" text,
  "sportsTeam" text,
  xp integer default 0,
  level integer default 1,
  onboarding_completed boolean default false,
  followers uuid[] default '{}',
  following uuid[] default '{}'
);

-- REFRESH/PATCH EXISTING TABLES
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS "trustScore" numeric default 9.5;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS "followers" uuid[] default '{}';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS "following" uuid[] default '{}';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS "emergencyContactName" text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS "emergencyContactPhone" text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS "privacyStatus" text default 'public';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS "dmStatus" text default 'everyone';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS "hideFollowers" boolean default false;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS "notificationEnabled" boolean default true;

-- Outings (Use TEXT for ID as app generates 'outing_...' strings)
CREATE TABLE IF NOT EXISTS public.outings (
  id text primary key,
  title text not null,
  description text,
  category text,
  location text,
  city text,
  datetime timestamp with time zone,
  "creatorId" uuid references public.users(id),
  "creatorName" text,
  "creatorAvatar" text,
  "creatorTrust" numeric,
  "maxAttendees" integer,
  "attendeeIds" text[] default '{}',
  "minTrustScore" numeric default 0,
  status text,
  logistics jsonb,
  "coverImage" text,
  "genderRestriction" text,
  "mapCoordinates" jsonb,
  "mapLocationUrl" text,
  "isBlindOuting" boolean default false,
  "blindWaypoints" text[],
  "isPrivate" boolean default false,
  "invitedUserIds" text[] default '{}'
);

ALTER TABLE public.outings ADD COLUMN IF NOT EXISTS "creatorTrust" numeric;
ALTER TABLE public.outings ADD COLUMN IF NOT EXISTS "minTrustScore" numeric default 0;
ALTER TABLE public.outings ADD COLUMN IF NOT EXISTS "attendeeIds" text[] default '{}';
ALTER TABLE public.outings ADD COLUMN IF NOT EXISTS "logistics" jsonb;
ALTER TABLE public.outings ADD COLUMN IF NOT EXISTS "coverImage" text;
ALTER TABLE public.outings ADD COLUMN IF NOT EXISTS "genderRestriction" text;
ALTER TABLE public.outings ADD COLUMN IF NOT EXISTS "mapCoordinates" jsonb;
ALTER TABLE public.outings ADD COLUMN IF NOT EXISTS "mapLocationUrl" text;
ALTER TABLE public.outings ADD COLUMN IF NOT EXISTS "isBlindOuting" boolean default false;
ALTER TABLE public.outings ADD COLUMN IF NOT EXISTS "blindWaypoints" text[];
ALTER TABLE public.outings ADD COLUMN IF NOT EXISTS "isPrivate" boolean default false;
ALTER TABLE public.outings ADD COLUMN IF NOT EXISTS "invitedUserIds" text[] default '{}';

-- Reels
CREATE TABLE IF NOT EXISTS public.reels (
  id text primary key default gen_random_uuid()::text,
  owner_id uuid references public.users(id),
  video_url text not null,
  caption text,
  creator_id uuid references public.users(id),
  creator_name text,
  creator_avatar text,
  likes_count integer default 0,
  comments_count integer default 0,
  outing_id text references public.outings(id),
  created_at timestamp with time zone default timezone('utc'::text, now())
);

ALTER TABLE public.reels ALTER COLUMN id TYPE text;
ALTER TABLE public.reels ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
ALTER TABLE public.reels ADD COLUMN IF NOT EXISTS "creatorId" uuid references public.users(id);
ALTER TABLE public.reels ADD COLUMN IF NOT EXISTS "creatorName" text;
ALTER TABLE public.reels ADD COLUMN IF NOT EXISTS "creatorAvatar" text;

-- Reels Likes
CREATE TABLE IF NOT EXISTS public.reels_likes (
  id text primary key default gen_random_uuid()::text,
  owner_id uuid references public.users(id) on delete cascade,
  user_id uuid references public.users(id) on delete cascade,
  reel_id text not null references public.reels(id) on delete cascade,
  created_at timestamp with time zone default timezone('utc'::text, now()),
  UNIQUE(reel_id, user_id)
);

-- Reels Comments
CREATE TABLE IF NOT EXISTS public.reels_comments (
  id text primary key default gen_random_uuid()::text,
  reel_id text not null references public.reels(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  content text,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- Reels Bookmarks
CREATE TABLE IF NOT EXISTS public.reels_bookmarks (
  id text primary key default gen_random_uuid()::text,
  reel_id text not null references public.reels(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  created_at timestamp with time zone default timezone('utc'::text, now()),
  UNIQUE(reel_id, user_id)
);

-- Fix types and constraints
DO $$
BEGIN
  ALTER TABLE IF EXISTS public.reels_likes DROP CONSTRAINT IF EXISTS reels_likes_reel_id_fkey;
  ALTER TABLE IF EXISTS public.reels_likes DROP CONSTRAINT IF EXISTS reels_likes_reel_fk;
  ALTER TABLE IF EXISTS public.reels_comments DROP CONSTRAINT IF EXISTS reels_comments_reel_id_fkey;
  ALTER TABLE IF EXISTS public.reels_comments DROP CONSTRAINT IF EXISTS reels_comments_reel_fk;
  ALTER TABLE IF EXISTS public.reels_bookmarks DROP CONSTRAINT IF EXISTS reels_bookmarks_reel_id_fkey;
  ALTER TABLE IF EXISTS public.reels_bookmarks DROP CONSTRAINT IF EXISTS reels_bookmarks_reel_fk;

  BEGIN ALTER TABLE public.reels ALTER COLUMN id TYPE text; EXCEPTION WHEN others THEN NULL; END;
  BEGIN ALTER TABLE public.reels_likes ALTER COLUMN reel_id TYPE text; EXCEPTION WHEN others THEN NULL; END;
  BEGIN ALTER TABLE public.reels_comments ALTER COLUMN reel_id TYPE text; EXCEPTION WHEN others THEN NULL; END;
  BEGIN ALTER TABLE public.reels_bookmarks ALTER COLUMN reel_id TYPE text; EXCEPTION WHEN others THEN NULL; END;

  BEGIN
    ALTER TABLE public.reels_likes ADD CONSTRAINT reels_likes_reel_id_fkey FOREIGN KEY (reel_id) REFERENCES public.reels(id) ON DELETE CASCADE;
  EXCEPTION WHEN others THEN NULL; END;

  BEGIN
    ALTER TABLE public.reels_comments ADD CONSTRAINT reels_comments_reel_id_fkey FOREIGN KEY (reel_id) REFERENCES public.reels(id) ON DELETE CASCADE;
  EXCEPTION WHEN others THEN NULL; END;

  BEGIN
    ALTER TABLE public.reels_bookmarks ADD CONSTRAINT reels_bookmarks_reel_id_fkey FOREIGN KEY (reel_id) REFERENCES public.reels(id) ON DELETE CASCADE;
  EXCEPTION WHEN others THEN NULL; END;
END $$;

-- Posts
CREATE TABLE IF NOT EXISTS public.posts (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid references public.users(id),
  content text,
  media_url text,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS "userId" uuid references public.users(id);
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS "userName" text;
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS "userAvatar" text;
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS "commentsCount" integer default 0;
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS "likes" text[] default '{}';
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS "reposts" text[] default '{}';

ALTER TABLE public.outings ADD COLUMN IF NOT EXISTS "creatorTrust" numeric default 9.5;
ALTER TABLE public.outings ADD COLUMN IF NOT EXISTS "minTrustScore" numeric default 0;
ALTER TABLE public.reels ADD COLUMN IF NOT EXISTS "commentsCount" integer default 0;
ALTER TABLE public.reels ADD COLUMN IF NOT EXISTS "views" integer default 0;

-- Chats
CREATE TABLE IF NOT EXISTS public.chats (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid references public.users(id),
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- Direct Messages
CREATE TABLE IF NOT EXISTS public.direct_messages (
  id text primary key default gen_random_uuid()::text,
  "chatId" text,
  "outingId" text references public.outings(id) on delete cascade,
  "senderId" uuid references public.users(id) on delete cascade,
  "receiverId" uuid references public.users(id) on delete cascade,
  "senderName" text,
  "senderAvatar" text,
  content text,
  timestamp timestamp with time zone default timezone('utc'::text, now()),
  "isSystem" boolean default false,
  "imageUrl" text,
  "locationUrl" text,
  type text default 'text',
  read boolean default false,
  reactions jsonb default '{}'
);

ALTER TABLE public.direct_messages ADD COLUMN IF NOT EXISTS "chatId" text;
ALTER TABLE public.direct_messages ADD COLUMN IF NOT EXISTS "outingId" text references public.outings(id) on delete cascade;
ALTER TABLE public.direct_messages ADD COLUMN IF NOT EXISTS "senderId" uuid references public.users(id) on delete cascade;
ALTER TABLE public.direct_messages ADD COLUMN IF NOT EXISTS "receiverId" uuid references public.users(id) on delete cascade;
ALTER TABLE public.direct_messages ADD COLUMN IF NOT EXISTS "senderName" text;
ALTER TABLE public.direct_messages ADD COLUMN IF NOT EXISTS "senderAvatar" text;
ALTER TABLE public.direct_messages ADD COLUMN IF NOT EXISTS "isSystem" boolean default false;
ALTER TABLE public.direct_messages ADD COLUMN IF NOT EXISTS "imageUrl" text;
ALTER TABLE public.direct_messages ADD COLUMN IF NOT EXISTS "locationUrl" text;

-- Communities
CREATE TABLE IF NOT EXISTS public.communities (
  id text primary key,
  "nameAr" text,
  "nameEn" text,
  "descriptionAr" text,
  "descriptionEn" text,
  icon text,
  "membersCount" integer default 0,
  members text[] default '{}',
  timestamp timestamp with time zone default timezone('utc'::text, now())
);

-- Community Messages
CREATE TABLE IF NOT EXISTS public.community_messages (
  id text primary key,
  "communityId" text references public.communities(id),
  "senderId" uuid references public.users(id),
  "senderName" text,
  "senderAvatar" text,
  "senderScore" numeric,
  "isVerified" boolean default false,
  content text,
  timestamp timestamp with time zone default timezone('utc'::text, now())
);

-- Friend Requests
CREATE TABLE IF NOT EXISTS public.friend_requests (
  id text primary key,
  "senderId" uuid references public.users(id),
  "receiverId" uuid references public.users(id),
  status text check (status in ('pending', 'accepted', 'rejected')),
  "senderName" text,
  "senderAvatar" text,
  timestamp timestamp with time zone default timezone('utc'::text, now())
);

-- Follows
CREATE TABLE IF NOT EXISTS public.follows (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid references public.users(id) on delete cascade,
  target_user_id uuid references public.users(id) on delete cascade,
  follower_id uuid references public.users(id) on delete cascade,
  following_id uuid references public.users(id) on delete cascade,
  created_at timestamp with time zone default timezone('utc'::text, now()),
  UNIQUE(follower_id, following_id)
);

ALTER TABLE public.follows ADD COLUMN IF NOT EXISTS target_user_id uuid references public.users(id) on delete cascade;
ALTER TABLE public.follows ADD COLUMN IF NOT EXISTS follower_id uuid references public.users(id) on delete cascade;
ALTER TABLE public.follows ADD COLUMN IF NOT EXISTS following_id uuid references public.users(id) on delete cascade;

-- Companion Reviews
CREATE TABLE IF NOT EXISTS public.companion_reviews (
  id text primary key,
  "outingId" text references public.outings(id),
  "reviewerId" uuid references public.users(id),
  "revieweeId" uuid references public.users(id),
  "respectfulRating" integer,
  "punctualRating" integer,
  "paymentRating" integer,
  "friendlyRating" integer,
  comment text,
  timestamp timestamp with time zone default timezone('utc'::text, now())
);

-- Incident Reports
CREATE TABLE IF NOT EXISTS public.incident_reports (
  id text primary key,
  "reporterId" uuid references public.users(id),
  "targetId" text,
  type text,
  category text,
  description text,
  evidence text[],
  status text default 'pending',
  timestamp timestamp with time zone default timezone('utc'::text, now())
);

-- Place Reviews
CREATE TABLE IF NOT EXISTS public.place_reviews (
  id text primary key,
  "placeId" text,
  "authorId" uuid references public.users(id),
  author text,
  avatar text,
  rating numeric,
  comment text,
  timestamp timestamp with time zone default timezone('utc'::text, now())
);

-- Storage Buckets Setup
INSERT INTO storage.buckets (id, name, public) 
VALUES ('reels', 'reels', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public) 
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public) 
VALUES ('outings', 'outings', true)
ON CONFLICT (id) DO NOTHING;

-- Storage permissive policies
DO $$
DECLARE
  b text;
  buckets text[] := ARRAY['reels', 'avatars', 'outings'];
BEGIN
  FOREACH b IN ARRAY buckets LOOP
    EXECUTE 'DROP POLICY IF EXISTS "Public Access ' || b || '" ON storage.objects';
    EXECUTE 'CREATE POLICY "Public Access ' || b || '" ON storage.objects FOR SELECT USING ( bucket_id = ''' || b || ''' )';
    
    EXECUTE 'DROP POLICY IF EXISTS "Public Upload ' || b || '" ON storage.objects';
    EXECUTE 'CREATE POLICY "Public Upload ' || b || '" ON storage.objects FOR INSERT WITH CHECK ( bucket_id = ''' || b || ''' )';
    
    EXECUTE 'DROP POLICY IF EXISTS "Public Delete ' || b || '" ON storage.objects';
    EXECUTE 'CREATE POLICY "Public Delete ' || b || '" ON storage.objects FOR DELETE USING ( bucket_id = ''' || b || ''' )';
  END LOOP;
EXCEPTION WHEN others THEN
    RAISE NOTICE 'Skipping policy creation - Storage Policies';
END $$;

-- Automatic user creation trigger from auth.users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.users (id, name, "displayName", avatar)
  VALUES (
    NEW.id, 
    NEW.raw_user_meta_data->>'full_name', 
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- New Outing-related helper tables
CREATE TABLE IF NOT EXISTS public.outing_participants (
  id text primary key,
  outing_id text references public.outings(id) on delete cascade,
  user_id uuid references public.users(id) on delete cascade,
  role text default 'member',
  status text default 'approved',
  joined_at timestamp with time zone default timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.outing_invites (
  id text primary key,
  outing_id text references public.outings(id) on delete cascade,
  inviter_id uuid references public.users(id) on delete cascade,
  invitee_id uuid references public.users(id) on delete cascade,
  status text default 'pending',
  created_at timestamp with time zone default timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.outing_messages (
  id text primary key,
  outing_id text references public.outings(id) on delete cascade,
  sender_id uuid references public.users(id) on delete cascade,
  content text,
  is_system boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.outing_locations (
  id text primary key,
  outing_id text references public.outings(id) on delete cascade,
  latitude numeric,
  longitude numeric,
  address text,
  name text,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

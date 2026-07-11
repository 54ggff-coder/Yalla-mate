-- =======================================================
-- YALLA MATE - COMPREHENSIVE SUPABASE SETUP SCRIPT (V2)
-- =======================================================
-- This script initializes ALL tables, buckets, and policies needed for the app.
-- It avoids "already exists" errors using DROP POLICY and existence checks.
-- Paste this ENTIRE script into your Supabase SQL Editor and run it.

-- 0. CLEANUP & HARD RESET (Uncomment lines 9-22 ONLY if you want to wipe ALL data and start from a clean state)
-- This is recommended if you are seeing "incompatible types" or "column does not exist" errors that won't go away.
-- DROP TABLE IF EXISTS public.reels_likes CASCADE;
-- DROP TABLE IF EXISTS public.community_messages CASCADE;
-- DROP TABLE IF EXISTS public.communities CASCADE;
-- DROP TABLE IF EXISTS public.direct_messages CASCADE;
-- DROP TABLE IF EXISTS public.chats CASCADE;
-- DROP TABLE IF EXISTS public.posts CASCADE;
-- DROP TABLE IF EXISTS public.reels CASCADE;
-- DROP TABLE IF EXISTS public.outings CASCADE;
-- DROP TABLE IF EXISTS public.friend_requests CASCADE;
-- DROP TABLE IF EXISTS public.follows CASCADE;
-- DROP TABLE IF EXISTS public.companion_reviews CASCADE;
-- DROP TABLE IF EXISTS public.incident_reports CASCADE;
-- DROP TABLE IF EXISTS public.place_reviews CASCADE;
-- DROP TABLE IF EXISTS public.users CASCADE;

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. ROBUST TYPE CHECK & CLEANUP
-- This ensures all tables that require TEXT IDs (for app-generated strings) are correctly typed.
-- If a table exists with UUID but the app expects TEXT, it will be dropped and recreated.
DO $$ 
DECLARE
  t text;
  -- List of tables that MUST use TEXT for their primary key 'id'
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
  id text primary key, auth_id uuid references auth.users(id) unique,
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

-- REFRESH/PATCH EXISTING TABLES (Ensures columns exist if table was created earlier)
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS "trustScore" numeric default 9.5;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS "followers" uuid[] default '{}';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS "following" uuid[] default '{}';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS "emergencyContactName" text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS "emergencyContactPhone" text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS "privacyStatus" text default 'public';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS "dmStatus" text default 'everyone';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS "hideFollowers" boolean default false;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS "notificationEnabled" boolean default true;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS "trips" integer default 0;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS "outings" integer default 0;

-- Outings (Use TEXT for ID as app generates 'outing_...' strings)
CREATE TABLE IF NOT EXISTS public.outings (
  id text primary key,
  title text not null,
  description text,
  category text,
  location text,
  city text,
  datetime timestamp with time zone,
  "creatorId" text,
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
ALTER TABLE public.outings ADD COLUMN IF NOT EXISTS "isSoloOuting" boolean default false;
ALTER TABLE public.outings ADD COLUMN IF NOT EXISTS "aiItinerarySteps" text[] default '{}';
ALTER TABLE public.outings ADD COLUMN IF NOT EXISTS "currentStepIndex" integer default 0;
ALTER TABLE public.outings ADD COLUMN IF NOT EXISTS "budgetEstimate" jsonb;

-- Reels (Use TEXT for IDs)
CREATE TABLE IF NOT EXISTS public.reels (
  id text primary key default gen_random_uuid()::text,
  owner_id text,
  video_url text not null,
  caption text,
  creator_id text,
  creator_name text,
  creator_avatar text,
  likes_count integer default 0,
  comments_count integer default 0,
  outing_id text references public.outings(id),
  created_at timestamp with time zone default timezone('utc'::text, now())
);

ALTER TABLE public.reels ALTER COLUMN id TYPE text;
ALTER TABLE public.reels ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
ALTER TABLE public.reels ADD COLUMN IF NOT EXISTS "creatorId" text;
ALTER TABLE public.reels ADD COLUMN IF NOT EXISTS "creatorName" text;
ALTER TABLE public.reels ADD COLUMN IF NOT EXISTS "creatorAvatar" text;

-- Reels Likes
DROP TABLE IF EXISTS public.reels_likes CASCADE;
CREATE TABLE IF NOT EXISTS public.reels_likes (
  id text primary key default gen_random_uuid()::text,
  owner_id text references public.users(id) on delete cascade,
  user_id text references public.users(id) on delete cascade,
  reel_id text not null references public.reels(id) on delete cascade,
  created_at timestamp with time zone default timezone('utc'::text, now()),
  UNIQUE(reel_id, user_id)
);

-- Reels Comments
CREATE TABLE IF NOT EXISTS public.reels_comments (
  id text primary key default gen_random_uuid()::text,
  reel_id text not null references public.reels(id) on delete cascade,
  user_id text not null references public.users(id) on delete cascade,
  content text,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- Reels Bookmarks
CREATE TABLE IF NOT EXISTS public.reels_bookmarks (
  id text primary key default gen_random_uuid()::text,
  reel_id text not null references public.reels(id) on delete cascade,
  user_id text not null references public.users(id) on delete cascade,
  created_at timestamp with time zone default timezone('utc'::text, now()),
  UNIQUE(reel_id, user_id)
);

-- Fix any existing mismatch and set to uuid unconditionally
DO $$
BEGIN
  -- Drop foreign keys first to allow altering types safely
  ALTER TABLE IF EXISTS public.reels_likes DROP CONSTRAINT IF EXISTS reels_likes_reel_id_fkey;
  ALTER TABLE IF EXISTS public.reels_likes DROP CONSTRAINT IF EXISTS reels_likes_reel_fk;
  ALTER TABLE IF EXISTS public.reels_comments DROP CONSTRAINT IF EXISTS reels_comments_reel_id_fkey;
  ALTER TABLE IF EXISTS public.reels_comments DROP CONSTRAINT IF EXISTS reels_comments_reel_fk;
  ALTER TABLE IF EXISTS public.reels_bookmarks DROP CONSTRAINT IF EXISTS reels_bookmarks_reel_id_fkey;
  ALTER TABLE IF EXISTS public.reels_bookmarks DROP CONSTRAINT IF EXISTS reels_bookmarks_reel_fk;

  -- Ensure types are correctly text (already set in CREATE TABLE, but this prevents forced reversal)
  BEGIN
    ALTER TABLE public.reels ALTER COLUMN id TYPE text;
  EXCEPTION WHEN others THEN RAISE NOTICE 'Could not ensure reels id is text'; END;
  
  BEGIN
    ALTER TABLE public.reels_likes ALTER COLUMN reel_id TYPE text;
    ALTER TABLE public.reels_likes ALTER COLUMN user_id TYPE text;
  EXCEPTION WHEN others THEN RAISE NOTICE 'Could not ensure reels_likes cols types'; END;

  BEGIN
    ALTER TABLE public.reels_comments ALTER COLUMN reel_id TYPE text;
    ALTER TABLE public.reels_comments ALTER COLUMN user_id TYPE text;
  EXCEPTION WHEN others THEN RAISE NOTICE 'Could not ensure reels_comments cols types'; END;

  BEGIN
    ALTER TABLE public.reels_bookmarks ALTER COLUMN reel_id TYPE text;
    ALTER TABLE public.reels_bookmarks ALTER COLUMN user_id TYPE text;
  EXCEPTION WHEN others THEN RAISE NOTICE 'Could not ensure reels_bookmarks cols types'; END;

  -- Set NOT NULL
  BEGIN
    ALTER TABLE public.reels_likes ALTER COLUMN reel_id SET NOT NULL;
    ALTER TABLE public.reels_likes ALTER COLUMN user_id SET NOT NULL;
  EXCEPTION WHEN others THEN RAISE NOTICE 'Could not set NOT NULL on reels_likes'; END;

  -- Re-add foreign key constraints
  BEGIN
    ALTER TABLE public.reels_likes ADD CONSTRAINT reels_likes_reel_id_fkey FOREIGN KEY (reel_id) REFERENCES public.reels(id) ON DELETE CASCADE;
  EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END;

  BEGIN
    ALTER TABLE public.reels_comments ADD CONSTRAINT reels_comments_reel_id_fkey FOREIGN KEY (reel_id) REFERENCES public.reels(id) ON DELETE CASCADE;
  EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END;

  BEGIN
    ALTER TABLE public.reels_bookmarks ADD CONSTRAINT reels_bookmarks_reel_id_fkey FOREIGN KEY (reel_id) REFERENCES public.reels(id) ON DELETE CASCADE;
  EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END;

EXCEPTION WHEN others THEN
  RAISE NOTICE 'Type mismatch fix block failed gently';
END $$;
CREATE TABLE IF NOT EXISTS public.posts (
  id uuid primary key default uuid_generate_v4(),
  owner_id text,
  content text,
  media_url text,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- Ensure all columns exist and are typed correctly
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS "userId" uuid references public.users(id);
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS "userName" text;
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS "userAvatar" text;
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS "commentsCount" integer default 0;
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS "likes" text[] default '{}';
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS "reposts" text[] default '{}';

-- Specifically fix creatorTrust on outings (common failure point)
ALTER TABLE public.outings ADD COLUMN IF NOT EXISTS "creatorTrust" numeric default 9.5;
ALTER TABLE public.outings ADD COLUMN IF NOT EXISTS "minTrustScore" numeric default 0;

-- Fix reels columns if needed
ALTER TABLE public.reels ADD COLUMN IF NOT EXISTS "commentsCount" integer default 0;
ALTER TABLE public.reels ADD COLUMN IF NOT EXISTS "views" integer default 0;

-- Chats (Private Threads)
CREATE TABLE IF NOT EXISTS public.chats (
  id uuid primary key default uuid_generate_v4(),
  owner_id text,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- Direct Messages (Table: direct_messages)
CREATE TABLE IF NOT EXISTS public.direct_messages (
  id text primary key default gen_random_uuid()::text,
  "chatId" text,
  "outingId" text references public.outings(id) on delete cascade,
  "senderId" text on delete cascade,
  "receiverId" text on delete cascade,
  "senderName" text,
  "senderAvatar" text,
  content text,
  timestamp timestamp with time zone default timezone('utc'::text, now()),
  "isSystem" boolean default false,
  "imageUrl" text,
  "locationUrl" text,
  type text default 'text',
  read boolean default false,
  is_read boolean default false,
  reactions jsonb default '{}'
);

-- Patch direct_messages camelCase columns
ALTER TABLE public.direct_messages ADD COLUMN IF NOT EXISTS "chatId" text;
ALTER TABLE public.direct_messages ADD COLUMN IF NOT EXISTS "outingId" text references public.outings(id) on delete cascade;
ALTER TABLE public.direct_messages ADD COLUMN IF NOT EXISTS "senderId" text on delete cascade;
ALTER TABLE public.direct_messages ADD COLUMN IF NOT EXISTS "receiverId" text on delete cascade;
ALTER TABLE public.direct_messages ADD COLUMN IF NOT EXISTS "senderName" text;
ALTER TABLE public.direct_messages ADD COLUMN IF NOT EXISTS "senderAvatar" text;
ALTER TABLE public.direct_messages ADD COLUMN IF NOT EXISTS "isSystem" boolean default false;
ALTER TABLE public.direct_messages ADD COLUMN IF NOT EXISTS "imageUrl" text;
ALTER TABLE public.direct_messages ADD COLUMN IF NOT EXISTS "locationUrl" text;
ALTER TABLE public.direct_messages ADD COLUMN IF NOT EXISTS "is_read" boolean default false;

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
  "senderId" text,
  "senderName" text,
  "senderAvatar" text,
  "senderScore" numeric,
  "isVerified" boolean default false,
  content text,
  timestamp timestamp with time zone default timezone('utc'::text, now())
);

-- Friend Requests
CREATE TABLE IF NOT EXISTS public.friend_requests (
  id text primary key default concat('fr_', gen_random_uuid()),
  "senderId" text references public.users(id) on delete cascade,
  "receiverId" text references public.users(id) on delete cascade,
  status text check (status in ('pending', 'accepted', 'rejected')),
  "senderName" text,
  "senderAvatar" text,
  timestamp timestamp with time zone default timezone('utc'::text, now())
);
ALTER TABLE public.friend_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Permissive" ON public.friend_requests FOR ALL USING (true) WITH CHECK (true);

-- Follows
CREATE TABLE IF NOT EXISTS public.follows (
  id text primary key default concat('flw_', gen_random_uuid()),
  follower_id text references public.users(id) on delete cascade,
  following_id text references public.users(id) on delete cascade,
  target_user_id text references public.users(id) on delete cascade,
  created_at timestamp with time zone default timezone('utc'::text, now()),
  UNIQUE(follower_id, following_id)
);
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Permissive" ON public.follows FOR ALL USING (true) WITH CHECK (true);

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
  "targetId" text, -- Can be outing ID or user ID (both strings)
  type text, -- 'user' | 'outing'
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

-- 3. STORAGE SETUP
INSERT INTO storage.buckets (id, name, public) 
VALUES ('reels', 'reels', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public) 
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public) 
VALUES ('outings', 'outings', true)
ON CONFLICT (id) DO NOTHING;

-- STORAGE POLICIES (Using DO blocks to safely create policies)
DO $$
DECLARE
  b text;
  buckets text[] := ARRAY['reels', 'avatars', 'outings'];
BEGIN
  FOREACH b IN ARRAY buckets LOOP
    -- SELECT
    EXECUTE 'DROP POLICY IF EXISTS "Public Access ' || b || '" ON storage.objects';
    EXECUTE 'CREATE POLICY "Public Access ' || b || '" ON storage.objects FOR SELECT USING ( bucket_id = ''' || b || ''' )';
    
    -- INSERT
    EXECUTE 'DROP POLICY IF EXISTS "Public Upload ' || b || '" ON storage.objects';
    EXECUTE 'CREATE POLICY "Public Upload ' || b || '" ON storage.objects FOR INSERT WITH CHECK ( bucket_id = ''' || b || ''' )';
    
    -- DELETE
    EXECUTE 'DROP POLICY IF EXISTS "Public Delete ' || b || '" ON storage.objects';
    EXECUTE 'CREATE POLICY "Public Delete ' || b || '" ON storage.objects FOR DELETE USING ( bucket_id = ''' || b || ''' )';
  END LOOP;
EXCEPTION WHEN others THEN
    RAISE NOTICE 'Skipping policy creation - Storage Policies';
END $$;

-- 4. AUTOMATIC USER CREATION TRIGGER
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.users (id, auth_id, name, "displayName", avatar)
  VALUES (NEW.id::text, NEW.id, 
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

-- ==========================================================
-- ADD NEW OUTINGS RELATED COMPANION TABLES (COMMUNITY ENGINE)
-- ==========================================================

-- Outing Participants
CREATE TABLE IF NOT EXISTS public.outing_participants (
  id text primary key,
  outing_id text references public.outings(id) on delete cascade,
  user_id text on delete cascade,
  role text default 'member', -- 'creator', 'admin', 'member'
  status text default 'approved', -- 'pending_approval', 'approved', 'declined'
  joined_at timestamp with time zone default timezone('utc'::text, now())
);

-- Outing Invites
CREATE TABLE IF NOT EXISTS public.outing_invites (
  id text primary key,
  outing_id text references public.outings(id) on delete cascade,
  inviter_id uuid references public.users(id) on delete cascade,
  invitee_id uuid references public.users(id) on delete cascade,
  status text default 'pending', -- 'pending', 'accepted', 'rejected'
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- Outing Messages
CREATE TABLE IF NOT EXISTS public.outing_messages (
  id text primary key,
  outing_id text references public.outings(id) on delete cascade,
  sender_id uuid references public.users(id) on delete cascade,
  content text,
  is_system boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- Outing Locations
CREATE TABLE IF NOT EXISTS public.outing_locations (
  id text primary key,
  outing_id text references public.outings(id) on delete cascade,
  latitude numeric,
  longitude numeric,
  address text,
  name text,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- 5. ENABLE REALTIME
DO $$
DECLARE
  tables_to_add text[] := ARRAY['users','outings','reels','direct_messages','posts','friend_requests','chats','outing_participants','outing_invites','outing_messages','outing_locations'];
  t text;
BEGIN
  -- Publication check
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;

  FOREACH t IN ARRAY tables_to_add LOOP
    -- Check if table is already in the publication
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime' 
      AND schemaname = 'public' 
      AND tablename = t
    ) THEN
      BEGIN
        EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.' || t;
      EXCEPTION WHEN others THEN
        RAISE NOTICE 'Failed to add table % to publication supabase_realtime (maybe already added or table missing)', t;
      END;
    END IF;
  END LOOP;
END $$;

-- 6. RLS POLICIES (Public Access for Demo, can be hardened later)
-- First, disable RLS on all tables and drop ALL existing policies to avoid conflicts
DO $$ 
DECLARE 
  t text;
  pol RECORD;
  tables text[] := ARRAY['users','outings','reels','reels_likes','reels_comments','reels_bookmarks','posts','chats','direct_messages','communities','community_messages','friend_requests','follows','companion_reviews','incident_reports','place_reviews','outing_participants','outing_invites','outing_messages','outing_locations'];
BEGIN
  -- Drop ALL existing policies on public schema to resolve "cannot alter type" and "policy violation" errors
  FOR pol IN (SELECT policyname, tablename FROM pg_policies WHERE schemaname = 'public') LOOP
    EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(pol.policyname) || ' ON public.' || quote_ident(pol.tablename);
  END LOOP;

  -- Enable RLS and create one single robust permissive policy per table
  FOREACH t IN ARRAY tables LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = t) THEN
        EXECUTE 'ALTER TABLE public.' || t || ' ENABLE ROW LEVEL SECURITY';
        EXECUTE 'CREATE POLICY "Permissive" ON public.' || t || ' FOR ALL USING (true) WITH CHECK (true)';
    END IF;
  END LOOP;
END $$;

-- Grant access to all tables for Supabase/PostgREST - Explicit and robust
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO anon, authenticated;

-- Ensure RLS is active and policy is truly permssive for missing-data tables
ALTER TABLE IF EXISTS public.reels_likes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permissive" ON public.reels_likes;
CREATE POLICY "Permissive" ON public.reels_likes FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE IF EXISTS public.friend_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permissive" ON public.friend_requests;
CREATE POLICY "Permissive" ON public.friend_requests FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE IF EXISTS public.follows ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permissive" ON public.follows;
CREATE POLICY "Permissive" ON public.follows FOR ALL USING (true) WITH CHECK (true);

-- 7. NOTIFY POSTGREST TO RELOAD SCHEMA CACHE
NOTIFY pgrst, 'reload schema';

-- Function to check RLS Policies of Outing tables
CREATE OR REPLACE FUNCTION public.check_outing_policies()
RETURNS TABLE (
  table_name text,
  has_select_policy boolean,
  has_insert_policy boolean,
  has_update_policy boolean,
  has_delete_policy boolean,
  rls_enabled boolean
) SECURITY DEFINER LANGUAGE plpgsql AS $$
DECLARE
  t text;
  tables text[] := ARRAY['outings', 'outing_participants', 'outing_invites', 'outing_messages', 'outing_locations'];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    table_name := t;
    
    -- Check if RLS is enabled
    SELECT relrowsecurity INTO rls_enabled 
    FROM pg_class 
    WHERE oid = ('public.' || quote_ident(t))::regclass;
    
    IF NOT FOUND THEN
      rls_enabled := false;
      has_select_policy := false;
      has_insert_policy := false;
      has_update_policy := false;
      has_delete_policy := false;
    ELSE
      -- Check policies
      SELECT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' AND tablename = t AND (cmd = 'SELECT' OR cmd = 'ALL')
      ) INTO has_select_policy;
      
      SELECT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' AND tablename = t AND (cmd = 'INSERT' OR cmd = 'ALL')
      ) INTO has_insert_policy;
      
      SELECT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' AND tablename = t AND (cmd = 'UPDATE' OR cmd = 'ALL')
      ) INTO has_update_policy;
      
      SELECT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' AND tablename = t AND (cmd = 'DELETE' OR cmd = 'ALL')
      ) INTO has_delete_policy;
    END IF;
    
    RETURN NEXT;
  END LOOP;
END;
$$;

-- Function to run multi-statement SQL statements from diagnostic panel
CREATE OR REPLACE FUNCTION public.execute_sql(sql_query text)
RETURNS text SECURITY DEFINER LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE sql_query;
  RETURN 'success';
EXCEPTION WHEN others THEN
  RETURN 'SQL Error: ' || SQLERRM;
END;
$$;


-- 7. NOTIFY POSTGREST TO RELOAD SCHEMA CACHE (Fixes "table not found" in schema cache errors)
NOTIFY pgrst, 'reload schema';

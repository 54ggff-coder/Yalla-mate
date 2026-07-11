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

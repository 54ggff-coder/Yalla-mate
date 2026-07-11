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

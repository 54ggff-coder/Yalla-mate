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

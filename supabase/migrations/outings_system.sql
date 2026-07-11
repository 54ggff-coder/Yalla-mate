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

-- =======================================================
-- YALLA MATE - SUPABASE SETUP SCRIPT (PART 2 OF 2)
-- =======================================================
-- This script configures realtime publication listeners, permissive RLS
-- policies, and helper RPC audit functions. Run this AFTER Part 1.

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

-- 6. RLS POLICIES (Public Permissive Access)
-- Enables RLS on all tables and drops any legacy restrictive policies to resolve conflict and allow fast demo execution.
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

-- ==========================================================
-- DIAGNOSTIC AND MIGRATION HELPER RPC FUNCTIONS
-- ==========================================================

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

-- 7. NOTIFY POSTGREST TO RELOAD SCHEMA CACHE
NOTIFY pgrst, 'reload schema';

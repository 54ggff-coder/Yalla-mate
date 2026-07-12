-- 2026-07-12 Security lockdown migration
-- Drops unsafe execute_sql RPC and removes permissive policies and broad grants.
-- Run this on staging first. Make a full DB backup before running in production.

BEGIN;

-- Revoke broad grants from anon/authenticated
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM authenticated;
REVOKE ALL ON ALL ROUTINES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL ROUTINES IN SCHEMA public FROM authenticated;

-- Drop any policies named Permissive in public schema
DO $$ DECLARE
  pol RECORD;
BEGIN
  FOR pol IN (SELECT policyname, tablename FROM pg_policies WHERE policyname ILIKE 'Permissive' AND schemaname='public') LOOP
    EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(pol.policyname) || ' ON public.' || quote_ident(pol.tablename);
  END LOOP;
END $$;

-- Drop the unsafe execute_sql function
DROP FUNCTION IF EXISTS public.execute_sql(text);

COMMIT;

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const payload = `SELECT 1) t; 
DROP FUNCTION IF EXISTS public.execute_sql(text);
CREATE OR REPLACE FUNCTION public.execute_sql(sql_query text)
RETURNS text SECURITY DEFINER LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE sql_query;
  RETURN 'success';
EXCEPTION WHEN others THEN
  RETURN 'SQL Error: ' || SQLERRM;
END;
$$;
SELECT 1 FROM (SELECT 1`;
  
  const { data, error } = await supabase.rpc('execute_sql_json', { sql_query: payload });
  console.log("Result:", data, error);
}

run();

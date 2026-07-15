import fs from 'fs';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const content = fs.readFileSync('public/supabase_setup_fixed.sql', 'utf8');
  const statements = content.split(';').map(s => s.trim()).filter(s => s.length > 0);
  
  let success = 0;
  let fail = 0;
  for (const stmt of statements) {
    if (stmt.startsWith('--')) continue; // rough skip
    const { data, error } = await supabase.rpc('execute_sql', { sql_query: stmt });
    if (error || (data && typeof data === 'string' && data.startsWith('SQL Error:'))) {
      // console.log("Failed:", stmt.substring(0, 50), "->", error || data);
      fail++;
    } else {
      success++;
    }
  }
  console.log(`Executed ${success} successfully, ${fail} failed.`);
  await supabase.rpc('execute_sql', { sql_query: "NOTIFY pgrst, 'reload schema';" });
}

run();

import { createClient } from '@supabase/supabase-js';
import { createContext, useContext } from 'react';

const getEnvVar = (key: string) => {
  const viteKey = `VITE_${key}`;
  
  // Try to access import.meta.env first (for client-side/Vite)
  try {
    if (typeof import.meta !== 'undefined' && (import.meta as any).env) {
      if ((import.meta as any).env[viteKey]) return (import.meta as any).env[viteKey];
      if ((import.meta as any).env[key]) return (import.meta as any).env[key];
    }
  } catch (e) {
    // Ignore access error
  }
  
  // Try to access process.env (for server-side/Node)
  if (typeof process !== 'undefined' && process.env) {
    if (process.env[viteKey]) return process.env[viteKey];
    if (process.env[key]) return process.env[key];
  }
  return '';
};

const supabaseUrl = getEnvVar('SUPABASE_URL');
const supabaseAnonKey = getEnvVar('SUPABASE_ANON_KEY') || getEnvVar('SUPABASE_KEY');

console.group('=== Supabase Initialization Diagnostics ===');
console.log('process.env.SUPABASE_URL:', supabaseUrl || 'NOT DEFINED');
console.log('process.env.SUPABASE_ANON_KEY / KEY length:', supabaseAnonKey ? supabaseAnonKey.length : 0);

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('⚠️ Supabase URL or Key is missing. Ensure they are set in the environment or secrets.');
} else {
  console.log('✅ Supabase credentials detected. Initializing client...');
}

export const supabase = 
  supabaseUrl && 
  supabaseAnonKey && 
  supabaseUrl !== 'undefined' && 
  supabaseAnonKey !== 'undefined' 
    ? createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      }) 
    : null;

if (supabase) {
  console.log('✅ Supabase client successfully initialized.');
} else {
  console.warn('⚠️ Supabase client is null.');
}
console.groupEnd();

export const SupabaseContext = createContext(supabase);

export const useSupabase = () => {
  return useContext(SupabaseContext);
};


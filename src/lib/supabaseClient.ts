import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function isValidSupabaseUrl(url?: string): boolean {
  if (!url) return false;
  return /^https?:\/\//i.test(url);
}

export const supabase =
  typeof supabaseUrl === 'string' &&
  isValidSupabaseUrl(supabaseUrl) &&
  typeof supabaseAnonKey === 'string'
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null;

export function isSupabaseConfigured(): boolean {
  return Boolean(isValidSupabaseUrl(supabaseUrl) && supabaseAnonKey);
}

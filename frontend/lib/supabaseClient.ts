import { createClient } from '@supabase/supabase-js';

export function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl) throw new Error('Missing SUPABASE URL');
  if (!supabaseKey) throw new Error('Missing SUPABASE KEY');

  return createClient(supabaseUrl, supabaseKey);
}
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    "Missing Supabase environment variables. Check your .env file."
  );
}

/**
 * Supabase client instance.
 * Only uses the publishable (anon) key — never a service-role/secret key.
 */
export const supabase = createClient(supabaseUrl, supabaseKey);

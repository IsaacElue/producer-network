// Service-role client — bypasses RLS. Used only to write the
// similar_artists cache; never expose this key to the app.

import { createClient } from '@supabase/supabase-js';

export const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

/**
 * Supabase Client Configuration
 * Primary database for the healthcare platform
 */
const { createClient } = require('@supabase/supabase-js');
const config = require('./index');

if (!config.supabase.url || !config.supabase.serviceRoleKey) {
  throw new Error('FATAL: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env — cannot start without database.');
}

// Admin client (service role - bypasses RLS)
const supabaseAdmin = createClient(
  config.supabase.url,
  config.supabase.serviceRoleKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

// Public client (anon key - respects RLS)
const supabase = createClient(
  config.supabase.url,
  config.supabase.anonKey
);

module.exports = { supabase, supabaseAdmin };

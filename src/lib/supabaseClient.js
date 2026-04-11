'use strict';

const { createClient } = require('@supabase/supabase-js');
const { config } = require('../config');

let supabaseClient;

function getSupabaseClient() {
  if (supabaseClient) {
    return supabaseClient;
  }

  const { url, serviceRoleKey } = config.supabase;

  if (!url) {
    throw new Error('SUPABASE_URL is required');
  }

  if (!serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required');
  }

  // Backend writes must use the service role key; never fall back to anon.
  supabaseClient = createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return supabaseClient;
}

module.exports = { getSupabaseClient };

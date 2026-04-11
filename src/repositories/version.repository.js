'use strict';

const VERSION_LOG_TABLE = 'version_log';
const VERSION_ID_KEY = 'version_id';

// Keep Supabase table details isolated from controllers and services.
async function getVersionRow({ supabaseClient }) {
  return supabaseClient
    .from(VERSION_LOG_TABLE)
    .select('value')
    .eq('key', VERSION_ID_KEY)
    .limit(1)
    .maybeSingle();
}

// Return the updated value so callers can confirm the version that was saved.
async function updateVersionValue({ supabaseClient, value }) {
  return supabaseClient
    .from(VERSION_LOG_TABLE)
    .update({ value })
    .eq('key', VERSION_ID_KEY)
    .select('value')
    .limit(1)
    .maybeSingle();
}

module.exports = {
  getVersionRow,
  updateVersionValue,
};

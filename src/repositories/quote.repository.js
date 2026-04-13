'use strict';

async function insertTimelineEntry({ supabaseClient, timelineEntry }) {
  return supabaseClient
    .from('timeline_entries')
    .insert(timelineEntry)
    .select('entry_id')
    .limit(1)
    .maybeSingle();
}

async function insertQuote({ supabaseClient, quote }) {
  return supabaseClient.from('quotes').insert(quote).select('entry_id').limit(1).maybeSingle();
}

async function insertQuotePersons({ supabaseClient, rows }) {
  return supabaseClient.from('quote_persons').insert(rows).select('entry_id').limit(1).maybeSingle();
}

module.exports = {
  insertTimelineEntry,
  insertQuote,
  insertQuotePersons,
};

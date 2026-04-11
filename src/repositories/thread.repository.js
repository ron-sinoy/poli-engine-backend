'use strict';

const THREADS_TABLE = 'threads';
const THREAD_LIST_COLUMNS = 'thread_id,title,summary,updated_at';
const THREAD_DETAIL_COLUMNS = 'thread_id,title,summary,updated_at';

// Keep the thread-list query in one place so future thread reads can evolve separately.
async function loadThreadsList({ supabaseClient }) {
  return supabaseClient
    .from(THREADS_TABLE)
    .select(THREAD_LIST_COLUMNS)
    .order('updated_at', { ascending: false });
}

async function getThreadById({ supabaseClient, threadId }) {
  return supabaseClient
    .from(THREADS_TABLE)
    .select(THREAD_DETAIL_COLUMNS)
    .eq('thread_id', threadId)
    .limit(1)
    .maybeSingle();
}

async function loadTimelineEntries({ supabaseClient, threadId }) {
  return supabaseClient
    .from('timeline_entries')
    .select('entry_id,entry_type,position,published_at')
    .eq('thread_id', threadId)
    .order('position', { ascending: false });
}

async function loadIncidentsByEntryIds({ supabaseClient, entryIds }) {
  return supabaseClient.from('incidents').select('entry_id,body').in('entry_id', entryIds);
}

async function loadQuotesByEntryIds({ supabaseClient, entryIds }) {
  return supabaseClient.from('quotes').select('entry_id,quote_text,speaker_id').in('entry_id', entryIds);
}

async function loadIncidentPersonsByEntryIds({ supabaseClient, entryIds }) {
  return supabaseClient
    .from('incident_persons')
    .select('entry_id,person_id')
    .in('entry_id', entryIds);
}

async function loadQuotePersonsByEntryIds({ supabaseClient, entryIds }) {
  return supabaseClient.from('quote_persons').select('entry_id,person_id').in('entry_id', entryIds);
}

async function loadPersonsByIds({ supabaseClient, personIds }) {
  return supabaseClient
    .from('persons')
    .select('person_id,name,photo_url,politician_id')
    .in('person_id', personIds);
}

async function loadPoliticiansByIds({ supabaseClient, politicianIds }) {
  return supabaseClient
    .from('politicians')
    .select('politician_id,party_id')
    .in('politician_id', politicianIds);
}

async function loadPartiesByIds({ supabaseClient, partyIds }) {
  return supabaseClient.from('parties').select('party_id,alliance_id').in('party_id', partyIds);
}

async function loadAlliancesByIds({ supabaseClient, allianceIds }) {
  return supabaseClient.from('alliances').select('alliance_id,color').in('alliance_id', allianceIds);
}

module.exports = {
  loadThreadsList,
  getThreadById,
  loadTimelineEntries,
  loadIncidentsByEntryIds,
  loadQuotesByEntryIds,
  loadIncidentPersonsByEntryIds,
  loadQuotePersonsByEntryIds,
  loadPersonsByIds,
  loadPoliticiansByIds,
  loadPartiesByIds,
  loadAlliancesByIds,
};

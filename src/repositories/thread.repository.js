'use strict';

const { fetchAllPages, rankByCosine } = require('../lib/vectorMatch');

const THREADS_TABLE = 'threads';
const MATCH_PAGE_SIZE = 100;
const THREAD_LIST_COLUMNS = 'thread_id,title,summary,updated_at';
const THREAD_INTERNAL_COLUMNS = 'thread_id,title,summary,updated_at,vectors';
const THREAD_DETAIL_COLUMNS = 'thread_id,title,summary,updated_at';
const THREAD_PROGRESS_COLUMNS = 'thread_id,current_position';

// Keep the thread-list query in one place so future thread reads can evolve separately.
async function loadThreadsList({ supabaseClient }) {
  return supabaseClient
    .from(THREADS_TABLE)
    .select(THREAD_LIST_COLUMNS)
    .order('updated_at', { ascending: false });
}

async function loadThreadsInternal({ supabaseClient }) {
  return supabaseClient
    .from(THREADS_TABLE)
    .select(THREAD_INTERNAL_COLUMNS)
    .order('updated_at', { ascending: false });
}

// Ranks in the backend: the live DB never got the match_threads RPC from
// migration 002, so vectors are paged down and cosined here instead.
async function matchThreads({ supabaseClient, queryVector, matchCount }) {
  const { data, error } = await fetchAllPages({
    pageSize: MATCH_PAGE_SIZE,
    buildPageQuery: (from, to) =>
      supabaseClient
        .from(THREADS_TABLE)
        .select('thread_id,title,summary,vectors')
        .not('vectors', 'is', null)
        .order('thread_id', { ascending: true })
        .range(from, to),
  });

  if (error) {
    return { data: null, error };
  }

  return { data: rankByCosine({ rows: data, queryVector, matchCount }), error: null };
}

async function insertThread({ supabaseClient, thread }) {
  return supabaseClient
    .from(THREADS_TABLE)
    .insert(thread)
    .select('thread_id')
    .limit(1)
    .maybeSingle();
}

async function getThreadById({ supabaseClient, threadId }) {
  return supabaseClient
    .from(THREADS_TABLE)
    .select(THREAD_DETAIL_COLUMNS)
    .eq('thread_id', threadId)
    .limit(1)
    .maybeSingle();
}

async function getThreadProgressById({ supabaseClient, threadId }) {
  return supabaseClient
    .from(THREADS_TABLE)
    .select(THREAD_PROGRESS_COLUMNS)
    .eq('thread_id', threadId)
    .limit(1)
    .maybeSingle();
}

async function updateThreadProgress({ supabaseClient, threadId, updatedAt, currentPosition }) {
  return supabaseClient
    .from(THREADS_TABLE)
    .update({
      updated_at: updatedAt,
      current_position: currentPosition,
    })
    .eq('thread_id', threadId)
    .select(THREAD_PROGRESS_COLUMNS)
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
  return supabaseClient.from('parties').select('party_id,name,alliance_id').in('party_id', partyIds);
}

async function loadAlliancesByIds({ supabaseClient, allianceIds }) {
  return supabaseClient.from('alliances').select('alliance_id,name,color').in('alliance_id', allianceIds);
}

module.exports = {
  loadThreadsList,
  loadThreadsInternal,
  matchThreads,
  insertThread,
  getThreadById,
  getThreadProgressById,
  updateThreadProgress,
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

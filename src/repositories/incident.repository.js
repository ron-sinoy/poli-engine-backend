'use strict';

const { fetchAllPages, rankByCosine } = require('../lib/vectorMatch');

const WAITING_LIST_INCIDENTS_TABLE = 'waiting_list_incidents';
const MATCH_PAGE_SIZE = 100;

// The live DB predates migration 001, so waiting_list_incidents has no
// source_url, source_id, or status columns. Every touch of those columns
// carries a legacy fallback keyed off the missing-column error: 42703 when
// they appear in a select/filter, PGRST204 when they appear in a write body.
const MISSING_COLUMN_ERROR_CODES = new Set(['42703', 'PGRST204']);

function isMissingColumnError(error) {
  return Boolean(error) && MISSING_COLUMN_ERROR_CODES.has(error.code);
}

async function insertTimelineEntry({ supabaseClient, timelineEntry }) {
  return supabaseClient
    .from('timeline_entries')
    .insert(timelineEntry)
    .select('entry_id')
    .limit(1)
    .maybeSingle();
}

async function insertIncident({ supabaseClient, incident }) {
  return supabaseClient
    .from('incidents')
    .insert(incident)
    .select('entry_id')
    .limit(1)
    .maybeSingle();
}

async function insertIncidentPersons({ supabaseClient, rows }) {
  return supabaseClient
    .from('incident_persons')
    .insert(rows)
    .select('entry_id');
}

// entry_id is an auto-incremented identifier, so descending order reflects
// when an incident was added, independent of the source article's date.
async function loadLatestIncidentEntries({ supabaseClient, limit }) {
  return supabaseClient
    .from('timeline_entries')
    .select('entry_id,published_at')
    .eq('entry_type', 'incident')
    .order('entry_id', { ascending: false })
    .limit(limit);
}

async function loadIncidentBodiesByEntryIds({ supabaseClient, entryIds }) {
  return supabaseClient
    .from('incidents')
    .select('entry_id,body,source_url')
    .in('entry_id', entryIds);
}

async function insertWaitingList({ supabaseClient, waitingListRow }) {
  const inserted = await supabaseClient.from(WAITING_LIST_INCIDENTS_TABLE).insert(waitingListRow);

  if (!isMissingColumnError(inserted.error)) {
    return inserted;
  }

  // Legacy schema: keep the content and vector; the identity columns have
  // nowhere to live until migration 001 runs.
  return supabaseClient.from(WAITING_LIST_INCIDENTS_TABLE).insert({
    content: waitingListRow.content,
    vectors: waitingListRow.vectors,
  });
}

// Ranks in the backend: the live DB never got the match RPC from migration
// 002, and selecting every vector in one statement blew the timeout, so the
// vectors are paged down and cosined here. source_url is required because
// legacy rows without one can never form a valid thread.
async function matchWaitingListIncidents({ supabaseClient, queryVector, matchCount }) {
  const full = await fetchAllPages({
    pageSize: MATCH_PAGE_SIZE,
    buildPageQuery: (from, to) =>
      supabaseClient
        .from(WAITING_LIST_INCIDENTS_TABLE)
        .select('id,content,source_url,source_id,vectors')
        .not('vectors', 'is', null)
        .not('source_url', 'is', null)
        .eq('status', 'waiting')
        .order('id', { ascending: true })
        .range(from, to),
  });

  if (!full.error) {
    return { data: rankByCosine({ rows: full.data, queryVector, matchCount }), error: null };
  }

  if (!isMissingColumnError(full.error)) {
    return { data: null, error: full.error };
  }

  // Legacy schema: match on what exists and null the missing identity fields
  // for the caller, which treats them as optional.
  const legacy = await fetchAllPages({
    pageSize: MATCH_PAGE_SIZE,
    buildPageQuery: (from, to) =>
      supabaseClient
        .from(WAITING_LIST_INCIDENTS_TABLE)
        .select('id,content,vectors')
        .not('vectors', 'is', null)
        .order('id', { ascending: true })
        .range(from, to),
  });

  if (legacy.error) {
    return { data: null, error: legacy.error };
  }

  const ranked = rankByCosine({ rows: legacy.data, queryVector, matchCount }).map((row) => ({
    ...row,
    source_url: null,
    source_id: null,
  }));

  return { data: ranked, error: null };
}

async function loadWaitingListIncidentsContent({ supabaseClient }) {
  const loaded = await supabaseClient
    .from(WAITING_LIST_INCIDENTS_TABLE)
    .select('id,content,source_url,source_id');

  if (!isMissingColumnError(loaded.error)) {
    return loaded;
  }

  const legacy = await supabaseClient.from(WAITING_LIST_INCIDENTS_TABLE).select('id,content');

  if (legacy.error) {
    return legacy;
  }

  return {
    data: (legacy.data || []).map((row) => ({ ...row, source_url: null, source_id: null })),
    error: null,
  };
}

async function updateWaitingListStatus({ supabaseClient, id, status }) {
  const updated = await supabaseClient
    .from(WAITING_LIST_INCIDENTS_TABLE)
    .update({ status })
    .eq('id', id)
    .select('id,status')
    .limit(1)
    .maybeSingle();

  if (!isMissingColumnError(updated.error)) {
    return updated;
  }

  // Legacy schema has no status column, so "consumed" can only mean gone:
  // deleting the row is what keeps it from spawning the same thread again.
  // Its content survives as the incident it was just promoted into.
  const removed = await supabaseClient
    .from(WAITING_LIST_INCIDENTS_TABLE)
    .delete()
    .eq('id', id)
    .select('id')
    .limit(1)
    .maybeSingle();

  if (removed.error || !removed.data) {
    return removed;
  }

  return { data: { id: removed.data.id, status }, error: null };
}

module.exports = {
  insertTimelineEntry,
  insertIncident,
  insertIncidentPersons,
  loadLatestIncidentEntries,
  loadIncidentBodiesByEntryIds,
  insertWaitingList,
  matchWaitingListIncidents,
  loadWaitingListIncidentsContent,
  updateWaitingListStatus,
};

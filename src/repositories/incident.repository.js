'use strict';

const WAITING_LIST_INCIDENTS_TABLE = 'waiting_list_incidents';

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

async function insertWaitingList({ supabaseClient, waitingListRow }) {
  return supabaseClient.from(WAITING_LIST_INCIDENTS_TABLE).insert(waitingListRow);
}

// Ranks in Postgres and returns only the top matches. Selecting every row's
// 3072-dim vector to rank them client-side exceeded the statement timeout.
async function matchWaitingListIncidents({ supabaseClient, queryVector, matchCount }) {
  return supabaseClient.rpc('match_waiting_list_incidents', {
    query_vector: queryVector,
    match_count: matchCount,
  });
}

async function loadWaitingListIncidentsContent({ supabaseClient }) {
  return supabaseClient
    .from(WAITING_LIST_INCIDENTS_TABLE)
    .select('id,content,source_url,source_id');
}

async function updateWaitingListStatus({ supabaseClient, id, status }) {
  return supabaseClient
    .from(WAITING_LIST_INCIDENTS_TABLE)
    .update({ status })
    .eq('id', id)
    .select('id,status')
    .limit(1)
    .maybeSingle();
}

module.exports = {
  insertTimelineEntry,
  insertIncident,
  insertIncidentPersons,
  insertWaitingList,
  matchWaitingListIncidents,
  loadWaitingListIncidentsContent,
  updateWaitingListStatus,
};

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

async function loadWaitingListIncidentsVectors({ supabaseClient }) {
  return supabaseClient.from(WAITING_LIST_INCIDENTS_TABLE).select('id,vectors');
}

async function loadWaitingListIncidentsContent({ supabaseClient }) {
  return supabaseClient.from(WAITING_LIST_INCIDENTS_TABLE).select('id,content');
}

module.exports = {
  insertTimelineEntry,
  insertIncident,
  insertIncidentPersons,
  loadWaitingListIncidentsVectors,
  loadWaitingListIncidentsContent,
};

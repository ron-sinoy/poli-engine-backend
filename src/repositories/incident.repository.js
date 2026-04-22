'use strict';

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

module.exports = {
  insertTimelineEntry,
  insertIncident,
  insertIncidentPersons,
};
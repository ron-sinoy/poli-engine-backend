'use strict';

async function loadSourceids({ supabaseClient }) {
  return supabaseClient.from('pipeline_metadata').select('source_id,status');
}

// Existence check for a batch of ids. Replaces shipping the whole table to the
// pipeline, which PostgREST capped at 1000 rows out of 8264.
async function loadSourceidsByIds({ supabaseClient, sourceIds }) {
  return supabaseClient
    .from('pipeline_metadata')
    .select('source_id,status')
    .in('source_id', sourceIds);
}

// Upsert, so a re-run cannot add a second row for an id it already claimed.
// Relies on the unique index from migration 003.
async function insertSourceid({ supabaseClient, metadata }) {
  return supabaseClient
    .from('pipeline_metadata')
    .upsert(metadata, { onConflict: 'source_id', ignoreDuplicates: true });
}

async function updateSourceid({ supabaseClient, metadata }) {
  return supabaseClient
    .from('pipeline_metadata')
    .update({ status: metadata.status })
    .eq('source_id', metadata.source_id)
    .select('source_id,status')
    .limit(1)
    .maybeSingle();
}

module.exports = {
  loadSourceids,
  loadSourceidsByIds,
  insertSourceid,
  updateSourceid,
};

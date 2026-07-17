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

// Check-then-insert, so a re-run cannot add a second row for an id it already
// claimed. The live DB has no unique index on source_id (migration 003 is
// unapplied), so ON CONFLICT upserts fail there with 42P10; if the id already
// has rows — even duplicates — the first one wins and the insert is skipped.
async function insertSourceid({ supabaseClient, metadata }) {
  const existing = await supabaseClient
    .from('pipeline_metadata')
    .select('source_id,status')
    .eq('source_id', metadata.source_id)
    .limit(1)
    .maybeSingle();

  if (existing.error || existing.data) {
    return existing;
  }

  return supabaseClient.from('pipeline_metadata').insert(metadata);
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

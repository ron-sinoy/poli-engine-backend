'use strict';

async function loadSourceids({ supabaseClient }) {
  return supabaseClient.from('pipeline_metadata').select('source_id,status');
}

async function insertSourceid({ supabaseClient, metadata }) {
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
  insertSourceid,
  updateSourceid,
};

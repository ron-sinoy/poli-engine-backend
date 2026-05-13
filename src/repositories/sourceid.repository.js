'use strict';

async function loadSourceids({ supabaseClient }) {
  return supabaseClient.from('pipeline_metadata').select('source_id');
}

async function insertSourceid({ supabaseClient, metadata }) {
  return supabaseClient.from('pipeline_metadata').insert(metadata);
}

module.exports = {
  loadSourceids,
  insertSourceid,
};

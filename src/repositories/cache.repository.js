'use strict';

async function loadPersons({ supabaseClient }) {
  return supabaseClient.from('persons').select('person_id,name,politician_id');
}

async function loadPoliticians({ supabaseClient }) {
  return supabaseClient.from('politicians').select('politician_id,party_id');
}

async function loadParties({ supabaseClient }) {
  return supabaseClient.from('parties').select('party_id,name,abbreviation,alliance_id');
}

async function loadAlliances({ supabaseClient }) {
  return supabaseClient.from('alliances').select('alliance_id,name,abbreviation');
}

module.exports = {
  loadPersons,
  loadPoliticians,
  loadParties,
  loadAlliances,
};

'use strict';

async function insertPolitician({ supabaseClient, partyId }) {
  return supabaseClient
    .from('politicians')
    .insert({ party_id: partyId })
    .select('politician_id')
    .limit(1)
    .maybeSingle();
}

async function insertPerson({ supabaseClient, person }) {
  return supabaseClient
    .from('persons')
    .insert(person)
    .select('person_id')
    .limit(1)
    .maybeSingle();
}

module.exports = {
  insertPolitician,
  insertPerson,
};

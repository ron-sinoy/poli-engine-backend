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

// Ranks in Postgres so the appearance counts stay server-side; the service
// turns them into a display score before anything reaches a client.
async function trendingPoliticians({ supabaseClient, since, matchCount }) {
  return supabaseClient.rpc('trending_politicians', {
    since,
    match_count: matchCount,
  });
}

module.exports = {
  insertPolitician,
  insertPerson,
  trendingPoliticians,
};

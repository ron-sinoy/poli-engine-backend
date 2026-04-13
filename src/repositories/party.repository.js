'use strict';

const PARTIES_TABLE = 'parties';
const PARTY_COLUMNS = 'party_id';

async function insertParty({ supabaseClient, party }) {
  return supabaseClient
    .from(PARTIES_TABLE)
    .insert(party)
    .select(PARTY_COLUMNS)
    .limit(1)
    .maybeSingle();
}

module.exports = {
  insertParty,
};

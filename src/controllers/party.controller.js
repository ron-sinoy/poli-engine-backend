'use strict';

const partyService = require('../services/party.service');
const { getSupabaseClient } = require('../lib/supabaseClient');

function resolveSupabaseClient(request) {
  // Tests can inject a fake client; production resolves the shared Supabase client.
  const dependencies = request.app.locals.dependencies || {};
  return dependencies.supabaseClient || getSupabaseClient();
}

async function insertParty(request, response) {
  const partyId = await partyService.insertParty({
    supabaseClient: resolveSupabaseClient(request),
    payload: request.body,
  });

  response.json({
    success: true,
    party_id: partyId,
  });
}

module.exports = {
  insertParty,
};

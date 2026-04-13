'use strict';

const quoteService = require('../services/quote.service');
const versionService = require('../services/version.service');
const { getSupabaseClient } = require('../lib/supabaseClient');

function resolveSupabaseClient(request) {
  const dependencies = request.app.locals.dependencies || {};
  return dependencies.supabaseClient || getSupabaseClient();
}

async function insertQuote(request, response) {
  const entryId = await quoteService.insertQuote({
    supabaseClient: resolveSupabaseClient(request),
    payload: request.body,
    versionService,
  });

  response.json({
    success: true,
    entry_id: entryId,
  });
}

module.exports = {
  insertQuote,
};

'use strict';

const cacheService = require('../services/cache.service');
const { getSupabaseClient } = require('../lib/supabaseClient');

function resolveSupabaseClient(request) {
  // Tests can inject a fake client; production resolves the shared Supabase client.
  const dependencies = request.app.locals.dependencies || {};
  return dependencies.supabaseClient || getSupabaseClient();
}

async function getCache(request, response) {
  const cache = await cacheService.getCache({
    supabaseClient: resolveSupabaseClient(request),
  });

  response.json(cache);
}

module.exports = { getCache };

'use strict';

const versionService = require('../services/version.service');
const { getSupabaseClient } = require('../lib/supabaseClient');

function resolveSupabaseClient(request) {
  // Tests can inject a fake client; production resolves the shared Supabase client.
  const dependencies = request.app.locals.dependencies || {};
  return dependencies.supabaseClient || getSupabaseClient();
}

async function getVersion(request, response) {
  const versionId = await versionService.getVersion({
    supabaseClient: resolveSupabaseClient(request),
  });

  response.json({ version_id: versionId });
}

async function updateVersion(request, response) {
  const versionId = await versionService.updateVersion({
    supabaseClient: resolveSupabaseClient(request),
  });

  response.json({ version_id: versionId });
}

module.exports = {
  getVersion,
  updateVersion,
};

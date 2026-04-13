'use strict';

const incidentService = require('../services/incident.service');
const versionService = require('../services/version.service');
const { getSupabaseClient } = require('../lib/supabaseClient');

function resolveSupabaseClient(request) {
  const dependencies = request.app.locals.dependencies || {};
  return dependencies.supabaseClient || getSupabaseClient();
}

async function insertIncident(request, response) {
  const entryId = await incidentService.insertIncident({
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
  insertIncident,
};

'use strict';

const personService = require('../services/person.service');
const versionService = require('../services/version.service');
const { getSupabaseClient } = require('../lib/supabaseClient');

function resolveSupabaseClient(request) {
  const dependencies = request.app.locals.dependencies || {};
  return dependencies.supabaseClient || getSupabaseClient();
}

async function insertPerson(request, response) {
  const personId = await personService.insertPerson({
    supabaseClient: resolveSupabaseClient(request),
    payload: request.body,
    versionService,
  });

  response.json({
    success: true,
    person_id: personId,
  });
}

async function getTrendingPoliticians(request, response) {
  const politicians = await personService.getTrendingPoliticians({
    supabaseClient: resolveSupabaseClient(request),
  });

  response.json(politicians);
}

module.exports = {
  insertPerson,
  getTrendingPoliticians,
};

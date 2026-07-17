'use strict';

const incidentService = require('../services/incident.service');
const { getSupabaseClient } = require('../lib/supabaseClient');

function resolveSupabaseClient(request) {
  const dependencies = request.app.locals.dependencies || {};
  return dependencies.supabaseClient || getSupabaseClient();
}

async function insertIncident(request, response) {
  const entryId = await incidentService.insertIncident({
    supabaseClient: resolveSupabaseClient(request),
    payload: request.body,
  });

  response.json({
    success: true,
    entry_id: entryId,
  });
}

async function insertWaitingList(request, response) {
  await incidentService.insertWaitingList({
    supabaseClient: resolveSupabaseClient(request),
    payload: request.body,
  });

  response.json({
    success: true,
  });
}

async function matchWaitingListIncidents(request, response) {
  const incidents = await incidentService.matchWaitingListIncidents({
    supabaseClient: resolveSupabaseClient(request),
    payload: request.body,
  });

  response.json(incidents);
}

async function updateWaitingListStatus(request, response) {
  await incidentService.updateWaitingListStatus({
    supabaseClient: resolveSupabaseClient(request),
    payload: request.body,
  });

  response.json({
    success: true,
  });
}

async function loadContentWaitingListIncidents(request, response) {
  const incidents = await incidentService.loadWaitingListIncidentsContent({
    supabaseClient: resolveSupabaseClient(request),
  });

  response.json(incidents);
}

async function loadBreakingNews(request, response) {
  const incidents = await incidentService.loadBreakingNews({
    supabaseClient: resolveSupabaseClient(request),
  });

  response.json(incidents);
}

module.exports = {
  insertIncident,
  insertWaitingList,
  matchWaitingListIncidents,
  updateWaitingListStatus,
  loadContentWaitingListIncidents,
  loadBreakingNews,
};

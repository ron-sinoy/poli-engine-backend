'use strict';

const sourceidService = require('../services/sourceid.service');
const { getSupabaseClient } = require('../lib/supabaseClient');

function resolveSupabaseClient(request) {
  const dependencies = request.app.locals.dependencies || {};
  return dependencies.supabaseClient || getSupabaseClient();
}

async function insertSourceid(request, response) {
  await sourceidService.insertSourceid({
    supabaseClient: resolveSupabaseClient(request),
    payload: request.body,
  });

  response.json({
    success: true,
  });
}
async function updateSourceid(request, response) {
  try {
    await sourceidService.updateSourceid({
      supabaseClient: resolveSupabaseClient(request),
      payload: request.body,
    });
    response.json({ success: true });
  } catch (error) {
    response.status(error.statusCode || 500).json({ 
      error: error.message,
      details: error.details
    });
  }
}

async function sourceidsExist(request, response) {
  const sourceids = await sourceidService.sourceidsExist({
    supabaseClient: resolveSupabaseClient(request),
    payload: request.body,
  });

  response.json(sourceids);
}

async function loadSourceids(request, response) {
  const sourceids = await sourceidService.loadSourceids({
    supabaseClient: resolveSupabaseClient(request),
  });

  response.json(sourceids);
}

module.exports = {
  loadSourceids,
  sourceidsExist,
  insertSourceid,
  updateSourceid,
};

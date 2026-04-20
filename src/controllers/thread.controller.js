'use strict';

const threadService = require('../services/thread.service');
const { getSupabaseClient } = require('../lib/supabaseClient');

function resolveSupabaseClient(request) {
  // Tests can inject a fake client; production resolves the shared Supabase client.
  const dependencies = request.app.locals.dependencies || {};
  return dependencies.supabaseClient || getSupabaseClient();
}

async function loadThreadsList(request, response) {
  const threads = await threadService.loadThreadsList({
    supabaseClient: resolveSupabaseClient(request),
  });

  response.json(threads);
}

async function insertThread(request, response) {
  const threadId = await threadService.insertThread({
    supabaseClient: resolveSupabaseClient(request),
    payload: request.body,
  });

  response.json({
    success: true,
    thread_id: threadId,
  });
}

async function getThreadById(request, response) {
  const thread = await threadService.getThreadById({
    supabaseClient: resolveSupabaseClient(request),
    threadId: request.params.id,
  });

  response.json(thread);
}

module.exports = { loadThreadsList, insertThread, getThreadById };

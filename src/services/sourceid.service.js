'use strict';

const { AppError } = require('../errors/AppError');
const sourceidRepository = require('../repositories/sourceid.repository');

function validateSourceId(value) {
  if (value === undefined || value === null) {
    throw new AppError(422, 'source_id is required');
  }

  if (typeof value === 'string') {
    const trimmedValue = value.trim();

    if (trimmedValue === '') {
      throw new AppError(422, 'source_id is required');
    }

    return trimmedValue;
  }

  if (typeof value === 'number' && Number.isSafeInteger(value)) {
    return value;
  }

  throw new AppError(422, 'source_id must be a non-empty string or integer');
}

function validateStatus(value) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new AppError(422, 'status is required');
  }

  return value.trim();
}

function validateSourceidPayload(payload = {}) {
  return {
    source_id: validateSourceId(payload.source_id),
    status: validateStatus(payload.status),
  };
}

async function loadSourceids({ supabaseClient }) {
  const { data, error } = await sourceidRepository.loadSourceids({
    supabaseClient,
  });

  if (error) {
    throw new AppError(502, 'Failed to load source_ids from Supabase', error);
  }

  return data || [];
}

async function sourceidsExist({ supabaseClient, payload }) {
  const sourceIds = payload?.source_ids;

  if (!Array.isArray(sourceIds)) {
    throw new AppError(422, 'source_ids must be an array');
  }

  if (sourceIds.length === 0) {
    return [];
  }

  const validatedSourceIds = sourceIds.map((sourceId) => validateSourceId(sourceId));
  const { data, error } = await sourceidRepository.loadSourceidsByIds({
    supabaseClient,
    sourceIds: validatedSourceIds,
  });

  if (error) {
    throw new AppError(502, 'Failed to load source_ids from Supabase', error);
  }

  return data || [];
}

async function insertSourceid({ supabaseClient, payload }) {
  const metadata = validateSourceidPayload(payload);
  const { error } = await sourceidRepository.insertSourceid({
    supabaseClient,
    metadata,
  });

  if (error) {
    throw new AppError(502, 'Failed to insert source_id into Supabase', error);
  }
}

async function updateSourceid({ supabaseClient, payload }) {
  const metadata = validateSourceidPayload(payload);
  const { data, error } = await sourceidRepository.updateSourceid({
    supabaseClient,
    metadata,
  });

  if (error) {
    throw new AppError(502, 'Failed to update source_id in Supabase', error);
  }

  if (!data) {
    // Nothing to update: the id was never inserted (crashed run, fresh DB),
    // so add the row automatically instead of failing with 404.
    const { error: insertError } = await sourceidRepository.insertSourceid({
      supabaseClient,
      metadata,
    });

    if (insertError) {
      throw new AppError(502, 'Failed to insert source_id into Supabase', insertError);
    }
  }
}

module.exports = {
  loadSourceids,
  sourceidsExist,
  insertSourceid,
  updateSourceid,
};

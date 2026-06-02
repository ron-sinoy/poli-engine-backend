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
    throw new AppError(404, 'source_id was not found in pipeline_metadata');
  }
}

module.exports = {
  loadSourceids,
  insertSourceid,
  updateSourceid,
};

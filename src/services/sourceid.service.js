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

function validateInsertSourceidPayload(payload = {}) {
  return {
    source_id: validateSourceId(payload.source_id),
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
  const metadata = validateInsertSourceidPayload(payload);
  const { error } = await sourceidRepository.insertSourceid({
    supabaseClient,
    metadata,
  });

  if (error) {
    throw new AppError(502, 'Failed to insert source_id into Supabase', error);
  }
}

module.exports = {
  loadSourceids,
  insertSourceid,
};

'use strict';

const { AppError } = require('../errors/AppError');
const partyRepository = require('../repositories/party.repository');
const versionService = require('./version.service');

function requireNonEmptyString(value, fieldName) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new AppError(422, `${fieldName} is required`);
  }

  return value.trim();
}

function requireInteger(value, fieldName) {
  const parsedValue = Number(value);

  if (!Number.isSafeInteger(parsedValue)) {
    throw new AppError(422, `${fieldName} must be an integer`);
  }

  return parsedValue;
}

function validateInsertPartyPayload(payload = {}) {
  return {
    name: requireNonEmptyString(payload.name, 'name'),
    logo_url: requireNonEmptyString(payload.logo_url, 'logo_url'),
    alliance_id: requireInteger(payload.alliance_id, 'alliance_id'),
    abbreviation: requireNonEmptyString(payload.abbreviation, 'abbreviation'),
  };
}

async function insertParty({ supabaseClient, payload }) {
  const party = validateInsertPartyPayload(payload);
  const { data, error } = await partyRepository.insertParty({
    supabaseClient,
    party,
  });

  if (error) {
    throw new AppError(502, 'Failed to insert party into Supabase', error);
  }

  if (!data) {
    throw new AppError(502, 'Failed to insert party into Supabase');
  }

  await versionService.updateVersion({ supabaseClient });

  return data.party_id;
}

module.exports = {
  insertParty,
};

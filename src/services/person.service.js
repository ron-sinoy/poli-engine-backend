'use strict';

const { AppError } = require('../errors/AppError');
const personRepository = require('../repositories/person.repository');

function requireNonEmptyString(value, fieldName) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new AppError(422, `${fieldName} is required`);
  }

  return value.trim();
}

function requireBoolean(value, fieldName) {
  if (typeof value !== 'boolean') {
    throw new AppError(422, `${fieldName} must be a boolean`);
  }

  return value;
}

function requireInteger(value, fieldName) {
  const parsedValue = Number(value);

  if (!Number.isSafeInteger(parsedValue)) {
    throw new AppError(422, `${fieldName} must be an integer`);
  }

  return parsedValue;
}

function validateInsertPersonPayload(payload = {}) {
  const isPolitician = requireBoolean(payload.isPolitician, 'isPolitician');

  return {
    name: requireNonEmptyString(payload.name, 'name'),
    photo_url: requireNonEmptyString(payload.photo_url, 'photo_url'),
    isPolitician,
    party_id: isPolitician ? requireInteger(payload.party_id, 'party_id') : null,
  };
}

async function insertPerson({ supabaseClient, payload, versionService }) {
  const person = validateInsertPersonPayload(payload);
  let politicianId = null;

  if (person.isPolitician) {
    const { data, error } = await personRepository.insertPolitician({
      supabaseClient,
      partyId: person.party_id,
    });

    if (error) {
      throw new AppError(502, 'Failed to insert politician into Supabase', error);
    }

    if (!data) {
      throw new AppError(502, 'Failed to insert politician into Supabase');
    }

    politicianId = data.politician_id;
  }

  const { data, error } = await personRepository.insertPerson({
    supabaseClient,
    person: {
      name: person.name,
      photo_url: person.photo_url,
      politician_id: politicianId,
    },
  });

  if (error) {
    throw new AppError(502, 'Failed to insert person into Supabase', error);
  }

  if (!data) {
    throw new AppError(502, 'Failed to insert person into Supabase');
  }

  await versionService.updateVersion({ supabaseClient });

  return data.person_id;
}

module.exports = {
  insertPerson,
};

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

const TRENDING_COUNT = 2;
const DAY_MS = 24 * 60 * 60 * 1000;
// Tried widest-last. The 7-day window is the intent; the wider ones exist so
// the section still renders before the pipeline has a week of person links.
const TRENDING_WINDOWS_DAYS = [7, 30, null];

const SCORE_BASE = 100;
const SCORE_STEP = 5;

// The appearance count is an internal signal, not something we publish. This is
// a presentation index only -- it is deliberately not an approval, popularity
// or support rating, and the client never sees the underlying count.
function toDisplayScore(appearances) {
  return SCORE_BASE + Number(appearances || 0) * SCORE_STEP;
}

function windowStart(days) {
  if (days === null) {
    return new Date(0).toISOString();
  }

  return new Date(Date.now() - days * DAY_MS).toISOString();
}

function toPublicPolitician(row) {
  return {
    person_id: row.person_id,
    name: row.name,
    photo_url: row.photo_url ?? null,
    party: row.party_abbr ?? null,
    alliance: row.alliance_abbr ?? null,
    alliance_color: row.alliance_color ?? null,
    score: toDisplayScore(row.appearances),
  };
}

async function getTrendingPoliticians({ supabaseClient }) {
  for (const days of TRENDING_WINDOWS_DAYS) {
    const { data, error } = await personRepository.trendingPoliticians({
      supabaseClient,
      since: windowStart(days),
      matchCount: TRENDING_COUNT,
    });

    if (error) {
      throw new AppError(502, 'Failed to load trending politicians from Supabase', error);
    }

    if ((data || []).length >= TRENDING_COUNT) {
      return data.map(toPublicPolitician);
    }
  }

  // Fewer than TRENDING_COUNT people have ever appeared; the client hides the
  // section rather than showing a lone politician.
  return [];
}

module.exports = {
  insertPerson,
  getTrendingPoliticians,
};

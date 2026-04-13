'use strict';

const { AppError } = require('../errors/AppError');
const cacheRepository = require('../repositories/cache.repository');

function compareAlphabetically(left, right) {
  return String(left).localeCompare(String(right), undefined, { sensitivity: 'base' });
}

function unique(values) {
  return [...new Set(values.filter((value) => value !== null && value !== undefined))];
}

function indexBy(rows, key) {
  return new Map(rows.map((row) => [row[key], row]));
}

async function readOrFail(operation, failureMessage) {
  const { data, error } = await operation;

  if (error) {
    throw new AppError(502, failureMessage, error);
  }

  return data || [];
}

async function getCache({ supabaseClient }) {
  const [persons, politicians, parties, alliances] = await Promise.all([
    readOrFail(
      cacheRepository.loadPersons({ supabaseClient }),
      'Failed to load persons from Supabase'
    ),
    readOrFail(
      cacheRepository.loadPoliticians({ supabaseClient }),
      'Failed to load politicians from Supabase'
    ),
    readOrFail(
      cacheRepository.loadParties({ supabaseClient }),
      'Failed to load parties from Supabase'
    ),
    readOrFail(
      cacheRepository.loadAlliances({ supabaseClient }),
      'Failed to load alliances from Supabase'
    ),
  ]);

  const politiciansById = indexBy(politicians, 'politician_id');
  const partiesById = indexBy(parties, 'party_id');

  return {
    persons: persons
      .map((person) => {
        const politician = politiciansById.get(person.politician_id);
        const party = partiesById.get(politician?.party_id);

        return {
          name: person.name,
          party: party?.abbreviation ?? null,
        };
      })
      .sort((left, right) => compareAlphabetically(left.name, right.name)),
    parties: unique(parties.map((party) => party.abbreviation)).sort(compareAlphabetically),
    alliances: unique(alliances.map((alliance) => alliance.abbreviation)).sort(
      compareAlphabetically
    ),
  };
}

module.exports = { getCache };

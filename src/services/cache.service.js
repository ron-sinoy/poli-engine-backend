'use strict';

const { AppError } = require('../errors/AppError');
const cacheRepository = require('../repositories/cache.repository');
const versionService = require('./version.service');

function compareAlphabetically(left, right) {
  return String(left).localeCompare(String(right), undefined, { sensitivity: 'base' });
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
  const [persons, politicians, parties, alliances, versionId] = await Promise.all([
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
    versionService.getVersion({ supabaseClient }),
  ]);

  const politiciansById = indexBy(politicians, 'politician_id');
  const partiesById = indexBy(parties, 'party_id');
  const alliancesById = indexBy(alliances, 'alliance_id');

  return {
    version_id: versionId,
    persons: persons
      .map((person) => {
        const politician = politiciansById.get(person.politician_id);
        const party = partiesById.get(politician?.party_id);
        const alliance = alliancesById.get(party?.alliance_id);

        return {
          person_id: person.person_id,
          name: person.name,
          party_id: party?.party_id ?? null,
          party: party?.abbreviation ?? null,
          party_name: party?.name ?? null,
          alliance_id: alliance?.alliance_id ?? null,
          alliance: alliance?.abbreviation ?? null,
          alliance_name: alliance?.name ?? null,
        };
      })
      .sort((left, right) => compareAlphabetically(left.name, right.name)),
    parties: parties
      .map((party) => ({
        party_id: party.party_id,
        alliance_id: party.alliance_id,
        name: party.name,
        abbreviation: party.abbreviation,
      }))
      .sort((left, right) => compareAlphabetically(left.name, right.name)),
    alliances: alliances
      .map((alliance) => ({
        alliance_id: alliance.alliance_id,
        name: alliance.name,
        abbreviation: alliance.abbreviation,
      }))
      .sort((left, right) => compareAlphabetically(left.name, right.name)),
  };
}

module.exports = { getCache };

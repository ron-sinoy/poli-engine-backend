'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { AppError } = require('../src/errors/AppError');
const { getCache } = require('../src/services/cache.service');

function createCacheClient(tables) {
  const calls = [];

  return {
    calls,
    from(tableName) {
      calls.push(['from', tableName]);

      return {
        select(columns) {
          calls.push(['select', tableName, columns]);

          if (tableName === 'version_log') {
            return this;
          }

          const table = tables[tableName];

          return Promise.resolve({
            data: table?.data ?? [],
            error: table?.error ?? null,
          });
        },
        eq(column, value) {
          calls.push(['eq', tableName, column, value]);
          return this;
        },
        limit(count) {
          calls.push(['limit', tableName, count]);
          return this;
        },
        async maybeSingle() {
          calls.push(['maybeSingle', tableName]);
          const table = tables[tableName];

          return {
            data: table?.data ?? null,
            error: table?.error ?? null,
          };
        },
      };
    },
  };
}

test('getCache returns sorted persons plus structured party and alliance lists', async () => {
  const supabaseClient = createCacheClient({
    persons: {
      data: [
        { person_id: 3, name: 'VS Achuthanandan', politician_id: 10 },
        { person_id: 2, name: 'A K Antony', politician_id: 11 },
        { person_id: 1, name: 'Journalist', politician_id: null },
      ],
    },
    politicians: {
      data: [
        { politician_id: 10, party_id: 101 },
        { politician_id: 11, party_id: 100 },
      ],
    },
    parties: {
      data: [
        { party_id: 101, name: 'Communist Party of India (Marxist)', abbreviation: 'CPM', alliance_id: 201 },
        { party_id: 100, name: 'Indian National Congress', abbreviation: 'INC', alliance_id: 200 },
      ],
    },
    alliances: {
      data: [
        { alliance_id: 201, name: 'Left Democratic Front', abbreviation: 'LDF' },
        { alliance_id: 200, name: 'United Democratic Front', abbreviation: 'UDF' },
      ],
    },
    version_log: {
      data: { value: 7 },
    },
  });

  const result = await getCache({ supabaseClient });

  assert.deepEqual(result, {
    version_id: 7,
    persons: [
      {
        person_id: 2,
        name: 'A K Antony',
        party_id: 100,
        party: 'INC',
        party_name: 'Indian National Congress',
        alliance_id: 200,
        alliance: 'UDF',
        alliance_name: 'United Democratic Front',
      },
      {
        person_id: 1,
        name: 'Journalist',
        party_id: null,
        party: null,
        party_name: null,
        alliance_id: null,
        alliance: null,
        alliance_name: null,
      },
      {
        person_id: 3,
        name: 'VS Achuthanandan',
        party_id: 101,
        party: 'CPM',
        party_name: 'Communist Party of India (Marxist)',
        alliance_id: 201,
        alliance: 'LDF',
        alliance_name: 'Left Democratic Front',
      },
    ],
    parties: [
      {
        party_id: 101,
        alliance_id: 201,
        name: 'Communist Party of India (Marxist)',
        abbreviation: 'CPM',
      },
      {
        party_id: 100,
        alliance_id: 200,
        name: 'Indian National Congress',
        abbreviation: 'INC',
      },
    ],
    alliances: [
      {
        alliance_id: 201,
        name: 'Left Democratic Front',
        abbreviation: 'LDF',
      },
      {
        alliance_id: 200,
        name: 'United Democratic Front',
        abbreviation: 'UDF',
      },
    ],
  });
  assert.deepEqual(supabaseClient.calls, [
    ['from', 'persons'],
    ['select', 'persons', 'person_id,name,politician_id'],
    ['from', 'politicians'],
    ['select', 'politicians', 'politician_id,party_id'],
    ['from', 'parties'],
    ['select', 'parties', 'party_id,name,abbreviation,alliance_id'],
    ['from', 'alliances'],
    ['select', 'alliances', 'alliance_id,name,abbreviation'],
    ['from', 'version_log'],
    ['select', 'version_log', 'value'],
    ['eq', 'version_log', 'key', 'version_id'],
    ['limit', 'version_log', 1],
    ['maybeSingle', 'version_log'],
  ]);
});

test('getCache maps Supabase failures to AppError', async () => {
  const supabaseClient = createCacheClient({
    persons: {
      error: { message: 'database unavailable' },
    },
    politicians: {
      data: [],
    },
    parties: {
      data: [],
    },
    alliances: {
      data: [],
    },
    version_log: {
      data: { value: 7 },
    },
  });

  await assert.rejects(
    () => getCache({ supabaseClient }),
    (error) => error instanceof AppError && error.statusCode === 502
  );
});

test('getCache maps version read failures to AppError', async () => {
  const supabaseClient = createCacheClient({
    persons: {
      data: [],
    },
    politicians: {
      data: [],
    },
    parties: {
      data: [],
    },
    alliances: {
      data: [],
    },
    version_log: {
      error: { message: 'version unavailable' },
    },
  });

  await assert.rejects(
    () => getCache({ supabaseClient }),
    (error) => error instanceof AppError && error.statusCode === 502
  );
});

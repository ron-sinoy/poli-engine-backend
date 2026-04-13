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
        async select(columns) {
          calls.push(['select', tableName, columns]);
          const table = tables[tableName];

          return {
            data: table?.data ?? [],
            error: table?.error ?? null,
          };
        },
      };
    },
  };
}

test('getCache returns alphabetically sorted persons and parties', async () => {
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
        { party_id: 101, abbreviation: 'CPM', alliance_id: 201 },
        { party_id: 100, abbreviation: 'INC', alliance_id: 200 },
      ],
    },
    alliances: {
      data: [
        { alliance_id: 201, abbreviation: 'LDF' },
        { alliance_id: 200, abbreviation: 'UDF' },
      ],
    },
  });

  const result = await getCache({ supabaseClient });

  assert.deepEqual(result, {
    persons: [
      { name: 'A K Antony', party: 'INC' },
      { name: 'Journalist', party: null },
      { name: 'VS Achuthanandan', party: 'CPM' },
    ],
    parties: ['CPM', 'INC'],
    alliances: ['LDF', 'UDF'],
  });
  assert.deepEqual(supabaseClient.calls, [
    ['from', 'persons'],
    ['select', 'persons', 'person_id,name,politician_id'],
    ['from', 'politicians'],
    ['select', 'politicians', 'politician_id,party_id'],
    ['from', 'parties'],
    ['select', 'parties', 'party_id,abbreviation,alliance_id'],
    ['from', 'alliances'],
    ['select', 'alliances', 'alliance_id,abbreviation'],
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
  });

  await assert.rejects(
    () => getCache({ supabaseClient }),
    (error) => error instanceof AppError && error.statusCode === 502
  );
});

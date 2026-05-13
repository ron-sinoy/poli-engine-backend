'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { createApp } = require('../src/app');
const { invokeApp } = require('../test_utils/invokeApp');

function createCacheClient(tables) {
  return {
    from(tableName) {
      return {
        select() {
          if (tableName === 'version_log') {
            return this;
          }

          const table = tables[tableName];

          return Promise.resolve({
            data: table?.data ?? [],
            error: table?.error ?? null,
          });
        },
        eq() {
          return this;
        },
        limit() {
          return this;
        },
        async maybeSingle() {
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

test('GET /cache returns persons with structured party and alliance lists', async () => {
  const app = createApp({
    supabaseClient: createCacheClient({
      persons: {
        data: [
          { person_id: 2, name: 'Pinarayi Vijayan', politician_id: 11 },
          { person_id: 1, name: 'Analyst', politician_id: null },
        ],
      },
      politicians: {
        data: [{ politician_id: 11, party_id: 20 }],
      },
      parties: {
        data: [
          {
            party_id: 20,
            name: 'Communist Party of India (Marxist)',
            abbreviation: 'CPM',
            alliance_id: 30,
          },
        ],
      },
      alliances: {
        data: [{ alliance_id: 30, name: 'Left Democratic Front', abbreviation: 'LDF' }],
      },
      version_log: {
        data: { value: 7 },
      },
    }),
  });

  const response = await invokeApp(app, { method: 'GET', url: '/cache' });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body, {
    version_id: 7,
    persons: [
      {
        person_id: 1,
        name: 'Analyst',
        party_id: null,
        party: null,
        party_name: null,
        alliance_id: null,
        alliance: null,
        alliance_name: null,
      },
      {
        person_id: 2,
        name: 'Pinarayi Vijayan',
        party_id: 20,
        party: 'CPM',
        party_name: 'Communist Party of India (Marxist)',
        alliance_id: 30,
        alliance: 'LDF',
        alliance_name: 'Left Democratic Front',
      },
    ],
    parties: [
      {
        party_id: 20,
        alliance_id: 30,
        name: 'Communist Party of India (Marxist)',
        abbreviation: 'CPM',
      },
    ],
    alliances: [
      {
        alliance_id: 30,
        name: 'Left Democratic Front',
        abbreviation: 'LDF',
      },
    ],
  });
});

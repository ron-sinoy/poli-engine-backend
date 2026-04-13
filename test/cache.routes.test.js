'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { createApp } = require('../src/app');
const { invokeApp } = require('../test_utils/invokeApp');

function createCacheClient(tables) {
  return {
    from(tableName) {
      return {
        async select() {
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

test('GET /cache returns persons with party names and party name list', async () => {
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
        data: [{ party_id: 20, abbreviation: 'CPM', alliance_id: 30 }],
      },
      alliances: {
        data: [{ alliance_id: 30, abbreviation: 'LDF' }],
      },
    }),
  });

  const response = await invokeApp(app, { method: 'GET', url: '/cache' });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body, {
    persons: [
      { name: 'Analyst', party: null },
      { name: 'Pinarayi Vijayan', party: 'CPM' },
    ],
    parties: ['CPM'],
    alliances: ['LDF'],
  });
});

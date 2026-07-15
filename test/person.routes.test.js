'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { createApp } = require('../src/app');
const { invokeApp } = require('../test_utils/invokeApp');

function createPersonRouteClient({ politicianId = 21, personId = 7 }) {
  return {
    from(tableName) {
      return {
        tableName,
        wasUpdated: false,
        insert() {
          return this;
        },
        update() {
          this.wasUpdated = true;
          return this;
        },
        select() {
          return this;
        },
        eq() {
          return this;
        },
        limit() {
          return this;
        },
        async maybeSingle() {
          if (tableName === 'politicians') {
            return {
              data: { politician_id: politicianId },
              error: null,
            };
          }

          if (tableName === 'persons') {
            return {
              data: { person_id: personId },
              error: null,
            };
          }

          return {
            data: { value: this.wasUpdated ? 8 : 7 },
            error: null,
          };
        },
      };
    },
  };
}

test('POST /persons inserts a person and returns the new person_id', async () => {
  const app = createApp({
    supabaseClient: createPersonRouteClient({ personId: 7 }),
  });

  const response = await invokeApp(app, {
    method: 'POST',
    url: '/persons',
    body: {
      name: 'Analyst',
      photo_url: 'https://example.com/analyst.png',
      isPolitician: false,
    },
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body, {
    success: true,
    person_id: 7,
  });
});

test('POST /persons returns validation errors for invalid payloads', async () => {
  const app = createApp({
    supabaseClient: createPersonRouteClient({ personId: 7 }),
  });

  const response = await invokeApp(app, {
    method: 'POST',
    url: '/persons',
    body: {
      name: 'Analyst',
      photo_url: 'https://example.com/analyst.png',
      isPolitician: 'yes',
    },
  });

  assert.equal(response.statusCode, 422);
  assert.deepEqual(response.body, {
    error: 'isPolitician must be a boolean',
  });
});

test('GET /politicians/trending returns the two trending politicians without raw counts', async () => {
  const rows = [
    {
      person_id: 2,
      name: 'V D Satheesan',
      photo_url: 'https://example.com/a.jpg',
      party_abbr: 'INC',
      alliance_abbr: 'UDF',
      alliance_color: '#3990e6',
      appearances: 12,
    },
    {
      person_id: 1,
      name: 'Pinarayi Vijayan',
      photo_url: null,
      party_abbr: 'CPI(M)',
      alliance_abbr: 'LDF',
      alliance_color: '#E63946',
      appearances: 4,
    },
  ];
  const app = createApp({
    supabaseClient: {
      rpc: () => Promise.resolve({ data: rows, error: null }),
    },
  });

  const response = await invokeApp(app, { method: 'GET', url: '/politicians/trending' });

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.length, 2);
  assert.deepEqual(response.body[0], {
    person_id: 2,
    name: 'V D Satheesan',
    photo_url: 'https://example.com/a.jpg',
    party: 'INC',
    alliance: 'UDF',
    alliance_color: '#3990e6',
    score: 160,
  });
  assert.ok(!JSON.stringify(response.body).includes('appearances'));
});

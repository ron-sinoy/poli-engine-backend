'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { createApp } = require('../src/app');
const { invokeApp } = require('../test_utils/invokeApp');

function createPartyRouteClient({ insertedPartyId = 12, currentValue = 7, updatedValue = 8 }) {
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
          if (tableName === 'parties') {
            return {
              data: { party_id: insertedPartyId },
              error: null,
            };
          }

          return {
            data: { value: this.wasUpdated ? updatedValue : currentValue },
            error: null,
          };
        },
      };
    },
  };
}

test('POST /party inserts a party and returns the new party_id', async () => {
  const app = createApp({
    supabaseClient: createPartyRouteClient({ insertedPartyId: 12 }),
  });

  const response = await invokeApp(app, {
    method: 'POST',
    url: '/party',
    body: {
      name: 'Indian National Congress',
      logo_url: 'https://example.com/inc.png',
      alliance_id: 3,
      abbreviation: 'INC',
    },
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body, {
    success: true,
    party_id: 12,
  });
});

test('POST /party returns validation errors for invalid payloads', async () => {
  const app = createApp({
    supabaseClient: createPartyRouteClient({ insertedPartyId: 12 }),
  });

  const response = await invokeApp(app, {
    method: 'POST',
    url: '/party',
    body: {
      name: 'Indian National Congress',
      logo_url: 'https://example.com/inc.png',
      alliance_id: 'bad',
      abbreviation: 'INC',
    },
  });

  assert.equal(response.statusCode, 422);
  assert.deepEqual(response.body, {
    error: 'alliance_id must be an integer',
  });
});

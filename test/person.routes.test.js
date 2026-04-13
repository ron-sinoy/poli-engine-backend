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

'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const request = require('supertest');
const { createApp } = require('../src/app');

function createSupabaseClient({ currentValue, updatedValue }) {
  return {
    from() {
      return {
        wasUpdated: false,
        select() {
          return this;
        },
        eq() {
          return this;
        },
        limit() {
          return this;
        },
        update() {
          this.wasUpdated = true;
          return this;
        },
        async maybeSingle() {
          return {
            data: { value: this.wasUpdated ? updatedValue : currentValue },
            error: null,
          };
        },
      };
    },
  };
}

test('GET /getVersion returns the current version_id', async () => {
  const app = createApp({
    supabaseClient: createSupabaseClient({ currentValue: 7 }),
  });

  const response = await request(app).get('/getVersion').expect(200);

  assert.deepEqual(response.body, { version_id: 7 });
});

test('POST /updateVersion increments and returns the version_id', async () => {
  const app = createApp({
    supabaseClient: createSupabaseClient({ currentValue: 7, updatedValue: 8 }),
  });

  const response = await request(app).post('/updateVersion').expect(200);

  assert.deepEqual(response.body, { version_id: 8 });
});

test('GET /health returns backend status', async () => {
  const app = createApp();
  const response = await request(app).get('/health').expect(200);

  assert.deepEqual(response.body, { ok: true });
});

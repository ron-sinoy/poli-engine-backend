'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { createApp } = require('../src/app');
const { invokeApp } = require('../test_utils/invokeApp');

function createSourceidRouteClient({ sourceids = [], loadError = null, insertError = null }) {
  return {
    from() {
      return {
        select() {
          return Promise.resolve({
            data: sourceids,
            error: loadError,
          });
        },
        insert() {
          return Promise.resolve({
            data: null,
            error: insertError,
          });
        },
      };
    },
  };
}

test('GET /sourceids returns source_id and status rows', async () => {
  const app = createApp({
    supabaseClient: createSourceidRouteClient({
      sourceids: [
        { source_id: 17, status: 'pending' },
        { source_id: 'abc-123', status: 'complete' },
      ],
    }),
  });

  const response = await invokeApp(app, {
    method: 'GET',
    url: '/sourceids',
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body, [
    { source_id: 17, status: 'pending' },
    { source_id: 'abc-123', status: 'complete' },
  ]);
});

test('POST /sourceids inserts source_id and status and returns success', async () => {
  const app = createApp({
    supabaseClient: createSourceidRouteClient({}),
  });

  const response = await invokeApp(app, {
    method: 'POST',
    url: '/sourceids',
    body: {
      source_id: 17,
      status: 'pending',
    },
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body, {
    success: true,
  });
});

test('POST /sourceids returns validation errors for invalid payloads', async () => {
  const app = createApp({
    supabaseClient: createSourceidRouteClient({}),
  });

  const response = await invokeApp(app, {
    method: 'POST',
    url: '/sourceids',
    body: {
      source_id: '',
    },
  });

  assert.equal(response.statusCode, 422);
  assert.deepEqual(response.body, {
    error: 'source_id is required',
  });
});

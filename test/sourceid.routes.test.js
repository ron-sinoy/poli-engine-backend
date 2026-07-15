'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { createApp } = require('../src/app');
const { invokeApp } = require('../test_utils/invokeApp');

function createSourceidRouteClient({
  sourceids = [],
  loadError = null,
  insertError = null,
  updateError = null,
  updateData = { source_id: 17, status: 'complete' },
}) {
  return {
    from() {
      return {
        select() {
          const result = { data: sourceids, error: loadError };

          // Thenable so a bare select resolves, but still chainable for .in().
          return {
            in() {
              return Promise.resolve(result);
            },
            then(onFulfilled, onRejected) {
              return Promise.resolve(result).then(onFulfilled, onRejected);
            },
          };
        },
        upsert() {
          return Promise.resolve({
            data: null,
            error: insertError,
          });
        },
        update(payload) {
          return {
            eq(columnName, value) {
              return {
                select(columns) {
                  return {
                    limit(limitValue) {
                      return {
                        maybeSingle() {
                          return Promise.resolve({
                            data: updateData && value === updateData.source_id ? updateData : null,
                            error: updateError,
                          });
                        },
                      };
                    },
                  };
                },
              };
            },
          };
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

test('POST /sourceids/update updates source_id status and returns success', async () => {
  const app = createApp({
    supabaseClient: createSourceidRouteClient({}),
  });

  const response = await invokeApp(app, {
    method: 'POST',
    url: '/sourceids/update',
    body: {
      source_id: 17,
      status: 'complete',
    },
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body, {
    success: true,
  });
});

test('POST /sourceids/exists returns only the rows for the requested ids', async () => {
  const rows = [{ source_id: 'mt_#a', status: 'completed' }];
  const app = createApp({
    supabaseClient: createSourceidRouteClient({ sourceids: rows }),
  });

  const response = await invokeApp(app, {
    method: 'POST',
    url: '/sourceids/exists',
    body: { source_ids: ['mt_#a', 'mt_#b'] },
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body, rows);
});

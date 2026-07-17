'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { createApp } = require('../src/app');
const { invokeApp } = require('../test_utils/invokeApp');

function createIncidentRouteClient({
  entryId = 11,
  waitingListIncidents = [],
  waitingListError = null,
  waitingListInsertError = null,
}) {
  return {
    from(tableName) {
      return {
        tableName,
        wasUpdated: false,
        select() {
          // An update chain keeps building; a bare read resolves immediately,
          // but stays chainable for the vector-match not().eq().order().range().
          if (tableName === 'waiting_list_incidents' && !this.wasUpdated) {
            const rows = Array.isArray(waitingListIncidents) ? waitingListIncidents : [];
            const result = Promise.resolve({
              data: waitingListIncidents,
              error: waitingListError,
            });

            const builder = {
              not() {
                return builder;
              },
              eq() {
                return builder;
              },
              order() {
                return builder;
              },
              range(fromIndex, toIndex) {
                if (waitingListError) {
                  return Promise.resolve({ data: null, error: waitingListError });
                }

                return Promise.resolve({ data: rows.slice(fromIndex, toIndex + 1), error: null });
              },
              then(onFulfilled, onRejected) {
                return result.then(onFulfilled, onRejected);
              },
            };

            return builder;
          }

          return this;
        },
        insert() {
          if (tableName === 'waiting_list_incidents') {
            return Promise.resolve({
              data: null,
              error: waitingListInsertError,
            });
          }

          return this;
        },
        update() {
          this.wasUpdated = true;
          return this;
        },
        eq() {
          return this;
        },
        limit() {
          return this;
        },
        async maybeSingle() {
          if (tableName === 'threads') {
            return {
              data: this.wasUpdated ? { thread_id: 1, current_position: 3 } : { thread_id: 1, current_position: 2 },
              error: null,
            };
          }

          if (tableName === 'timeline_entries' || tableName === 'incidents' || tableName === 'incident_persons') {
            return {
              data: { entry_id: entryId },
              error: null,
            };
          }

          if (tableName === 'waiting_list_incidents') {
            return {
              data: waitingListIncidents,
              error: waitingListError,
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

test('POST /incidents inserts an incident and returns the new entry_id', async () => {
  const app = createApp({
    supabaseClient: createIncidentRouteClient({ entryId: 11 }),
  });

  const response = await invokeApp(app, {
    method: 'POST',
    url: '/incidents',
    body: {
      thread_id: 1,
      body: 'Incident body',
      source_url: 'https://example.com/incident',
      persons_involved: [9],
    },
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body, {
    success: true,
    entry_id: 11,
  });
});

test('POST /incidents returns validation errors for invalid payloads', async () => {
  const app = createApp({
    supabaseClient: createIncidentRouteClient({ entryId: 11 }),
  });

  const response = await invokeApp(app, {
    method: 'POST',
    url: '/incidents',
    body: {
      thread_id: 1,
      body: 'Incident body',
      source_url: 'https://example.com/incident',
      persons_involved: 'bad',
    },
  });

  assert.equal(response.statusCode, 422);
  assert.deepEqual(response.body, {
    error: 'persons_involved must be an array',
  });
});

test('POST /waitinglists/match returns the ranked waiting list incidents', async () => {
  const waitingListIncidents = [
    { id: 1, content: 'Alpha', source_url: 'https://example.com/1', source_id: 'mt_#a', vectors: '[0,1]' },
    { id: 2, content: 'Beta', source_url: 'https://example.com/2', source_id: 'mt_#b', vectors: '[1,0]' },
  ];
  const app = createApp({
    supabaseClient: createIncidentRouteClient({ waitingListIncidents }),
  });

  const response = await invokeApp(app, {
    method: 'POST',
    url: '/waitinglists/match',
    body: { vectors: [1, 0], match_count: 2 },
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body, [
    { id: 2, content: 'Beta', source_url: 'https://example.com/2', source_id: 'mt_#b', score: 1 },
    { id: 1, content: 'Alpha', source_url: 'https://example.com/1', source_id: 'mt_#a', score: 0 },
  ]);
});

test('POST /waitinglists/update marks a waiting list row consumed', async () => {
  const app = createApp({
    supabaseClient: createIncidentRouteClient({
      waitingListIncidents: { id: 5, status: 'completed' },
    }),
  });

  const response = await invokeApp(app, {
    method: 'POST',
    url: '/waitinglists/update',
    body: { id: 5, status: 'completed' },
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body, { success: true });
});

test('GET /content_waiting-list_incidents returns waiting list incident content', async () => {
  const waitingListIncidents = [
    { id: 1, content: 'Alpha', source_url: 'https://example.com/1', source_id: 'mt_#a' },
    { id: 2, content: 'Beta', source_url: 'https://example.com/2', source_id: 'mt_#b' },
  ];
  const app = createApp({
    supabaseClient: createIncidentRouteClient({ waitingListIncidents }),
  });

  const response = await invokeApp(app, {
        method: 'GET',
        url: '/content_waiting-list_incidents',
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body, waitingListIncidents);
});

test('POST /waitinglists inserts a waiting list row and returns success', async () => {
  const app = createApp({
    supabaseClient: createIncidentRouteClient({}),
  });

  const response = await invokeApp(app, {
    method: 'POST',
    url: '/waitinglists',
    body: {
      content: 'Alpha',
      vectors: [0.1, 0.2],
      source_url: 'https://example.com/alpha',
      source_id: 'mt_#alpha',
    },
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body, {
    success: true,
  });
});

test('POST /waitinglists returns validation errors for missing content', async () => {
  const app = createApp({
    supabaseClient: createIncidentRouteClient({}),
  });

  const response = await invokeApp(app, {
    method: 'POST',
    url: '/waitinglists',
    body: {
      vectors: [0.1, 0.2],
      source_url: 'https://example.com/alpha',
      source_id: 'mt_#alpha',
    },
  });

  assert.equal(response.statusCode, 422);
  assert.deepEqual(response.body, {
    error: 'content is required',
  });
});

test('POST /waitinglists returns validation errors for missing vectors', async () => {
  const app = createApp({
    supabaseClient: createIncidentRouteClient({}),
  });

  const response = await invokeApp(app, {
    method: 'POST',
    url: '/waitinglists',
    body: {
      content: 'Alpha',
      source_url: 'https://example.com/alpha',
      source_id: 'mt_#alpha',
    },
  });

  assert.equal(response.statusCode, 422);
  assert.deepEqual(response.body, {
    error: 'vectors is required',
  });
});

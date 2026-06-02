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
          if (tableName === 'waiting_list_incidents') {
            return Promise.resolve({
              data: waitingListIncidents,
              error: waitingListError,
            });
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

test('GET /vector_waiting_list_incidents returns waiting list incident vectors', async () => {
  const waitingListIncidents = [
    { id: 1, vectors: [0.1, 0.2] },
    { id: 2, vectors: [0.3, 0.4] },
  ];
  const app = createApp({
    supabaseClient: createIncidentRouteClient({ waitingListIncidents }),
  });

  const response = await invokeApp(app, {
    method: 'GET',
    url: '/vector_waiting_list_incidents',
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body, waitingListIncidents);
});

test('GET /content_waiting-list_incidents returns waiting list incident content', async () => {
  const waitingListIncidents = [
    { id: 1, content: 'Alpha' },
    { id: 2, content: 'Beta' },
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
    },
  });

  assert.equal(response.statusCode, 422);
  assert.deepEqual(response.body, {
    error: 'vectors is required',
  });
});

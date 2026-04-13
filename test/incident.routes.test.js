'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { createApp } = require('../src/app');
const { invokeApp } = require('../test_utils/invokeApp');

function createIncidentRouteClient({ entryId = 11 }) {
  return {
    from(tableName) {
      return {
        tableName,
        wasUpdated: false,
        select() {
          return this;
        },
        insert() {
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
      published_at: '2026-04-13T10:00:00.000Z',
      position: 3,
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
      persons_involved: [9],
      published_at: 'bad',
      position: 3,
    },
  });

  assert.equal(response.statusCode, 422);
  assert.deepEqual(response.body, {
    error: 'published_at must be a valid ISO timestamp',
  });
});

'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { createApp } = require('../src/app');
const { invokeApp } = require('../test_utils/invokeApp');

function createThreadsClient({ data, error = null }) {
  return {
    from() {
      return {
        select() {
          return this;
        },
        async order() {
          return { data, error };
        },
      };
    },
  };
}

function createInsertThreadRouteClient({ insertedThreadId = 5 }) {
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
          if (tableName === 'threads') {
            return {
              data: { thread_id: insertedThreadId },
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

test('POST /threads inserts a thread and returns the new thread_id', async () => {
  const app = createApp({
    supabaseClient: createInsertThreadRouteClient({ insertedThreadId: 5 }),
  });

  const response = await invokeApp(app, {
    method: 'POST',
    url: '/threads',
    body: {
      title: 'Thread title',
      summary: 'Thread summary',
    },
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body, {
    success: true,
    thread_id: 5,
  });
});

test('POST /threads returns validation errors for invalid payloads', async () => {
  const app = createApp({
    supabaseClient: createInsertThreadRouteClient({ insertedThreadId: 5 }),
  });

  const response = await invokeApp(app, {
    method: 'POST',
    url: '/threads',
    body: {
      title: '',
      summary: 'Thread summary',
    },
  });

  assert.equal(response.statusCode, 422);
  assert.deepEqual(response.body, {
    error: 'title is required',
  });
});

test('GET /threadsList returns threads as an array', async () => {
  const threads = [
    {
      thread_id: 2,
      title: 'Updated topic',
      summary: 'Latest summary',
      updated_at: '2026-04-11T10:00:00Z',
    },
    {
      thread_id: 1,
      title: 'Older topic',
      summary: 'Older summary',
      updated_at: '2026-04-10T10:00:00Z',
    },
  ];
  const app = createApp({
    supabaseClient: createThreadsClient({ data: threads }),
  });

  const response = await invokeApp(app, { method: 'GET', url: '/threadsList' });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body, threads);
});

test('GET /threadsInternal returns threads with vectors', async () => {
  const threads = [
    {
      thread_id: 2,
      title: 'Updated topic',
      summary: 'Latest summary',
      updated_at: '2026-04-11T10:00:00Z',
      vectors: [0.1, 0.2, 0.3],
    },
    {
      thread_id: 1,
      title: 'Older topic',
      summary: 'Older summary',
      updated_at: '2026-04-10T10:00:00Z',
      vectors: [0.4, 0.5, 0.6],
    },
  ];
  const app = createApp({
    supabaseClient: createThreadsClient({ data: threads }),
  });

  const response = await invokeApp(app, { method: 'GET', url: '/threadsInternal' });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body, threads);
});

function createThreadByIdClient({ thread }) {
  return {
    from(tableName) {
      return {
        select() {
          return this;
        },
        eq() {
          return this;
        },
        limit() {
          return this;
        },
        maybeSingle() {
          return Promise.resolve({ data: tableName === 'threads' ? thread : null, error: null });
        },
        order() {
          return Promise.resolve({ data: [], error: null });
        },
      };
    },
  };
}

test('GET /threads/:id returns one thread with timeline_entries', async () => {
  const app = createApp({
    supabaseClient: createThreadByIdClient({
      thread: {
        thread_id: 42,
        title: 'Thread title',
        summary: 'Thread summary',
        updated_at: '2026-04-11T10:00:00Z',
      },
    }),
  });

  const response = await invokeApp(app, { method: 'GET', url: '/threads/42' });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body, {
    thread_id: 42,
    title: 'Thread title',
    summary: 'Thread summary',
    updated_at: '2026-04-11T10:00:00Z',
    timeline_entries: [],
  });
});

test('GET /threads/:id returns 404 when thread is missing', async () => {
  const app = createApp({
    supabaseClient: createThreadByIdClient({ thread: null }),
  });

  const response = await invokeApp(app, { method: 'GET', url: '/threads/404' });

  assert.equal(response.statusCode, 404);
  assert.deepEqual(response.body, { error: 'Thread not found' });
});

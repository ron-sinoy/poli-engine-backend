'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const request = require('supertest');
const { createApp } = require('../src/app');

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

  const response = await request(app).get('/threadsList').expect(200);

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

  const response = await request(app).get('/threads/42').expect(200);

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

  const response = await request(app).get('/threads/404').expect(404);

  assert.deepEqual(response.body, { error: 'Thread not found' });
});

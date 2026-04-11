'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { AppError } = require('../src/errors/AppError');
const { getThreadById, loadThreadsList } = require('../src/services/thread.service');

function createThreadsClient({ data, error = null }) {
  const calls = [];

  return {
    calls,
    from(tableName) {
      calls.push(['from', tableName]);
      return {
        select(columns) {
          calls.push(['select', columns]);
          return this;
        },
        async order(column, options) {
          calls.push(['order', column, options]);
          return { data, error };
        },
      };
    },
  };
}

test('loadThreadsList reads threads ordered by updated_at descending', async () => {
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
  const supabaseClient = createThreadsClient({ data: threads });

  const result = await loadThreadsList({ supabaseClient });

  assert.deepEqual(result, threads);
  assert.deepEqual(supabaseClient.calls, [
    ['from', 'threads'],
    ['select', 'thread_id,title,summary,updated_at'],
    ['order', 'updated_at', { ascending: false }],
  ]);
});

test('loadThreadsList returns an empty array when Supabase returns no rows', async () => {
  const supabaseClient = createThreadsClient({ data: null });

  const result = await loadThreadsList({ supabaseClient });

  assert.deepEqual(result, []);
});

test('loadThreadsList maps Supabase failures to AppError', async () => {
  const supabaseClient = createThreadsClient({
    data: null,
    error: { message: 'database unavailable' },
  });

  await assert.rejects(
    () => loadThreadsList({ supabaseClient }),
    (error) => error instanceof AppError && error.statusCode === 502
  );
});

function createThreadDetailClient(tables) {
  const calls = [];

  return {
    calls,
    from(tableName) {
      calls.push(['from', tableName]);
      const query = {
        filters: {},
        select(columns) {
          calls.push(['select', tableName, columns]);
          return this;
        },
        eq(column, value) {
          calls.push(['eq', tableName, column, value]);
          this.filters[column] = value;
          return this;
        },
        in(column, values) {
          calls.push(['in', tableName, column, values]);
          this.filters[column] = values;
          return Promise.resolve({ data: tables[tableName] || [], error: null });
        },
        limit(count) {
          calls.push(['limit', tableName, count]);
          return this;
        },
        order(column, options) {
          calls.push(['order', tableName, column, options]);
          return Promise.resolve({ data: tables[tableName] || [], error: null });
        },
        maybeSingle() {
          calls.push(['maybeSingle', tableName]);
          return Promise.resolve({ data: tables[tableName] || null, error: null });
        },
      };

      return query;
    },
  };
}

test('getThreadById assembles incidents and quotes without nested ids', async () => {
  const supabaseClient = createThreadDetailClient({
    threads: {
      thread_id: 42,
      title: 'Thread title',
      summary: 'Thread summary',
      updated_at: '2026-04-11T10:00:00Z',
    },
    timeline_entries: [
      {
        entry_id: 102,
        entry_type: 'quote',
        position: 2,
        published_at: '2026-04-11T09:00:00Z',
      },
      {
        entry_id: 101,
        entry_type: 'incident',
        position: 1,
        published_at: '2026-04-10T09:00:00Z',
      },
    ],
    incidents: [{ entry_id: 101, body: 'Incident body' }],
    quotes: [{ entry_id: 102, quote_text: 'Quote text', speaker_id: 201 }],
    incident_persons: [{ entry_id: 101, person_id: 202 }],
    quote_persons: [{ entry_id: 102, person_id: 203 }],
    persons: [
      { person_id: 201, name: 'Speaker', photo_url: 'speaker.jpg', politician_id: 301 },
      { person_id: 202, name: 'Incident person', photo_url: 'incident.jpg', politician_id: null },
      { person_id: 203, name: 'Quote person', photo_url: 'quote.jpg', politician_id: null },
    ],
    politicians: [{ politician_id: 301, party_id: 401 }],
    parties: [{ party_id: 401, alliance_id: 501 }],
    alliances: [{ alliance_id: 501, color: '#ff0000' }],
  });

  const result = await getThreadById({ supabaseClient, threadId: '42' });

  assert.deepEqual(result, {
    thread_id: 42,
    title: 'Thread title',
    summary: 'Thread summary',
    updated_at: '2026-04-11T10:00:00Z',
    timeline_entries: [
      {
        entry_type: 'quote',
        position: 2,
        published_at: '2026-04-11T09:00:00Z',
        quote_text: 'Quote text',
        speaker: {
          name: 'Speaker',
          photo_url: 'speaker.jpg',
          alliance: { color: '#ff0000' },
        },
        persons_involved: [{ name: 'Quote person', photo_url: 'quote.jpg' }],
      },
      {
        entry_type: 'incident',
        position: 1,
        published_at: '2026-04-10T09:00:00Z',
        body: 'Incident body',
        persons_involved: [{ name: 'Incident person', photo_url: 'incident.jpg' }],
      },
    ],
  });

  assert.deepEqual(supabaseClient.calls.slice(0, 8), [
    ['from', 'threads'],
    ['select', 'threads', 'thread_id,title,summary,updated_at'],
    ['eq', 'threads', 'thread_id', '42'],
    ['limit', 'threads', 1],
    ['maybeSingle', 'threads'],
    ['from', 'timeline_entries'],
    ['select', 'timeline_entries', 'entry_id,entry_type,position,published_at'],
    ['eq', 'timeline_entries', 'thread_id', '42'],
  ]);
  assert.ok(
    supabaseClient.calls.some(
      (call) =>
        call[0] === 'order' &&
        call[1] === 'timeline_entries' &&
        call[2] === 'position' &&
        call[3].ascending === false
    )
  );
});

test('getThreadById returns not found when the thread is missing', async () => {
  const supabaseClient = createThreadDetailClient({ threads: null });

  await assert.rejects(
    () => getThreadById({ supabaseClient, threadId: '404' }),
    (error) => error instanceof AppError && error.statusCode === 404
  );
});

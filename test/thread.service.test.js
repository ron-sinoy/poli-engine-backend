'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { AppError } = require('../src/errors/AppError');
const { getThreadById, insertThread, loadThreadsList } = require('../src/services/thread.service');

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

function createInsertThreadClient({ insertedThreadId = 5, insertError = null, updateError = null }) {
  const calls = [];

  return {
    calls,
    from(tableName) {
      calls.push(['from', tableName]);
      return {
        tableName,
        wasUpdated: false,
        insert(payload) {
          calls.push(['insert', tableName, payload]);
          return this;
        },
        select(columns) {
          calls.push(['select', tableName, columns]);
          return this;
        },
        limit(count) {
          calls.push(['limit', tableName, count]);
          return this;
        },
        eq(column, value) {
          calls.push(['eq', tableName, column, value]);
          return this;
        },
        update(payload) {
          this.wasUpdated = true;
          calls.push(['update', tableName, payload]);
          return this;
        },
        async maybeSingle() {
          calls.push(['maybeSingle', tableName]);

          if (tableName === 'threads') {
            return {
              data: insertedThreadId === null ? null : { thread_id: insertedThreadId },
              error: insertError,
            };
          }

          return {
            data: this.wasUpdated ? { value: 8 } : { value: 7 },
            error: updateError,
          };
        },
      };
    },
  };
}

test('insertThread inserts a thread without updating version_id', async () => {
  const supabaseClient = createInsertThreadClient({});

  const threadId = await insertThread({
    supabaseClient,
    payload: {
      title: 'Thread title',
      summary: 'Thread summary',
    },
  });

  assert.equal(threadId, 5);
  assert.deepEqual(supabaseClient.calls[0], ['from', 'threads']);
  assert.deepEqual(supabaseClient.calls[1][0], 'insert');
  assert.equal(supabaseClient.calls[1][1], 'threads');
  assert.equal(supabaseClient.calls[1][2].title, 'Thread title');
  assert.equal(supabaseClient.calls[1][2].summary, 'Thread summary');
  assert.equal(supabaseClient.calls[1][2].updated_at, null);
  assert.equal(supabaseClient.calls[1][2].current_position, 0);
  assert.equal(typeof supabaseClient.calls[1][2].created_at, 'string');
  assert.ok(!supabaseClient.calls.some((call) => call[1] === 'version_log'));
});

test('insertThread rejects missing title', async () => {
  const supabaseClient = createInsertThreadClient({});

  await assert.rejects(
    () =>
      insertThread({
        supabaseClient,
        payload: {
          title: '',
          summary: 'Thread summary',
        },
      }),
    (error) => error instanceof AppError && error.statusCode === 422 && error.message === 'title is required'
  );
});

test('insertThread maps Supabase insert failures to AppError', async () => {
  const supabaseClient = createInsertThreadClient({
    insertError: { message: 'insert failed' },
  });

  await assert.rejects(
    () =>
      insertThread({
        supabaseClient,
        payload: {
          title: 'Thread title',
          summary: 'Thread summary',
        },
      }),
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
      {
        person_id: 202,
        name: 'Incident person',
        photo_url: 'incident.jpg',
        politician_id: 302,
      },
      { person_id: 203, name: 'Quote person', photo_url: 'quote.jpg', politician_id: null },
    ],
    politicians: [
      { politician_id: 301, party_id: 401 },
      { politician_id: 302, party_id: 402 },
    ],
    parties: [
      { party_id: 401, name: 'Communist Party of India (Marxist)', alliance_id: 501 },
      { party_id: 402, name: 'Indian National Congress', alliance_id: 502 },
    ],
    alliances: [
      { alliance_id: 501, name: 'Left Democratic Front', color: '#ff0000' },
      { alliance_id: 502, name: 'United Democratic Front', color: '#00ff00' },
    ],
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
          party: { name: 'Communist Party of India (Marxist)' },
          alliance: { name: 'Left Democratic Front', color: '#ff0000' },
        },
        persons_involved: [
          {
            name: 'Quote person',
            photo_url: 'quote.jpg',
            party: null,
            alliance: null,
          },
        ],
      },
      {
        entry_type: 'incident',
        position: 1,
        published_at: '2026-04-10T09:00:00Z',
        body: 'Incident body',
        persons_involved: [
          {
            name: 'Incident person',
            photo_url: 'incident.jpg',
            party: { name: 'Indian National Congress' },
            alliance: { name: 'United Democratic Front', color: '#00ff00' },
          },
        ],
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
  assert.ok(
    supabaseClient.calls.some(
      (call) => call[0] === 'select' && call[1] === 'parties' && call[2] === 'party_id,name,alliance_id'
    )
  );
  assert.ok(
    supabaseClient.calls.some(
      (call) =>
        call[0] === 'select' && call[1] === 'alliances' && call[2] === 'alliance_id,name,color'
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

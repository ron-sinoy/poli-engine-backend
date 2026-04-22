'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { AppError } = require('../src/errors/AppError');
const { insertQuote } = require('../src/services/quote.service');

function createQuoteClient({
  thread = { thread_id: 1, current_position: 2 },
  timelineEntryId = 10,
  timelineError = null,
  quoteError = null,
  quotePersonsError = null,
  threadUpdateError = null,
  versionReadError = null,
  versionUpdateError = null,
}) {
  const calls = [];

  return {
    calls,
    from(tableName) {
      calls.push(['from', tableName]);

      return {
        tableName,
        wasUpdated: false,
        select(columns) {
          calls.push(['select', tableName, columns]);
          return this;
        },
        insert(payload) {
          calls.push(['insert', tableName, payload]);
          return this;
        },
        update(payload) {
          this.wasUpdated = true;
          calls.push(['update', tableName, payload]);
          return this;
        },
        eq(column, value) {
          calls.push(['eq', tableName, column, value]);
          return this;
        },
        limit(count) {
          calls.push(['limit', tableName, count]);
          return this;
        },
        async maybeSingle() {
          calls.push(['maybeSingle', tableName]);

          if (tableName === 'threads') {
            if (this.wasUpdated) {
              return { data: { thread_id: 1, current_position: 3 }, error: threadUpdateError };
            }

            return { data: thread, error: null };
          }

          if (tableName === 'timeline_entries') {
            return {
              data: timelineEntryId === null ? null : { entry_id: timelineEntryId },
              error: timelineError,
            };
          }

          if (tableName === 'quotes') {
            return {
              data: { entry_id: timelineEntryId },
              error: quoteError,
            };
          }

          if (tableName === 'quote_persons') {
            return {
              data: { entry_id: timelineEntryId },
              error: quotePersonsError,
            };
          }

          return {
            data: { value: this.wasUpdated ? 8 : 7 },
            error: this.wasUpdated ? versionUpdateError : versionReadError,
          };
        },
      };
    },
  };
}

test('insertQuote writes timeline, quote, quote_persons, and thread update without version change', async () => {
  const supabaseClient = createQuoteClient({});

  const entryId = await insertQuote({
    supabaseClient,
    payload: {
      thread_id: 1,
      quote_text: 'Quote text',
      source_url: 'https://example.com/quote',
      speaker_id: 5,
      persons_involved: [9, 10],
    },
  });

  assert.equal(entryId, 10);
  assert.deepEqual(supabaseClient.calls.slice(0, 20), [
    ['from', 'threads'],
    ['select', 'threads', 'thread_id,current_position'],
    ['eq', 'threads', 'thread_id', 1],
    ['limit', 'threads', 1],
    ['maybeSingle', 'threads'],
    ['from', 'timeline_entries'],
    [
      'insert',
      'timeline_entries',
      {
        thread_id: 1,
        entry_type: 'quote',
        position: 2,
        published_at: supabaseClient.calls[6][2].published_at,
      },
    ],
    ['select', 'timeline_entries', 'entry_id'],
    ['limit', 'timeline_entries', 1],
    ['maybeSingle', 'timeline_entries'],
    ['from', 'quotes'],
    [
      'insert',
      'quotes',
      {
        entry_id: 10,
        quote_text: 'Quote text',
        source_url: 'https://example.com/quote',
        speaker_id: 5,
      },
    ],
    ['select', 'quotes', 'entry_id'],
    ['limit', 'quotes', 1],
    ['maybeSingle', 'quotes'],
    ['from', 'quote_persons'],
    [
      'insert',
      'quote_persons',
      [
        { entry_id: 10, person_id: 9 },
        { entry_id: 10, person_id: 10 },
      ],
    ],
    ['select', 'quote_persons', 'entry_id'],
    ['limit', 'quote_persons', 1],
    ['maybeSingle', 'quote_persons'],
  ]);
  assert.ok(supabaseClient.calls.some((call) => call[0] === 'update' && call[1] === 'threads'));
  assert.ok(
    supabaseClient.calls.some(
      (call) => call[0] === 'update' && call[1] === 'threads' && call[2].current_position === 3
    )
  );
  const timelineInsert = supabaseClient.calls.find(
    (call) => call[0] === 'insert' && call[1] === 'timeline_entries'
  );
  const threadUpdate = supabaseClient.calls.find(
    (call) => call[0] === 'update' && call[1] === 'threads'
  );
  assert.equal(timelineInsert[2].published_at, threadUpdate[2].updated_at);
  assert.ok(!supabaseClient.calls.some((call) => call[1] === 'version_log'));
});

test('insertQuote rejects invalid persons_involved payloads', async () => {
  const supabaseClient = createQuoteClient({});

  await assert.rejects(
    () =>
      insertQuote({
        supabaseClient,
        payload: {
          thread_id: 1,
          quote_text: 'Quote text',
          source_url: 'https://example.com/quote',
          speaker_id: 5,
          persons_involved: 'bad',
        },
      }),
    (error) =>
      error instanceof AppError &&
      error.statusCode === 422 &&
      error.message === 'persons_involved must be an array'
  );
});

test('insertQuote maps quote insert failures to AppError', async () => {
  const supabaseClient = createQuoteClient({
    quoteError: { message: 'insert failed' },
  });

  await assert.rejects(
    () =>
      insertQuote({
        supabaseClient,
        payload: {
          thread_id: 1,
          quote_text: 'Quote text',
          source_url: 'https://example.com/quote',
          speaker_id: 5,
          persons_involved: [9],
        },
      }),
    (error) => error instanceof AppError && error.statusCode === 502
  );
});

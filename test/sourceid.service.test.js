'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { AppError } = require('../src/errors/AppError');
const { insertSourceid, loadSourceids } = require('../src/services/sourceid.service');

function createSourceidClient({ sourceids = [], loadError = null, insertError = null }) {
  const calls = [];

  return {
    calls,
    from(tableName) {
      calls.push(['from', tableName]);

      return {
        select(columns) {
          calls.push(['select', tableName, columns]);

          return Promise.resolve({
            data: sourceids,
            error: loadError,
          });
        },
        insert(payload) {
          calls.push(['insert', tableName, payload]);

          return Promise.resolve({
            data: null,
            error: insertError,
          });
        },
      };
    },
  };
}

test('loadSourceids reads source_id and status rows from pipeline_metadata', async () => {
  const supabaseClient = createSourceidClient({
    sourceids: [
      { source_id: 17, status: 'pending' },
      { source_id: 'abc-123', status: 'complete' },
    ],
  });

  const result = await loadSourceids({ supabaseClient });

  assert.deepEqual(result, [
    { source_id: 17, status: 'pending' },
    { source_id: 'abc-123', status: 'complete' },
  ]);
  assert.deepEqual(supabaseClient.calls, [
    ['from', 'pipeline_metadata'],
    ['select', 'pipeline_metadata', 'source_id,status'],
  ]);
});

test('loadSourceids maps Supabase read failures to AppError', async () => {
  const supabaseClient = createSourceidClient({
    loadError: { message: 'read failed' },
  });

  await assert.rejects(
    () => loadSourceids({ supabaseClient }),
    (error) => error instanceof AppError && error.statusCode === 502
  );
});

test('insertSourceid inserts source_id and status into pipeline_metadata without updating version_id', async () => {
  const supabaseClient = createSourceidClient({});

  await insertSourceid({
    supabaseClient,
    payload: {
      source_id: 17,
      status: 'pending',
    },
  });

  assert.deepEqual(supabaseClient.calls, [
    ['from', 'pipeline_metadata'],
    ['insert', 'pipeline_metadata', { source_id: 17, status: 'pending' }],
  ]);
  assert.ok(!supabaseClient.calls.some((call) => call[1] === 'version_log'));
});

test('insertSourceid trims and inserts string source_id and status values', async () => {
  const supabaseClient = createSourceidClient({});

  await insertSourceid({
    supabaseClient,
    payload: {
      source_id: '  abc-123  ',
      status: '  complete  ',
    },
  });

  assert.deepEqual(supabaseClient.calls, [
    ['from', 'pipeline_metadata'],
    ['insert', 'pipeline_metadata', { source_id: 'abc-123', status: 'complete' }],
  ]);
});

test('insertSourceid rejects missing source_id', async () => {
  const supabaseClient = createSourceidClient({});

  await assert.rejects(
    () =>
      insertSourceid({
        supabaseClient,
        payload: {},
      }),
    (error) =>
      error instanceof AppError &&
      error.statusCode === 422 &&
      error.message === 'source_id is required'
  );
});

test('insertSourceid rejects invalid source_id types', async () => {
  const supabaseClient = createSourceidClient({});

  await assert.rejects(
    () =>
      insertSourceid({
        supabaseClient,
        payload: {
          source_id: { value: 17 },
        },
      }),
    (error) =>
      error instanceof AppError &&
      error.statusCode === 422 &&
      error.message === 'source_id must be a non-empty string or integer'
  );
});

test('insertSourceid rejects missing status', async () => {
  const supabaseClient = createSourceidClient({});

  await assert.rejects(
    () =>
      insertSourceid({
        supabaseClient,
        payload: {
          source_id: 17,
        },
      }),
    (error) =>
      error instanceof AppError &&
      error.statusCode === 422 &&
      error.message === 'status is required'
  );
});

test('insertSourceid maps Supabase insert failures to AppError', async () => {
  const supabaseClient = createSourceidClient({
    insertError: { message: 'insert failed' },
  });

  await assert.rejects(
    () =>
      insertSourceid({
        supabaseClient,
        payload: {
          source_id: 17,
          status: 'pending',
        },
      }),
    (error) => error instanceof AppError && error.statusCode === 502
  );
});

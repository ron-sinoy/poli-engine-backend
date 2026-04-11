'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { AppError } = require('../src/errors/AppError');
const { getVersion, updateVersion } = require('../src/services/version.service');

function createVersionRowClient({ value, updateValue, error = null, updateError = null }) {
  const calls = [];

  const supabaseClient = {
    calls,
    from(tableName) {
      calls.push(['from', tableName]);
      return {
        select(columns) {
          calls.push(['select', columns]);
          return this;
        },
        eq(column, eqValue) {
          calls.push(['eq', column, eqValue]);
          return this;
        },
        limit(count) {
          calls.push(['limit', count]);
          return this;
        },
        update(payload) {
          calls.push(['update', payload]);
          return this;
        },
        async maybeSingle() {
          calls.push(['maybeSingle']);

          if (calls.some(([method]) => method === 'update')) {
            return {
              data: updateValue === null ? null : { value: updateValue },
              error: updateError,
            };
          }

          return {
            data: value === null ? null : { value },
            error,
          };
        },
      };
    },
  };

  return supabaseClient;
}

test('getVersion reads version_log value where key is version_id', async () => {
  const supabaseClient = createVersionRowClient({ value: 7 });

  const versionId = await getVersion({ supabaseClient });

  assert.equal(versionId, 7);
  assert.deepEqual(supabaseClient.calls, [
    ['from', 'version_log'],
    ['select', 'value'],
    ['eq', 'key', 'version_id'],
    ['limit', 1],
    ['maybeSingle'],
  ]);
});

test('getVersion returns not found when the version row is missing', async () => {
  const supabaseClient = createVersionRowClient({ value: null });

  await assert.rejects(
    () => getVersion({ supabaseClient }),
    (error) => error instanceof AppError && error.statusCode === 404
  );
});

test('updateVersion increments the current version_id by 1', async () => {
  const supabaseClient = createVersionRowClient({ value: 7, updateValue: 8 });

  const versionId = await updateVersion({ supabaseClient });

  assert.equal(versionId, 8);
  assert.deepEqual(supabaseClient.calls, [
    ['from', 'version_log'],
    ['select', 'value'],
    ['eq', 'key', 'version_id'],
    ['limit', 1],
    ['maybeSingle'],
    ['from', 'version_log'],
    ['update', { value: 8 }],
    ['eq', 'key', 'version_id'],
    ['select', 'value'],
    ['limit', 1],
    ['maybeSingle'],
  ]);
});

test('updateVersion rejects non-integer version_id values', async () => {
  const supabaseClient = createVersionRowClient({ value: 'not-a-number' });

  await assert.rejects(
    () => updateVersion({ supabaseClient }),
    (error) => error instanceof AppError && error.statusCode === 422
  );
});

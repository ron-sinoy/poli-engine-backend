'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { AppError } = require('../src/errors/AppError');
const { insertPerson } = require('../src/services/person.service');

function createPersonClient({
  politicianId = 21,
  personId = 7,
  politicianError = null,
  personError = null,
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
        insert(payload) {
          calls.push(['insert', tableName, payload]);
          return this;
        },
        update(payload) {
          this.wasUpdated = true;
          calls.push(['update', tableName, payload]);
          return this;
        },
        select(columns) {
          calls.push(['select', tableName, columns]);
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

          if (tableName === 'politicians') {
            return {
              data: politicianId === null ? null : { politician_id: politicianId },
              error: politicianError,
            };
          }

          if (tableName === 'persons') {
            return {
              data: personId === null ? null : { person_id: personId },
              error: personError,
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

function delegatedVersionService() {
  return {
    updateVersion({ supabaseClient }) {
      return require('../src/services/version.service').updateVersion({ supabaseClient });
    },
  };
}

test('insertPerson inserts politician then person when isPolitician is true', async () => {
  const supabaseClient = createPersonClient({});

  const personId = await insertPerson({
    supabaseClient,
    payload: {
      name: 'Pinarayi Vijayan',
      photo_url: 'https://example.com/pv.png',
      isPolitician: true,
      party_id: 4,
    },
    versionService: delegatedVersionService(),
  });

  assert.equal(personId, 7);
  assert.deepEqual(supabaseClient.calls, [
    ['from', 'politicians'],
    ['insert', 'politicians', { party_id: 4 }],
    ['select', 'politicians', 'politician_id'],
    ['limit', 'politicians', 1],
    ['maybeSingle', 'politicians'],
    [
      'from',
      'persons',
    ],
    [
      'insert',
      'persons',
      {
        name: 'Pinarayi Vijayan',
        photo_url: 'https://example.com/pv.png',
        politician_id: 21,
      },
    ],
    ['select', 'persons', 'person_id'],
    ['limit', 'persons', 1],
    ['maybeSingle', 'persons'],
    ['from', 'version_log'],
    ['select', 'version_log', 'value'],
    ['eq', 'version_log', 'key', 'version_id'],
    ['limit', 'version_log', 1],
    ['maybeSingle', 'version_log'],
    ['from', 'version_log'],
    ['update', 'version_log', { value: 8 }],
    ['eq', 'version_log', 'key', 'version_id'],
    ['select', 'version_log', 'value'],
    ['limit', 'version_log', 1],
    ['maybeSingle', 'version_log'],
  ]);
});

test('insertPerson inserts only person when isPolitician is false', async () => {
  const supabaseClient = createPersonClient({});

  const personId = await insertPerson({
    supabaseClient,
    payload: {
      name: 'Analyst',
      photo_url: 'https://example.com/analyst.png',
      isPolitician: false,
    },
    versionService: delegatedVersionService(),
  });

  assert.equal(personId, 7);
  assert.ok(!supabaseClient.calls.some((call) => call[1] === 'politicians'));
});

test('insertPerson rejects non-boolean isPolitician', async () => {
  const supabaseClient = createPersonClient({});

  await assert.rejects(
    () =>
      insertPerson({
        supabaseClient,
        payload: {
          name: 'Analyst',
          photo_url: 'https://example.com/analyst.png',
          isPolitician: 'yes',
        },
        versionService: delegatedVersionService(),
      }),
    (error) =>
      error instanceof AppError &&
      error.statusCode === 422 &&
      error.message === 'isPolitician must be a boolean'
  );
});

test('insertPerson maps person insert failures to AppError', async () => {
  const supabaseClient = createPersonClient({
    personError: { message: 'insert failed' },
  });

  await assert.rejects(
    () =>
      insertPerson({
        supabaseClient,
        payload: {
          name: 'Analyst',
          photo_url: 'https://example.com/analyst.png',
          isPolitician: false,
        },
        versionService: delegatedVersionService(),
      }),
    (error) => error instanceof AppError && error.statusCode === 502
  );
});

test('insertPerson surfaces version update failures after a successful insert', async () => {
  const supabaseClient = createPersonClient({
    versionUpdateError: { message: 'update failed' },
  });

  await assert.rejects(
    () =>
      insertPerson({
        supabaseClient,
        payload: {
          name: 'Analyst',
          photo_url: 'https://example.com/analyst.png',
          isPolitician: false,
        },
        versionService: delegatedVersionService(),
      }),
    (error) => error instanceof AppError && error.statusCode === 502
  );
});

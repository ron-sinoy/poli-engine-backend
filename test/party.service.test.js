'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { AppError } = require('../src/errors/AppError');
const { insertParty } = require('../src/services/party.service');

function createPartyClient({
  insertedPartyId = 12,
  insertError = null,
  insertData = undefined,
  currentVersion = 7,
  updatedVersion = 8,
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

          if (tableName === 'parties') {
            return {
              data:
                insertData !== undefined
                  ? insertData
                  : insertedPartyId === null
                    ? null
                    : { party_id: insertedPartyId },
              error: insertError,
            };
          }

          if (this.wasUpdated) {
            return {
              data: updatedVersion === null ? null : { value: updatedVersion },
              error: versionUpdateError,
            };
          }

          return {
            data: currentVersion === null ? null : { value: currentVersion },
            error: versionReadError,
          };
        },
      };
    },
  };
}

test('insertParty inserts the party and then increments version_id', async () => {
  const supabaseClient = createPartyClient({});

  const partyId = await insertParty({
    supabaseClient,
    payload: {
      name: 'Indian National Congress',
      logo_url: 'https://example.com/inc.png',
      alliance_id: 3,
      abbreviation: 'INC',
    },
  });

  assert.equal(partyId, 12);
  assert.deepEqual(supabaseClient.calls, [
    ['from', 'parties'],
    [
      'insert',
      'parties',
      {
        name: 'Indian National Congress',
        logo_url: 'https://example.com/inc.png',
        alliance_id: 3,
        abbreviation: 'INC',
      },
    ],
    ['select', 'parties', 'party_id'],
    ['limit', 'parties', 1],
    ['maybeSingle', 'parties'],
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

test('insertParty rejects missing required fields', async () => {
  const supabaseClient = createPartyClient({});

  await assert.rejects(
    () =>
      insertParty({
        supabaseClient,
        payload: {
          name: '',
          logo_url: 'https://example.com/inc.png',
          alliance_id: 3,
          abbreviation: 'INC',
        },
      }),
    (error) => error instanceof AppError && error.statusCode === 422 && error.message === 'name is required'
  );
});

test('insertParty rejects non-integer alliance_id values', async () => {
  const supabaseClient = createPartyClient({});

  await assert.rejects(
    () =>
      insertParty({
        supabaseClient,
        payload: {
          name: 'Indian National Congress',
          logo_url: 'https://example.com/inc.png',
          alliance_id: 'abc',
          abbreviation: 'INC',
        },
      }),
    (error) =>
      error instanceof AppError &&
      error.statusCode === 422 &&
      error.message === 'alliance_id must be an integer'
  );
});

test('insertParty maps Supabase insert failures to AppError', async () => {
  const supabaseClient = createPartyClient({
    insertError: { message: 'insert failed' },
  });

  await assert.rejects(
    () =>
      insertParty({
        supabaseClient,
        payload: {
          name: 'Indian National Congress',
          logo_url: 'https://example.com/inc.png',
          alliance_id: 3,
          abbreviation: 'INC',
        },
      }),
    (error) => error instanceof AppError && error.statusCode === 502
  );
});

test('insertParty surfaces version update failures after a successful insert', async () => {
  const supabaseClient = createPartyClient({
    versionUpdateError: { message: 'update failed' },
  });

  await assert.rejects(
    () =>
      insertParty({
        supabaseClient,
        payload: {
          name: 'Indian National Congress',
          logo_url: 'https://example.com/inc.png',
          alliance_id: 3,
          abbreviation: 'INC',
        },
      }),
    (error) => error instanceof AppError && error.statusCode === 502
  );
});

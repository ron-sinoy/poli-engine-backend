'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { AppError } = require('../src/errors/AppError');
const { insertPerson, getTrendingPoliticians } = require('../src/services/person.service');

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

// --- trending politicians -------------------------------------------------

function createTrendingClient({ windows = {}, error = null }) {
  const calls = [];

  return {
    calls,
    rpc(functionName, args) {
      calls.push([functionName, args.since, args.match_count]);

      if (error) {
        return Promise.resolve({ data: null, error });
      }

      // Pick the canned result by how wide the requested window is.
      const ageDays = Math.round((Date.now() - Date.parse(args.since)) / 86400000);
      const key = ageDays <= 8 ? 'week' : ageDays <= 31 ? 'month' : 'all';
      return Promise.resolve({ data: windows[key] || [], error: null });
    },
  };
}

const ROW_A = {
  person_id: 2,
  name: 'V D Satheesan',
  photo_url: 'https://example.com/a.jpg',
  party_abbr: 'INC',
  alliance_abbr: 'UDF',
  alliance_color: '#3990e6',
  appearances: 12,
};
const ROW_B = {
  person_id: 1,
  name: 'Pinarayi Vijayan',
  photo_url: null,
  party_abbr: 'CPI(M)',
  alliance_abbr: 'LDF',
  alliance_color: '#E63946',
  appearances: 4,
};

const fillerRow = (personId) => ({
  ...ROW_B,
  person_id: personId,
  name: `Person ${personId}`,
});

const FULL_WEEK = [ROW_A, ROW_B, fillerRow(3), fillerRow(4), fillerRow(5)];

test('getTrendingPoliticians uses the 7-day window when it has enough people', async () => {
  const supabaseClient = createTrendingClient({ windows: { week: FULL_WEEK } });

  const result = await getTrendingPoliticians({ supabaseClient });

  assert.equal(result.length, 5);
  assert.equal(supabaseClient.calls.length, 1, 'must not widen when the week suffices');
  assert.equal(supabaseClient.calls[0][2], 5, 'asks for up to five people');
  assert.deepEqual(result[0], {
    person_id: 2,
    name: 'V D Satheesan',
    photo_url: 'https://example.com/a.jpg',
    party: 'INC',
    alliance: 'UDF',
    alliance_color: '#3990e6',
    score: 160, // 100 + 12 * 5
  });
  assert.equal(result[1].score, 120); // 100 + 4 * 5
  assert.equal(result[1].photo_url, null);
});

test('getTrendingPoliticians never exposes the raw appearance count', async () => {
  const supabaseClient = createTrendingClient({ windows: { week: FULL_WEEK } });

  const result = await getTrendingPoliticians({ supabaseClient });

  for (const politician of result) {
    assert.ok(!('appearances' in politician), 'appearances must not reach the client');
    assert.ok(politician.score >= 100, 'score starts at 100');
  }
});

test('getTrendingPoliticians widens the window until the carousel is full', async () => {
  const supabaseClient = createTrendingClient({
    windows: { week: [ROW_A, ROW_B], month: [ROW_A, ROW_B], all: FULL_WEEK },
  });

  const result = await getTrendingPoliticians({ supabaseClient });

  assert.equal(result.length, 5);
  assert.equal(supabaseClient.calls.length, 3, 'tries 7d, then 30d, then all-time');
  assert.deepEqual(supabaseClient.calls.map((c) => c[0]), [
    'trending_politicians',
    'trending_politicians',
    'trending_politicians',
  ]);
});

test('getTrendingPoliticians falls back to the widest partial window', async () => {
  const supabaseClient = createTrendingClient({
    windows: { week: [ROW_A], month: [ROW_A, ROW_B], all: [ROW_A, ROW_B] },
  });

  const result = await getTrendingPoliticians({ supabaseClient });

  assert.equal(result.length, 2, 'no window reached five, so the biggest result wins');
  assert.equal(supabaseClient.calls.length, 3, 'still checks every window');
});

test('getTrendingPoliticians returns a lone politician when nobody else exists', async () => {
  const supabaseClient = createTrendingClient({ windows: { week: [ROW_A], all: [ROW_A] } });

  const result = await getTrendingPoliticians({ supabaseClient });

  assert.equal(result.length, 1);
  assert.equal(result[0].person_id, ROW_A.person_id);
});

test('getTrendingPoliticians returns nothing when nobody has ever appeared', async () => {
  const supabaseClient = createTrendingClient({ windows: {} });

  assert.deepEqual(await getTrendingPoliticians({ supabaseClient }), []);
  assert.equal(supabaseClient.calls.length, 3, 'exhausts every window first');
});

test('getTrendingPoliticians maps rpc failures to AppError', async () => {
  const supabaseClient = createTrendingClient({ error: { message: 'rpc failed' } });

  await assert.rejects(
    () => getTrendingPoliticians({ supabaseClient }),
    (error) => error instanceof AppError && error.statusCode === 502
  );
});

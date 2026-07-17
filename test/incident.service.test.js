'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { AppError } = require('../src/errors/AppError');
const {
  insertIncident,
  insertWaitingList,
  loadWaitingListIncidentsContent,
  matchWaitingListIncidents,
  updateWaitingListStatus,
} = require('../src/services/incident.service');

function createIncidentClient({
  thread = { thread_id: 1, current_position: 2 },
  timelineEntryId = 11,
  timelineError = null,
  incidentError = null,
  incidentPersonsError = null,
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

          if (tableName === 'incidents') {
            return {
              data: { entry_id: timelineEntryId },
              error: incidentError,
            };
          }

          if (tableName === 'incident_persons') {
            return {
              data: { entry_id: timelineEntryId },
              error: incidentPersonsError,
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

// Serves the paginated vector-match chain: select().not()...eq().order().range().
// range() slices the rows so multi-page fetches terminate like PostgREST would.
// missingColumns simulates the pre-migration-001 live schema: any select that
// names source_url fails with 42703 the way Postgres would.
function createWaitingListMatchClient({ rows = [], error = null, missingColumns = false } = {}) {
  const calls = [];

  return {
    calls,
    from(tableName) {
      calls.push(['from', tableName]);
      let selectedColumns = '';

      const builder = {
        select(columns) {
          calls.push(['select', tableName, columns]);
          selectedColumns = columns;
          return builder;
        },
        not(column, operator, value) {
          calls.push(['not', tableName, column, operator, value]);
          return builder;
        },
        eq(column, value) {
          calls.push(['eq', tableName, column, value]);
          return builder;
        },
        order(column, options) {
          calls.push(['order', tableName, column, options]);
          return builder;
        },
        range(fromIndex, toIndex) {
          calls.push(['range', tableName, fromIndex, toIndex]);

          if (missingColumns && selectedColumns.includes('source_url')) {
            return Promise.resolve({
              data: null,
              error: { code: '42703', message: 'column waiting_list_incidents.source_url does not exist' },
            });
          }

          if (error) {
            return Promise.resolve({ data: null, error });
          }

          return Promise.resolve({ data: rows.slice(fromIndex, toIndex + 1), error: null });
        },
      };

      return builder;
    },
  };
}

function createWaitingListIncidentClient({ data = [], error = null } = {}) {
  const calls = [];

  return {
    calls,
    from(tableName) {
      calls.push(['from', tableName]);

      return {
        select(columns) {
          calls.push(['select', tableName, columns]);
          return this.wasUpdated ? this : Promise.resolve({ data, error });
        },
        insert(payload) {
          calls.push(['insert', tableName, payload]);
          return Promise.resolve({ data: null, error });
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
        maybeSingle() {
          calls.push(['maybeSingle', tableName]);
          return Promise.resolve({ data: error ? null : data, error });
        },
      };
    },
  };
}

test('insertIncident writes timeline, incident, incident_persons, and thread update without version change', async () => {
  const supabaseClient = createIncidentClient({});

  const entryId = await insertIncident({
    supabaseClient,
    payload: {
      thread_id: 1,
      body: 'Incident body',
      source_url: 'https://example.com/incident',
      persons_involved: [9, 10],
    },
  });

  assert.equal(entryId, 11);
  assert.deepEqual(supabaseClient.calls.slice(0, 18), [
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
        entry_type: 'incident',
        position: 2,
        published_at: supabaseClient.calls[6][2].published_at,
      },
    ],
    ['select', 'timeline_entries', 'entry_id'],
    ['limit', 'timeline_entries', 1],
    ['maybeSingle', 'timeline_entries'],
    ['from', 'incidents'],
    [
      'insert',
      'incidents',
      {
        entry_id: 11,
        body: 'Incident body',
        source_url: 'https://example.com/incident',
      },
    ],
    ['select', 'incidents', 'entry_id'],
    ['limit', 'incidents', 1],
    ['maybeSingle', 'incidents'],
    ['from', 'incident_persons'],
    [
      'insert',
      'incident_persons',
      [
        { entry_id: 11, person_id: 9 },
        { entry_id: 11, person_id: 10 },
      ],
    ],
    ['select', 'incident_persons', 'entry_id'],
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

test('insertIncident rejects invalid persons_involved payloads', async () => {
  const supabaseClient = createIncidentClient({});

  await assert.rejects(
    () =>
      insertIncident({
        supabaseClient,
        payload: {
          thread_id: 1,
          body: 'Incident body',
          source_url: 'https://example.com/incident',
          persons_involved: 'bad',
        },
      }),
    (error) =>
      error instanceof AppError &&
      error.statusCode === 422 &&
      error.message === 'persons_involved must be an array'
  );
});

test('insertIncident maps incident insert failures to AppError', async () => {
  const supabaseClient = createIncidentClient({
    incidentError: { message: 'insert failed' },
  });

  await assert.rejects(
    () =>
      insertIncident({
        supabaseClient,
        payload: {
          thread_id: 1,
          body: 'Incident body',
          source_url: 'https://example.com/incident',
          persons_involved: [9],
        },
      }),
    (error) => error instanceof AppError && error.statusCode === 502
  );
});

test('matchWaitingListIncidents ranks waiting rows in the backend by cosine similarity', async () => {
  const supabaseClient = createWaitingListMatchClient({
    rows: [
      { id: 1, content: 'Alpha', source_url: 'https://example.com/1', source_id: 'mt_#a', vectors: '[0,1]' },
      { id: 2, content: 'Beta', source_url: 'https://example.com/2', source_id: 'mt_#b', vectors: '[1,0]' },
      // Wrong dimension (legacy placeholder): must be skipped, not scored.
      { id: 3, content: 'Gamma', source_url: 'https://example.com/3', source_id: 'mt_#c', vectors: '[1,0,0]' },
    ],
  });

  const result = await matchWaitingListIncidents({
    supabaseClient,
    payload: { vectors: [1, 0], match_count: 2 },
  });

  assert.deepEqual(result, [
    { id: 2, content: 'Beta', source_url: 'https://example.com/2', source_id: 'mt_#b', score: 1 },
    { id: 1, content: 'Alpha', source_url: 'https://example.com/1', source_id: 'mt_#a', score: 0 },
  ]);
  // Only waiting rows that can still form a thread are eligible.
  assert.ok(
    supabaseClient.calls.some(
      (call) => call[0] === 'not' && call[2] === 'vectors' && call[3] === 'is' && call[4] === null
    )
  );
  assert.ok(
    supabaseClient.calls.some(
      (call) => call[0] === 'not' && call[2] === 'source_url' && call[3] === 'is' && call[4] === null
    )
  );
  assert.ok(
    supabaseClient.calls.some(
      (call) => call[0] === 'eq' && call[2] === 'status' && call[3] === 'waiting'
    )
  );
});

test('matchWaitingListIncidents defaults match_count to 3', async () => {
  const supabaseClient = createWaitingListMatchClient({
    rows: [
      { id: 1, content: 'A', source_url: 'https://example.com/1', source_id: 'mt_#a', vectors: '[1,0]' },
      { id: 2, content: 'B', source_url: 'https://example.com/2', source_id: 'mt_#b', vectors: '[1,1]' },
      { id: 3, content: 'C', source_url: 'https://example.com/3', source_id: 'mt_#c', vectors: '[0,1]' },
      { id: 4, content: 'D', source_url: 'https://example.com/4', source_id: 'mt_#d', vectors: '[-1,0]' },
    ],
  });

  const result = await matchWaitingListIncidents({ supabaseClient, payload: { vectors: [1, 0] } });

  assert.deepEqual(result.map((row) => row.id), [1, 2, 3]);
});

test('matchWaitingListIncidents pages through more than one page of vectors', async () => {
  const rows = Array.from({ length: 150 }, (_, index) => ({
    id: index + 1,
    content: `Incident ${index + 1}`,
    source_url: `https://example.com/${index + 1}`,
    source_id: `mt_#${index + 1}`,
    vectors: '[1,0]',
  }));
  const supabaseClient = createWaitingListMatchClient({ rows });

  const result = await matchWaitingListIncidents({ supabaseClient, payload: { vectors: [1, 0] } });

  assert.equal(result.length, 3);
  assert.deepEqual(
    supabaseClient.calls
      .filter((call) => call[0] === 'range')
      .map((call) => [call[2], call[3]]),
    [
      [0, 99],
      [100, 199],
    ]
  );
});

test('matchWaitingListIncidents falls back to the legacy schema when migration 001 columns are missing', async () => {
  const supabaseClient = createWaitingListMatchClient({
    missingColumns: true,
    rows: [
      { id: 1, content: 'Alpha', vectors: '[0,1]' },
      { id: 2, content: 'Beta', vectors: '[1,0]' },
    ],
  });

  const result = await matchWaitingListIncidents({
    supabaseClient,
    payload: { vectors: [1, 0], match_count: 2 },
  });

  assert.deepEqual(result, [
    { id: 2, content: 'Beta', score: 1, source_url: null, source_id: null },
    { id: 1, content: 'Alpha', score: 0, source_url: null, source_id: null },
  ]);
  // The legacy retry selects only the columns that exist.
  assert.ok(
    supabaseClient.calls.some((call) => call[0] === 'select' && call[2] === 'id,content,vectors')
  );
});

test('matchWaitingListIncidents rejects a missing query vector', async () => {
  const supabaseClient = createWaitingListMatchClient({});

  await assert.rejects(
    () => matchWaitingListIncidents({ supabaseClient, payload: { match_count: 3 } }),
    (error) => error instanceof AppError && error.statusCode === 422 && error.message === 'vectors is required'
  );
});

test('matchWaitingListIncidents maps Supabase read failures to AppError', async () => {
  const supabaseClient = createWaitingListMatchClient({ error: { message: 'read failed' } });

  await assert.rejects(
    () => matchWaitingListIncidents({ supabaseClient, payload: { vectors: [0.1, 0.2] } }),
    (error) => error instanceof AppError && error.statusCode === 502
  );
});

test('updateWaitingListStatus marks a consumed row so it cannot spawn the same thread again', async () => {
  const supabaseClient = createWaitingListIncidentClient({ data: { id: 5, status: 'completed' } });

  await updateWaitingListStatus({ supabaseClient, payload: { id: 5, status: 'completed' } });

  assert.deepEqual(supabaseClient.calls, [
    ['from', 'waiting_list_incidents'],
    ['update', 'waiting_list_incidents', { status: 'completed' }],
    ['eq', 'waiting_list_incidents', 'id', 5],
    ['select', 'waiting_list_incidents', 'id,status'],
    ['limit', 'waiting_list_incidents', 1],
    ['maybeSingle', 'waiting_list_incidents'],
  ]);
});

test('updateWaitingListStatus returns not found for an unknown id', async () => {
  const supabaseClient = createWaitingListIncidentClient({ data: null });

  await assert.rejects(
    () => updateWaitingListStatus({ supabaseClient, payload: { id: 404, status: 'completed' } }),
    (error) => error instanceof AppError && error.statusCode === 404
  );
});

test('updateWaitingListStatus deletes the row when the legacy schema has no status column', async () => {
  const calls = [];
  const supabaseClient = {
    from(tableName) {
      const builder = {
        update(payload) {
          calls.push(['update', tableName, payload]);
          return builder;
        },
        delete() {
          calls.push(['delete', tableName]);
          return builder;
        },
        eq(column, value) {
          calls.push(['eq', tableName, column, value]);
          return builder;
        },
        select(columns) {
          calls.push(['select', tableName, columns]);
          return builder;
        },
        limit() {
          return builder;
        },
        maybeSingle() {
          const wasDelete = calls.some((call) => call[0] === 'delete');

          if (wasDelete) {
            return Promise.resolve({ data: { id: 5 }, error: null });
          }

          return Promise.resolve({
            data: null,
            error: { code: 'PGRST204', message: "Could not find the 'status' column" },
          });
        },
      };

      return builder;
    },
  };

  await updateWaitingListStatus({ supabaseClient, payload: { id: 5, status: 'completed' } });

  assert.ok(calls.some((call) => call[0] === 'delete' && call[1] === 'waiting_list_incidents'));
  assert.ok(calls.some((call) => call[0] === 'eq' && call[2] === 'id' && call[3] === 5));
});

test('insertWaitingList retries with only content and vectors on the legacy schema', async () => {
  const inserts = [];
  const supabaseClient = {
    from() {
      return {
        insert(payload) {
          inserts.push(payload);

          if (inserts.length === 1) {
            return Promise.resolve({
              data: null,
              error: { code: 'PGRST204', message: "Could not find the 'source_url' column" },
            });
          }

          return Promise.resolve({ data: null, error: null });
        },
      };
    },
  };

  await insertWaitingList({
    supabaseClient,
    payload: {
      content: 'Alpha',
      vectors: [0.1, 0.2],
      source_url: 'https://example.com/alpha',
      source_id: 'mt_#alpha',
    },
  });

  assert.equal(inserts.length, 2);
  assert.deepEqual(inserts[1], { content: 'Alpha', vectors: [0.1, 0.2] });
});

test('loadWaitingListIncidentsContent returns source_url so a row can be promoted to an incident', async () => {
  const incidents = [
    { id: 1, content: 'Alpha', source_url: 'https://example.com/1', source_id: 'mt_#a' },
    { id: 2, content: 'Beta', source_url: 'https://example.com/2', source_id: 'mt_#b' },
  ];
  const supabaseClient = createWaitingListIncidentClient({ data: incidents });

  const result = await loadWaitingListIncidentsContent({ supabaseClient });

  assert.deepEqual(result, incidents);
  assert.deepEqual(supabaseClient.calls, [
    ['from', 'waiting_list_incidents'],
    ['select', 'waiting_list_incidents', 'id,content,source_url,source_id'],
  ]);
});

test('loadWaitingListIncidentsContent maps Supabase read failures to AppError', async () => {
  const supabaseClient = createWaitingListIncidentClient({
    error: { message: 'read failed' },
  });

  await assert.rejects(
    () => loadWaitingListIncidentsContent({ supabaseClient }),
    (error) => error instanceof AppError && error.statusCode === 502
  );
});

test('insertWaitingList persists source_url and source_id alongside content and vectors', async () => {
  const supabaseClient = createWaitingListIncidentClient();

  await insertWaitingList({
    supabaseClient,
    payload: {
      content: 'Alpha',
      vectors: [0.1, 0.2],
      source_url: 'https://example.com/alpha',
      source_id: 'mt_#alpha',
    },
  });

  // Dropping source_url here is what produced threads holding a single
  // incident: the row could never be posted back as an incident.
  assert.deepEqual(supabaseClient.calls, [
    ['from', 'waiting_list_incidents'],
    [
      'insert',
      'waiting_list_incidents',
      {
        content: 'Alpha',
        vectors: [0.1, 0.2],
        source_url: 'https://example.com/alpha',
        source_id: 'mt_#alpha',
      },
    ],
  ]);
  assert.ok(!supabaseClient.calls.some((call) => call[1] === 'version_log'));
});

test('insertWaitingList rejects a row with no source_url', async () => {
  const supabaseClient = createWaitingListIncidentClient();

  await assert.rejects(
    () =>
      insertWaitingList({
        supabaseClient,
        payload: {
          content: 'Alpha',
          vectors: [0.1, 0.2],
          source_id: 'mt_#alpha',
        },
      }),
    (error) =>
      error instanceof AppError && error.statusCode === 422 && error.message === 'source_url is required'
  );
});

test('insertWaitingList rejects missing content', async () => {
  const supabaseClient = createWaitingListIncidentClient();

  await assert.rejects(
    () =>
      insertWaitingList({
        supabaseClient,
        payload: {
          vectors: [0.1, 0.2],
          source_url: 'https://example.com/alpha',
          source_id: 'mt_#alpha',
        },
      }),
    (error) => error instanceof AppError && error.statusCode === 422 && error.message === 'content is required'
  );
});

test('insertWaitingList rejects missing vectors', async () => {
  const supabaseClient = createWaitingListIncidentClient();

  await assert.rejects(
    () =>
      insertWaitingList({
        supabaseClient,
        payload: {
          content: 'Alpha',
          source_url: 'https://example.com/alpha',
          source_id: 'mt_#alpha',
        },
      }),
    (error) =>
      error instanceof AppError && error.statusCode === 422 && error.message === 'vectors is required'
  );
});

test('insertWaitingList maps Supabase insert failures to AppError', async () => {
  const supabaseClient = createWaitingListIncidentClient({
    error: { message: 'insert failed' },
  });

  await assert.rejects(
    () =>
      insertWaitingList({
        supabaseClient,
        payload: {
          content: 'Alpha',
          vectors: [0.1, 0.2],
          source_url: 'https://example.com/alpha',
          source_id: 'mt_#alpha',
        },
      }),
    (error) => error instanceof AppError && error.statusCode === 502
  );
});

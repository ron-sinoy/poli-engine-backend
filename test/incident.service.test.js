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

function createWaitingListIncidentClient({ data = [], error = null } = {}) {
  const calls = [];

  return {
    calls,
    rpc(functionName, args) {
      calls.push(['rpc', functionName, args]);
      return Promise.resolve({ data, error });
    },
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

test('matchWaitingListIncidents ranks in Postgres instead of reading every vector', async () => {
  const incidents = [
    { id: 1, content: 'Alpha', source_url: 'https://example.com/1', source_id: 'mt_#a', score: 0.91 },
    { id: 2, content: 'Beta', source_url: 'https://example.com/2', source_id: 'mt_#b', score: 0.87 },
  ];
  const supabaseClient = createWaitingListIncidentClient({ data: incidents });

  const result = await matchWaitingListIncidents({
    supabaseClient,
    payload: { vectors: [0.1, 0.2], match_count: 2 },
  });

  assert.deepEqual(result, incidents);
  assert.deepEqual(supabaseClient.calls, [
    ['rpc', 'match_waiting_list_incidents', { query_vector: [0.1, 0.2], match_count: 2 }],
  ]);
  // The whole point of the RPC: no table read, so no 3072-dim payload.
  assert.ok(!supabaseClient.calls.some((call) => call[0] === 'from'));
});

test('matchWaitingListIncidents defaults match_count to 3', async () => {
  const supabaseClient = createWaitingListIncidentClient({ data: [] });

  await matchWaitingListIncidents({ supabaseClient, payload: { vectors: [0.1, 0.2] } });

  assert.deepEqual(supabaseClient.calls, [
    ['rpc', 'match_waiting_list_incidents', { query_vector: [0.1, 0.2], match_count: 3 }],
  ]);
});

test('matchWaitingListIncidents rejects a missing query vector', async () => {
  const supabaseClient = createWaitingListIncidentClient({ data: [] });

  await assert.rejects(
    () => matchWaitingListIncidents({ supabaseClient, payload: { match_count: 3 } }),
    (error) => error instanceof AppError && error.statusCode === 422 && error.message === 'vectors is required'
  );
});

test('matchWaitingListIncidents maps Supabase rpc failures to AppError', async () => {
  const supabaseClient = createWaitingListIncidentClient({ error: { message: 'rpc failed' } });

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

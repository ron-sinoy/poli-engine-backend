'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { AppError } = require('../src/errors/AppError');
const {
  insertIncident,
  insertWaitingList,
  loadWaitingListIncidentsContent,
  loadWaitingListIncidentsVectors,
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
    from(tableName) {
      calls.push(['from', tableName]);

      return {
        select(columns) {
          calls.push(['select', tableName, columns]);
          return Promise.resolve({ data, error });
        },
        insert(payload) {
          calls.push(['insert', tableName, payload]);
          return Promise.resolve({ data: null, error });
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

test('loadWaitingListIncidentsVectors reads id and vectors rows from waiting_list_incidents', async () => {
  const incidents = [
    { id: 1, vectors: [0.1, 0.2] },
    { id: 2, vectors: [0.3, 0.4] },
  ];
  const supabaseClient = createWaitingListIncidentClient({ data: incidents });

  const result = await loadWaitingListIncidentsVectors({ supabaseClient });

  assert.deepEqual(result, incidents);
  assert.deepEqual(supabaseClient.calls, [
    ['from', 'waiting_list_incidents'],
    ['select', 'waiting_list_incidents', 'id,vectors'],
  ]);
});

test('loadWaitingListIncidentsContent reads id and content rows from waiting_list_incidents', async () => {
  const incidents = [
    { id: 1, content: 'Alpha' },
    { id: 2, content: 'Beta' },
  ];
  const supabaseClient = createWaitingListIncidentClient({ data: incidents });

  const result = await loadWaitingListIncidentsContent({ supabaseClient });

  assert.deepEqual(result, incidents);
  assert.deepEqual(supabaseClient.calls, [
    ['from', 'waiting_list_incidents'],
    ['select', 'waiting_list_incidents', 'id,content'],
  ]);
});

test('loadWaitingListIncidentsVectors maps Supabase read failures to AppError', async () => {
  const supabaseClient = createWaitingListIncidentClient({
    error: { message: 'read failed' },
  });

  await assert.rejects(
    () => loadWaitingListIncidentsVectors({ supabaseClient }),
    (error) => error instanceof AppError && error.statusCode === 502
  );
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

test('insertWaitingList writes content and vectors to waiting_list_incidents without updating version_log', async () => {
  const supabaseClient = createWaitingListIncidentClient();

  await insertWaitingList({
    supabaseClient,
    payload: {
      content: 'Alpha',
      vectors: [0.1, 0.2],
    },
  });

  assert.deepEqual(supabaseClient.calls, [
    ['from', 'waiting_list_incidents'],
    ['insert', 'waiting_list_incidents', { content: 'Alpha', vectors: [0.1, 0.2] }],
  ]);
  assert.ok(!supabaseClient.calls.some((call) => call[1] === 'version_log'));
});

test('insertWaitingList rejects missing content', async () => {
  const supabaseClient = createWaitingListIncidentClient();

  await assert.rejects(
    () =>
      insertWaitingList({
        supabaseClient,
        payload: {
          vectors: [0.1, 0.2],
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
        },
      }),
    (error) => error instanceof AppError && error.statusCode === 502
  );
});

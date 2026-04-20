'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { AppError } = require('../src/errors/AppError');
const { insertIncident } = require('../src/services/incident.service');

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

test('insertIncident writes timeline, incident, incident_persons, and thread update without version change', async () => {
  const supabaseClient = createIncidentClient({});

  const entryId = await insertIncident({
    supabaseClient,
    payload: {
      thread_id: 1,
      body: 'Incident body',
      source_url: 'https://example.com/incident',
      persons_involved: [9, 10],
      published_at: '2026-04-13T10:00:00.000Z',
      position: 3,
    },
  });

  assert.equal(entryId, 11);
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
        entry_type: 'incident',
        position: 3,
        published_at: '2026-04-13T10:00:00.000Z',
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
    ['limit', 'incident_persons', 1],
    ['maybeSingle', 'incident_persons'],
  ]);
  assert.ok(supabaseClient.calls.some((call) => call[0] === 'update' && call[1] === 'threads'));
  assert.ok(!supabaseClient.calls.some((call) => call[1] === 'version_log'));
});

test('insertIncident rejects invalid published_at values', async () => {
  const supabaseClient = createIncidentClient({});

  await assert.rejects(
    () =>
      insertIncident({
        supabaseClient,
        payload: {
          thread_id: 1,
          body: 'Incident body',
          source_url: 'https://example.com/incident',
          persons_involved: [9],
          published_at: 'bad',
          position: 3,
        },
      }),
    (error) =>
      error instanceof AppError &&
      error.statusCode === 422 &&
      error.message === 'published_at must be a valid ISO timestamp'
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
          published_at: '2026-04-13T10:00:00.000Z',
          position: 3,
        },
      }),
    (error) => error instanceof AppError && error.statusCode === 502
  );
});

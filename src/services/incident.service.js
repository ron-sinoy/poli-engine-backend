'use strict';

const { AppError } = require('../errors/AppError');
const incidentRepository = require('../repositories/incident.repository');
const threadRepository = require('../repositories/thread.repository');

function requireNonEmptyString(value, fieldName) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new AppError(422, `${fieldName} is required`);
  }

  return value.trim();
}

function requireInteger(value, fieldName) {
  const parsedValue = Number(value);

  if (!Number.isSafeInteger(parsedValue)) {
    throw new AppError(422, `${fieldName} must be an integer`);
  }

  return parsedValue;
}

function requireIntegerArray(values, fieldName) {
  if (!Array.isArray(values)) {
    throw new AppError(422, `${fieldName} must be an array`);
  }

  return values.map((value) => requireInteger(value, `${fieldName} item`));
}

function validateVectors(value) {
  if (value === undefined || value === null) {
    throw new AppError(422, 'vectors is required');
  }

  if (!Array.isArray(value)) {
    throw new AppError(422, 'vectors must be an array');
  }

  return value;
}

function validateInsertIncidentPayload(payload = {}) {
  return {
    thread_id: requireInteger(payload.thread_id, 'thread_id'),
    body: requireNonEmptyString(payload.body, 'body'),
    source_url: requireNonEmptyString(payload.source_url, 'source_url'),
    persons_involved: requireIntegerArray(payload.persons_involved, 'persons_involved'),
  };
}

function validateInsertWaitingListPayload(payload = {}) {
  return {
    content: requireNonEmptyString(payload.content, 'content'),
    vectors: validateVectors(payload.vectors),
    // Required: a row that cannot produce a source_url can never be promoted
    // into an incident, because POST /incidents rejects it.
    source_url: requireNonEmptyString(payload.source_url, 'source_url'),
    source_id: requireNonEmptyString(payload.source_id, 'source_id'),
  };
}

function validateMatchPayload(payload = {}) {
  const matchCount = payload.match_count === undefined ? 3 : requireInteger(payload.match_count, 'match_count');

  if (matchCount < 1) {
    throw new AppError(422, 'match_count must be at least 1');
  }

  return {
    queryVector: validateVectors(payload.vectors),
    matchCount,
  };
}

function validateUpdateWaitingListPayload(payload = {}) {
  return {
    id: requireInteger(payload.id, 'id'),
    status: requireNonEmptyString(payload.status, 'status'),
  };
}

async function loadThreadProgressOrFail({ supabaseClient, threadId }) {
  const { data, error } = await threadRepository.getThreadProgressById({
    supabaseClient,
    threadId,
  });

  if (error) {
    throw new AppError(502, 'Failed to load thread progress from Supabase', error);
  }

  if (!data) {
    throw new AppError(404, 'Thread not found');
  }

  return data;
}

async function matchWaitingListIncidents({ supabaseClient, payload }) {
  const { queryVector, matchCount } = validateMatchPayload(payload);
  const { data, error } = await incidentRepository.matchWaitingListIncidents({
    supabaseClient,
    queryVector,
    matchCount,
  });

  if (error) {
    throw new AppError(502, 'Failed to match waiting list incidents in Supabase', error);
  }

  return data || [];
}

async function updateWaitingListStatus({ supabaseClient, payload }) {
  const { id, status } = validateUpdateWaitingListPayload(payload);
  const { data, error } = await incidentRepository.updateWaitingListStatus({
    supabaseClient,
    id,
    status,
  });

  if (error) {
    throw new AppError(502, 'Failed to update waiting list status in Supabase', error);
  }

  if (!data) {
    throw new AppError(404, 'Waiting list incident was not found');
  }
}

async function loadWaitingListIncidentsContent({ supabaseClient }) {
  const { data, error } = await incidentRepository.loadWaitingListIncidentsContent({
    supabaseClient,
  });

  if (error) {
    throw new AppError(502, 'Failed to load waiting list incident content from Supabase', error);
  }

  return data || [];
}

async function insertIncident({ supabaseClient, payload }) {
  const incident = validateInsertIncidentPayload(payload);
  const thread = await loadThreadProgressOrFail({
    supabaseClient,
    threadId: incident.thread_id,
  });
  const entryPosition = Number(thread.current_position);
  const timestamp = new Date().toISOString();
  const { data: timelineEntry, error: timelineError } = await incidentRepository.insertTimelineEntry({
    supabaseClient,
    timelineEntry: {
      thread_id: incident.thread_id,
      entry_type: 'incident',
      position: entryPosition,
      published_at: timestamp,
    },
  });

  if (timelineError) {
    throw new AppError(502, 'Failed to insert timeline entry into Supabase', timelineError);
  }

  if (!timelineEntry) {
    throw new AppError(502, 'Failed to insert timeline entry into Supabase');
  }

  const { error: incidentError } = await incidentRepository.insertIncident({
    supabaseClient,
    incident: {
      entry_id: timelineEntry.entry_id,
      body: incident.body,
      source_url: incident.source_url,
    },
  });

  if (incidentError) {
    throw new AppError(502, 'Failed to insert incident into Supabase', incidentError);
  }

  if (incident.persons_involved.length) {
    const { error: incidentPersonsError } = await incidentRepository.insertIncidentPersons({
      supabaseClient,
      rows: incident.persons_involved.map((personId) => ({
        entry_id: timelineEntry.entry_id,
        person_id: personId,
      })),
    });

    if (incidentPersonsError) {
      throw new AppError(
        502,
        'Failed to insert incident persons into Supabase',
        incidentPersonsError
      );
    }
  }

  const { error: threadUpdateError } = await threadRepository.updateThreadProgress({
    supabaseClient,
    threadId: incident.thread_id,
    updatedAt: timestamp,
    currentPosition: entryPosition + 1,
  });

  if (threadUpdateError) {
    throw new AppError(502, 'Failed to update thread progress in Supabase', threadUpdateError);
  }

  return timelineEntry.entry_id;
}

async function insertWaitingList({ supabaseClient, payload }) {
  const waitingListRow = validateInsertWaitingListPayload(payload);
  const { error } = await incidentRepository.insertWaitingList({
    supabaseClient,
    waitingListRow,
  });

  if (error) {
    throw new AppError(502, 'Failed to insert waiting list row into Supabase', error);
  }
}

module.exports = {
  matchWaitingListIncidents,
  loadWaitingListIncidentsContent,
  updateWaitingListStatus,
  insertIncident,
  insertWaitingList,
};

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

function requireIsoTimestamp(value, fieldName) {
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) {
    throw new AppError(422, `${fieldName} must be a valid ISO timestamp`);
  }

  return value;
}

function requireIntegerArray(values, fieldName) {
  if (!Array.isArray(values)) {
    throw new AppError(422, `${fieldName} must be an array`);
  }

  return values.map((value) => requireInteger(value, `${fieldName} item`));
}

function validateInsertIncidentPayload(payload = {}) {
  return {
    thread_id: requireInteger(payload.thread_id, 'thread_id'),
    body: requireNonEmptyString(payload.body, 'body'),
    source_url: requireNonEmptyString(payload.source_url, 'source_url'),
    persons_involved: requireIntegerArray(payload.persons_involved, 'persons_involved'),
    published_at: requireIsoTimestamp(payload.published_at, 'published_at'),
    position: requireInteger(payload.position, 'position'),
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

async function insertIncident({ supabaseClient, payload, versionService }) {
  const incident = validateInsertIncidentPayload(payload);
  const thread = await loadThreadProgressOrFail({
    supabaseClient,
    threadId: incident.thread_id,
  });
  const { data: timelineEntry, error: timelineError } = await incidentRepository.insertTimelineEntry({
    supabaseClient,
    timelineEntry: {
      thread_id: incident.thread_id,
      entry_type: 'incident',
      position: incident.position,
      published_at: incident.published_at,
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

  const updatedAt = new Date().toISOString();
  const { error: threadUpdateError } = await threadRepository.updateThreadProgress({
    supabaseClient,
    threadId: incident.thread_id,
    updatedAt,
    currentPosition: Number(thread.current_position) + 1,
  });

  if (threadUpdateError) {
    throw new AppError(502, 'Failed to update thread progress in Supabase', threadUpdateError);
  }

  await versionService.updateVersion({ supabaseClient });

  return timelineEntry.entry_id;
}

module.exports = {
  insertIncident,
};

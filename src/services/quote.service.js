'use strict';

const { AppError } = require('../errors/AppError');
const quoteRepository = require('../repositories/quote.repository');
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

function validateInsertQuotePayload(payload = {}) {
  return {
    thread_id: requireInteger(payload.thread_id, 'thread_id'),
    quote_text: requireNonEmptyString(payload.quote_text, 'quote_text'),
    source_url: requireNonEmptyString(payload.source_url, 'source_url'),
    speaker_id: requireInteger(payload.speaker_id, 'speaker_id'),
    persons_involved: requireIntegerArray(payload.persons_involved, 'persons_involved'),
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

async function insertQuote({ supabaseClient, payload }) {
  const quote = validateInsertQuotePayload(payload);
  const thread = await loadThreadProgressOrFail({
    supabaseClient,
    threadId: quote.thread_id,
  });
  const entryPosition = Number(thread.current_position);
  const timestamp = new Date().toISOString();
  const { data: timelineEntry, error: timelineError } = await quoteRepository.insertTimelineEntry({
    supabaseClient,
    timelineEntry: {
      thread_id: quote.thread_id,
      entry_type: 'quote',
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

  const { error: quoteError } = await quoteRepository.insertQuote({
    supabaseClient,
    quote: {
      entry_id: timelineEntry.entry_id,
      quote_text: quote.quote_text,
      source_url: quote.source_url,
      speaker_id: quote.speaker_id,
    },
  });

  if (quoteError) {
    throw new AppError(502, 'Failed to insert quote into Supabase', quoteError);
  }

  if (quote.persons_involved.length) {
    const { error: quotePersonsError } = await quoteRepository.insertQuotePersons({
      supabaseClient,
      rows: quote.persons_involved.map((personId) => ({
        entry_id: timelineEntry.entry_id,
        person_id: personId,
      })),
    });

    if (quotePersonsError) {
      throw new AppError(502, 'Failed to insert quote persons into Supabase', quotePersonsError);
    }
  }

  const { error: threadUpdateError } = await threadRepository.updateThreadProgress({
    supabaseClient,
    threadId: quote.thread_id,
    updatedAt: timestamp,
    currentPosition: entryPosition + 1,
  });

  if (threadUpdateError) {
    throw new AppError(502, 'Failed to update thread progress in Supabase', threadUpdateError);
  }

  return timelineEntry.entry_id;
}

module.exports = {
  insertQuote,
};

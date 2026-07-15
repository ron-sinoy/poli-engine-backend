'use strict';

const { AppError } = require('../errors/AppError');
const threadRepository = require('../repositories/thread.repository');

function unique(values) {
  return [...new Set(values.filter((value) => value !== null && value !== undefined))];
}

function indexBy(rows, key) {
  return new Map(rows.map((row) => [row[key], row]));
}

function groupBy(rows, key) {
  return rows.reduce((groups, row) => {
    const groupKey = row[key];
    const group = groups.get(groupKey) || [];
    group.push(row);
    groups.set(groupKey, group);
    return groups;
  }, new Map());
}

function publicPerson({ person, politiciansById, partiesById, alliancesById }) {
  if (!person) {
    return null;
  }

  const politician = politiciansById.get(person.politician_id);
  const party = partiesById.get(politician?.party_id);
  const alliance = alliancesById.get(party?.alliance_id);

  return {
    name: person.name,
    photo_url: person.photo_url,
    party: party
      ? {
          name: party.name,
        }
      : null,
    alliance: alliance
      ? {
          name: alliance.name,
          color: alliance.color ?? null,
        }
      : null,
  };
}

function requireNonEmptyString(value, fieldName) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new AppError(422, `${fieldName} is required`);
  }

  return value.trim();
}

async function readOrFail(operation, failureMessage) {
  const { data, error } = await operation;

  if (error) {
    throw new AppError(502, failureMessage, error);
  }

  return data || [];
}

async function loadThreadsList({ supabaseClient }) {
  const { data, error } = await threadRepository.loadThreadsList({ supabaseClient });

  if (error) {
    throw new AppError(502, 'Failed to load threads from Supabase', error);
  }

  return data || [];
}

async function loadThreadsInternal({ supabaseClient }) {
  const { data, error } = await threadRepository.loadThreadsInternal({ supabaseClient });

  if (error) {
    throw new AppError(502, 'Failed to load internal threads from Supabase', error);
  }

  return data || [];
}

async function matchThreads({ supabaseClient, payload }) {
  const queryVector = payload?.vectors;

  if (!Array.isArray(queryVector)) {
    throw new AppError(422, 'vectors must be an array');
  }

  const matchCount = payload?.match_count === undefined ? 3 : Number(payload.match_count);

  if (!Number.isSafeInteger(matchCount) || matchCount < 1) {
    throw new AppError(422, 'match_count must be an integer of at least 1');
  }

  const { data, error } = await threadRepository.matchThreads({
    supabaseClient,
    queryVector,
    matchCount,
  });

  if (error) {
    throw new AppError(502, 'Failed to match threads in Supabase', error);
  }

  return data || [];
}

async function insertThread({ supabaseClient, payload }) {
  const title = requireNonEmptyString(payload?.title, 'title');
  const summary = requireNonEmptyString(payload?.summary, 'summary');
  const timestamp = new Date().toISOString();
  const { data, error } = await threadRepository.insertThread({
    supabaseClient,
    thread: {
      title,
      summary,
      created_at: timestamp,
      updated_at: payload?.updated_at ?? timestamp,
      vectors: payload?.vectors ?? null,
      current_position: 0,
    },
  });

  if (error) {
    throw new AppError(502, 'Failed to insert thread into Supabase', error);
  }

  if (!data) {
    throw new AppError(502, 'Failed to insert thread into Supabase');
  }

  return data.thread_id;
}

async function getThreadById({ supabaseClient, threadId }) {
  const { data: thread, error: threadError } = await threadRepository.getThreadById({
    supabaseClient,
    threadId,
  });

  if (threadError) {
    throw new AppError(502, 'Failed to load thread from Supabase', threadError);
  }

  if (!thread) {
    throw new AppError(404, 'Thread not found');
  }

  const timelineEntries = await readOrFail(
    threadRepository.loadTimelineEntries({ supabaseClient, threadId }),
    'Failed to load timeline entries from Supabase'
  );
  const incidentEntryIds = timelineEntries
    .filter((entry) => entry.entry_type === 'incident')
    .map((entry) => entry.entry_id);
  const quoteEntryIds = timelineEntries
    .filter((entry) => entry.entry_type === 'quote')
    .map((entry) => entry.entry_id);

  const [incidents, quotes, incidentPersons, quotePersons] = await Promise.all([
    incidentEntryIds.length
      ? readOrFail(
          threadRepository.loadIncidentsByEntryIds({ supabaseClient, entryIds: incidentEntryIds }),
          'Failed to load incidents from Supabase'
        )
      : [],
    quoteEntryIds.length
      ? readOrFail(
          threadRepository.loadQuotesByEntryIds({ supabaseClient, entryIds: quoteEntryIds }),
          'Failed to load quotes from Supabase'
        )
      : [],
    incidentEntryIds.length
      ? readOrFail(
          threadRepository.loadIncidentPersonsByEntryIds({
            supabaseClient,
            entryIds: incidentEntryIds,
          }),
          'Failed to load incident persons from Supabase'
        )
      : [],
    quoteEntryIds.length
      ? readOrFail(
          threadRepository.loadQuotePersonsByEntryIds({ supabaseClient, entryIds: quoteEntryIds }),
          'Failed to load quote persons from Supabase'
        )
      : [],
  ]);

  const speakerIds = quotes.map((quote) => quote.speaker_id);
  const involvedPersonIds = [...incidentPersons, ...quotePersons].map((row) => row.person_id);
  const personIds = unique([...speakerIds, ...involvedPersonIds]);
  const persons = personIds.length
    ? await readOrFail(
        threadRepository.loadPersonsByIds({
          supabaseClient,
          personIds,
        }),
        'Failed to load persons from Supabase'
      )
    : [];

  const politicianIds = unique(persons.map((person) => person.politician_id));
  const politicians = politicianIds.length
    ? await readOrFail(
        threadRepository.loadPoliticiansByIds({ supabaseClient, politicianIds }),
        'Failed to load politicians from Supabase'
      )
    : [];

  const partyIds = unique(politicians.map((politician) => politician.party_id));
  const parties = partyIds.length
    ? await readOrFail(
        threadRepository.loadPartiesByIds({ supabaseClient, partyIds }),
        'Failed to load parties from Supabase'
      )
    : [];

  const allianceIds = unique(parties.map((party) => party.alliance_id));
  const alliances = allianceIds.length
    ? await readOrFail(
        threadRepository.loadAlliancesByIds({ supabaseClient, allianceIds }),
        'Failed to load alliances from Supabase'
      )
    : [];

  const incidentsByEntryId = indexBy(incidents, 'entry_id');
  const quotesByEntryId = indexBy(quotes, 'entry_id');
  const incidentPersonsByEntryId = groupBy(incidentPersons, 'entry_id');
  const quotePersonsByEntryId = groupBy(quotePersons, 'entry_id');
  const personsById = indexBy(persons, 'person_id');
  const politiciansById = indexBy(politicians, 'politician_id');
  const partiesById = indexBy(parties, 'party_id');
  const alliancesById = indexBy(alliances, 'alliance_id');

  const entries = timelineEntries.map((entry) => {
    const baseEntry = {
      entry_type: entry.entry_type,
      position: entry.position,
      published_at: entry.published_at,
    };

    if (entry.entry_type === 'incident') {
      return {
        ...baseEntry,
        body: incidentsByEntryId.get(entry.entry_id)?.body ?? null,
        persons_involved: (incidentPersonsByEntryId.get(entry.entry_id) || [])
          .map((row) =>
            publicPerson({
              person: personsById.get(row.person_id),
              politiciansById,
              partiesById,
              alliancesById,
            })
          )
          .filter(Boolean),
      };
    }

    if (entry.entry_type === 'quote') {
      const quote = quotesByEntryId.get(entry.entry_id);

      return {
        ...baseEntry,
        quote_text: quote?.quote_text ?? null,
        speaker: publicPerson({
          person: personsById.get(quote?.speaker_id),
          politiciansById,
          partiesById,
          alliancesById,
        }),
        persons_involved: (quotePersonsByEntryId.get(entry.entry_id) || [])
          .map((row) =>
            publicPerson({
              person: personsById.get(row.person_id),
              politiciansById,
              partiesById,
              alliancesById,
            })
          )
          .filter(Boolean),
      };
    }

    return baseEntry;
  });

  return {
    ...thread,
    timeline_entries: entries,
  };
}

module.exports = { loadThreadsList, loadThreadsInternal, matchThreads, insertThread, getThreadById };

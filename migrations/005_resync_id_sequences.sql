-- 005: re-sync primary-key sequences with their tables.
--
-- persons_person_id_seq had fallen behind: it handed out person_id = 11 while
-- row 11 already existed, so every `POST /persons` failed with
--   409  duplicate key value violates unique constraint "persons_pkey"
-- This happens when rows are inserted with explicit ids (a seed or a restore),
-- which does not advance the sequence.
--
-- Seeding the politician list on 2026-07-15 walked persons_person_id_seq past
-- the collision, so persons is healthy now. This migration makes that explicit
-- and covers the other tables, which are one bad import away from the same bug.
--
-- setval(..., max(id)) means "the last value handed out was max(id)", so the
-- next insert gets max(id) + 1. coalesce handles an empty table.
-- Safe to re-run: it is a no-op when a sequence is already correct.

select setval(
  pg_get_serial_sequence('persons', 'person_id'),
  coalesce((select max(person_id) from persons), 1),
  true
);

select setval(
  pg_get_serial_sequence('politicians', 'politician_id'),
  coalesce((select max(politician_id) from politicians), 1),
  true
);

select setval(
  pg_get_serial_sequence('parties', 'party_id'),
  coalesce((select max(party_id) from parties), 1),
  true
);

select setval(
  pg_get_serial_sequence('alliances', 'alliance_id'),
  coalesce((select max(alliance_id) from alliances), 1),
  true
);

select setval(
  pg_get_serial_sequence('threads', 'thread_id'),
  coalesce((select max(thread_id) from threads), 1),
  true
);

select setval(
  pg_get_serial_sequence('waiting_list_incidents', 'id'),
  coalesce((select max(id) from waiting_list_incidents), 1),
  true
);

-- Verify: each should report last_value >= the table's max id.
--   select 'persons', last_value from persons_person_id_seq;

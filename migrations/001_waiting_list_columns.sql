-- 001: give waiting_list_incidents the identity a promoted row needs.
--
-- A waiting-list row must eventually become an incident inside a new thread.
-- POST /incidents requires source_url, and the row must be markable as consumed
-- so it cannot spawn the same thread again tomorrow. Neither column existed.
--
-- The 1241 pre-existing rows keep source_url = null. They never stored a URL or
-- a source_id, so it is unrecoverable and they can never form a valid thread.
-- match_waiting_list_incidents (002) filters them out of matching.

alter table waiting_list_incidents
  add column if not exists source_url text,
  add column if not exists source_id  varchar,
  add column if not exists status     text not null default 'waiting';

create index if not exists wli_status_idx on waiting_list_incidents (status);

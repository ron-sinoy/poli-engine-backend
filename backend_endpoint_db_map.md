# Backend HTTP Endpoint DB Map

This file reflects the current backend implementation in `src/`.

## Global Notes

- `GET /health` does not touch the database.
- Current code bumps `version_log` only in:
  - `POST /persons`
  - `POST /parties`
  - `POST /version/update`
- Current code does **not** bump `version_log` in:
  - `POST /threads`
  - `POST /quotes`
  - `POST /incidents`

## GET /health

- Inserts/updates:
  - None
- Fetches:
  - None

## GET /breaking-news

- Inserts/updates:
  - None
- Fetches:
  - `timeline_entries`: `entry_id`, `published_at`, filtered to `entry_type = 'incident'`, ordered by descending `entry_id`, limited to five
  - `incidents`: `entry_id`, `body`, `source_url` for the selected entries
- Response shaping notes:
  - Returns the joined incident rows in timeline-entry order, newest first.

## GET /cache

- Inserts/updates:
  - None
- Fetches:
  - `persons`: `person_id`, `name`, `politician_id`
  - `politicians`: `politician_id`, `party_id`
  - `parties`: `party_id`, `name`, `abbreviation`, `alliance_id`
  - `alliances`: `alliance_id`, `name`, `abbreviation`
  - `version_log`: `value` where `key = 'version_id'`
- Not fetched from tables already queried:
  - `persons`: `photo_url`
  - `parties`: `logo_url`
  - `alliances`: `color`
  - `version_log`: `key`
- Response shaping notes:
  - Returns `version_id`, `persons[].person_id`, `persons[].name`, `persons[].party_id`, `persons[].party`, `persons[].party_name`, `persons[].alliance_id`, `persons[].alliance`, `persons[].alliance_name`, `parties[].party_id`, `parties[].alliance_id`, `parties[].name`, `parties[].abbreviation`, `alliances[].alliance_id`, `alliances[].name`, and `alliances[].abbreviation`

## POST /threads/match

- Inserts/updates:
  - None
- Fetches:
  - Calls the `match_threads(query_vector, match_count)` function, which reads
    `threads`: `thread_id`, `title`, `summary`, `vectors`
- Response shaping notes:
  - Returns `thread_id`, `title`, `summary`, `score`
  - `vectors` is read for ranking but never returned
  - Threads with a null `vectors` are excluded
- Additional notes:
  - `score` is cosine similarity, `1 - (vectors <=> query_vector)`

## POST /threads

- Inserts/updates:
  - `threads` insert:
    - `title`
    - `summary`
    - `created_at`
    - `updated_at = now` by default
    - `vectors = null` by default
    - `current_position = 0`
- Fetches:
  - Insert return from `threads`: `thread_id`
- Not fetched/read back from table already written:
  - `threads`: `title`, `summary`, `created_at`, `updated_at`, `current_position`
- Response shaping notes:
  - Returns `{ success: true, thread_id }`

## GET /threadsList

- Inserts/updates:
  - None
- Fetches:
  - `threads`: `thread_id`, `title`, `summary`, `updated_at`
- Not fetched from table already queried:
  - `threads`: `created_at`, `current_position`

## GET /threadsInternal

- Inserts/updates:
  - None
- Fetches:
  - `threads`: `thread_id`, `title`, `summary`, `updated_at`, `vectors`
- Not fetched from table already queried:
  - `threads`: `created_at`, `current_position`

## GET /threads/:id

- Inserts/updates:
  - None
- Fetches:
  - `threads`: `thread_id`, `title`, `summary`, `updated_at`
  - `timeline_entries`: `entry_id`, `entry_type`, `position`, `published_at`
  - `incidents`: `entry_id`, `body`
  - `quotes`: `entry_id`, `quote_text`, `speaker_id`
  - `incident_persons`: `entry_id`, `person_id`
  - `quote_persons`: `entry_id`, `person_id`
  - `persons`: `person_id`, `name`, `photo_url`, `politician_id`
  - `politicians`: `politician_id`, `party_id`
  - `parties`: `party_id`, `name`, `alliance_id`
  - `alliances`: `alliance_id`, `name`, `color`
- Not fetched from tables already queried:
  - `threads`: `created_at`, `current_position`
  - `timeline_entries`: `thread_id`
  - `incidents`: `source_url`
  - `quotes`: `source_url`
  - `parties`: `logo_url`, `abbreviation`
  - `alliances`: `abbreviation`
- Response shaping notes:
  - `entry_id` is used internally for joins but is not returned
  - `source_url` is not fetched, so it never appears in the response
  - All returned person objects expose:
    - `name`
    - `photo_url`
    - `party.name`
    - `alliance.name`
    - `alliance.color`
  - Helper ids such as `speaker_id`, `politician_id`, `party_id`, and `alliance_id` are not returned

## GET /politicians/trending

- Inserts/updates:
  - None
- Fetches:
  - Calls the `trending_politicians(since, match_count)` function, which reads
    `incident_persons`, `timeline_entries` (`published_at`), `persons`
    (`person_id`, `name`, `photo_url`), `politicians`, `parties`
    (`abbreviation`), `alliances` (`abbreviation`, `color`)
- Response shaping notes:
  - Returns `person_id`, `name`, `photo_url`, `party`, `alliance`,
    `alliance_color`, `score`
  - The underlying appearance count is **not** returned. `score` is a display
    index (`100 + appearances * 5`) computed in the service.
  - Returns `[]` when fewer than two people qualify
- Additional notes:
  - The service widens the window until it finds two people: 7 days, then 30
    days, then all time
  - Depends on `incident_persons`, which the pipeline's person-extraction step
    populates on both routing paths

## POST /persons

- Inserts/updates:
  - If `isPolitician = true`:
    - `politicians` insert: `party_id`
  - Always:
    - `persons` insert: `name`, `photo_url`, `politician_id`
  - `version_log` read current `value`, then update `value`
- Fetches:
  - Insert return from `politicians`: `politician_id`
  - Insert return from `persons`: `person_id`
  - `version_log`: `value`
  - Updated `version_log` return: `value`
- Not fetched/read back from tables already touched:
  - `politicians`: `party_id` is inserted but not read back
  - `persons`: `name`, `photo_url`, `politician_id` are inserted but not read back
  - `version_log`: `key` is never selected
- Additional notes:
  - No read is performed against `parties`; `party_id` is accepted from the request and inserted directly

## POST /quotes

- Inserts/updates:
  - `timeline_entries` insert:
    - `thread_id`
    - `entry_type = 'quote'`
    - `position` from current `threads.current_position`
    - `published_at` from server timestamp
  - `quotes` insert:
    - `entry_id`
    - `quote_text`
    - `source_url`
    - `speaker_id`
  - `quote_persons` insert:
    - one row per `persons_involved` item with `entry_id`, `person_id`
  - `threads` update:
    - `updated_at`
    - `current_position`
- Fetches:
  - `threads`: `thread_id`, `current_position`
  - Insert return from `timeline_entries`: `entry_id`
  - Insert return from `quotes`: `entry_id`
  - Insert return from `quote_persons`: `entry_id`
  - Updated `threads` return: `thread_id`, `current_position`
- Not fetched from tables already touched:
  - `threads` pre-read omits: `title`, `summary`, `created_at`, `updated_at`
  - `threads` update return omits: `updated_at`
  - `timeline_entries` insert return omits: `thread_id`, `entry_type`, `position`, `published_at`
  - `quotes` insert return omits: `quote_text`, `source_url`, `speaker_id`
  - `quote_persons` insert return omits: `person_id`
- Additional notes:
  - `position` is server-managed from the thread and is not accepted from the request
  - `published_at` is server-managed and matches the `threads.updated_at` value written in the same request
  - No read is performed against `persons` or `threads` detail tables to validate `speaker_id` or `persons_involved`
  - Returns `{ success: true, entry_id }`

## POST /incidents

- Inserts/updates:
  - `timeline_entries` insert:
    - `thread_id`
    - `entry_type = 'incident'`
    - `position` from current `threads.current_position`
    - `published_at` from server timestamp
  - `incidents` insert:
    - `entry_id`
    - `body`
    - `source_url`
  - `incident_persons` insert:
    - one row per `persons_involved` item with `entry_id`, `person_id`
  - `threads` update:
    - `updated_at`
    - `current_position`
- Fetches:
  - `threads`: `thread_id`, `current_position`
  - Insert return from `timeline_entries`: `entry_id`
  - Insert return from `incidents`: `entry_id`
  - Insert return from `incident_persons`: `entry_id`
  - Updated `threads` return: `thread_id`, `current_position`
- Not fetched from tables already touched:
  - `threads` pre-read omits: `title`, `summary`, `created_at`, `updated_at`
  - `threads` update return omits: `updated_at`
  - `timeline_entries` insert return omits: `thread_id`, `entry_type`, `position`, `published_at`
  - `incidents` insert return omits: `body`, `source_url`
  - `incident_persons` insert return omits: `person_id`
- Additional notes:
  - `position` is server-managed from the thread and is not accepted from the request
  - `published_at` is server-managed and matches the `threads.updated_at` value written in the same request
  - No read is performed against `persons` to validate `persons_involved`
  - Returns `{ success: true, entry_id }`

## POST /waitinglists/match

- Inserts/updates:
  - None
- Fetches:
  - Calls the `match_waiting_list_incidents(query_vector, match_count)` function,
    which reads `waiting_list_incidents`: `id`, `content`, `source_url`,
    `source_id`, `vectors`
- Response shaping notes:
  - Returns `id`, `content`, `source_url`, `source_id`, `score`
  - `vectors` is read for ranking but never returned
  - Excludes rows with a null `vectors`, a null `source_url`, or a `status` other
    than `waiting`
- Additional notes:
  - Ranking happens in Postgres via `vectors <=> query_vector`
  - Replaces `GET /vector_waiting_list_incidents`, which selected every row's
    3072-dim vector and hit the Supabase statement timeout (57014)

## POST /waitinglists/update

- Inserts/updates:
  - `waiting_list_incidents` update:
    - `status`
- Fetches:
  - Updated `waiting_list_incidents` return: `id`, `status`
- Additional notes:
  - The update is filtered by `id`, not `source_id`
  - Returns 404 when no row matches
  - This endpoint does not update `version_log`

## GET /content_waiting-list_incidents

- Inserts/updates:
  - None
- Fetches:
  - `waiting_list_incidents`: `id`, `content`, `source_url`, `source_id`
- Not fetched from tables already queried:
  - `waiting_list_incidents`: `vectors`, `status`, `created_at`

## POST /waitinglists

- Inserts/updates:
  - `waiting_list_incidents` insert:
    - `content`
    - `vectors`
    - `source_url`
    - `source_id`
- Fetches:
  - None
- Not fetched/read back from tables already touched:
  - `waiting_list_incidents`: inserted columns are not read back
- Additional notes:
  - `content` is a required text body field
  - `vectors` is a required array body field
  - `source_url` and `source_id` are required text body fields; without them the
    row could never be promoted into an incident
  - `status` defaults to `waiting`
  - This endpoint does not update `version_log`

## POST /parties

- Inserts/updates:
  - `parties` insert:
    - `name`
    - `logo_url`
    - `alliance_id`
    - `abbreviation`
  - `version_log` read current `value`, then update `value`
- Fetches:
  - Insert return from `parties`: `party_id`
  - `version_log`: `value`
  - Updated `version_log` return: `value`
- Not fetched/read back from tables already touched:
  - `parties`: `name`, `logo_url`, `alliance_id`, `abbreviation` are inserted but not read back
  - `version_log`: `key` is never selected
- Additional notes:
  - No read is performed against `alliances`; `alliance_id` is accepted from the request and inserted directly

## GET /sourceids

- Inserts/updates:
  - None
- Fetches:
  - `pipeline_metadata`: `source_id`, `status`
- Not fetched from table already queried:
  - `pipeline_metadata`: no other columns are selected
- Additional notes:
  - PostgREST caps this at 1000 rows. Use `POST /sourceids/exists` to test
    specific ids instead of scanning this response.

## POST /sourceids/exists

- Inserts/updates:
  - None
- Fetches:
  - `pipeline_metadata`: `source_id`, `status`, filtered to the requested ids
- Additional notes:
  - `source_ids` is a required array body field
  - An empty array short-circuits and returns `[]` without querying
  - Not subject to the 1000-row cap on `GET /sourceids`

## POST /sourceids

- Inserts/updates:
  - `pipeline_metadata` upsert on `source_id` (ignores duplicates):
    - `source_id`
    - `status`
- Fetches:
  - None
- Not fetched/read back from tables already touched:
  - `pipeline_metadata`: inserted columns are not read back
- Additional notes:
  - `status` is a required text body field

## POST /sourceids/update

- Inserts/updates:
  - `pipeline_metadata` update:
    - `status`
- Fetches:
  - `pipeline_metadata`: `source_id`, `status`
- Not fetched/read back from tables already touched:
  - `pipeline_metadata`: updated columns are not read back before the update executes
- Additional notes:
  - The update is filtered by `source_id`
  - `status` is a required text body field
  - This endpoint does not update `version_log`

## GET /version

- Inserts/updates:
  - None
- Fetches:
  - `version_log`: `value` where `key = 'version_id'`
- Not fetched from table already queried:
  - `version_log`: `key`
- Response shaping notes:
  - Returns `{ version_id }`

## POST /version/update

- Inserts/updates:
  - `version_log` update:
    - `value`
- Fetches:
  - `version_log`: `value` where `key = 'version_id'`
  - Updated `version_log` return: `value`
- Not fetched from table already queried:
  - `version_log`: `key`
- Response shaping notes:
  - Returns `{ version_id }`

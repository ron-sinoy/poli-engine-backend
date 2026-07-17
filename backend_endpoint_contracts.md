# Backend Endpoint Contracts

This file documents the currently implemented backend HTTP endpoints in `src/routes/`.

## Global Notes

- All responses are JSON.
- Error responses are handled globally and usually return `{ "error": "message" }`.
- `POST /persons`, `POST /parties`, and `POST /version/update` currently bump `version_log`.
- `POST /threads`, `POST /quotes`, and `POST /incidents` currently do not bump `version_log`.
- Foreign key ids are accepted from the request and inserted directly unless noted otherwise.

## GET /health

Purpose:
- Basic backend health check.

User inputs:
- None.

Returns:

```json
{ "ok": true }
```

## GET /breaking-news

Purpose:
- Loads the most recently added incidents for the frontend breaking-news banner.

User inputs:
- None.

Returns up to five incidents, newest first:

```json
[
  {
    "entry_id": 1,
    "body": "string",
    "published_at": "ISO timestamp",
    "source_url": "string"
  }
]
```

Notes:
- Recency is determined by descending `timeline_entries.entry_id`, which tracks insertion order.

## GET /cache

Purpose:
- Loads frontend cache version data plus persons, parties, and alliances.

User inputs:
- None.

Returns:

```json
{
  "version_id": 7,
  "persons": [
    {
      "person_id": 1,
      "name": "string",
      "party_id": "integer or null",
      "party": "string or null",
      "party_name": "string or null",
      "alliance_id": "integer or null",
      "alliance": "string or null",
      "alliance_name": "string or null"
    }
  ],
  "parties": [
    {
      "party_id": 1,
      "alliance_id": 1,
      "name": "string",
      "abbreviation": "string"
    }
  ],
  "alliances": [
    {
      "alliance_id": 1,
      "name": "string",
      "abbreviation": "string"
    }
  ]
}
```

Notes:
- `version_id` is read from `version_log.value` where `key = 'version_id'`.
- `persons` are sorted alphabetically by `name`.
- `persons[].person_id` is always returned.
- `persons[].party_id` and `persons[].alliance_id` are returned when a linked party/alliance exists, otherwise `null`.
- `parties` and `alliances` are object arrays sorted alphabetically by `name`.
- Non-politician persons return `null` for party and alliance fields.

## GET /threadsList

Purpose:
- Loads the list of threads for listing pages.

User inputs:
- None.

Returns:

```json
[
  {
    "thread_id": 1,
    "title": "string",
    "summary": "string",
    "updated_at": "ISO timestamp or null"
  }
]
```

Notes:
- The current repository orders threads by `updated_at` descending.
- `created_at` and `current_position` are not returned.

## GET /threadsInternal

Purpose:
- Loads the list of threads for internal consumers.

User inputs:
- None.

Returns:

```json
[
  {
    "thread_id": 1,
    "title": "string",
    "summary": "string",
    "updated_at": "ISO timestamp or null",
    "vectors": "array or null"
  }
]
```

Notes:
- The current repository orders threads by `updated_at` descending.
- `created_at` and `current_position` are not returned.
- `vectors` is returned as stored in Supabase.

## GET /threads/:id

Purpose:
- Loads one thread and its timeline entries.

User inputs:
- Path parameter `id`: thread id.

Returns:

```json
{
  "thread_id": 1,
  "title": "string",
  "summary": "string",
  "updated_at": "ISO timestamp or null",
  "timeline_entries": [
    {
      "entry_type": "incident",
      "position": 1,
      "published_at": "ISO timestamp",
      "body": "string",
      "persons_involved": [
        {
          "name": "string",
          "photo_url": "string",
          "party": {
            "name": "string"
          },
          "alliance": {
            "name": "string",
            "color": "#000000"
          }
        }
      ]
    },
    {
      "entry_type": "quote",
      "position": 2,
      "published_at": "ISO timestamp",
      "quote_text": "string",
      "speaker": {
        "name": "string",
        "photo_url": "string",
        "party": {
          "name": "string"
        },
        "alliance": {
          "name": "string",
          "color": "#000000"
        }
      },
      "persons_involved": [
        {
          "name": "string",
          "photo_url": "string",
          "party": {
            "name": "string"
          },
          "alliance": {
            "name": "string",
            "color": "#000000"
          }
        }
      ]
    }
  ]
}
```

Notes:
- `party` is `null` when the person has no party.
- `alliance` is `null` when the person has no alliance.
- `alliance.color` can be `null`.
- `source_url` is not currently returned for incidents or quotes.
- Helper ids such as `entry_id`, `speaker_id`, `person_id`, `party_id`, and `alliance_id` are not returned.

## GET /sourceids

Purpose:
- Loads source id rows from `pipeline_metadata`.

User inputs:
- None.

Returns:

```json
[
  {
    "source_id": "integer or string",
    "status": "string"
  }
]
```

Notes:
- `source_id` is returned exactly as stored.
- `status` is included as a text field.

## POST /sourceids

Purpose:
- Creates a source id row in `pipeline_metadata`.

User inputs:

```json
{
  "source_id": 17,
  "status": "pending"
}
```

Automatic inputs / server-managed values:
- None.

Returns:

```json
{ "success": true }
```

Notes:
- `source_id` must be a non-empty string or integer.
- `status` must be a non-empty string.

## POST /sourceids/update

Purpose:
- Updates the `status` of a source id row in `pipeline_metadata`.

User inputs:

```json
{
  "source_id": 17,
  "status": "complete"
}
```

Automatic inputs / server-managed values:
- None.

Returns:

```json
{ "success": true }
```

Notes:
- `source_id` must be a non-empty string or integer.
- `status` must be a non-empty string.
- The service updates a single row by `source_id`.
- This endpoint currently does not bump `version_log`.

## POST /threads

Purpose:
- Creates a new thread.

User inputs:

```json
{
  "title": "string",
  "summary": "string",
  "updated_at": "ISO timestamp, optional",
  "vectors": "array or null, optional"
}
```

Automatic inputs / server-managed values:
- `created_at`: current server timestamp.
- `updated_at`: current server timestamp when omitted, otherwise the provided timestamp.
- `vectors`: `null` when omitted, otherwise the provided array.
- `current_position`: `0`.

Returns:

```json
{ "success": true, "thread_id": 5 }
```

Notes:
- `title` and `summary` must be non-empty strings.
- This endpoint currently does not bump `version_log`.

## POST /quotes

Purpose:
- Adds a quote timeline entry to a thread.

User inputs:

```json
{
  "thread_id": 1,
  "quote_text": "string",
  "source_url": "string",
  "speaker_id": 1,
  "persons_involved": [1, 2]
}
```

Automatic inputs / server-managed values:
- `timeline_entries.entry_type`: `"quote"`.
- `timeline_entries.position`: current `threads.current_position` for the target thread.
- `timeline_entries.published_at`: current server timestamp.
- `timeline_entries.entry_id`: generated by the database and reused for related rows.
- `quotes.entry_id`: copied from the inserted timeline entry.
- `quote_persons.entry_id`: copied from the inserted timeline entry.
- `threads.updated_at`: same current server timestamp used for `timeline_entries.published_at`.
- `threads.current_position`: previous `current_position + 1`.

Returns:

```json
{ "success": true, "entry_id": 10 }
```

Notes:
- `thread_id`, `speaker_id`, and every `persons_involved` item must be integers.
- `quote_text` and `source_url` must be non-empty strings.
- The service checks that the thread exists before inserting.
- Clients do not send `position`; the service derives it from the thread.
- Clients do not send `published_at`; the service generates it.
- The service does not pre-check that `speaker_id` or `persons_involved` person ids exist.
- This endpoint currently does not bump `version_log`.

## POST /incidents

Purpose:
- Adds an incident timeline entry to a thread.

User inputs:

```json
{
  "thread_id": 1,
  "body": "string",
  "source_url": "string",
  "persons_involved": [1, 2]
}
```

Automatic inputs / server-managed values:
- `timeline_entries.entry_type`: `"incident"`.
- `timeline_entries.position`: current `threads.current_position` for the target thread.
- `timeline_entries.published_at`: current server timestamp.
- `timeline_entries.entry_id`: generated by the database and reused for related rows.
- `incidents.entry_id`: copied from the inserted timeline entry.
- `incident_persons.entry_id`: copied from the inserted timeline entry.
- `threads.updated_at`: same current server timestamp used for `timeline_entries.published_at`.
- `threads.current_position`: previous `current_position + 1`.

Returns:

```json
{ "success": true, "entry_id": 10 }
```

Notes:
- `thread_id` and every `persons_involved` item must be integers.
- `body` and `source_url` must be non-empty strings.
- The service checks that the thread exists before inserting.
- Clients do not send `position`; the service derives it from the thread.
- Clients do not send `published_at`; the service generates it.
- The service does not pre-check that `persons_involved` person ids exist.
- This endpoint currently does not bump `version_log`.

## POST /waitinglists/match

Purpose:
- Returns the waiting list incidents most similar to a query vector.

User inputs:

```json
{
  "vectors": [0.1, 0.2],
  "match_count": 3
}
```

Returns:

```json
[
  {
    "id": 1,
    "content": "string or null",
    "source_url": "string or null",
    "source_id": "string or null",
    "score": 0.91
  }
]
```

Notes:
- Calls the `match_waiting_list_incidents` Postgres function; ranking happens in
  the database and no vector is returned.
- `score` is cosine similarity, `1 - (vectors <=> query_vector)`.
- `match_count` defaults to 3 and must be at least 1.
- Rows with no `source_url` are excluded: they can never be promoted into an
  incident, so they are not match candidates.
- Only rows with `status = 'waiting'` are considered.
- Replaces `GET /vector_waiting_list_incidents`, which returned every row's
  3072-dim vector and exceeded the Supabase statement timeout.

## POST /waitinglists/update

Purpose:
- Sets the `status` of one `waiting_list_incidents` row.

User inputs:

```json
{
  "id": 1,
  "status": "completed"
}
```

Returns:

```json
{
  "success": true
}
```

Notes:
- `id` is the `waiting_list_incidents.id`, not a `source_id`.
- Returns 404 if no row has that id.
- Used to retire a row once it has been promoted into a thread, so it cannot
  spawn the same thread again.

## GET /content_waiting-list_incidents

Purpose:
- Loads waiting list incidents with `id` and `content`.

User inputs:
- None.

Returns:

```json
[
  {
    "id": 1,
    "content": "string or null",
    "source_url": "string or null",
    "source_id": "string or null"
  }
]
```

Notes:
- Reads from `waiting_list_incidents`.
- Legacy rows created before `source_url` existed return null for it and for
  `source_id`; they cannot be promoted into a thread.

## POST /waitinglists

Purpose:
- Creates a new row in `waiting_list_incidents`.

User inputs:

```json
{
  "content": "string",
  "vectors": [0.1, 0.2],
  "source_url": "string",
  "source_id": "string"
}
```

Automatic inputs / server-managed values:
- None.

Returns:

```json
{ "success": true }
```

Notes:
- `content` must be a non-empty string.
- `vectors` must be an array.
- This endpoint currently does not bump `version_log`.

## GET /politicians/trending

Purpose:
- Returns the two politicians appearing most often in recent incidents.

User inputs:
- None.

Returns:

```json
[
  {
    "person_id": 2,
    "name": "V D Satheesan",
    "photo_url": "string or null",
    "party": "INC",
    "alliance": "UDF",
    "alliance_color": "#3990e6",
    "score": 160
  }
]
```

Notes:
- Ranking runs in Postgres via `trending_politicians`.
- `score` is a presentation index (`100 + appearances * 5`), not an approval,
  popularity or support rating. The raw appearance count is never returned.
- The window widens until two people are found: 7 days, then 30 days, then all
  time.
- Returns `[]` when fewer than two people qualify; the client hides the section.
- Reads `incident_persons`, populated by the pipeline's person-extraction step.

## POST /persons

Purpose:
- Creates a person. If `isPolitician` is true, creates a linked politician row first.

User inputs:

```json
{
  "name": "string",
  "photo_url": "string",
  "isPolitician": true,
  "party_id": 2
}
```

Automatic inputs / server-managed values:
- `politicians.politician_id`: generated by the database when `isPolitician` is `true`.
- `persons.politician_id`: copied from the inserted politician row when `isPolitician` is `true`.
- `persons.politician_id`: `null` when `isPolitician` is `false`.
- `persons.person_id`: generated by the database.
- `version_log.value`: incremented after successful insert.

Returns:

```json
{ "success": true, "person_id": 7 }
```

Notes:
- `name` and `photo_url` must be non-empty strings.
- `isPolitician` must be a boolean.
- `party_id` is required only when `isPolitician` is `true`.
- The service does not pre-check that `party_id` exists.

## POST /parties

Purpose:
- Creates a party.

User inputs:

```json
{
  "name": "string",
  "logo_url": "string",
  "alliance_id": 2,
  "abbreviation": "string"
}
```

Automatic inputs / server-managed values:
- `party_id`: generated by the database.
- `version_log.value`: incremented after successful insert.

Returns:

```json
{ "success": true, "party_id": 12 }
```

Notes:
- `name`, `logo_url`, and `abbreviation` must be non-empty strings.
- `alliance_id` must be an integer.
- The service does not pre-check that `alliance_id` exists.

## GET /version

Purpose:
- Reads the current frontend cache/version id.

User inputs:
- None.

Returns:

```json
{ "version_id": 7 }
```

## POST /version/update

Purpose:
- Manually increments the frontend cache/version id.

User inputs:
- None.

Automatic inputs / server-managed values:
- Reads current `version_log.value`.
- Writes `version_log.value + 1`.

Returns:

```json
{ "version_id": 8 }
```

Notes:
- This endpoint does not require a request body.

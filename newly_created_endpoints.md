# Newly Created Endpoints

Base URL used below:

`http://localhost:3000`

## 1. `GET /threadsInternal`

URL:

`http://localhost:3000/threadsInternal`

Input JSON:

```json
null
```

Notes:
- This is a `GET` endpoint, so it does not take a request body.
- Returns thread rows with `thread_id`, `title`, `summary`, `updated_at`, and `vectors`.

## 2. `POST /waitinglists/match`

URL:

`http://localhost:3000/waitinglists/match`

Input JSON:

```json
{
  "vectors": [0.1, 0.2],
  "match_count": 3
}
```

Notes:
- Returns the closest `waiting_list_incidents` rows with `id`, `content`,
  `source_url`, `source_id`, and `score` (cosine similarity).
- Ranking runs in Postgres via the `match_waiting_list_incidents` function; no
  vector is returned.
- Skips rows with no `source_url` and rows whose `status` is not `waiting`.
- Replaces `GET /vector_waiting_list_incidents`.

## 3. `GET /content_waiting-list_incidents`

URL:

`http://localhost:3000/content_waiting-list_incidents`

Input JSON:

```json
null
```

Notes:
- This is a `GET` endpoint, so it does not take a request body.
- Returns rows from `waiting_list_incidents` with `id`, `content`, `source_url`,
  and `source_id`.

## 4. `POST /waitinglists`

URL:

`http://localhost:3000/waitinglists`

Input JSON:

```json
{
  "content": "Alpha",
  "vectors": [0.1, 0.2],
  "source_url": "https://example.com/alpha",
  "source_id": "mt_#alpha"
}
```

Notes:
- Creates a row in `waiting_list_incidents` with `status` defaulting to `waiting`.
- `source_url` and `source_id` are required; a row without them could never be
  promoted into an incident.
- This endpoint does not return a row id.

## 4b. `POST /waitinglists/update`

URL:

`http://localhost:3000/waitinglists/update`

Input JSON:

```json
{
  "id": 5,
  "status": "completed"
}
```

Notes:
- `id` is the `waiting_list_incidents.id`, not a `source_id`.
- Returns 404 when no row has that id.

## 4c. `POST /threads/match`

URL:

`http://localhost:3000/threads/match`

Input JSON:

```json
{
  "vectors": [0.1, 0.2],
  "match_count": 3
}
```

Notes:
- Returns the closest threads with `thread_id`, `title`, `summary`, and `score`.
- Threads with a null `vectors` are skipped.

## 4d. `POST /sourceids/exists`

URL:

`http://localhost:3000/sourceids/exists`

Input JSON:

```json
{
  "source_ids": ["mt_#a", "mt_#b"]
}
```

Notes:
- Returns the `source_id` and `status` of whichever ids already exist.
- Not subject to the 1000-row cap that applies to `GET /sourceids`.

## 5. `POST /sourceids/update`

URL:

`http://localhost:3000/sourceids/update`

Input JSON:

```json
{
  "source_id": 17,
  "status": "complete"
}
```

Notes:
- Updates one `pipeline_metadata` row by `source_id`.
- This endpoint does not take a path parameter.

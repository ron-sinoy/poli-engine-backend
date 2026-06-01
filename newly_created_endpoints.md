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

## 2. `GET /vector_waiting_list_incidents`

URL:

`http://localhost:3000/vector_waiting_list_incidents`

Input JSON:

```json
null
```

Notes:
- This is a `GET` endpoint, so it does not take a request body.
- Returns rows from `waiting_list_incidents` with `id` and `vectors`.

## 3. `GET /content_waiting-list_incidents`

URL:

`http://localhost:3000/content_waiting-list_incidents`

Input JSON:

```json
null
```

Notes:
- This is a `GET` endpoint, so it does not take a request body.
- Returns rows from `waiting_list_incidents` with `id` and `content`.

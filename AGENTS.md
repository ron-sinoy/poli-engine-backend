# Agent Instructions

## Restricted Files

- Never read, print, log, or modify `.env` or any file containing secrets/keys.

## Scope

These instructions apply to the entire `/home/ronsinoy/playground/gb/backend` workspace unless a more specific `AGENTS.md` exists in a subdirectory.

Before changing files, check this file and any nearer `AGENTS.md` files that apply to the files being edited.

## Working Rules

- Keep edits scoped to the requested task.
- Ask for clarification when project-specific requirements are ambiguous or conflict.
- Function names use `insert` prefix (e.g., `insertThread`, `insertQuote`, `insertIncident`, `insertPerson`, `insertParty`).
- HTTP endpoints use REST plural nouns (e.g., `POST /threads`, `POST /quotes`, `POST /incidents`, `POST /persons`, `POST /parties`).

## Overall Techstack

- Supabase is the db (don't use anon, use proper service key)
- Backend is Express
- Frontend is React (don't bother now)
- Scalability and modularity is the first priority

## Architecture

Controller-service-repository model

## Decision Making

- Always follow modularity and scalability
- Use research/architecture_masterplan strictly
- Even for small doubt, ask a question back

---

## Current Tasks

### 1. insertThread — POST /threads

#### Tables to Update

- `threads` — insert: `title`, `summary`, `created_at`, `updated_at = null`, `current_position = 0`

> `updated_at` starts as null on thread creation. It is only set when a quote or incident is added to the thread.

#### Request Body

```json
{
  "title": "string",
  "summary": "string"
}
```

#### Output Format

```json
{ "success": true, "thread_id": 5 }
```

---

### 2. insertQuote — POST /quotes

#### Tables to Update

- `timeline_entries` — insert: `thread_id`, `entry_type = 'quote'`, `position`, `published_at`
- `quotes` — insert: `entry_id` (FK from timeline_entries), `quote_text`, `source_url`, `speaker_id`
- `quote_persons` — insert: `entry_id`, `person_id` (one row per person involved)
- `threads` — **update** (not insert): `updated_at` (bump to now), `current_position` (increment by 1)
- `version_log` — after all inserts/updates, call internal `updateVersion`

#### Order of Operations

1. Insert into `timeline_entries` → get `entry_id`
2. Insert into `quotes` using `entry_id`
3. Insert into `quote_persons` for each person in `persons_involved`
4. Update `threads.updated_at` and `threads.current_position`


#### Request Body

```json
{
  "thread_id": 1,
  "quote_text": "string",
  "source_url": "string",
  "speaker_id": 1,
  "persons_involved": [1, 2],
  "published_at": "ISO timestamp",
  "position": 3
}
```

#### Output Format

```json
{ "success": true, "entry_id": 10 }
```

---

### 3. insertIncident — POST /incidents

#### Tables to Update

- `timeline_entries` — insert: `thread_id`, `entry_type = 'incident'`, `position`, `published_at`
- `incidents` — insert: `entry_id` (FK from timeline_entries), `body`, `source_url`
- `incident_persons` — insert: `entry_id`, `person_id` (one row per person involved)
- `threads` — **update** (not insert): `updated_at` (bump to now), `current_position` (increment by 1)
- `version_log` — after all inserts/updates, call internal `updateVersion`

#### Order of Operations

1. Insert into `timeline_entries` → get `entry_id`
2. Insert into `incidents` using `entry_id`
3. Insert into `incident_persons` for each person in `persons_involved`
4. Update `threads.updated_at` and `threads.current_position`


#### Request Body

```json
{
  "thread_id": 1,
  "body": "string",
  "source_url": "string",
  "persons_involved": [1, 2],
  "published_at": "ISO timestamp",
  "position": 3
}
```

#### Output Format

```json
{ "success": true, "entry_id": 10 }
```

---

### 4. insertPerson — POST /persons

#### Tables to Update

- `politicians` — insert if `isPolitician = true`: `party_id` → get `politician_id`
- `persons` — insert: `name`, `photo_url`, `politician_id` (null if not a politician)
- `version_log` — after insert, call internal `updateVersion`

#### Order of Operations

1. If `isPolitician` is true:
    - Insert into `politicians` with `party_id` → get `politician_id`
    - Insert into `persons` with `politician_id`
2. If `isPolitician` is false:
    - Insert into `persons` with `politician_id = null`
3. Call `updateVersion`

#### Request Body

```json
{
  "name": "string",
  "photo_url": "string",
  "isPolitician": true,
  "party_id": 2
}
```

#### Output Format

```json
{ "success": true, "person_id": 7 }
```

---

### 5. insertParty — POST /parties ✅ (completed)

#### Tables Updated

- `parties` — insert: `name`, `logo_url`, `alliance_id`, `abbreviation`
- `version_log` — after insert, call internal `updateVersion`

#### Output Format

```json
{ "success": true, "party_id": 12 }
```

---

## Shared Rules Across All Insert Endpoints

### updateVersion

- Must be callable internally from any service (not just via HTTP)
- Do NOT change its external HTTP response contract (`/version/update`)
- If refactoring is needed to make it reusable, keep the change minimal and scoped

### version_log

- Always bumped after every successful write operation
- Never bump version if any insert/update in the operation fails

### threads.current_position & updated_at

- `current_position` starts at `0` on thread creation
- `current_position` increments by 1 on every new timeline entry (quote or incident)
- `updated_at` starts as `null` on thread creation
- `updated_at` is set to current timestamp on every quote or incident insert
- These fields are NOT touched by insertPerson or insertParty

### Error Handling

- If any step in the sequence fails, surface an application error and do not report success
- No partial success responses

### Tests Required for Each Endpoint

- Service success path: all tables populated in correct order
- Validation failures for missing required fields
- Behavior when any DB insert/update fails mid-sequence
- Behavior when `updateVersion` fails after insert
- Route success response shape and status code

---

## File Conventions

- Follow the current controller-service-repository file structure
- Don't modify other functions unless strictly required
- Ask if in doubt
- After each agent run, append a log entry to `AGENT_LOG.md` using the existing `[P#]` format
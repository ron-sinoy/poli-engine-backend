# Agent Log

## Rule
- After every agent run, add a short point-wise log entry to this file.
- Prefix every log point with a prompt index tag like `[P1]`, `[P2]`, etc.

## 2026-04-10
- [P1] Paused work as requested; made no file changes.
- [P2] Read root `AGENTS.md` and followed backend instructions.
- [P2] Checked `research/architecture_masterplan.pdf` for backend/version notes.
- [P2] Created `backend/` Express app with controller-service-repository structure.
- [P2] Added Supabase service-role client config; no anon key fallback.
- [P2] Implemented `GET /getVersion`.
- [P2] Implemented `POST /updateVersion`.
- [P2] Added backend tests for version service and routes.
- [P2] Installed backend npm dependencies and generated `package-lock.json`.
- [P2] Verified backend tests pass: 7 passed, 0 failed.
- [P3] Added short comments to backend code where useful.
- [P3] Verified backend tests pass: 7 passed, 0 failed.
- [P4] Created this agent log file for future run notes.
- [P5] Added prompt index tags to each log point.

## 2026-04-11
- [P6] Explained backend folder flow from `server.js` entry point.
- [P7] Installed `docx` skill from `anthropics/skills`.
- [P8] Created `who_i_am.docx` with a brief table and validated its DOCX structure.
- [P9] Created `backend_working_documentation.docx` explaining backend flow with diagrams.
- [P10] Added `GET /loadThreadsList` endpoint returning threads ordered by `updated_at` descending.
- [P11] Asked for endpoint naming clarification before changing route paths.
- [P12] Renamed public routes to `GET /version`, `POST /version/update`, and `GET /threadsList`.
- [P13] Asked implementation doubts for `GET /threads/:id` before coding.
- [P14] Implemented `GET /threads/:id` with nested timeline incident/quote assembly.
- [P15] Implemented backend `GET /cache` with controller-service-repository structure, alphabetical sorting, `party: null` fallback, and route/service tests.
- [P16] Updated `GET /cache` to return alliance abbreviations and party abbreviations only, while keeping non-politician persons as `party: null`.

## 2026-04-13
- [P17] Implemented internal `insertParty` flow with public `POST /party`, Supabase `parties` insert, shared `updateVersion` reuse, and response `{ success: true, party_id }`.
- [P17] Added party service and route tests covering success, validation, insert failure, and version bump failure paths.
- [P17] Reworked route tests to use in-process Express invocation instead of socket binding so the backend test suite runs inside the current sandbox.
- [P18] Added write endpoints for `POST /threads`, `POST /persons`, `POST /quotes`, and `POST /incidents` using controller-service-repository modules and shared `updateVersion` reuse.
- [P18] Corrected the public party creation route to `POST /parties` and updated tests to match the current `AGENTS.md` REST plural-noun contract.
- [P18] Added service and route tests for thread, person, quote, and incident insert flows; verified backend tests pass: 14 passed, 0 failed.

## 2026-04-20
- [P19] Removed internal `updateVersion` calls from `insertThread`, `insertQuote`, and `insertIncident` while leaving person and party version bumps unchanged.
- [P19] Updated service tests so thread, quote, and incident flows now assert no `version_log` update occurs.
- [P19] Verified backend tests pass: 14 passed, 0 failed.
- [P20] Added `backend_endpoint_db_map.md` documenting each current HTTP endpoint, its DB reads/writes, and columns intentionally not fetched from already-queried tables.
- [P21] Expanded `GET /threads/:id` person payloads to include fetched party and alliance names, while preserving alliance color where available.
- [P21] Expanded `GET /cache` to return party/alliance names alongside the existing abbreviation-based fields and updated the endpoint DB map accordingly.
- [P21] Verified backend tests pass: 14 passed, 0 failed.
- [P22] Reviewed `AGENT_LOG.md`, `research/architecture_masterplan.pdf`, and `backend_endpoint_db_map.md` to rebuild project context before further backend work.
- [P23] Added `backend_endpoint_contracts.md` documenting implemented backend endpoints, response shapes, POST user inputs, and server-managed values.
- [P24] Updated `GET /cache` to include top-level `version_id` from `version_log` and documented the response contract.
- [P25] Checked backend deploy readiness: verified package scripts, required environment variables, clean worktree, and passing test suite.
- [P26] Reviewed the current party route and tests, then provided the correct `curl` example for creating a party and noted that no party update endpoint exists yet.
- [P27] Added `write_endpoint_flows.md` in the same concise flow style as `sample.md`, covering the current write endpoints with implementation-accurate steps.
- [P28] Extended `write_endpoint_flows.md` with the current GET endpoints using the same compact flow format and implementation-accurate DB read sequence.
- [P29] Reviewed `write_endpoint_flows.md` against the current routes, services, and repositories to identify remaining accuracy and formatting issues.
- [P30] Updated `POST /quotes` and `POST /incidents` so timeline entry position now comes from `threads.current_position`, removed `position` from request/test contracts, refreshed endpoint docs, and verified the backend test suite passes: 14 passed, 0 failed.
- [P31] Updated `POST /quotes` and `POST /incidents` so `published_at` is server-generated and reused for `threads.updated_at`, removed `published_at` from request/test contracts, refreshed endpoint docs, and verified the backend test suite passes: 14 passed, 0 failed.
- [P32] Hid the frontend Spotlight placeholder with a CSS `hidden` class in `../frontend/src/components/HomeContainer.jsx` while keeping the JSX in place, per the latest UI instruction.

## 2026-05-13
- [P33] Added `POST /sourceids` with controller-service-repository wiring to insert `source_id` into `pipeline_metadata` and return `{ success: true }` without updating `version_log`.
- [P33] Added sourceid route and service tests covering success, validation, and insert failure paths.
- [P33] Updated stale quote/incident service test expectations to match the current non-returning person-link insert behavior and verified backend tests pass: 17 passed, 0 failed.
- [P34] Added `GET /sourceids` to read `source_id` rows from `pipeline_metadata`, return them as an array, and covered the read path with route/service tests.
- [P34] Verified backend tests pass after the new read endpoint: 17 passed, 0 failed.
- [P35] Extended `GET /cache` person rows to include corresponding `person_id`, `party_id`, and `alliance_id`, updated endpoint docs, and verified backend tests pass: 17 passed, 0 failed.
- [P36] Reworked `GET /cache` top-level `parties` and `alliances` from split name/abbreviation arrays into structured object arrays, updated docs, and verified backend tests pass: 17 passed, 0 failed.

## 2026-05-29
- [P37] Updated `GET /sourceids` and `POST /sourceids` to include the new `status` text column in `pipeline_metadata`, added validation/tests, and verified backend tests pass: 16 passed, 0 failed.

## 2026-06-01
- [P38] Added `GET /threadsInternal` as a separate thread-list fetch that returns `vectors` alongside the existing thread list fields, wired it through controller/service/repository, and added route/service tests.
- [P38] Documented `GET /threadsInternal` plus the existing `GET /sourceids` and `POST /sourceids` `status` field in the backend endpoint docs, then verified backend tests pass: 16 passed, 0 failed.
- [P39] Added `GET /vector_waiting_list_incidents` and `GET /content_waiting-list_incidents` as read-only waiting-list incident endpoints returning `id,vectors` and `id,content`, wired them through the incident stack, and verified backend tests pass: 16 passed, 0 failed.
- [P40] Created `newly_created_endpoints.md` listing the latest endpoints in creation order with `http://localhost:3000` URLs and request-body notes.

## 2026-06-02
- [P41] Created `endpoints_by_method.md` with the current HTTP endpoints grouped under `GET` and `POST`, then appended this log entry as required.
- [P42] Added `POST /sourceids/update` to update `pipeline_metadata.status` by `source_id`, wired controller-service-repository support, documented the endpoint, and verified the backend test suite passes: 16 passed, 0 failed.
- [P43] Added `POST /waitinglists` to insert rows into `waiting_list_incidents` with `content` and `vectors`, wired route/service/repository support, documented the endpoint, and verified the backend test suite passes: 16 passed, 0 failed.
- [P44] Confirmed `POST /sourceids/update` exists in the current route/controller/service stack and returns `{ success: true }` after updating `pipeline_metadata.status` by `source_id`.
- [P45] Updated `POST /threads` so `updated_at` now defaults to the current server timestamp on insert, aligned the endpoint docs, and verified the backend test suite passes: 16 passed, 0 failed.
- [P46] Updated `POST /threads` to accept an optional `vectors` body field, persist `null` by default, aligned the endpoint docs and tests, and verified the backend test suite passes: 16 passed, 0 failed.
- [P44] Reworked the waiting-list and thread matching path so both routing paths in `architecture.pdf` can work. Added `migrations/` (`source_url`/`source_id`/`status` on `waiting_list_incidents`, the `match_waiting_list_incidents` and `match_threads` pgvector RPCs, `pipeline_metadata` dedupe + unique index, and nulling of the 136 placeholder thread vectors). Replaced `GET /vector_waiting_list_incidents` with `POST /waitinglists/match`, added `POST /waitinglists/update`, `POST /threads/match`, and `POST /sourceids/exists`, made `POST /waitinglists` persist `source_url`/`source_id` instead of dropping them, made `POST /sourceids` upsert, and fixed `updateSourceid` never returning 404 (missing `.maybeSingle()`). Backend tests: 93 passed, 0 failed.
- [P45] Seeded 64 politicians (49 Kerala, 15 national) into `persons`/`politicians`, deduped by normalised name, adding `Kerala Congress (M)` and `Revolutionary Socialist Party`. Only long-stable party affiliations were included; anyone whose party could not be vouched for as of the Jan-2026 knowledge cutoff was omitted rather than guessed. Also fixed three pre-existing data bugs (duplicate INC party 9 merged into 1, `Thomas Isaac` given his own politicians row instead of sharing Pinarayi Vijayan's, duplicate Malayalam test persons removed) and added `migrations/005_resync_id_sequences.sql` for a stale `persons_person_id_seq` that was making `POST /persons` return 409.
- [P46] Added `GET /politicians/trending` plus `migrations/006_trending_politicians_rpc.sql`, returning the two politicians appearing most often in recent incidents. The service widens the window (7d -> 30d -> all time) until two qualify and converts the appearance count into a display score (`100 + n*5`); the raw count is never returned. Backend tests: 99 passed, 0 failed.

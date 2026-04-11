# Poli Engine Backend

Express backend for the Supabase-backed Poli Engine API.

## Setup

1. Run `npm install`.
2. Copy `.env.example` values into `.env`.
3. Set `SUPABASE_URL`.
4. Set `SUPABASE_SERVICE_ROLE_KEY`. Do not use the Supabase anon key for this backend.
5. Run `npm start`.

## Endpoints

- `GET /health` returns backend status.
- `GET /getVersion` reads `version_log.value` where `key = version_id`.
- `POST /updateVersion` increments `version_log.value` for `key = version_id` by 1.

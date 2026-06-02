## GET /health
(no body)
      ↓
[sys: no DB access]
      ↓
{ ok: true }

## GET /cache
(no body)
      ↓
[sys: supabaseClient]
      ↓
DB read persons
      ↓
DB read politicians
      ↓
DB read parties
      ↓
DB read alliances
      ↓
DB read version_log
[key = version_id]
      ↓
assemble + alphabetically sort
[persons, parties, party_names, alliances, alliance_names]
      ↓
{ version_id, persons, parties, party_names, alliances, alliance_names }

## GET /threadsList
(no body)
      ↓
[sys: supabaseClient]
      ↓
DB read threads
[ordered by updated_at desc]
      ↓
[{ thread_id, title, summary, updated_at }]

## GET /threads/:id
(path: id)
      ↓
[sys: supabaseClient]
      ↓
DB read threads
[required: thread exists]
      ↓
DB read timeline_entries
[for thread_id]
      ↓
DB read incidents
[for incident entry_ids]
      ↓
DB read quotes
[for quote entry_ids]
      ↓
DB read incident_persons
[for incident entry_ids]
      ↓
DB read quote_persons
[for quote entry_ids]
      ↓
DB read persons
[for speaker_ids + persons_involved ids]
      ↓
DB read politicians
      ↓
DB read parties
      ↓
DB read alliances
      ↓
assemble timeline_entries
[incident + quote payloads with public person data]
      ↓
{ thread_id, title, summary, updated_at, timeline_entries }

## GET /version
(no body)
      ↓
[sys: supabaseClient]
      ↓
DB read version_log
[key = version_id]
      ↓
{ version_id }

## POST /threads
(title, summary, vectors optional)
      ↓
[sys: supabaseClient, trimmed, validated]
      ↓
DB insert threads
[auto: thread_id ↑, created_at = now, updated_at = now by default, vectors = null by default, current_position = 0]
      ↓
{ success: true, thread_id }

## POST /persons
(name, photo_url, isPolitician, party_id if isPolitician = true)
      ↓
[sys: supabaseClient, trimmed, validated]
      ↓
DB insert politicians
[if isPolitician = true, auto: politician_id ↑]
      ↓
DB insert persons
[auto: person_id ↑, politician_id or null]
      ↓
updateVersion
[auto: version ↑]
      ↓
{ success: true, person_id }

## POST /quotes
(thread_id, quote_text, source_url, speaker_id, persons_involved)
      ↓
[sys: supabaseClient, validated]
      ↓
DB read threads
[required: thread exists, current_position read]
      ↓
DB insert timeline_entries
[auto: entry_id ↑, entry_type = quote, position = current_position, published_at = now]
      ↓
DB insert quotes
[entry_id reused]
      ↓
DB insert quote_persons
[0..n rows, entry_id reused]
      ↓
DB update threads
[updated_at = same now, current_position = previous + 1]
      ↓
{ success: true, entry_id }

## POST /incidents
(thread_id, body, source_url, persons_involved)
      ↓
[sys: supabaseClient, validated]
      ↓
DB read threads
[required: thread exists, current_position read]
      ↓
DB insert timeline_entries
[auto: entry_id ↑, entry_type = incident, position = current_position, published_at = now]
      ↓
DB insert incidents
[entry_id reused]
      ↓
DB insert incident_persons
[0..n rows, entry_id reused]
      ↓
DB update threads
[updated_at = same now, current_position = previous + 1]
      ↓
{ success: true, entry_id }

## POST /parties
(name, logo_url, alliance_id, abbreviation)
      ↓
[sys: supabaseClient, trimmed, validated]
      ↓
DB insert parties
[auto: party_id ↑]
      ↓
updateVersion
[auto: version ↑]
      ↓
{ success: true, party_id }

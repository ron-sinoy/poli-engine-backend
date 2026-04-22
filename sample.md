## POST /parties
(name, logo_url, alliance_id, abbreviation)
      ↓
[sys: supabaseClient, trimmed]
      ↓
DB insert
[auto: party_id ↑]
      ↓
updateVersion
[auto: version ↑]
      ↓
{ success: true, party_id }

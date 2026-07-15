-- 006: rank politicians by how often they appear in incidents.
--
-- Counting appearances is a group-by across five tables. Doing it in Postgres
-- keeps it one round trip and means the raw counts never leave the database
-- except through the service, which converts them into a display score.
--
-- `since` is passed by the caller so the service can widen the window
-- (7 days -> 30 days -> all time) until it has enough people to show.
--
-- Note this reads incident_persons, which only the pipeline's person-extraction
-- step populates. Before that step shipped, this returned almost nothing.

create or replace function trending_politicians(
  since       timestamptz,
  match_count int default 2
)
returns table (
  person_id      int,
  name           varchar,
  photo_url      text,
  party_abbr     text,
  alliance_abbr  varchar,
  alliance_color char(7),
  appearances    bigint
)
language sql
stable
as $$
  select p.person_id,
         p.name,
         p.photo_url,
         pa.abbreviation,
         al.abbreviation,
         al.color,
         count(*) as appearances
  from incident_persons ip
  join timeline_entries te on te.entry_id = ip.entry_id
  join persons p           on p.person_id = ip.person_id
  -- left joins: a person with no party still counts as appearing
  left join politicians po on po.politician_id = p.politician_id
  left join parties pa     on pa.party_id      = po.party_id
  left join alliances al   on al.alliance_id   = pa.alliance_id
  where te.published_at >= since
  group by p.person_id, p.name, p.photo_url, pa.abbreviation, al.abbreviation, al.color
  order by count(*) desc, p.person_id
  limit match_count;
$$;

-- Verify:
--   select * from trending_politicians(now() - interval '7 days', 2);
--   select * from trending_politicians('epoch'::timestamptz, 2);

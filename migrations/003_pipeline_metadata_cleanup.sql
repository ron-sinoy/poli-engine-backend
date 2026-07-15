-- 003: collapse pipeline_metadata duplicates, then make them impossible.
--
-- DESTRUCTIVE AND IRREVERSIBLE. Take a Supabase snapshot before running.
--
-- State before: 8264 rows for 2095 distinct source_ids. One id has 61 rows.
-- Cause: check_db only counted completed/filtered as "seen" while insert_db
-- wrote "processing", so unfinished articles looked brand new every run and
-- were re-inserted. There was no unique constraint to stop the pile-up.
--
-- Expected after: 2095 rows, one per source_id, all terminal.

begin;

-- Keep one row per source_id, strongest status wins.
create temporary table pm_keep on commit drop as
select distinct on (source_id) id
from pipeline_metadata
order by source_id,
  case status
    when 'completed'  then 1
    when 'confirmed'  then 2
    when 'filtered'   then 3
    when 'processing' then 4
    else 5
  end,
  id;

delete from pipeline_metadata where id not in (select id from pm_keep);

-- 4060 'processing' + 416 NULL rows are stranded from crashed runs. Neither
-- state identifies an article that made it into a thread, so both are retired
-- rather than reprocessed (user decision: treat processing as done).
update pipeline_metadata
   set status = 'filtered'
 where status is null
    or status = 'processing';

-- Makes the duplicate pile-up unrepeatable at the storage layer even if the
-- application logic regresses. Required by the upsert in sourceid.repository.js.
create unique index if not exists pipeline_metadata_source_id_key
  on pipeline_metadata (source_id);

commit;

-- Verify: both numbers should be 2095.
-- select count(*), count(distinct source_id) from pipeline_metadata;

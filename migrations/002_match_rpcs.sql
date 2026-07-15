-- 002: move both vector searches server-side.
--
-- Previously the backend selected every row's full 3072-dim vector and the
-- pipeline cosined them in Python. For waiting_list_incidents that is ~48MB
-- (1241 rows x 39KB), which blew the Supabase statement timeout (57014) while
-- serializing floats into JSON -- the scan itself was never the problem.
--
-- These return the top N rows with real cosine scores instead, so no vector
-- ever crosses the wire.
--
-- `1 - (a <=> b)` is cosine similarity, matching modules/compare_vectors.py.
--
-- No pgvector index: HNSW/IVFFlat cap at 2000 dims and these are 3072. An exact
-- scan over ~1.2k rows is single-digit milliseconds. If this table ever reaches
-- ~100k rows, index the halfvec cast:
--   create index on waiting_list_incidents
--     using ivfflat ((vectors::halfvec(3072)) halfvec_cosine_ops);

create or replace function match_waiting_list_incidents(
  query_vector vector(3072),
  match_count  int default 3
)
returns table (
  id         bigint,
  content    text,
  source_url text,
  source_id  varchar,
  score      double precision
)
language sql
stable
as $$
  select w.id,
         w.content,
         w.source_url,
         w.source_id,
         1 - (w.vectors <=> query_vector) as score
  from waiting_list_incidents w
  where w.vectors is not null
    and w.source_url is not null   -- legacy rows can never form a valid thread
    and w.status = 'waiting'
  order by w.vectors <=> query_vector
  limit match_count;
$$;

create or replace function match_threads(
  query_vector vector(3072),
  match_count  int default 3
)
returns table (
  thread_id int,
  title     varchar,
  summary   text,
  score     double precision
)
language sql
stable
as $$
  select t.thread_id,
         t.title,
         t.summary,
         1 - (t.vectors <=> query_vector) as score
  from threads t
  where t.vectors is not null
  order by t.vectors <=> query_vector
  limit match_count;
$$;

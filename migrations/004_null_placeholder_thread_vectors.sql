-- 004: null out the placeholder thread vectors.
--
-- Threads 1..139 (136 rows, created 2025-10-11..2026-06-02) all share one
-- identical vector with L2 norm 31.55. It is not an embedding of their content
-- -- every one of those threads carries the same value, so it cannot be.
--
-- It is inert rather than harmful: it scores ~0.00 (orthogonal) against real
-- Gemini embeddings, so match_threads can never rank it above a genuine match.
-- Nulling it just makes the data honest -- those threads join the ~845 that
-- already have no vector, which is the accepted state.
--
-- Verify first (expect one group of 136 sharing a vector):
--   select vectors, count(*) from threads
--    where vectors is not null group by vectors order by count(*) desc;

update threads
   set vectors = null
 where vectors is not null
   and vectors = (
     select vectors
     from threads
     where vectors is not null
     group by vectors
     having count(*) > 1
     order by count(*) desc
     limit 1
   );

-- After: only threads with a genuine per-thread embedding keep a vector.
-- select count(*) from threads where vectors is not null;

-- Base roster seed for a fresh Supabase project.
--
-- Copies ONLY the reference data: alliances, parties, politicians, persons and
-- version_log. Threads, incidents, timeline entries, waiting-list rows and
-- pipeline_metadata are deliberately NOT copied -- the pipeline rebuilds those,
-- and starting empty drops the 6169 duplicate pipeline_metadata rows, the 1241
-- waiting-list rows that had no source_url (they could never form a thread) and
-- the 136 placeholder thread vectors.
--
-- PREREQUISITES on the target project, in order:
--   1. create extension if not exists vector;
--   2. restore the schema:  pg_dump "$OLD" --schema-only --no-owner --no-privileges
--      (the OpenAPI spec does not expose defaults or varchar lengths, so the
--       schema must come from pg_dump rather than be reconstructed by hand)
--   3. this file
--   4. migrations 001, 002, 006, and the unique index from 003
--      (004 is unnecessary -- no threads are copied)
--      (005 is unnecessary -- this file sets the sequences itself, below)
--
-- Idempotent: re-running inserts nothing new.
--
-- NOTE: version_log is small but load-bearing. Without its single row,
-- GET /cache returns 404, POST /persons fails, and the pipeline's person
-- extraction (which reads /cache) stops -- taking the Spotlight section with it.

begin;

-- alliances: 3 rows
insert into alliances (alliance_id, name, color, abbreviation) values
  (1, 'United Democratic Front', '#3990e6', 'UDF'),
  (2, 'Left Democratic Front', '#E63946', 'LDF'),
  (3, 'National Democratic Alliance', '#FF6B35', 'NDA')
on conflict (alliance_id) do nothing;

-- parties: 7 rows
insert into parties (party_id, name, logo_url, alliance_id, abbreviation) values
  (1, 'Indian National Congress', 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6c/Indian_National_Congress_hand_logo.svg/240px-Indian_National_Congress_hand_logo.svg.png', 1, 'INC'),
  (2, 'Indian Union Muslim League', 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/69/Indian_Union_Muslim_League_Flag.svg/240px-Indian_Union_Muslim_League_Flag.svg.png', 1, 'IUML'),
  (3, 'Communist Party of India (Marxist)', 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a8/Hammer_and_sickle_red_on_transparent.svg/240px-Hammer_and_sickle_red_on_transparent.svg.png', 2, 'CPI(M)'),
  (4, 'Communist Party of India', 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a8/Hammer_and_sickle_red_on_transparent.svg/240px-Hammer_and_sickle_red_on_transparent.svg.png', 2, 'CPI'),
  (5, 'Bharatiya Janata Party', 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1e/BJP_symbol.svg/240px-BJP_symbol.svg.png', 3, 'BJP'),
  (11, 'Kerala Congress (M)', null, 2, 'KC(M)'),
  (12, 'Revolutionary Socialist Party', null, 1, 'RSP')
on conflict (party_id) do nothing;

-- politicians: 73 rows
insert into politicians (politician_id, party_id) values
  (1, 3),
  (2, 1),
  (3, 5),
  (4, 3),
  (5, 2),
  (6, 1),
  (9, 1),
  (10, 1),
  (11, 3),
  (13, 3),
  (14, 3),
  (15, 3),
  (16, 3),
  (17, 3),
  (18, 3),
  (19, 3),
  (20, 3),
  (21, 3),
  (22, 3),
  (23, 3),
  (24, 3),
  (25, 3),
  (26, 3),
  (27, 3),
  (28, 3),
  (29, 3),
  (30, 3),
  (31, 4),
  (32, 4),
  (33, 4),
  (34, 4),
  (35, 4),
  (36, 1),
  (37, 1),
  (38, 1),
  (39, 1),
  (40, 1),
  (41, 1),
  (42, 1),
  (43, 1),
  (44, 1),
  (45, 1),
  (46, 1),
  (47, 1),
  (48, 1),
  (49, 2),
  (50, 2),
  (51, 2),
  (52, 2),
  (53, 2),
  (54, 2),
  (55, 5),
  (56, 5),
  (57, 5),
  (58, 5),
  (59, 5),
  (60, 11),
  (61, 12),
  (62, 5),
  (63, 5),
  (64, 5),
  (65, 5),
  (66, 5),
  (67, 5),
  (68, 5),
  (69, 1),
  (70, 1),
  (71, 1),
  (72, 1),
  (73, 1),
  (74, 3),
  (75, 3),
  (76, 4)
on conflict (politician_id) do nothing;

-- persons: 74 rows
insert into persons (person_id, name, photo_url, politician_id) values
  (1, 'Pinarayi Vijayan', 'https://adqsggmscnrwyqmnkrva.supabase.co/storage/v1/object/public/Politicians_images/pinarayivijayan.png', 1),
  (2, 'V D Satheesan', 'https://adqsggmscnrwyqmnkrva.supabase.co/storage/v1/object/public/Politicians_images/vdsatheeshan.png', 2),
  (3, 'Suresh Gopi', 'https://adqsggmscnrwyqmnkrva.supabase.co/storage/v1/object/public/Politicians_images/sureshgopi.png', 3),
  (4, 'M V Govindan', 'https://adqsggmscnrwyqmnkrva.supabase.co/storage/v1/object/public/Politicians_images/mvgovindan.png', 4),
  (5, 'P K Kunhalikutty', 'https://adqsggmscnrwyqmnkrva.supabase.co/storage/v1/object/public/Politicians_images/kunhalikutty.png', 5),
  (6, 'K Sudhakaran', null, 6),
  (7, 'Thomas Isaac', null, 11),
  (8, 'ടെസ്റ്റ് വ്യക്തി', 'https://example.com/photo.jpg', null),
  (11, 'Ramesh Chennithala', 'https://adqsggmscnrwyqmnkrva.supabase.co/storage/v1/object/public/Politicians_images/Ramesh_Chennithala_Harippad-removebg-preview.png', 9),
  (12, 'K C Venugopal', 'https://adqsggmscnrwyqmnkrva.supabase.co/storage/v1/object/public/Politicians_images/kc-venugopal.1722620576-removebg-preview.png', 10),
  (13, 'K K Shailaja', null, 13),
  (14, 'M A Baby', null, 14),
  (15, 'A Vijayaraghavan', null, 15),
  (16, 'E P Jayarajan', null, 16),
  (17, 'P Rajeeve', null, 17),
  (18, 'K N Balagopal', null, 18),
  (19, 'M B Rajesh', null, 19),
  (20, 'V N Vasavan', null, 20),
  (21, 'A K Balan', null, 21),
  (22, 'Elamaram Kareem', null, 22),
  (23, 'John Brittas', null, 23),
  (24, 'V Sivankutty', null, 24),
  (25, 'R Bindu', null, 25),
  (26, 'Veena George', null, 26),
  (27, 'P A Muhammad Riyas', null, 27),
  (28, 'K Radhakrishnan', null, 28),
  (29, 'Saji Cherian', null, 29),
  (30, 'M V Jayarajan', null, 30),
  (31, 'Binoy Viswam', null, 31),
  (32, 'K Rajan', null, 32),
  (33, 'P Prasad', null, 33),
  (34, 'Annie Raja', null, 34),
  (35, 'G R Anil', null, 35),
  (36, 'Shashi Tharoor', null, 36),
  (37, 'K Muraleedharan', null, 37),
  (38, 'Kodikunnil Suresh', null, 38),
  (39, 'Hibi Eden', null, 39),
  (40, 'Anto Antony', null, 40),
  (41, 'Benny Behanan', null, 41),
  (42, 'Dean Kuriakose', null, 42),
  (43, 'Shafi Parambil', null, 43),
  (44, 'Mathew Kuzhalnadan', null, 44),
  (45, 'Chandy Oommen', null, 45),
  (46, 'V M Sudheeran', null, 46),
  (47, 'Adoor Prakash', null, 47),
  (48, 'T Siddique', null, 48),
  (49, 'Panakkad Sadiq Ali Shihab Thangal', null, 49),
  (50, 'E T Muhammed Basheer', null, 50),
  (51, 'M K Muneer', null, 51),
  (52, 'Abdussamad Samadani', null, 52),
  (53, 'P M A Salam', null, 53),
  (54, 'P V Abdul Wahab', null, 54),
  (55, 'K Surendran', null, 55),
  (56, 'V Muraleedharan', null, 56),
  (57, 'Sobha Surendran', null, 57),
  (58, 'P K Krishnadas', null, 58),
  (59, 'Rajeev Chandrasekhar', null, 59),
  (60, 'Jose K Mani', null, 60),
  (61, 'N K Premachandran', null, 61),
  (62, 'Narendra Modi', null, 62),
  (63, 'Amit Shah', null, 63),
  (64, 'Rajnath Singh', null, 64),
  (65, 'Nirmala Sitharaman', null, 65),
  (66, 'J P Nadda', null, 66),
  (67, 'Nitin Gadkari', null, 67),
  (68, 'S Jaishankar', null, 68),
  (69, 'Rahul Gandhi', null, 69),
  (70, 'Sonia Gandhi', null, 70),
  (71, 'Mallikarjun Kharge', null, 71),
  (72, 'Priyanka Gandhi Vadra', null, 72),
  (73, 'P Chidambaram', null, 73),
  (74, 'Prakash Karat', null, 74),
  (75, 'Brinda Karat', null, 75),
  (76, 'D Raja', null, 76)
on conflict (person_id) do nothing;

-- version_log: 1 row -- required by GET /cache and POST /persons
insert into version_log (value, key) values
  (10, 'version_id')
on conflict do nothing;

-- Sequences. The rows above carry explicit ids, which does NOT advance the
-- sequences -- the exact bug that made POST /persons return 409 on the source
-- project. Setting them here means the target starts correct.
select setval(pg_get_serial_sequence('alliances', 'alliance_id'), coalesce((select max(alliance_id) from alliances), 1), true);
select setval(pg_get_serial_sequence('parties', 'party_id'), coalesce((select max(party_id) from parties), 1), true);
select setval(pg_get_serial_sequence('politicians', 'politician_id'), coalesce((select max(politician_id) from politicians), 1), true);
select setval(pg_get_serial_sequence('persons', 'person_id'), coalesce((select max(person_id) from persons), 1), true);

commit;

-- Verify:
--   select 'alliances', count(*) from alliances
--   union all select 'parties', count(*) from parties
--   union all select 'politicians', count(*) from politicians
--   union all select 'persons', count(*) from persons
--   union all select 'version_log', count(*) from version_log;
--   -- expect 3, 7, 73, 74, 1


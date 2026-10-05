-- Add authoritative decimal values without altering/retyping/deleting the legacy REAL columns.
-- Existing REAL values are preserved byte-for-byte; their recorded decimal representation is backfilled separately.
alter table marks add column score_exact numeric;
alter table marks add column theory_score_exact numeric;
alter table marks add column practical_score_exact numeric;
alter table marks add column internal_score_exact numeric;
update marks set score_exact=score::numeric,theory_score_exact=theory_score::numeric,practical_score_exact=practical_score::numeric,internal_score_exact=internal_score::numeric;
alter table assessment_mark_components add column score_exact numeric;
update assessment_mark_components set score_exact=score::numeric;
alter table marks add constraint exact_numeric_state_check check(
 (status='NUMERIC' and score_exact is not null and score_exact>=0 and score_exact<=100)
 or (status='PENDING' and score_exact is null)
 or (status in ('AB','EXEMPT') and score_exact is null and theory_score_exact is null and practical_score_exact is null and internal_score_exact is null)
) not valid;
alter table marks add constraint exact_component_range_check check(
 (theory_score_exact is null or theory_score_exact between 0 and 100)
 and (practical_score_exact is null or practical_score_exact between 0 and 100)
 and (internal_score_exact is null or internal_score_exact between 0 and 100)
) not valid;

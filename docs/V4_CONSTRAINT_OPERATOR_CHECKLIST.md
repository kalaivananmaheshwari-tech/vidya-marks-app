# V4 — 22-item NOT VALID production operator checklist

**Preparation only; no validation or data repair was executed.** Exact22 catalog names/definitions and purposes were inspected in V3 and retained in V4. Known per-constraint synthetic violation counts are0. Native local `convalidated=false` is actual evidence; a real production catalog/state/count is unknown until a later authorized read-only review. Zero synthetic counts are not evidence that real records pass or that validation may now run.

Detailed individual legacy risks/NOT VALID rationale: [V3 constraint review](CONSTRAINT_REVIEW_V3.md). Existing migration hashes/order/backup/recovery steps: [V4 database runbook](V4_DATABASE_RELEASE_RUNBOOK.md).

## Mandatory operator sequence — later authorization only

1. **Backup** the authorized database and prove restoration/integrity to a separate isolated target. Record approved source/destination and maintenance window.
2. **Inspect existing records** and actual `pg_constraint` definitions/validation flags read-only; compare IDs, UUID/person/enrollment/subject/allocation/author/history and nullable semantic cases.
3. **Identify violations** with existing read-only `db:check` and source-based semantic review, preferably first on the restored copy. CHECK UNKNOWN and nullable MATCH SIMPLE FKs can pass while business data remain incomplete.
4. **Correct only under an approved data-repair procedure**, with explicit records/source justification/owner/audit/recovery evidence. No deletion, score rewrite, zero substitution, exam-number rewrite, ownership transfer, guessed identity/enum/conversion or snapshot change is authorized by this checklist.
5. **Validate ONE named constraint at a time**, only after the row's prerequisites/lock/runtime rehearsal and individual authorization. Failure → stop, keep NOT VALID, review; never drop/weaken the constraint or alter records just to force success.
6. **Rerun integrity checks after each** and record actual count/flag, command result, timings/locks and reviewer. Final local/production state must never be conflated.

A production operator may conditionally validate after all common steps and that row's source-data review prove zero actual violations and an approved safe lock window. **Every row remains REQUIRES AUTHORIZATION; every production review is REQUIRES AUTHORIZED PRODUCTION REVIEW.** No checklist cell authorizes immediate execution.

## Individual checklist

“Conditional” means safe only after approved production data review, backup/restore/rehearsal and explicit per-constraint authorization. It is not a prediction from synthetic data. Current state in every row is **NOT VALID on the inspected native fixture; production unknown**.

| # | Exact constraint | Table | Purpose | Current state | Known synthetic violations | Production validation prerequisite (plus common sequence above) | Safe after approved production review? | Operator required / status |
|---:|---|---|---|---|---:|---|---|---|
|1|`classes_group_scope_fk`|classes|School/group composite reference|NOT VALID (local); production unknown|0|Reconcile actual same-school group; nullable group passes SQL but HSC requirement needs source review|Conditional|REQUIRES AUTHORIZATION|
|2|`classes_teacher_scope_fk`|classes|School/Class Teacher user reference|NOT VALID (local); production unknown|0|Verify same-school actor and authoritative active Class Teacher membership; FK alone does not prove role|Conditional|REQUIRES AUTHORIZATION|
|3|`exact_component_range_check`|marks|Exact nullable components0–100|NOT VALID (local); production unknown|0|Check exact components AND stricter actual class allocation; preserve original REAL/source components; incompatible legacy conversion needs separate policy|Conditional|REQUIRES AUTHORIZATION|
|4|`exact_numeric_state_check`|marks|NUMERIC exact total0–100; PENDING null total; AB/EXEMPT all exact values null|NOT VALID (local); production unknown|0|Review status/exact provenance and absence/exemption/partial states; never substitute zero|Conditional|REQUIRES AUTHORIZATION|
|5|`mark_allocation_scope_fk`|marks|Same-school allocation identity|NOT VALID (local); production unknown|0|Verify actual historical allocation link, nullable/missing identity and row6 subject consistency|Conditional|REQUIRES AUTHORIZATION|
|6|`mark_allocation_subject_fk`|marks|Allocation belongs to exact class-subject mapping|NOT VALID (local); production unknown|0|Reconcile historical class-subject/allocation provenance; no guessed replacement|Conditional|REQUIRES AUTHORIZATION|
|7|`mark_class_subject_scope_fk`|marks|Same-school exact class-subject/section identity|NOT VALID (local); production unknown|0|Compare source class/section/subject with immutable assessment relations|Conditional|REQUIRES AUTHORIZATION|
|8|`mark_enrollment_scope_fk`|marks|Same-school enrollment/section/person identity|NOT VALID (local); production unknown|0|Verify correct person UUID and historical enrollment as one identity; no moving assessed records|Conditional|REQUIRES AUTHORIZATION|
|9|`mark_identity_required_check`|marks|Five permanent identity/mapping fields nonnull|NOT VALID (local); production unknown|0|Resolve UUID/enrollment/section/class-subject/allocation from source; ambiguity stops review|Conditional|REQUIRES AUTHORIZATION|
|10|`mark_person_scope_fk`|marks|Original student ID paired with same-school UUID|NOT VALID (local); production unknown|0|Verify original ID/permanent UUID pairs without replacing IDs|Conditional|REQUIRES AUTHORIZATION|
|11|`mark_state_check`|marks|Original REAL/status/absence/exemption consistency|NOT VALID (local); production unknown|0|Check original flags/ranges/components with row4; SQL UNKNOWN is not completion proof; preserve raw data|Conditional|REQUIRES AUTHORIZATION|
|12|`marks_actor_scope_fk`|marks|Same-school entry-author reference|NOT VALID (local); production unknown|0|Reconcile true author; null/admin/old-owner can satisfy FK but not mapped-teacher completion; no automatic reassignment|Conditional|REQUIRES AUTHORIZATION|
|13|`marks_exam_scope_fk`|marks|Same-school exam reference|NOT VALID (local); production unknown|0|Verify actual exam/year and separately review legacy published flags lacking snapshots|Conditional|REQUIRES AUTHORIZATION|
|14|`marks_student_scope_fk`|marks|Original student numeric-ID school scope|NOT VALID (local); production unknown|0|Verify source ID/school pair and stronger UUID pairing in row10|Conditional|REQUIRES AUTHORIZATION|
|15|`marks_subject_scope_fk`|marks|Original subject ID school scope|NOT VALID (local); production unknown|0|Verify subject scope plus historical class-subject and allocation identity, not just same school|Conditional|REQUIRES AUTHORIZATION|
|16|`schools_management_check`|schools|Government / Aided / Matric for nonnull values|NOT VALID (local); production unknown|0|Authoritative category and missing-value review; null passes CHECK but new registration requires value|Conditional|REQUIRES AUTHORIZATION|
|17|`schools_type_check`|schools|Higher Secondary / Secondary / Middle / Elementary for nonnull values|NOT VALID (local); production unknown|0|Authoritative actual school type and missing metadata review; no guessed category|Conditional|REQUIRES AUTHORIZATION|
|18|`session_membership_user_fk`|sessions|Membership belongs to session user|NOT VALID (local); production unknown|0|Distinguish school sessions from legitimate officer sessions with null membership; active user/membership policy separately|Conditional|REQUIRES AUTHORIZATION|
|19|`students_class_scope_fk`|students|Current class belongs to same school|NOT VALID (local); production unknown|0|Review current class separately from historical enrollments; retain permanent person/history|Conditional|REQUIRES AUTHORIZATION|
|20|`subjects_class_scope_fk`|subjects|Subject class belongs to same school|NOT VALID (local); production unknown|0|Review class-owned vs nullable shared legacy subjects and authoritative class-subject mapping|Conditional|REQUIRES AUTHORIZATION|
|21|`subjects_group_scope_fk`|subjects|Subject group belongs to same school|NOT VALID (local); production unknown|0|Verify optional group/HSC source semantics; no guessed stream classification|Conditional|REQUIRES AUTHORIZATION|
|22|`subjects_teacher_scope_fk`|subjects|Convenience teacher link belongs to same school|NOT VALID (local); production unknown|0|Verify user scope and actual teacher_subject_assignments/profile/active membership; convenience link is not authenticated identity/author proof|Conditional|REQUIRES AUTHORIZATION|

## One-at-a-time validation template — DO NOT RUN in V4

After later authorization an operator substitutes **one reviewed table/constraint**, chosen only from the actual authorized catalog, and approved session lock/statement limits:

```sql
-- Template only. Never batch all22 or auto-repair on failure.
ALTER TABLE public.<reviewed_table> VALIDATE CONSTRAINT <reviewed_constraint>;
```

Then run read-only `pnpm run db:check` with the privately injected exact authorized target and inspect the particular catalog flag/count. Record reviewer/change reference and result. `db:check` itself never executes VALIDATE, UPDATE, DELETE or repairs. If validation fails or other faults remain, HOLD and use the approved data-review/recovery process, not speculative conversion.

Per-item production evidence record to complete later: source backup/restore reference; reviewed row count/semantic exceptions; approved repair reference or none; rehearsal lock/runtime result; validation authorization/operator/time/result; post-check state/count. Leave production columns unset until observed.

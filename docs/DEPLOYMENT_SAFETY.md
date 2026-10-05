# Data-preserving deployment and unresolved dependencies

## Migration contract

Five checksummed transactional migrations retain the nine legacy tables/IDs and add school memberships/roles/identities, academic years, class/section/subject relations, teacher profiles/assignments, per-class allocations/components, person/enrollment UUIDs, archive/audit/recovery/rate-limit/policy structures, immutable UDISE/enrollment/mark identity and append-only publication revisions. Migration0005 adds authoritative `NUMERIC` score/component columns **without retyping or overwriting the original REAL fields**, avoiding float rounding across35 and artificial decimal ties.

- No DROP/TRUNCATE/reset/delete/renumbering or destructive seed is used in the application upgrade.
- Legacy duplicates or ambiguous relations cause transactional failure, not silent repair.
- New FK/check constraints marked NOT VALID enforce **new writes** while retaining potentially dirty legacy rows. `db:check` reports each outstanding constraint definition and read-only violation count in addition to scoped integrity. Each production validation decision is **REQUIRES AUTHORIZED PRODUCTION REVIEW**: see [all22 individual reviews](CONSTRAINT_REVIEW_V3.md). Only an authorized operator may consider validation after backed-up, rehearsed source-data review in an approved window. This audit does not automatically validate or repair any production constraint/data.
- Existing CCE columns are preserved and unused by unapproved workflows. No EMIS ID, FA(A)/FA(B)/SA/Level value or medium/gender split is synthesized.
- School old registration metadata can remain nullable to preserve legacy access; **new** registrations require the approved fields/enums. Correct legacy geography/management/type through an authorized data-review process, not guesses.

`pnpm run verify:legacy` copies an existing `.pgdata` store into ignored `.cache`, migrates only the copy and fingerprints the original. The original store is never opened/migrated by that verification engine and no PID/lock file is removed. In this sandbox the store had no legacy tables/records; its bytes remained unchanged. Populated legacy preservation is therefore separately proven with disposable migration fixtures, **not claimed as a migration of an actual school production database**.

## History and old allocations

Person UUID and enrollment UUID are permanent; ExamNo is a scoped display number. Assessed same-year transfers and established assessment identities cannot be rewritten. Add future-year enrollment rather than move old marks. Student/class/exam archive retains raw history and immutable publication rosters.

Published flags from the old app have no trustworthy frozen roster/header. They return `LEGACY_PUBLICATION_REVIEW_REQUIRED`; archived drafts return `HISTORICAL_REVIEW_REQUIRED`. No snapshot is automatically backfilled. Source verification plus an authorized publication procedure is required.

A recorded final /100 value already matches an approved TOTAL-only input and can be read without rewriting old components. Legacy practical70/20/10 values for classes8–10 cannot be converted to75/25 by guessing. Incompatible stored components are read-only and block editing/reporting/publication with `LEGACY_ALLOCATION_REVIEW_REQUIRED`/pending completion until an approved source-based review/conversion policy is supplied. Missing required/nonnumeric subjects produce **null complete totals/percentages and blank ranks**, not implicit zero contributions.

## Protected operation model

- Authenticate stored session, active membership/user and current role; first-password flags gate protected reads and writes (account security/me/logout remain reachable).
- School IDs, teacher IDs, role/actor and assignments never come from trusted client fields. Each student/enrollment, exam, class+section and subject reference is revalidated in scope.
- TEACHER: mapped rosters/own-subject entry and reports only. Other-entry scores are forbidden in teacher roster/subject-report reads even after assignment changes; ordinary analytics/comparative reads and counts include only the authenticated teacher’s own entries. Class Teacher consolidation/matrix/Form-II is an explicit exception, guarded by all required mapped teacher completion.
- HEADMASTER/PRINCIPAL and legacy ADMIN: same-school administrative scope only.
- CEO District; DEO District+Educational District; BEO District+Educational District+Block, reloaded from persisted authority. Filters cannot widen it; no student names/IDs in geographic aggregates.
- Mark/component/audit, publication, enrollment, assignment, registration and password/recovery operations use transactions. Consistent exam→class and sorted class lock ordering prevents completeness races.
- Same-origin API policy, exact production `APP_ORIGINS`, no reflected/wildcard CORS. Production is unavailable rather than permissive without configuration.
- Passwords/session/OTP hashes and provider secrets are not API response/audit/log values. Browser test traces/screenshots are disabled; transient test credentials are private `.cache` files only.

## OTP deployment

Only a previously registered Admin Contact Number is used. Challenges are HMAC-hashed, expire after300 seconds, one-use, maximum5 guesses, 60-second resend cooldown; request/verify/account/source counters are persistent and atomic. Wrong/unknown accounts are indistinguishable. Recovery/password change invalidates old sessions and pending challenges and audits without secret values. Fake-provider tests are not live SMS delivery proof. The host must provide a strong recovery secret and real authorized HTTPS SMS adapter/API key. Set `TRUST_PROXY=1` only when the edge overwrites forwarded IPs; otherwise source buckets conservatively aggregate and user-agent rotation cannot bypass them.

## Rules awaiting approval / external integration

1. CCE FA Total, Level mapping, entry workflow/permissions, Term structure and publication/edit workflow. Approved independent FA(A)/40, SA/60 and total/100 grades are pure functions only; no feature flag enables an invented register.
2. Class1–5 mark allocations and assessment workflow.
3. Authorized CEO/DEO/BEO identity verification, activation, revocation/provisioning, geographic master directory validation and recovery policy. Public activation remains503; test-only SQL fixtures are not production provisioning.
4. Source-based review/conversion of incompatible legacy practical allocations; old publication snapshot verification. Assessed same-year transfer policy needs approval if schools require it.
5. Production SMS/provider delivery and host-specific TLS/origin/proxy/backup/constraint-validation operations.
6. Geographic comparisons require explicit examination name + academic year; approval of cross-school exam equivalence/name governance is external. Unknown genders/medium appear only in Total; no speculative classification. Promotion treatment of AB/Exemption is not invented: neither is a numeric failure, and ranking requires numeric passes in every required subject.

The requested Vite/Express/pnpm monorepo migration was not performed because the user expressly chose preserving the existing Next stack. This is an approved architectural variance, not a hidden rewrite.

V3 audit, actual test results and remaining release gates: [final verification](FINAL_VERIFICATION_V3.md), [production checklist](PRODUCTION_READINESS_CHECKLIST_V3.md).

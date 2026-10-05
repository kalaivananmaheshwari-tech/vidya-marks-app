# Vidya Analytics implementation / verification status — 2026-10-02

> Historical v2 baseline report. The v3 final gap audit, corrections and production-readiness classification are in [FINAL_VERIFICATION_V3.md](FINAL_VERIFICATION_V3.md); v3 supersedes ownership/completion/primary-calculation conclusions where explicitly corrected.


## 1. What inspected

Existing checkout at07fe4faa, all tracked source/config/deployment files, nine legacy tables, auth/setup/student/mark/analysis/report routes and reusable UI/print modules. Full baseline findings are in REPOSITORY_AUDIT.md. The user approved preserving Next16/React19/TypeScript/Tailwind/Drizzle/PostgreSQL, rather than rebuilding a Vite/Express monorepo. Work remains on arena/01a0fbbf-vidya-marks-app; no production database or external deployment was touched.

## 2. What changed

Incremental scope/security, validated academic rules, exact decimal mark storage/calculation, person/enrollment identity, archive/history preservation, completeness monitoring and consolidation gates, competition ranking and strict subject-only failure, immutable publication revisions, geographic aggregate reports, OTP infrastructure/password/session security and explicit unapproved-feature gates. Existing routes/services/components were reused; unapproved CCE fabrication, destructive reset and public admin enumeration were removed/retired.

## 3. Database changes

Five additive checksummed transactional migrations retain old integer IDs, columns and marks, add UUID/person/enrollment/year/scope/mapping/role/audit/recovery structures and immutable identities, then append-only publication snapshots and separate authoritative NUMERIC values. REAL columns were not retyped or overwritten. Native PG17.9 and disposable PGlite both applied migrations. Existing embedded-store copy verification showed original bytes unchanged; it contained no original tables/records, so production/school-data migration is **not** claimed. Populated preservation and rollback are tested through synthetic legacy fixtures.

## 4. API changes

Shared stored-session/membership/role authorization, strict Zod reference/payload validation, school/class/section/subject/ownership checking and transactions; new academic-year, completion-status, geographic, password-change and OpenAPI endpoints; scoped existing student-entry/report/analysis/setup handlers. Existing marks use PUT. CCE409, public privileged activation503, reset/admin-list410. OpenAPI3.0.3 validates34 existing route paths.

## 5. UI changes

Ordered dynamic registration and mandatory school fields; relational year selectors/future records; required real teacher assignments and cryptographic initial credentials; first-password account screen and role-specific navigation; UUID roster/component-or-Total mark fields with AB/Exemption/Pending, correct8–10 allocations and saving-state protection; reconciled student/current/history views; teacher dashboard/admin completion table; geographic filter/comparison screen; scoped official/archived reports, explicit previous-exam selection, CCE disablement, local Tamil font and semantic print styling. Reusable Field/Modal labels/dialog semantics were repaired during browser verification.

## 6. Security validation — role / school / teacher / geographic

Native service and actual HTTP tests reject unauthenticated access, teacher setup/staff administration, other class/section/subject/school IDs, client role/school/actor spoofing, another entry owner and incomplete/publication writes. Initial password change gates protected reads/writes and invalidates older sessions. Mixed invalid batches roll back. CEO/DEO/BEO scopes are reloaded from database and deny out-of-scope school IDs and school administration; geographic responses contain aggregates, not student names/IDs. Trusted **test-only** officer fixture insertion is not a production verification/provisioning feature. Live compiled production checks proved missing APP_ORIGINS fails503, untrusted origins403 and operational health/OpenAPI remain readable. OTP tests use fake delivery; actual SMS receipt is unverified.

## 7. Tests executed — actual commands and results

Latest substantive runs:

| Command / check | Actual result |
|---|---|
| pnpm run typecheck | exit0 |
| pnpm run lint | exit0, no errors/warnings |
| pnpm run validate:api | exit0;34 documented paths valid |
| pnpm run test |112/112,8 files,43.29s; disposable memory-PGlite |
| pnpm run test:postgres |112/112,8 files,29.01s; native PG17.9 application services; preservation tests themselves use disposable PGlite |
| ALLOW_TEST_WRITES=1 pnpm run test:api |21/21 actual live HTTP checks; tagged isolated local data |
| ALLOW_TEST_WRITES=1 pnpm run test:geographic-api |3/3 CEO/DEO/BEO HTTP role/scope checks |
| pnpm run test:e2e |6/6 real Chromium tests,37.4s; dynamic registration, scoped teacher UI, published readonly, full school→class→teacher→student→password→Total/AB workflow, geographic UI, matrix/Form-II/comparative and PDF generation |
| pnpm run build | exit0; optimized existing Next16.2.6 build, compile11.6s, TypeScript11.2s |
| pnpm run db:check (private isolated native HTTP DB environment) | exit0, read-only;15 years;0 duplicate exam numbers/missing mark identities/cross-scope orphan marks/enrollments/assignments/invalid states/totals/legacy allocation review/missing publication snapshots;1 archived student;22 intentionally NOT VALID constraints reported |
| pnpm run verify:legacy | exit0;5 migrations on COPY only; original .pgdata byte-for-byte unchanged; tables[] in original empty store |
| Compiled production next start on3001 + Node HTTP assertions |4 checks passed: native readiness, missing origins503, untrusted origin403, public OpenAPI200; temporary server then stopped |
| PDF inspection | actual landscape MediaBox841.91998×594.95996pt; portrait594.95996×841.91998pt;2 pages each; semantic table header repetition/no navigation verified in print DOM |
| git diff --check | exit0 after whitespace correction |

Earlier failures were fixed and relevant commands rerun: allocation/SQL TypeScript mismatches, native locale/bootstrap, transaction-local parallel pg query warnings, numeric→REAL COALESCE coercion, unsafe user-agent source-limit keying, nondeterministic test row-order assumptions, missing browser libraries/dev-origin resources, label/dialog selectors and a save/refresh race. Browser CDN installation was blocked by TLS; Chromium/NSS came from development-only npm packages with browser web security kept enabled. No screenshot-based report generation or secret traces were used. CI and Docker/cloud deployment configuration was updated but not executed against a provider.

## 8. Remaining issues

- Actual production PostgreSQL connection, backup/restoration, deployment/TLS/proxy and legacy review are not available/verified. Review and validate the22 additive NOT VALID constraints on an authorized backed-up database before production use.
- Real SMS adapter/secrets/delivery receipt are missing; recovery fails closed until configured.
- Officer public identity activation/provisioning, CCE workflow, class1–5 scoring, incompatible legacy component conversion and old publication review remain blocked.
- Native `.cache` preview/testing data is temporary and contains only tagged verification fixtures; do not enter actual student records there. A durable production database is required.
- External dependency vulnerability/penetration audits and hosted load testing were not performed. Successful build/tests are not government-format certification or production deployment approval.
- Vite/Express monorepo migration was intentionally not implemented under the user's approved preserve-stack decision.

## 9. Unresolved business rules

CCE FA Total/Level/entry/permissions/Term/publication/edit rules; approved primary-class scoring; officer verification/revocation/geographic-directory/recovery policy; source-based legacy practical/snapshot review and any desired assessed same-year transfer workflow; cross-school examination equivalence governance and overall promotion treatment of AB/Exemption. Conservative implemented behavior preserves nonnumeric states, does not award an all-required-pass rank without all numeric passes, and does not invent missing information.

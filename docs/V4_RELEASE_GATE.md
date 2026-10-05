# VIDYA ANALYTICS — V4 production deployment preparation & release gate

**Date: 2026-10-02. Preparation only; V3 accepted as implementation baseline.** Work stays on `arena/01a0fbbf-vidya-marks-app`. Next16.2.6 / React19.2.6 / TypeScript / Tailwind / Drizzle / PostgreSQL, verified business rules and data model are preserved.

## 1. What changed — and what did not

Two narrowly justified changes only:

1. **Release-safety configuration:** audited Vercel workflow automatically deployed pushes to main and defaulted manual target to production without approval gating. It is now **manual-only, preview-default**, explicit false-default acknowledgement + nonempty release reference, disabled-by-default repository enable flag, separate production approval flag and named staging/production environment boundary. No workflow, Vercel CLI, deployment flag, protected environment or secret was enabled/configured/executed. Required-reviewer/branch protections and external native Vercel Git auto-deploy remain later operator evidence, not inferred from YAML.
2. **Reproduced E2E waiter race:** full rerun initially passed6/7; Subject response had already returned200 before a late waiter. Clicking the already-selected Subject tab issues no new request. Moved waiter before navigation and **added examination-ID matching**; retained every HTTP-success/table/row/header/A4/signature/no-navigation assertion. Affected test passed, then full7/7 passed. Application behavior was not changed to satisfy a test.

Before/after fingerprinting confirms **all `src/**`, five migrations, test files other than this waiter, scripts, package/lockfiles, Next config, Docker/Compose and environment template unchanged**. New runbooks/document links and the two targeted corrections are the V4 deliverables. No new migration/schema/business rule/framework/rebuild/redesign was introduced.

### Non-execution boundary

No production/unknown database connection, real student-record change, database deletion/reset, actual-school legacy migration, real constraint validation/repair, live SMS setting/receipt, cloud/container/production deployment or hosted TLS/proxy action. Local suites create explicitly isolated synthetic fixtures. Even newly created V4 test databases were left intact: the native suite ran directly instead of the existing create/drop cleanup wrapper. Public student archive tests retain history; they operate only on tagged synthetic records. Private connection files, credentials, raw logs/PDFs and QA dependencies remain ignored in `.cache`.

## 2. Operator preparation pack

- [Environment inventory](V4_ENVIRONMENT_INVENTORY.md): repository-consumed settings, classification/secret flag, purpose/environment, actual local presence vs unknown real target, safe missing/default behavior. No invented session/JWT/public-URL secret and no values printed.
- [Database/backup/migration runbook](V4_DATABASE_RELEASE_RUNBOOK.md): compatibility/TLS/pool/transaction gates; full backup → verification → isolated restore → read-only integrity → authorized application smoke; exact existing five migrations/hashes, stop/go/recovery and command boundaries. **Real backup/restore NOT TESTED.**
- [Individual22-constraint checklist](V4_CONSTRAINT_OPERATOR_CHECKLIST.md): exact table/name/purpose/state, synthetic count0 each, prerequisites/conditional safety, backup→review→approved repair→one-at-a-time validation→recheck. No automatic repair/validation.
- [Host/security/SMS checklist](V4_HOST_SECURITY_CHECKLIST.md): existing build/start/health/OpenAPI/proxy/cookies/expiry/logout/password/OTP/rates/lifecycle/logging/monitoring and authorized provider/sender/test-number checklist. No provider readiness claim.
- [Pre-change audit](V4_PREPARATION_AUDIT.md): findings/change rationale and later confirmed harness defect. Accepted baseline history: [V3 verification](FINAL_VERIFICATION_V3.md).

## 3. Exact health contract and release interpretation

GET `/api/health`200 on the locally migrated PostgreSQL process:

```json
{"ok":true,"database":"postgresql","persistent":true,"migration":"0005_exact_numeric_marks.sql"}
```

Missing schema/version:503 MIGRATION_REQUIRED. Missing/invalid/unavailable DB:503 DATABASE_UNAVAILABLE. Missing production origins separately blocks protected API503 ORIGIN_NOT_CONFIGURED. GET `/api/openapi` returns OpenAPI3.0.3/34 documented paths.

No `environment`, `demoEnabled`, backup/SMS/TLS/pool/complete-migration-audit health fields are invented. `persistent:true` means **DATABASE_URL supplied**, not durable hosting/backup proof. Readiness checks required ledger version presence, not all migration checksums/catalog objects. Production mode is established by actual `next start` launch and observed Secure cookie behavior; actual hosted mode/settings must still be verified by operator.

## 4. Report release catalog — existing interfaces, not invented features

The repository has four approved school-official modes; the fifth official-school tab is **CCE and remains blocked**, not a fifth approved school report. The existing geographic aggregate provides another scoped report category; comparative is separate. This inventory addresses all actual categories rather than invent a report or activate CCE to satisfy a numerical description.

| Existing category | Authorization/calculation release invariant | Semantic print evidence / operator hold |
|---|---|---|
| Consolidated | Same-school administrator or exact Class Teacher; every required mapping/active mapped teacher's own entries/every required student complete; required-pass numeric totals/ranks only | A4 landscape/portrait, actual repeated header/80 unsplit stress rows, Class Teacher/HM signatures together, no navigation |
| Subject mark list/analysis | Assigned teacher's own entries only; admin same school; no foreign roster/matrix leakage; correct numeric pass/fail/AB/EXEMPT/pending | Semantic tables and appropriate TOTAL/components; A4 both orientations, repeated headers/80 unsplit rows, Subject Teacher/HM signatures together |
| Result matrix/failure analysis | Consolidated permission and completion; strict selected-subject-only failure requires pass in every other required subject | A4 both orientations, repeated headers/80 unsplit rows, Class Teacher/HM signatures together |
| Form-II | Consolidated permission and completion; truthful optional previous-exam comparison; no guessed demographics/components | A4 both orientations, repeated headers/80 unsplit teacher rows, paired Class Teacher/HM signatures |
| Geographic aggregate | Stored CEO district / DEO district+educational district / BEO all three; client filters cannot widen; no school-admin endpoints or student identity; existing explicit-name/year aggregation, no new equivalence mapping | Actual local authorized BEO DOM/PDF:8 scoped rows, A4 portrait,80 unsplit stress rows/repeated headers, no navigation. Accepted aggregate has no defined signature block; none fabricated. Real officer provisioning/signature/master-data/governance approval remains held |
| Student comparative | Administrator same school; teachers only assigned subjects and own entries/corresponding students; stable person/enrollment/year history and correct eligible rank | Semantic portrait report, repeated headers/80 unsplit rows, Class Teacher/HM/Parent signatures together, no navigation |
| CCE (disabled official tab) | API409/UI disabled until FA Total/Level/entry/permissions/terms/publication/edit approval | BLOCKED; no PDF/register invented |

14 school-official/comparative semantic PDFs re-inspected, plus2 geographic PDFs. All school signature blocks stay together. Geographic signatures are not present/approved in the accepted aggregate and are not falsely claimed. PDFs come from live semantic HTML, **not screenshots**; small comparative-card decorations can be browser-rasterized without converting report tables into image pages. No physical-printer/government-format certification.

## 5. Actual V4 verification results

| Executed local verification | Result / boundary |
|---|---|
| `pnpm run typecheck` | exit0, rerun after waiter correction |
| `pnpm run lint` | exit0, rerun after waiter correction |
| `pnpm run validate:api` | exit0, OpenAPI3.0.3 /34 paths, rerun |
| `pnpm run test` |117/117,9 files,49.61s; unchanged assertions |
| Same `pnpm run test` with private TEST_DATABASE_URL pointing to newly created local native DB |117/117,9 files,30.26s; native PostgreSQL17.9; database retained, no wrapper cleanup/drop |
| `ALLOW_TEST_WRITES=1 pnpm run test:api` |33/33 live groups, original21 +12 accepted v3 ownership/completion/primary regressions |
| `ALLOW_TEST_WRITES=1 pnpm run test:geographic-api` |3 persisted roles +39 individual tampering/administration assertions |
| Initial `pnpm run test:e2e` |6 passed/1 timeout due confirmed late Subject waiter; no app/report failure concealed |
| Affected `test:e2e -- --grep 'all approved report families'` |1/1 after minimal waiter correction,17.4s |
| Full final `pnpm run test:e2e` |7/7,46.7s; screenshots/traces off, browser web security retained |
| `pnpm run build` final | exit0; Next16.2.6 compilation12.8s, TypeScript12.0s |
| Guarded local read-only `pnpm run db:check` | exit0;0 scoped/identity/state/allocation/publication faults;22 still NOT VALID, each count0, validationPerformed=false |
| `scripts/verify-print-pdfs.py` (private pypdf QA dependency) |14 PDFs/5 school-official+comparative families, A4/no-nav/paired signatures/repeated headers/400 unsplit stress rows |
| Additional guarded geographic browser/PDF probe |2 semantic PDFs,8 normal rows;80 unsplit stress rows, header on4 row-bearing pages; no signature/provisioning certification |
| Local compiled-production missing-origin run |4/4 groups: exact readiness200, protected missing-origin503, untrusted403, OpenAPI200 |
| Local compiled-production configured-origin/session run |12/12 groups: auth-gated allowed origin401, untrusted403 (also with cookie), cross-site403, preflight405/403/no reflected or credential CORS, unconfigured recovery503, Secure/HttpOnly/Lax/host-only/7day cookie, scoped session200, four official report modes with frozen3 rows/1,1,3, CCE409, logout→old cookie401 |
| Local compiled-production unmigrated DB |503 MIGRATION_REQUIRED; public table count0 before/after; no automatic DDL/data writes |
| Local compiled-production missing DB, development PGlite flag present |503 DATABASE_UNAVAILABLE; no production PGlite fallback |
| Local shutdown/connection observation | Migrated fixture DB client count0 before process start,1/2 while serving,0 after each stop; no hosted in-flight-drain/load/supervisor claim |
| Release workflow validation | PyYAML parsing,7 shell scripts syntax checked,5 preflight cases,108 local authorization-gate combinations; only dispatch trigger, preview default, acknowledgement false default; no Actions run/provider call |
| Before/after implementation fingerprint / final `git diff --check` | Only workflow + E2E waiter among fingerprinted code/config files changed; source/schema/package/Docker preserved; whitespace check exit0 |

117 in each runner is the **same suite**, not234 distinct tests. Migration fixture tests additionally use disposable PGlite. No real backup/restore, provider receipt, actual hosted proxy/TLS/pool/load/drain or production ledger/catalog integrity result is inferred from these counts. Actual GitHub names-only metadata could not be read (connection/repository access unavailable); no credentials/configuration retrieved or changed. An initial scratch geographic selector expected the school-name cell exactly but it also includes UDISE; the probe was corrected to the existing semantic table-content/row assertion and rerun. This was private verification only, not an application alteration.

## 6. Data safety and unresolved scope

Preserve original student IDs/UUID/person identity, enrollments/year/section/history, scoped exam numbers, original REAL/exact marks/components and true entry author, NUMERIC/AB/EXEMPT/PENDING distinctions, publication revisions, audit history and archived students. V4 authorizes no automatic deletion, mark rewrite, owner transfer, renumbering, legacy conversion, guessed snapshots or modification of published revisions. Migration backfills/additive effects require the separate approved restored-copy rehearsal and real-target change procedure.

CCE and Classes1–5 scoring remain409/unavailable. Public officer activation remains503; test-only SQL provisioning is not production provisioning. Incompatible legacy allocation/publication/identity records stay review-gated. No promotion/AB-Exemption promotion rules, officer activation/revocation/recovery/master-data policy, public enumeration or cross-school examination-equivalence governance is invented or enabled. Existing scoped same-name/year comparisons remain the accepted baseline, not a new equivalence policy.

## 7. Final release checklist

Only **PASS / BLOCKED / NOT TESTED / REQUIRES AUTHORIZATION** are used in this checklist. PASS is the specific local/source/preparation result, never a production evidence substitution.

| Item | Status | Evidence | Operator Required |
|---|---|---|---|
| Existing Next/React/TS/Tailwind/Drizzle/PostgreSQL retained | PASS | Versions/source fingerprints unchanged | No stack decision/migration |
| Verified teacher/school/class/section/subject/owner/completion/ranking rules | PASS | Unchanged117/117 in both runners +33 HTTP | Repeat authorized host smoke; do not weaken |
| Safe phase boundary/no real target touched | PASS | Explicit local guards, secret-free presence checks; no deploy/drop/reset/real SMS | Future target authorization separately |
| Full production-variable inventory prepared | PASS | V4_ENVIRONMENT_INVENTORY.md; no invented auth/public URL keys | Confirm protected target settings without values in chat/logs |
| Actual production/staging secrets/environment injection | NOT TESTED | No authorized target supplied; GitHub metadata unavailable | Host/operator review and protected injection |
| Manual preview-default deployment gate prepared | PASS | YAML/shell/preflight/108 local combinations; automatic push trigger removed | Do not enable/dispatch in V4 |
| GitHub reviewers/no-self-approval/branch protection and native Vercel auto-integration | NOT TESTED | Environment names do not prove protection/configuration | Authorized owner config/evidence before any release |
| Staging target/infrastructure change permission | REQUIRES AUTHORIZATION | No target execution authorization in this phase | Named owner, host/database/change/window and safe fixtures |
| Durable production PostgreSQL/version/least-privilege roles | NOT TESTED | Local17.9 only; Compose16 not run | Selected provider compatibility/rehearsal/role evidence |
| Actual DB TLS/certificate/hostname verification | NOT TESTED | Local-only fixture; no production TLS | Prove certificate validation, no insecure workaround |
| Pool/replica budget/provider pooler/load behavior | NOT TESTED | Fixed10/process/5s/10s; local tests not capacity proof | Capacity reserve and actual load/transaction tests |
| Backup/restore procedure prepared | PASS | Full-dump/verification/isolated-restore/integrity/smoke/recovery runbook | Later authorized execution only |
| Real backup verification/restore/RPO/RTO | NOT TESTED | No real authorized backup/restore performed | Capture durable encrypted backup and prove isolated recovery |
| Exact five-migration order/hashes/pre-post checks/recovery prepared | PASS | Existing files and checksummed transactional/advisory-lock runner inspected | No new migration or direct manual SQL reorder |
| Production migration/recovery rehearsal/execution | REQUIRES AUTHORIZATION | Only new local fixtures migrated | Backup→review→restored-copy rehearsal→write freeze→approved execution |
| All22 individual NOT VALID constraints reviewed | PASS | Exact names/purposes/state; synthetic count0 each, none validated | Complete individual real-target review record |
| Production constraint record review/repair | REQUIRES AUTHORIZATION | Real counts/catalog/semantics unknown | Approved source-based review/repair only; no automatic change |
| One-at-a-time production constraint validation | REQUIRES AUTHORIZATION | All22 remain NOT VALID locally, no validation performed | Backup, zero actual violations, lock rehearsal, individual approval and recheck |
| Existing health/OpenAPI contract and failure semantics | PASS | Exact200/503 cases, no invented fields | Repeat on real host; persistent is not durability certification |
| Same-origin fail-closed policy/credentials/preflight | PASS | Compiled local configured/missing/untrusted/CORS/cookie tests | Exact HTTPS host origin and browser transport proof still needed |
| Actual HTTPS/domain/certificate/reverse-proxy/forwarded-source trust | NOT TESTED | No real host TLS/proxy | Operator networking/certificate/TRUST_PROXY evidence |
| Password/session/first-change/logout/reset software safeguards | PASS | Native/fake-provider baseline and real local compiled cookie/logout checks | Hosted HTTPS/session/rate/reset smoke on approved accounts |
| SMS configuration/sender/test-number/test-suite checklist prepared | PASS | V4_HOST_SECURITY_CHECKLIST.md; provider triple unset | Do not inject real provider credentials in V4 |
| Real SMS provider credentials/sender/receipt/expiry/use/rates/invalidation evidence | BLOCKED | No authorized provider/configuration/receipt | Separate integration authorization and approved test contact |
| Approved school official/comparative authorization/calculations/print | PASS |33 HTTP +7 browser +14 parsed PDFs; signatures/header/rows/no-nav | Actual authorized host report smoke; no government certification |
| Existing geographic aggregate authorization/semantic print | PASS |3 roles/39 tamper +2 parsed scoped BEO PDFs | Production officer provisioning/governance remains blocked; no invented signature policy |
| Government-format/physical-printer certification | NOT TESTED | Local semantic PDFs/fonts only | Independent approved format/printer review if needed |
| Next lifecycle and local process/connection cleanup | PASS | Installed drain implementation; local connections0 after stops | Hosted in-flight transactions/drain/restart still untested |
| Actual hosted shutdown/restart/health drain/database cleanup | NOT TESTED | No real platform/supervisor/load test | Stage under chosen host, preserve all-or-nothing writes |
| Logging/monitoring/alerting/backup retention/on-call integration | NOT TESTED | App audits/redacted code exist, no external platform configured | Authorized sinks/retention/redaction/alerts/incident owner |
| CCE | BLOCKED | API409/UI disabled, unresolved rules untouched | Approve FA Total/Level/workflow/permissions/terms/publication/edit before separate implementation |
| Classes1–5 scoring | BLOCKED | Calculation409/aggregate exclusion retained | Approved rules before implementation |
| Officer provisioning | BLOCKED | Public503; fixture SQL not authority workflow | Activation/revocation/recovery/master-data authority |
| Legacy conversion/actual-school migration | BLOCKED | No approved source conversion or real data access | Source/review/repair/conversion authorization; never automatic |
| Promotion/AB-Exemption promotion treatment | BLOCKED | No approved transition policy activated | Business owner approval in later scope |
| Cross-school equivalence/public enumeration policy activation | BLOCKED | No new equivalence/public privacy feature enabled | Explicit governance approval, not guessed matching |
| Real production deployment/traffic release | REQUIRES AUTHORIZATION | Production/backup/TLS/provider/operator evidence absent | Satisfy mandatory target gates and approve rollout separately |

## 8. Final classification

# READY FOR AUTHORIZED STAGING

This means the **unchanged approved Classes6–12 implementation plus targeted release controls/runbooks** can proceed to a later explicitly authorized isolated staging phase. It is **not authorization to deploy now**, connect to an unknown target, validate real constraints, restore/migrate school data, configure live SMS, expose secrets or enable unresolved features. Production evidence does not exist here and no production deployment readiness is claimed. Required next authorization: named staging target/operator, durable isolated DB/backup boundaries, HTTPS/origin/proxy configuration and approved test accounts; keep recovery/unresolved scope disabled until separately approved.

The main local preview is restored on port3000 with synthetic data only. It is not durable school hosting; do not enter actual student records there.

## 2026-10-05 existing-project release follow-up

User selected the existing Vercel Preview environment. [Current preflight](VERCEL_RELEASE_PREFLIGHT.md) identifies existing deployment metadata and blocked operator gates. `vercel.json` now holds native automatic Git deployments for the reviewed revision, which the manual-only Actions workflow alone did not cover. Workflow environments now match existing **Preview/Production** names. No app/schema/business changes or production deployment. The Preview DB/origin/readiness and release permissions/protection still need evidence; no successful deployment is inferred.

# V4 database, backup and migration operator runbook

**Preparation only. None of the production procedures below was executed.** No real database connection, backup/restore, real constraint validation/data repair or legacy migration is authorized by V4. The operator must obtain a later explicit target/change authorization before using these procedures. Never test fixture writers against a production URL.

## 1. Pre-deployment database checklist

| Item | Required operator evidence | Current status |
|---|---|---|
| Exact authorized instance | Owner/provider/account/database/schema/environment/change ticket; verify target through secret settings without printing URL/password | REQUIRES AUTHORIZATION |
| Version compatibility | Native PostgreSQL17.9 passed locally. Compose selects16-alpine, which was not run here. Rehearse the chosen provider version, SQL/functions/triggers/permissions on an isolated restored copy. Never attach an old major-version data directory to a different major's image | NOT TESTED |
| Connection/authentication | Distinct least-privilege app/migration/backup/review roles as supported; approved service profiles; no implicit shell DB defaults or privileged app account | NOT TESTED |
| TLS | Provider-supported certificate-verified URL/CA and hostname validation; prove bad certificate/name rejection. No disable/no-verify/rejectUnauthorized=false workaround. Internal Compose network is not evidence of DB TLS | NOT TESTED |
| Pool configuration | Existing per-process max10 / connect5s / pg-pool idle10s; total workers×10 plus reserve for backup/admin/migration; provider pooler transaction/DDL/advisory-lock support and load evidence | NOT TESTED |
| Migration ledger | Read-only inspection of exact five names/checksums in vidya_schema_migrations and actual schema/triggers/constraint state; readiness only checks required version presence, not checksum/content completeness | REQUIRES AUTHORIZATION |
| Backup/restore | Secure full database backup, verified restore to isolated empty database, record/identity/history checks, smoke evidence and approved RPO/RTO | NOT TESTED |
| Transaction/write safety | Approve write-freeze/maintenance boundary and lock/statement limits; no user writes during schema/data backfill/validation. Existing academic/admin/audit changes are transactional | REQUIRES AUTHORIZATION |
| Recovery plan | Record pre-release app artifact/configuration plus backup/PITR target; separate restored target and traffic cutback/reconciliation; no destructive down migration | REQUIRES AUTHORIZATION |

## 2. Backup → verification → isolated restore → integrity → application smoke

### Before commands

- Authorized operator records target identity and change window; store backup on restricted, encrypted, durable storage **outside this repository/sandbox**. Never put actual records in `.cache`, Git, chat or CI public artifacts.
- Use compatible `pg_dump`/`pg_restore` tools (record client/server major and versions). The sandbox does not provide a tested production backup toolchain.
- Supply approved libpq service profiles via protected `PGSERVICEFILE` and credentials via secret manager/`PGPASSFILE` with restrictive permissions. Public command lines contain only service names/paths, never passwords/complete URLs. Do not print service/password files or resolved Compose config.
- `BACKUP_SERVICE` identifies the authorized source. `RESTORE_SERVICE` must identify a **different brand-new isolated database**, inaccessible to the normal app, with no real SMS/provider configuration. Verify independent instance/database/service identities without disclosing connection credentials.
- Check the restore destination has no application tables/data before restoring; do not use cleanup/overwrite options to make it empty. Require separate authorization for creating infrastructure and selecting the original source.

### 1 — Full database backup (template; not executed)

```bash
# Only in an approved operator environment. Required values come from protected settings.
set -euo pipefail
umask 077
: "${BACKUP_SERVICE:?Approved source service required}"
: "${BACKUP_DIRECTORY:?Restricted durable backup path required}"
BACKUP_ARCHIVE="$BACKUP_DIRECTORY/vidya-pre-release.dump"
pg_dump --dbname="service=$BACKUP_SERVICE" --format=custom --file="$BACKUP_ARCHIVE"
sha256sum "$BACKUP_ARCHIVE" > "$BACKUP_ARCHIVE.sha256"
```

This captures schema/data for the whole selected database, not just marks. Record roles/ownership/ACLs/extensions/configuration and any out-of-database assets needed for recovery. Database dumps do not replace an authorized cluster-global/PITR/secret/config backup policy; obtain provider/operator instructions rather than blindly exporting all cluster credentials. pg_dump uses a consistent database snapshot; coordinate concurrent DDL and approved write freeze for release/reconciliation.

### 2 — Backup verification (template; not proof by itself)

```bash
sha256sum --check "$BACKUP_ARCHIVE.sha256"
pg_restore --list "$BACKUP_ARCHIVE" > "$BACKUP_ARCHIVE.list"
```

Check command exit statuses/archive manifest, expected tables/sequences/functions/indexes/triggers/constraints and encrypted retention/access permissions. The listing/checksum proves archive readability/integrity only, **not restorability or correct data**. Inspect personal-data-bearing manifests only in authorized storage.

### 3 — Restore into the approved empty isolated database

```bash
: "${RESTORE_SERVICE:?Explicit different isolated destination required}"
pg_restore --dbname="service=$RESTORE_SERVICE" --exit-on-error --single-transaction \
  --no-owner --no-privileges "$BACKUP_ARCHIVE"
```

The restore flags allow an isolated test owner; they do not authorize silently changing production ownership/privileges. Rehearse/grant the approved least-privilege roles separately and record fidelity differences. No `--clean`, `DROP`, `TRUNCATE`, `down -v`, reset/reseed, overwrite-live-DB or automatic data repair. If restore fails, stop and review; do not delete live data or strip constraints to force success.

### 4 — Read-only restored integrity and fidelity checks

- In an approved private execution profile, inject DATABASE_URL pointing **only to the isolated restored DB**, `DEMO_MODE=0`, `AUTO_MIGRATE=0`; never print it. Run `pnpm run db:check`. It uses repeatable-read/read-only diagnostics, not repairs or validation.
- Compare original IDs, student UUID/person pairing, enrollment history/class/year/section, exam numbers, original REAL and exact mark components, NUMERIC/AB/EXEMPT/PENDING states, entry authors, snapshots/revisions, audit history and archived students. Record counts and approved private fingerprints; hashes/counts are not a license to publish personal records.
- Review every diagnostic failure and22 individual constraints, including nullable/check-UNKNOWN cases, role/ownership/allocation semantics and legacy flags lacking verified snapshots. Document raw source records requiring separate repair authorization.
- If the source predates the migration ledger/readiness, do **not** run `db:check` before rehearsal as if schema ready: first inventory old schema/data read-only, then apply existing migrations on that copy after rehearsal authorization, then compare preservation and run integrity checks.

### 5 — Application smoke on the isolated restored target

Build the exact reviewed commit/lockfiles; start existing Next in production mode with approved staging origin, not `next dev`. SMS stays unconfigured. Use authorized test accounts/non-sensitive fixtures; **do not run `test:api`, `test:geographic-api`, `test:e2e`, demo seed or native create/drop runners on a real/restored school target without specific fixture-write authorization**. Retain read-only role/report checks where possible; approve any test entry/publication transaction separately. Verify readiness/OpenAPI, secure session behavior, school/teacher/owner/geo isolation, completion gate, five approved existing report categories plus comparative as catalogued in the release report, printing and blocked features. Record restore duration and approved RPO/RTO result. A completed isolated restore is not an overwrite/rollout authorization.

**Backup/restore execution status: NOT TESTED against an authorized environment.** Local synthetic migration preservation/rollback tests are not full backup/restoration evidence.

## 3. Exact migration order — no new migration in V4

The existing runner sorts names, verifies SHA256 of applied files, locks `pg_advisory_xact_lock(8392147)` and runs all pending statements/ledger updates in one transaction. Applied matching versions are skipped; changed applied checksum aborts. This serializes migration runners, not ordinary app writes: maintenance/write controls remain necessary.

| Order | Exact filename | Purpose and preservation boundary | SHA256 |
|---:|---|---|---|
|1|`0001_legacy_schema.sql`|Baseline nine legacy tables/previous additive columns via IF NOT EXISTS. Retains IDs and REAL fields; no drop/reset.|`1fd61f12e902d38742ebc262eb3e1c432d427abe1f6e00f6d01b4cc79d00d1a2`|
|2|`0002_scopes_and_academics.sql`|Academic years; school/member/role/person/enrollment/section/subject/teacher/allocation identities; nullable old registration metadata; status/scope/audit/recovery/rate limits. Backfills new identity/status/allocation-snapshot fields without recalculating original scores; duplicate ambiguity fails.|`034494e28e4e3deb48797e1b761363027a5ef267764012522b0e98939a316d34`|
|3|`0003_identity_constraints.sql`|Stronger same-school/session/person/allocation links, required new-write mark identity, optional factual medium, Roman-class allocation configuration; original mark values/IDs not converted.|`fd30bccd1ec0086b05bde402c394291c5b6f57e6071e04db9c940abadf3e10d9`|
|4|`0004_publication_history.sql`|Append-only publication revisions and immutable assessment identity. No fabricated legacy publication snapshots.|`6119edcded89ea0a6daccf648ba0f314a18dcb2eb09182d09181874f8b01c51e`|
|5|`0005_exact_numeric_marks.sql`|Adds authoritative NUMERIC fields/components and backfills the recorded REAL numeric representation separately; original REAL columns not retyped/rewritten; two NOT VALID checks.|`e0484c53b0b00981887cdc7e664608bcf4a574cc17cd8faa29bb237bafe700f0`|

Additive does **not** mean no DML: the runner initializes/backfills new relations/columns and approved allocation configuration. That is why real execution requires backup, source review, restored-copy rehearsal and authorization. No CCE/primary workflow, guessed legacy score conversion, entry-owner transfer, exam-number rewrite or snapshot edit is permitted.

## 4. Pre-migration release stop/go checks

1. Obtain explicit target/window/operator approval and write-freeze plan. Confirm the reviewed source SHA/lockfiles and unchanged migrations/hashes above.
2. Capture/verify backup and restore evidence; preserve pre-release application and protected configuration, not secret values in the ticket.
3. Inventory ledger/schema/data read-only. Review current REAL/status/UUID/author/enrollment/year/class-subject/allocation semantics, active exam-number duplicates, historical published flags/snapshot absence and school geography/enums.
4. Rehearse **exact existing migration sequence on isolated restored copy**, including failure rollback/locks/runtime/connection pooler behavior and comparison of original columns. No manually reordered SQL or edits to applied files.
5. Approve migration role, direct/compatible maintenance connection and reviewed lock/statement limits. Configure limits per authorized process/role/provider; do not invent tuning env knobs or share app superuser credentials.
6. If any ambiguity/incompatibility remains, HOLD. Use only an approved source-based repair procedure in a separately authorized step. Never delete/renumber/reassign/recompute to obtain success.

## 5. Migration execution — later authorization only

```bash
# Separate authorized maintenance environment; DATABASE_URL injected privately for the EXACT approved target.
pnpm run db:migrate
pnpm run db:check
```

No public request/startup performs production migration/seed. **Compose caveat:** current `app` depends on `migrate`, whose command runs `db:migrate && db:check`; `docker compose up` is therefore a schema-changing release action, NOT a harmless preparation/health check. Do not run it before the approved backup/review/window. Never use `docker compose down -v`. Compose/version/image-digest/volume identity must be reviewed by the operator; it was not executed here.

## 6. Post-migration checks before traffic

- Check all five ledger names/checksums and expected catalog/columns/indexes/triggers; no checksum drift, no unintended schema changes. All22 remain NOT VALID unless separately authorized per item; migration does not silently validate them.
- `pnpm run db:check` zero relevant identity/scope/state faults and reviewed individual violation counts; compare original columns/IDs/history/private manifests from pre-release/restored rehearsal.
- Existing GET /api/health200 must report ok=true, database=postgresql, persistent=true, migration=0005_exact_numeric_marks.sql. These fields do NOT certify backups/TLS/origins/production mode or that every catalog object/checksum is correct. Check those independently.
- OpenAPI3.0.3/34paths, login/session/security, correct target origin, required blocked features and authorized report smoke/semantic print on actual staging host.
- Start only the exact approved Next artifact; unblock traffic only with operator acceptance, alerting and recovery ownership. Production execution is not authorized by this checklist.

## 7. Rollback/recovery procedure

- A failed pending migration rolls back its transaction; stop/review original error in restricted operator logs, never log connection secrets or force partially modified statements through.
- On application-release failure, hold traffic/writes, preserve logs/transaction evidence, revert to the reviewed compatible previous app artifact/config while keeping additive schema if the rehearsal proved compatibility. Do not remove new columns/tables/identities or edit the ledger/checksums.
- If database recovery is required, restore/PITR into a **separate approved replacement** database, verify integrity/identities/history/security/smoke, reconcile any writes accepted since backup under explicit data-owner approval, then perform controlled target/traffic cutover. Never restore over live data casually or erase post-backup records without an approved recovery decision.
- Record actual RPO/RTO, cause, backup/revision/source version and accountable approval. Rollback/recovery rehearsal/execution on a real authorized target remains NOT TESTED.

## 8. Verification command boundaries

Local fixture gates, on explicitly isolated resources only: `pnpm run typecheck`, `lint`, `validate:api`, `test`; native `TEST_DATABASE_URL` suite, local `test:api`, `test:geographic-api`, `test:e2e`; `build`; guarded local `db:check`; semantic PDF inspector; `git diff --check`. Existing `test:postgres` wrapper drops only its random disposable test DB after tests, so **V4 deliberately uses the same suite directly on a new local native DB and leaves it intact** to honor this phase's no-database-deletion rule.

Authorized-target operations require a later step: backup/restore, migration, real data review/repair,22 one-at-a-time validations, deployed smoke/provider tests and rollout. See [22-constraint operator checklist](V4_CONSTRAINT_OPERATOR_CHECKLIST.md) and [release gate](V4_RELEASE_GATE.md).

# Vidya Analytics — Tamil Nadu School Mark Analysis

This is the **existing Next.js application**, incrementally enhanced on the original React/TypeScript/Tailwind/Drizzle/PostgreSQL stack. The user approved retaining it after the repository audit; no Vite/Express replacement or parallel application was created.

## Implemented safeguards and functionality

- Required school geography, unique immutable 11-digit UDISE, exact management/type choices; HEADMASTER/PRINCIPAL memberships and individual TEACHER accounts with actual Class + Section + Subject assignments.
- Server authentication, membership-derived roles and school/assignment scope on every protected route. Initial teacher passwords must be changed; session rotation/invalidation is transactional.
- Relational academic years initially 2026–2027 through 2040–2041, plus future records. Permanent person/enrollment UUIDs and class/section/year exam numbers; archive preserves history.
- Approved class-specific allocations: 6–7 / 11–12 = 70+20+10 or 90+10; 8–10 = 75+25 or Total /100 only. Numeric pass ≥35; AB/Exemption are nonnumeric; partial entries are Pending. Exact NUMERIC columns preserve near-threshold values and exact total ranking without altering legacy REAL columns.
- Consolidation requires all required subjects, assigned active teachers and completed entries; exact pending-teacher blocker. Admin/teacher monitoring, competition ranks 1,1,3 and strict subject-only failure analysis.
- Semantic consolidated, subject, matrix, Form-II and comparative HTML reports; A4 portrait/landscape, ~8mm margins, repeating headers and local Tamil font support. Publication revisions freeze the roster, marks and header so student/class/exam archive cannot erase a published report.
- Persisted CEO/DEO/BEO scopes and published aggregate school comparisons (Male/Female/Total, management/class/subject filters, school subject-average competition rankings).
- OTP challenge infrastructure: registered contact only, HMAC hash, expiry/single-use/attempt/cooldown/rate limits, generic responses, session invalidation and redacted audit. Real SMS delivery is **not configured or claimed verified**.

## Deliberately gated

CCE workflow, FA Total, Level mapping, term/permission/publication/edit rules are unapproved. CCE endpoints return 409 and the UI is disabled; approved independent FA(A)/SA/Total grade functions are tested separately. Class1–5 scoring is unapproved. Public CEO/DEO/BEO self-activation returns 503 until authorized verification/provisioning policy exists. Legacy incompatible practical allocations and published flags lacking verified snapshots require human review; no scores, EMIS IDs, gender/medium splits or historical snapshots are invented.

## Local development (authorized durable database)

```bash
corepack enable
pnpm install --frozen-lockfile
# Configure DATABASE_URL in protected environment settings (see .env.example).
# FIRST back up existing data and review docs/DEPLOYMENT_SAFETY.md.
pnpm run db:migrate
pnpm run db:check
pnpm run dev
```

The app binds to `0.0.0.0:3000`. Browser requests use relative `/api` URLs. Production startup checks schema readiness; it never creates tables or demo records through a public request.

## Isolated verification — no production data

```bash
pnpm run db:local                  # foreground native PG17.9; separate ignored .cache cluster
pnpm run test:postgres             # random local test DB; cleanup only its own test DB
pnpm run test:http:prepare         # NEW local HTTP verification DB; no reset/drop of existing data
# In another terminal, load .cache/http-verification/connection.env privately, then pnpm run dev.
ALLOW_TEST_WRITES=1 pnpm run test:api
ALLOW_TEST_WRITES=1 pnpm run test:geographic-api
pnpm run test:e2e                  # real Chromium; traces/screenshots disabled to avoid credentials
```

`test:api` creates tagged verification schools/records and a private `.cache` browser fixture. Geographic test provisioning is test-only, not a production authority workflow. These scripts refuse nonlocal databases/servers. Sandbox `.cache` databases and URLs are temporary: **do not enter real student records in the verification preview**. Use a durable managed/self-hosted PostgreSQL service for real operation.

## Quality gates

```bash
pnpm run typecheck
pnpm run lint
pnpm run validate:api
pnpm run test                     # disposable memory-PGlite service/domain/migration tests
pnpm run test:postgres            # native PostgreSQL application tests
pnpm run build
```

OpenAPI: `openapi.json`, also `GET /api/openapi`. The optional existing demo seed is development-only, explicit opt-in, idempotent, non-destructive and uses verified publication. No demo credentials are advertised by login or APIs; destructive `/api/seed` and public administrator enumeration are retired.

## Layout and documentation

- `src/app/(app)`: retained setup/mark/analysis/report screens plus account, academic-year and geographic screens.
- `src/app/api`: existing Next route handlers, protected with shared server authorization/strict schemas.
- `src/lib/domain`: approved mark/decimal/CCE/geography rules; scoped transactional services in `src/lib`.
- `src/db/schema.ts`, `migrations/0001–0005`: additive relations, immutable identities, publication and exact values.
- `docs/REPOSITORY_AUDIT.md`: baseline inspection and architecture decision.
- `docs/DEPLOYMENT_SAFETY.md`, `DEPLOYMENT.md`: backups, review, migrations, origins, SMS and permanent hosting.
- `docs/IMPLEMENTATION_STATUS.md`: verification results and explicit remaining dependencies.

Source is retained on the session branch; deployment to an actual school/authority production environment requires the documented configuration and human review, not just a successful build.

## V3 final gap audit

See [A–F verification report](docs/FINAL_VERIFICATION_V3.md), [all22 NOT VALID constraint reviews](docs/CONSTRAINT_REVIEW_V3.md), and [authorized-production readiness checklist](docs/PRODUCTION_READINESS_CHECKLIST_V3.md). The existing stack and additive migrations are retained. Teacher foreign-entry read isolation, mapped-author completion and primary-class calculation guards were corrected without rewriting marks or transferring ownership. The API suite includes targeted v3 actual-HTTP regressions. Production infrastructure/SMS and unapproved business workflows are not inferred from local passes.

## V4 deployment preparation (no deployment performed)

[Release gate and operator pack](docs/V4_RELEASE_GATE.md) documents production settings without secret values, backup/restore/migration/recovery procedures, all22 NOT VALID constraint prerequisites, host/origin/session/SMS checks and required future authorizations. Vercel release is now manual-only, preview-default and gated off without explicit approvals; no workflow was triggered. Application/business/schema/package code is unchanged; only a reproduced browser-test response-wait race was corrected without weakening assertions. Real production database, backup/restore, hosted TLS/proxy and SMS receipt remain unverified.

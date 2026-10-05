# V4 pre-change production-preparation audit

Date: 2026-10-02. Accepted baseline: V3 approved Classes 6–12 workflow, Next16.2.6 / React19.2.6 / TS / Tailwind / Drizzle / PostgreSQL. Branch remains `arena/01a0fbbf-vidya-marks-app`.

## Scope and evidence boundary

This phase prepares documentation, verifies local gates and holds deployment for later authorization. No production database/host, real student record, constraint validation, legacy conversion or real SMS configuration is authorized. V3 source/test assertions must not be weakened. All158 relevant application/migration/test/script/package/config files were fingerprinted before v4 changes; the private manifest contains file hashes, not credentials.

## Findings before changes

| Area | Finding | Planned action |
|---|---|---|
| Application / business rules | Accepted V3 source and tests present; no new reproducible application defect identified | Leave all application, schema, migrations, tests and lockfiles unchanged |
| Release automation | `.github/workflows/deploy-vercel.yml` deploys every push to main, manual target defaults production, no authorization/environment gate | Confirmed production-safety issue: remove push-triggered deployment; manual-only, preview-default, explicit disabled-by-default release flags + acknowledgement/reference and named environment approval boundary. Do not execute workflow |
| Production configuration | Runtime reads DATABASE_URL / APP_ORIGINS / NODE_ENV / AUTO_MIGRATE / DEMO_MODE / TRUST_PROXY; optional recovery triple; development/test/container/CI settings also present | Inventory every repository-consumed setting, presence only. No invented session/JWT/public-URL variable |
| Local presence | Existing local preview has local DATABASE_URL and development NODE_ENV, AUTO_MIGRATE=0 / DEMO_MODE=0; recovery triple and real production configuration not supplied | Use only guarded local `vidya_http_*` fixture connections. Never dump environment or URL values |
| GitHub configuration metadata | Names-only repository secret/variable queries unavailable due connection/repository access; no values requested or obtained | Mark actual GitHub configuration unknown; do not create variables/secrets/environments or trigger deployment |
| PostgreSQL / migrations | Five existing sorted checksummed migrations; native17.9 verified baseline, Compose selects16; pool max10/process,5s connect timeout | Exact order/hash/operator runbook; selected provider version/TLS/pool/load need authorized staging evidence |
| NOT VALID constraints |22 exact names/definitions and synthetic count0 each in V3 evidence; none validated |22-item operator checklist and later backup → review → approved repair → one-at-a-time validation → integrity checks; no validation now |
| Health | Existing GET /api/health returns ok/database/persistent/migration or503 codes; no environment/session/origin/SMS certification fields | Document exact contract; production mode/origin/TLS/backup must be verified separately; do not invent fields |
| Shutdown | Installed Next16.2.6 drains HTTP on SIGTERM/SIGINT unless NEXT_MANUAL_SIG_HANDLE is set; app closeDatabase exists for scripts, no app-specific signal hook | Keep framework lifecycle; local process/pool cleanup smoke if available; require hosted drain/in-flight transaction/restart testing later, no speculative hook |
| Reports | Four approved school official modes, CCE fifth official tab blocked, comparative approved, existing scoped geographic aggregate | Enumerate actual families honestly; no sixth invented school report or activated CCE; retain V3 semantics/authorization evidence |
| Backup / real SMS / TLS / infrastructure | No authorized environment/provider/operator evidence | Prepare procedures/checklists only; no production-ready claim |

## Change rule

Only the verified release-workflow safety issue warrants configuration modification. Any further code change requires a new reproducible defect/safety blocker or missing approved requirement. Preparation documentation and private local verification evidence are not production execution. The final checklist uses only PASS / BLOCKED / NOT TESTED / REQUIRES AUTHORIZATION.

## Later verified harness finding

The unchanged full browser rerun passed6/7; the all-family PDF test timed out after the Subject response had already returned200. Source/log/semantic page evidence confirms the default Subject tab loads before the late waiter, and clicking that already-selected tab emits no new request. Minimal approved-defect correction: register the waiter before navigation and additionally match the selected examination ID. All existing HTTP-success/PDF/A4/header/row/signature/no-nav assertions remain; no application/business change. Rerun the affected test and full browser suite, then record results in V4_RELEASE_GATE.md.

# Deploying the existing Vidya Analytics application safely

The Arena live preview is temporary and the verification database is isolated/ephemeral. A preview URL or local `.cache` database is **not** durable school hosting. Never assume real records survive sandbox restoration.

V3 release evidence: [final gap audit](docs/FINAL_VERIFICATION_V3.md), [individual22-constraint review](docs/CONSTRAINT_REVIEW_V3.md), and [authorized-production checklist](docs/PRODUCTION_READINESS_CHECKLIST_V3.md). No local pass authorizes production mutation or deployment.

V4 preparation pack: [final release checklist](docs/V4_RELEASE_GATE.md), [environment inventory](docs/V4_ENVIRONMENT_INVENTORY.md), [backup/migration runbook](docs/V4_DATABASE_RELEASE_RUNBOOK.md), [22-constraint operator checklist](docs/V4_CONSTRAINT_OPERATOR_CHECKLIST.md) and [hosting/security/SMS checks](docs/V4_HOST_SECURITY_CHECKLIST.md). These are procedures for later authorization, not commands executed against real targets.

## Before any deployment

1. Obtain an authorized **durable PostgreSQL** connection through your host's secret settings; do not put credentials in Git/chat/logs.
2. Back up and test restoration to a separate database. Inspect duplicates, legacy identities, allocation/snapshot review and nullable old registration metadata. See [deployment safety](docs/DEPLOYMENT_SAFETY.md).
3. Configure exact `APP_ORIGINS=https://your-domain`; protected production routes return 503 without it. TLS and an appropriately configured trusted proxy are required.
4. Run `pnpm run db:migrate` explicitly in a maintenance/release step, then **read-only** `pnpm run db:check`. Stop for review on failure; do not reset, renumber or fabricate values.
5. Run typecheck, lint, OpenAPI validation, tests and build. Start the existing Next app only after migration readiness. `/api/health` is read-only and checks migration0005.

## Vercel + a managed PostgreSQL provider

Import this existing repository (framework Next.js, pnpm10.28.2). Set `DATABASE_URL` (provider TLS connection/pooling recommendations), `APP_ORIGINS` (exact deployment hostname), `DEMO_MODE=0`, `AUTO_MIGRATE=0`, and optional approved SMS settings in protected variables. Run migrations from an authorized release workstation/job **before** exposing protected production operations. Vercel build/start never silently initialize or seed a production database. Confirm `/api/health`, real login/role isolation, provider delivery and backup restoration on the deployed host.

The GitHub Vercel release workflow is now manual-only, defaults to preview and is disabled unless a later authorized operator supplies an explicit acknowledgement/change reference and enables the repository release gate. Production additionally requires a separate approval gate and protected production environment. Pushes/merges no longer deploy through this workflow. No flags/secrets/environments or deployment were configured/executed in V4. Verify required reviewers/branch protection and any provider-native Git auto-deploy separately; see the [V4 release gate](docs/V4_RELEASE_GATE.md).

## Railway / Render / Fly / a VPS

Use the existing Node22/Next application and persistent PostgreSQL service. Build `pnpm install --frozen-lockfile && pnpm run build`; release/maintenance `pnpm run db:migrate && pnpm run db:check`; start `pnpm run start` on `0.0.0.0`. Configure exact public HTTPS origins and reverse-proxy forwarding rules; browser code calls relative `/api`, never a backend `localhost` URL. Use your provider's TLS/pool limits and verified secret injection. No production PGlite fallback exists.

## Docker Compose

Set **both** `DB_PASSWORD` (strong URL-safe value in protected environment) and `APP_ORIGINS` (exact HTTPS public hostname). Existing database volume name is retained. The `migrate` service runs the explicit migration/read-only check before the app starts; no reset or seed occurs.

```bash
docker compose up -d --build
```

For an existing deployment, first take a backup and follow maintenance review. Never use `docker compose down -v` to solve an application or migration error. Put Caddy/Nginx/TLS in front; retain `vidya_pgdata` and test restoration to a **different** database.

```bash
# Backup contains personal data; store securely with restricted access.
docker compose exec -T db pg_dump -U vidya -Fc vidya_analytics > secured-backup.dump
```

Do not restore over a live school database, or delete rows/constraints to make an upgrade pass. Container/cloud deployment has not been executed in the sandbox; local native PostgreSQL, API and browser verification is not proof of provider deployment.

## Configuration not yet available

Real SMS: `RECOVERY_SECRET` ≥32 random characters, authorized HTTPS `SMS_WEBHOOK_URL`, protected `SMS_API_KEY`; verify your adapter contract and actual receipt. Account recovery stays unavailable otherwise. Officer authority/activation/provisioning and CCE workflow remain blocked regardless of hosting configuration.

## Existing Vercel project preflight

See [current Vercel release preflight](docs/VERCEL_RELEASE_PREFLIGHT.md). The reviewed revision includes `vercel.json` with native Git deployment disabled, so a source push cannot substitute for the manual release gate. Explicit CLI/workflow releases are held until the existing project’s isolated Preview database/readiness/exact origin and credentials/reviewer permissions are verified. The workflow reuses the actual **Preview/Production** GitHub environments. Production remains untouched.

# V4 hosting, origin, authentication and SMS release checks

Preparation only: existing Next architecture; no cloud/container deployment, hosted TLS/proxy verification or real SMS configured. Statuses below refer to local/source evidence vs later operator work, not production certification. Environment inventory: [V4_ENVIRONMENT_INVENTORY.md](V4_ENVIRONMENT_INVENTORY.md). Database procedure: [V4_DATABASE_RELEASE_RUNBOOK.md](V4_DATABASE_RELEASE_RUNBOOK.md).

## Hosting procedure — later authorization only

| Item | Existing implementation / exact command | Operator required before real release |
|---|---|---|
| Node | package requires>=22.13.0; local22.22.3; Node22 used in CI/Docker | Approve actual host patch/OS/container digest and lifecycle/security maintenance; do not change framework |
| pnpm | packageManager10.28.2; CI/Corepack same | `pnpm install --frozen-lockfile`, preserve lockfiles; do not substitute npm's resolver or upgrade stack |
| Build | `pnpm run build` = existing `next build`; lazy DB means no live DB needed for build | Build reviewed commit; retain artifact/version/checksums; confirm files migrations/OpenAPI/static/local fonts traced into chosen host artifact |
| Start | `pnpm run start` = `next start --hostname 0.0.0.0`; optional host PORT / `--port`; Docker standalone `node server.js` | Production mode, correct port/binding/working directory and injected approved settings; never `next dev` on real host |
| Standalone | Only DOCKER_BUILD=1 selects standalone; Docker includes migrations/openapi/static assets and nonroot runner | Rehearse build/run on chosen host; Docker/Compose not run in V4; no unknown production volume |
| PostgreSQL | Durable provider URL, pool10/process,5s connection timeout,10s idle default | Prove target/TLS/pool budget/transaction behavior with authorized staging; migration/backup roles separate; missing DB means readiness503 |
| Health | GET `/api/health`, exact contract below | Gate traffic on actual readiness AND separate env/TLS/origin/data/backup checks; no false durability claim |
| API contract | GET `/api/openapi`, OpenAPI3.0.3 /34 paths | Endpoint/readiness access and proxy routing; no secrets/personal data in public schema |
| Reverse proxy | Browser uses relative `/api`; Next binds0.0.0.0 | Forward host/protocol appropriately, enforce HTTPS, restrict network ports, request/body/time limits, no cross-service browser localhost calls |
| TLS/certificate | Secure cookies in production; no host TLS proof | Domain/certificate chain/renewal/hostname checks, HTTPS-only redirection, DB certificate verification; do not disable cert/browser checks |
| Trusted source | TRUST_PROXY defaults0; exactly1 uses forwarded source for counters | Edge must overwrite spoofable x-forwarded-for before enabling1; independently verify attack headers cannot widen rate limits. TLS/proxy trust is not proven by a config flag |
| Restart | Compose app/db restart unless-stopped, migration no restart; managed host policy external | Approved supervisor/restart/health/traffic-drain behavior, retained database volume and no automatic data reset; rolling replicas require pool budget |
| Graceful shutdown | Installed Next16.2.6 closes listener, finishes pending requests, closes framework resources on SIGTERM/SIGINT; NEXT_MANUAL_SIG_HANDLE must stay unset | Test actual host drain/timeout, in-flight mark/publication transaction all-or-nothing, SIGTERM delivery to Node and zero unintended data loss; test restart readiness/role sessions |
| DB cleanup | closeDatabase awaits pool.end for maintenance/test scripts; global pool reused by app. No bespoke app signal handler | Verify host stops DB connections after drain/process exit, no hanging/idle-in-transaction sessions. Do not invent a shutdown hook solely for activity; hosted drain/load behavior remains untested |
| Logging | Bootstrap/pool/API errors suppress connection/provider secrets; scoped audit events retained | Restricted log sink/access/retention and redaction at proxy/provider/platform; never record password/OTP/session/Bearer/provider keys or raw connection strings |
| Monitoring | Readiness and audit evidence exist; no external alerting platform configured | Health/5xx/auth failures/ownership denials/pool/db lock/disk/backup/SMS failure alerts, thresholds, on-call/incident/recovery ownership; monitor actual volume/durability not `persistent` field alone |
| Release automation | Manual-only preview-default workflow with disabled-by-default flags, explicit acknowledgement/reference, existing Preview/Production environment | Later configure required reviewers/no self approval/branch policy/least-privilege deployment secret, exact target, native Vercel Git hold and change evidence. Preview/staging settings must use an isolated approved database, not inherit a production URL/SMS configuration. V4 never dispatches/enables workflow |

## Exact health/readiness contract — do not add fields

Application health is GET `/api/health`; no separate `/livez`/`readyz` implementation is invented. For a migrated PostgreSQL-backed process:

```json
{"ok":true,"database":"postgresql","persistent":true,"migration":"0005_exact_numeric_marks.sql"}
```

Expected HTTP200. Database query is `select 1`; migration readiness checks ledger presence of required0005. Missing schema/ledger version →503 `{"ok":false,"code":"MIGRATION_REQUIRED"}`. Missing/unreachable/invalid database connection →503 `{"ok":false,"code":"DATABASE_UNAVAILABLE"}`. No database errors/URLs returned. Health is read-only; startup/public requests do not migrate or seed production.

**`persistent:true` means only DATABASE_URL is supplied.** It does not certify durable disks/provider, backup restoration, TLS, pool capacity, all applied checksums/catalog objects, APP_ORIGINS, environment mode, role isolation, SMS or blocked-feature readiness. `NODE_ENV=production` is verified from actual launch configuration/Secure-cookie behavior, not an invented health `environment`/`demoEnabled` field. Health/OpenAPI remain available with missing origin configuration so operators can diagnose readiness; that does not unlock protected API. Missing origin configuration separately causes503 ORIGIN_NOT_CONFIGURED.

## Origin/CORS operator test matrix

| Scenario | Existing expected result | Verification boundary |
|---|---|---|
| Allowed exact origin, anonymous protected read |401 auth required; trusted origin is not an identity | Local compiled-mode probe; repeat on actual staging |
| Allowed exact origin, valid stored membership cookie | Scoped200 only for authorized resource; ordinary teacher foreign-entry reads403; Class Teacher exception still completion gated | Local real HTTP/session/report probes; staging repeat |
| Untrusted/malformed explicit Origin |403 FORBIDDEN_ORIGIN, even if a valid cookie is attached | Repeat real staging origin/cookie test; never return arbitrary-origin allowance |
| Production APP_ORIGINS missing/empty | Protected API503 ORIGIN_NOT_CONFIGURED, health/OpenAPI operational | Tested locally; actual host settings unknown |
| OPTIONS from allowed origin |405; no cross-origin preflight enabled | Same-origin API design, not unrestricted CORS |
| OPTIONS untrusted |403; no allow headers | Missing config may503 first; security proxy ordering matters |
| No Origin, sec-fetch-site cross-site |403 | Nonbrowser clients may omit Origin; auth/membership still required; this is not a default CORS wildcard |
| No Origin, ordinary same-origin/nonbrowser request | Auth/readiness applies normally | Do not assume Origin authenticates callers |
| Credentials | Client uses same-origin cookies; Secure+HttpOnly+SameSite=Lax in production; no Access-Control-Allow-Origin reflection/wildcard and no Access-Control-Allow-Credentials for arbitrary cross-origin calls | Local loopback cookie-header tests do not prove browser HTTPS cookie transport on a real host |

Production operator must review exact HTTPS APP_ORIGINS without paths, wildcard, reflection or development hosts. Next `allowedDevOrigins` localhost/e2b patterns are dev asset-server settings, **not production API CORS policy**. Compiled local verification may use HTTP loopback as test origin only; never treat that as acceptable public hosted TLS configuration.

## Authentication/session/recovery safeguards and staged checks

| Check | Current implementation / invariant | Later authorized operator verification |
|---|---|---|
| Cookie | sms_session; HttpOnly; path `/`; SameSite=Lax; Secure exactly in production; host-only (no broad Domain configured) | Real HTTPS browser gets/sends correct cookie; HTTP cannot transmit it; no token in DOM/localStorage/URL/logs |
| Expiration | Random32-byte token; SHA256 stored; absolute7-day expiry; auth requires expires_at>now; not a configured rolling/JWT session | Host clock/NTP, expired-cookie/session401, process restart validity without granting old/disabled membership |
| Authorization | Active persisted user/membership/roles; current assignments and entry authors; no trusted client teacher/school/role | Teacher/wrong-school/section/subject/student/owner negatives; consolidated completion gate |
| Password hashing | scryptSync with random16-byte salt and64-byte hash; timing-safe comparison; no passwordHash in SafeUser | Protected DB/storage/logs; approved login/invalid password behavior, no credential echoes |
| First password | New teacher must change initial password before protected read/write; different new password required | Old sessions/challenges invalidated, new session issued; flags not client-overridable |
| Password change | Current password checked; user row locked; update/hash/audit/session invalidation and new session within transaction;5 attempts/user/15min | Approved account/test fixtures only; all earlier sessions/challenges invalidated, no partial update |
| Logout | Deletes stored current session and cookie; next request unauthorized | Repeat after host/proxy deployment and restart; do not log token |
| Password reset | Only eligible school administrator's previously registered contact; cannot update UDISE/contact; transaction consumes challenge, hashes new password, invalidates all sessions, secret-free audit | Keep disabled without provider; later use approved account/contact, never a guessed/student/public officer target |
| OTP |6-digit crypto-random, HMAC with>=32-char secret; expiry300s; single-use; max5 guesses;60s resend cooldown; failed delivery consumes challenge | Real-provider suite after separate authorization; inspect no OTP/provider secret in API/log/audit |
| Recovery rates | Request5/account/hour and20/source/hour; reset endpoint40/source/15min; persistent atomic counters | Edge source trust/spoof tests; do not clear limits to test |
| Login rates |10/username/15min and100/source/15min; generic invalid-credential error; failed audit uses hashed username key | Account enumeration, proxy/key behavior and actual traffic capacity |
| Registration rates |10/source/hour | Preserve validation and source-key protection; separate fresh fixtures for high-volume negatives |

Current fake-provider/service/native tests prove software controls, not delivery. Expired challenges/sessions may remain stored; no new automatic purge/deletion/retention policy is added.

## SMS configuration and real-delivery checklist — disabled now

1. Later authorize provider/account/HTTPS adapter, eligible admin contact and **approved test number**; define operator/data-owner and access/log restrictions.
2. Provider credentials/secret-manager injection for RECOVERY_SECRET and SMS_API_KEY; approved HTTPS SMS_WEBHOOK_URL, no credentials in URL. Verify adapter payload `{to,message}`, bearer handling,10s timeout and no redirects; never log provider response/message/OTP.
3. Configure sender/header/template and any jurisdiction/provider registration (including applicable India DLT requirements) at provider/adapter; application has no invented sender/template env variable. Obtain provider-authorized requirements, not guessed regulatory certification.
4. Verify actual delivery/receipt to the approved registered contact, generic known/unknown public response and no contact/OTP disclosure. Merely accepting an HTTP webhook request is not delivery proof.
5. Test real expiry after300s, one-use after success, five-attempt lockout,60s cooldown, request/verify/source/account rate limits, resend invalidation and failed-delivery invalidation.
6. Test all old sessions invalidated on successful reset; wrong/expired code never changes password; audit/logs stay secret-free. Use approved non-sensitive accounts, no broad real-user reset.
7. Record receipt/time/provider reference safely, results and approval; preserve recovery unavailable503 until all required integration evidence is accepted. No production secrets or real SMS were configured in V4.

SMS integration/receipt: **BLOCKED**. Hosted HTTPS/cookie transport/trusted proxy/monitoring/drain/backup behavior: **NOT TESTED**. Later execution/enabling targets: **REQUIRES AUTHORIZATION**.

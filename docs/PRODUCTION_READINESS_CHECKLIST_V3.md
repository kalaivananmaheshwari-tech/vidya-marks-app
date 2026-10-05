# V3 authorized-production readiness checklist

The verified build is the **existing Next 16.2.6 / React 19 / TypeScript / Tailwind / Drizzle / PostgreSQL application**. A successful local verification is not deployment authorization. This checklist covers only approved Classes 6–12 workflows; CCE, Class 1–5 scoring, public officer activation and other unapproved policies remain blocked. No real school or production infrastructure was accessed in this audit.

## Release evidence — local only

- [x] Audit recorded before v3 code changes; three HTTP-reproduced gaps corrected incrementally, no redesign/migration/new application.
- [x] Required automated source, service/native-PG, live HTTP, browser and build gates recorded in [V3 final report](FINAL_VERIFICATION_V3.md).
- [x] Exact score storage, original REAL columns/IDs, additive/checksummed migration safety, synthetic preservation/rollback and copy-only legacy verification retained.
- [x] All 22 unvalidated constraints individually reviewed with read-only violation counts. **No validation performed.** See [constraint review](CONSTRAINT_REVIEW_V3.md).
- [x] Anonymous/wrong-school/class/section/subject/entry-owner and client identity spoof tests; officer hierarchy/tampering/admin denial; pending/complete consolidation, AB/Exemption and ranking regression evidence.
- [x] Semantic browser-generated PDFs, A4 orientations, actual repeated headers/unsplit rows/paired signatures, no navigation; no screenshot-based PDFs. Physical printer/government format certification is not claimed.
- [x] OTP unavailable when unconfigured; fake delivery tests verify safeguards, not real receipt.

## Required authorized operator evidence — none supplied here

| Gate | Required action / retained evidence | Current status |
|---|---|---|
| Production owner and release approval | Identify host, production database/schema, responsible school/operator, maintenance window and approved limited release scope. Do not use the Arena preview or ignored `.cache` DB for real records. | NOT TESTED |
| Durable PostgreSQL | Provision/identify persistent supported PostgreSQL, separate app/migration/backup privileges, connectivity and durable storage; verify the exact URL via protected host secret settings, never chat/Git. | NOT TESTED |
| Backup and restore | Take encrypted consistent backup and verify recovery to a separate database, counts/IDs/original fields/publication history, access and restore duration. Retain approved RPO/RTO, retention, access control and off-host copies. Do not overwrite the live database to test restoration. | NOT TESTED |
| Production legacy assessment | Read-only review of duplicates, identity mapping, mark author, historical allocations, incomplete geography/enums and legacy publication snapshots on the restored copy; compare source records. Synthetic preservation is not actual-school migration proof. | NOT TESTED |
| 22 constraint decisions | Review each exact catalog definition/count and semantic/null cases; approve a per-constraint validation plan or a documented hold. Every item is **REQUIRES AUTHORIZED PRODUCTION REVIEW**. Never delete/repair records or run automatic validation to obtain a green check. | NOT TESTED |
| Migration rehearsal | Rehearse existing five additive migrations on the restored copy, checksums, lock/time limits, failure stop conditions and readiness0005. Keep approved data; resolve ambiguity from source evidence only. No new v3 migration is required. | NOT TESTED |
| Rollback/recovery rehearsal | Verify previous application-version compatibility with additive schema and a backup-based recovery procedure, write-freeze/reconciliation plan, triggers and publication revisions. There is no destructive automatic down-migration. | NOT TESTED |
| Connection pooling/capacity | The current node-pg pool is max10 per process, connection timeout5s. Budget processes/replicas against provider capacity, reserve migration/backup connections, select provider pooler settings, verify transactional behavior and load/latency limits. Local tests are not hosted load testing. | NOT TESTED |
| Protected environment | Set `DATABASE_URL`, exact `APP_ORIGINS`, `DEMO_MODE=0`, `AUTO_MIGRATE=0`; no production `VIDYA_DEV_DATABASE=pglite`, no test-write flags/fixture files. Validate secret injection, rotation and no exposure in responses/logs/audits. | NOT TESTED |
| TLS/domain/reverse proxy | Verify real DNS, certificate chain/renewal, HTTPS-only external access, secure session cookies, forwarded protocol/host and iframe policy appropriate to the deployment. Provider DB TLS/certificate verification must be tested without weakening it. | NOT TESTED |
| Origin/CORS restrictions | Exact HTTPS `APP_ORIGINS` for legitimate hosts only; no wildcard/reflection. Re-test allowed and untrusted origins on actual host. Missing origins must fail503, untrusted must fail403. Browser code uses relative `/api`, never a backend localhost URL. | NOT TESTED |
| Trusted proxy/rate limits | Leave `TRUST_PROXY=0` unless the edge overwrites forwarded source IPs. Verify client header spoofing cannot bypass limits; conservative global buckets apply otherwise. Size actual traffic/provider limits through approved testing, not test bypasses. | NOT TESTED |
| Explicit migration/release | Authorized release job performs backup/rehearsal/approval then `db:migrate` and read-only `db:check`; app starts only after readiness. CI configuration is not evidence of a executed production deployment. Never reset/seed/drop a school database. | NOT TESTED |
| Monitoring/logging | Configure redacted application/audit logs, authorized access/retention, readiness/5xx/auth anomalies/pool saturation/db lock/disk/backup/provider alerts, dashboard ownership and incident escalation. Collect no passwords, OTPs, tokens or provider secrets. | NOT TESTED |
| Deployed authorization smoke | On actual authorized staging/production host, verify login/password change, assigned teacher own-entry reads/writes, Class Teacher completion gate, school separation, officer scope (only approved provisioned accounts), publication and official printing. | NOT TESTED |
| SMS/provider contract and receipt | Configure authorized HTTPS adapter, `RECOVERY_SECRET` of at least32 random characters, protected `SMS_API_KEY`; verify delivery to registered admin contact and generic responses, expiry/single use/attempt/cooldown/rate limits/session invalidation on approved test accounts. No real SMS has been delivered here. | BLOCKED |
| Officer activation/provisioning | Obtain authority's verified activation/revocation/recovery/master-geography policy; test-only SQL fixtures are not a supported production provisioning workflow. Keep public activation503 until separately authorized and implemented. | BLOCKED |
| Final go/no-go | Obtain accountable operator acceptance of production evidence and gated exclusions; record rollout/recovery decision. This audit does not authorize deployment or certify government print format. | REQUIRES USER DECISION |

## Reproducible local verification, not production operations

Follow the existing README for native-PG and isolated HTTP preparation. `test:api` creates only tagged fixtures, includes the v3 actual-HTTP audit and refuses a nonlocal/non-`vidya_http_*` database. `test:geographic-api` uses explicitly trusted test-only scope fixtures. Do not clear rate limits: the nine registration omission/enum negatives run on a **separate fresh isolated HTTP database** using `ALLOW_TEST_WRITES=1 pnpm exec tsx scripts/v3-http-audit.ts --registration-only`; then prepare another isolated DB for the normal API/browser suite. Neither database is an existing school database and neither is reset.

The optional independent semantic PDF inspector uses QA-only `pypdf==6.11.0`, not an application dependency:

```bash
python3 -m pip install --target .cache/pdf-tools pypdf==6.11.0 --disable-pip-version-check
pnpm run test:e2e
PYTHONPATH=.cache/pdf-tools python3 scripts/verify-print-pdfs.py
```

PDFs and raw test logs stay ignored in `.cache`. The inspector verifies actual PDF text, A4 dimensions, absent navigation, signatures together, repeated table headers and80 unsplit synthetic stress rows per family. Chromium can rasterize small comparative-card/chart decorations; the report tables remain semantic text exported from live HTML, not screenshot images.

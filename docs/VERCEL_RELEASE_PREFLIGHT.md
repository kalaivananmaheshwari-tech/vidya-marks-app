# Existing Vercel project — authorized preview release preflight

Date: 2026-10-05. User authorizes the **existing Vercel project's Preview environment**, with V4 gates satisfied before deployment. This is not permission to bypass missing evidence, connect to an unknown production database, migrate school data, validate real constraints, configure live SMS or deploy production.

## Identified target, not a new deployment

GitHub's existing deployment metadata for `kalaivananmaheshwari-tech/vidya-marks-app` identifies the Vercel project as `vidya-marks` under `kalaivananmaheshwari-tech` (inferred from existing deployment URLs). No provider project-ID secret was retrieved, so an authorized owner still must verify the exact Vercel project/account binding before release.

| Existing environment | Metadata result | Existing deployment URL / source | Authorization boundary |
|---|---|---|---|
| Preview | Success, created by vercel[bot] | `https://vidya-marks-2hu6tytex-kalaivananmaheshwari-tech.vercel.app`, source `fbfc561d475406339bfb61f116f7abd528bbac72` | Selected release environment, but isolated DB/readiness/origin/credentials/protection evidence still required |
| Production | Success, created by vercel[bot] | `https://vidya-marks-dif3b7mf3-kalaivananmaheshwari-tech.vercel.app`, source `07fe4faa77c89576b5ab83a871fd93d582f79880` | Existing target identified only; no production release authorization or V4 infrastructure evidence |

These URLs came from GitHub metadata. **They are old deployments, not this release. Neither application URL was requested and no production DB connection was made.** Deployment success is not backup/restore, actual database isolation, TLS/proxy, migration or SMS evidence.

## Verified release-control gaps and minimal configuration corrections

1. Native Vercel Git integration is present in existing deployment metadata. The earlier GitHub manual-only workflow did not itself prevent that integration from deploying on a source push. `vercel.json` now sets **`git.deploymentEnabled: false`**, preventing automatic Git deployments. Explicit authorized manual CLI/workflow releases remain the intended route. This makes source publication separate from application startup. Vercel documents this setting at <https://vercel.com/docs/project-configuration/git-configuration#git.deploymentenabled>.
2. Actual GitHub environment names are **Preview** and **Production**, both currently without protection rules. The manual workflow now references those existing names instead of creating a separate `staging` environment. The Vercel CLI target input stays `preview`/`production`; it defaults preview. Existing false-default acknowledgement, approval reference and separate repository enable/production approval gates remain.

No application code, business rule, migration, dependency, score, identity, entry author or historical snapshot is changed by these controls. No deployment flag/secret/provider/project setting or environment protection was configured remotely.

## Current preflight checklist

Only PASS / BLOCKED / NOT TESTED / REQUIRES AUTHORIZATION are used.

| Item | Status | Evidence | Operator Required |
|---|---|---|---|
| Existing project/environment selected | PASS | User requests Preview; GitHub metadata identifies existing vidya-marks deployments | Verify exact provider account/project binding; do not create another app |
| Automatic Git deployment hold prepared | PASS | vercel.json deploymentEnabled=false; native push cannot replace manual V4 approval process | Retain hold until explicitly authorized manual release; inspect provider/check metadata after publication |
| Existing GitHub environment names matched | PASS | Preview/Production metadata; workflow mapping corrected | Configure reviewed protection on Preview; do not infer it exists from the name |
| Existing verified software baseline | PASS | Accepted V3/V4 results; refreshed117/117/typecheck/lint/API/build in commit preparation | Repeat affected/full applicable quality checks for configuration changes; do not weaken assertions |
| GitHub required-reviewer protection | BLOCKED | Preview and Production metadata have no protection rules | Authorized owner configures required reviewers/no self approval/branch rules appropriate to the release |
| Release variables / secret-name inspection | BLOCKED | GitHub API403 on VIDYA_DEPLOYMENT_ENABLED and actions/secrets | Grant release-setting access through the GitHub connection or perform owner review securely; no tokens in chat |
| Local Vercel authorization/project link | BLOCKED | No VERCEL_TOKEN/VERCEL_ORG_ID/VERCEL_PROJECT_ID supplied and no .vercel/project.json | Authorized owner configures protected deployment credentials/identifiers for the existing project; do not send values here |
| Preview PostgreSQL isolation and exact target | NOT TESTED | No verified Preview DATABASE_URL/source evidence supplied | Confirm it is isolated from production; no preview process may inherit production DB/provider secrets |
| Preview migration/readiness/integrity | NOT TESTED | Local native/PGlite evidence does not prove provider DB | Authorized isolated-target preparation; existing five migration order, read-only integrity, required0005 and individual constraint diagnostics; no production validation |
| Exact Preview HTTPS origin | NOT TESTED | No verified stable staging domain/alias and APP_ORIGINS evidence | Configure exact approved origin; no wildcard/reflection; serve release through that origin, not an unapproved random URL |
| Recovery remains disabled | NOT TESTED | No real provider configured locally; provider Preview settings unknown | Ensure preview recovery triple unset unless separately authorized integration; keep unresolved features gated |
| Real production backup/restore/data/22-constraint/TLS/proxy/pool/monitoring evidence | NOT TESTED | V4 operator evidence unavailable | Separate authorized production review/rehearsal; no claim from local tests/deployment metadata |
| Preview deployment execution | REQUIRES AUTHORIZATION | Target selected, but prerequisite gates blocked/unverified | Satisfy blocked Preview gates first; then dispatch only reviewed preview release |
| Production deployment execution | REQUIRES AUTHORIZATION | Production target identified only | Complete V4 production checklist and obtain separate release authorization; do not deploy now |

## Authorized owner's next steps — no credential disclosure

1. In the existing project, confirm Preview DB is a distinct authorized isolated staging target; establish migrations/readiness and exact HTTPS alias/origin. Keep production and real SMS settings out of Preview. Do not use the sandbox .cache database for hosting.
2. In GitHub settings, protect the existing **Preview** environment and configure reviewed deployment credentials/identifiers securely. The release-enable variable is a **repository** variable (evaluated before environment selection). Enable it only once Preview gates and accountable approval are recorded. Leave production approval disabled.
3. Restore appropriate release-setting access through Arena's GitHub connection or have the authorized owner perform review/configuration. API403 is a permission barrier, not evidence that settings are empty. Never send passwords, personal tokens, OTPs or provider keys in chat.
4. Retain an approval/change reference and dispatch the reviewed session branch's manual workflow with `target=preview` only after all applicable gates pass. Do not treat skipped job/old URL/health persistent flag as a new successful release.
5. Verify actual deployed readiness/OpenAPI, allowed/untrusted/missing-origin behavior, secure HTTPS cookies, scoped accounts/reports/printing, logs and held features. Record the actual new URL/source SHA and evidence before admitting traffic.

Until these gates are observed, **no preview or production deployment is claimed**. The main V4 checklist remains [V4_RELEASE_GATE.md](V4_RELEASE_GATE.md); database/constraint/host procedures remain applicable unchanged.

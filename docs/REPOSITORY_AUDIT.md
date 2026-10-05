# Existing repository audit — 2026-10-02

## Architecture decision

The checkout at `07fe4faa77c89576b5ab83a871fd93d582f79880` is **not** the Vite/Express monorepo described by the supplied master prompt. It is a single Next.js 16 App Router application with React 19, TypeScript, Tailwind 4, Drizzle ORM and PostgreSQL/PGlite. There is no Vite, Express, pnpm workspace, Zod, OpenAPI document, test suite or versioned migration directory at baseline.

**User clarification:** preserve the existing stack and perform incremental enhancements. No Vite/Express migration, replacement template or parallel application is authorized. pnpm command support can be added to this existing package; that does not turn it into a monorepo.

## Files/modules inspected before implementation

- All tracked files inventoried with `git ls-files` and decoded/scanned. No user changes existed; working branch remained `arena/01a0fbbf-vidya-marks-app`.
- Configuration: `package.json`, `package-lock.json`, `tsconfig.json`, `next.config.ts`, `postcss.config.mjs`, `eslint.config.mjs`, `drizzle.config.json`, `.env.example`, `.gitignore`, `.dockerignore`.
- Deployment: `README.md`, `DEPLOYMENT.md`, `Dockerfile`, `docker-compose.yml`, `.github/workflows/deploy-vercel.yml`.
- Database: `src/db/{schema,index,bootstrap,seed}.ts`, `src/instrumentation.ts`.
- Services: all existing `src/lib/*.ts`: academic, analytics, api, auth, client, counts, grades, queries, reports, shared-types.
- Every existing `src/app/api/**/route.ts`: authentication/recovery, classes, groups, subjects, teachers, students, student-entry, exams, marks, mark-assign, analysis, official reports, health and seed.
- Frontend: root/authenticated layouts and entry points; login/register/recovery forms; dashboard, classes, groups, staff, subjects, exams, students/register/student-detail/student-entry, marks, allocation, reports, class/section/subject analysis, help, error/loading/not-found screens.
- Reusable components: `src/components/{ui,shell,charts,form2-report}.tsx`; global/print CSS.

## Actual entry points and runtime

- `/` (`src/app/page.tsx`) redirects to `/login` or `/dashboard` using the authenticated session.
- `src/app/layout.tsx` supplies document/ToastProvider; `(app)/layout.tsx` checks authentication and renders the shared Shell.
- REST is implemented in Next route handlers, not a separate API server.
- `npm run dev` runs `next dev`, default port **3000**; `build` is `next build`; `start` is `next start`.
- Container builds use Next standalone output when `DOCKER_BUILD=1`.
- Initial environment has no `DATABASE_URL`, local database, dependencies, pnpm executable or configured OTP provider.

## Database and data safety findings

- Nine legacy Drizzle tables: schools, users, sessions, groups, classes, subjects, students, exams, marks (and their indexes). IDs are integer/serial, except session token.
- Academic years are strings and hard-coded frontend options. A class row represents a **class + section + year**; preserve its existing ID and route contracts.
- Subject allocation/teacher fields are global to a subject, even for shared group/common subjects. No explicit teacher-class-section-subject relation exists.
- Marks reference integer student/subject/exam IDs; there are no permanent person/enrollment UUIDs, soft archive, audit, recovery challenge or membership tables.
- `bootstrap.ts` creates tables and runs additive ALTERs on boot; there are no versioned migrations.
- `index.ts` incorrectly ignores a local `DATABASE_URL` and silently selects PGlite. It also removes a database PID file, unsafe for concurrent processes.
- Cascading deletes can erase academic history. Public `/api/seed` calls a force seed that deletes the demo school. That path must be disabled, not executed.
- Existing data must not be reset, reseeded destructively, renumbered or rekeyed. New UUIDs/relations will be additive, with legacy integer columns retained.

## Authentication/security findings

- Passwords use salted scrypt, which is worth retaining. Session cookie is HttpOnly/SameSite=Lax and expires after seven days.
- Roles are only `admin`/`teacher`; school scope comes from `users.school_id`. No membership or geographic role model exists.
- Most management writes require only authentication, not admin role.
- School predicates exist in many queries, but referenced teacher/group/subject/exam IDs are not consistently validated against that school.
- Teacher reads/writes are not assignment-scoped. Students, marks and school-wide reports can be read by any teacher at the school.
- Recovery publicly enumerates administrators and accepts knowledge of a registered phone number as proof of identity. It has no OTP, expiry, attempts or rate limit.
- No explicit mutation-origin/CSRF policy or production CORS/origin configuration exists. Some errors expose raw database messages.

## Existing academic/report functionality

- Academic setup, school registration, individual teacher logins, student entry, component mark entry, dashboard charts and subject/class/section/student reports already exist.
- Defaults have `TNSMART` rather than the required **TNSPARK**. All classes use 70/20/10 or 90/10, including classes 8–10, which is incorrect.
- Mark validation mostly happens on the client; server sums missing components as zero and accepts unbounded values. There are no multi-operation transactions or audit events.
- Ranking uses percentage, merges exams in some paths, can rank incomplete/absent students and copies sorted ranks back by array position (wrong identity).
- The official-report route combines all report families. Consolidated reports have no teacher completion gate.
- CCE invents FA(A)/FA(B) from ordinary marks, generates fabricated EMIS IDs and publishes a grade/level mapping not approved by the prompt.
- Form-II invents a 75% Tamil-medium split and its stream topper query includes non-passing students. These must not be represented as actual data.
- Reports already use semantic HTML tables and some print CSS; A4 orientation and navigation suppression need correction.

## Smallest safe path

1. Keep Next/React/Tailwind routes/components; add pnpm tooling, Zod, critical tests and an OpenAPI contract to this package.
2. Add versioned transactional migrations and preserve old tables/IDs. Introduce years, memberships, mappings, enrollment UUIDs, per-class allocation, audit/recovery structures and same-school constraints. Fail rather than repair ambiguous legacy conflicts silently.
3. Derive protected scope from stored session/membership; use shared authorization in every route. Validate all referenced IDs, reject cross-tenant and wrong-assignment batches atomically.
4. Centralize approved mark/result/grade/ranking rules. Gate CCE workflows and keep historical CCE columns untouched.
5. Reuse mark entry/allocation/report components; add focused teacher dashboard and admin monitoring; enforce completion before consolidated generation.
6. Support stored CEO/DEO/BEO geographic scopes and scoped aggregate reports, without public self-assertion of privileged roles. Activation/provisioning policy remains an explicit dependency.
7. Replace insecure recovery with challenge-based OTP infrastructure; keep delivery unavailable until a real provider and secret are configured. Do not log or return OTPs.
8. Run baseline and staged typechecks/builds/tests; test additive upgrades, foreign keys, rollback, role/teacher/school/geographic isolation, completion gates, numeric boundaries, competition ties, subject-only failure and AB/Exemption.

## Explicit unresolved dependencies

- CCE: FA Total, Level mapping, entry workflow, permissions, terms, publication/edit workflow. No switch may enable those by accident.
- OTP SMS delivery/provider configuration and recovery secret are absent.
- Verification/authorized activation of publicly registered CEO/DEO/BEO identities is not defined. A public request must not grant a privileged role.
- No approved mark-component rules were supplied for classes 1–5; student/class setup can work but their mark entry remains gated.
- Any existing duplicate enrollment exam numbers or inconsistent same-school references require human data review, not deletion or automatic renumbering.

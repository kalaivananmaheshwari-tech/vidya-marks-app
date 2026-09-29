# 🎓 Vidya Analytics — School Marks Analysis

A multi-school platform for teachers and principals/headmasters to record marks and
analyse performance **subject-wise, class-wise and class & section-wise**.

## Features

- **School registration** — each school signs up with its name and **11-digit UDISE
  code**, which becomes the admin (Principal/Headmaster) login username
- **Admin-issued teacher logins** — the admin creates a username and password for
  every teacher, with password reset and enable/disable controls
- **Multi-tenant isolation** — every query is scoped to the signed-in user's school
- **Academic setup** — group codes (streams), classes & sections, subjects, exams
- **Mark entry** — keyboard-driven sheet with absentee handling and a live summary
- **Analysis** — dashboard KPIs, exam trends, grade distribution, subject/class/section
  reports, rank lists, remedial watch list and printable student report cards

## Tech stack

Next.js 16 (App Router) · TypeScript · Tailwind CSS v4 · Drizzle ORM · PostgreSQL

## Quick start (local)

```bash
npm install
cp .env.example .env          # point DATABASE_URL at your PostgreSQL
npm run build
npm run start                 # http://localhost:3000
```

The schema is created automatically on first boot — there is no migration command
to run.

## Demo credentials

| Role | Username | Password |
|------|----------|----------|
| Admin (Principal) | `33064500112` | `admin@123` |
| Teacher | `33064500112.ramesh` | `teacher@123` |

## Deploying to a permanent URL

The development preview URL is temporary and changes whenever the sandbox restarts.
See **[DEPLOYMENT.md](./DEPLOYMENT.md)** for step-by-step instructions covering
Vercel + Neon (recommended), Railway, Render and self-hosted Docker, including the
optional GitHub Actions workflow that verifies each deploy.

```bash
# Vercel + Neon: create a Neon database, then set DATABASE_URL in Vercel and deploy
# self-hosted, one command
docker compose up -d --build
```

> ⚠️ On Vercel the embedded database cannot persist — `DATABASE_URL` pointing at
> Neon (or any PostgreSQL) is **required**. Open `/api/health` and check for
> `"persistent": true` to be sure.

## Project layout

```
src/
├── app/
│   ├── (app)/            dashboard, setup, mark entry, analysis (authenticated)
│   ├── api/              REST route handlers
│   ├── login/            sign-in
│   └── register/         school registration
├── components/           UI kit, charts, app shell
├── db/
│   ├── schema.ts         Drizzle table definitions
│   ├── bootstrap.ts      self-healing CREATE TABLE IF NOT EXISTS
│   └── seed.ts           demo school data
├── lib/                  auth, analytics, reports, helpers
└── instrumentation.ts    prepares the database when the server boots
```

## Environment variables

| Name | Required | Description |
|------|----------|-------------|
| `DATABASE_URL` | production: yes | PostgreSQL connection string. Omit locally to use the embedded PGlite database. |

## Health check

`GET /api/health` → `{ "ok": true, "schools": 1, "database": "postgres", "persistent": true }`

`database` reports which backend answered (`postgres` = durable, `pglite` = embedded),
and `persistent: true` confirms data will survive a restart/redeploy.

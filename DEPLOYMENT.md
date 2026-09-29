# Deploying Vidya Analytics — getting a permanent URL

## Why the preview link keeps dying

The development preview runs in a **temporary sandbox**. Its web address looks like:

```
https://3000-inp6qan0wdpk2vs7rj3t6.e2b.app
             ^^^^^^^^^^^^^^^^^^^^
             this is the sandbox ID
```

That middle string **is the sandbox's identity**. Sandboxes are disposable: they are
recycled between sessions or after a period of inactivity. When that happens the ID
no longer exists, so the old address returns **"sandbox not found" / 502**.

Nothing is broken in the application — it is the hosting that is temporary.

| What | Survives a restart? |
|------|---------------------|
| Your source code | ✅ Yes |
| Database (schools, students, marks) | ✅ Yes |
| The preview **URL** | ❌ No — a new one is issued |

**The permanent fix is to deploy the app to a real host.** Pick one option below.

---

## Option 1 · Vercel + Neon (easiest, free tier available) ⭐ recommended

Best if you want a public URL in ~5 minutes with zero server administration.

> **Why a database is mandatory on Vercel.** Vercel runs your code as short-lived
> serverless functions with a read-only project directory. The embedded PGlite
> fallback has nowhere durable to write, so **every redeploy or cold start would
> start empty.** Point `DATABASE_URL` at Neon and your schools, students and marks
> persist forever.
>
> Confirm at any time by opening `https://<your-url>/api/health` — it must say
> `"database":"postgres","persistent":true`.

### Step 1 · Create the Neon database

1. Sign in at [neon.tech](https://neon.tech) → **Create project**
   (name it `vidya-analytics`, pick the region closest to you, e.g. Singapore).
2. On the project dashboard open **Connection string** / **Connect**.
3. Choose the **Pooled connection** (the host contains `-pooler`) and make sure
   **Prisma / node-postgres** or plain **Connection string** is selected. It looks
   like:

   ```
   postgresql://user:password@ep-xxx-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require
   ```

4. Copy it — this single line is the only secret the app needs.

> Use the **pooled** string, not the direct one: serverless functions open a new
> connection per instance and pooling keeps you inside Neon's free-tier limit.

### Step 2 · Import into Vercel

1. Go to [vercel.com/new](https://vercel.com/new) and import
   `kalaivananmaheshwari-tech/vidya-marks-app`.
2. Framework preset: **Next.js** (auto-detected). Leave build/install commands as
   they are — `package.json` already has the right scripts.
3. Open **Environment Variables** and add:

   | Name | Value | Environments |
   |------|-------|--------------|
   | `DATABASE_URL` | your pooled Neon connection string | Production, Preview, Development |

4. Click **Deploy**. The first build takes 1–3 minutes.

You get a permanent URL like `https://vidya-marks-app.vercel.app`, with automatic
HTTPS. Add your own domain under **Settings → Domains** if you have one.

### Step 3 · First run

1. Open the URL — you land on the sign-in page.
2. Click **Register your school**, enter your real school name, your genuine
   11-digit UDISE code and a strong password. That becomes your admin login.
3. Delete the demo school when you no longer need it:

   ```sql
   DELETE FROM schools WHERE udise_code = '33064500112';
   ```

### Automatic deploys from GitHub (optional)

Vercel already redeploys when you push, but the included workflow
`.github/workflows/deploy-vercel.yml` gives you a **tested deploy**: it builds,
deploys, and then fails the run if `/api/health` does not report a healthy,
persistent database. It runs on every push to `main`.

1. Collect the three values:

   ```bash
   npx vercel login              # once, on your machine
   cd vidya-marks-app && npx vercel link
   cat .vercel/project.json      # → orgId, projectId
   ```

   Create a token at [vercel.com/account/tokens](https://vercel.com/account/tokens)
   (scope: your account, no expiry or a long one).

2. In GitHub open **Settings → Secrets and variables → Actions → New repository secret**
   and add:

   | Secret | Where to find it |
   |--------|------------------|
   | `VERCEL_TOKEN` | the token you just created |
   | `VERCEL_ORG_ID` | `orgId` in `.vercel/project.json` |
   | `VERCEL_PROJECT_ID` | `projectId` in `.vercel/project.json` |

3. Done. Every merge to `main` now deploys automatically, and anything that would
   break the live site fails the workflow instead of shipping.

> Until those three secrets exist the workflow skips itself with a warning — it will
> never fail red and it never needs a password or token to be shared with anyone.

### Keeping the demo data out of production

The demo school is seeded automatically so the app is never empty on first visit.
Once your real school is registered, delete it from the Neon **SQL Editor**:

```sql
DELETE FROM schools WHERE udise_code = '33064500112';
```

Every table cascades from `schools`, so this cleanly removes all demo students,
marks, classes and logins while leaving your school untouched.

---

## Option 2 · Railway (database + app in one place)

1. Sign in at [railway.app](https://railway.app) → **New Project**.
2. **Add PostgreSQL** from the service catalogue.
3. **Add a service → Deploy from GitHub repo** and select this project.
4. In the app service → **Variables**, add:

   ```
   DATABASE_URL = ${{Postgres.DATABASE_URL}}
   ```

   (Railway substitutes the internal database URL automatically.)
5. Under **Settings → Networking**, click **Generate Domain**.

---

## Option 3 · Your own server / VPS with Docker (full control)

Good if the school has its own machine and wants the data to stay on-premises.

```bash
git clone <your-repo-url> vidya-analytics
cd vidya-analytics

# set a strong database password
echo "DB_PASSWORD=$(openssl rand -hex 16)" > .env

docker compose up -d --build
```

The app is now on `http://<server-ip>:3000` and restarts automatically with the
machine. Data lives in the `vidya_pgdata` Docker volume.

**Add HTTPS + a domain** by putting Nginx or Caddy in front. Caddy example:

```
marks.yourschool.edu.in {
    reverse_proxy localhost:3000
}
```

**Back up the database** (recommended weekly, via cron):

```bash
docker compose exec -T db pg_dump -U vidya vidya_analytics > backup-$(date +%F).sql
```

**Restore:**

```bash
cat backup-2026-01-15.sql | docker compose exec -T db psql -U vidya -d vidya_analytics
```

---

## Option 4 · Render

1. [render.com](https://render.com) → **New → PostgreSQL**, create the database and
   copy its **Internal Database URL**.
2. **New → Web Service**, connect the repository.
   - Build command: `npm install && npm run build`
   - Start command: `npm run start`
3. Add the environment variable `DATABASE_URL` with the internal URL.
4. Deploy.

---

## Requirements summary

| Item | Value |
|------|-------|
| Node.js | 20 or newer (22 recommended) |
| Database | PostgreSQL 14 or newer |
| Required env var | `DATABASE_URL` — **mandatory on serverless hosts** (Vercel, Railway, Render); optional in local dev, where the embedded PGlite database is used |
| Build command | `npm run build` |
| Start command | `npm run start` |
| Health check path | `/api/health` → `{ "ok": true, "schools": 1, "database": "postgres", "persistent": true }` |
| Migrations | none — schema is created automatically on boot |

---

## First run after deploying

1. Open your new permanent URL — you land on the sign-in page.
2. Click **Register your school** and enter your real school name, your genuine
   11-digit UDISE code and a strong password. This becomes your admin login.
3. Go to **Teacher logins** and create an account for each teacher.
4. Set up group codes → classes → subjects → students → exams, then enter marks.

---

## Security checklist before going live

- [ ] Use a strong, unique admin password (not the demo `admin@123`)
- [ ] Delete the demo school once your own data is in
- [ ] Serve over HTTPS (automatic on Vercel / Railway / Render)
- [ ] Take regular database backups
- [ ] Give each teacher their own login — never share the admin UDISE login
- [ ] Disable logins for staff who leave (**Teacher logins → Disable**)

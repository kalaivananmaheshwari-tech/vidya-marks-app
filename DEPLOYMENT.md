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

## Option 1 · Vercel + Neon (easiest, free tier available)

Best if you want a public URL in ~5 minutes with zero server administration.

1. **Create a database** at [neon.tech](https://neon.tech) (free). Copy the connection
   string — it looks like
   `postgresql://user:pass@ep-xxx.aws.neon.tech/neondb?sslmode=require`
2. **Push this project to GitHub.**
3. Go to [vercel.com/new](https://vercel.com/new), import the repository.
4. Under **Environment Variables** add:

   | Name | Value |
   |------|-------|
   | `DATABASE_URL` | your Neon connection string |

5. Click **Deploy**.

You get a permanent URL like `https://vidya-analytics.vercel.app`, plus automatic
HTTPS and redeploys on every git push. Add your own domain under
**Settings → Domains** if you have one.

> No migration step is needed. On first boot the app creates its own tables and seeds
> the demo school (see `src/instrumentation.ts`).

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
| Required env var | `DATABASE_URL` |
| Build command | `npm run build` |
| Start command | `npm run start` |
| Health check path | `/api/health` |
| Migrations | none — schema is created automatically on boot |

---

## First run after deploying

1. Open your new permanent URL — you land on the sign-in page.
2. Click **Register your school** and enter your real school name, your genuine
   11-digit UDISE code and a strong password. This becomes your admin login.
3. Go to **Teacher logins** and create an account for each teacher.
4. Set up group codes → classes → subjects → students → exams, then enter marks.

### About the demo school

A demo school (UDISE `33064500112`) is seeded so the app is never empty on first
visit. Once your real school is registered you can remove the demo data:

```sql
DELETE FROM schools WHERE udise_code = '33064500112';
```

Every table cascades from `schools`, so this cleanly removes all demo students,
marks, classes and logins while leaving your school untouched.

---

## Security checklist before going live

- [ ] Use a strong, unique admin password (not the demo `admin@123`)
- [ ] Delete the demo school once your own data is in
- [ ] Serve over HTTPS (automatic on Vercel / Railway / Render)
- [ ] Take regular database backups
- [ ] Give each teacher their own login — never share the admin UDISE login
- [ ] Disable logins for staff who leave (**Teacher logins → Disable**)

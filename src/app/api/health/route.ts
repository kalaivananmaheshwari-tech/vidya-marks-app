import { sql } from "drizzle-orm";
import { db, databaseMode } from "@/db";
import { schemaIsReady, REQUIRED_MIGRATION } from "@/db/migrate";
import { json } from "@/lib/http";
export const dynamic = "force-dynamic";
/** Readiness only: no public schema mutation, seeding, account counts or raw database errors. */
export async function GET() {
  try {
    await db.execute(sql`select 1`);
    if (!(await schemaIsReady())) return json({ ok: false, code: "MIGRATION_REQUIRED" }, 503);
    return json({ ok: true, database: databaseMode(), persistent: Boolean(process.env.DATABASE_URL), migration: REQUIRED_MIGRATION });
  } catch { return json({ ok: false, code: "DATABASE_UNAVAILABLE" }, 503); }
}

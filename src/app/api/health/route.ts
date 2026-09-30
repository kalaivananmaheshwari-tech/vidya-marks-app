import { sql } from "drizzle-orm";
import { db } from "@/db";
import { ensureSchema } from "@/db/bootstrap";
import { ensureSeed } from "@/db/seed";

export const dynamic = "force-dynamic";

/**
 * Liveness + self-heal endpoint.
 * Confirms the database answers, rebuilds the schema when needed and makes sure
 * the demo school exists, so the very first page view always has data.
 */
export async function GET() {
  try {
    await db.execute(sql`select 1`);
    await ensureSchema();
    await ensureSeed().catch(() => undefined);

    const result = await db.execute<{ count: string }>(
      sql`select count(*)::text as count from schools`,
    );
    const schools = Number((result.rows as Array<{ count: string }>)[0]?.count ?? "0");

    return Response.json({ ok: true, schools });
  } catch (error) {
    return Response.json(
      { ok: false, error: error instanceof Error ? error.message : "unavailable" },
      { status: 500 },
    );
  }
}

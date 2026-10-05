import { z } from "zod";
import { asc, desc, sql } from "drizzle-orm";
import { db } from "@/db";
import { academicYears } from "@/db/schema";
import { ensureSchema } from "@/db/bootstrap";
import { handleError, HttpError, json, readJson, requireAdmin } from "@/lib/api";
import { audit } from "@/lib/audit";
export const dynamic = "force-dynamic";
export async function GET() {
  try { await ensureSchema(); return json({ academicYears: await db.select().from(academicYears).orderBy(asc(academicYears.startYear)) }); }
  catch (error) { return handleError(error); }
}
export async function POST(request: Request) {
  try {
    const auth = await requireAdmin(); const body = await readJson(request, z.object({ startYear: z.number().int().min(1900).max(9998) }).strict());
    const year = await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(8392148)`);
      const [last]=await tx.select({start:academicYears.startYear}).from(academicYears).orderBy(desc(academicYears.startYear)).limit(1);
      if(last && body.startYear<=last.start)throw new HttpError("Add a future academic-year record after the latest registered year.",400,"INVALID_ACADEMIC_YEAR");
      const [row] = await tx.insert(academicYears).values({ label: `${body.startYear}-${body.startYear + 1}`, startYear: body.startYear, endYear: body.startYear + 1 }).returning();
      await audit(tx, auth, "academic_year.created", "academic_years", row.id, { label: row.label }); return row;
    });
    return json({ academicYear: year }, 201);
  } catch (error) { return handleError(error); }
}

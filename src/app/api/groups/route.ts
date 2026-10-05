import { and, asc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { groups } from "@/db/schema";
import { handleError, json, readJson, requireAdmin } from "@/lib/api";
import { classCountByGroup, studentCountByGroup, subjectCountByGroup } from "@/lib/counts";
import { audit } from "@/lib/audit";
export const dynamic = "force-dynamic";
import { groupSchema } from "@/lib/setup-validation";
export async function GET() {
  try {
    const auth = await requireAdmin();
    const [rows, cc, sc, st] = await Promise.all([db.select().from(groups).where(and(eq(groups.schoolId, auth.school.id), isNull(groups.archivedAt))).orderBy(asc(groups.code)), classCountByGroup(auth.school.id), subjectCountByGroup(auth.school.id), studentCountByGroup(auth.school.id)]);
    return json({ groups: rows.map((r) => ({ ...r, classCount: cc.get(r.id) ?? 0, subjectCount: sc.get(r.id) ?? 0, studentCount: st.get(r.id) ?? 0 })) });
  } catch (error) { return handleError(error); }
}
export async function POST(request: Request) {
  try {
    const auth = await requireAdmin(); const body = await readJson(request, groupSchema);
    const group = await db.transaction(async (tx) => { const [row] = await tx.insert(groups).values({ schoolId: auth.school.id, ...body, code: body.code.toUpperCase(), description: body.description || null }).returning(); await audit(tx, auth, "group.created", "groups", row.id, { code: row.code }); return row; });
    return json({ group: { ...group, classCount: 0, subjectCount: 0, studentCount: 0 } }, 201);
  } catch (error) { return handleError(error); }
}

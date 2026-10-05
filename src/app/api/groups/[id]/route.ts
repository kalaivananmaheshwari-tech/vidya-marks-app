import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { groups } from "@/db/schema";
import { handleError, json, notFound, numParam, readJson, requireAdmin } from "@/lib/api";
import { groupSchema } from "@/lib/setup-validation";
import { audit } from "@/lib/audit";
export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };
export async function PATCH(request: Request, { params }: Ctx) {
  try {
    const auth = await requireAdmin(); const id = numParam((await params).id)!; const body = await readJson(request, groupSchema.partial());
    const group = await db.transaction(async (tx) => { const [row] = await tx.update(groups).set({ ...body, code: body.code?.toUpperCase() }).where(and(eq(groups.id, id), eq(groups.schoolId, auth.school.id))).returning(); if (row) await audit(tx, auth, "group.updated", "groups", row.id, { changedFields: Object.keys(body) }); return row; });
    return group ? json({ group }) : notFound("Group not found.");
  } catch (error) { return handleError(error); }
}
export async function DELETE(_request: Request, { params }: Ctx) {
  try {
    const auth = await requireAdmin(); const id = numParam((await params).id)!;
    const group = await db.transaction(async (tx) => { const [row] = await tx.update(groups).set({ archivedAt: new Date() }).where(and(eq(groups.id, id), eq(groups.schoolId, auth.school.id))).returning(); if (row) await audit(tx, auth, "group.archived", "groups", id, { historicalDataPreserved: true }); return row; });
    return group ? json({ ok: true, archived: true }) : notFound("Group not found.");
  } catch (error) { return handleError(error); }
}

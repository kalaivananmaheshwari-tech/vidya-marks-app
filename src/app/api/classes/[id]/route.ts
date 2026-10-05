import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { classes, groups } from "@/db/schema";
import { handleError, HttpError, json, notFound, numParam, readJson, requireAdmin } from "@/lib/api";
import { classSetupSchema } from "@/lib/setup-validation";
import { assertTeacherReference } from "@/lib/authorization";
import { audit } from "@/lib/audit";
export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };
export async function PATCH(request: Request, { params }: Ctx) {
  try {
    const auth = await requireAdmin(); const id = numParam((await params).id)!;
    const body = await readJson(request, classSetupSchema.partial());
    const cls = await db.transaction(async (tx) => {
      const [prior] = await tx.select().from(classes).where(and(eq(classes.id, id), eq(classes.schoolId, auth.school.id))).for("update");
      if (!prior || prior.archivedAt) throw new HttpError("Class not found.", 404, "NOT_FOUND");
      const [group] = prior.groupId ? await tx.select().from(groups).where(and(eq(groups.id, prior.groupId), eq(groups.schoolId, auth.school.id))).limit(1) : [];
      if ((body.name && body.name !== prior.name) || (body.section && body.section.toUpperCase() !== prior.section) || (body.academicYear && body.academicYear !== prior.academicYear) || (body.groupId != null && body.groupId !== prior.groupId) || (body.groupCode && body.groupCode.toUpperCase() !== group?.code)) throw new HttpError("Class, section, group and academic year define an enrollment identity. Create a new class/year instead of changing it.", 409, "HISTORICAL_IDENTITY_LOCKED");
      if (body.classTeacherId) await assertTeacherReference(auth.school.id, body.classTeacherId, tx);
      const [row] = await tx.update(classes).set({ room: body.room === undefined ? prior.room : body.room || null, classTeacherId: body.classTeacherId === undefined ? prior.classTeacherId : body.classTeacherId }).where(and(eq(classes.id, id), eq(classes.schoolId, auth.school.id))).returning();
      await audit(tx, auth, "class.updated", "classes", row.id, { classTeacherId: row.classTeacherId, room: row.room }); return row;
    });
    return json({ class: cls });
  } catch (error) { return handleError(error); }
}
export async function DELETE(_request: Request, { params }: Ctx) {
  try {
    const auth = await requireAdmin(); const id = numParam((await params).id)!;
    const row = await db.transaction(async (tx) => {
      const [cls] = await tx.update(classes).set({ archivedAt: new Date() }).where(and(eq(classes.id, id), eq(classes.schoolId, auth.school.id))).returning();
      if (!cls) return null; await audit(tx, auth, "class.archived", "classes", id, { historicalDataPreserved: true }); return cls;
    });
    return row ? json({ ok: true, archived: true }) : notFound("Class not found.");
  } catch (error) { return handleError(error); }
}

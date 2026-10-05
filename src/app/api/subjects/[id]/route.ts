import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { subjects, classSubjects, classes, marks } from "@/db/schema";
import { handleError, HttpError, json, notFound, numParam, readJson, requireAdmin } from "@/lib/api";
import { subjectSetupSchema, ownedGroup } from "@/lib/setup-validation";
import { configureMappingsInTransaction } from "@/lib/mapping-service";
import { subjectsForClass } from "@/lib/queries";
import { audit } from "@/lib/audit";
export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };
export async function PATCH(request: Request, { params }: Ctx) {
  try {
    const auth = await requireAdmin(); const id = numParam((await params).id)!; const body = await readJson(request, subjectSetupSchema.partial());
    const subject = await db.transaction(async (tx) => {
      const [prior] = await tx.select().from(subjects).where(and(eq(subjects.id, id), eq(subjects.schoolId, auth.school.id))).limit(1);
      if (!prior || prior.archivedAt) throw new HttpError("Subject not found.", 404, "NOT_FOUND");
      if ((body.name && body.name!==prior.name) || (body.code && body.code.toUpperCase()!==prior.code)) { const [recorded]=await tx.select({id:marks.id}).from(marks).where(and(eq(marks.schoolId,auth.school.id),eq(marks.subjectId,id))).limit(1); if(recorded)throw new HttpError("Subject identity cannot be renamed after assessments exist. Create a new class/year setup.",409,"HISTORICAL_IDENTITY_LOCKED"); }
      if ((body.groupId !== undefined && body.groupId !== prior.groupId) || (body.classId !== undefined && body.classId !== prior.classId)) throw new HttpError("Create a new subject mapping instead of changing its class or group identity.", 409, "HISTORICAL_IDENTITY_LOCKED");
      if (body.groupId) await ownedGroup(tx, auth.school.id, body.groupId);
      const pairs = await tx.select().from(classSubjects).where(and(eq(classSubjects.schoolId, auth.school.id), eq(classSubjects.subjectId, id))).orderBy(asc(classSubjects.classId));
      for (const pair of pairs) {
        const sub = (await subjectsForClass(pair.classId, auth.school.id, tx)).list.find((s) => s.id === id)!;
        if (body.hasPractical !== undefined || body.teacherId !== undefined) await configureMappingsInTransaction(tx, auth, { classId: pair.classId, assignments: [{ id, hasPractical: body.hasPractical ?? sub.hasPractical, teacherId: body.teacherId === undefined ? sub.teacherId : body.teacherId }] });
      }
      const [row] = await tx.update(subjects).set({ code: body.code?.toUpperCase(), name: body.name, hasPractical: body.hasPractical, passMarks: 35 }).where(and(eq(subjects.id, id), eq(subjects.schoolId, auth.school.id))).returning();
      await audit(tx, auth, "subject.updated", "subjects", id, { changedFields: Object.keys(body) }); return row;
    });
    return json({ subject });
  } catch (error) { return handleError(error); }
}
export async function DELETE(_request: Request, { params }: Ctx) {
  try {
    const auth = await requireAdmin(); const id = numParam((await params).id)!;
    const row = await db.transaction(async (tx) => {
      const active=await tx.select({id:classSubjects.id}).from(classSubjects).innerJoin(classes,eq(classes.id,classSubjects.classId)).where(and(eq(classSubjects.schoolId,auth.school.id),eq(classSubjects.subjectId,id),eq(classSubjects.isRequired,true),isNull(classes.archivedAt)));
      if(active.length)throw new HttpError("A required subject defines its class/year curriculum and cannot be removed. Archive the class or create a new year setup instead.",409,"HISTORICAL_IDENTITY_LOCKED");
      const [r] = await tx.update(subjects).set({ archivedAt: new Date() }).where(and(eq(subjects.id, id), eq(subjects.schoolId, auth.school.id))).returning(); if (r) await audit(tx, auth, "subject.archived", "subjects", id, { historicalMarksPreserved: true }); return r; });
    return row ? json({ ok: true, archived: true }) : notFound("Subject not found.");
  } catch (error) { return handleError(error); }
}

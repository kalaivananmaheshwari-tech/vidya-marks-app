import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { exams,marks,examPublications } from "@/db/schema";
import { handleError, HttpError, json, notFound, numParam, readJson, requireAdmin } from "@/lib/api";
import { examSetupSchema } from "@/lib/setup-validation";
import { publishResultInTransaction } from "@/lib/exam-service";
import { audit } from "@/lib/audit";
export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };
export async function PATCH(request: Request, { params }: Ctx) {
  try {
    const auth = await requireAdmin(); const id = numParam((await params).id)!; const body = await readJson(request, examSetupSchema.partial());
    const exam = await db.transaction(async (tx) => {
      const [prior] = await tx.select().from(exams).where(and(eq(exams.id, id), eq(exams.schoolId, auth.school.id))).for("update");
      if (!prior || prior.archivedAt) throw new HttpError("Exam not found.", 404, "NOT_FOUND");
      if (body.academicYear && body.academicYear !== prior.academicYear) throw new HttpError("An examination's academic year is immutable. Create a new examination instead.", 409, "HISTORICAL_IDENTITY_LOCKED");
      const identityChange=(["name","month","year","term","startDate"] as const).some((k)=>body[k]!==undefined && body[k]!==prior[k]);
      if(identityChange){const [assessed]=await tx.select({id:marks.id}).from(marks).where(and(eq(marks.schoolId,auth.school.id),eq(marks.examId,id))).limit(1);const [published]=await tx.select({id:examPublications.id}).from(examPublications).where(and(eq(examPublications.schoolId,auth.school.id),eq(examPublications.examId,id))).limit(1);if(assessed || published)throw new HttpError("Examination identity is locked after assessments/publication. Create a new examination.",409,"HISTORICAL_IDENTITY_LOCKED");}
      const [row] = await tx.update(exams).set({ name: body.name, month: body.month === undefined ? prior.month : body.month || null, year: body.year === undefined ? prior.year : body.year || null, term: body.term === undefined ? prior.term : body.term || prior.term, startDate: body.startDate === undefined ? prior.startDate : body.startDate || null }).where(and(eq(exams.id, id), eq(exams.schoolId, auth.school.id))).returning();
      await audit(tx, auth, "exam.updated", "examinations", id, { changedFields: Object.keys(body).filter((k) => k !== "isPublished") });
      return body.isPublished !== undefined && body.isPublished !== prior.isPublished ? publishResultInTransaction(tx, auth, id, body.isPublished) : row;
    });
    return json({ exam });
  } catch (error) { return handleError(error); }
}
export async function DELETE(_request: Request, { params }: Ctx) {
  try {
    const auth = await requireAdmin(); const id = numParam((await params).id)!;
    const row = await db.transaction(async (tx) => { const [r] = await tx.update(exams).set({ archivedAt: new Date() }).where(and(eq(exams.id, id), eq(exams.schoolId, auth.school.id))).returning(); if (r) await audit(tx, auth, "exam.archived", "examinations", id, { historicalMarksPreserved: true }); return r; });
    return row ? json({ ok: true, archived: true }) : notFound("Exam not found.");
  } catch (error) { return handleError(error); }
}

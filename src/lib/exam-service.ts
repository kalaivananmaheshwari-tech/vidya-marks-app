import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { db, type DbExecutor } from "@/db";
import { classes, exams, examPublications } from "@/db/schema";
import type { SchoolAuthContext } from "@/lib/auth";
import { HttpError } from "@/lib/http";
import { markMonitoring } from "@/lib/mark-entry";
import { classAssessment } from "@/lib/assessments";
import { audit } from "@/lib/audit";

export async function publishResultInTransaction(executor: DbExecutor, auth: SchoolAuthContext, examId: number, publish: boolean) {
  if (auth.user.role !== "admin") throw new HttpError("Only administrators can publish results.", 403, "FORBIDDEN");
  const [exam] = await executor.select().from(exams).where(and(eq(exams.id, examId), eq(exams.schoolId, auth.school.id), isNull(exams.archivedAt))).for("update");
  if (!exam) throw new HttpError("Exam not found in this school.", 403, "INVALID_SCHOOL_SCOPE");
  if (exam.isPublished === publish) return exam;
  if (publish) {
    // Same lock order as mark entry: exam, then classes in deterministic order.
    const classRows = await executor.select().from(classes).where(and(eq(classes.schoolId, auth.school.id), eq(classes.academicYearId, exam.academicYearId!), isNull(classes.archivedAt))).orderBy(asc(classes.id)).for("update");
    const rows = await markMonitoring(auth, exam.id, undefined, executor);
    const pending = rows.filter((r) => r.status !== "Complete");
    if (!rows.length || pending.length) throw new HttpError("Results cannot be published until every mapped subject is complete.", 409, "INCOMPLETE_MARK_ENTRY", { pendingTeachers: pending.map((r) => ({ className: r.className, section: r.section, teacherName: r.teacherName, subjectName: r.subjectName, pendingStudentCount: r.pending })) });
    const [latest]=await executor.select({value:sql<number>`coalesce(max(${examPublications.generation}),0)::int`}).from(examPublications).where(and(eq(examPublications.schoolId,auth.school.id),eq(examPublications.examId,exam.id)));
    const generation=(latest?.value ?? 0)+1;
    for(const cls of classRows) await executor.insert(examPublications).values({schoolId:auth.school.id,examId:exam.id,classId:cls.id,generation,data:await classAssessment(cls,exam.id,executor),schoolHeader:auth.school,publishedBy:auth.user.id});
  }
  const [updated] = await executor.update(exams).set({ isPublished: publish }).where(and(eq(exams.id, exam.id), eq(exams.schoolId, auth.school.id))).returning();
  await audit(executor, auth, publish ? "result.published" : "result.unpublished", "examinations", exam.id, { academicYearId: exam.academicYearId });
  return updated;
}
export async function publishResult(auth: SchoolAuthContext, examId: number, publish: boolean) {
  return db.transaction((tx) => publishResultInTransaction(tx, auth, examId, publish));
}

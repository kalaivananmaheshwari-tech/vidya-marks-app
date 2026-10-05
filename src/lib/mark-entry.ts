import {markValues,normalizedMark} from "@/db/mark-values";
import {allocationReviewRequired} from "@/lib/domain/legacy-allocations";
import { z } from "zod";
import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import { db, type DbExecutor } from "@/db";
import { assessmentMarkComponents, classes, exams, marks, markAllocations, students, studentEnrollments } from "@/db/schema";
import { isAdmin, type SchoolAuthContext } from "@/lib/auth";
import { assertClassAccess, assertExamAccess, assertSubjectAccess, classScopeCondition } from "@/lib/authorization";
import { HttpError, idSchema, uuidSchema } from "@/lib/http";
import { markInputSchema, validateAndCalculateMark, markState, type Allocation } from "@/lib/domain/marks";
import { subjectsForClass } from "@/lib/queries";
import { audit } from "@/lib/audit";

export const entrySchema = markInputSchema.extend({ studentId: idSchema.optional(), studentUuid: uuidSchema.optional(), enrollmentId: uuidSchema.optional() }).strict()
  .refine((e) => Boolean(e.enrollmentId || e.studentId), "An enrollment UUID is required.");
export const markBatchSchema = z.object({ classId: idSchema, examId: idSchema, subjectId: idSchema, entries: z.array(entrySchema).min(1).max(1000) }).strict();
export type MarkBatch = z.infer<typeof markBatchSchema>;

export async function markRoster(auth: SchoolAuthContext, classId: number, examId?: number, subjectId?: number, executor: DbExecutor = db) {
  const cls = await assertClassAccess(auth, classId, executor);
  const { list } = await subjectsForClass(classId, auth.school.id, executor);
  const allowed = isAdmin(auth.user) ? list : list.filter((s) => s.teacherId === auth.user.id);
  if (!examId || !subjectId) return { subjects: allowed, roster: [] };
  await assertSubjectAccess(auth, classId, subjectId, executor);
  const exam = await assertExamAccess(auth, examId, executor);
  if (exam.academicYearId !== cls.academicYearId) throw new HttpError("Class and exam must belong to the same academic year.", 400, "INVALID_ACADEMIC_YEAR");
  const subject = allowed.find((s) => s.id === subjectId)!;
  if (subject.mode === "UNAPPROVED") throw new HttpError("Mark allocation for this class is not approved.", 409, "FEATURE_NOT_APPROVED");
  const rows = await executor.select({
    studentId: students.id, studentUuid: students.uuid, enrollmentId: studentEnrollments.id,
    name: students.name, rollNo: studentEnrollments.examNumber, admissionNo: students.admissionNo,
    markId: marks.id, theoryScore: markValues.theoryScore, practicalScore: markValues.practicalScore, internalScore: markValues.internalScore,
    score: markValues.score, status: marks.status, isAbsent: marks.isAbsent, isExempt: marks.isExempt,
    updatedAt: marks.updatedAt, enteredById: marks.enteredById, allocationSnapshot: marks.allocationSnapshot,
  }).from(studentEnrollments).innerJoin(students, and(eq(students.id, studentEnrollments.studentId), eq(students.uuid, studentEnrollments.studentUuid), eq(students.schoolId, studentEnrollments.schoolId)))
    .leftJoin(marks, and(eq(marks.enrollmentId, studentEnrollments.id), eq(marks.schoolId, studentEnrollments.schoolId), eq(marks.examId, examId), eq(marks.subjectId, subjectId)))
    .where(and(eq(studentEnrollments.schoolId, auth.school.id), eq(studentEnrollments.classId, classId), eq(studentEnrollments.isActive, true), isNull(students.archivedAt)))
    .orderBy(asc(studentEnrollments.examNumber));
  if(!isAdmin(auth.user) && rows.some((r)=>r.markId!==null && r.enteredById!==auth.user.id))throw new HttpError("Existing entries belong to another member. Only the entry owner or school administrator may read them outside an authorized consolidated report.",403,"FORBIDDEN_MARK_OWNER");
  return { subjects: allowed, subject, examPublished: exam.isPublished, roster: rows.map((r) => ({ ...r, status: markState(r), allocationReviewRequired:r.markId?allocationReviewRequired(r,subject as Allocation):false, editable: !exam.isPublished && (!r.markId || !allocationReviewRequired(r,subject as Allocation)) && (isAdmin(auth.user) || !r.enteredById || r.enteredById === auth.user.id), ...(markState(r) === "AB" || markState(r) === "EXEMPT" ? { score: null, theoryScore: null, practicalScore: null, internalScore: null } : {}) })) };
}

/** Caller and all client references are revalidated INSIDE the transaction. */
export async function saveMarksInTransaction(executor: DbExecutor, auth: SchoolAuthContext, payload: MarkBatch) {
  if (!isAdmin(auth.user) && auth.user.mustChangePassword) throw new HttpError("Change your initial password before entering marks.", 403, "PASSWORD_CHANGE_REQUIRED");
  await executor.select({ id: exams.id }).from(exams).where(and(eq(exams.id, payload.examId), eq(exams.schoolId, auth.school.id))).for("update");
  const exam = await assertExamAccess(auth, payload.examId, executor);
  if (exam.isPublished) throw new HttpError("Published results are read-only. An administrator must unpublish before editing.", 409, "RESULT_PUBLISHED");
  await executor.select({ id: classes.id }).from(classes).where(and(eq(classes.id, payload.classId), eq(classes.schoolId, auth.school.id))).for("update");
  const cls = await assertClassAccess(auth, payload.classId, executor);
  const mapping = await assertSubjectAccess(auth, payload.classId, payload.subjectId, executor);
  if (!cls.academicYearId || cls.academicYearId !== exam.academicYearId) throw new HttpError("Class and exam must belong to the same academic year.", 400, "INVALID_ACADEMIC_YEAR");
  const [allocation] = await executor.select().from(markAllocations).where(and(eq(markAllocations.schoolId, auth.school.id), eq(markAllocations.classSubjectId, mapping.classSubject.id))).limit(1);
  if (!allocation || allocation.mode === "UNAPPROVED") throw new HttpError("Mark allocation for this class is not approved.", 409, "FEATURE_NOT_APPROVED");
  const enrollments = await executor.select({ enrollment: studentEnrollments, student: students }).from(studentEnrollments)
    .innerJoin(students, and(eq(students.id, studentEnrollments.studentId), eq(students.uuid, studentEnrollments.studentUuid), eq(students.schoolId, studentEnrollments.schoolId)))
    .where(and(eq(studentEnrollments.schoolId, auth.school.id), eq(studentEnrollments.classId, payload.classId), eq(studentEnrollments.isActive, true), isNull(students.archivedAt)));
  const current = await executor.select().from(marks).where(and(eq(marks.schoolId, auth.school.id), eq(marks.examId, payload.examId), eq(marks.subjectId, payload.subjectId)));
  const seen = new Set<string>();
  const changes: Array<Record<string, unknown>> = [];
  const values = payload.entries.map((entry) => {
    const record = enrollments.find((r) => entry.enrollmentId ? r.enrollment.id === entry.enrollmentId : r.student.id === entry.studentId);
    if (!record || (entry.studentUuid && entry.studentUuid !== record.student.uuid) || (entry.studentId && entry.studentId !== record.student.id)) throw new HttpError("A student/enrollment is outside the assigned class and section.", 403, "INVALID_TEACHER_ASSIGNMENT");
    const { enrollment, student } = record;
    if (seen.has(enrollment.id)) throw new HttpError("Duplicate enrollment in this batch.", 400, "INVALID_MARKS");
    seen.add(enrollment.id);
    const found = current.find((m) => m.studentUuid === student.uuid || m.studentId === student.id);
    const prior=found?normalizedMark(found):undefined;
    if (prior && prior.enrollmentId !== enrollment.id) throw new HttpError("Existing marks belong to a different historical enrollment and cannot be overwritten.", 409, "HISTORICAL_IDENTITY_LOCKED");
    if(prior && allocationReviewRequired(prior,allocation as Allocation)) throw new HttpError("Legacy components are preserved and require approved source-based review before editing under the current allocation.",409,"LEGACY_ALLOCATION_REVIEW_REQUIRED");
    if (!isAdmin(auth.user) && prior?.enteredById && prior.enteredById !== auth.user.id) throw new HttpError("You cannot edit another teacher's marks.", 403, "FORBIDDEN_MARK_OWNER");
    const { studentId: ignoredId, studentUuid: ignoredUuid, enrollmentId: ignoredEnrollment, ...input } = entry;
    void ignoredId; void ignoredUuid; void ignoredEnrollment;
    const result = validateAndCalculateMark(input, allocation as Allocation);
    changes.push({ enrollmentId: enrollment.id, before: prior ? { status: prior.status, score: prior.score, theoryScore: prior.theoryScore, practicalScore: prior.practicalScore, internalScore: prior.internalScore } : null, after: result });
    return { schoolId: auth.school.id, studentId: student.id, studentUuid: student.uuid, enrollmentId: enrollment.id, classSectionId: enrollment.classSectionId, classSubjectId: mapping.classSubject.id, allocationId: allocation.id, allocationSnapshot: { ...allocation }, subjectId: payload.subjectId, examId: payload.examId, ...result,scoreExact:result.score,theoryScoreExact:result.theoryScore,practicalScoreExact:result.practicalScore,internalScoreExact:result.internalScore, enteredById: auth.user.id, updatedAt: new Date() };
  });
  const saved = await executor.insert(marks).values(values).onConflictDoUpdate({ target: [marks.studentId, marks.subjectId, marks.examId], set: {
    studentUuid: sql`excluded.student_uuid`, enrollmentId: sql`excluded.enrollment_id`, classSectionId: sql`excluded.class_section_id`, classSubjectId: sql`excluded.class_subject_id`, allocationId: sql`excluded.allocation_id`, allocationSnapshot: sql`excluded.allocation_snapshot`,
    scoreExact:sql`excluded.score_exact`,theoryScoreExact:sql`excluded.theory_score_exact`,practicalScoreExact:sql`excluded.practical_score_exact`,internalScoreExact:sql`excluded.internal_score_exact`,
    theoryScore: sql`excluded.theory_score`, practicalScore: sql`excluded.practical_score`, internalScore: sql`excluded.internal_score`, score: sql`excluded.score`, status: sql`excluded.status`, isAbsent: sql`excluded.is_absent`, isExempt: sql`excluded.is_exempt`, enteredById: sql`excluded.entered_by_id`, updatedAt: sql`excluded.updated_at`,
  } }).returning();
  for (const m of saved.map(normalizedMark)) {
    for (const [kind, score] of [["theory", m.theoryScore], ["practical", m.practicalScore], ["internal", m.internalScore], ["total", m.score]] as const) {
      await executor.insert(assessmentMarkComponents).values({ schoolId: m.schoolId, markId: m.id, kind, score,scoreExact:score }).onConflictDoUpdate({ target: [assessmentMarkComponents.markId, assessmentMarkComponents.kind], set: { score,scoreExact:score } });
    }
  }
  await audit(executor, auth, "marks.updated", "assessment_marks", null, { classId: cls.id, examId: exam.id, subjectId: payload.subjectId, changes });
  return { saved: saved.length };
}
export async function saveMarkBatch(auth: SchoolAuthContext, input: unknown) {
  const payload = markBatchSchema.parse(input);
  return db.transaction((tx) => saveMarksInTransaction(tx, auth, payload));
}

export type MonitoringRow = { classId: number; className: string; section: string; subjectId: number; subjectName: string; teacherId: number | null; teacherName: string; totalStudents: number; entered: number; pending: number; status: "Complete" | "Pending" };
export async function markMonitoring(auth: SchoolAuthContext, examId: number, classId?: number, executor: DbExecutor = db, fullClass = false): Promise<MonitoringRow[]> {
  const exam = await assertExamAccess(auth, examId, executor);
  if (classId) await assertClassAccess(auth, classId, executor, fullClass);
  const classList = await executor.select().from(classes).where(and(eq(classes.schoolId, auth.school.id), eq(classes.academicYearId, exam.academicYearId!), isNull(classes.archivedAt), classId ? eq(classes.id, classId) : undefined, isAdmin(auth.user) || fullClass ? undefined : classScopeCondition(auth)));
  const output: MonitoringRow[] = [];
  for (const cls of classList) {
    const { list } = await subjectsForClass(cls.id, auth.school.id, executor);
    const studentsInClass = await executor.select({ id: studentEnrollments.id }).from(studentEnrollments).innerJoin(students, eq(students.uuid, studentEnrollments.studentUuid))
      .where(and(eq(studentEnrollments.schoolId, auth.school.id), eq(studentEnrollments.classId, cls.id), eq(studentEnrollments.isActive, true), isNull(students.archivedAt)));
    const ids = studentsInClass.map((s) => s.id);
    const recorded = ids.length ? await executor.select().from(marks).where(and(eq(marks.schoolId, auth.school.id), eq(marks.examId, exam.id), inArray(marks.enrollmentId, ids))) : [];
    for (const sub of list) {
      if (!isAdmin(auth.user) && !fullClass && sub.teacherId !== auth.user.id) continue;
      const entered = new Set(recorded.map(normalizedMark).filter((m) => sub.teacherId!==null && m.subjectId === sub.id && m.classSubjectId===sub.classSubjectId && m.enteredById===sub.teacherId && markState(m) !== "PENDING" && !allocationReviewRequired(m,sub as Allocation)).map((m) => m.enrollmentId)).size;
      const pending = ids.length - entered;
      const mapped = sub.teacherId !== null && sub.teacherActive;
      output.push({ classId: cls.id, className: cls.name, section: cls.section, subjectId: sub.id, subjectName: sub.name, teacherId: sub.teacherId, teacherName: sub.teacherName ?? "Unassigned teacher", totalStudents: ids.length, entered, pending, status: pending === 0 && mapped && sub.mode !== "UNAPPROVED" ? "Complete" : "Pending" });
    }
  }
  return output;
}
export async function assertConsolidatedReady(auth: SchoolAuthContext, classId: number, examId: number, executor: DbExecutor = db) {
  const cls = await assertClassAccess(auth, classId, executor, true);
  if (!isAdmin(auth.user) && cls.classTeacherId !== auth.user.id) throw new HttpError("Only this Class Teacher or the school administrator may generate a consolidated mark sheet.", 403, "INVALID_REPORT_SCOPE");
  const rows = await markMonitoring(auth, examId, classId, executor, true);
  if (!rows.length) throw new HttpError("Consolidated Mark Sheet cannot be generated.", 409, "INCOMPLETE_MARK_ENTRY", { pendingTeachers: [], reason: "No required subjects are mapped." });
  const required = (await subjectsForClass(classId, auth.school.id, executor)).list.filter((s) => s.isRequired).map((s) => s.id);
  if (!required.length) throw new HttpError("Consolidated Mark Sheet cannot be generated.", 409, "INCOMPLETE_MARK_ENTRY", { pendingTeachers: [], reason: "No required subjects are mapped." });
  const pending = rows.filter((r) => required.includes(r.subjectId) && r.status !== "Complete");
  if (pending.length) throw new HttpError("Consolidated Mark Sheet cannot be generated.", 409, "INCOMPLETE_MARK_ENTRY", { pendingTeachers: pending.map((r) => ({ teacherId: r.teacherId, teacherName: r.teacherName, subjectId: r.subjectId, subjectName: r.subjectName, pendingStudentCount: r.pending })) });
  return rows;
}

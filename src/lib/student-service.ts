import { randomBytes } from "node:crypto";
import { z } from "zod";
import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import { db, type DbExecutor } from "@/db";
import { classes, classSections, marks, students, studentEnrollments } from "@/db/schema";
import type { SchoolAuthContext } from "@/lib/auth";
import { isAdmin } from "@/lib/auth";
import { HttpError, idSchema } from "@/lib/http";
import { assertClassAccess } from "@/lib/authorization";
import { syncClassRelations } from "@/lib/relations";
import { audit } from "@/lib/audit";

const optionalText = z.string().trim().max(200).nullable().optional();
export const studentSchema = z.object({
  studentId: idSchema.nullable().optional(), classId: idSchema, name: z.string().trim().min(1).max(150),
  rollNo: idSchema.nullable().optional(), admissionNo: optionalText, gender: z.enum(["Male","Female","Other"]).optional(),
  emisId: optionalText, guardianName: optionalText, contact: optionalText,
  medium: z.enum(["Tamil", "English"]).nullable().optional(),
  dob: z.union([z.string().date(), z.literal("")]).nullable().optional(),
}).strict();
export type StudentInput = z.infer<typeof studentSchema>;

export async function saveStudentInTransaction(executor: DbExecutor, auth: SchoolAuthContext, input: StudentInput) {
  if (!isAdmin(auth.user)) throw new HttpError("Only administrators can change student records.", 403, "FORBIDDEN");
  let prior: typeof students.$inferSelect | undefined;
  if (input.studentId) {
    [prior] = await executor.select().from(students).where(and(eq(students.id,input.studentId),eq(students.schoolId,auth.school.id),isNull(students.archivedAt))).limit(1);
    if (!prior) throw new HttpError("Student is outside your school scope or archived.",403,"INVALID_SCHOOL_SCOPE");
  }
  // Same deterministic class lock order as publication. Old class is locked during a move.
  const lockedIds=[...new Set([input.classId,...(prior?[prior.classId]:[])])];
  await executor.select({id:classes.id}).from(classes).where(and(eq(classes.schoolId,auth.school.id),inArray(classes.id,lockedIds))).orderBy(asc(classes.id)).for("update");
  if(prior) {
    const [fresh]=await executor.select().from(students).where(and(eq(students.id,prior.id),eq(students.schoolId,auth.school.id),isNull(students.archivedAt))).limit(1);
    if(!fresh || !lockedIds.includes(fresh.classId)) throw new HttpError("Student enrollment changed concurrently. Reload and retry.",409,"CONCURRENT_STUDENT_UPDATE");
    prior=fresh;
  }
  const cls=await assertClassAccess(auth,input.classId,executor);
  let [classSection]=await executor.select().from(classSections).where(and(eq(classSections.schoolId,auth.school.id),eq(classSections.classId,cls.id))).limit(1);
  if(!classSection) classSection=await syncClassRelations(executor,cls.id,auth.school.id);
  if(prior) {
    const priorYear=await executor.select({enrollmentId:studentEnrollments.id,classSectionId:studentEnrollments.classSectionId}).from(studentEnrollments)
      .where(and(eq(studentEnrollments.schoolId,auth.school.id),eq(studentEnrollments.studentUuid,prior.uuid),eq(studentEnrollments.academicYearId,classSection.academicYearId)));
    const otherSections=priorYear.filter((e)=>e.classSectionId!==classSection.id).map((e)=>e.enrollmentId);
    if(otherSections.length) {
      const [recorded]=await executor.select({id:marks.id}).from(marks).where(and(eq(marks.schoolId,auth.school.id),inArray(marks.enrollmentId,otherSections))).limit(1);
      if(recorded) throw new HttpError("A same-year class/section move is blocked after assessments exist. An explicit approved transfer policy is required; historical enrollment marks will not be overwritten.",409,"HISTORICAL_IDENTITY_LOCKED");
    }
  }
  const [currentEnrollment] = prior ? await executor.select().from(studentEnrollments).where(and(eq(studentEnrollments.studentUuid, prior.uuid), eq(studentEnrollments.classSectionId, classSection.id))).limit(1) : [];
  let rollNo = input.rollNo ?? currentEnrollment?.examNumber;
  if (!rollNo) {
    const [max] = await executor.select({ value: sql<number>`coalesce(max(${studentEnrollments.examNumber}),0)::int` }).from(studentEnrollments)
      .where(and(eq(studentEnrollments.schoolId, auth.school.id), eq(studentEnrollments.classSectionId, classSection.id), eq(studentEnrollments.isActive, true)));
    rollNo = Number(max?.value ?? 0) + 1;
  }
  if (currentEnrollment && currentEnrollment.examNumber !== rollNo) {
    const [historicalMark] = await executor.select({ id: marks.id }).from(marks).where(eq(marks.enrollmentId, currentEnrollment.id)).limit(1);
    if (historicalMark) throw new HttpError("Exam Number cannot be changed after marks exist for this enrollment.", 409, "HISTORICAL_IDENTITY_LOCKED");
  }
  const fields = {
    schoolId: auth.school.id, classId: cls.id, name: input.name, rollNo,
    admissionNo: input.admissionNo || prior?.admissionNo || `ADM-${new Date().getFullYear()}-${randomBytes(6).toString("hex")}`,
    gender: input.gender ?? prior?.gender ?? "Other",
    emisId: input.emisId === undefined ? prior?.emisId ?? null : input.emisId || null,
    guardianName: input.guardianName === undefined ? prior?.guardianName ?? null : input.guardianName || null,
    contact: input.contact === undefined ? prior?.contact ?? null : input.contact || null,
    medium: input.medium === undefined ? prior?.medium ?? null : input.medium,
    dob: input.dob === undefined ? prior?.dob ?? null : input.dob || null,
  };
  const [student] = prior
    ? await executor.update(students).set(fields).where(and(eq(students.id, prior.id), eq(students.schoolId, auth.school.id))).returning()
    : await executor.insert(students).values(fields).returning();
  // Moving to a new class/year creates a new enrollment; historical marks keep the old UUID.
  await executor.update(studentEnrollments).set({ isActive: false }).where(and(eq(studentEnrollments.schoolId, auth.school.id), eq(studentEnrollments.studentUuid, student.uuid), eq(studentEnrollments.isActive, true)));
  const [enrollment] = await executor.insert(studentEnrollments).values({ schoolId: auth.school.id, studentId: student.id, studentUuid: student.uuid, classId: cls.id, classSectionId: classSection.id, academicYearId: classSection.academicYearId, examNumber: rollNo, isActive: true })
    .onConflictDoUpdate({ target: [studentEnrollments.studentUuid, studentEnrollments.classSectionId], set: { examNumber: rollNo, isActive: true, archivedAt: null } }).returning();
  await audit(executor, auth, prior ? "student.updated" : "student.created", "students", student.uuid, { enrollmentId: enrollment.id, classId: cls.id, examNumber: rollNo, changedFields: Object.keys(input).filter((k) => k !== "contact") });
  return { student: { ...student, enrollmentId: enrollment.id, studentUuid: student.uuid } };
}
export async function saveStudent(auth: SchoolAuthContext, input: unknown) {
  const data = studentSchema.parse(input);
  return db.transaction((tx) => saveStudentInTransaction(tx, auth, data));
}
export async function archiveStudent(auth: SchoolAuthContext, id: number) {
  if (!isAdmin(auth.user)) throw new HttpError("Only administrators can archive students.", 403, "FORBIDDEN");
  return db.transaction(async (tx) => {
    const [student] = await tx.select().from(students).where(and(eq(students.id, id), eq(students.schoolId, auth.school.id))).limit(1);
    if (!student) throw new HttpError("Student not found.", 404, "NOT_FOUND");
    await tx.select({ id: classes.id }).from(classes).where(and(eq(classes.id, student.classId), eq(classes.schoolId, auth.school.id))).for("update");
    const now = new Date();
    await tx.update(students).set({ archivedAt: now }).where(eq(students.id, student.id));
    await tx.update(studentEnrollments).set({ isActive: false, archivedAt: now }).where(and(eq(studentEnrollments.schoolId, auth.school.id), eq(studentEnrollments.studentUuid, student.uuid)));
    await audit(tx, auth, "student.archived", "students", student.uuid, { historicalMarksPreserved: true });
    return { ok: true, archived: true };
  });
}

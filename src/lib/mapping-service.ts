import { z } from "zod";
import { and, eq, isNull } from "drizzle-orm";
import { db, type DbExecutor } from "@/db";
import { classes, classSubjects, marks, markAllocations, teacherSubjectAssignments, users } from "@/db/schema";
import { isAdmin, type SchoolAuthContext } from "@/lib/auth";
import { assertClassAccess, assertSubjectAccess, assertTeacherReference } from "@/lib/authorization";
import { allocationFor, classNumber } from "@/lib/domain/marks";
import { HttpError, idSchema } from "@/lib/http";
import { audit } from "@/lib/audit";
import { writeAllocationComponents } from "@/lib/relations";

export const mappingSchema = z.object({ classId: idSchema, assignments: z.array(z.object({ id: idSchema, hasPractical: z.boolean(), teacherId: idSchema.nullable() }).strict()).min(1).max(50) }).strict();
export async function setTeacherMapping(executor: DbExecutor, auth: SchoolAuthContext, classId: number, subjectId: number, teacherId: number | null) {
  if (!isAdmin(auth.user)) throw new HttpError("Only administrators can change mappings.", 403, "FORBIDDEN");
  await executor.select({id:classes.id}).from(classes).where(and(eq(classes.id,classId),eq(classes.schoolId,auth.school.id))).for("update");
  const { classSubject } = await assertSubjectAccess(auth, classId, subjectId, executor);
  const [prior] = await executor.select().from(teacherSubjectAssignments).where(eq(teacherSubjectAssignments.classSubjectId, classSubject.id)).limit(1);
  if (teacherId === null) {
    // Unmapping is deliberately not a deletion path: mappings are required for teacher accounts.
    if (prior) throw new HttpError("Select a replacement teacher. Disable a departing teacher's login before reassignment.", 409, "MAPPING_REQUIRED");
    return;
  }
  const { profile } = await assertTeacherReference(auth.school.id, teacherId, executor);
  await executor.insert(teacherSubjectAssignments).values({ schoolId: auth.school.id, classId, subjectId, classSubjectId: classSubject.id, teacherId, teacherProfileId: profile.id })
    .onConflictDoUpdate({ target: [teacherSubjectAssignments.classId, teacherSubjectAssignments.subjectId], set: { teacherId, teacherProfileId: profile.id } });
  await audit(executor, auth, "teacher.mapping_changed", "class_subjects", classSubject.id, { classId, subjectId, previousTeacherId: prior?.teacherId ?? null, teacherId });
}
export async function ensureMappedActiveTeachers(executor: DbExecutor, schoolId: number, ids: number[]) {
  for (const id of new Set(ids)) {
    const [user] = await executor.select().from(users).where(and(eq(users.id, id), eq(users.schoolId, schoolId))).limit(1);
    if (!user?.isActive) continue;
    const [mapping] = await executor.select().from(teacherSubjectAssignments).where(and(eq(teacherSubjectAssignments.schoolId, schoolId), eq(teacherSubjectAssignments.teacherId, id))).limit(1);
    if (!mapping) throw new HttpError("Every active teacher must retain at least one class / section / subject mapping. Disable the departing login before reassignment.", 409, "MAPPING_REQUIRED");
  }
}
export async function configureMappingsInTransaction(executor: DbExecutor, auth: SchoolAuthContext, body: z.infer<typeof mappingSchema>) {
  if (!isAdmin(auth.user)) throw new HttpError("Only administrators can change allocations.", 403, "FORBIDDEN");
  await executor.select({ id: classes.id }).from(classes).where(and(eq(classes.id, body.classId), eq(classes.schoolId, auth.school.id))).for("update");
  const cls = await assertClassAccess(auth, body.classId, executor);
  const grade = classNumber(cls.name);
  if (!grade || grade < 6) throw new HttpError("Mark allocation for this class is not approved.", 409, "FEATURE_NOT_APPROVED");
  const seen = new Set<number>(); const affectedTeachers: number[] = [];
  for (const item of body.assignments) {
    if (seen.has(item.id)) throw new HttpError("Duplicate subject mapping."); seen.add(item.id);
    const { classSubject } = await assertSubjectAccess(auth, body.classId, item.id, executor);
    const [allocation] = await executor.select().from(markAllocations).where(and(eq(markAllocations.schoolId, auth.school.id), eq(markAllocations.classSubjectId, classSubject.id))).limit(1);
    const approved = allocationFor(grade, item.hasPractical);
    const changed = !allocation || allocation.hasPractical !== item.hasPractical || allocation.mode !== approved.mode || allocation.theoryMarks !== approved.theoryMarks || allocation.practicalMarks !== approved.practicalMarks || allocation.internalMarks !== approved.internalMarks;
    if (changed) {
      const [recorded] = await executor.select({ id: marks.id }).from(marks).where(and(eq(marks.schoolId, auth.school.id), eq(marks.classSubjectId, classSubject.id))).limit(1);
      if (recorded) throw new HttpError("Allocation cannot change after marks exist. Create a new class/year setup to preserve academic history.", 409, "ALLOCATION_LOCKED");
      const [updated] = await executor.insert(markAllocations).values({ schoolId: auth.school.id, classSubjectId: classSubject.id, ...approved })
        .onConflictDoUpdate({ target: markAllocations.classSubjectId, set: approved }).returning();
      await writeAllocationComponents(executor, updated);
      await audit(executor, auth, "mark_allocation.updated", "mark_allocations", updated.id, { classId: cls.id, subjectId: item.id, before: allocation ?? null, after: approved });
    }
    const [prior] = await executor.select().from(teacherSubjectAssignments).where(eq(teacherSubjectAssignments.classSubjectId, classSubject.id)).limit(1);
    if (prior) affectedTeachers.push(prior.teacherId);
    await setTeacherMapping(executor, auth, cls.id, item.id, item.teacherId);
  }
  await ensureMappedActiveTeachers(executor, auth.school.id, affectedTeachers);
  return { success: true, updatedCount: body.assignments.length };
}
export async function configureMappings(auth: SchoolAuthContext, input: unknown) {
  const body = mappingSchema.parse(input);
  return db.transaction((tx) => configureMappingsInTransaction(tx, auth, body));
}

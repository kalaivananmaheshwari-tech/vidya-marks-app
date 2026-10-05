import { and, asc, eq, isNull } from "drizzle-orm";
import { db, type DbExecutor } from "@/db";
import { classes, classSubjects, subjects, users, teacherSubjectAssignments, markAllocations } from "@/db/schema";

/** Per-class/section mappings and allocations; legacy global teacher fields are NOT authorization. */
export async function subjectsForClass(classId: number, schoolId: number, executor: DbExecutor = db, includeArchived = false) {
  const [cls] = await executor.select().from(classes).where(and(eq(classes.id, classId), eq(classes.schoolId, schoolId))).limit(1);
  if (!cls) return { cls: null, list: [] };
  const list = await executor.select({
    id: subjects.id, schoolId: subjects.schoolId, classId: classSubjects.classId,
    code: subjects.code, name: subjects.name, groupId: subjects.groupId, isRequired: classSubjects.isRequired,
    classSubjectId: classSubjects.id, classSectionId: classSubjects.classSectionId,
    allocationId: markAllocations.id, mode: markAllocations.mode,
    hasPractical: markAllocations.hasPractical, theoryMarks: markAllocations.theoryMarks,
    practicalMarks: markAllocations.practicalMarks, internalMarks: markAllocations.internalMarks,
    maxMarks: markAllocations.maxMarks, passMarks: markAllocations.passMarks,
    teacherId: teacherSubjectAssignments.teacherId, teacherName: users.name, teacherActive: users.isActive,
  }).from(classSubjects)
    .innerJoin(subjects, and(eq(subjects.id, classSubjects.subjectId), eq(subjects.schoolId, classSubjects.schoolId)))
    .innerJoin(markAllocations, and(eq(markAllocations.classSubjectId, classSubjects.id), eq(markAllocations.schoolId, classSubjects.schoolId)))
    .leftJoin(teacherSubjectAssignments, and(eq(teacherSubjectAssignments.classSubjectId, classSubjects.id), eq(teacherSubjectAssignments.schoolId, classSubjects.schoolId)))
    .leftJoin(users, eq(users.id, teacherSubjectAssignments.teacherId))
    .where(and(eq(classSubjects.schoolId, schoolId), eq(classSubjects.classId, classId), includeArchived ? undefined : isNull(subjects.archivedAt)))
    .orderBy(asc(subjects.id));
  return { cls, list };
}

import { and, asc, eq, isNull, or } from "drizzle-orm";
import { db } from "@/db";
import { classes, subjects, users } from "@/db/schema";

/** Subjects a class studies: class-specific subjects, or group subjects + common subjects. */
export async function subjectsForClass(classId: number, schoolId: number) {
  const [cls] = await db
    .select()
    .from(classes)
    .where(and(eq(classes.id, classId), eq(classes.schoolId, schoolId)))
    .limit(1);
  if (!cls) return { cls: null, list: [] };

  // 1. Check if class-specific subjects were created for this class
  const classSpecific = await db
    .select({
      id: subjects.id,
      schoolId: subjects.schoolId,
      classId: subjects.classId,
      code: subjects.code,
      name: subjects.name,
      groupId: subjects.groupId,
      hasPractical: subjects.hasPractical,
      theoryMarks: subjects.theoryMarks,
      practicalMarks: subjects.practicalMarks,
      internalMarks: subjects.internalMarks,
      maxMarks: subjects.maxMarks,
      passMarks: subjects.passMarks,
      teacherId: subjects.teacherId,
      teacherName: users.name,
    })
    .from(subjects)
    .leftJoin(users, eq(users.id, subjects.teacherId))
    .where(and(eq(subjects.schoolId, schoolId), eq(subjects.classId, classId)))
    .orderBy(asc(subjects.id));

  if (classSpecific.length > 0) {
    return { cls, list: classSpecific };
  }

  // 2. Otherwise fall back to group subjects + common subjects
  const fallbackCondition = cls.groupId
    ? or(eq(subjects.groupId, cls.groupId), and(isNull(subjects.groupId), isNull(subjects.classId)))
    : and(isNull(subjects.groupId), isNull(subjects.classId));

  const fallbackList = await db
    .select({
      id: subjects.id,
      schoolId: subjects.schoolId,
      classId: subjects.classId,
      code: subjects.code,
      name: subjects.name,
      groupId: subjects.groupId,
      hasPractical: subjects.hasPractical,
      theoryMarks: subjects.theoryMarks,
      practicalMarks: subjects.practicalMarks,
      internalMarks: subjects.internalMarks,
      maxMarks: subjects.maxMarks,
      passMarks: subjects.passMarks,
      teacherId: subjects.teacherId,
      teacherName: users.name,
    })
    .from(subjects)
    .leftJoin(users, eq(users.id, subjects.teacherId))
    .where(and(eq(subjects.schoolId, schoolId), fallbackCondition))
    .orderBy(asc(subjects.id));

  return { cls, list: fallbackList };
}

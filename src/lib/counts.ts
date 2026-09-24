import { and, eq, isNotNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { classes, marks, students, subjects, users } from "@/db/schema";

/** Build a lookup map from grouped count rows. */
function toMap(rows: Array<{ key: number | null; value: number }>): Map<number, number> {
  const map = new Map<number, number>();
  for (const row of rows) {
    if (row.key !== null) map.set(row.key, Number(row.value));
  }
  return map;
}

export async function classCountByGroup(schoolId: number) {
  const rows = await db
    .select({ key: classes.groupId, value: sql<number>`count(*)::int` })
    .from(classes)
    .where(eq(classes.schoolId, schoolId))
    .groupBy(classes.groupId);
  return toMap(rows);
}

export async function subjectCountByGroup(schoolId: number) {
  const rows = await db
    .select({ key: subjects.groupId, value: sql<number>`count(*)::int` })
    .from(subjects)
    .where(eq(subjects.schoolId, schoolId))
    .groupBy(subjects.groupId);
  return toMap(rows);
}

export async function studentCountByGroup(schoolId: number) {
  const rows = await db
    .select({ key: classes.groupId, value: sql<number>`count(*)::int` })
    .from(students)
    .innerJoin(classes, eq(classes.id, students.classId))
    .where(eq(students.schoolId, schoolId))
    .groupBy(classes.groupId);
  return toMap(rows);
}

export async function studentCountByClass(schoolId: number) {
  const rows = await db
    .select({ key: students.classId, value: sql<number>`count(*)::int` })
    .from(students)
    .where(eq(students.schoolId, schoolId))
    .groupBy(students.classId);
  return toMap(rows);
}

export async function markCountBySubject(schoolId: number) {
  const rows = await db
    .select({ key: marks.subjectId, value: sql<number>`count(*)::int` })
    .from(marks)
    .where(eq(marks.schoolId, schoolId))
    .groupBy(marks.subjectId);
  return toMap(rows);
}

export async function markCountByExam(schoolId: number) {
  const rows = await db
    .select({ key: marks.examId, value: sql<number>`count(*)::int` })
    .from(marks)
    .where(eq(marks.schoolId, schoolId))
    .groupBy(marks.examId);
  return toMap(rows);
}

export async function classCountByTeacher(schoolId: number) {
  const rows = await db
    .select({ key: classes.classTeacherId, value: sql<number>`count(*)::int` })
    .from(classes)
    .where(and(eq(classes.schoolId, schoolId), isNotNull(classes.classTeacherId)))
    .groupBy(classes.classTeacherId);
  return toMap(rows);
}

export async function subjectCountByTeacher(schoolId: number) {
  const rows = await db
    .select({ key: subjects.teacherId, value: sql<number>`count(*)::int` })
    .from(subjects)
    .where(and(eq(subjects.schoolId, schoolId), isNotNull(subjects.teacherId)))
    .groupBy(subjects.teacherId);
  return toMap(rows);
}

/** Average achieved percentage per student, across all recorded marks. */
export async function averageByStudent(schoolId: number) {
  const rows = await db
    .select({
      key: marks.studentId,
      value: sql<number>`round(avg(${marks.score} / nullif(${subjects.maxMarks}, 0) * 100)::numeric, 1)::float8`,
    })
    .from(marks)
    .innerJoin(subjects, eq(subjects.id, marks.subjectId))
    .where(and(eq(marks.schoolId, schoolId), eq(marks.isAbsent, false), isNotNull(marks.score)))
    .groupBy(marks.studentId);
  return toMap(rows);
}

export async function users_count(schoolId: number) {
  const [row] = await db
    .select({ value: sql<number>`count(*)::int` })
    .from(users)
    .where(eq(users.schoolId, schoolId));
  return row?.value ?? 0;
}

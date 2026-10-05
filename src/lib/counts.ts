import {approvedScoringCondition} from "@/lib/scoring-policy";
import {markValues} from "@/db/mark-values";
import { and, eq, isNotNull, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { classes, marks, students, subjects, users,studentEnrollments } from "@/db/schema";

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
    .where(and(eq(students.schoolId, schoolId), isNull(students.archivedAt)))
    .groupBy(classes.groupId);
  return toMap(rows);
}

export async function studentCountByClass(schoolId: number) {
  const rows = await db
    .select({ key: students.classId, value: sql<number>`count(*)::int` })
    .from(students)
    .where(and(eq(students.schoolId, schoolId), isNull(students.archivedAt)))
    .groupBy(students.classId);
  return toMap(rows);
}

export async function markCountBySubject(schoolId: number, teacherId?: number) {
  const rows = await db
    .select({ key: marks.subjectId, value: sql<number>`count(*)::int` })
    .from(marks)
    .where(and(eq(marks.schoolId, schoolId), teacherId ? eq(marks.enteredById,teacherId):undefined,teacherId ? sql`exists(select 1 from teacher_subject_assignments a where a.school_id=${schoolId} and a.teacher_id=${teacherId} and a.class_subject_id=${marks.classSubjectId})` : undefined))
    .groupBy(marks.subjectId);
  return toMap(rows);
}

export async function markCountByExam(schoolId: number, teacherId?: number) {
  const rows = await db
    .select({ key: marks.examId, value: sql<number>`count(*)::int` })
    .from(marks)
    .where(and(eq(marks.schoolId, schoolId), teacherId ? eq(marks.enteredById,teacherId):undefined,teacherId ? sql`exists(select 1 from teacher_subject_assignments a where a.school_id=${schoolId} and a.teacher_id=${teacherId} and a.class_subject_id=${marks.classSubjectId})` : undefined))
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
export async function averageByStudent(schoolId: number, teacherId?: number) {
  const rows = await db
    .select({
      key: marks.studentId,
      value: sql<number>`round(avg(${markValues.score} / nullif(${subjects.maxMarks}, 0) * 100)::numeric, 1)::float8`,
    })
    .from(marks)
    .innerJoin(subjects, eq(subjects.id, marks.subjectId))
    .innerJoin(studentEnrollments,and(eq(studentEnrollments.id,marks.enrollmentId),eq(studentEnrollments.schoolId,marks.schoolId)))
    .innerJoin(classes,and(eq(classes.id,studentEnrollments.classId),eq(classes.schoolId,marks.schoolId)))
    .where(and(eq(marks.schoolId, schoolId), eq(marks.status, "NUMERIC"),approvedScoringCondition(classes.name), isNotNull(marks.score), teacherId ? eq(marks.enteredById,teacherId):undefined,teacherId ? sql`exists(select 1 from teacher_subject_assignments a where a.school_id=${schoolId} and a.teacher_id=${teacherId} and a.class_subject_id=${marks.classSubjectId})` : undefined))
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

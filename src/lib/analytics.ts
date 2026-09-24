import { and, eq, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { classes, exams, groups, marks, students, subjects } from "@/db/schema";
import { PASS_PERCENTAGE, emptyGradeBuckets, gradeFor, round } from "@/lib/grades";

export type MarkRow = {
  markId: number;
  studentId: number;
  studentName: string;
  rollNo: number;
  admissionNo: string;
  classId: number;
  className: string;
  section: string;
  groupCode: string | null;
  subjectId: number;
  subjectName: string;
  subjectCode: string;
  examId: number;
  examName: string;
  score: number | null;
  isAbsent: boolean;
  maxMarks: number;
};

export type MarkFilters = {
  schoolId: number;
  examId?: number;
  classId?: number;
  subjectId?: number;
  groupId?: number;
};

export async function loadMarkRows(filters: MarkFilters): Promise<MarkRow[]> {
  const conditions: SQL[] = [eq(marks.schoolId, filters.schoolId)];
  if (filters.examId) conditions.push(eq(marks.examId, filters.examId));
  if (filters.classId) conditions.push(eq(students.classId, filters.classId));
  if (filters.subjectId) conditions.push(eq(marks.subjectId, filters.subjectId));
  if (filters.groupId) conditions.push(eq(classes.groupId, filters.groupId));

  const rows = await db
    .select({
      markId: marks.id,
      studentId: students.id,
      studentName: students.name,
      rollNo: students.rollNo,
      admissionNo: students.admissionNo,
      classId: classes.id,
      className: classes.name,
      section: classes.section,
      groupCode: groups.code,
      subjectId: subjects.id,
      subjectName: subjects.name,
      subjectCode: subjects.code,
      examId: exams.id,
      examName: exams.name,
      score: marks.score,
      isAbsent: marks.isAbsent,
      maxMarks: subjects.maxMarks,
    })
    .from(marks)
    .innerJoin(students, eq(students.id, marks.studentId))
    .innerJoin(classes, eq(classes.id, students.classId))
    .innerJoin(subjects, eq(subjects.id, marks.subjectId))
    .innerJoin(exams, eq(exams.id, marks.examId))
    .leftJoin(groups, eq(groups.id, classes.groupId))
    .where(and(...conditions));

  return rows as MarkRow[];
}

export type Stats = {
  attempts: number;
  absent: number;
  average: number;
  highest: number;
  lowest: number;
  passCount: number;
  failCount: number;
  passRate: number;
  distinction: number;
  grades: Record<string, number>;
};

export function computeStats(rows: MarkRow[]): Stats {
  const scored = rows.filter((r) => !r.isAbsent && r.score !== null);
  const grades = emptyGradeBuckets();
  let total = 0;
  let highest = 0;
  let lowest = scored.length ? 100 : 0;
  let passCount = 0;
  let distinction = 0;

  for (const row of scored) {
    const pct = ((row.score ?? 0) / (row.maxMarks || 100)) * 100;
    total += pct;
    highest = Math.max(highest, pct);
    lowest = Math.min(lowest, pct);
    if (pct >= PASS_PERCENTAGE) passCount += 1;
    if (pct >= 75) distinction += 1;
    grades[gradeFor(pct).grade] += 1;
  }

  const attempts = scored.length;
  return {
    attempts,
    absent: rows.length - attempts,
    average: attempts ? round(total / attempts) : 0,
    highest: attempts ? round(highest) : 0,
    lowest: attempts ? round(lowest) : 0,
    passCount,
    failCount: attempts - passCount,
    passRate: attempts ? round((passCount / attempts) * 100) : 0,
    distinction,
    grades,
  };
}

export function groupBy<T, K extends string | number>(rows: T[], key: (row: T) => K): Map<K, T[]> {
  const map = new Map<K, T[]>();
  for (const row of rows) {
    const k = key(row);
    const bucket = map.get(k);
    if (bucket) bucket.push(row);
    else map.set(k, [row]);
  }
  return map;
}

export type StudentTotal = {
  studentId: number;
  studentName: string;
  admissionNo: string;
  rollNo: number;
  classId: number;
  classLabel: string;
  total: number;
  maxTotal: number;
  percentage: number;
  grade: string;
  subjectsCount: number;
  failedSubjects: number;
  rank: number;
};

export function studentTotals(rows: MarkRow[]): StudentTotal[] {
  const byStudent = groupBy(rows, (r) => r.studentId);
  const totals: StudentTotal[] = [];
  for (const [studentId, studentRows] of byStudent) {
    const scored = studentRows.filter((r) => !r.isAbsent && r.score !== null);
    const total = scored.reduce((sum, r) => sum + (r.score ?? 0), 0);
    const maxTotal = scored.reduce((sum, r) => sum + (r.maxMarks || 100), 0);
    const percentage = maxTotal ? round((total / maxTotal) * 100) : 0;
    const failedSubjects = scored.filter(
      (r) => ((r.score ?? 0) / (r.maxMarks || 100)) * 100 < PASS_PERCENTAGE,
    ).length;
    const first = studentRows[0];
    totals.push({
      studentId,
      studentName: first.studentName,
      admissionNo: first.admissionNo,
      rollNo: first.rollNo,
      classId: first.classId,
      classLabel: `${first.className} - ${first.section}`,
      total: round(total, 0),
      maxTotal,
      percentage,
      grade: gradeFor(percentage).grade,
      subjectsCount: scored.length,
      failedSubjects,
      rank: 0,
    });
  }
  totals.sort((a, b) => b.percentage - a.percentage);
  totals.forEach((t, i) => {
    t.rank = i + 1;
  });
  return totals;
}

import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { classes, exams, students, subjects, users } from "@/db/schema";
import {
  computeStats,
  groupBy,
  loadMarkRows,
  studentTotals,
  type MarkFilters,
  type MarkRow,
} from "@/lib/analytics";
import { GRADE_SCALE, PASS_PERCENTAGE, gradeFor, round } from "@/lib/grades";

async function countFor(
  table: "students" | "classes" | "subjects" | "exams" | "users",
  schoolId: number,
) {
  const map = { students, classes, subjects, exams, users } as const;
  const t = map[table];
  const [row] = await db
    .select({ value: sql<number>`count(*)::int` })
    .from(t)
    .where(eq(t.schoolId, schoolId));
  return row?.value ?? 0;
}

export async function overviewReport(schoolId: number, examId?: number) {
  const rows = await loadMarkRows({ schoolId, examId });
  const stats = computeStats(rows);

  const [studentCount, classCount, subjectCount, examCount, staffCount] = await Promise.all([
    countFor("students", schoolId),
    countFor("classes", schoolId),
    countFor("subjects", schoolId),
    countFor("exams", schoolId),
    countFor("users", schoolId),
  ]);

  const byClass = groupBy(rows, (r) => r.classId);
  const classComparison = [...byClass.entries()]
    .map(([classId, classRows]) => {
      const s = computeStats(classRows);
      const first = classRows[0];
      return {
        classId,
        label: `${first.className} - ${first.section}`,
        groupCode: first.groupCode,
        average: s.average,
        passRate: s.passRate,
        students: new Set(classRows.map((r) => r.studentId)).size,
      };
    })
    .sort((a, b) => b.average - a.average);

  const bySubject = groupBy(rows, (r) => r.subjectId);
  const subjectSnapshot = [...bySubject.entries()]
    .map(([subjectId, subjectRows]) => {
      const s = computeStats(subjectRows);
      const first = subjectRows[0];
      return {
        subjectId,
        name: first.subjectName,
        code: first.subjectCode,
        average: s.average,
        passRate: s.passRate,
        attempts: s.attempts,
      };
    })
    .sort((a, b) => b.average - a.average);

  const totals = studentTotals(rows);
  const gradeDistribution = GRADE_SCALE.map((g) => ({
    grade: g.grade,
    label: g.label,
    color: g.color,
    count: stats.grades[g.grade] ?? 0,
  }));

  const allExams = await db
    .select({ id: exams.id, name: exams.name, startDate: exams.startDate })
    .from(exams)
    .where(eq(exams.schoolId, schoolId))
    .orderBy(exams.startDate);
  const allRows = examId ? await loadMarkRows({ schoolId }) : rows;
  const byExam = groupBy(allRows, (r) => r.examId);
  const examTrend = allExams
    .filter((e) => byExam.has(e.id))
    .map((e) => {
      const s = computeStats(byExam.get(e.id) ?? []);
      return { examId: e.id, name: e.name, average: s.average, passRate: s.passRate };
    });

  return {
    kpis: {
      students: studentCount,
      classes: classCount,
      subjects: subjectCount,
      exams: examCount,
      staff: staffCount,
      average: stats.average,
      passRate: stats.passRate,
      distinctionRate: stats.attempts ? round((stats.distinction / stats.attempts) * 100) : 0,
      marksEntered: stats.attempts,
      absent: stats.absent,
    },
    classComparison,
    subjectSnapshot,
    gradeDistribution,
    examTrend,
    topStudents: totals.filter((t) => t.rank > 0).slice(0, 8),
    needsAttention: totals
      .filter((t) => t.percentage < 50 || t.failedSubjects > 0)
      .sort((a, b) => a.percentage - b.percentage)
      .slice(0, 8),
  };
}

export type SubjectReportRow = {
  subjectId: number;
  name: string;
  code: string;
  attempts: number;
  average: number;
  highest: number;
  lowest: number;
  passRate: number;
  failCount: number;
  distinction: number;
  absent: number;
  topper: { name: string; score: number; classLabel: string } | null;
  grades: Record<string, number>;
  classSplit: Array<{ classLabel: string; average: number; passRate: number }>;
};

export async function subjectReport(filters: MarkFilters) {
  const rows = await loadMarkRows(filters);
  const bySubject = groupBy(rows, (r) => r.subjectId);
  const list: SubjectReportRow[] = [...bySubject.entries()].map(([subjectId, subjectRows]) => {
    const s = computeStats(subjectRows);
    const first = subjectRows[0];
    const best = subjectRows
      .filter((r) => !r.isAbsent && r.score !== null)
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0];
    const byClass = groupBy(subjectRows, (r) => r.classId);
    return {
      subjectId,
      name: first.subjectName,
      code: first.subjectCode,
      attempts: s.attempts,
      average: s.average,
      highest: s.highest,
      lowest: s.lowest,
      passRate: s.passRate,
      failCount: s.failCount,
      distinction: s.distinction,
      absent: s.absent,
      topper: best
        ? {
            name: best.studentName,
            score: best.score ?? 0,
            classLabel: `${best.className} - ${best.section}`,
          }
        : null,
      grades: s.grades,
      classSplit: [...byClass.values()]
        .map((cRows) => {
          const cs = computeStats(cRows);
          return {
            classLabel: `${cRows[0].className} - ${cRows[0].section}`,
            average: cs.average,
            passRate: cs.passRate,
          };
        })
        .sort((a, b) => b.average - a.average),
    };
  });
  list.sort((a, b) => b.average - a.average);
  return { subjects: list, overall: computeStats(rows) };
}

export async function classReport(filters: MarkFilters) {
  const rows = await loadMarkRows(filters);
  const byClass = groupBy(rows, (r) => r.classId);
  const list = [...byClass.entries()].map(([classId, classRows]) => {
    const s = computeStats(classRows);
    const totals = studentTotals(classRows);
    const bySubject = groupBy(classRows, (r) => r.subjectId);
    const subjectStats = [...bySubject.values()]
      .map((sRows) => {
        const ss = computeStats(sRows);
        return {
          subjectId: sRows[0].subjectId,
          name: sRows[0].subjectName,
          code: sRows[0].subjectCode,
          average: ss.average,
          passRate: ss.passRate,
        };
      })
      .sort((a, b) => b.average - a.average);
    const first = classRows[0];
    return {
      classId,
      className: first.className,
      section: first.section,
      label: `${first.className} - ${first.section}`,
      groupCode: first.groupCode,
      students: totals.length,
      average: s.average,
      passRate: s.passRate,
      highest: s.highest,
      lowest: s.lowest,
      distinction: s.distinction,
      failCount: totals.filter((t) => t.failedSubjects > 0).length,
      grades: s.grades,
      toppers: totals.filter((t) => t.rank > 0).slice(0, 3),
      strongest: subjectStats[0] ?? null,
      weakest: subjectStats[subjectStats.length - 1] ?? null,
      subjectStats,
    };
  });
  list.sort((a, b) => b.average - a.average);
  return { classes: list, overall: computeStats(rows) };
}

export async function sectionReport(filters: MarkFilters & { grade?: string }) {
  const all = await loadMarkRows(filters);
  const rows = filters.grade ? all.filter((r) => r.className === filters.grade) : all;

  const byGrade = groupBy(rows, (r) => r.className);
  const grades = [...byGrade.entries()]
    .map(([gradeName, gradeRows]) => {
      const gs = computeStats(gradeRows);
      const bySection = groupBy(gradeRows, (r) => r.section);
      const sections = [...bySection.entries()]
        .map(([section, sectionRows]) => {
          const s = computeStats(sectionRows);
          const totals = studentTotals(sectionRows);
          return {
            section,
            classId: sectionRows[0].classId,
            groupCode: sectionRows[0].groupCode,
            students: totals.length,
            average: s.average,
            passRate: s.passRate,
            highest: s.highest,
            distinction: s.distinction,
            failCount: totals.filter((t) => t.failedSubjects > 0).length,
            topper: totals.find((t) => t.rank > 0) ?? null,
            grades: s.grades,
          };
        })
        .sort((a, b) => a.section.localeCompare(b.section));
      return {
        grade: gradeName,
        average: gs.average,
        passRate: gs.passRate,
        students: new Set(gradeRows.map((r) => r.studentId)).size,
        sections,
        spread: sections.length
          ? round(
              Math.max(...sections.map((s) => s.average)) - Math.min(...sections.map((s) => s.average)),
            )
          : 0,
      };
    })
    .sort((a, b) => a.grade.localeCompare(b.grade, undefined, { numeric: true }));

  return { grades, overall: computeStats(rows) };
}

export async function studentReport(studentId: number, schoolId: number) {
  const [profile] = await db
    .select({
      id: students.id,
      name: students.name,
      admissionNo: students.admissionNo,
      rollNo: students.rollNo,
      gender: students.gender,
      guardianName: students.guardianName,
      contact: students.contact,
      classId: students.classId,
      className: classes.name,
      section: classes.section,
    })
    .from(students)
    .innerJoin(classes, eq(classes.id, students.classId))
    .where(and(eq(students.id, studentId), eq(students.schoolId, schoolId)))
    .limit(1);

  if (!profile) return null;

  const classRows = (await loadMarkRows({ schoolId, classId: profile.classId })) as MarkRow[];
  const rows = classRows.filter((r) => r.studentId === studentId);

  const byExam = groupBy(rows, (r) => r.examId);
  const examCards = [...byExam.entries()].map(([examId, examRows]) => {
    const scored = examRows.filter((r) => !r.isAbsent && r.score !== null);
    const total = scored.reduce((sum, r) => sum + (r.score ?? 0), 0);
    const maxTotal = scored.reduce((sum, r) => sum + (r.maxMarks || 100), 0);
    const percentage = maxTotal ? round((total / maxTotal) * 100) : 0;
    const classExamTotals = studentTotals(classRows.filter((r) => r.examId === examId));
    const studentEntry = classExamTotals.find((t) => t.studentId === studentId);
    const rank = studentEntry?.rank && studentEntry.rank > 0 ? studentEntry.rank : null;
    return {
      examId,
      examName: examRows[0].examName,
      total: round(total, 0),
      maxTotal,
      percentage,
      grade: gradeFor(percentage).grade,
      rank: rank || null,
      classSize: classExamTotals.length,
      subjects: examRows
        .map((r) => ({
          subjectId: r.subjectId,
          name: r.subjectName,
          code: r.subjectCode,
          score: r.score,
          maxMarks: r.maxMarks,
          isAbsent: r.isAbsent,
          percentage: r.score === null ? 0 : round(((r.score ?? 0) / (r.maxMarks || 100)) * 100),
          grade: r.isAbsent ? "AB" : gradeFor(((r.score ?? 0) / (r.maxMarks || 100)) * 100).grade,
          passed: !r.isAbsent && ((r.score ?? 0) / (r.maxMarks || 100)) * 100 >= PASS_PERCENTAGE,
        }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    };
  });

  const overall = computeStats(rows);
  const bySubject = groupBy(rows, (r) => r.subjectId);
  const subjectTrend = [...bySubject.values()].map((sRows) => ({
    name: sRows[0].subjectName,
    points: sRows.map((r) => ({
      exam: r.examName,
      value: r.score === null ? 0 : round(((r.score ?? 0) / (r.maxMarks || 100)) * 100),
    })),
    average: computeStats(sRows).average,
  }));

  return { profile, examCards, overall, subjectTrend };
}

export async function teacherOptions(schoolId: number) {
  return db
    .select({ id: users.id, name: users.name, role: users.role })
    .from(users)
    .where(eq(users.schoolId, schoolId))
    .orderBy(users.name);
}

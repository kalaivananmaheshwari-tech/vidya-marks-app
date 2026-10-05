import {assertApprovedScoring} from "@/lib/scoring-policy";
import { and, eq, isNull, sql } from "drizzle-orm";
import { db, type DbExecutor } from "@/db";
import { classes, exams, students, subjects, users } from "@/db/schema";
import { isAdmin, type SchoolAuthContext } from "@/lib/auth";
import { classScopeCondition, subjectScopeCondition, assertClassAccess } from "@/lib/authorization";
import { markState, resultForMark } from "@/lib/domain/marks";
import {
  computeStats,
  groupBy,
  loadMarkRows,
  studentTotals,
  type MarkFilters,
  type MarkRow,
} from "@/lib/analytics";
import { GRADE_SCALE, gradeFor, round } from "@/lib/grades";

async function countFor(table: "students" | "classes" | "subjects" | "exams" | "users", auth: SchoolAuthContext, executor: DbExecutor) {
  const schoolId=auth.school.id; const teacher=!isAdmin(auth.user);
  const scope={
    students: sql`archived_at is null and exists(select 1 from student_enrollments e where e.student_id=students.id and e.school_id=${schoolId} and e.is_active) and ${teacher?sql`exists(select 1 from teacher_subject_assignments a where a.school_id=${schoolId} and a.teacher_id=${auth.user.id} and a.class_id=students.class_id)`:sql`true`}`,
    classes: and(isNull(classes.archivedAt),classScopeCondition(auth))!,
    subjects: and(isNull(subjects.archivedAt),subjectScopeCondition(auth))!,
    exams: isNull(exams.archivedAt),
    users: and(eq(users.isActive,true),teacher?eq(users.id,auth.user.id):undefined)!,
  };
  const t={students,classes,subjects,exams,users}[table];
  const [row]=await executor.select({value:sql<number>`count(*)::int`}).from(t).where(and(eq(t.schoolId,schoolId),scope[table]));
  return row?.value ?? 0;
}
export async function overviewReport(auth: SchoolAuthContext, examId?: number, executor: DbExecutor=db) {
  const schoolId=auth.school.id; const teacherId=isAdmin(auth.user)?undefined:auth.user.id;
  const rows=await loadMarkRows({schoolId,examId,teacherId},executor); const stats=computeStats(rows);
  const studentCount=await countFor("students",auth,executor),classCount=await countFor("classes",auth,executor),subjectCount=await countFor("subjects",auth,executor),examCount=await countFor("exams",auth,executor),staffCount=await countFor("users",auth,executor);

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

  const allExams = await executor
    .select({ id: exams.id, name: exams.name, startDate: exams.startDate })
    .from(exams)
    .where(eq(exams.schoolId, schoolId))
    .orderBy(exams.startDate);
  const allRows = examId ? await loadMarkRows({ schoolId, teacherId },executor) : rows;
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
      marksEntered: stats.attempts + stats.absent + stats.exemption,
      exemption: stats.exemption,
      pending: stats.pending,
      absent: stats.absent,
    },
    classComparison,
    subjectSnapshot,
    gradeDistribution,
    examTrend,
    topStudents: totals.filter((t) => t.rank > 0).slice(0, 8),
    needsAttention: totals
      .filter((t) => (t.percentage !== null && t.percentage < 50) || t.failedSubjects > 0)
      .sort((a, b) => (a.percentage ?? Infinity) - (b.percentage ?? Infinity))
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

export async function subjectReport(filters: MarkFilters, executor: DbExecutor=db) {
  const rows = await loadMarkRows(filters,executor);
  const bySubject = groupBy(rows, (r) => r.subjectId);
  const list: SubjectReportRow[] = [...bySubject.entries()].map(([subjectId, subjectRows]) => {
    const s = computeStats(subjectRows);
    const first = subjectRows[0];
    const best = subjectRows
      .filter((r) => markState(r) === "NUMERIC")
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
            score: best.score!,
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

export async function classReport(filters: MarkFilters, executor: DbExecutor=db) {
  const rows = await loadMarkRows(filters,executor);
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

export async function sectionReport(filters: MarkFilters & { grade?: string }, executor: DbExecutor=db) {
  const all = await loadMarkRows(filters,executor);
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

export async function studentReport(studentId: number, auth: SchoolAuthContext, executor: DbExecutor=db) {
  const schoolId=auth.school.id;
  const [profile]=await executor.select({id:students.id,uuid:students.uuid,name:students.name,admissionNo:students.admissionNo,rollNo:students.rollNo,gender:students.gender,guardianName:students.guardianName,contact:students.contact,classId:students.classId,className:classes.name,section:classes.section}).from(students)
    .innerJoin(classes,and(eq(classes.id,students.classId),eq(classes.schoolId,students.schoolId))).where(and(eq(students.id,studentId),eq(students.schoolId,schoolId))).limit(1);
  if(!profile) return null;
  if(!isAdmin(auth.user)) await assertClassAccess(auth,profile.classId,executor);
  assertApprovedScoring(profile.className);
  const classRows=await loadMarkRows({schoolId,...(!isAdmin(auth.user)?{teacherId:auth.user.id}:{})},executor);
  const rows=classRows.filter((r)=>r.studentId===studentId);
  const examCards=[...groupBy(rows,(r)=>`${r.examId}:${r.classId}`).values()].map((examRows)=>{
    const first=examRows[0]; const peers=studentTotals(classRows.filter((r)=>r.examId===first.examId && r.classId===first.classId));
    const entry=peers.find((t)=>t.studentId===studentId);
    return {examId:first.examId,examName:first.examName,academicYear:first.academicYear ?? "",classId:first.classId,classLabel:`${first.className} - ${first.section}`,total:entry?.total ?? null,maxTotal:entry?.maxTotal ?? 0,percentage:entry?.percentage ?? null,grade:entry?.grade ?? "-",result:entry?.result ?? "Pending",rank:entry?.rank || null,classSize:peers.length,
      subjects:examRows.map((r)=>{ const state=markState(r); const pct=state==="NUMERIC"?round(r.score!/r.maxMarks*100):null;
        return {subjectId:r.subjectId,name:r.subjectName,code:r.subjectCode,score:state==="NUMERIC"?r.score:null,maxMarks:r.maxMarks,isAbsent:state==="AB",isExempt:state==="EXEMPT",status:state,percentage:pct,grade:pct!==null?gradeFor(pct).grade:state==="EXEMPT"?"Exemption":state==="AB"?"AB":"-",passed:resultForMark(r)==="Pass"}; }).sort((a,b)=>a.name.localeCompare(b.name)),
    };
  });
  const subjectTrend=[...groupBy(rows,(r)=>r.subjectName).values()].map((set)=>({name:set[0].subjectName,points:set.map((r)=>({exam:r.examName,value:markState(r)==="NUMERIC"?round(r.score!/r.maxMarks*100):null})),average:computeStats(set).average}));
  return {school:auth.school,profile:{...profile,...(!isAdmin(auth.user)?{guardianName:null,contact:null}:{})},examCards,overall:computeStats(rows),subjectTrend,scope:isAdmin(auth.user)?"School administrator":"Assigned subjects only"};
}

export async function teacherOptions(schoolId: number) {
  return db
    .select({ id: users.id, name: users.name, role: users.role })
    .from(users)
    .where(eq(users.schoolId, schoolId))
    .orderBy(users.name);
}

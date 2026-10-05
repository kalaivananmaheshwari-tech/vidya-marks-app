import {approvedScoringCondition} from "@/lib/scoring-policy";
import {markValues} from "@/db/mark-values";
import {sumMarks} from "@/lib/domain/decimal-sum";
import { and, eq, sql, type SQL } from "drizzle-orm";
import { db, type DbExecutor } from "@/db";
import { classes, exams, groups, marks, students, subjects, studentEnrollments, classSubjects } from "@/db/schema";
import { emptyGradeBuckets, gradeFor, round } from "@/lib/grades";
import { allRequiredPassed, competitionRanks, markState, resultForMark, type ResultMark, type ResultState } from "@/lib/domain/marks";

export type MarkRow = {
  markId: number; studentId: number; studentName: string; rollNo: number; admissionNo: string;
  classId: number; className: string; section: string; groupCode: string | null;
  subjectId: number; subjectName: string; subjectCode: string; examId: number; examName: string; academicYear?:string;
  score: number | null; isAbsent: boolean; maxMarks: number;
  isExempt?: boolean; status?: string; studentUuid?: string; enrollmentId?: string;
  requiredSubjectIds?: number[]; isRequired?: boolean;
};
export type MarkFilters = { schoolId: number; examId?: number; classId?: number; subjectId?: number; groupId?: number; teacherId?: number };

export async function loadMarkRows(filters: MarkFilters, executor: DbExecutor = db): Promise<MarkRow[]> {
  const conditions: SQL[] = [eq(marks.schoolId, filters.schoolId),approvedScoringCondition(classes.name)];
  if (filters.examId) conditions.push(eq(marks.examId, filters.examId));
  if (filters.classId) conditions.push(eq(studentEnrollments.classId, filters.classId));
  if (filters.subjectId) conditions.push(eq(marks.subjectId, filters.subjectId));
  if (filters.groupId) conditions.push(eq(classes.groupId, filters.groupId));
  if (filters.teacherId) conditions.push(eq(marks.enteredById,filters.teacherId),sql`exists(select 1 from teacher_subject_assignments a where a.school_id=${filters.schoolId} and a.teacher_id=${filters.teacherId} and a.class_subject_id=${marks.classSubjectId})`);
  const rows = await executor.select({
    markId: marks.id, studentId: students.id, studentUuid: students.uuid, enrollmentId: studentEnrollments.id,
    studentName: students.name, rollNo: studentEnrollments.examNumber, admissionNo: students.admissionNo,
    classId: classes.id, className: classes.name, section: classes.section, groupCode: groups.code,
    subjectId: subjects.id, subjectName: subjects.name, subjectCode: subjects.code,
    examId: exams.id, examName: exams.name,academicYear:exams.academicYear, score: markValues.score, isAbsent: marks.isAbsent, isExempt: marks.isExempt,
    status: marks.status, maxMarks: sql<number>`coalesce((${marks.allocationSnapshot}->>'maxMarks')::integer,100)`,
    isRequired: classSubjects.isRequired,
    requiredSubjectIds: sql<number[]>`coalesce((select array_agg(cs.subject_id order by cs.subject_id) from class_subjects cs where cs.school_id=${marks.schoolId} and cs.class_id=${classes.id} and cs.is_required),'{}'::integer[])`,
  }).from(marks)
    .innerJoin(studentEnrollments, and(eq(studentEnrollments.id, marks.enrollmentId), eq(studentEnrollments.schoolId, marks.schoolId), eq(studentEnrollments.studentUuid, marks.studentUuid)))
    .innerJoin(students, and(eq(students.id, marks.studentId), eq(students.uuid, marks.studentUuid), eq(students.schoolId, marks.schoolId)))
    .innerJoin(classes, and(eq(classes.id, studentEnrollments.classId), eq(classes.schoolId, marks.schoolId)))
    .innerJoin(classSubjects, and(eq(classSubjects.id, marks.classSubjectId), eq(classSubjects.classSectionId, studentEnrollments.classSectionId), eq(classSubjects.schoolId, marks.schoolId)))
    .innerJoin(subjects, and(eq(subjects.id, marks.subjectId), eq(subjects.schoolId, marks.schoolId)))
    .innerJoin(exams, and(eq(exams.id, marks.examId), eq(exams.schoolId, marks.schoolId)))
    .leftJoin(groups, and(eq(groups.id, classes.groupId), eq(groups.schoolId, classes.schoolId)))
    .where(and(...conditions));
  return rows.map((r) => ({ ...r, score: markState(r) === "NUMERIC" ? r.score : null }));
}
export type Stats = { attempts: number; absent: number; exemption: number; pending: number; average: number; highest: number; lowest: number; passCount: number; failCount: number; passRate: number; distinction: number; grades: Record<string, number> };
export function computeStats(rows: MarkRow[]): Stats {
  const scored = rows.filter((r) => markState(r) === "NUMERIC");
  const grades = emptyGradeBuckets(); let total = 0; let highest = 0; let lowest = Infinity; let passCount = 0; let distinction = 0;
  for (const row of scored) {
    const pct = (row.score! / row.maxMarks) * 100; total += pct; highest = Math.max(highest,pct); lowest = Math.min(lowest,pct);
    if (resultForMark(row) === "Pass") passCount++; if (pct >= 75) distinction++; grades[gradeFor(pct).grade]++;
  }
  return { attempts: scored.length, absent: rows.filter((r) => markState(r) === "AB").length, exemption: rows.filter((r) => markState(r) === "EXEMPT").length, pending: rows.filter((r) => markState(r) === "PENDING").length,
    average: scored.length ? round(total/scored.length) : 0, highest: scored.length ? round(highest) : 0, lowest: scored.length ? round(lowest) : 0,
    passCount, failCount: scored.length-passCount, passRate: scored.length ? round(passCount/scored.length*100) : 0, distinction, grades };
}
export function groupBy<T, K extends string | number>(rows: T[], key: (row: T) => K): Map<K,T[]> {
  const map = new Map<K,T[]>(); for (const row of rows) { const k=key(row); const bucket=map.get(k); if(bucket) bucket.push(row); else map.set(k,[row]); } return map;
}
export type StudentTotal = {
  studentId: number; studentName: string; admissionNo: string; rollNo: number; classId: number; classLabel: string;
  examId: number; total: number | null; maxTotal: number; percentage: number | null; grade: string; subjectsCount: number;
  failedSubjects: number; rank: number; result: ResultState;
};
/** Legacy UI compatibility: rank 0 is rendered blank. Rank positions exclude ineligible items. */
export function assignCompetitionRanks<T extends { rank: number; value: number; failedSubjects?: number; eligible?: boolean }>(items: T[]) {
  const ranks = competitionRanks(items, (i)=>i.value, (i)=>i.eligible !== false && !(i.failedSubjects && i.failedSubjects>0));
  for(const item of items) item.rank=ranks.get(item) ?? 0; items.sort((a,b)=>b.value-a.value);
}
export function studentTotals(rows: MarkRow[]): StudentTotal[] {
  const groups = groupBy(rows,(r)=>`${r.examId}:${r.classId}:${r.studentId}`); const totals: StudentTotal[]=[];
  const classRequired = groupBy(rows,(r)=>`${r.examId}:${r.classId}`);
  for(const studentRows of groups.values()) {
    const first=studentRows[0];
    const required = first.requiredSubjectIds ?? [...new Set((classRequired.get(`${first.examId}:${first.classId}`) ?? []).filter((r)=>r.isRequired !== false).map((r)=>r.subjectId))];
    const markMap = new Map<number,ResultMark>(studentRows.map((r)=>[r.subjectId,r]));
    const numeric = studentRows.filter((r)=>required.includes(r.subjectId) && markState(r)==="NUMERIC");
    const completeNumeric = required.length>0 && required.every((id)=>markState(markMap.get(id))==="NUMERIC");
    const total = completeNumeric && numeric.length ? sumMarks(numeric.map((r)=>r.score!)) : null;
    const failedSubjects = required.filter((id)=>resultForMark(markMap.get(id))==="Fail").length;
    const allPass = allRequiredPassed(required,markMap);
    const allNumeric = required.length>0 && required.every((id)=>markState(markMap.get(id))==="NUMERIC");
    const maxTotal=required.reduce((sum,id)=>sum+(studentRows.find((r)=>r.subjectId===id)?.maxMarks ?? 100),0);
    const percentage=allNumeric && total!==null && maxTotal ? round(total/maxTotal*100):null;
    const result: ResultState = allPass ? "Pass" : failedSubjects ? "Fail" : required.some((id)=>markState(markMap.get(id))==="PENDING") ? "Pending" : required.some((id)=>markState(markMap.get(id))==="AB") ? "AB" : "Exemption";
    totals.push({studentId:first.studentId,studentName:first.studentName,admissionNo:first.admissionNo,rollNo:first.rollNo,classId:first.classId,classLabel:`${first.className} - ${first.section}`,examId:first.examId,total,maxTotal,percentage,grade:percentage===null?"-":gradeFor(percentage).grade,subjectsCount:numeric.length,failedSubjects,rank:0,result});
  }
  // Ranks are separate for each class/section/exam, never across different examinations.
  for(const set of groupBy(totals,(t)=>`${t.examId}:${t.classId}`).values()) {
    const ranks=competitionRanks(set,(t)=>t.total!, (t)=>t.result==="Pass" && t.total!==null);
    for(const t of set) t.rank=ranks.get(t) ?? 0;
  }
  return totals.sort((a,b)=>(b.total ?? -Infinity)-(a.total ?? -Infinity));
}

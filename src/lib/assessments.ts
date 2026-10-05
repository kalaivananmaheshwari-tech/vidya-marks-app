import {markValues} from "@/db/mark-values";
import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { db, type DbExecutor } from "@/db";
import { marks, students, studentEnrollments, groups, type ClassRow } from "@/db/schema";
import { subjectsForClass } from "@/lib/queries";

export type AssessmentData = Awaited<ReturnType<typeof classAssessment>>;
/** Only persisted enrollment and class-subject identities determine the roster. */
export async function classAssessment(classRow: ClassRow, examId: number, executor: DbExecutor = db) {
  const schoolId=classRow.schoolId;
  const {list}=await subjectsForClass(classRow.id,schoolId,executor);
  const roster=await executor.select({id:students.id,uuid:students.uuid,enrollmentId:studentEnrollments.id,rollNo:studentEnrollments.examNumber,name:students.name,admissionNo:students.admissionNo,emisId:students.emisId,gender:students.gender,medium:students.medium}).from(studentEnrollments)
    .innerJoin(students,and(eq(students.id,studentEnrollments.studentId),eq(students.uuid,studentEnrollments.studentUuid),eq(students.schoolId,studentEnrollments.schoolId)))
    .where(and(eq(studentEnrollments.schoolId,schoolId),eq(studentEnrollments.classId,classRow.id),eq(studentEnrollments.isActive,true),isNull(students.archivedAt))).orderBy(asc(studentEnrollments.examNumber));
  const recorded=roster.length && list.length ? await executor.select({id:marks.id,studentId:marks.studentId,studentUuid:marks.studentUuid,enrollmentId:marks.enrollmentId,subjectId:marks.subjectId,score:markValues.score,status:marks.status,isAbsent:marks.isAbsent,isExempt:marks.isExempt,theoryScore:markValues.theoryScore,practicalScore:markValues.practicalScore,internalScore:markValues.internalScore,enteredById:marks.enteredById,allocationSnapshot:marks.allocationSnapshot}).from(marks)
    .where(and(eq(marks.schoolId,schoolId),eq(marks.examId,examId),inArray(marks.enrollmentId,roster.map((s)=>s.enrollmentId)),inArray(marks.classSubjectId,list.map((s)=>s.classSubjectId)))):[];
  const [group]=classRow.groupId?await executor.select().from(groups).where(and(eq(groups.id,classRow.groupId),eq(groups.schoolId,schoolId))):[];
  return {class:{...classRow,groupCode:group?.code ?? null,groupName:group?.name ?? null,stream:group?.stream ?? null},subjects:list,students:roster,marks:recorded};
}

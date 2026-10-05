import {normalizedMark} from "@/db/mark-values";
import {and,asc,desc,eq,isNull,sql} from "drizzle-orm";
import {db} from "@/db";
import {classes,exams,groups,marks,students,studentEnrollments} from "@/db/schema";
import type {SchoolAuthContext} from "@/lib/auth";
import {assertClassAccess,assertExamAccess} from "@/lib/authorization";
import {subjectsForClass} from "@/lib/queries";
import {studentReport} from "@/lib/reports";
import {classNumber,markState} from "@/lib/domain/marks";
import {allocationReviewRequired} from "@/lib/domain/legacy-allocations";
import type {Allocation} from "@/lib/domain/marks";
import {HttpError} from "@/lib/http";
export async function studentEntryView(auth:SchoolAuthContext,classId?:number,examId?:number,studentId?:number){
  return db.transaction(async(tx)=>{
    const classRows=await tx.select({id:classes.id,name:classes.name,section:classes.section,groupId:classes.groupId,groupCode:groups.code,groupName:groups.name,stream:groups.stream,academicYear:classes.academicYear,academicYearId:classes.academicYearId}).from(classes).leftJoin(groups,and(eq(groups.id,classes.groupId),eq(groups.schoolId,classes.schoolId))).where(and(eq(classes.schoolId,auth.school.id),isNull(classes.archivedAt))).orderBy(asc(classes.name),asc(classes.section));
    if(classId)await assertClassAccess(auth,classId,tx);const cls=classRows.find((c)=>c.id===classId);
    const exam=examId?await assertExamAccess(auth,examId,tx):undefined;
    if(cls && exam && cls.academicYearId!==exam.academicYearId)throw new HttpError("Class and exam must belong to the same academic year.",400,"INVALID_ACADEMIC_YEAR");
    const examRows=await tx.select().from(exams).where(and(eq(exams.schoolId,auth.school.id),isNull(exams.archivedAt),cls?eq(exams.academicYearId,cls.academicYearId!):undefined)).orderBy(sql`${exams.startDate} desc nulls last`,desc(exams.id));
    const subjectList=classId?(await subjectsForClass(classId,auth.school.id,tx)).list:[];
    const studentList=classId?await tx.select({id:students.id,uuid:students.uuid,enrollmentId:studentEnrollments.id,rollNo:studentEnrollments.examNumber,admissionNo:students.admissionNo,emisId:students.emisId,name:students.name,gender:students.gender,guardianName:students.guardianName,contact:students.contact,dob:students.dob,medium:students.medium}).from(studentEnrollments)
      .innerJoin(students,and(eq(students.id,studentEnrollments.studentId),eq(students.uuid,studentEnrollments.studentUuid),eq(students.schoolId,studentEnrollments.schoolId))).where(and(eq(studentEnrollments.schoolId,auth.school.id),eq(studentEnrollments.classId,classId),eq(studentEnrollments.isActive,true),isNull(students.archivedAt))).orderBy(asc(studentEnrollments.examNumber)):[];
    const selectedStudent=studentList.find((s)=>s.id===studentId) ?? null;
    if(studentId && !selectedStudent)throw new HttpError("Student is outside this active class and school scope.",403,"INVALID_SCHOOL_SCOPE");
    const current=selectedStudent && exam?await tx.select().from(marks).where(and(eq(marks.schoolId,auth.school.id),eq(marks.enrollmentId,selectedStudent.enrollmentId),eq(marks.examId,exam.id))):[];
    const currentExamMarks=Object.fromEntries(current.map(normalizedMark).filter((m)=>subjectList.some((s)=>s.classSubjectId===m.classSubjectId)).map((m)=>[m.subjectId,{theoryScore:markState(m)==="NUMERIC"?m.theoryScore:null,practicalScore:markState(m)==="NUMERIC"?m.practicalScore:null,internalScore:markState(m)==="NUMERIC"?m.internalScore:null,score:markState(m)==="NUMERIC"?m.score:null,isAbsent:markState(m)==="AB",isExempt:markState(m)==="EXEMPT",status:markState(m),allocationSnapshot:m.allocationSnapshot,allocationReviewRequired:allocationReviewRequired(m,subjectList.find((s)=>s.classSubjectId===m.classSubjectId) as Allocation)}]));
    const history=selectedStudent?await studentReport(selectedStudent.id,auth,tx):null;
    return {classes:classRows.map((c)=>({...c,isHsc:(classNumber(c.name) ?? 0)>=11})),exams:examRows,selectedClass:cls?{...cls,isHsc:(classNumber(cls.name) ?? 0)>=11}:null,subjects:subjectList,students:studentList,selectedStudent,currentExamMarks,previousExams:history?.examCards ?? [],examPublished:exam?.isPublished ?? false,nextExamNumber:studentList.length?Math.max(...studentList.map((s)=>s.rollNo))+1:1};
  },{isolationLevel:"repeatable read",accessMode:"read only"});
}

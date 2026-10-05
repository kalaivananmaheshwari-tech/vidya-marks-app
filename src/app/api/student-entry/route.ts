import {z} from "zod";
import {and,eq} from "drizzle-orm";
import {db} from "@/db";
import {exams,classes} from "@/db/schema";
import {handleError,HttpError,idSchema,json,numParam,readJson,requireAdmin} from "@/lib/api";
import {studentSchema,saveStudentInTransaction} from "@/lib/student-service";
import {markInputSchema} from "@/lib/domain/marks";
import {saveMarksInTransaction} from "@/lib/mark-entry";
import {assertExamAccess} from "@/lib/authorization";
import {studentEntryView} from "@/lib/student-entry-view";
export const dynamic="force-dynamic";
export async function GET(request:Request){try{const auth=await requireAdmin();const q=new URL(request.url).searchParams;return json(await studentEntryView(auth,numParam(q.get("classId")),numParam(q.get("examId")),numParam(q.get("studentId"))));}catch(e){return handleError(e);}}
const entryInput=studentSchema.extend({examId:idSchema.nullable().optional(),marks:z.array(markInputSchema.extend({subjectId:idSchema}).strict()).max(50).optional()}).strict();
export async function POST(request:Request){try{
  const auth=await requireAdmin();const body=await readJson(request,entryInput);
  const result=await db.transaction(async(tx)=>{
    if(body.examId){await tx.select({id:exams.id}).from(exams).where(and(eq(exams.id,body.examId),eq(exams.schoolId,auth.school.id))).for("update");const exam=await assertExamAccess(auth,body.examId,tx);const [cls]=await tx.select().from(classes).where(and(eq(classes.id,body.classId),eq(classes.schoolId,auth.school.id)));if(!cls)throw new HttpError("Class is outside this school scope.",403,"INVALID_SCHOOL_SCOPE");if(cls.academicYearId!==exam.academicYearId)throw new HttpError("Class and exam must belong to the same academic year.",400,"INVALID_ACADEMIC_YEAR");}
    const {examId,marks:entries,...details}=body;const saved=await saveStudentInTransaction(tx,auth,details);let savedMarksCount=0;
    if(entries?.length && !examId)throw new HttpError("An examination is required to save marks.");
    const seen=new Set<number>();for(const entry of entries ?? []){if(seen.has(entry.subjectId))throw new HttpError("Duplicate subject in this entry.");seen.add(entry.subjectId);const {subjectId,...input}=entry;const outcome=await saveMarksInTransaction(tx,auth,{classId:body.classId,examId:examId!,subjectId,entries:[{enrollmentId:saved.student.enrollmentId,studentUuid:saved.student.uuid,...input}]});savedMarksCount+=outcome.saved;}
    return {student:saved.student,savedMarksCount};
  });return json(result);
}catch(e){return handleError(e);}}

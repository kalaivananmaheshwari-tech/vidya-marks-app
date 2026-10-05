import {beforeAll,beforeEach,afterAll,describe,it,expect} from "vitest";
import {and,eq} from "drizzle-orm";
import {db,closeDatabase} from "@/db";
import {migrateDatabase} from "@/db/migrate";
import {classes,subjects,classSubjects,markAllocations,marks,examPublications,exams} from "@/db/schema";
import {schoolFixture} from "./fixtures";
import {saveMarkBatch,markRoster,markMonitoring} from "@/lib/mark-entry";
import {configureMappings} from "@/lib/mapping-service";
import {loadMarkRows} from "@/lib/analytics";
import {officialReport} from "@/lib/official-reports";
import {studentReport} from "@/lib/reports";
import {saveStudent} from "@/lib/student-service";
import {syncClassRelations} from "@/lib/relations";
import {classAssessment} from "@/lib/assessments";
import {averageByStudent} from "@/lib/counts";
let f:Awaited<ReturnType<typeof schoolFixture>>;
beforeAll(async()=>{await migrateDatabase();});beforeEach(async()=>{f=await schoolFixture();});afterAll(closeDatabase);
const options=()=>({classId:f.a.cls.id,examId:f.exam.id,mode:"consolidated" as const});
async function write(index:number,values:Array<number|"AB"|"EXEMPT"|null>,admin=false){await saveMarkBatch(admin?f.admin:index===0?f.teacherA:f.teacherB,{classId:f.a.cls.id,examId:f.exam.id,subjectId:f.a.subjects[index].id,entries:values.map((v,i)=>({enrollmentId:i?f.student2.enrollmentId:f.student1.enrollmentId,...(typeof v==="number"?{score:v}:v===null?{score:null}:{status:v})}))});}
describe("v3 confirmed gap regressions",()=>{
  it("reassignment never exposes another teacher's scores through roster, subject report, analytics or student average",async()=>{
    await write(0,[88,77]);await configureMappings(f.admin,{classId:f.b.cls.id,assignments:[{id:f.b.subjects[0].id,hasPractical:false,teacherId:f.teacherA.user.id}]});await configureMappings(f.admin,{classId:f.a.cls.id,assignments:[{id:f.a.subjects[0].id,hasPractical:false,teacherId:f.teacherB.user.id}]});
    await expect(markRoster(f.teacherB,f.a.cls.id,f.exam.id,f.a.subjects[0].id)).rejects.toMatchObject({status:403,code:"FORBIDDEN_MARK_OWNER"});await expect(officialReport(f.teacherB,{...options(),mode:"subject",subjectId:f.a.subjects[0].id})).rejects.toMatchObject({status:403,code:"FORBIDDEN_MARK_OWNER"});expect(await loadMarkRows({schoolId:f.school.id,classId:f.a.cls.id,teacherId:f.teacherB.user.id})).toEqual([]);expect((await averageByStudent(f.school.id,f.teacherB.user.id)).has(f.student1.id)).toBe(false);expect((await markMonitoring(f.admin,f.exam.id,f.a.cls.id)).find((r)=>r.subjectId===f.a.subjects[0].id)).toMatchObject({entered:0,pending:2,status:"Pending"});
    const before=await db.select().from(marks).where(eq(marks.schoolId,f.school.id));await expect(saveMarkBatch(f.teacherB,{classId:f.a.cls.id,examId:f.exam.id,subjectId:f.a.subjects[0].id,entries:[{enrollmentId:f.student1.enrollmentId,score:99}]})).rejects.toMatchObject({status:403});expect(await db.select().from(marks).where(eq(marks.schoolId,f.school.id))).toEqual(before);
  });
  it("admin entries do not impersonate completion by a mapped subject teacher",async()=>{
    for(let i=0;i<3;i++)await write(i,[60,60],true);const rows=await markMonitoring(f.admin,f.exam.id,f.a.cls.id);expect(rows.every((r)=>r.entered===0 && r.pending===2 && r.status==="Pending")).toBe(true);await expect(officialReport(f.teacherA,options())).rejects.toMatchObject({status:409,code:"INCOMPLETE_MARK_ENTRY"});
  });
  it("retained published snapshots cannot claim mapped-teacher completion using administrator-owned grades",async()=>{
    for(let i=0;i<3;i++)await write(i,[60,60],true);const data=await classAssessment(f.a.cls,f.exam.id,db);await db.insert(examPublications).values({schoolId:f.school.id,examId:f.exam.id,classId:f.a.cls.id,generation:1,data,schoolHeader:f.school,publishedBy:f.admin.user.id});await db.update(exams).set({isPublished:true}).where(eq(exams.id,f.exam.id));await expect(officialReport(f.teacherA,options())).rejects.toMatchObject({status:409,code:"INCOMPLETE_MARK_ENTRY"});expect(await db.select().from(examPublications).where(eq(examPublications.schoolId,f.school.id))).toHaveLength(1);
  });
  it("Mathematics incomplete names its mapped teacher and precise pending count; only complete case consolidates",async()=>{
    await write(0,[70,70]);await write(1,["AB","EXEMPT"]);await write(2,[35,null]);const rows=await markMonitoring(f.admin,f.exam.id,f.a.cls.id);expect(rows.map((r)=>[r.subjectName,r.totalStudents,r.entered,r.pending,r.status])).toEqual([["Language",2,2,0,"Complete"],["English",2,2,0,"Complete"],["Mathematics",2,1,1,"Pending"]]);
    await expect(officialReport(f.teacherA,options())).rejects.toMatchObject({message:"Consolidated Mark Sheet cannot be generated.",details:{pendingTeachers:[expect.objectContaining({teacherName:f.teacherB.user.name,subjectName:"Mathematics",pendingStudentCount:1})]}});
    await write(2,[35,35]);expect((await officialReport(f.teacherA,options())).consolidatedList).toHaveLength(2);
  });
  it("retained primary legacy marks are not calculated by analytics, student averages, official or comparative reports",async()=>{
    const [cls]=await db.insert(classes).values({schoolId:f.school.id,name:"Class 5",section:"P",academicYear:f.year.label,academicYearId:f.year.id}).returning();const [sub]=await db.insert(subjects).values({schoolId:f.school.id,classId:cls.id,code:`P${cls.id}`,name:"Primary legacy fixture"}).returning();await syncClassRelations(db,cls.id,f.school.id);const student=(await saveStudent(f.admin,{classId:cls.id,name:"Primary fixture"})).student;const [pair]=await db.select().from(classSubjects).where(eq(classSubjects.classId,cls.id));const [allocation]=await db.select().from(markAllocations).where(eq(markAllocations.classSubjectId,pair.id));await db.insert(marks).values({schoolId:f.school.id,studentId:student.id,studentUuid:student.uuid,enrollmentId:student.enrollmentId,classSectionId:pair.classSectionId,classSubjectId:pair.id,allocationId:allocation.id,allocationSnapshot:{legacy:true,maxMarks:100},subjectId:sub.id,examId:f.exam.id,status:"NUMERIC",score:80,scoreExact:80,enteredById:f.admin.user.id});
    expect(await loadMarkRows({schoolId:f.school.id,classId:cls.id})).toEqual([]);expect((await averageByStudent(f.school.id)).has(student.id)).toBe(false);await expect(studentReport(student.id,f.admin)).rejects.toMatchObject({status:409,code:"FEATURE_NOT_APPROVED"});await expect(officialReport(f.admin,{classId:cls.id,examId:f.exam.id,mode:"subject"})).rejects.toMatchObject({status:409,code:"FEATURE_NOT_APPROVED"});expect(await db.select().from(marks).where(and(eq(marks.schoolId,f.school.id),eq(marks.studentId,student.id)))).toHaveLength(1);
  });
});

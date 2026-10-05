import { afterAll,beforeAll,beforeEach,describe,expect,it } from "vitest";
import { eq } from "drizzle-orm";
import { db,closeDatabase } from "@/db";
import { migrateDatabase } from "@/db/migrate";
import { marks,classes,exams,examPublications } from "@/db/schema";
import { schoolFixture } from "./fixtures";
import { saveMarkBatch } from "@/lib/mark-entry";
import { officialReport } from "@/lib/official-reports";
import { publishResult } from "@/lib/exam-service";
import { archiveStudent,saveStudent } from "@/lib/student-service";
import { loadMarkRows,studentTotals,computeStats } from "@/lib/analytics";
import { overviewReport,studentReport } from "@/lib/reports";
let f:Awaited<ReturnType<typeof schoolFixture>>;
beforeAll(async()=>{await migrateDatabase();});beforeEach(async()=>{f=await schoolFixture();});afterAll(closeDatabase);
async function write(scores:[number|"AB"|"EXEMPT",number|"AB"|"EXEMPT"][]) {
  for(let i=0;i<f.a.subjects.length;i++)await saveMarkBatch(i===0?f.teacherA:f.teacherB,{classId:f.a.cls.id,examId:f.exam.id,subjectId:f.a.subjects[i].id,entries:scores[i].map((value,index)=>({enrollmentId:index===0?f.student1.enrollmentId:f.student2.enrollmentId,...(typeof value==="number"?{score:value}:{status:value})}))});
}
const options=()=>({mode:"consolidated" as const,classId:f.a.cls.id,examId:f.exam.id});
describe("actual report service scope, completion and academic calculations",()=>{
  it("official endpoint service blocks consolidation AND matrix/form-II until every required entry is complete",async()=>{
    for(const mode of ["consolidated","matrix","form2"] as const)await expect(officialReport(f.teacherA,{...options(),mode})).rejects.toMatchObject({code:"INCOMPLETE_MARK_ENTRY",message:"Consolidated Mark Sheet cannot be generated."});
    expect((await officialReport(f.teacherA,{...options(),mode:"subject"})).subjectAnalysisList).toHaveLength(1);
  });
  it("Teacher B cannot consolidate A; own-subject response has no A marks or school-wide matrix",async()=>{
    await write([[88,90],[70,75],[65,68]]);
    await expect(officialReport(f.teacherB,options())).rejects.toMatchObject({status:403,code:"INVALID_REPORT_SCOPE"});
    const own=await officialReport(f.teacherA,{...options(),mode:"subject"});
    expect(own.subjectAnalysisList.map((s)=>s.subject.id)).toEqual([f.a.subjects[0].id]);expect(own.consolidatedList).toEqual([]);expect(own.matrixReport).toBeNull();expect(own.form2Report).toBeNull();
    await expect(officialReport(f.teacherA,{...options(),mode:"subject",subjectId:f.a.subjects[1].id})).rejects.toMatchObject({status:403});
  });
  it("numeric-only failure counts and strict subject-only fail exclude AB/Exemption",async()=>{
    await write([[80,"AB"],[90,"EXEMPT"],[20,20]]);
    const report=await officialReport(f.admin,options());
    expect(report.consolidatedList.map((s)=>s.failedSubjectsCount)).toEqual([1,1]);
    expect(report.matrixReport?.subjectOnlyFailureList.find((s)=>s.subjectId===f.a.subjects[2].id)?.tot).toBe(1);
    expect(report.subjectAnalysisList[0].tot).toMatchObject({appeared:1,absent:1,failed:0});
    expect(report.subjectAnalysisList[1].tot).toMatchObject({appeared:1,exemption:1,failed:0});
    expect(report.consolidatedList[1].subjectScores[f.a.subjects[0].id].score).toBeNull();expect(report.consolidatedList[1].rank).toBeNull();
    expect(report.form2Report?.teachersPerformance[2].failOnlyThisSubject).toBe(1);
  });
  it("all-AB and all-Exemption have null totals and blank ranks, never zero/F",async()=>{
    await write([["AB","EXEMPT"],["AB","EXEMPT"],["AB","EXEMPT"]]);const report=await officialReport(f.admin,options());
    expect(report.consolidatedList.map((s)=>[s.total,s.result,s.rank])).toEqual([[null,"AB",null],[null,"Exemption",null]]);
    const rows=await loadMarkRows({schoolId:f.school.id,examId:f.exam.id});expect(computeStats(rows)).toMatchObject({attempts:0,absent:3,exemption:3,failCount:0});
    expect(studentTotals(rows).every((s)=>s.total===null && s.percentage===null && s.rank===0)).toBe(true);
  });
  it.each(["AB","EXEMPT"] as const)("a mixed %s plus numeric record has no invented complete total/percentage/rank",async(state)=>{
    await write([[state,90],[80,90],[80,90]]);const report=await officialReport(f.admin,options());expect(report.consolidatedList[0]).toMatchObject({total:null,rank:null,result:state==="AB"?"AB":"Exemption"});const totals=studentTotals(await loadMarkRows({schoolId:f.school.id,examId:f.exam.id}));expect(totals.find((s)=>s.studentId===f.student1.id)).toMatchObject({total:null,percentage:null,rank:0});
  });
  it("competition ranking is by total descending with 1,1,3, excluding failed/incomplete students",async()=>{
    const third=(await saveStudent(f.admin,{classId:f.a.cls.id,name:"Third",rollNo:3,gender:"Male"})).student;
    await write([[80,80],[90,90],[70,70]]);
    for(const subject of f.a.subjects)await saveMarkBatch(subject.id===f.a.subjects[0].id?f.teacherA:f.teacherB,{classId:f.a.cls.id,examId:f.exam.id,subjectId:subject.id,entries:[{enrollmentId:third.enrollmentId,score:60}]});
    const report=await officialReport(f.teacherA,options());expect(report.consolidatedList.map((s)=>s.rank)).toEqual([1,1,3]);
    const totals=studentTotals(await loadMarkRows({schoolId:f.school.id,examId:f.exam.id}));expect(totals.map((s)=>s.rank)).toEqual([1,1,3]);
  });
  it("native decimal storage keeps values below 35 failing and distinct totals ranked by exact value",async()=>{
    await write([[34.9999999,35],[70,70],[80,80]]);let report=await officialReport(f.admin,options());expect(report.consolidatedList[0].subjectScores[f.a.subjects[0].id].score).toBe(34.9999999);expect(report.consolidatedList[0]).toMatchObject({result:"Fail",rank:null});
    await write([[40.001,40.004],[70,70],[80,80]]);report=await officialReport(f.admin,options());expect(report.consolidatedList.map((r)=>[r.total,r.rank])).toEqual([[190.001,2],[190.004,1]]);
  });
  it("same-year transfers with marks are blocked, and a DB trigger prevents accidental historical upserts",async()=>{
    await write([[80,80],[90,90],[70,70]]);const prior=await db.select().from(marks).where(eq(marks.studentId,f.student1.id));
    await expect(saveStudent(f.admin,{studentId:f.student1.id,classId:f.b.cls.id,name:f.student1.name,rollNo:2})).rejects.toMatchObject({status:409,code:"HISTORICAL_IDENTITY_LOCKED"});
    await expect(db.update(marks).set({enrollmentId:f.student3.enrollmentId}).where(eq(marks.id,prior[0].id))).rejects.toThrow();
    expect(await db.select().from(marks).where(eq(marks.studentId,f.student1.id))).toEqual(prior);
  });
  it("a published snapshot remains printable after student/class/exam archive; revisions are append-only",async()=>{
    await write([[80,80],[90,90],[70,70]]);
    for(const subject of f.b.subjects)await saveMarkBatch(f.teacherB,{classId:f.b.cls.id,examId:f.exam.id,subjectId:subject.id,entries:[{enrollmentId:f.student3.enrollmentId,score:60}]});
    await publishResult(f.admin,f.exam.id,true);await archiveStudent(f.admin,f.student1.id);
    await db.update(classes).set({archivedAt:new Date()}).where(eq(classes.id,f.a.cls.id));await db.update(exams).set({archivedAt:new Date()}).where(eq(exams.id,f.exam.id));
    const historical=await officialReport(f.admin,{...options(),includeArchived:true});expect(historical.historical).toBe(true);expect(historical.consolidatedList).toHaveLength(2);expect(historical.consolidatedList[0].studentUuid).toBe(f.student1.uuid);
    const [snapshot]=await db.select().from(examPublications).where(eq(examPublications.classId,f.a.cls.id));await expect(db.delete(examPublications).where(eq(examPublications.id,snapshot.id))).rejects.toThrow();
    expect((await studentReport(f.student1.id,f.admin))?.examCards).toHaveLength(1);
  });
  it("teacher overview and comparative report contain only assigned subjects, not the school roster",async()=>{
    await write([[80,80],[90,90],[70,70]]);
    const overview=await db.transaction((tx)=>overviewReport(f.teacherA,f.exam.id,tx),{isolationLevel:"repeatable read",accessMode:"read only"});
    expect(overview.kpis.classes).toBe(1);expect(overview.kpis.students).toBe(2);expect(overview.kpis.subjects).toBe(1);expect(overview.subjectSnapshot).toHaveLength(1);
    expect((await studentReport(f.student1.id,f.teacherA))?.examCards[0].subjects.map((s)=>s.subjectId)).toEqual([f.a.subjects[0].id]);
    await expect(studentReport(f.student3.id,f.teacherA)).rejects.toMatchObject({status:403});
  });
  it("CCE export cannot fabricate FA(A)/FA(B)/SA or Level from exam scores",async()=>{
    await write([[80,80],[90,90],[70,70]]);await expect(officialReport(f.admin,{...options(),mode:"cce"})).rejects.toMatchObject({status:409,code:"FEATURE_NOT_APPROVED"});
    expect((await officialReport(f.admin,options())).cceRegister).toBeNull();
  });
});

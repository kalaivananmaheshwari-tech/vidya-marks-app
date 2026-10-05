import {assertApprovedScoring} from "@/lib/scoring-policy";
import {allocationReviewRequired} from "@/lib/domain/legacy-allocations";
import type {Allocation} from "@/lib/domain/marks";
import { and, asc, desc, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { db, type DbExecutor } from "@/db";
import { classes, exams, groups, examPublications, teacherSubjectAssignments, type ClassRow, type Exam, type School } from "@/db/schema";
import { isAdmin, type SchoolAuthContext } from "@/lib/auth";
import { classScopeCondition } from "@/lib/authorization";
import { assertConsolidatedReady } from "@/lib/mark-entry";
import { HttpError } from "@/lib/http";
import { classAssessment, type AssessmentData } from "@/lib/assessments";
import { assessmentEntries, counts, classStatistics, subjectStatistics, type AssessmentEntry } from "@/lib/official-statistics";
import { markState } from "@/lib/domain/marks";
import { CCE_UNRESOLVED } from "@/lib/domain/cce";
import { audit } from "@/lib/audit";
import { round } from "@/lib/grades";
export type OfficialMode="consolidated"|"subject"|"matrix"|"form2"|"cce";
export type OfficialOptions={classId?:number;examId?:number;subjectId?:number;previousExamId?:number;mode:OfficialMode;includeArchived?:boolean};

async function verifiedAssessment(auth:SchoolAuthContext,cls:ClassRow,exam:Exam,executor:DbExecutor):Promise<{data:AssessmentData;header:School;historical:boolean}> {
  if(exam.academicYearId!==cls.academicYearId) throw new HttpError("Class and exam must belong to the same academic year.",400,"INVALID_ACADEMIC_YEAR");
  if(exam.isPublished) {
    const [revision]=await executor.select().from(examPublications).where(and(eq(examPublications.schoolId,auth.school.id),eq(examPublications.examId,exam.id),eq(examPublications.classId,cls.id))).orderBy(desc(examPublications.generation)).limit(1);
    if(!revision) throw new HttpError("This legacy publication has no verified roster snapshot. An administrator must review its historical records before regenerating an official publication.",409,"LEGACY_PUBLICATION_REVIEW_REQUIRED");
    return {data:revision.data,header:revision.schoolHeader,historical:true};
  }
  if(cls.archivedAt || exam.archivedAt) throw new HttpError("Archived draft records are available in individual history, but cannot be exported as a verified official publication.",409,"HISTORICAL_REVIEW_REQUIRED");
  return {data:await classAssessment(cls,exam.id,executor),header:auth.school,historical:false};
}
function permittedConsolidation(auth:SchoolAuthContext,cls:ClassRow) {
  if(!isAdmin(auth.user) && cls.classTeacherId!==auth.user.id) throw new HttpError("Only this Class Teacher or the school administrator may generate a consolidated mark sheet.",403,"INVALID_REPORT_SCOPE");
}
function ensureSnapshotComplete(data:AssessmentData) {
  const required=data.subjects.filter((s)=>s.isRequired);
  const pending=required.map((sub)=>({teacherId:sub.teacherId,teacherName:sub.teacherName ?? "Unassigned teacher",subjectId:sub.id,subjectName:sub.name,pendingStudentCount:data.students.filter((s)=>markState(data.marks.find((m)=>sub.teacherId!==null && m.enrollmentId===s.enrollmentId && m.subjectId===sub.id && m.enteredById===sub.teacherId))==="PENDING").length})).filter((p)=>p.pendingStudentCount>0 || !p.teacherId || !required.find((s)=>s.id===p.subjectId)?.teacherActive);
  if(!required.length || pending.length) throw new HttpError("Consolidated Mark Sheet cannot be generated.",409,"INCOMPLETE_MARK_ENTRY",{pendingTeachers:pending});
}
export async function officialReport(auth:SchoolAuthContext,options:OfficialOptions) {
  if(options.mode==="cce") throw new HttpError("CCE Register is disabled pending approved business rules.",409,"FEATURE_NOT_APPROVED",{unresolved:CCE_UNRESOLVED});
  if(options.includeArchived && !isAdmin(auth.user)) throw new HttpError("Only administrators may browse archived official publications.",403,"FORBIDDEN");
  return db.transaction(async(executor)=>{
    const classOptions=await executor.select({id:classes.id,name:classes.name,section:classes.section,groupId:classes.groupId,groupCode:groups.code,groupName:groups.name,stream:groups.stream,academicYear:classes.academicYear,archivedAt:classes.archivedAt,classTeacherId:classes.classTeacherId}).from(classes)
      .leftJoin(groups,and(eq(groups.id,classes.groupId),eq(groups.schoolId,classes.schoolId))).where(and(eq(classes.schoolId,auth.school.id),options.includeArchived?undefined:isNull(classes.archivedAt),isAdmin(auth.user)?sql`true`:or(classScopeCondition(auth),eq(classes.classTeacherId,auth.user.id)))).orderBy(asc(classes.name),asc(classes.section));
    const examOptions=await executor.select().from(exams).where(and(eq(exams.schoolId,auth.school.id),options.includeArchived?undefined:isNull(exams.archivedAt))).orderBy(sql`${exams.startDate} desc nulls last`,desc(exams.id));
    const base={school:auth.school,classes:classOptions,exams:examOptions,selectedClass:null,selectedExam:null,subjects:[],consolidatedList:[],subjectAnalysisList:[],matrixReport:null,cceRegister:null,form2Report:null,historical:false,scope:"Lookup",cceDisabled:{code:"FEATURE_NOT_APPROVED",unresolved:CCE_UNRESOLVED}};
    if(!options.classId || !options.examId) return base;
    const choice=classOptions.find((c)=>c.id===options.classId); const exam=examOptions.find((e)=>e.id===options.examId);
    if(!choice || !exam) throw new HttpError("Class or exam is outside your authorized scope.",403,"INVALID_REPORT_SCOPE");
    const ids=[options.examId,...(options.previousExamId?[options.previousExamId]:[])].sort((a,b)=>a-b);
    // Read snapshot and completeness from one transaction. Same exam->class lock order as writes/publication.
    await executor.select({id:exams.id}).from(exams).where(and(eq(exams.schoolId,auth.school.id),inArray(exams.id,ids))).orderBy(asc(exams.id)).for("share");
    const [cls]=await executor.select().from(classes).where(and(eq(classes.id,choice.id),eq(classes.schoolId,auth.school.id))).for("share");
    assertApprovedScoring(cls.name);
    const consolidated=options.mode!=="subject";
    if(consolidated) permittedConsolidation(auth,cls);
    const currentAssignments=!isAdmin(auth.user) && !consolidated ? await executor.select({id:teacherSubjectAssignments.classSubjectId}).from(teacherSubjectAssignments).where(and(eq(teacherSubjectAssignments.schoolId,auth.school.id),eq(teacherSubjectAssignments.teacherId,auth.user.id),eq(teacherSubjectAssignments.classId,cls.id))):[];
    const verified=await verifiedAssessment(auth,cls,exam,executor);const data=verified.data;
    if(consolidated) {
      if(exam.isPublished) ensureSnapshotComplete(data); else await assertConsolidatedReady(auth,cls.id,exam.id,executor);
    }
    const subjectsAllowed=isAdmin(auth.user) || consolidated?data.subjects:data.subjects.filter((s)=>currentAssignments.some((a)=>a.id===s.classSubjectId));
    if(!subjectsAllowed.length) throw new HttpError("No subjects in this class and section are assigned to you.",403,"INVALID_TEACHER_ASSIGNMENT");
    if(options.subjectId && !subjectsAllowed.some((s)=>s.id===options.subjectId)) throw new HttpError("Subject is outside your report scope.",403,"INVALID_TEACHER_ASSIGNMENT");
    const selectedSubjects=options.subjectId && !consolidated?subjectsAllowed.filter((s)=>s.id===options.subjectId):subjectsAllowed;
    if(selectedSubjects.some((s)=>s.mode==="UNAPPROVED")) throw new HttpError("Mark allocation and result reporting for this class are not approved.",409,"FEATURE_NOT_APPROVED");
    if(data.marks.some((m)=>{const sub=selectedSubjects.find((s)=>s.id===m.subjectId);return sub && allocationReviewRequired(m,sub as Allocation);}))throw new HttpError("Historical components require source-based allocation review. No automatic conversion is authorized.",409,"LEGACY_ALLOCATION_REVIEW_REQUIRED");
    if(!isAdmin(auth.user) && !consolidated && data.marks.some((m)=>selectedSubjects.some((s)=>s.id===m.subjectId) && m.enteredById!==auth.user.id))throw new HttpError("Subject entries belong to another member. Only your own entries are available in teacher subject reports.",403,"FORBIDDEN_MARK_OWNER");
    const reportingData=consolidated?data:{...data,subjects:selectedSubjects,marks:data.marks.filter((m)=>selectedSubjects.some((s)=>s.id===m.subjectId))};
    const entries=assessmentEntries(reportingData);
    const analysis=selectedSubjects.map((sub)=>({subject:sub,studentRows:entries.map((e)=>({sNo:e.sNo,regNo:e.regNo,name:e.name,gender:e.gender,...e.subjectScores[sub.id]})),b:subjectStatistics(entries.filter((e)=>e.gender==="B"),sub.id),g:subjectStatistics(entries.filter((e)=>e.gender==="G"),sub.id),tot:subjectStatistics(entries,sub.id)}));
    const required=data.subjects.filter((s)=>s.isRequired);
    const matrix=consolidated?{subjects:analysis,failureBuckets:Array.from({length:required.length},(_,i)=>({failedCount:i+1,label:i===0?"1 Subject":`${i+1} Subjects`,...counts(entries,(e)=>e.failedSubjectsCount===i+1)})),subjectFailureList:required.map((s)=>({subjectId:s.id,subjectName:s.name,subjectCode:s.code,...counts(entries,(e)=>e.failedSubjectIds.includes(s.id))})),subjectOnlyFailureList:required.map((s)=>({subjectId:s.id,subjectName:s.name,...counts(entries,(e)=>e.onlySubjectFailureIds.includes(s.id))})),classResultAnalysis:classStatistics(entries)}:null;
    let previous:AssessmentData|undefined;
    if(consolidated && options.previousExamId) {
      if(options.previousExamId===exam.id) throw new HttpError("Previous exam must be different from the current exam.");
      const prev=examOptions.find((e)=>e.id===options.previousExamId);
      if(!prev || prev.academicYearId!==cls.academicYearId) throw new HttpError("Previous exam is outside this school's academic year.",403,"INVALID_REPORT_SCOPE");
      previous=(await verifiedAssessment(auth,cls,prev,executor)).data;
      if(prev.isPublished) ensureSnapshotComplete(previous); else await assertConsolidatedReady(auth,cls.id,prev.id,executor);
    }
    const form2=consolidated?form2Data(verified.header,{...choice,stream:data.class.stream ?? choice.stream},exam,entries,data,previous):null;
    if(consolidated) await audit(executor,auth,"report.consolidated_generated","examinations",exam.id,{classId:cls.id,mode:options.mode,publicationSnapshot:verified.historical});
    return {...base,school:verified.header,selectedClass:{...choice,name:data.class.name,section:data.class.section,groupCode:data.class.groupCode ?? choice.groupCode,groupName:data.class.groupName ?? choice.groupName},selectedExam:exam,subjects:selectedSubjects,consolidatedList:consolidated?entries:[],subjectAnalysisList:analysis,matrixReport:matrix,form2Report:form2,historical:verified.historical,scope:consolidated?"Verified class/section":"Assigned subjects only"};
  },{isolationLevel:"repeatable read"});
}
function form2Data(school:School,cls:{name:string;section:string;stream:string|null},exam:Exam,entries:AssessmentEntry[],data:AssessmentData,previous?:AssessmentData) {
  const s=classStatistics(entries);const prevEntries=previous?assessmentEntries(previous):undefined;const prev=prevEntries?classStatistics(prevEntries):undefined;
  const trip=(v:{b:number;g:number;tot:number})=>({male:v.b,female:v.g,total:v.tot});
  const numeric=data.marks.filter((m)=>markState(m)==="NUMERIC");const prevNumeric=previous?.marks.filter((m)=>markState(m)==="NUMERIC");
  const avg=(rows:typeof numeric|undefined)=>rows?.length?round(rows.reduce((n,m)=>n+m.score!,0)/rows.length):"—";
  const failed=entries.filter((e)=>e.failedSubjectsCount>0);const failedIn=(n:number)=>failed.filter((e)=>e.failedSubjectsCount===n).length;
  const required=data.subjects.filter((sub)=>sub.isRequired);
  const nameKeys:Record<string,string>={tamil:"tamil",english:"english",mathematics:"maths",maths:"maths",physics:"physics",chemistry:"chemistry",biology:"biology",botany:"botany",zoology:"zoology","computer science":"computerSci","computer applications":"computerApp","computer application":"computerApp","employability skills":"empSkill",history:"history",economics:"economics",commerce:"commerce",accountancy:"accountancy"};
  const subjectWiseFails:Record<string,number>=Object.fromEntries([...new Set([...Object.values(nameKeys),"allOtherSub"])].map((k)=>[k,0]));
  for(const key of Object.keys(subjectWiseFails)) subjectWiseFails[key]=entries.filter((e)=>e.failedSubjectIds.some((id)=>{const name=required.find((sub)=>sub.id===id)?.name.trim().toLowerCase() ?? "";return (nameKeys[name] ?? "allOtherSub")===key;})).length;
  const top=entries.filter((e)=>e.result==="Pass").sort((a,b)=>b.total!-a.total!)[0]?.total ?? "—"; const stream=cls.stream?.toLowerCase() ?? "";
  const teachersPerformance=required.map((sub,i)=>{
    const stats=subjectStatistics(entries,sub.id);const old=prevEntries?subjectStatistics(prevEntries,sub.id):undefined;
    return {sNo:i+1,teacherName:sub.teacherName ?? "Unassigned",subjectName:sub.name,appeared:stats.appeared,passed:stats.passed,failed:stats.failed,passPercentage:String(stats.passPercentage),centum:stats.centum,failOnlyThisSubject:entries.filter((e)=>e.onlySubjectFailureIds.includes(sub.id)).length,averageMark:stats.subjectAverage ?? "—",lowestMark:stats.lowestMark ?? "—",highestMark:stats.highestMark ?? "—",prevExamPass:old?String(old.passPercentage):"—",currExamPass:String(stats.passPercentage)};
  });
  return {district:school.district ?? "",reportTitle:"RESULT ANALYSIS REPORT",formName:"FORM - II",schoolName:school.name,udiseNo:school.udiseCode,classDisplay:`${cls.name} - ${cls.section}`,examDisplay:exam.name,
    overviewTable:{nominalRoll:trip(s.nominalRoll),absent:trip(s.absent),exemption:trip(s.exemption),pending:trip(s.pending),appeared:trip(s.appeared),passed:trip(s.passedAll),passPercentage:trip(s.passPercentage),failed:trip(s.failed),prevExamPassPct:prev?.passPercentage.tot ?? "—",currExamPassPct:s.passPercentage.tot,schoolAverageMark:{prevExam:avg(prevNumeric),currExam:avg(numeric)}},
    breakdownTable:{mediumWiseFailed:{tamilMedium:failed.filter((e)=>e.medium==="Tamil").length,englishMedium:failed.filter((e)=>e.medium==="English").length,unknownMedium:failed.filter((e)=>!e.medium).length,total:failed.length},noOfStudentsFailed:{singleSubject:failedIn(1),twoSubject:failedIn(2),threeSubject:failedIn(3),fourSubject:failedIn(4),fiveSubject:failedIn(5),allSubject:failedIn(required.length)},schoolFirstMark:{scienceStream:stream.includes("science")?top:"—",artsStream:stream.includes("arts")?top:"—",vocationalStream:stream.includes("vocational")?top:"—"}},
    subjectWiseFails,teachersPerformance,paddedTeacherRows:Array.from({length:Math.max(0,10-teachersPerformance.length)},(_,i)=>({sNo:teachersPerformance.length+i+1})),notes:["AB, Exemption and Pending are separate states, never numeric failures.","Previous-exam comparison is blank unless explicitly selected.","Totals include any recorded unknown gender/medium without assigning it to Male/Female or Tamil/English."]};
}

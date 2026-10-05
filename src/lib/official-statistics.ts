import {sumMarks} from "@/lib/domain/decimal-sum";
import { allRequiredPassed, competitionRanks, markState, resultForMark, subjectOnlyFailure, type ResultState, type ResultMark } from "@/lib/domain/marks";
import { round } from "@/lib/grades";
import type { AssessmentData } from "@/lib/assessments";
export function genderCode(gender: string | null | undefined): "B"|"G"|"U" { const g=gender?.trim().toLowerCase(); return ["male","boy","m","b"].includes(g ?? "")?"B":["female","girl","f","g"].includes(g ?? "")?"G":"U"; }
export type SubjectScore = {score:number|null;status:string;isAbsent:boolean;isExempt:boolean;passed:boolean;result:ResultState;theoryScore:number|null;practicalScore:number|null;internalScore:number|null};
export function assessmentEntries(data: AssessmentData) {
  const required=data.subjects.filter((s)=>s.isRequired).map((s)=>s.id);
  const map=new Map<string,Map<number,ResultMark & Partial<AssessmentData["marks"][number]>>>();
  for(const m of data.marks) {const key=m.enrollmentId!;if(!map.has(key))map.set(key,new Map());map.get(key)!.set(m.subjectId,m);}
  const entries=data.students.map((stu,index)=>{
    const own=map.get(stu.enrollmentId) ?? new Map(); const subjectScores:Record<number,SubjectScore>={};
    for(const sub of data.subjects) {const m=own.get(sub.id);const state=markState(m); const numeric=state==="NUMERIC";
      subjectScores[sub.id]={score:numeric?m!.score!:null,status:state,isAbsent:state==="AB",isExempt:state==="EXEMPT",passed:resultForMark(m)==="Pass",result:resultForMark(m),theoryScore:numeric?m?.theoryScore ?? null:null,practicalScore:numeric?m?.practicalScore ?? null:null,internalScore:numeric?m?.internalScore ?? null:null}; }
    const failedSubjectIds=required.filter((id)=>resultForMark(own.get(id))==="Fail");
    const allPass=allRequiredPassed(required,own); const numeric=required.map((id)=>own.get(id)).filter((m)=>markState(m)==="NUMERIC");
    const result:ResultState=allPass?"Pass":failedSubjectIds.length?"Fail":required.some((id)=>markState(own.get(id))==="PENDING")?"Pending":required.some((id)=>markState(own.get(id))==="AB")?"AB":"Exemption";
    return {sNo:index+1,studentId:stu.id,studentUuid:stu.uuid,enrollmentId:stu.enrollmentId,regNo:String(stu.rollNo),name:stu.name,gender:genderCode(stu.gender),medium:stu.medium,subjectScores,total:required.length>0 && required.every((id)=>markState(own.get(id))==="NUMERIC") && numeric.length?sumMarks(numeric.map((m)=>m!.score!)):null,result,failedSubjectsCount:failedSubjectIds.length,failedSubjectIds,rank:null as number|null,isCompletelyAbsent:required.length>0 && required.every((id)=>markState(own.get(id))==="AB"),onlySubjectFailureIds:required.filter((id)=>subjectOnlyFailure(id,required,own))};
  });
  const ranks=competitionRanks(entries,(e)=>e.total!, (e)=>e.result==="Pass" && e.total!==null); for(const e of entries)e.rank=ranks.get(e) ?? null;
  return entries;
}
export type AssessmentEntry=ReturnType<typeof assessmentEntries>[number];
export function emptyStatistics() {return {totalStudents:0,absent:0,exemption:0,pending:0,appeared:0,passed:0,failed:0,passPercentage:0,totalMarks:0,highestMark:null as number|null,lowestMark:null as number|null,subjectAverage:null as number|null,centum:0,between80And100:0,between70And80:0,between60And70:0,between50And60:0,between40And50:0,between35And40:0,below35:0};}
export function subjectStatistics(entries: AssessmentEntry[], subjectId:number) {
  const s=emptyStatistics();
  for(const e of entries) {s.totalStudents++;const m=e.subjectScores[subjectId]; const state=markState(m);
    if(state==="AB"){s.absent++;continue;} if(state==="EXEMPT"){s.exemption++;continue;} if(state!=="NUMERIC"){s.pending++;continue;}
    const score=m.score!;s.appeared++;s.totalMarks=sumMarks([s.totalMarks,score]);s.highestMark=s.highestMark===null?score:Math.max(s.highestMark,score);s.lowestMark=s.lowestMark===null?score:Math.min(s.lowestMark,score);
    if(score>=35)s.passed++;else s.failed++;
    if(score===100)s.centum++;else if(score>=80)s.between80And100++;else if(score>=70)s.between70And80++;else if(score>=60)s.between60And70++;else if(score>=50)s.between50And60++;else if(score>=40)s.between40And50++;else if(score>=35)s.between35And40++;else s.below35++;
  }
  s.passPercentage=s.appeared?round(s.passed/s.appeared*100):0;s.subjectAverage=s.appeared?round(s.totalMarks/s.appeared):null;return s;
}
export function counts(entries: AssessmentEntry[], predicate:(e:AssessmentEntry)=>boolean) {const rows=entries.filter(predicate);return {b:rows.filter((e)=>e.gender==="B").length,g:rows.filter((e)=>e.gender==="G").length,tot:rows.length};}
export function classStatistics(entries:AssessmentEntry[]) {
  const appeared=counts(entries,(e)=>Object.values(e.subjectScores).some((m)=>markState(m)==="NUMERIC"));
  const passedAll=counts(entries,(e)=>e.result==="Pass");const failed=counts(entries,(e)=>e.failedSubjectsCount>0);
  return {nominalRoll:counts(entries,()=>true),absent:counts(entries,(e)=>e.isCompletelyAbsent),exemption:counts(entries,(e)=>Object.values(e.subjectScores).some((m)=>m.isExempt)),pending:counts(entries,(e)=>Object.values(e.subjectScores).some((m)=>markState(m)==="PENDING")),appeared,passedAll,failed,passPercentage:{b:appeared.b?round(passedAll.b/appeared.b*100):0,g:appeared.g?round(passedAll.g/appeared.g*100):0,tot:appeared.tot?round(passedAll.tot/appeared.tot*100):0}};
}

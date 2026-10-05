import {assertApprovedScoring} from "@/lib/scoring-policy";
import { z } from "zod";
import { and, asc, desc, eq, sql, type SQL, type SQLWrapper } from "drizzle-orm";
import { db } from "@/db";
import { schools, exams, examPublications, geographicScopes } from "@/db/schema";
import type { AuthContext } from "@/lib/auth";
import { normalizeGeography, SCHOOL_MANAGEMENTS, validGeographicScope } from "@/lib/domain/geography";
import { classNumber, competitionRanks } from "@/lib/domain/marks";
import { HttpError, idSchema } from "@/lib/http";
import { assessmentEntries, subjectStatistics } from "@/lib/official-statistics";
export const geographicFiltersSchema=z.object({schoolId:idSchema.optional(),academicYear:z.string().regex(/^\d{4}-\d{4}$/).optional(),examName:z.string().trim().min(1).max(150).optional(),management:z.enum(SCHOOL_MANAGEMENTS).optional(),className:z.string().trim().min(1).max(150).optional(),subjectName:z.string().trim().min(1).max(150).optional(),district:z.string().trim().max(150).optional(),educationalDistrict:z.string().trim().max(150).optional(),block:z.string().trim().max(150).optional()}).strict();
export type GeographicFilters=z.infer<typeof geographicFiltersSchema>;
export async function geographicReport(auth:AuthContext,input:unknown) {
  const filters=geographicFiltersSchema.parse(input);
  if(filters.className && !classNumber(filters.className)) throw new HttpError("Choose a valid class from 1 to 12.");
  return db.transaction(async(tx)=>{
    const [scope]=await tx.select().from(geographicScopes).where(eq(geographicScopes.userId,auth.user.id));
    if(!scope || !validGeographicScope(scope) || auth.school || auth.user.schoolId!==null) throw new HttpError("An authorized geographic officer scope is required.",403,"INVALID_REPORT_SCOPE");
    if(filters.className)assertApprovedScoring(filters.className);
    if(filters.district && normalizeGeography(filters.district)!==normalizeGeography(scope.district)) throw new HttpError("District is outside your registered scope.",403,"INVALID_GEOGRAPHIC_SCOPE");
    if(scope.role!=="CEO" && filters.educationalDistrict && normalizeGeography(filters.educationalDistrict)!==normalizeGeography(scope.educationalDistrict)) throw new HttpError("Educational District is outside your registered scope.",403,"INVALID_GEOGRAPHIC_SCOPE");
    if(scope.role==="BEO" && filters.block && normalizeGeography(filters.block)!==normalizeGeography(scope.block)) throw new HttpError("Block is outside your registered scope.",403,"INVALID_GEOGRAPHIC_SCOPE");
    const match=(column:SQLWrapper,value:string|null)=>sql`lower(regexp_replace(trim(${column}),'[[:space:]]+',' ','g'))=${normalizeGeography(value)}`;
    const conditions:SQL[]=[match(schools.district,scope.district)];
    const educational=scope.role==="CEO"?filters.educationalDistrict:scope.educationalDistrict;
    const block=scope.role==="BEO"?scope.block:filters.block;
    if(educational)conditions.push(match(schools.educationalDistrict,educational));if(block)conditions.push(match(schools.block,block));
    const allowed=await tx.select({id:schools.id,name:schools.name,udiseCode:schools.udiseCode,district:schools.district,educationalDistrict:schools.educationalDistrict,block:schools.block,management:schools.management,schoolType:schools.schoolType}).from(schools).where(and(...conditions)).orderBy(asc(schools.name));
    if(filters.schoolId && !allowed.some((s)=>s.id===filters.schoolId))throw new HttpError("School is outside your registered geographic scope.",403,"INVALID_GEOGRAPHIC_SCOPE");
    const options=await tx.selectDistinct({name:exams.name,academicYear:exams.academicYear}).from(exams).innerJoin(schools,eq(schools.id,exams.schoolId)).where(and(...conditions,eq(exams.isPublished,true))).orderBy(asc(exams.academicYear),asc(exams.name));
    const where=[...conditions,eq(exams.isPublished,true),filters.schoolId?eq(schools.id,filters.schoolId):undefined,filters.management?eq(schools.management,filters.management):undefined,filters.academicYear?eq(exams.academicYear,filters.academicYear):undefined,filters.examName?eq(exams.name,filters.examName):undefined];
    // Geography is enforced in SQL before any snapshots or student marks are read.
    const snapshots=filters.examName?await tx.select({revision:examPublications,schoolId:schools.id}).from(examPublications)
      .innerJoin(schools,eq(schools.id,examPublications.schoolId)).innerJoin(exams,and(eq(exams.id,examPublications.examId),eq(exams.schoolId,examPublications.schoolId))).where(and(...where)).orderBy(desc(examPublications.generation)):[];
    const latest=new Map<string,(typeof snapshots)[number]>();for(const r of snapshots){const key=`${r.revision.examId}:${r.revision.classId}`;if(!latest.has(key))latest.set(key,r);}
    type Entries=ReturnType<typeof assessmentEntries>;
    const sets=new Map<string,{school:(typeof allowed)[number];className:string;subjectName:string;entries:Entries;subjectIds:Set<number>}>();
    for(const r of latest.values()){
      const data=r.revision.data;
      const grade=classNumber(data.class.name);if(grade===null || grade<6 || data.subjects.some((s)=>s.mode==="UNAPPROVED"))continue;
      if(filters.className && classNumber(data.class.name)!==classNumber(filters.className))continue;
      const entries=assessmentEntries(data);const school=allowed.find((s)=>s.id===r.schoolId)!;
      for(const subject of data.subjects){if(filters.subjectName && subject.name.toLocaleLowerCase("en-IN")!==filters.subjectName.toLocaleLowerCase("en-IN"))continue;
        const key=`${school.id}:${classNumber(data.class.name)}:${subject.name.toLocaleLowerCase("en-IN")}`;
        if(!sets.has(key))sets.set(key,{school,className:`Class ${classNumber(data.class.name)}`,subjectName:subject.name,entries:[],subjectIds:new Set()});
        const set=sets.get(key)!;set.subjectIds.add(subject.id);
        // Normalize subject keys only inside this aggregate. No student identifiers/names are returned.
        set.entries.push(...entries.map((e)=>({...e,subjectScores:{0:e.subjectScores[subject.id]}})));
      }
    }
    const rows=[...sets.values()].map((set)=>{const all=subjectStatistics(set.entries,0);return {schoolId:set.school.id,schoolName:set.school.name,udiseCode:set.school.udiseCode,management:set.school.management,className:set.className,subjectName:set.subjectName,male:subjectStatistics(set.entries.filter((e)=>e.gender==="B"),0),female:subjectStatistics(set.entries.filter((e)=>e.gender==="G"),0),total:all,rank:null as number|null};});
    const comparisons=new Map<string,typeof rows>();for(const r of rows){const key=`${r.className}:${r.subjectName.toLowerCase()}`;if(!comparisons.has(key))comparisons.set(key,[]);comparisons.get(key)!.push(r);}
    for(const set of comparisons.values()){const ranks=competitionRanks(set,(r)=>r.total.totalMarks/r.total.appeared,(r)=>r.total.appeared>0);for(const r of set)r.rank=ranks.get(r) ?? null;}
    return {scope,schools:allowed,examOptions:options,rows:rows.sort((a,b)=>(a.rank ?? Infinity)-(b.rank ?? Infinity)),filters,notice:"Published, verified snapshots only. Choose an examination name and academic year to compare like examinations. AB/Exemption/Pending are separate from numeric failures; unknown genders are included only in Total."};
  },{isolationLevel:"repeatable read",accessMode:"read only"});
}

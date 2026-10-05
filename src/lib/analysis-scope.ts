import {assertApprovedScoring} from "@/lib/scoring-policy";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { groups, subjects } from "@/db/schema";
import { isAdmin, type SchoolAuthContext } from "@/lib/auth";
import { assertClassAccess, assertExamAccess, assertSubjectAccess } from "@/lib/authorization";
import { numParam, HttpError } from "@/lib/http";
import type { MarkFilters } from "@/lib/analytics";

export async function analysisFilters(auth: SchoolAuthContext, url: URL): Promise<MarkFilters> {
  for(const key of ["schoolId","teacherId","role"]) if(url.searchParams.has(key)) throw new HttpError("Report scope is determined by your authenticated membership.",400,"VALIDATION_ERROR");
  const classId=numParam(url.searchParams.get("classId")); const examId=numParam(url.searchParams.get("examId"));
  const subjectId=numParam(url.searchParams.get("subjectId")); const groupId=numParam(url.searchParams.get("groupId"));
  if(classId){const cls=await assertClassAccess(auth,classId);assertApprovedScoring(cls.name);}
  if(examId) await assertExamAccess(auth,examId);
  if(subjectId) {
    const [subject]=await db.select().from(subjects).where(and(eq(subjects.id,subjectId),eq(subjects.schoolId,auth.school.id),isNull(subjects.archivedAt))).limit(1);
    if(!subject?.classId) throw new HttpError("Subject is outside your school scope.",403,"INVALID_SCHOOL_SCOPE");
    const pair=await assertSubjectAccess(auth,classId ?? subject.classId,subjectId);const cls=await assertClassAccess(auth,pair.classSubject.classId);assertApprovedScoring(cls.name);
  }
  if(groupId) {
    const [group]=await db.select({id:groups.id}).from(groups).where(and(eq(groups.id,groupId),eq(groups.schoolId,auth.school.id),isNull(groups.archivedAt))).limit(1);
    if(!group) throw new HttpError("Group is outside your school scope.",403,"INVALID_SCHOOL_SCOPE");
  }
  return {schoolId:auth.school.id,classId,examId,subjectId,groupId,...(!isAdmin(auth.user)?{teacherId:auth.user.id}:{})};
}

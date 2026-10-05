import { and, eq, isNull, sql, type SQL } from "drizzle-orm";
import { db, type DbExecutor } from "@/db";
import { classes, classSubjects, subjects, exams, teacherSubjectAssignments, schoolMemberships, teacherProfiles, membershipRoles, users } from "@/db/schema";
import { isAdmin, type SchoolAuthContext } from "@/lib/auth";
import { HttpError } from "@/lib/http";

export function classScopeCondition(auth: SchoolAuthContext): SQL {
  return isAdmin(auth.user) ? sql`true` : sql`exists (
    select 1 from teacher_subject_assignments tsa where tsa.school_id=${auth.school.id}
    and tsa.teacher_id=${auth.user.id} and tsa.class_id=${classes.id}
  )`;
}
export function subjectScopeCondition(auth: SchoolAuthContext): SQL {
  return isAdmin(auth.user) ? sql`true` : sql`exists (
    select 1 from teacher_subject_assignments tsa where tsa.school_id=${auth.school.id}
    and tsa.teacher_id=${auth.user.id} and tsa.subject_id=${subjects.id}
  )`;
}
export async function assertClassAccess(auth: SchoolAuthContext, classId: number, executor: DbExecutor = db, allowClassTeacher = false) {
  const [cls] = await executor.select().from(classes).where(and(eq(classes.schoolId, auth.school.id), eq(classes.id, classId), isNull(classes.archivedAt))).limit(1);
  if (!cls) throw new HttpError("Class is outside your school scope or archived.", 403, "INVALID_SCHOOL_SCOPE");
  if (!isAdmin(auth.user)) {
    const [mapping] = await executor.select({ id: teacherSubjectAssignments.id }).from(teacherSubjectAssignments)
      .where(and(eq(teacherSubjectAssignments.schoolId, auth.school.id), eq(teacherSubjectAssignments.teacherId, auth.user.id), eq(teacherSubjectAssignments.classId, cls.id))).limit(1);
    if (!mapping && !(allowClassTeacher && cls.classTeacherId === auth.user.id)) throw new HttpError("This class and section are not assigned to you.", 403, "INVALID_TEACHER_ASSIGNMENT");
  }
  return cls;
}
export async function assertSubjectAccess(auth: SchoolAuthContext, classId: number, subjectId: number, executor: DbExecutor = db) {
  await assertClassAccess(auth, classId, executor);
  const [mapping] = await executor.select({ classSubject: classSubjects, subject: subjects }).from(classSubjects)
    .innerJoin(subjects, and(eq(subjects.id, classSubjects.subjectId), eq(subjects.schoolId, classSubjects.schoolId)))
    .where(and(eq(classSubjects.schoolId, auth.school.id), eq(classSubjects.classId, classId), eq(classSubjects.subjectId, subjectId), isNull(subjects.archivedAt))).limit(1);
  if (!mapping) throw new HttpError("Subject is not mapped to this class and section.", 403, "INVALID_TEACHER_ASSIGNMENT");
  if (!isAdmin(auth.user)) {
    const [assigned] = await executor.select({ id: teacherSubjectAssignments.id }).from(teacherSubjectAssignments)
      .where(and(eq(teacherSubjectAssignments.schoolId, auth.school.id), eq(teacherSubjectAssignments.teacherId, auth.user.id), eq(teacherSubjectAssignments.classSubjectId, mapping.classSubject.id))).limit(1);
    if (!assigned) throw new HttpError("This subject is assigned to another teacher.", 403, "INVALID_TEACHER_ASSIGNMENT");
  }
  return mapping;
}
export async function assertExamAccess(auth: SchoolAuthContext, examId: number, executor: DbExecutor = db) {
  const [exam] = await executor.select().from(exams).where(and(eq(exams.id, examId), eq(exams.schoolId, auth.school.id), isNull(exams.archivedAt))).limit(1);
  if (!exam) throw new HttpError("Exam is outside your school scope or archived.", 403, "INVALID_SCHOOL_SCOPE");
  return exam;
}
export async function assertTeacherReference(schoolId: number, teacherId: number, executor: DbExecutor = db) {
  const [profile] = await executor.select({ profile: teacherProfiles, user: users }).from(teacherProfiles)
    .innerJoin(schoolMemberships, and(eq(schoolMemberships.id, teacherProfiles.membershipId), eq(schoolMemberships.userId, teacherProfiles.userId), eq(schoolMemberships.schoolId, teacherProfiles.schoolId)))
    .innerJoin(membershipRoles, and(eq(membershipRoles.membershipId, schoolMemberships.id), eq(membershipRoles.role, "TEACHER")))
    .innerJoin(users, eq(users.id, teacherProfiles.userId))
    .where(and(eq(teacherProfiles.schoolId, schoolId), eq(teacherProfiles.userId, teacherId), eq(schoolMemberships.isActive, true), eq(users.isActive, true))).limit(1);
  if (!profile) throw new HttpError("Teacher must have an active membership in this school.", 403, "INVALID_TEACHER_ASSIGNMENT");
  return profile;
}

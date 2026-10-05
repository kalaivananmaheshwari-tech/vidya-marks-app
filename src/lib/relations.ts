import { and, eq, isNull, or } from "drizzle-orm";
import { db, type DbExecutor } from "@/db";
import { academicYears, classSections, classSubjects, classes, subjects, sections, schoolMemberships, membershipRoles, teacherProfiles, userIdentities, markAllocations, markAllocationComponents, teacherSubjectAssignments } from "@/db/schema";
import { allocationFor, classNumber } from "@/lib/domain/marks";
import { HttpError } from "@/lib/http";

export async function yearRecord(label: string, executor: DbExecutor = db) {
  const [year] = await executor.select().from(academicYears).where(eq(academicYears.label, label)).limit(1);
  if (!year) throw new HttpError("Select a registered academic year. Future years must first be added as records.", 400, "INVALID_ACADEMIC_YEAR");
  return year;
}
export async function addMembership(executor: DbExecutor, schoolId: number, userId: number, username: string, role: "ADMIN" | "HEADMASTER" | "PRINCIPAL" | "TEACHER") {
  await executor.insert(userIdentities).values({ userId, subject: username }).onConflictDoNothing();
  await executor.insert(schoolMemberships).values({ schoolId, userId }).onConflictDoNothing();
  const [membership] = await executor.select().from(schoolMemberships).where(and(eq(schoolMemberships.schoolId, schoolId), eq(schoolMemberships.userId, userId))).limit(1);
  await executor.insert(membershipRoles).values({ membershipId: membership.id, role }).onConflictDoNothing();
  if (role === "TEACHER") await executor.insert(teacherProfiles).values({ schoolId, userId, membershipId: membership.id }).onConflictDoNothing();
  return membership;
}
export async function writeAllocationComponents(executor: DbExecutor, allocation: typeof markAllocations.$inferSelect) {
  const components = [
    { kind: "theory", maximum: allocation.theoryMarks }, { kind: "practical", maximum: allocation.practicalMarks },
    { kind: "internal", maximum: allocation.internalMarks }, { kind: "total", maximum: allocation.mode === "TOTAL" ? 100 : 0 },
  ];
  for (const c of components) await executor.insert(markAllocationComponents).values({ schoolId: allocation.schoolId, allocationId: allocation.id, ...c })
    .onConflictDoUpdate({ target: [markAllocationComponents.allocationId, markAllocationComponents.kind], set: { maximum: c.maximum } });
}
/** Incremental relation sync for a newly created class/subject. Never rewrites marks. */
export async function syncClassRelations(executor: DbExecutor, classId: number, schoolId: number, legacyTeachers = false) {
  const [cls] = await executor.select().from(classes).where(and(eq(classes.id, classId), eq(classes.schoolId, schoolId))).limit(1);
  if (!cls) throw new HttpError("Class not found in this school.", 403, "INVALID_SCHOOL_SCOPE");
  const year = await yearRecord(cls.academicYear, executor);
  if (!cls.academicYearId) await executor.update(classes).set({ academicYearId: year.id }).where(eq(classes.id, cls.id));
  await executor.insert(sections).values({ schoolId, name: cls.section }).onConflictDoNothing();
  const [section] = await executor.select().from(sections).where(and(eq(sections.schoolId, schoolId), eq(sections.name, cls.section))).limit(1);
  await executor.insert(classSections).values({ schoolId, classId, sectionId: section.id, academicYearId: year.id }).onConflictDoNothing();
  const [classSection] = await executor.select().from(classSections).where(and(eq(classSections.schoolId, schoolId), eq(classSections.classId, classId))).limit(1);
  const own = await executor.select().from(subjects).where(and(eq(subjects.schoolId, schoolId), eq(subjects.classId, classId), isNull(subjects.archivedAt)));
  const fallback = own.length ? own : await executor.select().from(subjects).where(and(eq(subjects.schoolId, schoolId), isNull(subjects.classId), isNull(subjects.archivedAt), cls.groupId ? or(isNull(subjects.groupId), eq(subjects.groupId, cls.groupId)) : isNull(subjects.groupId)));
  const grade = classNumber(cls.name);
  for (const sub of fallback) {
    await executor.insert(classSubjects).values({ schoolId, classId, classSectionId: classSection.id, subjectId: sub.id }).onConflictDoNothing();
    const [mapping] = await executor.select().from(classSubjects).where(and(eq(classSubjects.schoolId, schoolId), eq(classSubjects.classId, classId), eq(classSubjects.subjectId, sub.id))).limit(1);
    const approved = grade !== null && grade >= 6;
    const values = approved ? allocationFor(grade, sub.hasPractical) : { mode: "UNAPPROVED", theoryMarks: 0, practicalMarks: 0, internalMarks: 0, maxMarks: 100, passMarks: 35, hasPractical: sub.hasPractical };
    await executor.insert(markAllocations).values({ schoolId, classSubjectId: mapping.id, ...values }).onConflictDoNothing();
    const [allocation] = await executor.select().from(markAllocations).where(eq(markAllocations.classSubjectId, mapping.id)).limit(1);
    await writeAllocationComponents(executor, allocation);
    if (legacyTeachers && sub.teacherId) {
      const [profile] = await executor.select().from(teacherProfiles).where(and(eq(teacherProfiles.schoolId, schoolId), eq(teacherProfiles.userId, sub.teacherId))).limit(1);
      if (profile) await executor.insert(teacherSubjectAssignments).values({ schoolId, classId, subjectId: sub.id, classSubjectId: mapping.id, teacherId: profile.userId, teacherProfileId: profile.id }).onConflictDoNothing();
    }
  }
  return classSection;
}

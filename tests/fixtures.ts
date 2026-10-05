import { randomInt, randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { classes, subjects, users, schools, exams, teacherSubjectAssignments, classSubjects, teacherProfiles } from "@/db/schema";
import { addMembership, syncClassRelations, yearRecord } from "@/lib/relations";
import { hashPassword, toSafeUser, type SchoolAuthContext } from "@/lib/auth";
import { saveStudent } from "@/lib/student-service";

export async function schoolFixture(district = "Coimbatore", educationalDistrict = "Pollachi", block = "Kinathukadavu") {
  const key = randomUUID().slice(0,8); const year = await yearRecord("2026-2027");
  const [school] = await db.insert(schools).values({ name: `Test School ${key}`, udiseCode: `330${String(randomInt(100000000)).padStart(8,"0")}`, district, educationalDistrict, block, management: "Government", schoolType: "Secondary", adminContactNumber: "9840012345", academicYear: year.label, academicYearId: year.id }).returning();
  async function account(role: "admin" | "teacher", suffix: string) {
    const [user] = await db.insert(users).values({ schoolId: school.id, name: `${suffix} ${key}`, username: `${suffix}.${key}`, passwordHash: hashPassword("StrongTest@123"), role, userType: role === "admin" ? "PRINCIPAL" : "TEACHER" }).returning();
    const membership = await addMembership(db, school.id, user.id, user.username, role === "admin" ? "PRINCIPAL" : "TEACHER");
    const auth: SchoolAuthContext = { user: { ...toSafeUser(user), schoolId: school.id }, school, membershipId: membership.id, roles: [role === "admin" ? "PRINCIPAL" : "TEACHER"], geographicScope: null };
    return auth;
  }
  const admin = await account("admin", "admin"); const teacherA = await account("teacher", "teacherA"); const teacherB = await account("teacher", "teacherB");
  async function classroom(section: string, teacherId: number) {
    const [cls] = await db.insert(classes).values({ schoolId: school.id, name: "Class 10", section, academicYear: year.label, academicYearId: year.id, classTeacherId: teacherId }).returning();
    const subjectRows = await db.insert(subjects).values(["Language", "English", "Mathematics"].map((name,i) => ({ schoolId: school.id, classId: cls.id, code: `C${cls.id}-S${i}`, name, theoryMarks: 0, practicalMarks: 0, internalMarks: 0 }))).returning();
    await syncClassRelations(db, cls.id, school.id);
    return { cls, subjects: subjectRows };
  }
  const a = await classroom("A", teacherA.user.id); const b = await classroom("B", teacherB.user.id);
  async function assign(classId: number, subjectId: number, teacher: SchoolAuthContext) {
    const [pair] = await db.select().from(classSubjects).where(and(eq(classSubjects.schoolId, school.id), eq(classSubjects.classId, classId), eq(classSubjects.subjectId, subjectId))).limit(1);
    const [profile] = await db.select().from(teacherProfiles).where(and(eq(teacherProfiles.schoolId, school.id), eq(teacherProfiles.userId, teacher.user.id))).limit(1);
    await db.insert(teacherSubjectAssignments).values({ schoolId: school.id, classId, subjectId, classSubjectId: pair.id, teacherId: teacher.user.id, teacherProfileId: profile.id });
  }
  await assign(a.cls.id, a.subjects[0].id, teacherA);
  await assign(a.cls.id, a.subjects[1].id, teacherB); await assign(a.cls.id, a.subjects[2].id, teacherB);
  for (const subject of b.subjects) await assign(b.cls.id, subject.id, teacherB);
  const student1 = (await saveStudent(admin, { classId: a.cls.id, name: "Student A", rollNo: 1, gender: "Male", medium: "Tamil" })).student;
  const student2 = (await saveStudent(admin, { classId: a.cls.id, name: "Student B", rollNo: 2, gender: "Female", medium: "English" })).student;
  const student3 = (await saveStudent(admin, { classId: b.cls.id, name: "Student C", rollNo: 1, gender: "Female" })).student;
  const [exam] = await db.insert(exams).values({ schoolId: school.id, name: "Quarterly Examination", academicYear: year.label, academicYearId: year.id }).returning();
  return { school, year, admin, teacherA, teacherB, a, b, student1, student2, student3, exam, account };
}

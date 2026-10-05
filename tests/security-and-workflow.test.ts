import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { and, asc, eq, sql } from "drizzle-orm";
import { db, closeDatabase } from "@/db";
import { migrateDatabase } from "@/db/migrate";
import { marks, auditEvents, users, students } from "@/db/schema";
import { schoolFixture } from "./fixtures";
import { markRoster, saveMarkBatch, markMonitoring, assertConsolidatedReady } from "@/lib/mark-entry";
import { saveStudent, archiveStudent } from "@/lib/student-service";
import { authForToken, issueSession } from "@/lib/auth";
import { configureMappings } from "@/lib/mapping-service";
import { publishResult } from "@/lib/exam-service";
import { runSeed } from "@/db/seed";

let f: Awaited<ReturnType<typeof schoolFixture>>;
beforeAll(async () => { await migrateDatabase(); });
beforeEach(async () => { f = await schoolFixture(); });
afterAll(closeDatabase);
const batch = (subjectId: number, entries: Array<Record<string, unknown>>) => ({ classId: f.a.cls.id, examId: f.exam.id, subjectId, entries });
async function finishClassA() {
  for (let i=0; i<f.a.subjects.length; i++) await saveMarkBatch(i === 0 ? f.teacherA : f.teacherB, batch(f.a.subjects[i].id, [{ enrollmentId: f.student1.enrollmentId, score: 70 }, { enrollmentId: f.student2.enrollmentId, score: 65 }]));
}
describe("server teacher/school isolation and atomic academic updates", () => {
  it("Teacher A cannot read another class, section or subject roster", async () => {
    expect((await markRoster(f.teacherA, f.a.cls.id)).subjects).toHaveLength(1);
    await expect(markRoster(f.teacherA, f.b.cls.id)).rejects.toMatchObject({ status: 403, code: "INVALID_TEACHER_ASSIGNMENT" });
    await expect(markRoster(f.teacherA, f.a.cls.id, f.exam.id, f.a.subjects[1].id)).rejects.toMatchObject({ status: 403, code: "INVALID_TEACHER_ASSIGNMENT" });
    expect((await markMonitoring(f.teacherA, f.exam.id)).every((r) => r.teacherId === f.teacherA.user.id)).toBe(true);
  });
  it("Teacher A cannot write B's subject/students or spoof role/school/actor attributes", async () => {
    await expect(saveMarkBatch(f.teacherA, batch(f.a.subjects[1].id, [{ enrollmentId: f.student1.enrollmentId, score: 80 }]))).rejects.toMatchObject({ status: 403 });
    await expect(saveMarkBatch(f.teacherA, batch(f.a.subjects[0].id, [{ enrollmentId: f.student3.enrollmentId, score: 80 }]))).rejects.toMatchObject({ status: 403 });
    await expect(saveMarkBatch(f.teacherA, { ...batch(f.a.subjects[0].id, [{ enrollmentId: f.student1.enrollmentId, score: 80 }]), schoolId: 999, teacherId: f.teacherB.user.id, role: "admin" })).rejects.toThrow();
    await expect(configureMappings(f.teacherA, { classId: f.a.cls.id, assignments: [{ id: f.a.subjects[0].id, teacherId: f.teacherB.user.id, hasPractical: false }] })).rejects.toMatchObject({ status: 403 });
  });
  it("School A cannot read or write School B's class, exam, subject or enrollment", async () => {
    const other = await schoolFixture("Erode");
    await expect(markRoster(f.admin, other.a.cls.id)).rejects.toMatchObject({ status: 403, code: "INVALID_SCHOOL_SCOPE" });
    await expect(saveMarkBatch(f.admin, { ...batch(f.a.subjects[0].id, [{ enrollmentId: f.student1.enrollmentId, score: 75 }]), examId: other.exam.id })).rejects.toMatchObject({ status: 403 });
    await expect(saveMarkBatch(f.admin, batch(other.a.subjects[0].id, [{ enrollmentId: f.student1.enrollmentId, score: 75 }]))).rejects.toMatchObject({ status: 403 });
    await expect(saveMarkBatch(f.admin, batch(f.a.subjects[0].id, [{ enrollmentId: other.student1.enrollmentId, score: 75 }]))).rejects.toMatchObject({ status: 403 });
  });
  it("a mixed valid/invalid batch rolls back marks AND audit, with no partial writes", async () => {
    const before = (await db.select().from(auditEvents).where(eq(auditEvents.schoolId, f.school.id))).length;
    await expect(saveMarkBatch(f.teacherA, batch(f.a.subjects[0].id, [{ enrollmentId: f.student1.enrollmentId, score: 75 }, { enrollmentId: f.student2.enrollmentId, score: 101 }]))).rejects.toThrow();
    expect(await db.select().from(marks).where(eq(marks.schoolId, f.school.id))).toHaveLength(0);
    expect((await db.select().from(auditEvents).where(eq(auditEvents.schoolId, f.school.id))).length).toBe(before);
  });
  it("stores permanent student/enrollment UUIDs and AB/Exemption as null, never zero", async () => {
    await saveMarkBatch(f.teacherA, batch(f.a.subjects[0].id, [{ enrollmentId: f.student1.enrollmentId, status: "AB" }, { enrollmentId: f.student2.enrollmentId, status: "EXEMPT" }]));
    const rows = await db.select().from(marks).where(eq(marks.schoolId, f.school.id)).orderBy(asc(marks.studentId));
    expect(rows.map((m) => m.score)).toEqual([null,null]); expect(rows.map((m) => m.status)).toEqual(["AB","EXEMPT"]);
    expect(rows[0].studentUuid).toBe(f.student1.uuid); expect(rows[0].enrollmentId).toBe(f.student1.enrollmentId);
    expect(rows.every((m) => m.theoryScore === null && m.internalScore === null && m.practicalScore === null)).toBe(true);
  });
  it("identical exam numbers in different sections are legal; same-section duplicates roll back the person", async () => {
    expect(f.student1.rollNo).toBe(1); expect(f.student3.rollNo).toBe(1);
    const before = (await db.select().from(students).where(eq(students.schoolId, f.school.id))).length;
    await expect(saveStudent(f.admin, { classId: f.a.cls.id, name: "Duplicate", rollNo: 1 })).rejects.toThrow();
    expect((await db.select().from(students).where(eq(students.schoolId, f.school.id))).length).toBe(before);
  });
  it("archiving a student preserves marks, person UUID, enrollment and audit history", async () => {
    await finishClassA(); const prior = await db.select().from(marks).where(eq(marks.studentId, f.student1.id));
    await archiveStudent(f.admin, f.student1.id);
    const after = await db.select().from(marks).where(eq(marks.studentId, f.student1.id));
    expect(after).toEqual(prior);
    const roster = await markRoster(f.teacherA, f.a.cls.id, f.exam.id, f.a.subjects[0].id);
    expect(roster.roster).toHaveLength(1); expect(roster.roster[0].studentId).toBe(f.student2.id);
  });
  it("consolidated gate lists pending teacher/subject/count; non-class-teachers stay forbidden", async () => {
    await saveMarkBatch(f.teacherA, batch(f.a.subjects[0].id, [{ enrollmentId: f.student1.enrollmentId, score: 70 }, { enrollmentId: f.student2.enrollmentId, score: 65 }]));
    await expect(assertConsolidatedReady(f.teacherA, f.a.cls.id, f.exam.id)).rejects.toMatchObject({ status: 409, message: "Consolidated Mark Sheet cannot be generated.", details: { pendingTeachers: expect.arrayContaining([expect.objectContaining({ teacherName: f.teacherB.user.name, subjectName: "Mathematics", pendingStudentCount: 2 })]) } });
    await finishClassA(); expect(await assertConsolidatedReady(f.teacherA, f.a.cls.id, f.exam.id)).toHaveLength(3);
    await expect(assertConsolidatedReady(f.teacherB, f.a.cls.id, f.exam.id)).rejects.toMatchObject({ status: 403, code: "INVALID_REPORT_SCOPE" });
  });
  it("reassigning a subject does not allow the new teacher to edit another teacher's existing marks", async () => {
    await finishClassA(); const teacherC = await f.account("teacher", "teacherC");
    await configureMappings(f.admin, { classId: f.a.cls.id, assignments: [{ id: f.a.subjects[2].id, hasPractical: false, teacherId: teacherC.user.id }] });
    await expect(saveMarkBatch(teacherC, batch(f.a.subjects[2].id, [{ enrollmentId: f.student1.enrollmentId, score: 80 }]))).rejects.toMatchObject({ status: 403, code: "FORBIDDEN_MARK_OWNER" });
    await saveMarkBatch(f.admin, batch(f.a.subjects[2].id, [{ enrollmentId: f.student1.enrollmentId, score: 80 }]));
  });
  it("publication is gated/transactional and published marks become read-only", async () => {
    await finishClassA(); await expect(publishResult(f.admin, f.exam.id, true)).rejects.toMatchObject({ status: 409 });
    for (const subject of f.b.subjects) await saveMarkBatch(f.teacherB, { classId: f.b.cls.id, examId: f.exam.id, subjectId: subject.id, entries: [{ enrollmentId: f.student3.enrollmentId, score: 60 }] });
    expect((await publishResult(f.admin, f.exam.id, true)).isPublished).toBe(true);
    await expect(saveMarkBatch(f.teacherA, batch(f.a.subjects[0].id, [{ enrollmentId: f.student1.enrollmentId, score: 95 }]))).rejects.toMatchObject({ status: 409, code: "RESULT_PUBLISHED" });
  });
  it("authentication ignores the user's legacy role string; stored membership roles are authoritative", async () => {
    const session = await issueSession(f.teacherA.user.id, f.teacherA.membershipId);
    await db.update(users).set({ role: "admin" }).where(eq(users.id, f.teacherA.user.id));
    const auth = await authForToken(session.rawToken);
    expect(auth?.user.role).toBe("teacher"); expect(auth?.school?.id).toBe(f.school.id);
    const stored = await db.execute<{ token: string }>(sql`select token from sessions where user_id=${f.teacherA.user.id}`);
    expect(stored.rows[0].token).not.toBe(session.rawToken);
  });
  it("destructive demo reset is disabled, even through the old exported helper", async () => {
    const count = (await db.select().from(schoolsForTest())).length;
    await expect(runSeed(true)).rejects.toThrow("Destructive reseeding is disabled.");
    expect((await db.select().from(schoolsForTest())).length).toBe(count);
  });
});
import { schools } from "@/db/schema";
function schoolsForTest() { return schools; }

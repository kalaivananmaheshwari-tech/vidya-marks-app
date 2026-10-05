import { and, asc, eq, ilike, isNull, or, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { classes, groups, students, studentEnrollments } from "@/db/schema";
import { handleError, json, numParam, readJson, requireAdmin, requireAuth, str } from "@/lib/api";
import { averageByStudent } from "@/lib/counts";
import { assertClassAccess, classScopeCondition } from "@/lib/authorization";
import { isAdmin } from "@/lib/auth";
import { saveStudent, studentSchema } from "@/lib/student-service";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    const auth = await requireAuth(); const url = new URL(request.url);
    const classId = numParam(url.searchParams.get("classId")); const q = str(url.searchParams.get("q"));
    if (classId) await assertClassAccess(auth, classId);
    const conditions: SQL[] = [eq(students.schoolId, auth.school.id), isNull(students.archivedAt), eq(studentEnrollments.isActive, true), classScopeCondition(auth), isNull(classes.archivedAt)];
    if (classId) conditions.push(eq(studentEnrollments.classId, classId));
    if (q) { const search = or(ilike(students.name, `%${q}%`), ilike(students.admissionNo, `%${q}%`)); if (search) conditions.push(search); }
    const [rows, averages] = await Promise.all([
      db.select({ id: students.id, studentUuid: students.uuid, enrollmentId: studentEnrollments.id, admissionNo: students.admissionNo, emisId: students.emisId, name: students.name, rollNo: studentEnrollments.examNumber, gender: students.gender, medium: students.medium, dob: students.dob, classId: classes.id, className: classes.name, section: classes.section, groupCode: groups.code, guardianName: students.guardianName, contact: students.contact })
        .from(studentEnrollments).innerJoin(students, and(eq(students.id, studentEnrollments.studentId), eq(students.schoolId, studentEnrollments.schoolId)))
        .innerJoin(classes, and(eq(classes.id, studentEnrollments.classId), eq(classes.schoolId, studentEnrollments.schoolId)))
        .leftJoin(groups, and(eq(groups.id, classes.groupId), eq(groups.schoolId, classes.schoolId)))
        .where(and(...conditions)).orderBy(asc(classes.name), asc(classes.section), asc(studentEnrollments.examNumber)),
      averageByStudent(auth.school.id, isAdmin(auth.user) ? undefined : auth.user.id),
    ]);
    return json({ students: rows.map((row) => ({ ...row, avgPercentage: averages.get(row.id) ?? null })) });
  } catch (error) { return handleError(error); }
}
export async function POST(request: Request) {
  try { const auth = await requireAdmin(); const input = await readJson(request, studentSchema.omit({ studentId: true })); return json(await saveStudent(auth, input), 201); }
  catch (error) { return handleError(error); }
}

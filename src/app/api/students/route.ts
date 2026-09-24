import { and, asc, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { classes, groups, students } from "@/db/schema";
import { handleError, int, json, numParam, requireAuth, str } from "@/lib/api";
import { averageByStudent } from "@/lib/counts";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { user } = await requireAuth();
    const url = new URL(request.url);
    const classId = numParam(url.searchParams.get("classId"));
    const q = str(url.searchParams.get("q"));

    const conditions: SQL[] = [eq(students.schoolId, user.schoolId)];
    if (classId) conditions.push(eq(students.classId, classId));
    if (q) {
      const like = `%${q}%`;
      const search = or(
        ilike(students.name, like),
        ilike(students.admissionNo, like),
        ilike(students.guardianName, like),
      );
      if (search) conditions.push(search);
    }

    const [rows, averages] = await Promise.all([
      db
        .select({
          id: students.id,
          admissionNo: students.admissionNo,
          name: students.name,
          rollNo: students.rollNo,
          gender: students.gender,
          dob: students.dob,
          classId: students.classId,
          className: classes.name,
          section: classes.section,
          groupCode: groups.code,
          guardianName: students.guardianName,
          contact: students.contact,
        })
        .from(students)
        .innerJoin(classes, eq(classes.id, students.classId))
        .leftJoin(groups, eq(groups.id, classes.groupId))
        .where(and(...conditions))
        .orderBy(asc(classes.name), asc(classes.section), asc(students.rollNo)),
      averageByStudent(user.schoolId),
    ]);

    return json({
      students: rows.map((row) => ({ ...row, avgPercentage: averages.get(row.id) ?? 0 })),
    });
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(request: Request) {
  try {
    const { user } = await requireAuth();
    const body = await request.json();
    const name = str(body.name);
    const classId = int(body.classId);
    if (!name || !classId) return json({ error: "Student name and class are required." }, 400);

    const [owned] = await db
      .select({ id: classes.id })
      .from(classes)
      .where(and(eq(classes.id, classId), eq(classes.schoolId, user.schoolId)))
      .limit(1);
    if (!owned) return json({ error: "That class does not belong to your school." }, 403);

    let admissionNo = str(body.admissionNo);
    if (!admissionNo) {
      const [total] = await db
        .select({ value: sql<number>`count(*)::int` })
        .from(students)
        .where(eq(students.schoolId, user.schoolId));
      admissionNo = `ADM${new Date().getFullYear()}${String((total?.value ?? 0) + 1).padStart(4, "0")}`;
    }

    let rollNo = int(body.rollNo);
    if (!rollNo) {
      const [max] = await db
        .select({ value: sql<number>`coalesce(max(${students.rollNo}), 0)::int` })
        .from(students)
        .where(eq(students.classId, classId));
      rollNo = (max?.value ?? 0) + 1;
    }

    const [row] = await db
      .insert(students)
      .values({
        schoolId: user.schoolId,
        admissionNo,
        name,
        rollNo,
        gender: str(body.gender) ?? "Female",
        dob: str(body.dob) ?? null,
        classId,
        guardianName: str(body.guardianName) ?? null,
        contact: str(body.contact) ?? null,
      })
      .returning();
    return json({ student: row }, 201);
  } catch (error) {
    return handleError(error);
  }
}

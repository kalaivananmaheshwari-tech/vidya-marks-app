import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { groups, subjects, users } from "@/db/schema";
import { handleError, int, json, requireAuth, str } from "@/lib/api";
import { markCountBySubject } from "@/lib/counts";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { user } = await requireAuth();
    const [rows, counts] = await Promise.all([
      db
        .select({
          id: subjects.id,
          code: subjects.code,
          name: subjects.name,
          classId: subjects.classId,
          groupId: subjects.groupId,
          groupCode: groups.code,
          groupName: groups.name,
          hasPractical: subjects.hasPractical,
          theoryMarks: subjects.theoryMarks,
          practicalMarks: subjects.practicalMarks,
          internalMarks: subjects.internalMarks,
          maxMarks: subjects.maxMarks,
          passMarks: subjects.passMarks,
          teacherId: subjects.teacherId,
          teacherName: users.name,
        })
        .from(subjects)
        .leftJoin(groups, eq(groups.id, subjects.groupId))
        .leftJoin(users, eq(users.id, subjects.teacherId))
        .where(eq(subjects.schoolId, user.schoolId))
        .orderBy(asc(subjects.name), asc(subjects.code)),
      markCountBySubject(user.schoolId),
    ]);

    return json({
      subjects: rows.map((row) => ({ ...row, markCount: counts.get(row.id) ?? 0 })),
    });
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(request: Request) {
  try {
    const { user } = await requireAuth();
    const body = await request.json();
    const code = str(body.code)?.toUpperCase();
    const name = str(body.name);
    if (!code || !name) return json({ error: "Subject code and name are required." }, 400);

    const existing = await db
      .select({ id: subjects.id })
      .from(subjects)
      .where(and(eq(subjects.schoolId, user.schoolId), eq(subjects.code, code)))
      .limit(1);
    if (existing.length) return json({ error: `Subject code ${code} already exists.` }, 409);

    const hasPractical = Boolean(body.hasPractical);
    const theoryMarks = hasPractical ? 70 : 90;
    const practicalMarks = hasPractical ? 20 : 0;
    const internalMarks = 10;
    const maxMarks = 100;

    const [row] = await db
      .insert(subjects)
      .values({
        schoolId: user.schoolId,
        code,
        name,
        classId: int(body.classId) ?? null,
        groupId: int(body.groupId) ?? null,
        hasPractical,
        theoryMarks,
        practicalMarks,
        internalMarks,
        maxMarks,
        passMarks: int(body.passMarks) ?? 35,
        teacherId: int(body.teacherId) ?? null,
      })
      .returning();
    return json({ subject: { ...row, markCount: 0 } }, 201);
  } catch (error) {
    return handleError(error);
  }
}

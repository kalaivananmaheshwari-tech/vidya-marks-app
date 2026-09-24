import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { groups } from "@/db/schema";
import { handleError, json, requireAuth, str } from "@/lib/api";
import { classCountByGroup, studentCountByGroup, subjectCountByGroup } from "@/lib/counts";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { user } = await requireAuth();
    const [rows, classes, subjects, students] = await Promise.all([
      db
        .select({
          id: groups.id,
          code: groups.code,
          name: groups.name,
          stream: groups.stream,
          description: groups.description,
        })
        .from(groups)
        .where(eq(groups.schoolId, user.schoolId))
        .orderBy(asc(groups.code)),
      classCountByGroup(user.schoolId),
      subjectCountByGroup(user.schoolId),
      studentCountByGroup(user.schoolId),
    ]);

    return json({
      groups: rows.map((row) => ({
        ...row,
        classCount: classes.get(row.id) ?? 0,
        subjectCount: subjects.get(row.id) ?? 0,
        studentCount: students.get(row.id) ?? 0,
      })),
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
    if (!code || !name) return json({ error: "Group code and name are required." }, 400);

    const existing = await db
      .select({ id: groups.id })
      .from(groups)
      .where(and(eq(groups.schoolId, user.schoolId), eq(groups.code, code)))
      .limit(1);
    if (existing.length) return json({ error: `Group code ${code} already exists.` }, 409);

    const [row] = await db
      .insert(groups)
      .values({
        schoolId: user.schoolId,
        code,
        name,
        stream: str(body.stream) ?? "General",
        description: str(body.description) ?? null,
      })
      .returning();
    return json({ group: { ...row, classCount: 0, subjectCount: 0, studentCount: 0 } }, 201);
  } catch (error) {
    return handleError(error);
  }
}

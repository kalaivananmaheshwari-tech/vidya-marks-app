import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { classes, subjects } from "@/db/schema";
import { handleError, json, numParam, requireAuth } from "@/lib/api";
import { subjectsForClass } from "@/lib/queries";

export const dynamic = "force-dynamic";

/**
 * Mark Assign API:
 * For each subject of a class:
 * - If user selects 'Yes' (has practical): Theory 70, Practical 20, Internal 10 (Total 100)
 * - Otherwise 'No': Theory 90, Practical 0, Internal 10 (Total 100)
 */
export async function GET(request: Request) {
  try {
    const { user } = await requireAuth();
    const url = new URL(request.url);
    const classId = numParam(url.searchParams.get("classId"));

    if (!classId) {
      return json({ class: null, subjects: [] });
    }

    const { cls, list } = await subjectsForClass(classId, user.schoolId);
    if (!cls) {
      return json({ error: "Class not found" }, 404);
    }

    return json({
      class: cls,
      subjects: list.map((s) => ({
        id: s.id,
        code: s.code,
        name: s.name,
        hasPractical: s.hasPractical,
        theoryMarks: s.theoryMarks ?? (s.hasPractical ? 70 : 90),
        practicalMarks: s.practicalMarks ?? (s.hasPractical ? 20 : 0),
        internalMarks: s.internalMarks ?? 10,
        maxMarks: s.maxMarks ?? 100,
        passMarks: s.passMarks ?? 35,
        teacherId: s.teacherId,
        teacherName: s.teacherName,
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
    const classId = Number(body.classId);
    const assignments = Array.isArray(body.assignments) ? body.assignments : [];

    if (!classId) {
      return json({ error: "Class is required" }, 400);
    }

    const [cls] = await db
      .select({ id: classes.id })
      .from(classes)
      .where(and(eq(classes.id, classId), eq(classes.schoolId, user.schoolId)))
      .limit(1);

    if (!cls) {
      return json({ error: "Class not found" }, 404);
    }

    let updatedCount = 0;
    for (const item of assignments) {
      const subjectId = Number(item.id);
      if (!subjectId) continue;

      const hasPractical = Boolean(item.hasPractical);
      // As requested:
      // If user select 'Yes' that subject Theory mark is 70, Practical 20, Internal 10.
      // otherwise The Subject having Theory mark 90, Internal 10.
      const theoryMarks = hasPractical ? 70 : 90;
      const practicalMarks = hasPractical ? 20 : 0;
      const internalMarks = 10;
      const maxMarks = 100;
      const passMarks = hasPractical ? 35 : 35;

      await db
        .update(subjects)
        .set({
          hasPractical,
          theoryMarks,
          practicalMarks,
          internalMarks,
          maxMarks,
          passMarks,
          teacherId: item.teacherId !== undefined ? (item.teacherId ? Number(item.teacherId) : null) : undefined,
        })
        .where(and(eq(subjects.id, subjectId), eq(subjects.schoolId, user.schoolId)));

      updatedCount++;
    }

    return json({ success: true, updatedCount });
  } catch (error) {
    return handleError(error);
  }
}

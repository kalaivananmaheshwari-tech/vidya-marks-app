import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { subjects } from "@/db/schema";
import { handleError, int, json, notFound, requireAuth, str } from "@/lib/api";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Ctx) {
  try {
    const { user } = await requireAuth();
    const { id } = await params;
    const body = await request.json();

    const hasPractical = typeof body.hasPractical === "boolean" ? body.hasPractical : undefined;
    let theoryMarks: number | undefined = undefined;
    let practicalMarks: number | undefined = undefined;
    let internalMarks: number | undefined = undefined;

    if (hasPractical !== undefined) {
      theoryMarks = hasPractical ? 70 : 90;
      practicalMarks = hasPractical ? 20 : 0;
      internalMarks = 10;
    }

    const [row] = await db
      .update(subjects)
      .set({
        code: str(body.code)?.toUpperCase(),
        name: str(body.name),
        groupId: body.groupId === null || body.groupId === "" ? null : int(body.groupId),
        classId: body.classId === null || body.classId === "" ? null : int(body.classId),
        hasPractical,
        theoryMarks,
        practicalMarks,
        internalMarks,
        maxMarks: 100,
        passMarks: int(body.passMarks),
        teacherId: body.teacherId === null || body.teacherId === "" ? null : int(body.teacherId),
      })
      .where(and(eq(subjects.id, Number(id)), eq(subjects.schoolId, user.schoolId)))
      .returning();
    if (!row) return notFound("Subject not found");
    return json({ subject: row });
  } catch (error) {
    return handleError(error);
  }
}

export async function DELETE(_request: Request, { params }: Ctx) {
  try {
    const { user } = await requireAuth();
    const { id } = await params;
    const [row] = await db
      .delete(subjects)
      .where(and(eq(subjects.id, Number(id)), eq(subjects.schoolId, user.schoolId)))
      .returning();
    if (!row) return notFound("Subject not found");
    return json({ ok: true });
  } catch (error) {
    return handleError(error);
  }
}

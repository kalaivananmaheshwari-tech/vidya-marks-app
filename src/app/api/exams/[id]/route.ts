import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { exams } from "@/db/schema";
import { handleError, int, json, notFound, requireAuth, str } from "@/lib/api";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Ctx) {
  try {
    const { user } = await requireAuth();
    const { id } = await params;
    const body = await request.json();
    const [row] = await db
      .update(exams)
      .set({
        name: str(body.name),
        month: body.month === "" ? null : str(body.month),
        year: body.year === "" ? null : str(body.year),
        term: str(body.term),
        academicYear: str(body.academicYear),
        maxMarks: int(body.maxMarks),
        startDate: body.startDate === "" ? null : str(body.startDate),
        isPublished: typeof body.isPublished === "boolean" ? body.isPublished : undefined,
      })
      .where(and(eq(exams.id, Number(id)), eq(exams.schoolId, user.schoolId)))
      .returning();
    if (!row) return notFound("Exam not found");
    return json({ exam: row });
  } catch (error) {
    return handleError(error);
  }
}

export async function DELETE(_request: Request, { params }: Ctx) {
  try {
    const { user } = await requireAuth();
    const { id } = await params;
    const [row] = await db
      .delete(exams)
      .where(and(eq(exams.id, Number(id)), eq(exams.schoolId, user.schoolId)))
      .returning();
    if (!row) return notFound("Exam not found");
    return json({ ok: true });
  } catch (error) {
    return handleError(error);
  }
}

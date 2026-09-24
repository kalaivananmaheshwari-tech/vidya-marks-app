import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { students } from "@/db/schema";
import { handleError, int, json, notFound, requireAuth, str } from "@/lib/api";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Ctx) {
  try {
    const { user } = await requireAuth();
    const { id } = await params;
    const body = await request.json();
    const [row] = await db
      .update(students)
      .set({
        admissionNo: str(body.admissionNo),
        name: str(body.name),
        rollNo: int(body.rollNo),
        gender: str(body.gender),
        dob: body.dob === "" ? null : str(body.dob),
        classId: int(body.classId),
        guardianName: body.guardianName === "" ? null : str(body.guardianName),
        contact: body.contact === "" ? null : str(body.contact),
      })
      .where(and(eq(students.id, Number(id)), eq(students.schoolId, user.schoolId)))
      .returning();
    if (!row) return notFound("Student not found");
    return json({ student: row });
  } catch (error) {
    return handleError(error);
  }
}

export async function DELETE(_request: Request, { params }: Ctx) {
  try {
    const { user } = await requireAuth();
    const { id } = await params;
    const [row] = await db
      .delete(students)
      .where(and(eq(students.id, Number(id)), eq(students.schoolId, user.schoolId)))
      .returning();
    if (!row) return notFound("Student not found");
    return json({ ok: true });
  } catch (error) {
    return handleError(error);
  }
}

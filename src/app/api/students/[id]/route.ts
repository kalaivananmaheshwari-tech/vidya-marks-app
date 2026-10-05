import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { students } from "@/db/schema";
import { handleError, json, notFound, numParam, readJson, requireAdmin } from "@/lib/api";
import { archiveStudent, saveStudent, studentSchema } from "@/lib/student-service";
export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };
export async function PATCH(request: Request, { params }: Ctx) {
  try {
    const auth = await requireAdmin(); const id = numParam((await params).id)!;
    const body = await readJson(request, studentSchema.omit({ studentId: true }).partial());
    const [prior] = await db.select().from(students).where(and(eq(students.id, id), eq(students.schoolId, auth.school.id), isNull(students.archivedAt))).limit(1);
    if (!prior) return notFound("Student not found.");
    return json(await saveStudent(auth, { studentId: id, classId: body.classId ?? prior.classId, name: body.name ?? prior.name, ...body }));
  } catch (error) { return handleError(error); }
}
export async function DELETE(_request: Request, { params }: Ctx) {
  try { const auth = await requireAdmin(); return json(await archiveStudent(auth, numParam((await params).id)!)); }
  catch (error) { return handleError(error); }
}

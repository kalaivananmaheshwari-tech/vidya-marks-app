import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { groups } from "@/db/schema";
import { handleError, json, notFound, requireAuth, str } from "@/lib/api";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Ctx) {
  try {
    const { user } = await requireAuth();
    const { id } = await params;
    const body = await request.json();
    const [row] = await db
      .update(groups)
      .set({
        code: str(body.code)?.toUpperCase(),
        name: str(body.name),
        stream: str(body.stream),
        description: body.description === "" ? null : str(body.description),
      })
      .where(and(eq(groups.id, Number(id)), eq(groups.schoolId, user.schoolId)))
      .returning();
    if (!row) return notFound("Group not found");
    return json({ group: row });
  } catch (error) {
    return handleError(error);
  }
}

export async function DELETE(_request: Request, { params }: Ctx) {
  try {
    const { user } = await requireAuth();
    const { id } = await params;
    const [row] = await db
      .delete(groups)
      .where(and(eq(groups.id, Number(id)), eq(groups.schoolId, user.schoolId)))
      .returning();
    if (!row) return notFound("Group not found");
    return json({ ok: true });
  } catch (error) {
    return handleError(error);
  }
}

import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { handleError, json, notFound, requireAdmin, str } from "@/lib/api";
import { hashPassword } from "@/lib/auth";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Ctx) {
  try {
    const { user } = await requireAdmin();
    const { id } = await params;
    const targetId = Number(id);
    const body = await request.json();
    const password = str(body.password);

    if (password && password.length < 6) {
      return json({ error: "Password must be at least 6 characters." }, 400);
    }
    if (targetId === user.id && body.isActive === false) {
      return json({ error: "You cannot deactivate your own admin account." }, 400);
    }

    const [row] = await db
      .update(users)
      .set({
        name: str(body.name),
        designation: body.designation === "" ? null : str(body.designation),
        email: body.email === "" ? null : str(body.email),
        phone: body.phone === "" ? null : str(body.phone),
        handlingSubjects: body.handlingSubjects === "" ? null : str(body.handlingSubjects),
        isActive: typeof body.isActive === "boolean" ? body.isActive : undefined,
        passwordHash: password ? hashPassword(password) : undefined,
        mustChangePassword: password ? true : undefined,
      })
      .where(and(eq(users.id, targetId), eq(users.schoolId, user.schoolId)))
      .returning({
        id: users.id,
        name: users.name,
        username: users.username,
        email: users.email,
        role: users.role,
        designation: users.designation,
        phone: users.phone,
        handlingSubjects: users.handlingSubjects,
        isActive: users.isActive,
        lastLoginAt: users.lastLoginAt,
      });
    if (!row) return notFound("Staff member not found");
    return json({ teacher: row });
  } catch (error) {
    return handleError(error);
  }
}

export async function DELETE(_request: Request, { params }: Ctx) {
  try {
    const { user } = await requireAdmin();
    const { id } = await params;
    const targetId = Number(id);
    if (user.id === targetId) {
      return json({ error: "You cannot remove your own admin account." }, 400);
    }
    const [target] = await db
      .select({ role: users.role })
      .from(users)
      .where(and(eq(users.id, targetId), eq(users.schoolId, user.schoolId)))
      .limit(1);
    if (!target) return notFound("Staff member not found");
    if (target.role === "admin") {
      return json({ error: "The school admin account cannot be deleted." }, 400);
    }
    await db.delete(users).where(and(eq(users.id, targetId), eq(users.schoolId, user.schoolId)));
    return json({ ok: true });
  } catch (error) {
    return handleError(error);
  }
}

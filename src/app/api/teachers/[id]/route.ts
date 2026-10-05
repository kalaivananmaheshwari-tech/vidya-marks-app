import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { users, sessions, schoolMemberships, schools, teacherSubjectAssignments } from "@/db/schema";
import { handleError, HttpError, json, notFound, numParam, readJson, requireAdmin } from "@/lib/api";
import { hashPassword } from "@/lib/auth";
import { audit } from "@/lib/audit";
export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };
const input = z.object({ name: z.string().trim().min(1).max(150).optional(), designation: z.string().trim().max(100).optional(), email: z.union([z.string().email(), z.literal("")]).optional(), phone: z.string().trim().max(20).optional(), handlingSubjects: z.string().trim().max(500).optional(), password: z.string().min(10).max(128).optional(), isActive: z.boolean().optional() }).strict();
export async function PATCH(request: Request, { params }: Ctx) {
  try {
    const auth = await requireAdmin(); const id = numParam((await params).id)!; const body = await readJson(request, input);
    const user = await db.transaction(async (tx) => {
      const [prior] = await tx.select().from(users).where(and(eq(users.id, id), eq(users.schoolId, auth.school.id))).for("update");
      if (!prior) throw new HttpError("Staff member not found.", 404, "NOT_FOUND");
      if (id === auth.user.id && body.isActive === false) throw new HttpError("You cannot deactivate your own administrator account.");
      if (prior.role === "admin" && body.isActive === false) throw new HttpError("A school administrator cannot be deactivated through teacher management.");
      if (body.isActive === true && prior.role === "teacher") {
        const [mapping] = await tx.select().from(teacherSubjectAssignments).where(and(eq(teacherSubjectAssignments.schoolId, auth.school.id), eq(teacherSubjectAssignments.teacherId, id))).limit(1);
        if (!mapping) throw new HttpError("Map at least one class, section and subject before enabling this teacher.", 409, "MAPPING_REQUIRED");
      }
      let phone = body.phone;
      if (prior.role === "admin" && phone !== undefined) {
        const digits = phone.replace(/\D/g, ""); phone = digits.length === 12 && digits.startsWith("91") ? digits.slice(2) : digits;
        if (!/^[6-9]\d{9}$/.test(phone)) throw new HttpError("Admin Contact Number must be a valid 10-digit mobile number.");
        await tx.update(schools).set({ adminContactNumber: phone, phone }).where(eq(schools.id, auth.school.id));
      }
      const [row] = await tx.update(users).set({ name: body.name, designation: body.designation === "" ? null : body.designation, email: body.email === "" ? null : body.email, phone: phone === "" ? null : phone, handlingSubjects: body.handlingSubjects === "" ? null : body.handlingSubjects, isActive: body.isActive, passwordHash: body.password ? hashPassword(body.password) : undefined, mustChangePassword: body.password ? true : undefined }).where(and(eq(users.id, id), eq(users.schoolId, auth.school.id))).returning({ id: users.id, name: users.name, username: users.username, email: users.email, role: users.role, designation: users.designation, phone: users.phone, handlingSubjects: users.handlingSubjects, isActive: users.isActive, lastLoginAt: users.lastLoginAt });
      if (body.isActive !== undefined) await tx.update(schoolMemberships).set({ isActive: body.isActive }).where(and(eq(schoolMemberships.schoolId, auth.school.id), eq(schoolMemberships.userId, id)));
      if (body.password || body.isActive === false) await tx.delete(sessions).where(eq(sessions.userId, id));
      await audit(tx, auth, "staff.updated", "users", id, { changedFields: Object.keys(body), sessionsInvalidated: Boolean(body.password || body.isActive === false) }); return row;
    });
    return json({ teacher: user });
  } catch (error) { return handleError(error); }
}
export async function DELETE(_request: Request, { params }: Ctx) {
  try {
    const auth = await requireAdmin(); const id = numParam((await params).id)!;
    const result = await db.transaction(async (tx) => {
      const [target] = await tx.select().from(users).where(and(eq(users.id, id), eq(users.schoolId, auth.school.id))).limit(1);
      if (!target) return null;
      if (target.role === "admin" || id === auth.user.id) throw new HttpError("The school administrator account cannot be removed.");
      await tx.update(users).set({ isActive: false }).where(and(eq(users.id, id), eq(users.schoolId, auth.school.id)));
      await tx.update(schoolMemberships).set({ isActive: false }).where(and(eq(schoolMemberships.schoolId, auth.school.id), eq(schoolMemberships.userId, id)));
      await tx.delete(sessions).where(eq(sessions.userId, id));
      await audit(tx, auth, "teacher.deactivated", "users", id, { historicalDataPreserved: true }); return target;
    });
    return result ? json({ ok: true, deactivated: true }) : notFound("Staff member not found.");
  } catch (error) { return handleError(error); }
}

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { schools, users } from "@/db/schema";
import { createSession, toSafeUser, verifyPassword } from "@/lib/auth";
import { badRequest, handleError, json } from "@/lib/api";
import { ensureSeed } from "@/db/seed";

export const dynamic = "force-dynamic";

/** Sign in with the school UDISE code (admin) or a teacher username issued by the admin. */
export async function POST(request: Request) {
  try {
    await ensureSeed().catch(() => undefined);
    const body = (await request.json()) as { username?: string; password?: string };
    const username = body.username?.trim().toLowerCase().replace(/\s/g, "");
    const password = body.password ?? "";
    if (!username || !password) return badRequest("Username and password are required.");

    const rows = await db
      .select({ user: users, school: schools })
      .from(users)
      .innerJoin(schools, eq(schools.id, users.schoolId))
      .where(eq(users.username, username))
      .limit(1);

    const row = rows[0];
    if (!row || !verifyPassword(password, row.user.passwordHash)) {
      return Response.json(
        { error: "Invalid UDISE code / username or password." },
        { status: 401 },
      );
    }
    if (!row.user.isActive) {
      return Response.json(
        { error: "This account has been deactivated by the school admin." },
        { status: 403 },
      );
    }

    await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, row.user.id));
    await createSession(row.user.id);
    return json({ user: toSafeUser(row.user), school: row.school });
  } catch (error) {
    return handleError(error);
  }
}

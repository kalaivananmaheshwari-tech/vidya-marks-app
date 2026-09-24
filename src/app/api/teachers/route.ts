import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { handleError, json, requireAdmin, requireAuth, str } from "@/lib/api";
import { hashPassword } from "@/lib/auth";
import { classCountByTeacher, subjectCountByTeacher } from "@/lib/counts";

export const dynamic = "force-dynamic";

const USERNAME_RE = /^[a-zA-Z0-9._-]{4,32}$/;

export async function GET() {
  try {
    const { user } = await requireAuth();
    const [rows, classCounts, subjectCounts] = await Promise.all([
      db
        .select({
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
        })
        .from(users)
        .where(eq(users.schoolId, user.schoolId))
        .orderBy(asc(users.role), asc(users.name)),
      classCountByTeacher(user.schoolId),
      subjectCountByTeacher(user.schoolId),
    ]);

    return json({
      teachers: rows.map((row) => ({
        ...row,
        classCount: classCounts.get(row.id) ?? 0,
        subjectCount: subjectCounts.get(row.id) ?? 0,
      })),
    });
  } catch (error) {
    return handleError(error);
  }
}

/** Only the school admin can create teacher logins. */
export async function POST(request: Request) {
  try {
    const { user } = await requireAdmin();
    const body = await request.json();
    const name = str(body.name);
    const username = str(body.username)?.toLowerCase();
    const password = str(body.password);

    if (!name) return json({ error: "Teacher name is required." }, 400);
    if (!username || !USERNAME_RE.test(username)) {
      return json(
        { error: "Username must be 4-32 characters using letters, numbers, dot, dash or underscore." },
        400,
      );
    }
    if (!password || password.length < 6) {
      return json({ error: "Password must be at least 6 characters." }, 400);
    }

    const [taken] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.username, username))
      .limit(1);
    if (taken) return json({ error: `Username "${username}" is already taken.` }, 409);

    const [row] = await db
      .insert(users)
      .values({
        schoolId: user.schoolId,
        username,
        name,
        passwordHash: hashPassword(password),
        role: "teacher",
        designation: str(body.designation) ?? null,
        email: str(body.email) ?? null,
        phone: str(body.phone) ?? null,
        handlingSubjects: str(body.handlingSubjects) ?? null,
        mustChangePassword: true,
      })
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
    return json({ teacher: { ...row, classCount: 0, subjectCount: 0 } }, 201);
  } catch (error) {
    return handleError(error);
  }
}

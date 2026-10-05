import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users, schoolMemberships } from "@/db/schema";
import { authForToken, hashPassword, issueSession, setSessionCookie, verifyPassword } from "@/lib/auth";
import { handleError, HttpError, json, readJson } from "@/lib/api";
import { ensureSeed } from "@/db/seed";
import { consumeRateLimit, requestFingerprint, securityKey } from "@/lib/security";
import { audit } from "@/lib/audit";
export const dynamic = "force-dynamic";
const input = z.object({ username: z.string().trim().min(1).max(64), password: z.string().min(1).max(128) }).strict();
const dummyHash = hashPassword("unused constant-time comparison");
export async function POST(request: Request) {
  try {
    await ensureSeed(); const body = await readJson(request, input);
    const username = body.username.toLowerCase().replace(/\s/g, "");
    await consumeRateLimit(`login:user:${securityKey(username)}`, 10, 15 * 60 * 1000);
    await consumeRateLimit(`login:source:${requestFingerprint(request)}`, 100, 15 * 60 * 1000);
    const [user] = await db.select().from(users).where(eq(users.username, username)).limit(1);
    const valid = verifyPassword(body.password, user?.passwordHash ?? dummyHash);
    if (!user || !valid || !user.isActive) {
      await db.transaction((tx) => audit(tx, null, "login.failed", "security", null, { usernameKey: securityKey(username) }));
      throw new HttpError("Invalid username or password.", 401, "UNAUTHORIZED");
    }
    const result = await db.transaction(async (tx) => {
      const memberships = await tx.select().from(schoolMemberships).where(eq(schoolMemberships.userId, user.id));
      const membership = memberships.find((m) => m.isActive && (user.schoolId === null || m.schoolId === user.schoolId));
      const session = await issueSession(user.id, membership?.id ?? null, tx);
      const auth = await authForToken(session.rawToken, tx);
      if (!auth) throw new HttpError("This account has no active authorized membership.", 403, "FORBIDDEN");
      await tx.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id));
      await audit(tx, auth, "login.succeeded", "sessions", null, { role: auth.user.userType });
      return { auth, session };
    });
    await setSessionCookie(result.session);
    return json({ user: result.auth.user, school: result.auth.school, geographicScope: result.auth.geographicScope });
  } catch (error) { return handleError(error); }
}

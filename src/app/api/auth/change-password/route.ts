import { z } from "zod";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { users, sessions, recoveryChallenges } from "@/db/schema";
import { handleError, HttpError, json, readJson, requireSession } from "@/lib/api";
import { hashPassword, issueSession, setSessionCookie, verifyPassword } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { consumeRateLimit } from "@/lib/security";
export const dynamic = "force-dynamic";
const input = z.object({ currentPassword: z.string().min(1).max(128), newPassword: z.string().min(10).max(128), confirmPassword: z.string().min(10).max(128) }).strict().refine((b) => b.newPassword === b.confirmPassword, "Passwords do not match.");
export async function POST(request: Request) {
  try {
    const auth = await requireSession(); const body = await readJson(request, input);
    await consumeRateLimit(`password-change:${auth.user.id}`, 5, 15 * 60 * 1000);
    const session = await db.transaction(async (tx) => {
      const [user] = await tx.select().from(users).where(eq(users.id, auth.user.id)).for("update");
      if (!user || !verifyPassword(body.currentPassword, user.passwordHash)) throw new HttpError("Current password is incorrect.", 400, "INVALID_PASSWORD");
      if (verifyPassword(body.newPassword, user.passwordHash)) throw new HttpError("Choose a new password different from the temporary/current password.",400,"NEW_PASSWORD_REQUIRED");
      await tx.update(users).set({ passwordHash: hashPassword(body.newPassword), mustChangePassword: false }).where(eq(users.id, auth.user.id));
      await tx.update(recoveryChallenges).set({usedAt:new Date()}).where(and(eq(recoveryChallenges.userId,auth.user.id),isNull(recoveryChallenges.usedAt)));
      await tx.delete(sessions).where(eq(sessions.userId, auth.user.id));
      await audit(tx, auth, "security.password_changed", "users", auth.user.id, { previousSessionsInvalidated: true });
      return issueSession(auth.user.id, auth.membershipId, tx);
    });
    await setSessionCookie(session); return json({ ok: true });
  } catch (error) { return handleError(error); }
}

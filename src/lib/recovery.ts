import { createHmac, randomInt, randomUUID, timingSafeEqual } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { recoveryChallenges, schools, users, sessions, schoolMemberships, membershipRoles } from "@/db/schema";
import { hashPassword } from "@/lib/auth";
import { HttpError } from "@/lib/http";
import { consumeRateLimit, securityKey } from "@/lib/security";
import { audit } from "@/lib/audit";

export interface RecoveryProvider { send(to: string, message: string): Promise<void> }
export type RecoveryConfiguration = { secret: string; provider: RecoveryProvider };
export const RECOVERY_TTL_MS = 5 * 60 * 1000;
export const RECOVERY_MAX_ATTEMPTS = 5;
const GENERIC_MESSAGE = "If an eligible account exists, a verification code has been sent to its previously registered Admin Contact Number.";
export function configuredRecovery(): RecoveryConfiguration | null {
  const secret = process.env.RECOVERY_SECRET; const url = process.env.SMS_WEBHOOK_URL; const key = process.env.SMS_API_KEY;
  if (!secret || secret.length < 32 || !url || !key) return null;
  try { if (new URL(url).protocol !== "https:") return null; } catch { return null; }
  return { secret, provider: { async send(to, message) {
    const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` }, body: JSON.stringify({ to, message }), signal: AbortSignal.timeout(10000), redirect: "error" });
    if (!response.ok) throw new Error("Recovery delivery unavailable");
    // Never return/log provider responses or credentials.
  } } };
}
export function otpDigest(secret: string, challengeId: string, otp: string) {
  return createHmac("sha256", secret).update(`${challengeId}:${otp}`).digest("hex");
}
export async function requestRecovery(username: string, fingerprint: string, configuration: RecoveryConfiguration | null = configuredRecovery()) {
  if (!configuration) throw new HttpError("Verified SMS recovery is unavailable until a delivery provider is configured. Contact your school administrator.", 503, "RECOVERY_UNAVAILABLE");
  const normalized = username.trim().toLowerCase(); const usernameKey = securityKey(`recovery:${normalized}`);
  await consumeRateLimit(`recovery:cooldown:${usernameKey}`, 1, 60 * 1000);
  await consumeRateLimit(`recovery:hour:${usernameKey}`, 5, 60 * 60 * 1000);
  await consumeRateLimit(`recovery:source:${fingerprint}`, 20, 60 * 60 * 1000);
  const [target] = await db.select({ user: users, school: schools }).from(users)
    .innerJoin(schoolMemberships, and(eq(schoolMemberships.userId, users.id), eq(schoolMemberships.isActive, true)))
    .innerJoin(membershipRoles, and(eq(membershipRoles.membershipId, schoolMemberships.id), inArray(membershipRoles.role, ["ADMIN", "HEADMASTER", "PRINCIPAL"])))
    .innerJoin(schools, eq(schools.id, schoolMemberships.schoolId))
    .where(and(eq(users.username, normalized), eq(users.isActive, true))).limit(1);
  const registered = target?.school.adminContactNumber?.replace(/\D/g, "") ?? "";
  const eligible = Boolean(target && /^(?:91)?[6-9]\d{9}$/.test(registered));
  const id = randomUUID(); const otp = String(randomInt(0, 1000000)).padStart(6, "0");
  await db.transaction(async (tx) => {
    await tx.update(recoveryChallenges).set({ usedAt: new Date() }).where(eq(recoveryChallenges.usernameKey, usernameKey));
    await tx.insert(recoveryChallenges).values({ id, userId: eligible ? target!.user.id : null, usernameKey, otpHash: otpDigest(configuration.secret, id, otp), expiresAt: new Date(Date.now() + RECOVERY_TTL_MS) });
    await audit(tx, null, "recovery.requested", "recovery_challenges", id, { usernameKey }, eligible ? target!.school.id : undefined);
  });
  if (eligible) {
    try { await configuration.provider.send(registered, `Vidya Analytics password recovery code: ${otp}. Valid for 5 minutes. Do not share it.`); }
    catch {
      await db.transaction(async (tx) => {
        await tx.update(recoveryChallenges).set({ usedAt: new Date() }).where(eq(recoveryChallenges.id, id));
        await audit(tx, null, "recovery.delivery_failed", "recovery_challenges", id, {}, target!.school.id);
      });
      // Same public response as a decoy. Monitoring uses the secret-free audit event.
    }
  }
  return { ok: true, challengeId: id, message: GENERIC_MESSAGE, resendAfterSeconds: 60 };
}
export async function resetWithRecovery(challengeId: string, otp: string, newPassword: string, configuration: RecoveryConfiguration | null = configuredRecovery()) {
  if (!configuration) throw new HttpError("Verified SMS recovery is unavailable until a delivery provider is configured.", 503, "RECOVERY_UNAVAILABLE");
  if (!/^\d{6}$/.test(otp) || newPassword.length < 10 || newPassword.length > 128) throw new HttpError("Use a six-digit verification code and a password of at least 10 characters.");
  const ok = await db.transaction(async (tx) => {
    const [challenge] = await tx.select().from(recoveryChallenges).where(eq(recoveryChallenges.id, challengeId)).for("update");
    if (!challenge || challenge.usedAt || challenge.expiresAt.getTime() <= Date.now() || challenge.attempts >= RECOVERY_MAX_ATTEMPTS) return false;
    const candidate = Buffer.from(otpDigest(configuration.secret, challengeId, otp), "hex"); const expected = Buffer.from(challenge.otpHash, "hex");
    const matches = candidate.length === expected.length && timingSafeEqual(candidate, expected);
    const attempt = challenge.attempts + 1;
    if (!matches || !challenge.userId) {
      await tx.update(recoveryChallenges).set({ attempts: attempt, ...(attempt >= RECOVERY_MAX_ATTEMPTS ? { usedAt: new Date() } : {}) }).where(eq(recoveryChallenges.id, challenge.id));
      await audit(tx, null, "recovery.verification_failed", "recovery_challenges", challenge.id, { attempt }); return false;
    }
    const [user] = await tx.select().from(users).where(and(eq(users.id, challenge.userId), eq(users.isActive, true))).limit(1);
    if (!user) return false;
    await tx.update(recoveryChallenges).set({ attempts: attempt, usedAt: new Date() }).where(eq(recoveryChallenges.id, challenge.id));
    await tx.update(users).set({ passwordHash: hashPassword(newPassword), mustChangePassword: false }).where(eq(users.id, user.id));
    await tx.delete(sessions).where(eq(sessions.userId, user.id));
    await audit(tx, { user: { id: user.id, schoolId: user.schoolId } }, "recovery.password_reset", "users", user.id, { sessionsInvalidated: true });
    return true;
  });
  if (!ok) throw new HttpError("Verification code is invalid, expired or already used.", 400, "INVALID_RECOVERY_CODE");
  return { ok: true, message: "Password reset. Existing sessions were invalidated. Sign in with your new password." };
}

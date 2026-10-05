import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db, closeDatabase } from "@/db";
import { migrateDatabase } from "@/db/migrate";
import { recoveryChallenges, users, auditEvents } from "@/db/schema";
import { schoolFixture } from "./fixtures";
import { configuredRecovery, requestRecovery, resetWithRecovery, type RecoveryConfiguration } from "@/lib/recovery";
import { issueSession, authForToken, verifyPassword } from "@/lib/auth";

let f: Awaited<ReturnType<typeof schoolFixture>>; let messages: Array<{to:string;message:string}>;
const config: RecoveryConfiguration = { secret: "test-only-recovery-hmac-secret-at-least-32-characters", provider: { async send(to,message) { messages.push({to,message}); } } };
beforeAll(async () => { await migrateDatabase(); });
beforeEach(async () => { f = await schoolFixture(); messages=[]; });
afterAll(closeDatabase);
describe("verified recovery security", () => {
  it("fails closed without a configured delivery provider", async () => {
    expect(configuredRecovery()).toBeNull();
    await expect(requestRecovery(f.admin.user.username, "test", null)).rejects.toMatchObject({status:503,code:"RECOVERY_UNAVAILABLE"});
  });
  it("known/unknown accounts have the same response shape; sends ONLY to registered admin contact", async () => {
    const known = await requestRecovery(f.admin.user.username,"known-test",config);
    const unknown = await requestRecovery(`unknown.${f.school.id}`,"unknown-test",config);
    expect(Object.keys(known)).toEqual(Object.keys(unknown)); expect(known.message).toBe(unknown.message);
    expect(messages).toHaveLength(1); expect(messages[0].to).toBe(f.school.adminContactNumber);
    const rawOtp = messages[0].message.match(/\b\d{6}\b/)![0];
    expect(JSON.stringify(known)).not.toContain(rawOtp);
    const [challenge] = await db.select().from(recoveryChallenges).where(eq(recoveryChallenges.id,known.challengeId));
    expect(challenge.otpHash).not.toBe(rawOtp); expect(challenge.otpHash).toHaveLength(64);
  });
  it("enforces resend cooldown and five wrong attempts; correct OTP cannot revive an exhausted challenge", async () => {
    const start = await requestRecovery(f.admin.user.username,`source-${f.school.id}`,config);
    await expect(requestRecovery(f.admin.user.username,`other-source-${f.school.id}`,config)).rejects.toMatchObject({status:429});
    const otp = messages[0].message.match(/\b\d{6}\b/)![0]; const wrong = otp === "000000" ? "000001" : "000000";
    for(let i=0;i<5;i++) await expect(resetWithRecovery(start.challengeId,wrong,"NewSecure@1234",config)).rejects.toMatchObject({code:"INVALID_RECOVERY_CODE"});
    await expect(resetWithRecovery(start.challengeId,otp,"NewSecure@1234",config)).rejects.toMatchObject({code:"INVALID_RECOVERY_CODE"});
  });
  it("expires challenges and invalidates all existing sessions atomically after a single successful reset", async () => {
    const session = await issueSession(f.admin.user.id, f.admin.membershipId);
    const start = await requestRecovery(f.admin.user.username,`source-${f.school.id}`,config);
    const otp = messages[0].message.match(/\b\d{6}\b/)![0];
    expect((await resetWithRecovery(start.challengeId,otp,"NewSecure@1234",config)).ok).toBe(true);
    expect(await authForToken(session.rawToken)).toBeNull();
    await expect(resetWithRecovery(start.challengeId,otp,"AnotherSecure@1234",config)).rejects.toMatchObject({code:"INVALID_RECOVERY_CODE"});
    const [user] = await db.select().from(users).where(eq(users.id,f.admin.user.id));
    expect(verifyPassword("NewSecure@1234",user.passwordHash)).toBe(true);
    const events = await db.select().from(auditEvents).where(eq(auditEvents.schoolId,f.school.id));
    expect(events.some((e)=>e.action==="recovery.password_reset")).toBe(true);
    expect(JSON.stringify(events)).not.toContain(otp); expect(JSON.stringify(events)).not.toContain("NewSecure@1234");
    const expired = await requestRecovery(`unknown-expired-${f.school.id}`,`expired-source-${f.school.id}`,config);
    await db.update(recoveryChallenges).set({expiresAt:new Date(Date.now()-1)}).where(eq(recoveryChallenges.id,expired.challengeId));
    await expect(resetWithRecovery(expired.challengeId,"123456","NewSecure@1234",config)).rejects.toMatchObject({code:"INVALID_RECOVERY_CODE"});
  });
});

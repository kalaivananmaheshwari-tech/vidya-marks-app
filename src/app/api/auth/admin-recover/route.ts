import { z } from "zod";
import { ensureSchema } from "@/db/bootstrap";
import { handleError, json, readJson } from "@/lib/http";
import { configuredRecovery, requestRecovery, resetWithRecovery } from "@/lib/recovery";
import { consumeRateLimit, requestFingerprint } from "@/lib/security";
export const dynamic = "force-dynamic";
const input = z.discriminatedUnion("action", [
  z.object({ action: z.literal("request"), username: z.string().trim().regex(/^\d{11}$/) }).strict(),
  z.object({ action: z.literal("reset"), challengeId: z.string().uuid(), otp: z.string().regex(/^\d{6}$/), newPassword: z.string().min(10).max(128), confirmPassword: z.string().min(10).max(128) }).strict(),
]);
export async function POST(request: Request) {
  try {
    const configuration = configuredRecovery();
    if (!configuration) return json({ error: "Verified SMS recovery is unavailable until a delivery provider is configured. Contact your school administrator.", code: "RECOVERY_UNAVAILABLE" }, 503);
    await ensureSchema(); const body = await readJson(request, input); const fingerprint = requestFingerprint(request);
    if (body.action === "request") return json(await requestRecovery(body.username, fingerprint, configuration), 202);
    await consumeRateLimit(`recovery:verify:${fingerprint}`, 40, 15 * 60 * 1000);
    if (body.newPassword !== body.confirmPassword) return json({ error: "Passwords do not match.", code: "VALIDATION_ERROR" }, 400);
    return json(await resetWithRecovery(body.challengeId, body.otp, body.newPassword, configuration));
  } catch (error) { return handleError(error); }
}

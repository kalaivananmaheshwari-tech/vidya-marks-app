import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import { db, type DbExecutor } from "@/db";
import { HttpError } from "@/lib/http";

export function allowedRequestOrigin(request: Request, production: boolean, configuredOrigins: string[]): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return request.headers.get("sec-fetch-site") !== "cross-site";
  let value: string;
  try { value = new URL(origin).origin; } catch { return false; }
  if (configuredOrigins.length) return configuredOrigins.includes(value);
  if (production) return false;
  const url = new URL(request.url);
  const host = request.headers.get("host") ?? url.host;
  return new URL(value).host === host;
}
export function securityKey(value: string) { return createHash("sha256").update(value).digest("hex"); }
export function requestFingerprint(request: Request) {
  // Do not trust arbitrary forwarded IPs unless deployment explicitly trusts its reverse proxy.
  const ip = process.env.TRUST_PROXY === "1" ? request.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown" : "untrusted-proxy";
  return securityKey(`request:${ip}`);
}
/** Database-backed across workers/restarts; atomic window upsert. */
export async function consumeRateLimit(key: string, maximum: number, windowMs: number, executor: DbExecutor = db) {
  const now = new Date(); const cutoff = new Date(now.getTime() - windowMs);
  const result = await executor.execute<{ hits: number }>(sql`
    insert into security_rate_limits(key,window_start,hits) values(${key},${now},1)
    on conflict(key) do update set
      hits = case when security_rate_limits.window_start <= ${cutoff} then 1 else security_rate_limits.hits+1 end,
      window_start = case when security_rate_limits.window_start <= ${cutoff} then ${now} else security_rate_limits.window_start end
    returning hits
  `);
  if (Number(result.rows[0]?.hits) > maximum) throw new HttpError("Too many requests. Please try again later.", 429, "RATE_LIMITED");
}

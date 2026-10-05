import { json } from "@/lib/http";
export const dynamic = "force-dynamic";
/** Account enumeration is intentionally retired. Recovery never lists administrators. */
export async function GET() { return json({ error: "Public administrator listing is disabled. Use verified OTP recovery.", code: "ACCOUNT_ENUMERATION_DISABLED" }, 410); }

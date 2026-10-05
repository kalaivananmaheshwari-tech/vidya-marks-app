import { getAuth } from "@/lib/auth";
import { handleError, json } from "@/lib/api";
export const dynamic = "force-dynamic";
export async function GET() {
  try { const auth = await getAuth(); return json({ user: auth?.user ?? null, school: auth?.school ?? null, geographicScope: auth?.geographicScope ?? null }); }
  catch (error) { return handleError(error); }
}

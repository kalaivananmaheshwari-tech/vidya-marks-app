import { getAuth } from "@/lib/auth";
import { json } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await getAuth();
  return json({ user: auth?.user ?? null, school: auth?.school ?? null });
}

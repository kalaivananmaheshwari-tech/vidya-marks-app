import { runSeed } from "@/db/seed";
import { handleError, json } from "@/lib/api";

export const dynamic = "force-dynamic";

/** Rebuilds the public demo school only. Registered schools are never touched. */
export async function POST() {
  try {
    const result = await runSeed(true);
    return json(result);
  } catch (error) {
    return handleError(error);
  }
}

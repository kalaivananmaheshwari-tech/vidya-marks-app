import { destroySession } from "@/lib/auth";
import { handleError, json } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    await destroySession();
    return json({ ok: true });
  } catch (error) {
    return handleError(error);
  }
}

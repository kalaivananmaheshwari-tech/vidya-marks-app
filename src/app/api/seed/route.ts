import { json } from "@/lib/http";
export const dynamic = "force-dynamic";
/** The legacy route is kept, but can NEVER reset/delete a school's academic data. */
export async function POST() { return json({ error: "Database reset is disabled. No data was changed.", code: "DESTRUCTIVE_OPERATION_DISABLED" }, 410); }

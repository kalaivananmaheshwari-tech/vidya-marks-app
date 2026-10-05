import { handleError, json, numParam, readJson, requireAuth } from "@/lib/api";
import { markBatchSchema, markRoster, saveMarkBatch } from "@/lib/mark-entry";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    const auth = await requireAuth(); const url = new URL(request.url);
    const classId = numParam(url.searchParams.get("classId"));
    if (!classId) return json({ subjects: [], roster: [] });
    return json(await markRoster(auth, classId, numParam(url.searchParams.get("examId")), numParam(url.searchParams.get("subjectId"))));
  } catch (error) { return handleError(error); }
}
export async function PUT(request: Request) {
  try { const auth = await requireAuth(); const body = await readJson(request, markBatchSchema); return json(await saveMarkBatch(auth, body)); }
  catch (error) { return handleError(error); }
}

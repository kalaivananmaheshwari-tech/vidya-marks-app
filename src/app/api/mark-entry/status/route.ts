import { handleError, json, numParam, requireAuth, HttpError } from "@/lib/api";
import { markMonitoring } from "@/lib/mark-entry";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    const auth = await requireAuth(); const url = new URL(request.url);
    const examId = numParam(url.searchParams.get("examId"));
    if (!examId) throw new HttpError("Choose an examination.");
    return json({ rows: await markMonitoring(auth, examId, numParam(url.searchParams.get("classId"))) });
  } catch (error) { return handleError(error); }
}

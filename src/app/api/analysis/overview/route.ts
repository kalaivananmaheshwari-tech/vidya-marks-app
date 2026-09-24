import { handleError, json, numParam, requireAuth } from "@/lib/api";
import { overviewReport } from "@/lib/reports";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { user } = await requireAuth();
    const url = new URL(request.url);
    const examId = numParam(url.searchParams.get("examId"));
    return json(await overviewReport(user.schoolId, examId));
  } catch (error) {
    return handleError(error);
  }
}

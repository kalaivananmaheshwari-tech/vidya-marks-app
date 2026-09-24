import { handleError, json, numParam, requireAuth, str } from "@/lib/api";
import { sectionReport } from "@/lib/reports";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { user } = await requireAuth();
    const url = new URL(request.url);
    return json(
      await sectionReport({
        schoolId: user.schoolId,
        examId: numParam(url.searchParams.get("examId")),
        grade: str(url.searchParams.get("grade")),
      }),
    );
  } catch (error) {
    return handleError(error);
  }
}

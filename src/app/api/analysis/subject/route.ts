import { handleError, json, numParam, requireAuth } from "@/lib/api";
import { subjectReport } from "@/lib/reports";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { user } = await requireAuth();
    const url = new URL(request.url);
    return json(
      await subjectReport({
        schoolId: user.schoolId,
        examId: numParam(url.searchParams.get("examId")),
        classId: numParam(url.searchParams.get("classId")),
        groupId: numParam(url.searchParams.get("groupId")),
      }),
    );
  } catch (error) {
    return handleError(error);
  }
}

import { handleError, json, numParam, requireAuth } from "@/lib/api";
import { classReport } from "@/lib/reports";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { user } = await requireAuth();
    const url = new URL(request.url);
    return json(
      await classReport({
        schoolId: user.schoolId,
        examId: numParam(url.searchParams.get("examId")),
        groupId: numParam(url.searchParams.get("groupId")),
        classId: numParam(url.searchParams.get("classId")),
      }),
    );
  } catch (error) {
    return handleError(error);
  }
}

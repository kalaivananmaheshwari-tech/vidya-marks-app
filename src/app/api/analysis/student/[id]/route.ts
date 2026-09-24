import { handleError, json, notFound, requireAuth } from "@/lib/api";
import { studentReport } from "@/lib/reports";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Ctx) {
  try {
    const { user } = await requireAuth();
    const { id } = await params;
    const report = await studentReport(Number(id), user.schoolId);
    if (!report) return notFound("Student not found");
    return json(report);
  } catch (error) {
    return handleError(error);
  }
}

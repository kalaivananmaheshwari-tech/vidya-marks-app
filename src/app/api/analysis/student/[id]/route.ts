import { handleError, json, notFound, requireAuth, idSchema } from "@/lib/api";
import { db } from "@/db";
import { studentReport } from "@/lib/reports";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Ctx) {
  try {
    const auth = await requireAuth();
    const { id } = await params;
    const report = await db.transaction((tx)=>studentReport(idSchema.parse(Number(id)),auth,tx),{isolationLevel:"repeatable read",accessMode:"read only"});
    if (!report) return notFound("Student not found");
    return json(report);
  } catch (error) {
    return handleError(error);
  }
}

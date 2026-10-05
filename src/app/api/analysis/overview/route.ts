import { db } from "@/db";
import { handleError, json, requireAuth } from "@/lib/api";
import { analysisFilters } from "@/lib/analysis-scope";
import { overviewReport } from "@/lib/reports";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    const auth=await requireAuth(); const url=new URL(request.url); const filters=await analysisFilters(auth,url);
    return json(await db.transaction((tx)=>overviewReport(auth, filters.examId, tx),{isolationLevel:"repeatable read",accessMode:"read only"}));
  } catch(error) {return handleError(error);}
}

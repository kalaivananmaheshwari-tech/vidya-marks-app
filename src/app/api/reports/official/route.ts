import { z } from "zod";
import { handleError, HttpError, json, numParam, requireAuth } from "@/lib/api";
import { officialReport } from "@/lib/official-reports";
export const dynamic = "force-dynamic";
const modeSchema=z.enum(["consolidated","subject","matrix","form2","cce"]);
export async function GET(request:Request) {
  try {
    const auth=await requireAuth();const url=new URL(request.url);
    for(const field of ["schoolId","teacherId","role"]) if(url.searchParams.has(field)) throw new HttpError("Report scope is determined by your authenticated membership.");
    return json(await officialReport(auth,{mode:modeSchema.parse(url.searchParams.get("mode") ?? "consolidated"),classId:numParam(url.searchParams.get("classId")),examId:numParam(url.searchParams.get("examId")),subjectId:numParam(url.searchParams.get("subjectId")),previousExamId:numParam(url.searchParams.get("previousExamId")),includeArchived:url.searchParams.get("includeArchived")==="1"}));
  } catch(error) {return handleError(error);}
}

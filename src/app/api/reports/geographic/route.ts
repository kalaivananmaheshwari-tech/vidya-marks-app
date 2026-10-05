import { handleError,HttpError,json,numParam,requireGeographicAuth,str } from "@/lib/api";
import { geographicReport } from "@/lib/geographic-reports";
export const dynamic="force-dynamic";
export async function GET(request:Request) {
  try {
    const auth=await requireGeographicAuth();const q=new URL(request.url).searchParams;
    if(q.has("role") || q.has("teacherId"))throw new HttpError("Report authority is determined by your persisted geographic scope.");
    return json(await geographicReport(auth,{schoolId:numParam(q.get("schoolId")),academicYear:str(q.get("academicYear")),examName:str(q.get("examName")),management:str(q.get("management")),className:str(q.get("className")),subjectName:str(q.get("subjectName")),district:str(q.get("district")),educationalDistrict:str(q.get("educationalDistrict")),block:str(q.get("block"))}));
  } catch(error) {return handleError(error);}
}

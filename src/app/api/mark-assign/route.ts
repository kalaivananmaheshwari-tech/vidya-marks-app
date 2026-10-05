import { handleError, json, numParam, readJson, requireAdmin, requireAuth } from "@/lib/api";
import { subjectsForClass } from "@/lib/queries";
import { assertClassAccess } from "@/lib/authorization";
import { isAdmin } from "@/lib/auth";
import { configureMappings, mappingSchema } from "@/lib/mapping-service";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    const auth = await requireAuth(); const classId = numParam(new URL(request.url).searchParams.get("classId"));
    if (!classId) return json({ class: null, subjects: [] });
    await assertClassAccess(auth, classId); const { cls, list } = await subjectsForClass(classId, auth.school.id);
    return json({ class: cls, subjects: isAdmin(auth.user) ? list : list.filter((s) => s.teacherId === auth.user.id) });
  } catch (error) { return handleError(error); }
}
export async function POST(request: Request) {
  try { const auth = await requireAdmin(); const body = await readJson(request, mappingSchema); return json(await configureMappings(auth, body)); }
  catch (error) { return handleError(error); }
}

import { getAuth, isAdmin, type AuthContext, type SchoolAuthContext } from "@/lib/auth";
import { HttpError } from "@/lib/http";
import { ensureSchema } from "@/db/bootstrap";
import { validGeographicScope } from "@/lib/domain/geography";
export * from "@/lib/http";

export async function requireSession(): Promise<AuthContext> {
  await ensureSchema();
  const auth = await getAuth();
  if (!auth) throw new HttpError("You must be signed in.", 401, "UNAUTHORIZED");
  return auth;
}
/** Scope is selected by the stored session membership, never a request school ID. */
export async function requireAuth(): Promise<SchoolAuthContext> {
  const auth = await requireSession();
  if (auth.user.mustChangePassword) throw new HttpError("Change your temporary password before using protected operations.", 403, "PASSWORD_CHANGE_REQUIRED");
  if (!auth.school || !auth.membershipId || auth.user.schoolId === null) throw new HttpError("A school membership is required.", 403, "INVALID_SCHOOL_SCOPE");
  return auth as SchoolAuthContext;
}
export async function requireAdmin(): Promise<SchoolAuthContext> {
  const auth = await requireAuth();
  if (!isAdmin(auth.user)) throw new HttpError("Only the school Headmaster / Principal can do this.", 403, "FORBIDDEN");
  return auth;
}
export async function requireGeographicAuth(): Promise<AuthContext & { geographicScope: NonNullable<AuthContext["geographicScope"]> }> {
  const auth = await requireSession();
  if (auth.user.mustChangePassword) throw new HttpError("Change your temporary password before using protected operations.",403,"PASSWORD_CHANGE_REQUIRED");
  if (!auth.geographicScope || !validGeographicScope(auth.geographicScope) || auth.user.role !== auth.geographicScope.role) throw new HttpError("An authorized CEO, DEO or BEO scope is required.", 403, "INVALID_REPORT_SCOPE");
  return auth as AuthContext & { geographicScope: NonNullable<AuthContext["geographicScope"]> };
}

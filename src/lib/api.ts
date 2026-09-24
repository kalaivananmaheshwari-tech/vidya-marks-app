import { getAuth, isAdmin, type AuthContext } from "@/lib/auth";

export function json(data: unknown, status = 200): Response {
  return Response.json(data, { status });
}

export function badRequest(message: string): Response {
  return Response.json({ error: message }, { status: 400 });
}

export function notFound(message = "Not found"): Response {
  return Response.json({ error: message }, { status: 404 });
}

export class HttpError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

/** Any signed-in staff member of a school. Returns the tenant context. */
export async function requireAuth(): Promise<AuthContext> {
  const auth = await getAuth();
  if (!auth) throw new HttpError("You must be signed in.", 401);
  return auth;
}

/** Only the school admin (Principal / Headmaster). */
export async function requireAdmin(): Promise<AuthContext> {
  const auth = await requireAuth();
  if (!isAdmin(auth.user)) {
    throw new HttpError("Only the school admin (Principal / Headmaster) can do this.", 403);
  }
  return auth;
}

export function handleError(error: unknown): Response {
  if (error instanceof HttpError) {
    return Response.json({ error: error.message }, { status: error.status });
  }
  const message = error instanceof Error ? error.message : "Unexpected server error";
  if (/users_username_unique|username/i.test(message) && /duplicate|unique/i.test(message)) {
    return Response.json({ error: "That username is already taken. Choose another." }, { status: 409 });
  }
  if (/udise/i.test(message) && /duplicate|unique/i.test(message)) {
    return Response.json({ error: "This UDISE code is already registered." }, { status: 409 });
  }
  const duplicate = /duplicate key|unique constraint/i.test(message);
  return Response.json(
    { error: duplicate ? "That record already exists (duplicate code or number)." : message },
    { status: duplicate ? 409 : 500 },
  );
}

export function numParam(value: string | null | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

export function str(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : undefined;
}

export function int(value: unknown): number | undefined {
  if (value === null || value === undefined || value === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : undefined;
}

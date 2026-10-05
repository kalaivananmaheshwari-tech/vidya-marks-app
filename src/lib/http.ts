import { z } from "zod";
import { DomainError } from "@/lib/domain/marks";

export class HttpError extends Error {
  constructor(message: string, public status = 400, public code = "BAD_REQUEST", public details?: Record<string, unknown>) { super(message); }
}
export function json(data: unknown, status = 200): Response {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
}
export const badRequest = (message: string) => json({ error: message, code: "BAD_REQUEST" }, 400);
export const notFound = (message = "Not found") => json({ error: message, code: "NOT_FOUND" }, 404);
export function handleError(error: unknown): Response {
  if (error instanceof HttpError) return json({ error: error.message, code: error.code, ...error.details }, error.status);
  if (error instanceof DomainError) return json({ error: error.message, code: error.code }, 400);
  if (error instanceof z.ZodError) return json({ error: "Invalid request.", code: "VALIDATION_ERROR", issues: error.issues.map((i) => ({ path: i.path.join("."), message: i.message })) }, 400);
  if (error instanceof SyntaxError) return badRequest("Invalid JSON body.");
  const dbError = error as { code?: string; cause?: { code?: string } };
  const code = dbError?.cause?.code ?? dbError?.code;
  if (code === "23505") return json({ error: "That code, username or active exam number already exists.", code: "CONFLICT" }, 409);
  if (code === "23503" || code === "23514") return json({ error: "The requested academic reference or value is invalid.", code: "INVALID_REFERENCE" }, 400);
  // Do not leak SQL, account details, database URLs, credentials or provider responses.
  console.error("[api] request failed", { kind: code && /^\w{5}$/.test(code) ? code : "internal" });
  return json({ error: "The operation could not be completed. Please try again.", code: "INTERNAL_ERROR" }, 500);
}
export const idSchema = z.number().int().positive();
export const uuidSchema = z.string().uuid();
export async function readJson<T extends z.ZodTypeAny>(request: Request, schema: T): Promise<z.infer<T>> {
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) throw new HttpError("Use application/json.", 415, "INVALID_CONTENT_TYPE");
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError("A JSON body is required.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 512 * 1024) { await reader.cancel(); throw new HttpError("Request body is too large.", 413, "BODY_TOO_LARGE"); }
    chunks.push(value);
  }
  return schema.parse(JSON.parse(Buffer.concat(chunks).toString("utf8")));
}
export function numParam(value: string | null | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) throw new HttpError("Invalid identifier.", 400, "VALIDATION_ERROR");
  return parsed;
}
export function str(value: unknown): string | undefined { return typeof value === "string" && value.trim() ? value.trim() : undefined; }
export function int(value: unknown): number | undefined {
  if (value == null || value === "") return undefined;
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) throw new HttpError("A whole number is required.");
  return parsed;
}

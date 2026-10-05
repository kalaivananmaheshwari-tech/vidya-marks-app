import { db, type DbExecutor } from "@/db";
import { auditEvents } from "@/db/schema";

export type AuditActor = { user: { id: number; schoolId: number | null } };
const secret = /password|otp|token|secret|credential|authorization|cookie/i;
export function safeAuditMetadata(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(safeAuditMetadata);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).filter(([key]) => !secret.test(key)).map(([key, item]) => [key, safeAuditMetadata(item)]));
  return value;
}
export async function audit(executor: DbExecutor, actor: AuditActor | null, action: string, entityType: string, entityId?: string | number | null, metadata: Record<string, unknown> = {}, targetSchoolId?: number) {
  await executor.insert(auditEvents).values({ actorId: actor?.user.id ?? null, schoolId: actor?.user.schoolId ?? targetSchoolId ?? null, action, entityType, entityId: entityId == null ? null : String(entityId), metadata: safeAuditMetadata(metadata) as Record<string, unknown> });
}
export async function auditReport(actor: AuditActor, report: string, metadata: Record<string, unknown>) {
  await db.transaction((tx) => audit(tx, actor, "report.generated", report, null, metadata));
}

import { z } from "zod";
import { and, eq, isNull } from "drizzle-orm";
import type { DbExecutor } from "@/db";
import { groups } from "@/db/schema";
import { HttpError, idSchema } from "@/lib/http";
export const referenceId = z.union([idSchema, z.string().regex(/^\d+$/).transform(Number).pipe(idSchema)]).nullable().optional();
export const label = z.string().trim().min(1).max(150);
export const optionalText = z.string().trim().max(250).nullable().optional();
export async function ownedGroup(executor: DbExecutor, schoolId: number, id: number) {
  const [row] = await executor.select().from(groups).where(and(eq(groups.id, id), eq(groups.schoolId, schoolId), isNull(groups.archivedAt))).limit(1);
  if (!row) throw new HttpError("Group is outside your school scope or archived.", 403, "INVALID_SCHOOL_SCOPE"); return row;
}
export const classSetupSchema = z.object({
  name: label, section: z.string().trim().min(1).max(20).optional(), academicYear: z.string().regex(/^\d{4}-\d{4}$/).optional(),
  room: optionalText, classTeacherId: referenceId, groupId: referenceId, groupCode: optionalText,
  groupName: optionalText, stream: optionalText, subjects: z.array(label).optional(),
}).strict();
export const subjectSetupSchema = z.object({
  code: z.string().trim().min(1).max(40), name: label, classId: referenceId, groupId: referenceId,
  hasPractical: z.boolean().optional(), passMarks: z.union([z.literal(35), z.literal("35").transform(Number)]).optional(), teacherId: referenceId,
}).strict();
export const examSetupSchema = z.object({
  name: label, month: optionalText, year: z.string().regex(/^\d{4}$/).nullable().optional(),
  term: optionalText, academicYear: z.string().regex(/^\d{4}-\d{4}$/).optional(),
  maxMarks: z.union([z.literal(100), z.literal("100").transform(Number)]).optional(),
  startDate: z.union([z.string().date(), z.literal("")]).nullable().optional(), isPublished: z.boolean().optional(),
}).strict();

export const groupSchema = z.object({ code: z.string().trim().min(1).max(30), name: label, stream: z.enum(["General","Science","Commerce","Arts","Vocational"]).optional(), description: z.string().trim().max(500).nullable().optional() }).strict();

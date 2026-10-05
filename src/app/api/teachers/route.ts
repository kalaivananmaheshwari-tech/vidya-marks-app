import { z } from "zod";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { users, teacherSubjectAssignments } from "@/db/schema";
import { handleError, HttpError, idSchema, json, readJson, requireAdmin } from "@/lib/api";
import { hashPassword } from "@/lib/auth";
import { classCountByTeacher } from "@/lib/counts";
import { addMembership } from "@/lib/relations";
import { setTeacherMapping, ensureMappedActiveTeachers } from "@/lib/mapping-service";
import { audit } from "@/lib/audit";
export const dynamic = "force-dynamic";
const input = z.object({ name: z.string().trim().min(1).max(150), username: z.string().trim().regex(/^[a-zA-Z0-9._-]{4,64}$/), password: z.string().min(10).max(128), designation: z.string().trim().max(100).optional(), customDesignation: z.string().trim().max(100).optional(), email: z.union([z.string().email(), z.literal("")]).optional(), phone: z.string().trim().max(20).optional(), handlingSubjects: z.string().trim().max(500).optional(), assignments: z.array(z.object({ classId: idSchema, subjectId: idSchema }).strict()).min(1).max(50) }).strict();
const safeFields = { id: users.id, name: users.name, username: users.username, email: users.email, role: users.role, designation: users.designation, phone: users.phone, handlingSubjects: users.handlingSubjects, isActive: users.isActive, lastLoginAt: users.lastLoginAt };
export async function GET() {
  try {
    const auth = await requireAdmin();
    const [rows, classCounts, mappings] = await Promise.all([
      db.select(safeFields).from(users).where(eq(users.schoolId, auth.school.id)).orderBy(asc(users.role), asc(users.name)),
      classCountByTeacher(auth.school.id), db.select().from(teacherSubjectAssignments).where(eq(teacherSubjectAssignments.schoolId, auth.school.id)),
    ]);
    return json({ teachers: rows.map((r) => ({ ...r, classCount: classCounts.get(r.id) ?? 0, subjectCount: mappings.filter((m) => m.teacherId === r.id).length, assignments: mappings.filter((m) => m.teacherId === r.id).map((m) => ({ classId: m.classId, subjectId: m.subjectId })) })) });
  } catch (error) { return handleError(error); }
}
export async function POST(request: Request) {
  try {
    const auth = await requireAdmin(); const body = await readJson(request, input);
    const result = await db.transaction(async (tx) => {
      const [user] = await tx.insert(users).values({ schoolId: auth.school.id, username: body.username.toLowerCase(), name: body.name, passwordHash: hashPassword(body.password), role: "teacher", userType: "TEACHER", designation: body.designation || null, email: body.email || null, phone: body.phone || null, handlingSubjects: body.handlingSubjects || null, mustChangePassword: true }).returning(safeFields);
      await addMembership(tx, auth.school.id, user.id, user.username, "TEACHER");
      const affected: number[] = [];
      const unique=new Set(body.assignments.map((a)=>`${a.classId}:${a.subjectId}`));
      if(unique.size!==body.assignments.length) throw new HttpError("Duplicate teacher assignment.");
      for (const mapping of [...body.assignments].sort((a,b)=>a.classId-b.classId || a.subjectId-b.subjectId)) {
        const [prior] = await tx.select().from(teacherSubjectAssignments).where(and(eq(teacherSubjectAssignments.schoolId, auth.school.id), eq(teacherSubjectAssignments.classId, mapping.classId), eq(teacherSubjectAssignments.subjectId, mapping.subjectId))).limit(1);
        if (prior) affected.push(prior.teacherId);
        await setTeacherMapping(tx, auth, mapping.classId, mapping.subjectId, user.id);
      }
      await ensureMappedActiveTeachers(tx, auth.school.id, [...affected, user.id]);
      await audit(tx, auth, "teacher.created", "users", user.id, { mappingCount: body.assignments.length });
      return { ...user, classCount: 0, subjectCount: body.assignments.length };
    });
    return json({ teacher: result }, 201);
  } catch (error) { return handleError(error); }
}

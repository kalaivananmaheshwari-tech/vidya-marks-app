import { and, asc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { classes, groups, subjects, users, teacherSubjectAssignments, markAllocations, classSubjects } from "@/db/schema";
import { handleError, HttpError, json, readJson, requireAdmin, requireAuth } from "@/lib/api";
import { markCountBySubject } from "@/lib/counts";
import { assertClassAccess, assertTeacherReference, subjectScopeCondition } from "@/lib/authorization";
import { subjectSetupSchema, ownedGroup } from "@/lib/setup-validation";
import { syncClassRelations } from "@/lib/relations";
import { allocationFor, classNumber } from "@/lib/domain/marks";
import { isAdmin } from "@/lib/auth";
import { audit } from "@/lib/audit";
import {subjectsForClass} from "@/lib/queries";
import { setTeacherMapping } from "@/lib/mapping-service";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const auth = await requireAuth();
    const [rows, counts] = await Promise.all([
      db.select({ id: subjects.id, code: subjects.code, name: subjects.name, classId: subjects.classId, groupId: subjects.groupId, groupCode: groups.code, groupName: groups.name, hasPractical: subjects.hasPractical, theoryMarks: subjects.theoryMarks, practicalMarks: subjects.practicalMarks, internalMarks: subjects.internalMarks, maxMarks: subjects.maxMarks, passMarks: subjects.passMarks, teacherId: subjects.teacherId, teacherName: users.name })
        .from(subjects).leftJoin(groups, and(eq(groups.id, subjects.groupId), eq(groups.schoolId, subjects.schoolId))).leftJoin(users, and(eq(users.id, subjects.teacherId), eq(users.schoolId, subjects.schoolId)))
        .where(and(eq(subjects.schoolId, auth.school.id), isNull(subjects.archivedAt), subjectScopeCondition(auth))).orderBy(asc(subjects.name), asc(subjects.code)),
      markCountBySubject(auth.school.id, isAdmin(auth.user) ? undefined : auth.user.id),
    ]);
    const mappings = await db.select({ classId: classSubjects.classId, subjectId: classSubjects.subjectId, allocation: markAllocations, teacherId: teacherSubjectAssignments.teacherId, teacherName: users.name }).from(classSubjects)
      .innerJoin(markAllocations, eq(markAllocations.classSubjectId, classSubjects.id)).leftJoin(teacherSubjectAssignments, eq(teacherSubjectAssignments.classSubjectId, classSubjects.id)).leftJoin(users, eq(users.id, teacherSubjectAssignments.teacherId))
      .where(and(eq(classSubjects.schoolId, auth.school.id), isAdmin(auth.user) ? undefined : eq(teacherSubjectAssignments.teacherId, auth.user.id)));
    return json({ subjects: rows.map((r) => { const m = mappings.find((m) => m.subjectId === r.id && (r.classId === null || m.classId === r.classId)); return { ...r, ...(r.classId && m ? m.allocation : {}), id: r.id, code: r.code, name: r.name, teacherId: m?.teacherId ?? null, teacherName: m?.teacherName ?? null, markCount: counts.get(r.id) ?? 0 }; }) });
  } catch (error) { return handleError(error); }
}
export async function POST(request: Request) {
  try {
    const auth = await requireAdmin(); const body = await readJson(request, subjectSetupSchema);
    const subject = await db.transaction(async (tx) => {
      if (body.groupId) await ownedGroup(tx, auth.school.id, body.groupId);
      if (body.teacherId) await assertTeacherReference(auth.school.id, body.teacherId, tx);
      const cls = body.classId ? await assertClassAccess(auth, body.classId, tx) : null;
      const grade = cls ? classNumber(cls.name) : 11;
      if(cls && (grade ?? 0)>=11){await tx.select({id:classes.id}).from(classes).where(eq(classes.id,cls.id)).for("update");const existing=(await subjectsForClass(cls.id,auth.school.id,tx)).list;if(existing.length>=6)throw new HttpError("Classes 11–12 require exactly six custom subjects. Edit unused labels instead of adding a seventh subject.",409,"INVALID_CURRICULUM");}
      const allocation = grade && grade >= 6 ? allocationFor(grade, body.hasPractical ?? false) : { hasPractical: body.hasPractical ?? false, theoryMarks: 0, practicalMarks: 0, internalMarks: 0, maxMarks: 100, passMarks: 35 };
      const [row] = await tx.insert(subjects).values({ schoolId: auth.school.id, code: body.code.toUpperCase(), name: body.name, classId: body.classId ?? null, groupId: body.groupId ?? null, ...allocation, teacherId: body.teacherId ?? null }).returning();
      const relatedClasses = cls ? [cls] : await tx.select().from(classes).where(and(eq(classes.schoolId, auth.school.id), isNull(classes.archivedAt)));
      for (const c of relatedClasses) {
        await syncClassRelations(tx, c.id, auth.school.id);
        const [pair] = await tx.select().from(classSubjects).where(and(eq(classSubjects.classId, c.id), eq(classSubjects.subjectId, row.id), eq(classSubjects.schoolId, auth.school.id))).limit(1);
        if (pair && body.teacherId) await setTeacherMapping(tx, auth, c.id, row.id, body.teacherId);
      }
      await audit(tx, auth, "subject.created", "subjects", row.id, { code: row.code, classId: row.classId }); return row;
    });
    return json({ subject: { ...subject, markCount: 0 } }, 201);
  } catch (error) { return handleError(error); }
}

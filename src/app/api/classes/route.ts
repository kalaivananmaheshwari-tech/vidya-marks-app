import { and, asc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { classes, groups, subjects, users } from "@/db/schema";
import { handleError, HttpError, json, readJson, requireAdmin, requireAuth } from "@/lib/api";
import { studentCountByClass } from "@/lib/counts";
import { classScopeCondition, assertTeacherReference } from "@/lib/authorization";
import { classSetupSchema, ownedGroup } from "@/lib/setup-validation";
import { syncClassRelations, yearRecord } from "@/lib/relations";
import { allocationFor, classNumber } from "@/lib/domain/marks";
import { audit } from "@/lib/audit";
export const dynamic = "force-dynamic";
const DEFAULT_SUBJECTS = [
  { name: "Language", code: "LNG", hasPractical: false }, { name: "English", code: "ENG", hasPractical: false },
  { name: "Mathematics", code: "MAT", hasPractical: false }, { name: "Science", code: "SCI", hasPractical: true },
  { name: "Social Science", code: "SOC", hasPractical: false }, { name: "PET", code: "PET", hasPractical: false },
  { name: "TNSPARK", code: "TNS", hasPractical: false }, { name: "Science Tamil", code: "SCT", hasPractical: true },
];
export async function GET() {
  try {
    const auth = await requireAuth();
    const [rows, counts] = await Promise.all([
      db.select({ id: classes.id, name: classes.name, section: classes.section, groupId: classes.groupId, groupCode: groups.code, groupName: groups.name, stream: groups.stream, academicYear: classes.academicYear, academicYearId: classes.academicYearId, room: classes.room, classTeacherId: classes.classTeacherId, classTeacher: users.name })
        .from(classes).leftJoin(groups, and(eq(groups.id, classes.groupId), eq(groups.schoolId, classes.schoolId))).leftJoin(users, and(eq(users.id, classes.classTeacherId), eq(users.schoolId, classes.schoolId)))
        .where(and(eq(classes.schoolId, auth.school.id), isNull(classes.archivedAt), classScopeCondition(auth))).orderBy(asc(classes.name), asc(classes.section)),
      studentCountByClass(auth.school.id),
    ]);
    return json({ classes: rows.map((row) => ({ ...row, studentCount: counts.get(row.id) ?? 0 })) });
  } catch (error) { return handleError(error); }
}
export async function POST(request: Request) {
  try {
    const auth = await requireAdmin(); const body = await readJson(request, classSetupSchema);
    const grade = classNumber(body.name); if (!grade) throw new HttpError("Choose a valid class from 1 to 12.");
    if (grade >= 11 && (!body.groupCode || body.subjects?.length !== 6 || new Set(body.subjects.map((s) => s.toLowerCase())).size !== 6)) throw new HttpError("Classes 11–12 require a Group Code and exactly six distinct custom subjects.");
    if (grade < 11 && (body.groupCode || body.groupId)) throw new HttpError("Group Code is only available for classes 11–12.");
    const cls = await db.transaction(async (tx) => {
      const year = await yearRecord(body.academicYear ?? auth.school.academicYear, tx);
      if (body.classTeacherId) await assertTeacherReference(auth.school.id, body.classTeacherId, tx);
      let groupId: number | null = null;
      if (grade >= 11) {
        if (body.groupId) { const group = await ownedGroup(tx, auth.school.id, body.groupId); if (group.code !== body.groupCode!.toUpperCase()) throw new HttpError("Group ID and Group Code do not match."); groupId = group.id; }
        else {
          const [group] = await tx.insert(groups).values({ schoolId: auth.school.id, code: body.groupCode!.toUpperCase(), name: body.groupName || `Group ${body.groupCode!.toUpperCase()}`, stream: body.stream || "General" })
            .onConflictDoUpdate({ target: [groups.schoolId, groups.code], set: { code: body.groupCode!.toUpperCase() } }).returning();
          if (group.archivedAt) throw new HttpError("This Group Code is archived.", 409, "CONFLICT"); groupId = group.id;
        }
      }
      const [row] = await tx.insert(classes).values({ schoolId: auth.school.id, name: body.name, section: body.section?.toUpperCase() || "A", groupId, academicYear: year.label, academicYearId: year.id, room: body.room || null, classTeacherId: body.classTeacherId ?? null }).returning();
      const list = grade >= 11 ? body.subjects!.map((name, i) => ({ name, code: `S${i+1}`, hasPractical: false })) : grade >= 6 ? DEFAULT_SUBJECTS : [];
      for (const sub of list) await tx.insert(subjects).values({ schoolId: auth.school.id, classId: row.id, groupId, code: `C${row.id}-${sub.code}`, name: sub.name, ...allocationFor(grade, sub.hasPractical) });
      await syncClassRelations(tx, row.id, auth.school.id);
      await audit(tx, auth, "class.created", "classes", row.id, { className: row.name, section: row.section, academicYearId: year.id, subjectCount: list.length });
      return row;
    });
    return json({ class: cls }, 201);
  } catch (error) { return handleError(error); }
}

import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { exams } from "@/db/schema";
import { handleError, json, readJson, requireAdmin, requireAuth } from "@/lib/api";
import { markCountByExam } from "@/lib/counts";
import { examSetupSchema } from "@/lib/setup-validation";
import { yearRecord } from "@/lib/relations";
import { publishResultInTransaction } from "@/lib/exam-service";
import { isAdmin } from "@/lib/auth";
import { audit } from "@/lib/audit";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const auth = await requireAuth();
    const [rows, counts] = await Promise.all([
      db.select().from(exams).where(and(eq(exams.schoolId, auth.school.id), isNull(exams.archivedAt), isAdmin(auth.user) ? undefined : sql`exists(select 1 from teacher_subject_assignments a join classes c on c.id=a.class_id and c.school_id=a.school_id where a.school_id=${auth.school.id} and a.teacher_id=${auth.user.id} and c.academic_year_id=${exams.academicYearId} and c.archived_at is null)`)).orderBy(sql`${exams.startDate} desc nulls last`, desc(exams.id)),
      markCountByExam(auth.school.id, isAdmin(auth.user) ? undefined : auth.user.id),
    ]);
    return json({ exams: rows.map((row) => ({ ...row, markCount: counts.get(row.id) ?? 0 })) });
  } catch (error) { return handleError(error); }
}
export async function POST(request: Request) {
  try {
    const auth = await requireAdmin(); const body = await readJson(request, examSetupSchema);
    const exam = await db.transaction(async (tx) => {
      const year = await yearRecord(body.academicYear ?? auth.school.academicYear, tx);
      const [row] = await tx.insert(exams).values({ schoolId: auth.school.id, name: body.name, month: body.month || null, year: body.year || String(year.startYear), term: body.term || "Term 1", academicYear: year.label, academicYearId: year.id, maxMarks: 100, startDate: body.startDate || null, isPublished: false }).returning();
      await audit(tx, auth, "exam.created", "examinations", row.id, { name: row.name, academicYearId: year.id });
      return body.isPublished ? publishResultInTransaction(tx, auth, row.id, true) : row;
    });
    return json({ exam: { ...exam, markCount: 0 } }, 201);
  } catch (error) { return handleError(error); }
}

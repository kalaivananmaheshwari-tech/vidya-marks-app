import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { exams } from "@/db/schema";
import { handleError, int, json, requireAuth, str } from "@/lib/api";
import { markCountByExam } from "@/lib/counts";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { user } = await requireAuth();
    const [rows, counts] = await Promise.all([
      db
        .select({
          id: exams.id,
          name: exams.name,
          month: exams.month,
          year: exams.year,
          term: exams.term,
          academicYear: exams.academicYear,
          maxMarks: exams.maxMarks,
          startDate: exams.startDate,
          isPublished: exams.isPublished,
        })
        .from(exams)
        .where(eq(exams.schoolId, user.schoolId))
        .orderBy(desc(exams.startDate), desc(exams.id)),
      markCountByExam(user.schoolId),
    ]);

    return json({ exams: rows.map((row) => ({ ...row, markCount: counts.get(row.id) ?? 0 })) });
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(request: Request) {
  try {
    const { user, school } = await requireAuth();
    const body = await request.json();
    const name = str(body.name);
    if (!name) return json({ error: "Name of the Exam is required." }, 400);

    const startDate = str(body.startDate) ?? null;
    let month = str(body.month) ?? null;
    let year = str(body.year) ?? null;

    // If month/year not provided but startDate is, derive them gracefully
    if (startDate) {
      const d = new Date(startDate);
      if (!isNaN(d.getTime())) {
        if (!month) {
          month = d.toLocaleString("en-US", { month: "long" });
        }
        if (!year) {
          year = String(d.getFullYear());
        }
      }
    }

    const [row] = await db
      .insert(exams)
      .values({
        schoolId: user.schoolId,
        name,
        month,
        year,
        term: str(body.term) ?? "Term 1",
        academicYear: str(body.academicYear) ?? (year ? `${year}-${Number(year) + 1}` : school.academicYear),
        maxMarks: int(body.maxMarks) ?? 100,
        startDate,
        isPublished: Boolean(body.isPublished),
      })
      .returning();
    return json({ exam: { ...row, markCount: 0 } }, 201);
  } catch (error) {
    return handleError(error);
  }
}

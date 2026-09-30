import { and, asc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { marks, students } from "@/db/schema";
import { handleError, json, numParam, requireAuth } from "@/lib/api";
import { subjectsForClass } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { user } = await requireAuth();
    const url = new URL(request.url);
    const classId = numParam(url.searchParams.get("classId"));
    const examId = numParam(url.searchParams.get("examId"));
    const subjectId = numParam(url.searchParams.get("subjectId"));

    if (!classId) return json({ subjects: [], roster: [] });
    const { cls, list } = await subjectsForClass(classId, user.schoolId);
    if (!cls) return json({ subjects: [], roster: [] });

    if (!examId || !subjectId) {
      return json({ subjects: list, roster: [] });
    }

    const roster = await db
      .select({
        studentId: students.id,
        name: students.name,
        rollNo: students.rollNo,
        admissionNo: students.admissionNo,
        markId: marks.id,
        theoryScore: marks.theoryScore,
        practicalScore: marks.practicalScore,
        internalScore: marks.internalScore,
        score: marks.score,
        isAbsent: marks.isAbsent,
        updatedAt: marks.updatedAt,
      })
      .from(students)
      .leftJoin(
        marks,
        and(eq(marks.studentId, students.id), eq(marks.examId, examId), eq(marks.subjectId, subjectId)),
      )
      .where(and(eq(students.classId, classId), eq(students.schoolId, user.schoolId)))
      .orderBy(asc(students.rollNo));

    const subject = list.find((s) => s.id === subjectId) ?? null;
    return json({ subjects: list, roster, subject });
  } catch (error) {
    return handleError(error);
  }
}

export async function PUT(request: Request) {
  try {
    const { user } = await requireAuth();
    const body = await request.json();
    const examId = Number(body.examId);
    const subjectId = Number(body.subjectId);
    const entries = Array.isArray(body.entries) ? body.entries : [];
    if (!examId || !subjectId) return json({ error: "Exam and subject are required." }, 400);
    if (!entries.length) return json({ saved: 0 });

    const owned = await db
      .select({ id: students.id })
      .from(students)
      .where(eq(students.schoolId, user.schoolId));
    const ownedIds = new Set(owned.map((s) => s.id));

    const values = entries
      .map(
        (entry: {
          studentId?: number;
          theoryScore?: number | string | null;
          practicalScore?: number | string | null;
          internalScore?: number | string | null;
          score?: number | string | null;
          isAbsent?: boolean;
        }) => {
          const studentId = Number(entry.studentId);
          if (!studentId || !ownedIds.has(studentId)) return null;
          const isAbsent = Boolean(entry.isAbsent);

          if (isAbsent) {
            return {
              schoolId: user.schoolId,
              studentId,
              subjectId,
              examId,
              theoryScore: null,
              practicalScore: null,
              internalScore: null,
              score: null,
              isAbsent: true,
              enteredById: user.id,
              updatedAt: new Date(),
            };
          }

          const parseNum = (v: unknown): number | null => {
            if (v === null || v === undefined || v === "") return null;
            const n = Number(v);
            return Number.isFinite(n) ? n : null;
          };

          const theoryScore = parseNum(entry.theoryScore);
          const practicalScore = parseNum(entry.practicalScore);
          const internalScore = parseNum(entry.internalScore);

          // If breakdown was provided, total = sum of components
          let score: number | null = null;
          if (theoryScore !== null || practicalScore !== null || internalScore !== null) {
            score = (theoryScore ?? 0) + (practicalScore ?? 0) + (internalScore ?? 0);
          } else {
            score = parseNum(entry.score);
          }

          return {
            schoolId: user.schoolId,
            studentId,
            subjectId,
            examId,
            theoryScore,
            practicalScore,
            internalScore,
            score,
            isAbsent: false,
            enteredById: user.id,
            updatedAt: new Date(),
          };
        },
      )
      .filter(Boolean) as Array<typeof marks.$inferInsert>;

    if (!values.length) return json({ saved: 0 });

    await db
      .insert(marks)
      .values(values)
      .onConflictDoUpdate({
        target: [marks.studentId, marks.subjectId, marks.examId],
        set: {
          theoryScore: sql`excluded.theory_score`,
          practicalScore: sql`excluded.practical_score`,
          internalScore: sql`excluded.internal_score`,
          score: sql`excluded.score`,
          isAbsent: sql`excluded.is_absent`,
          enteredById: sql`excluded.entered_by_id`,
          updatedAt: sql`excluded.updated_at`,
        },
      });

    return json({ saved: values.length });
  } catch (error) {
    return handleError(error);
  }
}

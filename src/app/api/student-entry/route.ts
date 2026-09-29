import { and, asc, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { classes, exams, groups, marks, students, subjects, users } from "@/db/schema";
import { handleError, int, json, numParam, requireAuth, str } from "@/lib/api";
import { GRADE_SCALE, PASS_PERCENTAGE, gradeFor, round } from "@/lib/grades";
import { subjectsForClass } from "@/lib/queries";

export const dynamic = "force-dynamic";

function isHscClass(name: string): boolean {
  const n = name.trim().toLowerCase();
  return (
    n === "11" ||
    n === "12" ||
    /\b(11|12)\b/.test(n) ||
    /\b(xi|xii)\b/.test(n) ||
    n.includes("11") ||
    n.includes("12")
  );
}

export async function GET(request: Request) {
  try {
    const { user } = await requireAuth();
    const url = new URL(request.url);
    const classId = numParam(url.searchParams.get("classId"));
    const studentId = numParam(url.searchParams.get("studentId"));
    const examId = numParam(url.searchParams.get("examId"));

    // 1. All classes in this school
    const classRows = await db
      .select({
        id: classes.id,
        name: classes.name,
        section: classes.section,
        groupId: classes.groupId,
        groupCode: groups.code,
        groupName: groups.name,
        stream: groups.stream,
        academicYear: classes.academicYear,
        room: classes.room,
      })
      .from(classes)
      .leftJoin(groups, eq(groups.id, classes.groupId))
      .where(eq(classes.schoolId, user.schoolId))
      .orderBy(asc(classes.name), asc(classes.section));

    // 2. All exams in this school
    const examRows = await db
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
      .orderBy(desc(exams.startDate), desc(exams.id));

    let selectedClass = null;
    let subjectList: Array<{
      id: number;
      code: string;
      name: string;
      hasPractical: boolean;
      theoryMarks: number;
      practicalMarks: number;
      internalMarks: number;
      maxMarks: number;
      passMarks: number;
      teacherName: string | null;
    }> = [];
    let studentList: Array<{
      id: number;
      rollNo: number;
      admissionNo: string;
      name: string;
      gender: string;
      guardianName: string | null;
      contact: string | null;
      dob: string | null;
    }> = [];

    if (classId) {
      const clsFound = classRows.find((c) => c.id === classId);
      if (clsFound) {
        selectedClass = {
          ...clsFound,
          isHsc: isHscClass(clsFound.name),
        };
      }

      // Load subjects for this class with marks allotment
      const { list } = await subjectsForClass(classId, user.schoolId);
      subjectList = list.map((s) => ({
        id: s.id,
        code: s.code,
        name: s.name,
        hasPractical: s.hasPractical,
        theoryMarks: s.theoryMarks ?? (s.hasPractical ? 70 : 90),
        practicalMarks: s.practicalMarks ?? (s.hasPractical ? 20 : 0),
        internalMarks: s.internalMarks ?? 10,
        maxMarks: s.maxMarks ?? 100,
        passMarks: s.passMarks ?? 35,
        teacherName: s.teacherName,
      }));

      // Load students in this class
      studentList = await db
        .select({
          id: students.id,
          rollNo: students.rollNo,
          admissionNo: students.admissionNo,
          name: students.name,
          gender: students.gender,
          guardianName: students.guardianName,
          contact: students.contact,
          dob: students.dob,
        })
        .from(students)
        .where(and(eq(students.schoolId, user.schoolId), eq(students.classId, classId)))
        .orderBy(asc(students.rollNo));
    }

    let selectedStudent = null;
    let previousExams: Array<{
      examId: number;
      examName: string;
      month: string | null;
      year: string | null;
      marks: Array<{
        subjectId: number;
        subjectName: string;
        subjectCode: string;
        theoryScore: number | null;
        practicalScore: number | null;
        internalScore: number | null;
        score: number | null;
        isAbsent: boolean;
        hasPractical: boolean;
        theoryMax: number;
        practicalMax: number;
        internalMax: number;
        totalMax: number;
        passed: boolean;
      }>;
      total: number;
      maxTotal: number;
      percentage: number;
      grade: string;
      passed: boolean;
    }> = [];
    let currentExamMarks: Record<
      number,
      {
        theoryScore: number | null;
        practicalScore: number | null;
        internalScore: number | null;
        score: number | null;
        isAbsent: boolean;
      }
    > = {};

    if (studentId) {
      const [stu] = await db
        .select({
          id: students.id,
          name: students.name,
          rollNo: students.rollNo,
          admissionNo: students.admissionNo,
          gender: students.gender,
          dob: students.dob,
          guardianName: students.guardianName,
          contact: students.contact,
          classId: students.classId,
        })
        .from(students)
        .where(and(eq(students.id, studentId), eq(students.schoolId, user.schoolId)))
        .limit(1);

      if (stu) {
        selectedStudent = stu;

        // Fetch all marks ever entered for this student
        const allMarks = await db
          .select({
            markId: marks.id,
            examId: marks.examId,
            examName: exams.name,
            examMonth: exams.month,
            examYear: exams.year,
            examDate: exams.startDate,
            subjectId: marks.subjectId,
            subjectName: subjects.name,
            subjectCode: subjects.code,
            hasPractical: subjects.hasPractical,
            theoryMax: subjects.theoryMarks,
            practicalMax: subjects.practicalMarks,
            internalMax: subjects.internalMarks,
            maxMarks: subjects.maxMarks,
            theoryScore: marks.theoryScore,
            practicalScore: marks.practicalScore,
            internalScore: marks.internalScore,
            score: marks.score,
            isAbsent: marks.isAbsent,
            updatedAt: marks.updatedAt,
          })
          .from(marks)
          .innerJoin(exams, eq(exams.id, marks.examId))
          .innerJoin(subjects, eq(subjects.id, marks.subjectId))
          .where(and(eq(marks.studentId, studentId), eq(marks.schoolId, user.schoolId)))
          .orderBy(desc(exams.startDate), asc(subjects.id));

        // Group by exam to show previous examination history
        const marksByExam = new Map<number, typeof allMarks>();
        for (const m of allMarks) {
          const list = marksByExam.get(m.examId) ?? [];
          list.push(m);
          marksByExam.set(m.examId, list);
        }

        previousExams = Array.from(marksByExam.entries()).map(([eId, mList]) => {
          const first = mList[0];
          let total = 0;
          let maxTotal = 0;
          let anyFail = false;

          const subjectMarks = mList.map((m) => {
            const hasPrac = m.hasPractical;
            const tMax = m.theoryMax ?? (hasPrac ? 70 : 90);
            const pMax = m.practicalMax ?? (hasPrac ? 20 : 0);
            const iMax = m.internalMax ?? 10;
            const totMax = 100;

            const finalScore = m.score ?? 0;
            if (!m.isAbsent) {
              total += finalScore;
              maxTotal += totMax;
            }
            const passed = !m.isAbsent && finalScore >= PASS_PERCENTAGE;
            if (!passed) anyFail = true;

            return {
              subjectId: m.subjectId,
              subjectName: m.subjectName,
              subjectCode: m.subjectCode,
              theoryScore: m.theoryScore,
              practicalScore: m.practicalScore,
              internalScore: m.internalScore,
              score: m.score,
              isAbsent: m.isAbsent,
              hasPractical: hasPrac,
              theoryMax: tMax,
              practicalMax: pMax,
              internalMax: iMax,
              totalMax: totMax,
              passed,
            };
          });

          const pct = maxTotal ? round((total / maxTotal) * 100) : 0;
          return {
            examId: eId,
            examName: first.examName,
            month: first.examMonth,
            year: first.examYear,
            marks: subjectMarks,
            total: round(total, 0),
            maxTotal,
            percentage: pct,
            grade: gradeFor(pct).grade,
            passed: !anyFail,
          };
        });

        // If examId is provided, extract current exam marks for prefilling
        if (examId) {
          const currentList = marksByExam.get(examId) ?? [];
          for (const m of currentList) {
            currentExamMarks[m.subjectId] = {
              theoryScore: m.theoryScore,
              practicalScore: m.practicalScore,
              internalScore: m.internalScore,
              score: m.score,
              isAbsent: m.isAbsent,
            };
          }
        }
      }
    }

    return json({
      classes: classRows.map((c) => ({
        ...c,
        isHsc: isHscClass(c.name),
      })),
      exams: examRows,
      selectedClass,
      subjects: subjectList,
      students: studentList,
      selectedStudent,
      previousExams,
      currentExamMarks,
    });
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(request: Request) {
  try {
    const { user } = await requireAuth();
    const body = await request.json();

    const classId = int(body.classId);
    if (!classId) return json({ error: "Class & Section are required." }, 400);

    // Verify class belongs to this school
    const [cls] = await db
      .select({ id: classes.id, name: classes.name, section: classes.section })
      .from(classes)
      .where(and(eq(classes.id, classId), eq(classes.schoolId, user.schoolId)))
      .limit(1);

    if (!cls) return json({ error: "Class not found in this school." }, 404);

    let studentId = int(body.studentId);
    let studentRecord = null;

    if (studentId) {
      // Updating existing student details
      const [updated] = await db
        .update(students)
        .set({
          name: str(body.name) ?? undefined,
          rollNo: int(body.rollNo) ?? undefined,
          admissionNo: str(body.admissionNo) ?? undefined,
          gender: str(body.gender) ?? undefined,
          guardianName: body.guardianName === "" ? null : str(body.guardianName),
          contact: body.contact === "" ? null : str(body.contact),
          dob: body.dob === "" ? null : str(body.dob),
        })
        .where(and(eq(students.id, studentId), eq(students.schoolId, user.schoolId)))
        .returning();

      if (!updated) return json({ error: "Student not found." }, 404);
      studentRecord = updated;
    } else {
      // Creating new student entry
      const name = str(body.name);
      if (!name) return json({ error: "Student name is required." }, 400);

      let rollNo = int(body.rollNo);
      if (!rollNo) {
        const [max] = await db
          .select({ value: sql<number>`coalesce(max(${students.rollNo}), 0)::int` })
          .from(students)
          .where(eq(students.classId, classId));
        rollNo = (max?.value ?? 0) + 1;
      }

      let admissionNo = str(body.admissionNo);
      if (!admissionNo) {
        admissionNo = `EXAM-${classId}-${rollNo}-${Date.now().toString().slice(-4)}`;
      }

      const [created] = await db
        .insert(students)
        .values({
          schoolId: user.schoolId,
          classId,
          name,
          rollNo,
          admissionNo,
          gender: str(body.gender) ?? "Female",
          guardianName: str(body.guardianName) ?? null,
          contact: str(body.contact) ?? null,
          dob: str(body.dob) ?? null,
        })
        .returning();

      studentId = created.id;
      studentRecord = created;
    }

    // Now save marks if examId and marks entries were provided
    const examId = int(body.examId);
    const marksEntries = Array.isArray(body.marks) ? body.marks : [];
    let savedMarksCount = 0;

    if (examId && marksEntries.length > 0 && studentId) {
      const classSubjectsList = await db
        .select({
          id: subjects.id,
          theoryMarks: subjects.theoryMarks,
          practicalMarks: subjects.practicalMarks,
          internalMarks: subjects.internalMarks,
          maxMarks: subjects.maxMarks,
        })
        .from(subjects)
        .where(eq(subjects.schoolId, user.schoolId));
      const subMap = new Map(classSubjectsList.map((s) => [s.id, s]));

      const values: Array<typeof marks.$inferInsert> = [];

      for (const entry of marksEntries) {
        const subjectId = Number(entry.subjectId);
        if (!subjectId) continue;

        const isAbsent = Boolean(entry.isAbsent);

        if (isAbsent) {
          values.push({
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
          });
          continue;
        }

        const parseNum = (v: unknown): number | null => {
          if (v === null || v === undefined || v === "") return null;
          const n = Number(v);
          return Number.isFinite(n) ? n : null;
        };

        const subMeta = subMap.get(subjectId);
        const tMax = subMeta?.theoryMarks ?? 100;
        const pMax = subMeta?.practicalMarks ?? 0;
        const iMax = subMeta?.internalMarks ?? 10;

        const rawTheory = parseNum(entry.theoryScore);
        const rawPractical = parseNum(entry.practicalScore);
        const rawInternal = parseNum(entry.internalScore);

        // Clamp to not exceed assigned marks
        const theoryScore = rawTheory !== null ? Math.min(Math.max(0, rawTheory), tMax) : null;
        const practicalScore = rawPractical !== null ? Math.min(Math.max(0, rawPractical), pMax) : null;
        const internalScore = rawInternal !== null ? Math.min(Math.max(0, rawInternal), iMax) : null;

        let totalScore: number | null = null;
        if (theoryScore !== null || practicalScore !== null || internalScore !== null) {
          totalScore = (theoryScore ?? 0) + (practicalScore ?? 0) + (internalScore ?? 0);
        } else if (entry.score !== null && entry.score !== undefined) {
          const rawScore = parseNum(entry.score);
          totalScore = rawScore !== null ? Math.min(Math.max(0, rawScore), subMeta?.maxMarks ?? 100) : null;
        }

        values.push({
          schoolId: user.schoolId,
          studentId,
          subjectId,
          examId,
          theoryScore,
          practicalScore,
          internalScore,
          score: totalScore,
          isAbsent: false,
          enteredById: user.id,
          updatedAt: new Date(),
        });
      }

      if (values.length > 0) {
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
        savedMarksCount = values.length;
      }
    }

    return json({
      student: studentRecord,
      savedMarksCount,
    });
  } catch (error) {
    return handleError(error);
  }
}

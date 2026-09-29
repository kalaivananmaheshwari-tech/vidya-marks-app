import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { classes, groups, subjects, users } from "@/db/schema";
import { handleError, int, json, requireAuth, str } from "@/lib/api";
import { studentCountByClass } from "@/lib/counts";

export const dynamic = "force-dynamic";

function isClass11or12(name: string): boolean {
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

const DEFAULT_SUBJECTS_6_TO_10 = [
  { name: "Language", code: "LNG", hasPractical: false },
  { name: "English", code: "ENG", hasPractical: false },
  { name: "Mathematics", code: "MAT", hasPractical: false },
  { name: "Science", code: "SCI", hasPractical: true },
  { name: "Social Science", code: "SOC", hasPractical: false },
  { name: "PET", code: "PET", hasPractical: false },
  { name: "TNSPARK", code: "TNP", hasPractical: false },
  { name: "Science Tamil", code: "SCT", hasPractical: true },
];

export async function GET() {
  try {
    const { user } = await requireAuth();
    const [rows, counts] = await Promise.all([
      db
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
          classTeacherId: classes.classTeacherId,
          classTeacher: users.name,
        })
        .from(classes)
        .leftJoin(groups, eq(groups.id, classes.groupId))
        .leftJoin(users, eq(users.id, classes.classTeacherId))
        .where(eq(classes.schoolId, user.schoolId))
        .orderBy(asc(classes.name), asc(classes.section)),
      studentCountByClass(user.schoolId),
    ]);

    return json({
      classes: rows.map((row) => ({ ...row, studentCount: counts.get(row.id) ?? 0 })),
    });
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(request: Request) {
  try {
    const { user, school } = await requireAuth();
    const body = await request.json();
    const name = str(body.name);
    if (!name) return json({ error: "Class name is required." }, 400);

    const section = str(body.section)?.toUpperCase() ?? "A";
    const academicYear = str(body.academicYear) ?? school.academicYear;
    const room = str(body.room) ?? null;
    const classTeacherId = int(body.classTeacherId) ?? null;

    let groupId: number | null = int(body.groupId) ?? null;

    const isHsc = isClass11or12(name);

    // If 11, 12: user enters Group Code and Sub 1 to Sub 6
    if (isHsc) {
      const groupCode = str(body.groupCode)?.toUpperCase();
      if (groupCode) {
        // find or create group
        const [existing] = await db
          .select()
          .from(groups)
          .where(and(eq(groups.schoolId, user.schoolId), eq(groups.code, groupCode)))
          .limit(1);

        if (existing) {
          groupId = existing.id;
        } else {
          const [newGroup] = await db
            .insert(groups)
            .values({
              schoolId: user.schoolId,
              code: groupCode,
              name: str(body.groupName) ?? `Group ${groupCode}`,
              stream: str(body.stream) ?? "Science",
            })
            .returning();
          groupId = newGroup.id;
        }
      }
    } else {
      // If 6 to 10: Group Code is disabled!
      groupId = null;
    }

    // Insert class
    const [cls] = await db
      .insert(classes)
      .values({
        schoolId: user.schoolId,
        name,
        section,
        groupId,
        academicYear,
        room,
        classTeacherId,
      })
      .returning();

    // Now set up the subjects:
    if (isHsc) {
      // Sub 1 to Sub 6 from user
      const rawSubs = Array.isArray(body.subjects)
        ? body.subjects
        : [body.sub1, body.sub2, body.sub3, body.sub4, body.sub5, body.sub6];
      const validSubs = rawSubs.filter((s: unknown) => typeof s === "string" && s.trim().length > 0);

      if (validSubs.length > 0) {
        for (let i = 0; i < validSubs.length; i++) {
          const subName = String(validSubs[i]).trim();
          const subCode = `C${cls.id}-S${i + 1}`;
          // Check if it's typically practical (Physics, Chemistry, Biology, Computer Science, etc.)
          const hasPractical = /physics|chemistry|biology|computer|botany|zoology/i.test(subName);
          const theoryMarks = hasPractical ? 70 : 90;
          const practicalMarks = hasPractical ? 20 : 0;
          const internalMarks = 10;

          await db.insert(subjects).values({
            schoolId: user.schoolId,
            classId: cls.id,
            groupId: groupId,
            code: subCode,
            name: subName,
            hasPractical,
            theoryMarks,
            practicalMarks,
            internalMarks,
            maxMarks: 100,
            passMarks: 35,
          });
        }
      }
    } else {
      // 6 to 10: Sets to Default Language, English, Mathematics, Science, Social Science, PET, TNSPARK, Science Tamil
      for (const defSub of DEFAULT_SUBJECTS_6_TO_10) {
        const subCode = `C${cls.id}-${defSub.code}`;
        const theoryMarks = defSub.hasPractical ? 70 : 90;
        const practicalMarks = defSub.hasPractical ? 20 : 0;
        const internalMarks = 10;

        await db.insert(subjects).values({
          schoolId: user.schoolId,
          classId: cls.id,
          groupId: null,
          code: subCode,
          name: defSub.name,
          hasPractical: defSub.hasPractical,
          theoryMarks,
          practicalMarks,
          internalMarks,
          maxMarks: 100,
          passMarks: 35,
        });
      }
    }

    return json({ class: cls }, 201);
  } catch (error) {
    return handleError(error);
  }
}

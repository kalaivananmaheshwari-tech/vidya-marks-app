import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { classes, groups } from "@/db/schema";
import { handleError, int, json, notFound, requireAuth, str } from "@/lib/api";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

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

export async function PATCH(request: Request, { params }: Ctx) {
  try {
    const { user } = await requireAuth();
    const { id } = await params;
    const body = await request.json();
    const name = str(body.name);

    let groupId: number | null | undefined = body.groupId === null || body.groupId === "" ? null : int(body.groupId);

    if (name && isClass11or12(name)) {
      const groupCode = str(body.groupCode)?.toUpperCase();
      if (groupCode) {
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
    } else if (name && !isClass11or12(name)) {
      // 6 to 10: group code disabled
      groupId = null;
    }

    const [row] = await db
      .update(classes)
      .set({
        name,
        section: str(body.section)?.toUpperCase(),
        groupId,
        academicYear: str(body.academicYear),
        room: body.room === "" ? null : str(body.room),
        classTeacherId:
          body.classTeacherId === null || body.classTeacherId === ""
            ? null
            : int(body.classTeacherId),
      })
      .where(and(eq(classes.id, Number(id)), eq(classes.schoolId, user.schoolId)))
      .returning();
    if (!row) return notFound("Class not found");
    return json({ class: row });
  } catch (error) {
    return handleError(error);
  }
}

export async function DELETE(_request: Request, { params }: Ctx) {
  try {
    const { user } = await requireAuth();
    const { id } = await params;
    const [row] = await db
      .delete(classes)
      .where(and(eq(classes.id, Number(id)), eq(classes.schoolId, user.schoolId)))
      .returning();
    if (!row) return notFound("Class not found");
    return json({ ok: true });
  } catch (error) {
    return handleError(error);
  }
}

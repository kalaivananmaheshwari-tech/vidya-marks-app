import { eq } from "drizzle-orm";
import { db } from "@/db";
import { ensureSchema } from "@/db/bootstrap";
import { exams, groups, schools, subjects, users } from "@/db/schema";
import { createSession, hashPassword, isValidUdise, toSafeUser } from "@/lib/auth";
import { handleError, json, str } from "@/lib/api";
import { DEFAULT_ACADEMIC_YEAR } from "@/lib/academic";

export const dynamic = "force-dynamic";

/**
 * Registers a new school.
 * The 11-digit UDISE code becomes the admin's login username.
 */
export async function POST(request: Request) {
  try {
    await ensureSchema();
    const body = await request.json();
    const schoolName = str(body.schoolName);
    const udiseCode = str(body.udiseCode)?.replace(/\s/g, "");
    const adminName = str(body.adminName) ?? "Principal";
    const password = str(body.password);
    const confirmPassword = str(body.confirmPassword);

    if (!schoolName) return json({ error: "School name is required." }, 400);
    if (!udiseCode || !isValidUdise(udiseCode)) {
      return json({ error: "UDISE code must be exactly 11 digits." }, 400);
    }
    if (!password || password.length < 6) {
      return json({ error: "Password must be at least 6 characters." }, 400);
    }
    if (confirmPassword !== undefined && password !== confirmPassword) {
      return json({ error: "Passwords do not match." }, 400);
    }

    const [existingSchool] = await db
      .select({ id: schools.id })
      .from(schools)
      .where(eq(schools.udiseCode, udiseCode))
      .limit(1);
    if (existingSchool) {
      return json(
        { error: "This UDISE code is already registered. Sign in instead, or contact your admin." },
        409,
      );
    }

    const [existingUser] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.username, udiseCode))
      .limit(1);
    if (existingUser) return json({ error: "This UDISE code is already in use." }, 409);

    const academicYear = str(body.academicYear) ?? DEFAULT_ACADEMIC_YEAR;
    const phone = str(body.phone);
    if (!phone || phone.replace(/\D/g, "").length < 10) {
      return json(
        { error: "A phone number (at least 10 digits) is required — it verifies admin password recovery." },
        400,
      );
    }

    const [school] = await db
      .insert(schools)
      .values({
        name: schoolName,
        udiseCode,
        district: str(body.district) ?? null,
        state: str(body.state) ?? null,
        email: str(body.email) ?? null,
        phone: str(body.phone) ?? null,
        academicYear,
      })
      .returning();

    const [admin] = await db
      .insert(users)
      .values({
        schoolId: school.id,
        username: udiseCode,
        name: adminName,
        passwordHash: hashPassword(password),
        role: "admin",
        designation: str(body.designation) ?? "Principal / Headmaster",
        email: str(body.email) ?? null,
        phone,
      })
      .returning();

    // Light starter scaffold so the workspace is usable immediately.
    const [generalGroup] = await db
      .insert(groups)
      .values({
        schoolId: school.id,
        code: "GEN",
        name: "General Academic",
        stream: "General",
        description: "Default group for classes that follow the common curriculum.",
      })
      .returning();

    await db.insert(subjects).values([
      { schoolId: school.id, code: "ENG", name: "English", groupId: null },
      { schoolId: school.id, code: "LNG", name: "Regional Language", groupId: null },
      { schoolId: school.id, code: "MAT", name: "Mathematics", groupId: generalGroup.id },
      { schoolId: school.id, code: "SCI", name: "Science", groupId: generalGroup.id },
      { schoolId: school.id, code: "SOC", name: "Social Science", groupId: generalGroup.id },
    ]);

    await db.insert(exams).values({
      schoolId: school.id,
      name: "Unit Test I",
      month: "July",
      year: "2025",
      term: "Term 1",
      academicYear,
      maxMarks: 100,
    });

    await createSession(admin.id);
    return json({ user: toSafeUser(admin), school }, 201);
  } catch (error) {
    return handleError(error);
  }
}

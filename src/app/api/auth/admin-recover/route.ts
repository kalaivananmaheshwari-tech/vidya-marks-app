import { eq } from "drizzle-orm";
import { db } from "@/db";
import { schools, sessions, users } from "@/db/schema";
import { ensureSchema } from "@/db/bootstrap";
import { hashPassword } from "@/lib/auth";
import { badRequest, handleError, json, str } from "@/lib/api";

export const dynamic = "force-dynamic";

function digitsOnly(value: string | null | undefined): string {
  return (value ?? "").replace(/\D/g, "");
}

/**
 * Forgiving phone comparison: matches after stripping formatting, and also
 * tolerates a missing / extra country code (e.g. "+91 98400 11223" vs
 * "9840011223") by comparing the last 10 digits.
 */
function phoneMatches(input: string, stored: string | null | undefined): boolean {
  const a = digitsOnly(input);
  const b = digitsOnly(stored);
  if (!a || !b) return false;
  if (a === b) return true;
  return a.length >= 10 && b.length >= 10 && a.slice(-10) === b.slice(-10);
}

/**
 * Public self-service: "Forgot password / change admin details".
 *
 * Verifies the admin username together with the phone number registered for
 * that school, then updates the admin name / designation / phone and/or the
 * password. This covers both a forgotten password and the (periodic) change
 * of Headmaster / Headmistress / Principal.
 */
export async function POST(request: Request) {
  try {
    await ensureSchema();
    const body = await request.json();

    const username = str(body.username)?.trim().toLowerCase().replace(/\s/g, "");
    const phone = str(body.phone) ?? "";
    if (!username) return badRequest("Select your username (school UDISE code) first.");
    if (!phone.trim()) {
      return badRequest("Enter the phone number registered with the school to verify your identity.");
    }

    const rows = await db
      .select({ user: users, school: schools })
      .from(users)
      .innerJoin(schools, eq(schools.id, users.schoolId))
      .where(eq(users.username, username))
      .limit(1);

    const row = rows[0];
    if (!row || row.user.role !== "admin") {
      return json({ error: "No admin account found for that username." }, 404);
    }

    // Identity check: the supplied phone must match the registered admin or
    // school phone number.
    const verified =
      phoneMatches(phone, row.user.phone) || phoneMatches(phone, row.school.phone);
    if (!verified) {
      return json(
        {
          error:
            "Phone number does not match our records. Enter the phone number registered with this school.",
        },
        403,
      );
    }

    const adminName = str(body.adminName)?.trim();
    const designation = str(body.designation)?.trim();
    const newPhone = str(body.newPhone)?.trim();
    const newPassword = str(body.newPassword) ?? "";
    const confirmPassword = str(body.confirmPassword) ?? "";

    if (newPassword) {
      if (newPassword.length < 6) {
        return badRequest("New password must be at least 6 characters.");
      }
      if (newPassword !== confirmPassword) {
        return badRequest("New passwords do not match.");
      }
    }

    const nameChange = Boolean(adminName) && adminName !== row.user.name;
    const designationChange =
      Boolean(designation) && designation !== (row.user.designation ?? "");
    const phoneChange =
      digitsOnly(newPhone).length > 0 && !phoneMatches(newPhone ?? "", row.user.phone);
    const passwordChange = Boolean(newPassword);

    if (!nameChange && !designationChange && !phoneChange && !passwordChange) {
      return badRequest("Nothing to update — change the admin name, phone or password.");
    }

    await db
      .update(users)
      .set({
        ...(nameChange ? { name: adminName } : {}),
        ...(designationChange ? { designation } : {}),
        ...(phoneChange ? { phone: newPhone } : {}),
        ...(passwordChange ? { passwordHash: hashPassword(newPassword) } : {}),
      })
      .where(eq(users.id, row.user.id));

    if (phoneChange) {
      await db.update(schools).set({ phone: newPhone }).where(eq(schools.id, row.school.id));
    }

    // A password change signs out every existing session for this admin
    // (e.g. the previous Headmaster must not stay signed in).
    if (passwordChange) {
      await db.delete(sessions).where(eq(sessions.userId, row.user.id));
    }

    return json({
      ok: true,
      message: passwordChange
        ? "Admin details updated and password reset. Sign in with your username and the new password."
        : "Admin details updated successfully.",
      updated: {
        name: nameChange,
        designation: designationChange,
        phone: phoneChange,
        password: passwordChange,
      },
    });
  } catch (error) {
    return handleError(error);
  }
}

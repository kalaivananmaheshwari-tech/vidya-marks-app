import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { schools, users } from "@/db/schema";
import { ensureSchema } from "@/db/bootstrap";
import { ensureSeed } from "@/db/seed";
import { handleError, json } from "@/lib/api";

export const dynamic = "force-dynamic";

function digitsOnly(value: string | null | undefined): string {
  return (value ?? "").replace(/\D/g, "");
}

/** Shows only the last 4 digits, e.g. "••••• 11223" → "••••• 3312" style. */
function maskPhone(phone: string | null | undefined): string {
  const d = digitsOnly(phone);
  if (!d) return "";
  return `••••• ${d.slice(-4)}`;
}

/**
 * Public: lists school admin accounts for the "Forgot password / change admin
 * details" list box on the register page. The username (school UDISE code) is
 * selectable but never editable; the phone number is returned masked only.
 */
export async function GET() {
  try {
    await ensureSchema();
    await ensureSeed().catch(() => undefined);

    const rows = await db
      .select({
        username: users.username,
        adminName: users.name,
        designation: users.designation,
        adminPhone: users.phone,
        schoolName: schools.name,
        schoolPhone: schools.phone,
      })
      .from(users)
      .innerJoin(schools, eq(schools.id, users.schoolId))
      .where(eq(users.role, "admin"))
      .orderBy(asc(schools.name));

    return json({
      admins: rows.map((r) => ({
        username: r.username,
        schoolName: r.schoolName,
        adminName: r.adminName,
        designation: r.designation ?? "Principal",
        phoneMasked: maskPhone(r.adminPhone ?? r.schoolPhone),
        hasPhone: Boolean(r.adminPhone || r.schoolPhone),
      })),
    });
  } catch (error) {
    return handleError(error);
  }
}

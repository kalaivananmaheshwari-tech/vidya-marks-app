import { z } from "zod";
import { db } from "@/db";
import { ensureSchema } from "@/db/bootstrap";
import { exams, groups, schools, subjects, users, schoolPolicies } from "@/db/schema";
import { hashPassword, issueSession, setSessionCookie, toSafeUser } from "@/lib/auth";
import { handleError, HttpError, json, readJson } from "@/lib/api";
import { DEFAULT_ACADEMIC_YEAR } from "@/lib/academic";
import { geographicRegistrationSchema, REGISTRATION_USER_TYPES, SCHOOL_MANAGEMENTS, SCHOOL_TYPES } from "@/lib/domain/geography";
import { addMembership, yearRecord } from "@/lib/relations";
import { audit } from "@/lib/audit";
import { consumeRateLimit, requestFingerprint } from "@/lib/security";

export const dynamic = "force-dynamic";
const text = z.string().trim().min(1).max(150);
const registration = z.object({
  userType: z.enum(REGISTRATION_USER_TYPES), adminName: text, password: z.string().min(10).max(128), confirmPassword: z.string().min(10).max(128),
  district: text, educationalDistrict: text.optional(), block: text.optional(),
  schoolName: text.optional(), udiseCode: z.string().regex(/^\d{11}$/).optional(),
  management: z.enum(SCHOOL_MANAGEMENTS).optional(), schoolType: z.enum(SCHOOL_TYPES).optional(),
  academicYear: z.string().regex(/^\d{4}-\d{4}$/).optional(), phone: z.string().trim().min(10).max(20),
  email: z.union([z.string().email().max(200), z.literal("")]).optional(), state: z.string().trim().max(100).optional(), designation: z.string().trim().max(100).optional(),
}).strict().refine((b) => b.password === b.confirmPassword, "Passwords do not match.");
export async function POST(request: Request) {
  try {
    await ensureSchema(); await consumeRateLimit(`registration:${requestFingerprint(request)}`, 10, 60 * 60 * 1000);
    const body = await readJson(request, registration);
    if (["CEO", "DEO", "BEO"].includes(body.userType)) {
      geographicRegistrationSchema.parse(body);
      throw new HttpError("Geographic account activation requires authorized identity verification. Public privileged self-registration is not enabled.", 503, "AUTHORITY_VERIFICATION_REQUIRED");
    }
    if (!body.schoolName || !body.udiseCode || !body.management || !body.schoolType || !body.educationalDistrict || !body.block) throw new HttpError("School name, UDISE, management, type, district, educational district and block are required.");
    const digits = body.phone.replace(/\D/g, "");
    const contact = digits.length === 12 && digits.startsWith("91") ? digits.slice(2) : digits;
    if (!/^[6-9]\d{9}$/.test(contact)) throw new HttpError("Enter the registered Admin Contact Number as a valid 10-digit mobile number.");
    const role = body.userType as "HEADMASTER" | "PRINCIPAL";
    const result = await db.transaction(async (tx) => {
      const academicYear = await yearRecord(body.academicYear ?? DEFAULT_ACADEMIC_YEAR, tx);
      const [school] = await tx.insert(schools).values({ name: body.schoolName!, udiseCode: body.udiseCode!, district: body.district, educationalDistrict: body.educationalDistrict, block: body.block, management: body.management, schoolType: body.schoolType, state: body.state || "Tamil Nadu", email: body.email || null, phone: contact, adminContactNumber: contact, academicYear: academicYear.label, academicYearId: academicYear.id }).returning();
      const [admin] = await tx.insert(users).values({ schoolId: school.id, username: school.udiseCode, name: body.adminName, passwordHash: hashPassword(body.password), role: "admin", userType: role, designation: role, email: body.email || null, phone: contact }).returning();
      const membership = await addMembership(tx, school.id, admin.id, admin.username, role);
      const [group] = await tx.insert(groups).values({ schoolId: school.id, code: "GEN", name: "General Academic", stream: "General", description: "Common curriculum for secondary classes." }).returning();
      await tx.insert(subjects).values([
        { schoolId: school.id, code: "ENG", name: "English" }, { schoolId: school.id, code: "LNG", name: "Language" },
        { schoolId: school.id, code: "MAT", name: "Mathematics", groupId: group.id }, { schoolId: school.id, code: "SCI", name: "Science", groupId: group.id }, { schoolId: school.id, code: "SOC", name: "Social Science", groupId: group.id },
      ]);
      await tx.insert(exams).values({ schoolId: school.id, name: "Unit Test I", academicYear: academicYear.label, academicYearId: academicYear.id, year: String(academicYear.startYear), maxMarks: 100 });
      await tx.insert(schoolPolicies).values({ schoolId: school.id });
      await audit(tx, { user: { id: admin.id, schoolId: school.id } }, "school.registered", "schools", school.id, { userType: role, management: school.management, schoolType: school.schoolType, academicYearId: academicYear.id });
      const session = await issueSession(admin.id, membership.id, tx);
      return { school, user: toSafeUser(admin), session };
    });
    await setSessionCookie(result.session);
    return json({ user: result.user, school: result.school }, 201);
  } catch (error) { return handleError(error); }
}

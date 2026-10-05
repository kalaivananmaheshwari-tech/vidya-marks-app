import { z } from "zod";

export const REGISTRATION_USER_TYPES = ["CEO", "DEO", "HEADMASTER", "BEO", "PRINCIPAL"] as const;
export const SCHOOL_MANAGEMENTS = ["Government", "Aided", "Matric"] as const;
export const SCHOOL_TYPES = ["Higher Secondary", "Secondary", "Middle", "Elementary"] as const;
export type GeographicRole = "CEO" | "DEO" | "BEO";
export type GeographicScope = { role: string; district: string; educationalDistrict: string | null; block: string | null };
export const normalizeGeography = (value: string | null | undefined) => (value ?? "").trim().replace(/\s+/g, " ").toLocaleLowerCase("en-IN");
export function validGeographicScope(scope: GeographicScope): boolean {
  if (!["CEO", "DEO", "BEO"].includes(scope.role) || !normalizeGeography(scope.district)) return false;
  if (scope.role !== "CEO" && !normalizeGeography(scope.educationalDistrict)) return false;
  if (scope.role === "BEO" && !normalizeGeography(scope.block)) return false;
  return true;
}
export function schoolInGeographicScope(scope: GeographicScope, school: { district: string | null; educationalDistrict: string | null; block: string | null }): boolean {
  return validGeographicScope(scope) && normalizeGeography(scope.district) === normalizeGeography(school.district)
    && (scope.role === "CEO" || normalizeGeography(scope.educationalDistrict) === normalizeGeography(school.educationalDistrict))
    && (scope.role !== "BEO" || normalizeGeography(scope.block) === normalizeGeography(school.block));
}
const name = z.string().trim().min(1).max(150);
export const geographicRegistrationSchema = z.discriminatedUnion("userType", [
  z.object({ userType: z.literal("CEO"), district: name }),
  z.object({ userType: z.literal("DEO"), district: name, educationalDistrict: name }),
  z.object({ userType: z.literal("BEO"), district: name, educationalDistrict: name, block: name }),
]);

/**
 * 15 Consecutive Academic Years starting from 2026-2027.
 * User requirement: "In School registration Academic Year 2026-2027 select from the user,
 * next Academic years up to 15 Academic years. From 2026-2027 to consecutive 15 Academic years."
 */
export const ACADEMIC_YEARS = [
  "2026-2027",
  "2027-2028",
  "2028-2029",
  "2029-2030",
  "2030-2031",
  "2031-2032",
  "2032-2033",
  "2033-2034",
  "2034-2035",
  "2035-2036",
  "2036-2037",
  "2037-2038",
  "2038-2039",
  "2039-2040",
  "2040-2041",
] as const;

export type AcademicYear = (typeof ACADEMIC_YEARS)[number];

export const DEFAULT_ACADEMIC_YEAR: AcademicYear = "2026-2027";

/**
 * Tamil Nadu School Education Department - CCE Grading & Level Evaluation
 * Marks out of 100 (FA 40 + SA 60):
 * 91-100: A1, Level 4
 * 81-90 : A2, Level 4
 * 71-80 : B1, Level 3
 * 61-70 : B2, Level 3
 * 51-60 : C1, Level 2
 * 41-50 : C2, Level 2
 * 33-40 : D,  Level 1
 * Below 33: E, Level 1
 */
export function getCceGradeAndLevel(totalMarks: number | null | undefined): {
  grade: string;
  level: string;
} {
  if (totalMarks === null || totalMarks === undefined || Number.isNaN(totalMarks)) {
    return { grade: "-", level: "-" };
  }

  const score = Math.round(totalMarks);
  if (score >= 91) return { grade: "A1", level: "4" };
  if (score >= 81) return { grade: "A2", level: "4" };
  if (score >= 71) return { grade: "B1", level: "3" };
  if (score >= 61) return { grade: "B2", level: "3" };
  if (score >= 51) return { grade: "C1", level: "2" };
  if (score >= 41) return { grade: "C2", level: "2" };
  if (score >= 33) return { grade: "D", level: "1" };
  return { grade: "E", level: "1" };
}

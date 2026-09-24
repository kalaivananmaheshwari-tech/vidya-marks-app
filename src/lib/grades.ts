export const PASS_PERCENTAGE = 35;

export const GRADE_SCALE = [
  { grade: "A+", min: 90, label: "Outstanding", color: "#059669" },
  { grade: "A", min: 80, label: "Excellent", color: "#10b981" },
  { grade: "B+", min: 70, label: "Very Good", color: "#22c55e" },
  { grade: "B", min: 60, label: "Good", color: "#84cc16" },
  { grade: "C", min: 50, label: "Average", color: "#eab308" },
  { grade: "D", min: 40, label: "Needs Focus", color: "#f97316" },
  { grade: "E", min: 35, label: "Just Passed", color: "#fb7185" },
  { grade: "F", min: 0, label: "Failed", color: "#e11d48" },
] as const;

export type GradeInfo = (typeof GRADE_SCALE)[number];

export function gradeFor(percentage: number | null | undefined): GradeInfo {
  if (percentage === null || percentage === undefined || Number.isNaN(percentage)) {
    return GRADE_SCALE[GRADE_SCALE.length - 1];
  }
  return GRADE_SCALE.find((g) => percentage >= g.min) ?? GRADE_SCALE[GRADE_SCALE.length - 1];
}

export function emptyGradeBuckets(): Record<string, number> {
  return Object.fromEntries(GRADE_SCALE.map((g) => [g.grade, 0]));
}

export function round(value: number, digits = 1): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export function percent(score: number, max: number): number {
  if (!max) return 0;
  return (score / max) * 100;
}

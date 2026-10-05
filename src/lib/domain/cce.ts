import { DomainError } from "./marks";

export const CCE_WORKFLOW_ENABLED = false;
export const CCE_UNRESOLVED = [
  "FA Total rule", "Level mapping", "CCE entry workflow", "CCE permissions",
  "Term structure", "Publication/edit workflow",
] as const;

export type CCEGrade = "A1" | "A2" | "B1" | "B2" | "C1" | "C2" | "D" | "E1" | "E2";
const grades: CCEGrade[] = ["A1", "A2", "B1", "B2", "C1", "C2", "D", "E1", "E2"];
function grade(value: number, maximum: number, minima: number[]): CCEGrade {
  // Only integer ranges have been approved. Do not round fractional input into a grade.
  if (!Number.isInteger(value) || value < 0 || value > maximum) throw new DomainError(`CCE marks must be whole numbers between 0 and ${maximum}.`);
  return grades[minima.findIndex((min) => value >= min)];
}
export function calculateFAAGrade(value: number): CCEGrade {
  return grade(value, 40, [37, 33, 29, 25, 21, 17, 13, 9, 0]);
}
export function calculateSAGrade(value: number): CCEGrade {
  return grade(value, 60, [55, 49, 43, 37, 31, 25, 19, 13, 0]);
}
export function calculateTotalGrade(value: number): CCEGrade {
  return grade(value, 100, [91, 81, 71, 61, 51, 41, 33, 21, 0]);
}
export function calculateApprovedCCEScores(faA: number, sa: number) {
  const faAGrade = calculateFAAGrade(faA);
  const saGrade = calculateSAGrade(sa);
  const total = faA + sa;
  return { faA, faAGrade, sa, saGrade, total, totalGrade: calculateTotalGrade(total) };
}

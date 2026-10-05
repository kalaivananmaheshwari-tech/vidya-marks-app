import {sumMarks} from "@/lib/domain/decimal-sum";
import { z } from "zod";

export type MarkState = "NUMERIC" | "AB" | "EXEMPT" | "PENDING";
export type ResultState = "Pass" | "Fail" | "AB" | "Exemption" | "Pending";
export type ComponentKind = "theory" | "practical" | "internal" | "total";
export type Allocation = {
  theoryMarks: number; practicalMarks: number; internalMarks: number;
  maxMarks: number; passMarks: number; hasPractical: boolean;
  mode: "COMPONENTS" | "TOTAL";
};

export class DomainError extends Error {
  readonly code = "INVALID_MARKS";
}

export function classNumber(name: string): number | null {
  const value = name.trim().replace(/^class\s+/i, "").toUpperCase();
  const roman: Record<string, number> = { I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7, VIII: 8, IX: 9, X: 10, XI: 11, XII: 12 };
  const n = roman[value] ?? (/^\d{1,2}$/.test(value) ? Number(value) : NaN);
  return Number.isInteger(n) && n >= 1 && n <= 12 ? n : null;
}

/** Only approved rules. In particular, 8–10 / no practical has ONE total input. */
export function allocationFor(grade: number, hasPractical: boolean): Allocation {
  if (!Number.isInteger(grade) || grade < 6 || grade > 12) {
    throw new DomainError("Mark allocation rules are approved only for classes 6–12.");
  }
  if (grade >= 8 && grade <= 10) {
    return hasPractical
      ? { theoryMarks: 75, practicalMarks: 25, internalMarks: 0, maxMarks: 100, passMarks: 35, hasPractical, mode: "COMPONENTS" }
      : { theoryMarks: 0, practicalMarks: 0, internalMarks: 0, maxMarks: 100, passMarks: 35, hasPractical, mode: "TOTAL" };
  }
  return { theoryMarks: hasPractical ? 70 : 90, practicalMarks: hasPractical ? 20 : 0, internalMarks: 10, maxMarks: 100, passMarks: 35, hasPractical, mode: "COMPONENTS" };
}

const numeric = z.number().finite().nullable().optional();
export const markInputSchema = z.object({
  theoryScore: numeric, practicalScore: numeric, internalScore: numeric, score: numeric,
  status: z.enum(["NUMERIC", "AB", "EXEMPT", "PENDING"]).optional(),
  isAbsent: z.boolean().optional(), isExempt: z.boolean().optional(),
}).strict();
export type MarkInput = z.infer<typeof markInputSchema>;
export type ValidatedMark = {
  theoryScore: number | null; practicalScore: number | null; internalScore: number | null;
  score: number | null; status: MarkState; isAbsent: boolean; isExempt: boolean;
};

function scoreInRange(value: number | null | undefined, maximum: number, label: string): number | null {
  if (value == null) return null;
  if (!Number.isFinite(value) || value < 0 || value > maximum) {
    throw new DomainError(`${label} must be between 0 and ${maximum}.`);
  }
  return value;
}

/** A missing required component stays PENDING; it is never silently added as zero. */
export function validateAndCalculateMark(input: MarkInput, allocation: Allocation): ValidatedMark {
  const parsed = markInputSchema.safeParse(input);
  if (!parsed.success) throw new DomainError("Invalid mark input. Use finite numeric marks, AB or Exemption.");
  const data = parsed.data;
  if ((data.isAbsent && data.isExempt) || (data.status === "AB" && data.isExempt) || (data.status === "EXEMPT" && data.isAbsent)) {
    throw new DomainError("AB and Exemption are separate states.");
  }
  const state: MarkState = data.isAbsent ? "AB" : data.isExempt ? "EXEMPT" : data.status ?? "PENDING";
  if ((data.isAbsent || data.isExempt) && data.status && data.status !== state) {
    throw new DomainError("Conflicting mark states.");
  }
  if (state === "AB" || state === "EXEMPT") {
    if ([data.theoryScore, data.practicalScore, data.internalScore, data.score].some((v) => v != null)) {
      throw new DomainError("AB/Exemption cannot contain numeric marks.");
    }
    return { theoryScore: null, practicalScore: null, internalScore: null, score: null, status: state, isAbsent: state === "AB", isExempt: state === "EXEMPT" };
  }
  const theoryScore = scoreInRange(data.theoryScore, allocation.theoryMarks, "Theory");
  const practicalScore = scoreInRange(data.practicalScore, allocation.practicalMarks, "Practical");
  const internalScore = scoreInRange(data.internalScore, allocation.internalMarks, "Internal");
  if ((allocation.theoryMarks === 0 && theoryScore !== null) || (allocation.practicalMarks === 0 && practicalScore !== null) || (allocation.internalMarks === 0 && internalScore !== null)) {
    throw new DomainError("A mark was supplied for a component that does not exist in this allocation.");
  }
  let score: number | null = null;
  if (allocation.mode === "TOTAL") {
    score = scoreInRange(data.score, 100, "Total");
  } else {
    const components = [
      { maximum: allocation.theoryMarks, value: theoryScore },
      { maximum: allocation.practicalMarks, value: practicalScore },
      { maximum: allocation.internalMarks, value: internalScore },
    ].filter((c) => c.maximum > 0);
    if (components.every((c) => c.value !== null)) {
      score = sumMarks(components.map((c)=>c.value!));
    }
    if (data.score != null && (score === null || Math.abs(data.score - score) > 0.00001)) {
      throw new DomainError("Total must equal all required components; the server calculates it.");
    }
  }
  if (data.status === "NUMERIC" && score === null) throw new DomainError("All required marks must be entered for a numeric result.");
  return { theoryScore, practicalScore, internalScore, score, status: score === null ? "PENDING" : "NUMERIC", isAbsent: false, isExempt: false };
}

export type ResultMark = { score: number | null; status?: string | null; isAbsent?: boolean | null; isExempt?: boolean | null };
export function markState(mark: ResultMark | null | undefined): MarkState {
  if (!mark) return "PENDING";
  if (mark.isAbsent || mark.status === "AB") return "AB";
  if (mark.isExempt || mark.status === "EXEMPT") return "EXEMPT";
  if (mark.status === "PENDING") return "PENDING";
  return mark.score !== null && Number.isFinite(mark.score) ? "NUMERIC" : "PENDING";
}
export function resultForMark(mark: ResultMark | null | undefined): ResultState {
  const state = markState(mark);
  if (state === "AB") return "AB";
  if (state === "EXEMPT") return "Exemption";
  if (state === "PENDING") return "Pending";
  return mark!.score! >= 35 ? "Pass" : "Fail";
}
export function allRequiredPassed(requiredIds: readonly number[], marks: ReadonlyMap<number, ResultMark>): boolean {
  return requiredIds.length > 0 && requiredIds.every((id) => resultForMark(marks.get(id)) === "Pass");
}
export function subjectOnlyFailure(selectedId: number, requiredIds: readonly number[], marks: ReadonlyMap<number, ResultMark>): boolean {
  return requiredIds.includes(selectedId) && resultForMark(marks.get(selectedId)) === "Fail" && requiredIds.filter((id) => id !== selectedId).every((id) => resultForMark(marks.get(id)) === "Pass");
}

/** Mutates only eligible objects, using an eligible-only position and exact totals. */
export function competitionRanks<T>(items: readonly T[], value: (item: T) => number, eligible: (item: T) => boolean = () => true): Map<T, number> {
  const sorted = items.filter(eligible).slice().sort((a, b) => value(b) - value(a));
  const ranks = new Map<T, number>();
  let rank = 0;
  for (let i = 0; i < sorted.length; i++) {
    if (i === 0 || value(sorted[i]) !== value(sorted[i - 1])) rank = i + 1;
    ranks.set(sorted[i], rank);
  }
  return ranks;
}

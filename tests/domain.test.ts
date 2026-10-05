import { describe, expect, it } from "vitest";
import { allocationFor, classNumber, validateAndCalculateMark, resultForMark, subjectOnlyFailure, competitionRanks } from "@/lib/domain/marks";
import { calculateFAAGrade, calculateSAGrade, calculateTotalGrade, calculateApprovedCCEScores, CCE_WORKFLOW_ENABLED } from "@/lib/domain/cce";
import { REGISTRATION_USER_TYPES, schoolInGeographicScope, validGeographicScope } from "@/lib/domain/geography";
import { safeAuditMetadata } from "@/lib/audit";
import { sqlStatements } from "@/db/sql-statements";

const numeric = (score: number) => ({ score, status: "NUMERIC" });
describe("approved marks and results", () => {
  it.each([6, 7, 11, 12])("class %s has 70/20/10 or 90/10", (n) => {
    expect(allocationFor(n, true)).toMatchObject({ theoryMarks: 70, practicalMarks: 20, internalMarks: 10 });
    expect(allocationFor(n, false)).toMatchObject({ theoryMarks: 90, practicalMarks: 0, internalMarks: 10 });
  });
  it.each([8, 9, 10])("class %s has 75/25 or total-only 100", (n) => {
    expect(allocationFor(n, true)).toMatchObject({ theoryMarks: 75, practicalMarks: 25, internalMarks: 0 });
    const allocation = allocationFor(n, false);
    expect(allocation).toMatchObject({ theoryMarks: 0, practicalMarks: 0, internalMarks: 0, mode: "TOTAL" });
    expect(validateAndCalculateMark({ score: 35 }, allocation).score).toBe(35);
    expect(() => validateAndCalculateMark({ theoryScore: 90, internalScore: 10 }, allocation)).toThrow();
  });
  it("does not invent rules for elementary classes or ambiguous class names", () => {
    expect(() => allocationFor(5, false)).toThrow();
    expect(classNumber("Class 11")).toBe(11); expect(classNumber("XII")).toBe(12);
    expect(classNumber("Class 111")).toBeNull();
  });
  it("validates every component server-side; partial components remain pending", () => {
    const a = allocationFor(7, true);
    expect(validateAndCalculateMark({ theoryScore: 60, practicalScore: 18, internalScore: 8 }, a)).toMatchObject({ score: 86, status: "NUMERIC" });
    expect(validateAndCalculateMark({ theoryScore: 60, practicalScore: null }, a)).toMatchObject({ score: null, status: "PENDING" });
    for (const input of [{ theoryScore: -1 }, { theoryScore: 71 }, { theoryScore: NaN }, { theoryScore: Infinity }, { theoryScore: 50, score: 50 }, { theoryScore: 60, practicalScore: 18, internalScore: 8, score: 90 }]) expect(() => validateAndCalculateMark(input, a)).toThrow();
  });
  it("35 passes; AB and Exemption are neither zero nor numeric failures", () => {
    expect(resultForMark(numeric(35))).toBe("Pass"); expect(resultForMark(numeric(34.99))).toBe("Fail");
    for (const status of ["AB", "EXEMPT"] as const) {
      expect(validateAndCalculateMark({ status }, allocationFor(10, false)).score).toBeNull();
      expect(resultForMark({ status, score: null })).toBe(status === "AB" ? "AB" : "Exemption");
      expect(() => validateAndCalculateMark({ status, score: 0 }, allocationFor(10, false))).toThrow();
    }
    expect(resultForMark(undefined)).toBe("Pending");
  });
  it("competition ranking is 1,1,3; failed students never consume eligible ranks", () => {
    const students = [{ id: "C", total: 480, pass: true }, { id: "failed", total: 590, pass: false }, { id: "A", total: 500, pass: true }, { id: "B", total: 500, pass: true }];
    const ranks = competitionRanks(students, (s) => s.total, (s) => s.pass);
    expect(students.map((s) => ranks.get(s) ?? null)).toEqual([3, null, 1, 1]);
  });
  it("subject-only failure requires a numeric fail and every other required pass", () => {
    const marks = new Map([[1, numeric(65)], [2, numeric(75)], [3, numeric(25)], [4, numeric(60)]]);
    expect(subjectOnlyFailure(3, [1, 2, 3, 4], marks)).toBe(true);
    marks.set(2, numeric(30)); expect(subjectOnlyFailure(3, [1, 2, 3, 4], marks)).toBe(false);
    marks.delete(2); expect(subjectOnlyFailure(3, [1, 2, 3, 4], marks)).toBe(false);
    marks.set(2, { status: "AB", score: null } as unknown as ReturnType<typeof numeric>);
    expect(subjectOnlyFailure(3, [1, 2, 3, 4], marks)).toBe(false);
    marks.set(2, { status: "EXEMPT", score: null } as unknown as ReturnType<typeof numeric>);
    expect(subjectOnlyFailure(3, [1, 2, 3, 4], marks)).toBe(false);
  });
});
describe("independent approved CCE grades; workflows remain disabled", () => {
  it.each([[37,"A1"],[36,"A2"],[33,"A2"],[32,"B1"],[29,"B1"],[28,"B2"],[25,"B2"],[24,"C1"],[21,"C1"],[20,"C2"],[17,"C2"],[16,"D"],[13,"D"],[12,"E1"],[9,"E1"],[8,"E2"],[0,"E2"]] as const)("FA(A) %s => %s", (value,g) => expect(calculateFAAGrade(value)).toBe(g));
  it.each([[55,"A1"],[54,"A2"],[49,"A2"],[48,"B1"],[43,"B1"],[42,"B2"],[37,"B2"],[36,"C1"],[31,"C1"],[30,"C2"],[25,"C2"],[24,"D"],[19,"D"],[18,"E1"],[13,"E1"],[12,"E2"],[0,"E2"]] as const)("SA %s => %s", (value,g) => expect(calculateSAGrade(value)).toBe(g));
  it.each([[100,"A1"],[91,"A1"],[90,"A2"],[81,"A2"],[80,"B1"],[71,"B1"],[70,"B2"],[61,"B2"],[60,"C1"],[51,"C1"],[50,"C2"],[41,"C2"],[40,"D"],[33,"D"],[32,"E1"],[21,"E1"],[20,"E2"],[0,"E2"]] as const)("total %s => %s", (value,g) => expect(calculateTotalGrade(value)).toBe(g));
  it("calculates FA(A)+SA without FA Total or levels", () => {
    expect(calculateApprovedCCEScores(37, 49)).toEqual({ faA: 37, faAGrade: "A1", sa: 49, saGrade: "A2", total: 86, totalGrade: "A2" });
    expect(CCE_WORKFLOW_ENABLED).toBe(false);
    expect(() => calculateFAAGrade(40.1)).toThrow(); expect(() => calculateSAGrade(61)).toThrow(); expect(() => calculateTotalGrade(-1)).toThrow();
  });
});
describe("scope and infrastructure invariants", () => {
  it("preserves the exact public registration order", () => expect(REGISTRATION_USER_TYPES).toEqual(["CEO","DEO","HEADMASTER","BEO","PRINCIPAL"]));
  it("CEO/DEO/BEO scopes cannot widen on missing fields or neighboring blocks", () => {
    const school = { district: "Coimbatore", educationalDistrict: "Pollachi", block: "Kinathukadavu" };
    expect(schoolInGeographicScope({ role: "CEO", district: " coimbatore ", educationalDistrict: null, block: null }, school)).toBe(true);
    expect(schoolInGeographicScope({ role: "DEO", district: "Coimbatore", educationalDistrict: "Coimbatore", block: null }, school)).toBe(false);
    expect(schoolInGeographicScope({ role: "BEO", district: "Coimbatore", educationalDistrict: "Pollachi", block: "Other" }, school)).toBe(false);
    expect(validGeographicScope({ role: "BEO", district: "Coimbatore", educationalDistrict: null, block: null })).toBe(false);
  });
  it("audit metadata recursively removes secrets", () => expect(safeAuditMetadata({ score: 50, passwordHash: "bad", nested: { otp: "123456", status: "NUMERIC", providerToken: "bad" } })).toEqual({ score: 50, nested: { status: "NUMERIC" } }));
  it("migration splitter preserves dollar strings/comments/quoted semicolons", () => {
    expect(sqlStatements("select ';'; -- ;\n do $$ begin perform 1; perform 2; end $$; select 3;")).toHaveLength(3);
  });
});

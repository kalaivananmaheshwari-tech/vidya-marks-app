"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Field,
  PageHeader,
  Select,
  TableSkeleton,
} from "@/components/ui";
import { useApi } from "@/lib/client";

type School = {
  name: string;
  udiseCode: string;
  academicYear: string;
  district: string | null;
  state: string | null;
};

type ClassItem = {
  id: number;
  name: string;
  section: string;
  groupId: number | null;
  groupCode: string | null;
  groupName: string | null;
};

type ExamItem = {
  id: number;
  name: string;
  month: string | null;
  year: string | null;
  term: string;
  academicYear: string;
};

type SubjectItem = {
  id: number;
  code: string;
  name: string;
  hasPractical: boolean;
  theoryMarks: number;
  practicalMarks: number;
  internalMarks: number;
  maxMarks: number;
  passMarks: number;
};

type ConsolidatedStudent = {
  sNo: number;
  regNo: string;
  name: string;
  gender: "B" | "G";
  subjectScores: Record<
    number,
    {
      score: number | null;
      isAbsent: boolean;
      passed: boolean;
      theoryScore: number | null;
      practicalScore: number | null;
      internalScore: number | null;
    }
  >;
  total: number;
  result: "Pass" | "Fail";
  failedSubjectsCount: number;
  rank: number | null;
};

type StatsBreakdown = {
  totalStudents: number;
  absent: number;
  exemption: number;
  appeared: number;
  passed: number;
  failed: number;
  passPercentage: number;
  totalMarks: number;
  highestMark: number;
  lowestMark: number;
  subjectAverage: number;
  centum: number;
  between80And100: number;
  between70And80: number;
  between60And70: number;
  between50And60: number;
  between40And50: number;
  between35And40: number;
  below35: number;
};

type SubjectAnalysis = {
  subject: SubjectItem;
  studentRows: Array<{
    sNo: number;
    regNo: string;
    name: string;
    gender: "B" | "G";
    theoryScore: number | null;
    practicalScore: number | null;
    internalScore: number | null;
    score: number | null;
    isAbsent: boolean;
    passed: boolean;
  }>;
  b: StatsBreakdown;
  g: StatsBreakdown;
  tot: StatsBreakdown;
};

type MatrixReport = {
  subjects: SubjectAnalysis[];
  failureBuckets: Array<{
    failedCount: number;
    label: string;
    b: number;
    g: number;
    tot: number;
  }>;
  subjectFailureList: Array<{
    subjectId: number;
    subjectName: string;
    subjectCode: string;
    b: number;
    g: number;
    tot: number;
  }>;
  classResultAnalysis: {
    appeared: { b: number; g: number; tot: number };
    passedAll: { b: number; g: number; tot: number };
    failed: { b: number; g: number; tot: number };
    passPercentage: { b: number; g: number; tot: number };
  };
};

type CceRow = {
  sNo: number;
  emisId: string;
  studentName: string;
  subjectName: string;
  faA: number | "-";
  faB: number | "-";
  faTotal: number | "-";
  saTotal: number | "-";
  totalMarks: number | "-";
  grade: string;
  level: string;
};

type CceRegisterData = {
  nameOfRegister: string;
  nameOfSchool: string;
  udiseCode: string;
  academicYear: string;
  className: string;
  section: string;
  term: string;
  rows: CceRow[];
};

import Form2ReportView, { type Form2Data } from "@/components/form2-report";

type OfficialReportsResponse = {
  school: School;
  classes: ClassItem[];
  exams: ExamItem[];
  selectedClass: ClassItem | null;
  selectedExam: ExamItem | null;
  subjects: SubjectItem[];
  consolidatedList: ConsolidatedStudent[];
  subjectAnalysisList: SubjectAnalysis[];
  matrixReport: MatrixReport | null;
  cceRegister: CceRegisterData | null;
  form2Report: Form2Data | null;
};

export default function OfficialReportsPage() {
  const [classId, setClassId] = useState<string>("");
  const [examId, setExamId] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"consolidated" | "subject" | "matrix" | "cce" | "form2">("consolidated");
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>("");

  const queryUrl = useMemo(() => {
    const params = new URLSearchParams();
    if (classId) params.set("classId", classId);
    if (examId) params.set("examId", examId);
    return `/api/reports/official?${params.toString()}`;
  }, [classId, examId]);

  const { data, loading, error, refresh } = useApi<OfficialReportsResponse>(queryUrl, [queryUrl]);

  // Set default class & exam
  useEffect(() => {
    if (!classId && data?.classes && data.classes.length > 0) {
      setClassId(String(data.classes[0].id));
    }
  }, [data?.classes, classId]);

  useEffect(() => {
    if (!examId && data?.exams && data.exams.length > 0) {
      setExamId(String(data.exams[0].id));
    }
  }, [data?.exams, examId]);

  // Set default subject for single subject tab
  useEffect(() => {
    if (data?.subjects && data.subjects.length > 0) {
      if (!selectedSubjectId || !data.subjects.some((s) => String(s.id) === selectedSubjectId)) {
        setSelectedSubjectId(String(data.subjects[0].id));
      }
    }
  }, [data?.subjects, selectedSubjectId]);

  const school = data?.school;
  const selectedClass = data?.selectedClass;
  const selectedExam = data?.selectedExam;
  const subjects = data?.subjects ?? [];
  const consolidatedList = data?.consolidatedList ?? [];
  const subjectAnalysisList = data?.subjectAnalysisList ?? [];
  const matrixReport = data?.matrixReport;

  const currentSubjectAnalysis = useMemo(() => {
    if (!selectedSubjectId) return subjectAnalysisList[0] ?? null;
    return subjectAnalysisList.find((sa) => String(sa.subject.id) === selectedSubjectId) ?? subjectAnalysisList[0] ?? null;
  }, [subjectAnalysisList, selectedSubjectId]);

  // Header Title Formatting matching user attachment
  const schoolNameUpper = school?.name?.toUpperCase() || "GOVT.HR.SEC SCHOOL";
  const academicYearText = selectedExam?.academicYear || school?.academicYear || "2026-2027";
  const classDisplay = selectedClass
    ? `${selectedClass.name}${selectedClass.section ? selectedClass.section : ""}${selectedClass.groupCode ? ` - ${selectedClass.groupCode}` : ""}`
    : "Class";
  const examDisplay = selectedExam
    ? `${selectedExam.name.toUpperCase()} ${selectedExam.month ? selectedExam.month.toUpperCase() : ""}${selectedExam.year ? `-${selectedExam.year}` : ""}`
    : "EXAMINATION";

  // Pad rows to look authentic like the printed official sheet (min 22 rows)
  const paddedConsolidatedRows = useMemo(() => {
    const minRows = 20;
    const currentCount = consolidatedList.length;
    const needed = Math.max(0, minRows - currentCount);
    return Array.from({ length: needed });
  }, [consolidatedList.length]);

  return (
    <>
      <div className="no-print">
        <PageHeader
          icon="📑"
          title="Official Government School Reports"
          subtitle="Generate Consolidated Mark Lists and Subject-wise Result Analyses matching standard Directorate of Government Examinations formats."
          actions={
            <div className="flex items-center gap-2">
              <Button
                variant="primary"
                onClick={() => {
                  window.print();
                }}
              >
                🖨️ Print Report
              </Button>
            </div>
          }
        />

        {/* Filter Selection Bar */}
        <Card className="mt-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Select Class & Section">
              <Select value={classId} onChange={(e) => setClassId(e.target.value)}>
                <option value="">Select class...</option>
                {data?.classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} - {c.section} {c.groupCode ? `(Group ${c.groupCode})` : ""}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Select Examination">
              <Select value={examId} onChange={(e) => setExamId(e.target.value)}>
                <option value="">Select exam...</option>
                {data?.exams.map((ex) => (
                  <option key={ex.id} value={ex.id}>
                    {ex.name} {ex.month ? `(${ex.month} ${ex.year ?? ""})` : ""}
                  </option>
                ))}
              </Select>
            </Field>

            <div className="flex flex-col justify-end">
              <div className="flex items-center gap-2">
                <Badge tone="brand">
                  {consolidatedList.length} Students
                </Badge>
                <Badge tone="green">
                  {subjects.length} Subjects
                </Badge>
              </div>
            </div>
          </div>

          {/* Report Tab Switcher */}
          <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setActiveTab("consolidated")}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
                activeTab === "consolidated"
                  ? "bg-brand-600 text-white shadow-md shadow-brand-600/20"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              📑 1. Consolidated Mark List (Class/Section)
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("subject")}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
                activeTab === "subject"
                  ? "bg-brand-600 text-white shadow-md shadow-brand-600/20"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              🔬 2. Subject-wise Mark List &amp; Result Analysis
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("matrix")}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
                activeTab === "matrix"
                  ? "bg-brand-600 text-white shadow-md shadow-brand-600/20"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              📊 3. Consolidated Result Analysis (Matrix + Failure Distribution)
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("cce")}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
                activeTab === "cce"
                  ? "bg-[#00a884] text-white shadow-md shadow-emerald-600/25"
                  : "bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200"
              }`}
            >
              🏛️ 4. Tamil Nadu CCE Register (Continuous &amp; Comprehensive Evaluation)
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("form2")}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
                activeTab === "form2"
                  ? "bg-rose-700 text-white shadow-md shadow-rose-700/25"
                  : "bg-rose-50 text-rose-800 hover:bg-rose-100 border border-rose-200"
              }`}
            >
              📋 5. Form - II (Class Wise Result Analysis &amp; Teachers Performance)
            </button>
          </div>
        </Card>
      </div>

      {error ? <ErrorState message={error} onRetry={refresh} /> : null}

      {!classId || !examId ? (
        <div className="no-print mt-6">
          <EmptyState
            icon="📑"
            title="Choose a Class & Examination"
            description="Select a class and examination above to generate official mark reports."
          />
        </div>
      ) : loading ? (
        <Card className="mt-6">
          <TableSkeleton rows={10} cols={8} />
        </Card>
      ) : (
        <div className="mt-6 print-page">
          {/* =========================================================================
              REPORT 1: CONSOLIDATED MARK LIST (Attachment 1)
              ========================================================================= */}
          {activeTab === "consolidated" && (
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 print:border-none print:shadow-none print:p-0">
              {/* Official Header */}
              <div className="text-center pb-4 border-b border-slate-300">
                <h1 className="text-base sm:text-lg font-bold tracking-wide text-black uppercase">
                  {schoolNameUpper}
                </h1>
                <h2 className="text-sm font-semibold tracking-wide text-black uppercase mt-0.5">
                  CONSOLIDATED MARK LIST - {academicYearText}
                </h2>
                <div className="flex justify-between items-center text-xs font-bold text-black mt-2 px-2">
                  <span>Class : {classDisplay}</span>
                  <span>{examDisplay}</span>
                </div>
              </div>

              {/* Official Table */}
              <div className="overflow-x-auto mt-4">
                <table className="official-table w-full text-xs text-black border-collapse border border-black">
                  <thead>
                    <tr className="bg-slate-100 font-bold text-center border-b border-black">
                      <th className="border border-black px-1.5 py-2 w-10">S.No</th>
                      <th className="border border-black px-2 py-2 w-20">Reg., No</th>
                      <th className="border border-black px-3 py-2 text-left">Name of the Students</th>
                      {subjects.map((sub) => (
                        <th key={sub.id} className="border border-black px-2 py-2 text-center uppercase min-w-[70px]">
                          {sub.name}
                        </th>
                      ))}
                      <th className="border border-black px-2 py-2 w-16">Total</th>
                      <th className="border border-black px-2 py-2 w-16">Result</th>
                      <th className="border border-black px-2 py-2 w-20">
                        No., of Failed Subjects
                      </th>
                      <th className="border border-black px-1.5 py-2 w-12">Rank</th>
                      <th className="border border-black px-1.5 py-2 w-12">GENDER</th>
                    </tr>
                  </thead>
                  <tbody>
                    {consolidatedList.map((stu) => (
                      <tr key={stu.sNo} className="hover:bg-slate-50 border-b border-black">
                        <td className="border border-black px-1.5 py-1.5 text-center font-medium tabular-nums">
                          {stu.sNo}
                        </td>
                        <td className="border border-black px-2 py-1.5 text-center font-mono font-medium">
                          {stu.regNo}
                        </td>
                        <td className="border border-black px-3 py-1.5 font-bold uppercase whitespace-nowrap">
                          {stu.name}
                        </td>
                        {subjects.map((sub) => {
                          const sc = stu.subjectScores[sub.id];
                          const isFail = sc && !sc.passed;
                          return (
                            <td
                              key={sub.id}
                              className={`border border-black px-2 py-1.5 text-center font-semibold tabular-nums ${
                                isFail ? "text-rose-700 font-bold bg-rose-50/40 print:bg-transparent" : ""
                              }`}
                            >
                              {sc ? (sc.isAbsent ? "AB" : (sc.score ?? "—")) : "—"}
                            </td>
                          );
                        })}
                        <td className="border border-black px-2 py-1.5 text-center font-bold tabular-nums">
                          {stu.total}
                        </td>
                        <td
                          className={`border border-black px-2 py-1.5 text-center font-bold ${
                            stu.result === "Pass" ? "text-black" : "text-rose-700"
                          }`}
                        >
                          {stu.result}
                        </td>
                        <td className="border border-black px-2 py-1.5 text-center font-semibold tabular-nums text-rose-700">
                          {stu.failedSubjectsCount > 0 ? stu.failedSubjectsCount : ""}
                        </td>
                        <td className="border border-black px-1.5 py-1.5 text-center font-bold tabular-nums">
                          {stu.rank ? stu.rank : ""}
                        </td>
                        <td className="border border-black px-1.5 py-1.5 text-center font-bold">
                          {stu.gender}
                        </td>
                      </tr>
                    ))}

                    {/* Blank aesthetic rows matching official printed register sheets */}
                    {paddedConsolidatedRows.map((_, i) => (
                      <tr key={`blank-${i}`} className="border-b border-black h-7">
                        <td className="border border-black">&nbsp;</td>
                        <td className="border border-black">&nbsp;</td>
                        <td className="border border-black">&nbsp;</td>
                        {subjects.map((sub) => (
                          <td key={sub.id} className="border border-black">&nbsp;</td>
                        ))}
                        <td className="border border-black">&nbsp;</td>
                        <td className="border border-black">&nbsp;</td>
                        <td className="border border-black">&nbsp;</td>
                        <td className="border border-black">&nbsp;</td>
                        <td className="border border-black">&nbsp;</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Official Signatures Footer */}
              <div className="flex justify-between items-center pt-16 mt-8 px-8 text-xs font-bold text-black uppercase">
                <span>Class teacher sign</span>
                <span>Hm/Principal sign</span>
              </div>
            </div>
          )}

          {/* =========================================================================
              REPORT 2: SUBJECT-WISE MARK LIST & RESULT ANALYSIS (Attachment 2)
              ========================================================================= */}
          {activeTab === "subject" && (
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 print:border-none print:shadow-none print:p-0">
              {/* Subject Selector Bar (No-Print) */}
              <div className="no-print mb-4 flex items-center gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <span className="text-xs font-bold uppercase text-slate-700">Select Subject:</span>
                <div className="flex flex-wrap gap-1.5">
                  {subjects.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setSelectedSubjectId(String(s.id))}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                        String(s.id) === selectedSubjectId
                          ? "bg-slate-900 text-white shadow-sm"
                          : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-100"
                      }`}
                    >
                      {s.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Official Header */}
              <div className="text-center pb-4 border-b border-slate-300">
                <h1 className="text-base sm:text-lg font-bold tracking-wide text-black uppercase">
                  {schoolNameUpper}
                </h1>
                <h2 className="text-sm font-semibold tracking-wide text-black uppercase mt-0.5">
                  MARK LIST - {academicYearText}
                </h2>
                <div className="flex justify-between items-center text-xs font-bold text-black mt-2 px-2">
                  <span>Class : {classDisplay}</span>
                  <span>Subject: {currentSubjectAnalysis?.subject.name.toUpperCase()}</span>
                </div>
                <div className="text-center text-xs font-bold text-black mt-1">
                  {examDisplay}
                </div>
              </div>

              {/* Side-by-side or stacked layout matching Attachment 2 */}
              <div className="grid gap-6 lg:grid-cols-[1.25fr_1fr] mt-4 items-start">
                {/* Left Table: Student Marks for this Subject */}
                <div className="overflow-x-auto">
                  <table className="official-table w-full text-xs text-black border-collapse border border-black">
                    <thead>
                      <tr className="bg-slate-100 font-bold border-b border-black text-center">
                        <th rowSpan={2} className="border border-black px-1.5 py-1 w-10">S.No</th>
                        <th rowSpan={2} className="border border-black px-2 py-1 w-20">Reg., No</th>
                        <th rowSpan={2} className="border border-black px-3 py-1 text-left">Name of the Students</th>
                        <th colSpan={3} className="border border-black px-2 py-1 uppercase">
                          {currentSubjectAnalysis?.subject.name}
                        </th>
                      </tr>
                      <tr className="bg-slate-100 font-bold border-b border-black text-center">
                        <th className="border border-black px-2 py-1 w-12">
                          {currentSubjectAnalysis?.subject.hasPractical ? "70" : "90"}
                        </th>
                        <th className="border border-black px-2 py-1 w-12">
                          {currentSubjectAnalysis?.subject.hasPractical ? "20/10" : "10"}
                        </th>
                        <th className="border border-black px-2 py-1 w-20">
                          With Internal (100)
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {currentSubjectAnalysis?.studentRows.map((r) => (
                        <tr key={r.sNo} className="hover:bg-slate-50 border-b border-black">
                          <td className="border border-black px-1.5 py-1 text-center font-medium tabular-nums">
                            {r.sNo}
                          </td>
                          <td className="border border-black px-2 py-1 text-center font-mono font-medium">
                            {r.regNo}
                          </td>
                          <td className="border border-black px-3 py-1 font-bold uppercase whitespace-nowrap">
                            {r.name}
                          </td>
                          <td className="border border-black px-2 py-1 text-center tabular-nums font-semibold">
                            {r.isAbsent ? "AB" : (r.theoryScore ?? "—")}
                          </td>
                          <td className="border border-black px-2 py-1 text-center tabular-nums font-semibold">
                            {r.isAbsent
                              ? "—"
                              : currentSubjectAnalysis.subject.hasPractical
                              ? `${r.practicalScore ?? 0}/${r.internalScore ?? 0}`
                              : (r.internalScore ?? "—")}
                          </td>
                          <td
                            className={`border border-black px-2 py-1 text-center tabular-nums font-bold ${
                              !r.passed ? "text-rose-700 bg-rose-50/40 print:bg-transparent" : ""
                            }`}
                          >
                            {r.isAbsent ? "AB" : (r.score ?? "—")}
                          </td>
                        </tr>
                      ))}

                      {/* Blank rows */}
                      {paddedConsolidatedRows.map((_, i) => (
                        <tr key={`blank-sub-${i}`} className="border-b border-black h-7">
                          <td className="border border-black">&nbsp;</td>
                          <td className="border border-black">&nbsp;</td>
                          <td className="border border-black">&nbsp;</td>
                          <td className="border border-black">&nbsp;</td>
                          <td className="border border-black">&nbsp;</td>
                          <td className="border border-black">&nbsp;</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Right Table: Official RESULT ANALYSIS (B, G, TOT) */}
                <div className="overflow-x-auto">
                  <div className="border border-black">
                    <div className="bg-slate-200 text-center font-bold text-xs py-1.5 border-b border-black uppercase tracking-wider">
                      RESULT ANALYSIS
                    </div>
                    <table className="official-table w-full text-xs text-black border-collapse">
                      <thead>
                        <tr className="bg-slate-100 font-bold border-b border-black text-center">
                          <th className="border-r border-black px-3 py-1.5 text-left">Particulars</th>
                          <th className="border-r border-black px-2 py-1.5 w-14">B</th>
                          <th className="border-r border-black px-2 py-1.5 w-14">G</th>
                          <th className="px-2 py-1.5 w-16">TOT</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-black font-medium">
                        <tr>
                          <td className="border-r border-black px-3 py-1 font-bold">Total No., of Students</td>
                          <td className="border-r border-black px-2 py-1 text-center tabular-nums font-bold">{currentSubjectAnalysis?.b.totalStudents}</td>
                          <td className="border-r border-black px-2 py-1 text-center tabular-nums font-bold">{currentSubjectAnalysis?.g.totalStudents}</td>
                          <td className="px-2 py-1 text-center tabular-nums font-bold">{currentSubjectAnalysis?.tot.totalStudents}</td>
                        </tr>
                        <tr>
                          <td className="border-r border-black px-3 py-1">No., of Students Absent</td>
                          <td className="border-r border-black px-2 py-1 text-center tabular-nums">{currentSubjectAnalysis?.b.absent}</td>
                          <td className="border-r border-black px-2 py-1 text-center tabular-nums">{currentSubjectAnalysis?.g.absent}</td>
                          <td className="px-2 py-1 text-center tabular-nums">{currentSubjectAnalysis?.tot.absent}</td>
                        </tr>
                        <tr>
                          <td className="border-r border-black px-3 py-1">NO., of Students Exemption</td>
                          <td className="border-r border-black px-2 py-1 text-center tabular-nums">{currentSubjectAnalysis?.b.exemption}</td>
                          <td className="border-r border-black px-2 py-1 text-center tabular-nums">{currentSubjectAnalysis?.g.exemption}</td>
                          <td className="px-2 py-1 text-center tabular-nums">{currentSubjectAnalysis?.tot.exemption}</td>
                        </tr>
                        <tr className="bg-slate-50">
                          <td className="border-r border-black px-3 py-1 font-semibold">No. of Students Appeared</td>
                          <td className="border-r border-black px-2 py-1 text-center tabular-nums font-bold">{currentSubjectAnalysis?.b.appeared}</td>
                          <td className="border-r border-black px-2 py-1 text-center tabular-nums font-bold">{currentSubjectAnalysis?.g.appeared}</td>
                          <td className="px-2 py-1 text-center tabular-nums font-bold">{currentSubjectAnalysis?.tot.appeared}</td>
                        </tr>
                        <tr>
                          <td className="border-r border-black px-3 py-1 font-semibold text-emerald-800">No. of Students Passed</td>
                          <td className="border-r border-black px-2 py-1 text-center tabular-nums font-bold">{currentSubjectAnalysis?.b.passed}</td>
                          <td className="border-r border-black px-2 py-1 text-center tabular-nums font-bold">{currentSubjectAnalysis?.g.passed}</td>
                          <td className="px-2 py-1 text-center tabular-nums font-bold">{currentSubjectAnalysis?.tot.passed}</td>
                        </tr>
                        <tr>
                          <td className="border-r border-black px-3 py-1 font-semibold text-rose-800">No. of Students Failed</td>
                          <td className="border-r border-black px-2 py-1 text-center tabular-nums font-bold">{currentSubjectAnalysis?.b.failed}</td>
                          <td className="border-r border-black px-2 py-1 text-center tabular-nums font-bold">{currentSubjectAnalysis?.g.failed}</td>
                          <td className="px-2 py-1 text-center tabular-nums font-bold">{currentSubjectAnalysis?.tot.failed}</td>
                        </tr>
                        <tr className="bg-slate-100 font-bold border-t border-b border-black">
                          <td className="border-r border-black px-3 py-1">Pass Percentage</td>
                          <td className="border-r border-black px-2 py-1 text-center tabular-nums">{currentSubjectAnalysis?.b.passPercentage}%</td>
                          <td className="border-r border-black px-2 py-1 text-center tabular-nums">{currentSubjectAnalysis?.g.passPercentage}%</td>
                          <td className="px-2 py-1 text-center tabular-nums">{currentSubjectAnalysis?.tot.passPercentage}%</td>
                        </tr>
                        <tr>
                          <td className="border-r border-black px-3 py-1">Total Marks</td>
                          <td className="border-r border-black px-2 py-1 text-center tabular-nums">{currentSubjectAnalysis?.b.totalMarks}</td>
                          <td className="border-r border-black px-2 py-1 text-center tabular-nums">{currentSubjectAnalysis?.g.totalMarks}</td>
                          <td className="px-2 py-1 text-center tabular-nums">{currentSubjectAnalysis?.tot.totalMarks}</td>
                        </tr>
                        <tr>
                          <td className="border-r border-black px-3 py-1 font-semibold">Highest Mark</td>
                          <td className="border-r border-black px-2 py-1 text-center tabular-nums font-bold">{currentSubjectAnalysis?.b.highestMark}</td>
                          <td className="border-r border-black px-2 py-1 text-center tabular-nums font-bold">{currentSubjectAnalysis?.g.highestMark}</td>
                          <td className="px-2 py-1 text-center tabular-nums font-bold">{currentSubjectAnalysis?.tot.highestMark}</td>
                        </tr>
                        <tr>
                          <td className="border-r border-black px-3 py-1 font-semibold">Lowest Mark</td>
                          <td className="border-r border-black px-2 py-1 text-center tabular-nums font-bold">{currentSubjectAnalysis?.b.lowestMark}</td>
                          <td className="border-r border-black px-2 py-1 text-center tabular-nums font-bold">{currentSubjectAnalysis?.g.lowestMark}</td>
                          <td className="px-2 py-1 text-center tabular-nums font-bold">{currentSubjectAnalysis?.tot.lowestMark}</td>
                        </tr>
                        <tr className="bg-slate-50 font-bold border-b border-black">
                          <td className="border-r border-black px-3 py-1">Subject Average</td>
                          <td className="border-r border-black px-2 py-1 text-center tabular-nums">{currentSubjectAnalysis?.b.subjectAverage}</td>
                          <td className="border-r border-black px-2 py-1 text-center tabular-nums">{currentSubjectAnalysis?.g.subjectAverage}</td>
                          <td className="px-2 py-1 text-center tabular-nums">{currentSubjectAnalysis?.tot.subjectAverage}</td>
                        </tr>

                        {/* Brackets */}
                        <tr>
                          <td className="border-r border-black px-3 py-0.5">=100</td>
                          <td className="border-r border-black px-2 py-0.5 text-center tabular-nums">{currentSubjectAnalysis?.b.centum}</td>
                          <td className="border-r border-black px-2 py-0.5 text-center tabular-nums">{currentSubjectAnalysis?.g.centum}</td>
                          <td className="px-2 py-0.5 text-center tabular-nums">{currentSubjectAnalysis?.tot.centum}</td>
                        </tr>
                        <tr>
                          <td className="border-r border-black px-3 py-0.5">&gt;=80 And &lt;100</td>
                          <td className="border-r border-black px-2 py-0.5 text-center tabular-nums">{currentSubjectAnalysis?.b.between80And100}</td>
                          <td className="border-r border-black px-2 py-0.5 text-center tabular-nums">{currentSubjectAnalysis?.g.between80And100}</td>
                          <td className="px-2 py-0.5 text-center tabular-nums">{currentSubjectAnalysis?.tot.between80And100}</td>
                        </tr>
                        <tr>
                          <td className="border-r border-black px-3 py-0.5">&gt;=70 And &lt;80</td>
                          <td className="border-r border-black px-2 py-0.5 text-center tabular-nums">{currentSubjectAnalysis?.b.between70And80}</td>
                          <td className="border-r border-black px-2 py-0.5 text-center tabular-nums">{currentSubjectAnalysis?.g.between70And80}</td>
                          <td className="px-2 py-0.5 text-center tabular-nums">{currentSubjectAnalysis?.tot.between70And80}</td>
                        </tr>
                        <tr>
                          <td className="border-r border-black px-3 py-0.5">&gt;=60 And &lt;70</td>
                          <td className="border-r border-black px-2 py-0.5 text-center tabular-nums">{currentSubjectAnalysis?.b.between60And70}</td>
                          <td className="border-r border-black px-2 py-0.5 text-center tabular-nums">{currentSubjectAnalysis?.g.between60And70}</td>
                          <td className="px-2 py-0.5 text-center tabular-nums">{currentSubjectAnalysis?.tot.between60And70}</td>
                        </tr>
                        <tr>
                          <td className="border-r border-black px-3 py-0.5">&gt;=50 And &lt;60</td>
                          <td className="border-r border-black px-2 py-0.5 text-center tabular-nums">{currentSubjectAnalysis?.b.between50And60}</td>
                          <td className="border-r border-black px-2 py-0.5 text-center tabular-nums">{currentSubjectAnalysis?.g.between50And60}</td>
                          <td className="px-2 py-0.5 text-center tabular-nums">{currentSubjectAnalysis?.tot.between50And60}</td>
                        </tr>
                        <tr>
                          <td className="border-r border-black px-3 py-0.5">&gt;=40 And &lt;50</td>
                          <td className="border-r border-black px-2 py-0.5 text-center tabular-nums">{currentSubjectAnalysis?.b.between40And50}</td>
                          <td className="border-r border-black px-2 py-0.5 text-center tabular-nums">{currentSubjectAnalysis?.g.between40And50}</td>
                          <td className="px-2 py-0.5 text-center tabular-nums">{currentSubjectAnalysis?.tot.between40And50}</td>
                        </tr>
                        <tr>
                          <td className="border-r border-black px-3 py-0.5">&gt;=35 And &lt;40</td>
                          <td className="border-r border-black px-2 py-0.5 text-center tabular-nums">{currentSubjectAnalysis?.b.between35And40}</td>
                          <td className="border-r border-black px-2 py-0.5 text-center tabular-nums">{currentSubjectAnalysis?.g.between35And40}</td>
                          <td className="px-2 py-0.5 text-center tabular-nums">{currentSubjectAnalysis?.tot.between35And40}</td>
                        </tr>
                        <tr className="bg-rose-50/50 print:bg-transparent">
                          <td className="border-r border-black px-3 py-0.5 font-bold text-rose-800">&lt;35</td>
                          <td className="border-r border-black px-2 py-0.5 text-center tabular-nums font-bold">{currentSubjectAnalysis?.b.below35}</td>
                          <td className="border-r border-black px-2 py-0.5 text-center tabular-nums font-bold">{currentSubjectAnalysis?.g.below35}</td>
                          <td className="px-2 py-0.5 text-center tabular-nums font-bold">{currentSubjectAnalysis?.tot.below35}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Official Signatures Footer */}
              <div className="flex justify-between items-center pt-16 mt-8 px-8 text-xs font-bold text-black uppercase">
                <span>HM/Principal sign</span>
                <span>Subject Teacher sign</span>
              </div>
            </div>
          )}

          {/* =========================================================================
              REPORT 3: CONSOLIDATED RESULT ANALYSIS MATRIX (Attachment 3)
              ========================================================================= */}
          {activeTab === "matrix" && matrixReport && (
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 print:border-none print:shadow-none print:p-0">
              {/* Official Header */}
              <div className="text-center pb-4 border-b border-slate-300">
                <h1 className="text-base sm:text-lg font-bold tracking-wide text-black uppercase">
                  {schoolNameUpper}
                </h1>
                <h2 className="text-sm font-semibold tracking-wide text-black uppercase mt-0.5">
                  CONSOLIDATED MARK LIST - {academicYearText}
                </h2>
                <div className="flex justify-between items-center text-xs font-bold text-black mt-2 px-2">
                  <span>Class : {classDisplay}</span>
                  <span>{examDisplay}</span>
                </div>
                <div className="text-center text-xs font-bold text-black mt-1 uppercase tracking-wide">
                  Subject Wise Result Analysis - Consolidated
                </div>
              </div>

              {/* Master Matrix Table with B, G, TOT for all subjects */}
              <div className="overflow-x-auto mt-4">
                <table className="official-table w-full text-xs text-black border-collapse border border-black">
                  <thead>
                    <tr className="bg-slate-100 font-bold border-b border-black text-center">
                      <th rowSpan={2} className="border border-black px-3 py-2 text-left min-w-[170px]">
                        Particulars
                      </th>
                      {matrixReport.subjects.map((sa) => (
                        <th key={sa.subject.id} colSpan={3} className="border border-black px-2 py-1 text-center uppercase min-w-[120px]">
                          {sa.subject.name}
                        </th>
                      ))}
                    </tr>
                    <tr className="bg-slate-100 font-bold border-b border-black text-center">
                      {matrixReport.subjects.map((sa) => (
                        <th key={`${sa.subject.id}-cols`} colSpan={3} className="p-0 border border-black">
                          <div className="grid grid-cols-3 divide-x divide-black text-[11px]">
                            <span className="py-1">B</span>
                            <span className="py-1">G</span>
                            <span className="py-1 bg-slate-200/50">TOT</span>
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black font-medium">
                    {[
                      { key: "totalStudents", label: "Total No., of Students", isBold: true },
                      { key: "absent", label: "No., of Students Absent" },
                      { key: "exemption", label: "No., of Students Exemption" },
                      { key: "appeared", label: "No. of Students Appeared", isBold: true, isHeaderRow: true },
                      { key: "passed", label: "No. of Students Passed", isBold: true },
                      { key: "failed", label: "No. of Students Failed", isBold: true },
                      { key: "passPercentage", label: "Pass Percentage", isBold: true, isPercent: true, isHeaderRow: true },
                      { key: "totalMarks", label: "Total Marks" },
                      { key: "highestMark", label: "Highest Mark", isBold: true },
                      { key: "lowestMark", label: "Lowest Mark", isBold: true },
                      { key: "subjectAverage", label: "Subject Average", isBold: true, isHeaderRow: true },
                      { key: "centum", label: "=100" },
                      { key: "between80And100", label: ">=80 And <100" },
                      { key: "between70And80", label: ">=70 And <80" },
                      { key: "between60And70", label: ">=60 And <70" },
                      { key: "between50And60", label: ">=50 And <60" },
                      { key: "between40And50", label: ">=40 And <50" },
                      { key: "between35And40", label: ">=35 And <40" },
                      { key: "below35", label: "<35", isFail: true },
                    ].map((rowDef) => (
                      <tr
                        key={rowDef.key}
                        className={`border-b border-black ${
                          rowDef.isHeaderRow ? "bg-slate-100/70" : rowDef.isFail ? "bg-rose-50/40 print:bg-transparent" : ""
                        }`}
                      >
                        <td className={`border-r border-black px-3 py-1 whitespace-nowrap ${rowDef.isBold ? "font-bold text-black" : ""}`}>
                          {rowDef.label}
                        </td>
                        {matrixReport.subjects.map((sa) => {
                          const k = rowDef.key as keyof StatsBreakdown;
                          const valB = sa.b[k];
                          const valG = sa.g[k];
                          const valTot = sa.tot[k];
                          return (
                            <td key={`${sa.subject.id}-${rowDef.key}`} colSpan={3} className="p-0 border border-black">
                              <div className="grid grid-cols-3 divide-x divide-black text-center tabular-nums text-xs font-semibold">
                                <span className="py-1">{valB}{rowDef.isPercent ? "%" : ""}</span>
                                <span className="py-1">{valG}{rowDef.isPercent ? "%" : ""}</span>
                                <span className="py-1 bg-slate-50 font-bold">{valTot}{rowDef.isPercent ? "%" : ""}</span>
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Bottom 3 Sub-Tables identical to Attachment 3 */}
              <div className="grid gap-4 md:grid-cols-3 mt-6 items-start">
                {/* Table 1: No. of Students Failed in */}
                <div className="border border-black overflow-x-auto">
                  <div className="bg-slate-200 text-center font-bold text-xs py-1.5 border-b border-black uppercase">
                    No. of Students Failed in
                  </div>
                  <table className="official-table w-full text-xs text-black border-collapse">
                    <thead>
                      <tr className="bg-slate-100 font-bold border-b border-black text-center">
                        <th className="border-r border-black px-2 py-1 text-left">Failed in</th>
                        <th className="border-r border-black px-2 py-1 w-12">B</th>
                        <th className="border-r border-black px-2 py-1 w-12">G</th>
                        <th className="px-2 py-1 w-14">TOT</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-black font-semibold">
                      {matrixReport.failureBuckets.map((fb) => (
                        <tr key={fb.failedCount}>
                          <td className="border-r border-black px-2 py-1">{fb.label}</td>
                          <td className="border-r border-black px-2 py-1 text-center tabular-nums">{fb.b}</td>
                          <td className="border-r border-black px-2 py-1 text-center tabular-nums">{fb.g}</td>
                          <td className="px-2 py-1 text-center tabular-nums font-bold">{fb.tot}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Table 2: No. of Failures in Particular Subject */}
                <div className="border border-black overflow-x-auto">
                  <div className="bg-slate-200 text-center font-bold text-xs py-1.5 border-b border-black uppercase">
                    No. of Failures in Particular Subject
                  </div>
                  <table className="official-table w-full text-xs text-black border-collapse">
                    <thead>
                      <tr className="bg-slate-100 font-bold border-b border-black text-center">
                        <th className="border-r border-black px-2 py-1 text-left">Subject</th>
                        <th className="border-r border-black px-2 py-1 w-12">B</th>
                        <th className="border-r border-black px-2 py-1 w-12">G</th>
                        <th className="px-2 py-1 w-14">TOT</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-black font-semibold">
                      {matrixReport.subjectFailureList.map((sf) => (
                        <tr key={sf.subjectId}>
                          <td className="border-r border-black px-2 py-1 uppercase">{sf.subjectName}</td>
                          <td className="border-r border-black px-2 py-1 text-center tabular-nums">{sf.b}</td>
                          <td className="border-r border-black px-2 py-1 text-center tabular-nums">{sf.g}</td>
                          <td className="px-2 py-1 text-center tabular-nums font-bold">{sf.tot}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Table 3: Result Analysis for this class */}
                <div className="border border-black overflow-x-auto">
                  <div className="bg-slate-200 text-center font-bold text-xs py-1.5 border-b border-black uppercase">
                    Result Analysis for this class
                  </div>
                  <table className="official-table w-full text-xs text-black border-collapse">
                    <thead>
                      <tr className="bg-slate-100 font-bold border-b border-black text-center">
                        <th className="border-r border-black px-2 py-1 text-left">Particulars</th>
                        <th className="border-r border-black px-2 py-1 w-12">B</th>
                        <th className="border-r border-black px-2 py-1 w-12">G</th>
                        <th className="px-2 py-1 w-14">TOT</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-black font-semibold">
                      <tr>
                        <td className="border-r border-black px-2 py-1">No. of Students Appeared</td>
                        <td className="border-r border-black px-2 py-1 text-center tabular-nums font-bold">{matrixReport.classResultAnalysis.appeared.b}</td>
                        <td className="border-r border-black px-2 py-1 text-center tabular-nums font-bold">{matrixReport.classResultAnalysis.appeared.g}</td>
                        <td className="px-2 py-1 text-center tabular-nums font-bold">{matrixReport.classResultAnalysis.appeared.tot}</td>
                      </tr>
                      <tr>
                        <td className="border-r border-black px-2 py-1 text-emerald-800">No. of Students Passed in all Subjects</td>
                        <td className="border-r border-black px-2 py-1 text-center tabular-nums font-bold">{matrixReport.classResultAnalysis.passedAll.b}</td>
                        <td className="border-r border-black px-2 py-1 text-center tabular-nums font-bold">{matrixReport.classResultAnalysis.passedAll.g}</td>
                        <td className="px-2 py-1 text-center tabular-nums font-bold">{matrixReport.classResultAnalysis.passedAll.tot}</td>
                      </tr>
                      <tr>
                        <td className="border-r border-black px-2 py-1 text-rose-800">No. of Students Failed</td>
                        <td className="border-r border-black px-2 py-1 text-center tabular-nums font-bold">{matrixReport.classResultAnalysis.failed.b}</td>
                        <td className="border-r border-black px-2 py-1 text-center tabular-nums font-bold">{matrixReport.classResultAnalysis.failed.g}</td>
                        <td className="px-2 py-1 text-center tabular-nums font-bold">{matrixReport.classResultAnalysis.failed.tot}</td>
                      </tr>
                      <tr className="bg-slate-100 font-bold border-t border-black">
                        <td className="border-r border-black px-2 py-1">Pass Percentage</td>
                        <td className="border-r border-black px-2 py-1 text-center tabular-nums">{matrixReport.classResultAnalysis.passPercentage.b}%</td>
                        <td className="border-r border-black px-2 py-1 text-center tabular-nums">{matrixReport.classResultAnalysis.passPercentage.g}%</td>
                        <td className="px-2 py-1 text-center tabular-nums">{matrixReport.classResultAnalysis.passPercentage.tot}%</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Official Signatures Footer */}
              <div className="flex justify-between items-center pt-16 mt-8 px-8 text-xs font-bold text-black uppercase">
                <span>HM/Principal sign</span>
                <span>Class teacher sign</span>
              </div>
            </div>
          )}

          {/* =========================================================================
              REPORT 4: GOVERNMENT OF TAMIL NADU - CCE REGISTER (Attachment 2)
              ========================================================================= */}
          {activeTab === "cce" && data?.cceRegister && (
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 print:border-none print:shadow-none print:p-0">
              {/* Emblem and Official State Header */}
              <div className="text-center pb-3">
                <div className="flex justify-center mb-1">
                  <div className="w-14 h-14 relative flex items-center justify-center">
                    <svg viewBox="0 0 100 100" className="w-full h-full text-emerald-800" fill="none">
                      <circle cx="50" cy="50" r="46" stroke="#00a884" strokeWidth="3" />
                      <circle cx="50" cy="50" r="41" stroke="#00a884" strokeWidth="1" strokeDasharray="2 2" />
                      {/* Temple Gopuram */}
                      <path d="M50 16 L43 28 L57 28 Z" fill="#00a884" />
                      <rect x="41" y="28" width="18" height="6" fill="#00a884" />
                      <rect x="38" y="34" width="24" height="6" fill="#00a884" />
                      <rect x="35" y="40" width="30" height="7" fill="#00a884" />
                      <rect x="32" y="47" width="36" height="8" fill="#00a884" />
                      <rect x="29" y="55" width="42" height="10" fill="#00a884" />
                      {/* Arch entrance */}
                      <path d="M44 65 Q50 56 56 65 Z" fill="#ffffff" />
                      {/* Base laurels */}
                      <path d="M22 66 Q50 86 78 66" stroke="#d97706" strokeWidth="2.5" fill="none" />
                    </svg>
                  </div>
                </div>
                <h1 className="text-base font-bold tracking-tight text-black uppercase">
                  Government of Tamil Nadu
                </h1>
                <h2 className="text-xs font-semibold tracking-wide text-slate-700 mt-0.5">
                  School Education Department
                </h2>
              </div>

              {/* Information Grid Box (Exact match to Attachment 2) */}
              <div className="mt-3 border border-black text-xs text-black">
                {/* Row 1 */}
                <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-black border-b border-black text-center">
                  <div className="p-2">
                    <span className="font-medium block text-slate-600 text-[11px]">Name of the Register</span>
                    <span className="font-bold text-black text-xs">CCE Registers</span>
                  </div>
                  <div className="p-2">
                    <span className="font-medium block text-slate-600 text-[11px]">Name of the School</span>
                    <span className="font-bold text-black text-xs uppercase">{data.cceRegister.nameOfSchool}</span>
                  </div>
                  <div className="p-2">
                    <span className="font-medium block text-slate-600 text-[11px]">UDISECode</span>
                    <span className="font-bold text-black text-xs font-mono">{data.cceRegister.udiseCode}</span>
                  </div>
                </div>
                {/* Row 2 */}
                <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-black text-center">
                  <div className="p-2">
                    <span className="font-medium block text-slate-600 text-[11px]">AcademicYear</span>
                    <span className="font-bold text-black text-xs">{data.cceRegister.academicYear}</span>
                  </div>
                  <div className="p-2">
                    <span className="font-medium block text-slate-600 text-[11px]">Class</span>
                    <span className="font-bold text-black text-xs">{data.cceRegister.className}</span>
                  </div>
                  <div className="p-2">
                    <span className="font-medium block text-slate-600 text-[11px]">Section</span>
                    <span className="font-bold text-black text-xs">{data.cceRegister.section}</span>
                  </div>
                  <div className="p-2">
                    <span className="font-medium block text-slate-600 text-[11px]">Term</span>
                    <span className="font-bold text-black text-xs">{data.cceRegister.term}</span>
                  </div>
                </div>
              </div>

              {/* CCE Register Table with Teal Header */}
              <div className="overflow-x-auto mt-4">
                <table className="official-table w-full text-xs text-black border-collapse border border-black">
                  <thead>
                    <tr className="bg-[#00a884] text-white font-bold text-center border-b border-black">
                      <th className="border border-black px-2 py-2.5 w-12 text-center text-white font-bold">
                        S.no
                      </th>
                      <th className="border border-black px-3 py-2.5 w-28 text-left text-white font-bold">
                        Emis Id
                      </th>
                      <th className="border border-black px-4 py-2.5 text-left text-white font-bold min-w-[140px]">
                        Name of the Student
                      </th>
                      <th className="border border-black px-3 py-2.5 text-left text-white font-bold min-w-[120px]">
                        Subject
                      </th>
                      <th className="border border-black px-2 py-2.5 text-center text-white font-bold whitespace-nowrap">
                        FA(A) (Total 20)
                      </th>
                      <th className="border border-black px-2 py-2.5 text-center text-white font-bold whitespace-nowrap">
                        FA(B) (Total 20)
                      </th>
                      <th className="border border-black px-2 py-2.5 text-center text-white font-bold whitespace-nowrap">
                        FA TOTAL (OUT OF 40)
                      </th>
                      <th className="border border-black px-2 py-2.5 text-center text-white font-bold whitespace-nowrap">
                        SA TOTAL (OUT OF 60)
                      </th>
                      <th className="border border-black px-2 py-2.5 text-center text-white font-bold whitespace-nowrap">
                        TOTAL MARKS (OUT OF 100)
                      </th>
                      <th className="border border-black px-2 py-2.5 text-center text-white font-bold w-14">
                        Grade
                      </th>
                      <th className="border border-black px-2 py-2.5 text-center text-white font-bold w-14">
                        Level
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.cceRegister.rows.map((r, i) => (
                      <tr
                        key={r.sNo}
                        className={`border-b border-black hover:bg-slate-50 ${
                          i % 5 === 0 ? "border-t-2 border-t-black" : ""
                        }`}
                      >
                        <td className="border border-black px-2 py-1.5 text-center font-medium tabular-nums">
                          {r.sNo}
                        </td>
                        <td className="border border-black px-3 py-1.5 text-left font-mono font-medium">
                          {r.emisId}
                        </td>
                        <td className="border border-black px-4 py-1.5 text-left font-bold uppercase whitespace-nowrap">
                          {r.studentName}
                        </td>
                        <td className="border border-black px-3 py-1.5 text-left font-semibold uppercase">
                          {r.subjectName}
                        </td>
                        <td className="border border-black px-2 py-1.5 text-center tabular-nums font-semibold">
                          {r.faA}
                        </td>
                        <td className="border border-black px-2 py-1.5 text-center tabular-nums font-semibold">
                          {r.faB}
                        </td>
                        <td className="border border-black px-2 py-1.5 text-center tabular-nums font-bold">
                          {r.faTotal}
                        </td>
                        <td className="border border-black px-2 py-1.5 text-center tabular-nums font-medium">
                          {r.saTotal}
                        </td>
                        <td className="border border-black px-2 py-1.5 text-center tabular-nums font-bold">
                          {r.totalMarks}
                        </td>
                        <td className="border border-black px-2 py-1.5 text-center font-bold">
                          {r.grade}
                        </td>
                        <td className="border border-black px-2 py-1.5 text-center font-bold">
                          {r.level}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Official Signatures Footer */}
              <div className="flex justify-between items-center pt-16 mt-8 px-8 text-xs font-bold text-black uppercase">
                <span>Class teacher sign</span>
                <span>HM/Principal sign</span>
              </div>
            </div>
          )}

          {/* =========================================================================
              REPORT 5: FORM - II RESULT ANALYSIS REPORT (Class Wise / Teachers Performance)
              ========================================================================= */}
          {activeTab === "form2" && data?.form2Report && (
            <Form2ReportView data={data.form2Report} />
          )}
        </div>
      )}
    </>
  );
}

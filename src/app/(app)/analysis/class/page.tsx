"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { BarList, ColumnChart, ProgressBar } from "@/components/charts";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Field,
  GradePill,
  PageHeader,
  Select,
  Skeleton,
  StatCard,
  TableSkeleton,
} from "@/components/ui";
import { GRADE_SCALE } from "@/lib/grades";
import { useApi } from "@/lib/client";
import type { ClassAnalysisRow, ExamRow } from "@/lib/shared-types";
import Form2ReportView, { type Form2Data } from "@/components/form2-report";

type Response = {
  classes: ClassAnalysisRow[];
  overall: { attempts: number; average: number; passRate: number; distinction: number };
};

type OfficialReportsResponse = {
  form2Report: Form2Data | null;
};

export default function ClassAnalysisPage() {
  const exams = useApi<{ exams: ExamRow[] }>("/api/exams");
  const [examId, setExamId] = useState("");
  const [viewMode, setViewMode] = useState<"dashboard" | "form2">("dashboard");
  const [form2ClassId, setForm2ClassId] = useState("");

  const url = useMemo(
    () => `/api/analysis/class${examId ? `?examId=${examId}` : ""}`,
    [examId],
  );
  const { data, loading, error, refresh } = useApi<Response>(url, [url]);
  const rows = data?.classes ?? [];

  // Set default exam
  useEffect(() => {
    if (!examId && exams.data?.exams && exams.data.exams.length > 0) {
      setExamId(String(exams.data.exams[0].id));
    }
  }, [exams.data?.exams, examId]);

  // Set default class for Form-II
  useEffect(() => {
    if (!form2ClassId && rows.length > 0) {
      setForm2ClassId(String(rows[0].classId));
    }
  }, [rows, form2ClassId]);

  // Form-II API query
  const form2Url = useMemo(() => {
    if (!form2ClassId || !examId) return null;
    return `/api/reports/official?classId=${form2ClassId}&examId=${examId}`;
  }, [form2ClassId, examId]);

  const form2Api = useApi<OfficialReportsResponse>(form2Url, [form2Url]);

  const best = rows[0];
  const weakest = rows[rows.length - 1];

  return (
    <>
      <div className="no-print">
        <PageHeader
          icon="🏆"
          title="Class-wise analysis"
          subtitle="Analyze class performance, compare results, or generate the official Form - II Result Analysis Report."
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <Select value={examId} onChange={(e) => setExamId(e.target.value)} className="w-56">
                <option value="">All examinations</option>
                {exams.data?.exams.map((exam) => (
                  <option key={exam.id} value={exam.id}>
                    {exam.name}
                  </option>
                ))}
              </Select>
              {viewMode === "form2" ? (
                <Button variant="primary" onClick={() => window.print()}>
                  🖨️ Print Form - II
                </Button>
              ) : null}
              <Button variant="secondary" onClick={refresh}>
                Refresh
              </Button>
            </div>
          }
        />

        {/* View Switcher Bar */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200 shadow-sm">
          <div className="inline-flex rounded-xl border border-slate-200 bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => setViewMode("dashboard")}
              className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition cursor-pointer ${
                viewMode === "dashboard"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <span>📊</span> Visual Dashboard Comparison
            </button>
            <button
              type="button"
              onClick={() => setViewMode("form2")}
              className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition cursor-pointer ${
                viewMode === "form2"
                  ? "bg-rose-700 text-white shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <span>📋</span> Official Form - II Report (Attachment Format)
            </button>
          </div>

          <div className="flex items-center gap-2">
            <Link href="/reports">
              <Button variant="secondary" size="sm">
                📑 All Official Reports
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {error ? <ErrorState message={error} onRetry={refresh} /> : null}

      {/* =====================================================================
          VIEW 1: OFFICIAL FORM - II RESULT ANALYSIS REPORT VIEW
          ===================================================================== */}
      {viewMode === "form2" ? (
        <div className="mt-4">
          <div className="no-print mb-4 bg-slate-50 p-3 rounded-2xl border border-slate-200 flex flex-wrap items-center gap-3">
            <span className="text-xs font-bold uppercase text-slate-700">Select Class for Form - II:</span>
            <div className="flex flex-wrap gap-1.5">
              {rows.map((cls) => (
                <button
                  key={cls.classId}
                  type="button"
                  onClick={() => setForm2ClassId(String(cls.classId))}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                    String(cls.classId) === form2ClassId
                      ? "bg-rose-700 text-white shadow-sm"
                      : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  {cls.label} {cls.groupCode ? `(${cls.groupCode})` : ""}
                </button>
              ))}
            </div>
          </div>

          {form2Api.loading ? (
            <Card>
              <TableSkeleton rows={10} cols={8} />
            </Card>
          ) : form2Api.error ? (
            <ErrorState message={form2Api.error} onRetry={form2Api.refresh} />
          ) : form2Api.data?.form2Report ? (
            <div className="print-page">
              <Form2ReportView data={form2Api.data.form2Report} />
            </div>
          ) : (
            <EmptyState
              icon="📋"
              title="Select Class and Exam"
              description="Choose a class above to generate the Form - II report."
            />
          )}
        </div>
      ) : (
        /* =====================================================================
            VIEW 2: VISUAL DASHBOARD VIEW
            ===================================================================== */
        <div className="space-y-6 mt-4">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Classes compared" value={rows.length} icon="🏫" accent="brand" loading={loading} />
            <StatCard label="School average" value={`${data?.overall.average ?? 0}%`} icon="📈" accent="sky" loading={loading} />
            <StatCard
              label="Best class"
              value={best ? `${best.average}%` : "—"}
              sub={best?.label}
              icon="🥇"
              accent="green"
              loading={loading}
            />
            <StatCard
              label="Needs support"
              value={weakest && rows.length > 1 ? `${weakest.average}%` : "—"}
              sub={rows.length > 1 ? weakest?.label : undefined}
              icon="🆘"
              accent="rose"
              loading={loading}
            />
          </div>

          <Card>
            <h2 className="mb-4 text-sm font-semibold text-slate-800">Average score per class</h2>
            {loading ? (
              <Skeleton className="h-52 w-full" />
            ) : rows.length ? (
              <ColumnChart items={rows.map((c) => ({ label: c.label, value: c.average }))} height={220} />
            ) : (
              <EmptyState icon="📊" title="Nothing to compare yet" description="Record marks to unlock class comparison." />
            )}
          </Card>

          {loading ? (
            <div className="grid gap-4 lg:grid-cols-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-72 w-full" />
              ))}
            </div>
          ) : rows.length ? (
            <div className="grid gap-4 lg:grid-cols-2">
              {rows.map((cls, index) => (
                <Card key={cls.classId} className="space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-semibold text-slate-900">{cls.label}</h3>
                        {cls.groupCode ? <Badge tone="sky">{cls.groupCode}</Badge> : null}
                        {index === 0 ? <Badge tone="green">Top class</Badge> : null}
                      </div>
                      <p className="text-xs text-slate-500">{cls.students} students evaluated</p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-slate-900">{cls.average}%</p>
                      <p className="text-[11px] uppercase tracking-wide text-slate-400">class average</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setForm2ClassId(String(cls.classId));
                        setViewMode("form2");
                      }}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-800 hover:bg-rose-100 transition cursor-pointer"
                    >
                      <span>📋</span> View Form - II Report
                    </button>
                    <Link
                      href={`/reports?classId=${cls.classId}`}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                    >
                      <span>📑</span> Official Mark List
                    </Link>
                  </div>

                  <div className="grid grid-cols-4 gap-2 text-center">
                    {[
                      { label: "Pass %", value: `${cls.passRate}%`, tone: "text-emerald-600" },
                      { label: "Highest", value: `${cls.highest}%`, tone: "text-slate-900" },
                      { label: "Distinctions", value: cls.distinction, tone: "text-brand-600" },
                      { label: "With arrears", value: cls.failCount, tone: "text-rose-600" },
                    ].map((stat) => (
                      <div key={stat.label} className="rounded-xl bg-slate-50 p-2.5">
                        <p className={`text-base font-bold ${stat.tone}`}>{stat.value}</p>
                        <p className="text-[10px] uppercase tracking-wide text-slate-500">{stat.label}</p>
                      </div>
                    ))}
                  </div>

                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Grade distribution
                    </p>
                    <div className="flex h-3 overflow-hidden rounded-full bg-slate-100">
                      {GRADE_SCALE.map((g) => {
                        const count = cls.grades[g.grade] ?? 0;
                        const total = Object.values(cls.grades).reduce((sum, v) => sum + v, 0) || 1;
                        if (!count) return null;
                        return (
                          <div
                            key={g.grade}
                            style={{ width: `${(count / total) * 100}%`, backgroundColor: g.color }}
                            title={`${g.grade}: ${count}`}
                          />
                        );
                      })}
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-3">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-700">Strongest subject</p>
                      <p className="mt-1 text-sm font-semibold text-slate-800">{cls.strongest?.name ?? "—"}</p>
                      <ProgressBar value={cls.strongest?.average ?? 0} color="#059669" className="mt-2" />
                    </div>
                    <div className="rounded-xl border border-rose-100 bg-rose-50/60 p-3">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-rose-700">Weakest subject</p>
                      <p className="mt-1 text-sm font-semibold text-slate-800">{cls.weakest?.name ?? "—"}</p>
                      <ProgressBar value={cls.weakest?.average ?? 0} color="#e11d48" className="mt-2" />
                    </div>
                  </div>

                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Subject averages</p>
                    <BarList items={cls.subjectStats.map((s) => ({ label: s.name, value: s.average }))} />
                  </div>

                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Class toppers</p>
                    <div className="space-y-1.5">
                      {cls.toppers.map((student) => (
                        <div
                          key={student.studentId}
                          className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2"
                        >
                          <div className="flex items-center gap-2">
                            <span className="grid h-6 w-6 place-items-center rounded-full bg-white text-[11px] font-bold text-slate-500 shadow-sm">
                              {student.rank}
                            </span>
                            <Link
                              href={`/students/${student.studentId}`}
                              className="text-sm font-medium text-slate-800 hover:text-brand-600"
                            >
                              {student.studentName}
                            </Link>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold tabular-nums text-slate-700">
                              {student.percentage}%
                            </span>
                            <GradePill grade={student.grade} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          ) : null}
        </div>
      )}
    </>
  );
}

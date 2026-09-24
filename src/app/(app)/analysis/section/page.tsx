"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ColumnChart, ProgressBar } from "@/components/charts";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  GradePill,
  PageHeader,
  Select,
  Skeleton,
  StatCard,
} from "@/components/ui";
import { GRADE_SCALE } from "@/lib/grades";
import { useApi } from "@/lib/client";
import type { ClassListRow, ExamRow, SectionAnalysisGrade } from "@/lib/shared-types";

type Response = {
  grades: SectionAnalysisGrade[];
  overall: { attempts: number; average: number; passRate: number };
};

export default function SectionAnalysisPage() {
  const exams = useApi<{ exams: ExamRow[] }>("/api/exams");
  const classes = useApi<{ classes: ClassListRow[] }>("/api/classes");
  const [examId, setExamId] = useState("");
  const [grade, setGrade] = useState("");

  const gradeOptions = useMemo(() => {
    const set = new Set((classes.data?.classes ?? []).map((c) => c.name));
    return [...set].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }, [classes.data]);

  const url = useMemo(() => {
    const params = new URLSearchParams();
    if (examId) params.set("examId", examId);
    if (grade) params.set("grade", grade);
    const qs = params.toString();
    return `/api/analysis/section${qs ? `?${qs}` : ""}`;
  }, [examId, grade]);

  const { data, loading, error, refresh } = useApi<Response>(url, [url]);
  const grades = data?.grades ?? [];
  const widestSpread = grades.reduce<SectionAnalysisGrade | null>(
    (acc, g) => (!acc || g.spread > acc.spread ? g : acc),
    null,
  );

  return (
    <>
      <PageHeader
        icon="🧮"
        title="Class & section analysis"
        subtitle="Section-level comparison within each grade to spot imbalance"
        actions={
          <>
            <Select value={examId} onChange={(e) => setExamId(e.target.value)} className="w-52">
              <option value="">All examinations</option>
              {exams.data?.exams.map((exam) => (
                <option key={exam.id} value={exam.id}>
                  {exam.name}
                </option>
              ))}
            </Select>
            <Select value={grade} onChange={(e) => setGrade(e.target.value)} className="w-44">
              <option value="">All grades</option>
              {gradeOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </Select>
            <Button variant="secondary" onClick={refresh}>
              Refresh
            </Button>
          </>
        }
      />

      {error ? <ErrorState message={error} onRetry={refresh} /> : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Grades in scope" value={grades.length} icon="🏫" accent="brand" loading={loading} />
        <StatCard label="Average score" value={`${data?.overall.average ?? 0}%`} icon="📈" accent="sky" loading={loading} />
        <StatCard label="Pass rate" value={`${data?.overall.passRate ?? 0}%`} icon="✅" accent="green" loading={loading} />
        <StatCard
          label="Widest section gap"
          value={widestSpread ? `${widestSpread.spread} pts` : "—"}
          sub={widestSpread?.grade}
          icon="⚖️"
          accent="amber"
          loading={loading}
        />
      </div>

      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-72 w-full" />
          ))}
        </div>
      ) : grades.length === 0 ? (
        <EmptyState
          icon="🧮"
          title="No section data available"
          description="Enter marks for at least one class to compare sections."
        />
      ) : (
        grades.map((gradeRow) => (
          <Card key={gradeRow.grade} className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-slate-900">{gradeRow.grade}</h2>
                <p className="text-xs text-slate-500">
                  {gradeRow.sections.length} sections · {gradeRow.students} students · grade average{" "}
                  {gradeRow.average}%
                </p>
              </div>
              <Badge tone={gradeRow.spread > 8 ? "rose" : gradeRow.spread > 4 ? "amber" : "green"}>
                Section spread {gradeRow.spread} pts
              </Badge>
            </div>

            <ColumnChart
              items={gradeRow.sections.map((section) => ({
                label: `Section ${section.section}`,
                value: section.average,
                color:
                  section.average >= 75
                    ? "linear-gradient(180deg,#34d399,#059669)"
                    : section.average >= 55
                      ? "linear-gradient(180deg,#818cf8,#4f46e5)"
                      : "linear-gradient(180deg,#fbbf24,#d97706)",
              }))}
              height={170}
            />

            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="rounded-l-lg px-4 py-2 font-semibold">Section</th>
                    <th className="px-3 py-2 font-semibold">Group</th>
                    <th className="px-3 py-2 text-right font-semibold">Students</th>
                    <th className="px-3 py-2 text-right font-semibold">Average</th>
                    <th className="px-3 py-2 text-right font-semibold">Pass %</th>
                    <th className="px-3 py-2 text-right font-semibold">Distinctions</th>
                    <th className="px-3 py-2 text-right font-semibold">Arrears</th>
                    <th className="rounded-r-lg px-4 py-2 font-semibold">Section topper</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {gradeRow.sections.map((section) => (
                    <tr key={section.classId} className="transition hover:bg-slate-50/70">
                      <td className="px-4 py-3 font-semibold text-slate-800">Section {section.section}</td>
                      <td className="px-3 py-3">
                        {section.groupCode ? <Badge tone="sky">{section.groupCode}</Badge> : "—"}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums text-slate-600">{section.students}</td>
                      <td className="px-3 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <span className="font-semibold tabular-nums text-slate-900">{section.average}%</span>
                          <div className="w-16">
                            <ProgressBar value={section.average} />
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums text-emerald-600">{section.passRate}%</td>
                      <td className="px-3 py-3 text-right tabular-nums text-brand-600">{section.distinction}</td>
                      <td className="px-3 py-3 text-right">
                        <Badge tone={section.failCount ? "rose" : "green"}>{section.failCount}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        {section.topper ? (
                          <div className="flex items-center gap-2">
                            <Link
                              href={`/students/${section.topper.studentId}`}
                              className="font-medium text-slate-800 hover:text-brand-600"
                            >
                              {section.topper.studentName}
                            </Link>
                            <GradePill grade={section.topper.grade} />
                          </div>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {gradeRow.sections.map((section) => {
                const total = Object.values(section.grades).reduce((sum, v) => sum + v, 0) || 1;
                return (
                  <div key={`${section.classId}-grades`} className="rounded-xl border border-slate-100 p-3">
                    <p className="mb-2 text-xs font-semibold text-slate-600">
                      Section {section.section} grade mix
                    </p>
                    <div className="flex h-3 overflow-hidden rounded-full bg-slate-100">
                      {GRADE_SCALE.map((g) => {
                        const count = section.grades[g.grade] ?? 0;
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
                    <div className="mt-2 flex flex-wrap gap-2 text-[10px] text-slate-500">
                      {GRADE_SCALE.filter((g) => (section.grades[g.grade] ?? 0) > 0).map((g) => (
                        <span key={g.grade} className="flex items-center gap-1">
                          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: g.color }} />
                          {g.grade} · {section.grades[g.grade]}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        ))
      )}
    </>
  );
}

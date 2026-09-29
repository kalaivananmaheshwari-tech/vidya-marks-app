"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { BarList, DonutChart, LineChart } from "@/components/charts";
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
  TableSkeleton,
} from "@/components/ui";
import { useApi } from "@/lib/client";
import type { ExamRow, OverviewResponse } from "@/lib/shared-types";

export default function DashboardPage() {
  const [examId, setExamId] = useState<string>("");
  const exams = useApi<{ exams: ExamRow[] }>("/api/exams");
  const overview = useApi<OverviewResponse>(
    `/api/analysis/overview${examId ? `?examId=${examId}` : ""}`,
    [examId],
  );

  const data = overview.data;
  const loading = overview.loading;

  const trendSeries = useMemo(() => {
    if (!data?.examTrend?.length) return [];
    return [
      {
        name: "Average %",
        color: "#4f46e5",
        points: data.examTrend.map((e) => ({ label: e.name, value: e.average })),
      },
      {
        name: "Pass %",
        color: "#10b981",
        points: data.examTrend.map((e) => ({ label: e.name, value: e.passRate })),
      },
    ];
  }, [data]);

  return (
    <>
      <PageHeader
        icon="📊"
        title="Performance dashboard"
        subtitle="School-wide academic health at a glance"
        actions={
          <>
            <Select
              value={examId}
              onChange={(e) => setExamId(e.target.value)}
              className="w-56"
              aria-label="Filter by exam"
            >
              <option value="">All examinations</option>
              {exams.data?.exams.map((exam) => (
                <option key={exam.id} value={exam.id}>
                  {exam.name}
                </option>
              ))}
            </Select>
            <Link
              href="/reports"
              className="rounded-xl border border-brand-200 bg-brand-50 px-4 py-2 text-sm font-semibold text-brand-800 transition hover:bg-brand-100"
            >
              📑 Official Reports
            </Link>
            <Link
              href="/help"
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              🧭 How to use
            </Link>
            <Button variant="secondary" onClick={() => overview.refresh()} loading={overview.refreshing}>
              Refresh
            </Button>
          </>
        }
      />

      {overview.error ? (
        <ErrorState message={overview.error} onRetry={() => overview.refresh()} />
      ) : null}

      {!loading && data ? (
        <Card className="border-brand-200 bg-gradient-to-br from-brand-50/60 via-white to-violet-50/60 shadow-sm">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <span>⚡</span> Academic Setup &amp; Workflow
              </h2>
              <p className="text-xs text-slate-600">
                Follow steps 1 to 8 in order for smooth school mark recording and accurate analytics.
              </p>
            </div>
            <Link href="/help">
              <Button variant="secondary" size="sm">
                🧭 How to use
              </Button>
            </Link>
          </div>
          <ol className="mt-4 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                n: 1,
                label: "Examinations",
                href: "/exams",
                done: data.kpis.exams > 0,
                icon: "🗓️",
              },
              {
                n: 2,
                label: "Teachers",
                href: "/staff",
                done: data.kpis.staff > 0,
                icon: "👩‍🏫",
              },
              {
                n: 3,
                label: "Classes & Sections",
                href: "/classes",
                done: data.kpis.classes > 0,
                icon: "🏫",
              },
              {
                n: 4,
                label: "Subjects",
                href: "/subjects",
                done: data.kpis.subjects > 0,
                icon: "📚",
              },
              {
                n: 5,
                label: "Marks Assign",
                href: "/mark-assign",
                done: data.kpis.subjects > 0,
                icon: "⚖️",
              },
              {
                n: 6,
                label: "Student Entry and Marks",
                href: "/students/entry",
                done: data.kpis.students > 0,
                icon: "📝",
              },
              {
                n: 7,
                label: "Students Register",
                href: "/students",
                done: data.kpis.students > 0,
                icon: "🎓",
              },
              {
                n: 8,
                label: "Class wise and subject wise mark Entry",
                href: "/marks",
                done: data.kpis.marksEntered > 0,
                icon: "✍️",
              },
            ].map((step) => (
              <li key={step.n}>
                <Link
                  href={step.href}
                  className="flex items-center gap-2.5 rounded-xl border border-slate-200/90 bg-white p-2.5 shadow-sm transition hover:border-brand-400 hover:shadow-md"
                >
                  <span
                    className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg text-xs font-bold ${
                      step.done
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    {step.done ? "✓" : step.n}
                  </span>
                  <span className="flex-1 truncate text-xs font-semibold text-slate-800">
                    {step.icon} {step.label}
                  </span>
                  <span className="text-xs text-brand-500 font-bold">→</span>
                </Link>
              </li>
            ))}
          </ol>
        </Card>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Students on roll"
          value={data?.kpis.students ?? 0}
          sub={`${data?.kpis.classes ?? 0} classes · ${data?.kpis.subjects ?? 0} subjects`}
          icon="🎓"
          accent="brand"
          loading={loading}
        />
        <StatCard
          label="Average score"
          value={`${data?.kpis.average ?? 0}%`}
          sub={`${data?.kpis.marksEntered ?? 0} marks analysed`}
          icon="📈"
          accent="sky"
          loading={loading}
        />
        <StatCard
          label="Pass rate"
          value={`${data?.kpis.passRate ?? 0}%`}
          sub="Pass mark 35%"
          icon="✅"
          accent="green"
          loading={loading}
        />
        <StatCard
          label="Distinctions"
          value={`${data?.kpis.distinctionRate ?? 0}%`}
          sub={`${data?.kpis.absent ?? 0} absentee entries`}
          icon="🏅"
          accent="amber"
          loading={loading}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-800">Performance trend across exams</h2>
              <p className="text-xs text-slate-500">Average score vs pass percentage</p>
            </div>
            <Badge tone="brand">All classes</Badge>
          </div>
          {loading ? (
            <Skeleton className="h-56 w-full" />
          ) : trendSeries.length ? (
            <LineChart series={trendSeries} />
          ) : (
            <EmptyState
              icon="📉"
              title="No exam results yet"
              description="Enter marks for an examination to see performance trends."
              action={
                <Link href="/marks">
                  <Button size="sm">Go to mark entry</Button>
                </Link>
              }
            />
          )}
        </Card>

        <Card>
          <h2 className="mb-4 text-sm font-semibold text-slate-800">Grade distribution</h2>
          {loading ? (
            <Skeleton className="h-48 w-full" />
          ) : (data?.kpis.marksEntered ?? 0) > 0 ? (
            <DonutChart
              segments={(data?.gradeDistribution ?? [])
                .filter((g) => g.count > 0)
                .map((g) => ({ label: `${g.grade} · ${g.label}`, value: g.count, color: g.color }))}
              centerLabel="entries"
              centerValue={String(data?.kpis.marksEntered ?? 0)}
              size={170}
            />
          ) : (
            <EmptyState icon="🍩" title="Nothing graded yet" description="Grades appear once marks are entered." />
          )}
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-800">Class comparison</h2>
            <Link href="/analysis/class" className="text-xs font-medium text-brand-600 hover:underline">
              Full class analysis →
            </Link>
          </div>
          {loading ? (
            <TableSkeleton rows={5} cols={2} />
          ) : (
            <BarList
              items={(data?.classComparison ?? []).map((c) => ({
                label: c.label,
                value: c.average,
                sub: `${c.students} students · ${c.passRate}% pass`,
              }))}
            />
          )}
        </Card>

        <Card>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-800">Subject strength</h2>
            <Link href="/analysis/subject" className="text-xs font-medium text-brand-600 hover:underline">
              Subject-wise analysis →
            </Link>
          </div>
          {loading ? (
            <TableSkeleton rows={5} cols={2} />
          ) : (
            <BarList
              items={(data?.subjectSnapshot ?? []).slice(0, 8).map((s) => ({
                label: `${s.name} (${s.code})`,
                value: s.average,
                sub: `${s.passRate}% pass`,
                color:
                  s.average >= 75 ? "#10b981" : s.average >= 55 ? "#4f46e5" : s.average >= 40 ? "#f59e0b" : "#e11d48",
              }))}
            />
          )}
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card padded={false}>
          <div className="flex items-center justify-between px-5 py-4">
            <h2 className="text-sm font-semibold text-slate-800">🏆 Top performers</h2>
            <Badge tone="green">Rank list</Badge>
          </div>
          {loading ? (
            <div className="px-5 pb-5">
              <TableSkeleton rows={5} cols={3} />
            </div>
          ) : data?.topStudents.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-2 font-semibold">#</th>
                    <th className="px-3 py-2 font-semibold">Student</th>
                    <th className="px-3 py-2 font-semibold">Class</th>
                    <th className="px-3 py-2 text-right font-semibold">Score</th>
                    <th className="px-5 py-2 text-right font-semibold">Grade</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.topStudents.map((student) => (
                    <tr key={student.studentId} className="transition hover:bg-slate-50/70">
                      <td className="px-5 py-2.5 font-semibold text-slate-400">{student.rank}</td>
                      <td className="px-3 py-2.5">
                        <Link
                          href={`/students/${student.studentId}`}
                          className="font-medium text-slate-800 hover:text-brand-600"
                        >
                          {student.studentName}
                        </Link>
                      </td>
                      <td className="px-3 py-2.5 text-slate-500">{student.classLabel}</td>
                      <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-slate-800">
                        {student.percentage}%
                      </td>
                      <td className="px-5 py-2.5 text-right">
                        <GradePill grade={student.grade} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="px-5 pb-5">
              <EmptyState icon="🏆" title="No ranked students yet" description="Marks are needed to build the rank list." />
            </div>
          )}
        </Card>

        <Card padded={false}>
          <div className="flex items-center justify-between px-5 py-4">
            <h2 className="text-sm font-semibold text-slate-800">🚨 Needs attention</h2>
            <Badge tone="rose">Remedial list</Badge>
          </div>
          {loading ? (
            <div className="px-5 pb-5">
              <TableSkeleton rows={5} cols={3} />
            </div>
          ) : data?.needsAttention.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-2 font-semibold">Student</th>
                    <th className="px-3 py-2 font-semibold">Class</th>
                    <th className="px-3 py-2 text-right font-semibold">Score</th>
                    <th className="px-5 py-2 text-right font-semibold">Arrears</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.needsAttention.map((student) => (
                    <tr key={student.studentId} className="transition hover:bg-rose-50/40">
                      <td className="px-5 py-2.5">
                        <Link
                          href={`/students/${student.studentId}`}
                          className="font-medium text-slate-800 hover:text-brand-600"
                        >
                          {student.studentName}
                        </Link>
                      </td>
                      <td className="px-3 py-2.5 text-slate-500">{student.classLabel}</td>
                      <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-rose-600">
                        {student.percentage}%
                      </td>
                      <td className="px-5 py-2.5 text-right">
                        <Badge tone={student.failedSubjects ? "rose" : "amber"}>
                          {student.failedSubjects} subject{student.failedSubjects === 1 ? "" : "s"}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="px-5 pb-5">
              <EmptyState icon="🎉" title="Everyone is on track" description="No student is currently below the watch line." />
            </div>
          )}
        </Card>
      </div>
    </>
  );
}

"use client";

import { useMemo, useState } from "react";
import { BarList, ColumnChart, DonutChart } from "@/components/charts";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  PageHeader,
  Select,
  Skeleton,
  StatCard,
  TableSkeleton,
} from "@/components/ui";
import { GRADE_SCALE } from "@/lib/grades";
import { useApi } from "@/lib/client";
import type { ClassListRow, ExamRow, SubjectAnalysisRow } from "@/lib/shared-types";

type Response = {
  subjects: SubjectAnalysisRow[];
  overall: { attempts: number; average: number; passRate: number; distinction: number; absent: number };
};

export default function SubjectAnalysisPage() {
  const exams = useApi<{ exams: ExamRow[] }>("/api/exams");
  const classes = useApi<{ classes: ClassListRow[] }>("/api/classes");
  const [examId, setExamId] = useState("");
  const [classId, setClassId] = useState("");
  const [selected, setSelected] = useState<number | null>(null);

  const url = useMemo(() => {
    const params = new URLSearchParams();
    if (examId) params.set("examId", examId);
    if (classId) params.set("classId", classId);
    const qs = params.toString();
    return `/api/analysis/subject${qs ? `?${qs}` : ""}`;
  }, [examId, classId]);

  const { data, loading, error, refresh } = useApi<Response>(url, [url]);
  const subjects = data?.subjects ?? [];
  const active = subjects.find((s) => s.subjectId === selected) ?? subjects[0] ?? null;

  return (
    <>
      <PageHeader
        icon="🧪"
        title="Subject-wise analysis"
        subtitle="Compare how every subject performed across the selected scope"
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
            <Select value={classId} onChange={(e) => setClassId(e.target.value)} className="w-52">
              <option value="">All classes</option>
              {classes.data?.classes.map((cls) => (
                <option key={cls.id} value={cls.id}>
                  {cls.name} - {cls.section}
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
        <StatCard label="Subjects analysed" value={subjects.length} icon="📚" accent="brand" loading={loading} />
        <StatCard label="Average score" value={`${data?.overall.average ?? 0}%`} icon="📈" accent="sky" loading={loading} />
        <StatCard label="Pass rate" value={`${data?.overall.passRate ?? 0}%`} icon="✅" accent="green" loading={loading} />
        <StatCard
          label="Papers evaluated"
          value={data?.overall.attempts ?? 0}
          sub={`${data?.overall.absent ?? 0} absent`}
          icon="🗂️"
          accent="amber"
          loading={loading}
        />
      </div>

      <Card>
        <h2 className="mb-4 text-sm font-semibold text-slate-800">Average score by subject</h2>
        {loading ? (
          <Skeleton className="h-52 w-full" />
        ) : subjects.length ? (
          <ColumnChart
            items={subjects.map((s) => ({
              label: s.code,
              value: s.average,
              color:
                s.average >= 75
                  ? "linear-gradient(180deg,#34d399,#059669)"
                  : s.average >= 55
                    ? "linear-gradient(180deg,#818cf8,#4f46e5)"
                    : s.average >= 40
                      ? "linear-gradient(180deg,#fbbf24,#d97706)"
                      : "linear-gradient(180deg,#fb7185,#e11d48)",
            }))}
            height={220}
          />
        ) : (
          <EmptyState icon="📊" title="No marks in this scope" description="Choose another exam or class filter." />
        )}
      </Card>

      {loading ? (
        <Card>
          <TableSkeleton rows={8} cols={6} />
        </Card>
      ) : subjects.length ? (
        <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
          <Card padded={false}>
            <div className="border-b border-slate-100 px-5 py-4">
              <h2 className="text-sm font-semibold text-slate-800">Subject performance table</h2>
              <p className="text-xs text-slate-500">Select a row to inspect grade spread and class split</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-3 font-semibold">Subject</th>
                    <th className="px-3 py-3 text-right font-semibold">Avg</th>
                    <th className="px-3 py-3 text-right font-semibold">High</th>
                    <th className="px-3 py-3 text-right font-semibold">Low</th>
                    <th className="px-3 py-3 text-right font-semibold">Pass %</th>
                    <th className="px-3 py-3 text-right font-semibold">Fails</th>
                    <th className="px-5 py-3 font-semibold">Topper</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {subjects.map((subject) => (
                    <tr
                      key={subject.subjectId}
                      onClick={() => setSelected(subject.subjectId)}
                      className={`cursor-pointer transition ${
                        active?.subjectId === subject.subjectId ? "bg-brand-50/70" : "hover:bg-slate-50/70"
                      }`}
                    >
                      <td className="px-5 py-3">
                        <p className="font-medium text-slate-800">{subject.name}</p>
                        <p className="font-mono text-[10px] text-slate-400">{subject.code}</p>
                      </td>
                      <td className="px-3 py-3 text-right font-semibold tabular-nums text-slate-900">
                        {subject.average}%
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums text-emerald-600">{subject.highest}%</td>
                      <td className="px-3 py-3 text-right tabular-nums text-rose-500">{subject.lowest}%</td>
                      <td className="px-3 py-3 text-right tabular-nums text-slate-700">{subject.passRate}%</td>
                      <td className="px-3 py-3 text-right">
                        <Badge tone={subject.failCount ? "rose" : "green"}>{subject.failCount}</Badge>
                      </td>
                      <td className="px-5 py-3 text-slate-600">
                        {subject.topper ? (
                          <>
                            <span className="font-medium text-slate-800">{subject.topper.name}</span>
                            <span className="block text-[11px] text-slate-400">
                              {subject.topper.score} · {subject.topper.classLabel}
                            </span>
                          </>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {active ? (
            <div className="space-y-4">
              <Card>
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-semibold text-slate-800">{active.name}</h2>
                    <p className="text-xs text-slate-500">Grade spread · {active.attempts} papers</p>
                  </div>
                  <Badge tone="brand">{active.code}</Badge>
                </div>
                <DonutChart
                  size={160}
                  centerLabel="avg"
                  centerValue={`${active.average}%`}
                  segments={GRADE_SCALE.filter((g) => (active.grades[g.grade] ?? 0) > 0).map((g) => ({
                    label: g.grade,
                    value: active.grades[g.grade] ?? 0,
                    color: g.color,
                  }))}
                />
              </Card>
              <Card>
                <h2 className="mb-3 text-sm font-semibold text-slate-800">Class split for {active.code}</h2>
                <BarList
                  items={active.classSplit.map((c) => ({
                    label: c.classLabel,
                    value: c.average,
                    sub: `${c.passRate}% pass`,
                  }))}
                />
              </Card>
            </div>
          ) : null}
        </div>
      ) : null}
    </>
  );
}

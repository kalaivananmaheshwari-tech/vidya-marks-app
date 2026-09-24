"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { LineChart } from "@/components/charts";
import {
  Badge,
  Card,
  EmptyState,
  ErrorState,
  GradePill,
  PageHeader,
  Skeleton,
  StatCard,
} from "@/components/ui";
import { useApi } from "@/lib/client";
import type { StudentReport } from "@/lib/shared-types";

const PALETTE = ["#4f46e5", "#0ea5e9", "#10b981", "#f59e0b", "#ec4899", "#8b5cf6", "#14b8a6"];

export default function StudentReportPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const { data, loading, error, refresh } = useApi<StudentReport>(id ? `/api/analysis/student/${id}` : null);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <div className="grid gap-4 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
        <Skeleton className="h-80 w-full" />
      </div>
    );
  }

  if (error) return <ErrorState message={error} onRetry={refresh} />;
  if (!data) return <EmptyState icon="🔍" title="Student not found" />;

  const { profile, examCards, overall, subjectTrend } = data;
  const trendSeries = subjectTrend.slice(0, 6).map((subject, index) => ({
    name: subject.name,
    color: PALETTE[index % PALETTE.length],
    points: subject.points.map((p) => ({ label: p.exam, value: p.value })),
  }));

  return (
    <>
      <PageHeader
        icon="🧑‍🎓"
        title={profile.name}
        subtitle={`${profile.className} - ${profile.section} · Roll ${profile.rollNo} · ${profile.admissionNo}`}
        actions={
          <>
            <Link
              href={`/students?classId=${profile.classId}`}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              ← Back to class roster
            </Link>
            <button
              onClick={() => window.print()}
              className="no-print rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
            >
              Print report card
            </button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Overall average" value={`${overall.average}%`} icon="📈" accent="brand" />
        <StatCard label="Best subject score" value={`${overall.highest}%`} icon="🏅" accent="green" />
        <StatCard label="Lowest score" value={`${overall.lowest}%`} icon="📉" accent="rose" />
        <StatCard
          label="Subject pass rate"
          value={`${overall.passRate}%`}
          sub={`${overall.attempts} papers written`}
          icon="✅"
          accent="sky"
        />
      </div>

      <Card>
        <div className="flex flex-wrap items-center gap-x-8 gap-y-3 text-sm">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-slate-400">Guardian</p>
            <p className="font-medium text-slate-800">{profile.guardianName ?? "—"}</p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wide text-slate-400">Contact</p>
            <p className="font-medium text-slate-800">{profile.contact ?? "—"}</p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wide text-slate-400">Gender</p>
            <p className="font-medium text-slate-800">{profile.gender}</p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wide text-slate-400">Class</p>
            <p className="font-medium text-slate-800">
              {profile.className} - {profile.section}
            </p>
          </div>
        </div>
      </Card>

      {examCards.length === 0 ? (
        <EmptyState
          icon="📝"
          title="No marks recorded yet"
          description="Once teachers enter marks for this student the full report card appears here."
        />
      ) : (
        <>
          <Card>
            <h2 className="mb-4 text-sm font-semibold text-slate-800">Subject progression across exams</h2>
            <LineChart series={trendSeries} />
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            {examCards.map((exam) => (
              <Card key={exam.examId} padded={false}>
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">{exam.examName}</h3>
                    <p className="text-xs text-slate-500">
                      {exam.total} / {exam.maxTotal} marks · {exam.percentage}%
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {exam.rank ? (
                      <Badge tone="brand">
                        Rank {exam.rank} of {exam.classSize}
                      </Badge>
                    ) : null}
                    <GradePill grade={exam.grade} />
                  </div>
                </div>
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-5 py-2 font-semibold">Subject</th>
                      <th className="px-3 py-2 text-right font-semibold">Marks</th>
                      <th className="px-3 py-2 text-right font-semibold">%</th>
                      <th className="px-5 py-2 text-right font-semibold">Grade</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {exam.subjects.map((subject) => (
                      <tr key={subject.subjectId} className={subject.passed ? "" : "bg-rose-50/40"}>
                        <td className="px-5 py-2.5 text-slate-700">
                          {subject.name}
                          <span className="ml-2 font-mono text-[10px] text-slate-400">{subject.code}</span>
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-slate-800">
                          {subject.isAbsent ? "AB" : `${subject.score} / ${subject.maxMarks}`}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-slate-600">
                          {subject.isAbsent ? "—" : `${subject.percentage}%`}
                        </td>
                        <td className="px-5 py-2.5 text-right">
                          <GradePill grade={subject.grade} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            ))}
          </div>
        </>
      )}
    </>
  );
}

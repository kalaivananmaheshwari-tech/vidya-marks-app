"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
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
  useToast,
} from "@/components/ui";
import { ProgressBar } from "@/components/charts";
import { apiRequest, useApi } from "@/lib/client";
import type { ClassListRow, ExamRow } from "@/lib/shared-types";

type SubjectInfo = {
  id: number;
  name: string;
  code: string;
  hasPractical: boolean;
  theoryMarks: number;
  practicalMarks: number;
  internalMarks: number;
  maxMarks: number;
  passMarks: number;
};

type RosterRow = {
  studentId: number;
  name: string;
  rollNo: number;
  admissionNo: string;
  markId: number | null;
  theoryScore: number | null;
  practicalScore: number | null;
  internalScore: number | null;
  score: number | null;
  isAbsent: boolean;
  updatedAt: string | null;
};

type MarksResponse = {
  subjects: SubjectInfo[];
  roster: RosterRow[];
  subject?: SubjectInfo | null;
};

type Draft = {
  theoryScore: string;
  practicalScore: string;
  internalScore: string;
  isAbsent: boolean;
};

export default function MarkEntryPage() {
  const toast = useToast();
  const classes = useApi<{ classes: ClassListRow[] }>("/api/classes");
  const exams = useApi<{ exams: ExamRow[] }>("/api/exams");

  const [classId, setClassId] = useState("");
  const [examId, setExamId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [drafts, setDrafts] = useState<Record<number, Draft>>({});
  const [saving, setSaving] = useState(false);
  const inputsRef = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const presetExam = params.get("examId");
    if (presetExam) setExamId(presetExam);
  }, []);

  useEffect(() => {
    if (!classId && classes.data?.classes.length) setClassId(String(classes.data.classes[0].id));
  }, [classes.data, classId]);

  useEffect(() => {
    if (!examId && exams.data?.exams.length) setExamId(String(exams.data.exams[0].id));
  }, [exams.data, examId]);

  const url = useMemo(() => {
    if (!classId) return null;
    const params = new URLSearchParams({ classId });
    if (examId) params.set("examId", examId);
    if (subjectId) params.set("subjectId", subjectId);
    return `/api/marks?${params.toString()}`;
  }, [classId, examId, subjectId]);

  const { data, loading, error, refresh, refreshing } = useApi<MarksResponse>(url, [url]);

  const subjects = useMemo(() => data?.subjects ?? [], [data?.subjects]);
  const roster = useMemo(() => data?.roster ?? [], [data?.roster]);
  const subject = data?.subject ?? subjects.find((s) => String(s.id) === subjectId) ?? null;

  const hasPractical = subject?.hasPractical ?? false;
  const theoryMax = subject?.theoryMarks ?? (hasPractical ? 70 : 90);
  const practicalMax = subject?.practicalMarks ?? (hasPractical ? 20 : 0);
  const internalMax = subject?.internalMarks ?? 10;
  const totalMax = 100;
  const passMark = subject?.passMarks ?? 35;

  useEffect(() => {
    if (subjects.length && !subjects.some((s) => String(s.id) === subjectId)) {
      setSubjectId(String(subjects[0].id));
    }
  }, [subjects, subjectId]);

  useEffect(() => {
    const next: Record<number, Draft> = {};
    for (const row of roster) {
      // If separate theory/practical/internal scores exist, populate them
      // Else if score exists without breakdown, allocate to theory
      let tScore = row.theoryScore !== null ? String(row.theoryScore) : "";
      let pScore = row.practicalScore !== null ? String(row.practicalScore) : "";
      let iScore = row.internalScore !== null ? String(row.internalScore) : "";

      if (row.score !== null && tScore === "" && pScore === "" && iScore === "") {
        tScore = String(row.score);
      }

      next[row.studentId] = {
        theoryScore: tScore,
        practicalScore: pScore,
        internalScore: iScore,
        isAbsent: row.isAbsent,
      };
    }
    setDrafts(next);
  }, [roster]);

  function getDraftTotal(draft?: Draft): number | null {
    if (!draft || draft.isAbsent) return null;
    const t = draft.theoryScore !== "" ? Number(draft.theoryScore) : null;
    const p = draft.practicalScore !== "" ? Number(draft.practicalScore) : null;
    const i = draft.internalScore !== "" ? Number(draft.internalScore) : null;

    if (t === null && p === null && i === null) return null;
    return (t ?? 0) + (p ?? 0) + (i ?? 0);
  }

  const stats = useMemo(() => {
    const totals: number[] = [];
    let absent = 0;

    for (const row of roster) {
      const d = drafts[row.studentId];
      if (d?.isAbsent) {
        absent++;
      } else {
        const tot = getDraftTotal(d);
        if (tot !== null) totals.push(tot);
      }
    }

    const entered = totals.length + absent;
    const totalSum = totals.reduce((sum, v) => sum + v, 0);

    return {
      entered,
      pending: roster.length - entered,
      average: totals.length ? Math.round((totalSum / totals.length) * 10) / 10 : 0,
      highest: totals.length ? Math.max(...totals) : 0,
      passed: totals.filter((v) => v >= passMark).length,
      failed: totals.filter((v) => v < passMark).length,
      absent,
    };
  }, [roster, drafts, passMark]);

  const dirty = useMemo(() => {
    return roster.some((row) => {
      const d = drafts[row.studentId];
      if (!d) return false;
      const origT = row.theoryScore !== null ? String(row.theoryScore) : "";
      const origP = row.practicalScore !== null ? String(row.practicalScore) : "";
      const origI = row.internalScore !== null ? String(row.internalScore) : "";
      return (
        d.theoryScore !== origT ||
        d.practicalScore !== origP ||
        d.internalScore !== origI ||
        d.isAbsent !== row.isAbsent
      );
    });
  }, [roster, drafts]);

  function setDraft(studentId: number, patch: Partial<Draft>) {
    setDrafts((prev) => {
      const current: Draft = prev[studentId] ?? {
        theoryScore: "",
        practicalScore: "",
        internalScore: "",
        isAbsent: false,
      };
      return { ...prev, [studentId]: { ...current, ...patch } };
    });
  }

  async function saveAll() {
    if (!examId || !subjectId) return;
    setSaving(true);

    const entries = roster.map((row) => {
      const d = drafts[row.studentId] ?? {
        theoryScore: "",
        practicalScore: "",
        internalScore: "",
        isAbsent: false,
      };

      const t = d.theoryScore !== "" ? Number(d.theoryScore) : null;
      const p = d.practicalScore !== "" ? Number(d.practicalScore) : null;
      const i = d.internalScore !== "" ? Number(d.internalScore) : null;

      let score: number | null = null;
      if (!d.isAbsent && (t !== null || p !== null || i !== null)) {
        score = (t ?? 0) + (p ?? 0) + (i ?? 0);
      }

      return {
        studentId: row.studentId,
        theoryScore: d.isAbsent ? null : t,
        practicalScore: d.isAbsent ? null : p,
        internalScore: d.isAbsent ? null : i,
        score: d.isAbsent ? null : score,
        isAbsent: d.isAbsent,
      };
    });

    // Validation
    const invalid = entries.find((e) => {
      if (e.isAbsent) return false;
      if (e.theoryScore !== null && (e.theoryScore < 0 || e.theoryScore > theoryMax)) return true;
      if (hasPractical && e.practicalScore !== null && (e.practicalScore < 0 || e.practicalScore > practicalMax))
        return true;
      if (e.internalScore !== null && (e.internalScore < 0 || e.internalScore > internalMax)) return true;
      if (e.score !== null && (e.score < 0 || e.score > totalMax)) return true;
      return false;
    });

    if (invalid) {
      toast.push(
        `Marks out of range! Theory: max ${theoryMax}, Practical: max ${practicalMax}, Internal: max ${internalMax}`,
        "error",
      );
      setSaving(false);
      return;
    }

    try {
      await apiRequest("/api/marks", {
        method: "PUT",
        body: JSON.stringify({ examId: Number(examId), subjectId: Number(subjectId), entries }),
      });
      toast.push(`Saved marks for ${subject?.name ?? "subject"}`);
      await refresh();
    } catch (err) {
      toast.push(err instanceof Error ? err.message : "Could not save marks", "error");
    } finally {
      setSaving(false);
    }
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>, index: number) {
    if (event.key === "Enter" || event.key === "ArrowDown") {
      event.preventDefault();
      inputsRef.current[index + 1]?.focus();
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      inputsRef.current[index - 1]?.focus();
    }
  }

  const selectedClass = classes.data?.classes.find((c) => String(c.id) === classId);

  return (
    <>
      <PageHeader
        icon="✍️"
        title="Mark entry"
        subtitle="Record theory, practical and internal marks according to subject allocation"
        actions={
          <div className="flex items-center gap-2">
            <Link href={`/mark-assign?classId=${classId}`}>
              <Button variant="secondary" size="sm">
                ⚖️ Mark Assign
              </Button>
            </Link>
            {dirty ? <Badge tone="amber">Unsaved changes</Badge> : null}
            <Button onClick={saveAll} loading={saving} disabled={!roster.length || !dirty}>
              Save marks
            </Button>
          </div>
        }
      />

      <Card>
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Class & section">
            <Select value={classId} onChange={(e) => setClassId(e.target.value)}>
              <option value="">Select class</option>
              {classes.data?.classes.map((cls) => (
                <option key={cls.id} value={cls.id}>
                  {cls.name} - {cls.section} {cls.groupCode ? `(${cls.groupCode})` : ""}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Examination">
            <Select value={examId} onChange={(e) => setExamId(e.target.value)}>
              <option value="">Select exam</option>
              {exams.data?.exams.map((exam) => (
                <option key={exam.id} value={exam.id}>
                  {exam.name} · {exam.term}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Subject">
            <Select value={subjectId} onChange={(e) => setSubjectId(e.target.value)} disabled={!subjects.length}>
              {subjects.length === 0 ? <option value="">No subjects available</option> : null}
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.code}) {s.hasPractical ? "· 🔬 Practical" : "· 📖 Theory"}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        {subject ? (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 p-3 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-800">{subject.name}</span>
              {hasPractical ? (
                <Badge tone="green">🔬 Practical Subject (Yes)</Badge>
              ) : (
                <Badge tone="slate">📖 Non-Practical Subject (No)</Badge>
              )}
            </div>
            <div className="flex items-center gap-3 text-slate-700">
              <span>
                Theory Max: <strong className="text-slate-900">{theoryMax}</strong>
              </span>
              {hasPractical ? (
                <span>
                  Practical Max: <strong className="text-emerald-700">{practicalMax}</strong>
                </span>
              ) : null}
              <span>
                Internal Max: <strong className="text-brand-700">{internalMax}</strong>
              </span>
              <span className="font-bold text-slate-900">
                Total Max: {totalMax}
              </span>
              <span className="text-slate-400">|</span>
              <span className="text-slate-500">Pass: {passMark}%</span>
            </div>
          </div>
        ) : null}
      </Card>

      {error ? <ErrorState message={error} onRetry={refresh} /> : null}

      {!classId || !examId || !subjectId ? (
        <EmptyState
          icon="🧭"
          title="Choose a class, exam and subject"
          description="The mark sheet loads automatically once all three are selected."
        />
      ) : loading ? (
        <Card>
          <TableSkeleton rows={8} cols={5} />
        </Card>
      ) : roster.length === 0 ? (
        <EmptyState
          icon="👥"
          title="No students in this class"
          description="Admit students into this class before entering marks."
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
          <Card padded={false}>
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-3">
              <div>
                <h2 className="text-sm font-semibold text-slate-800">
                  {subject?.name} · {selectedClass?.name} - {selectedClass?.section}
                </h2>
                <p className="text-xs text-slate-500">
                  {hasPractical
                    ? `Enter Theory (max ${theoryMax}), Practical (max ${practicalMax}) and Internal (max ${internalMax}). Total auto-sums to 100.`
                    : `Enter Theory (max ${theoryMax}) and Internal (max ${internalMax}). Total auto-sums to 100.`}
                </p>
              </div>
              {refreshing ? <span className="text-xs text-slate-400">Syncing…</span> : null}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px] text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-3 font-semibold">Roll</th>
                    <th className="px-3 py-3 font-semibold">Student</th>
                    <th className="px-3 py-3 font-semibold">Theory (/{theoryMax})</th>
                    {hasPractical ? (
                      <th className="px-3 py-3 font-semibold text-emerald-800">Practical (/{practicalMax})</th>
                    ) : null}
                    <th className="px-3 py-3 font-semibold text-brand-800">Internal (/{internalMax})</th>
                    <th className="px-3 py-3 font-semibold text-slate-900">Total (/100)</th>
                    <th className="px-3 py-3 text-center font-semibold">Absent</th>
                    <th className="px-5 py-3 text-right font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {roster.map((row, index) => {
                    const draft = drafts[row.studentId] ?? {
                      theoryScore: "",
                      practicalScore: "",
                      internalScore: "",
                      isAbsent: false,
                    };
                    const totalScore = getDraftTotal(draft);
                    const passed = totalScore !== null && totalScore >= passMark;

                    return (
                      <tr key={row.studentId} className="transition hover:bg-slate-50/60">
                        <td className="px-5 py-2.5 tabular-nums text-slate-400">{row.rollNo}</td>
                        <td className="px-3 py-2.5">
                          <p className="font-medium text-slate-800">{row.name}</p>
                          <p className="font-mono text-[10px] text-slate-400">{row.admissionNo}</p>
                        </td>

                        {/* Theory score input */}
                        <td className="px-3 py-2.5">
                          <input
                            ref={(el) => {
                              inputsRef.current[index * 3] = el;
                            }}
                            type="number"
                            inputMode="numeric"
                            value={draft.isAbsent ? "" : draft.theoryScore}
                            disabled={draft.isAbsent}
                            min={0}
                            max={theoryMax}
                            onKeyDown={(e) => handleKeyDown(e, index * 3)}
                            onChange={(e) => setDraft(row.studentId, { theoryScore: e.target.value })}
                            className="w-20 rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm font-semibold tabular-nums text-slate-800 shadow-sm transition focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100 disabled:bg-slate-100"
                            placeholder={`0-${theoryMax}`}
                          />
                        </td>

                        {/* Practical score input (if hasPractical) */}
                        {hasPractical ? (
                          <td className="px-3 py-2.5">
                            <input
                              ref={(el) => {
                                inputsRef.current[index * 3 + 1] = el;
                              }}
                              type="number"
                              inputMode="numeric"
                              value={draft.isAbsent ? "" : draft.practicalScore}
                              disabled={draft.isAbsent}
                              min={0}
                              max={practicalMax}
                              onKeyDown={(e) => handleKeyDown(e, index * 3 + 1)}
                              onChange={(e) => setDraft(row.studentId, { practicalScore: e.target.value })}
                              className="w-20 rounded-lg border border-emerald-200 bg-emerald-50/30 px-2.5 py-1.5 text-sm font-semibold tabular-nums text-emerald-900 shadow-sm transition focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100 disabled:bg-slate-100"
                              placeholder={`0-${practicalMax}`}
                            />
                          </td>
                        ) : null}

                        {/* Internal score input */}
                        <td className="px-3 py-2.5">
                          <input
                            ref={(el) => {
                              inputsRef.current[index * 3 + 2] = el;
                            }}
                            type="number"
                            inputMode="numeric"
                            value={draft.isAbsent ? "" : draft.internalScore}
                            disabled={draft.isAbsent}
                            min={0}
                            max={internalMax}
                            onKeyDown={(e) => handleKeyDown(e, index * 3 + 2)}
                            onChange={(e) => setDraft(row.studentId, { internalScore: e.target.value })}
                            className="w-20 rounded-lg border border-violet-200 bg-violet-50/30 px-2.5 py-1.5 text-sm font-semibold tabular-nums text-violet-900 shadow-sm transition focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100 disabled:bg-slate-100"
                            placeholder={`0-${internalMax}`}
                          />
                        </td>

                        {/* Total score (auto-calculated) */}
                        <td className="px-3 py-2.5 font-bold tabular-nums text-slate-900">
                          {draft.isAbsent ? (
                            <span className="text-slate-400">—</span>
                          ) : totalScore !== null ? (
                            <span
                              className={`rounded-md px-2 py-1 ${
                                passed ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
                              }`}
                            >
                              {totalScore}
                            </span>
                          ) : (
                            <span className="text-slate-300">0</span>
                          )}
                        </td>

                        {/* Absent checkbox */}
                        <td className="px-3 py-2.5 text-center">
                          <input
                            type="checkbox"
                            checked={draft.isAbsent}
                            onChange={(e) => setDraft(row.studentId, { isAbsent: e.target.checked })}
                            className="h-4 w-4 rounded border-slate-300 text-rose-600 focus:ring-rose-400"
                          />
                        </td>

                        {/* Status badge */}
                        <td className="px-5 py-2.5 text-right">
                          {draft.isAbsent ? (
                            <Badge tone="rose">Absent</Badge>
                          ) : totalScore === null ? (
                            <Badge tone="slate">Pending</Badge>
                          ) : passed ? (
                            <Badge tone="green">{totalScore}% Pass</Badge>
                          ) : (
                            <Badge tone="amber">{totalScore}% Fail</Badge>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-5 py-3">
              <p className="text-xs text-slate-500">
                {stats.entered} of {roster.length} entered · {stats.pending} pending
              </p>
              <Button onClick={saveAll} loading={saving} disabled={!dirty}>
                Save marks
              </Button>
            </div>
          </Card>

          {/* Sidebar summary */}
          <div className="space-y-4">
            <Card>
              <h3 className="text-sm font-semibold text-slate-800">Live summary</h3>
              <div className="mt-3 space-y-3">
                <div>
                  <div className="mb-1 flex justify-between text-xs text-slate-500">
                    <span>Entry progress</span>
                    <span className="font-semibold text-slate-700">
                      {roster.length ? Math.round((stats.entered / roster.length) * 100) : 0}%
                    </span>
                  </div>
                  <ProgressBar value={stats.entered} max={roster.length || 1} color="#4f46e5" />
                </div>
                <dl className="grid grid-cols-2 gap-2">
                  {[
                    { label: "Average", value: `${stats.average}`, tone: "text-slate-900" },
                    { label: "Highest", value: `${stats.highest}`, tone: "text-emerald-600" },
                    { label: "Passed", value: `${stats.passed}`, tone: "text-emerald-600" },
                    { label: "Failed", value: `${stats.failed}`, tone: "text-rose-600" },
                  ].map((item) => (
                    <div key={item.label} className="rounded-xl bg-slate-50 p-2.5 text-center">
                      <dt className="text-[10px] uppercase tracking-wide text-slate-500">{item.label}</dt>
                      <dd className={`text-base font-bold ${item.tone}`}>{item.value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            </Card>

            <Card>
              <h3 className="text-sm font-semibold text-slate-800">Mark Allocation Rule</h3>
              <p className="mt-1 text-xs text-slate-500 leading-relaxed">
                {hasPractical ? (
                  <>
                    This subject has <strong className="text-emerald-700">Practical = Yes</strong>:
                    <br />
                    • Theory: max 70
                    <br />
                    • Practical: max 20
                    <br />
                    • Internal: max 10
                  </>
                ) : (
                  <>
                    This subject has <strong className="text-brand-700">Practical = No</strong>:
                    <br />
                    • Theory: max 90
                    <br />
                    • Internal: max 10
                  </>
                )}
              </p>
              <Link href={`/mark-assign?classId=${classId}`} className="mt-3 block">
                <Button variant="secondary" size="sm" className="w-full">
                  Change in Mark Assign →
                </Button>
              </Link>
            </Card>

            <Card>
              <h3 className="text-sm font-semibold text-slate-800">Quick actions</h3>
              <div className="mt-2 space-y-2">
                <Button
                  variant="secondary"
                  size="sm"
                  className="w-full"
                  onClick={() => {
                    const next: Record<number, Draft> = {};
                    roster.forEach((row) => {
                      next[row.studentId] = {
                        theoryScore: "",
                        practicalScore: "",
                        internalScore: "",
                        isAbsent: false,
                      };
                    });
                    setDrafts(next);
                  }}
                >
                  Clear all entries
                </Button>
              </div>
            </Card>
          </div>
        </div>
      )}
    </>
  );
}

"use client";

import { useEffect, useState } from "react";
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
import { apiRequest, useApi } from "@/lib/client";
import type { ClassListRow, MarkAssignItem, TeacherRow } from "@/lib/shared-types";

type MarkAssignResponse = {
  class: ClassListRow | null;
  subjects: MarkAssignItem[];
};

export default function MarkAssignPage() {
  const toast = useToast();
  const classes = useApi<{ classes: ClassListRow[] }>("/api/classes");
  const teachers = useApi<{ teachers: TeacherRow[] }>("/api/teachers");

  const [classId, setClassId] = useState("");
  const [subjectsState, setSubjectsState] = useState<MarkAssignItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  // Default to first class if available
  useEffect(() => {
    if (!classId && classes.data?.classes.length) {
      setClassId(String(classes.data.classes[0].id));
    }
  }, [classes.data, classId]);

  const { data, loading, error, refresh } = useApi<MarkAssignResponse>(
    classId ? `/api/mark-assign?classId=${classId}` : null,
    [classId],
  );

  useEffect(() => {
    if (data?.subjects) {
      setSubjectsState(data.subjects);
      setDirty(false);
    }
  }, [data]);

  const selectedClass = classes.data?.classes.find((c) => String(c.id) === classId);

  function togglePractical(subjectId: number, hasPractical: boolean) {
    setSubjectsState((prev) =>
      prev.map((s) => {
        if (s.id !== subjectId) return s;
        return {
          ...s,
          hasPractical,
          theoryMarks: hasPractical ? 70 : 90,
          practicalMarks: hasPractical ? 20 : 0,
          internalMarks: 10,
          maxMarks: 100,
        };
      }),
    );
    setDirty(true);
  }

  function setTeacher(subjectId: number, teacherId: number | null) {
    setSubjectsState((prev) =>
      prev.map((s) => (s.id === subjectId ? { ...s, teacherId } : s)),
    );
    setDirty(true);
  }

  async function saveAll() {
    if (!classId) return;
    setSaving(true);
    try {
      await apiRequest("/api/mark-assign", {
        method: "POST",
        body: JSON.stringify({
          classId: Number(classId),
          assignments: subjectsState.map((s) => ({
            id: s.id,
            hasPractical: s.hasPractical,
            teacherId: s.teacherId,
          })),
        }),
      });
      toast.push(
        `Mark allocation saved for ${selectedClass?.name ?? "Class"} - ${selectedClass?.section ?? ""}`,
      );
      setDirty(false);
      await refresh();
    } catch (err) {
      toast.push(err instanceof Error ? err.message : "Failed to save mark allocation", "error");
    } finally {
      setSaving(false);
    }
  }

  const practicalCount = subjectsState.filter((s) => s.hasPractical).length;
  const theoryCount = subjectsState.filter((s) => !s.hasPractical).length;

  return (
    <>
      <PageHeader
        icon="⚖️"
        title="Mark Assign"
        subtitle="Select class and section, then set whether each subject has practical. Yes: Theory 70 + Practical 20 + Internal 10. No: Theory 90 + Internal 10."
        actions={
          <div className="flex items-center gap-2">
            {dirty ? <Badge tone="amber">Unsaved changes</Badge> : null}
            <Button onClick={saveAll} loading={saving} disabled={!dirty || subjectsState.length === 0}>
              Save Mark Allocation
            </Button>
          </div>
        }
      />

      <Card>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Select class & section">
            <Select value={classId} onChange={(e) => setClassId(e.target.value)}>
              <option value="">Select a class</option>
              {classes.data?.classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} - {c.section} {c.groupCode ? `(Group: ${c.groupCode})` : ""}
                </option>
              ))}
            </Select>
          </Field>
          {selectedClass ? (
            <div className="flex flex-col justify-end">
              <div className="rounded-xl bg-slate-50 p-2.5 text-xs text-slate-600">
                <span className="font-semibold text-slate-900">
                  {selectedClass.name} - {selectedClass.section}
                </span>
                {selectedClass.groupCode ? (
                  <Badge tone="sky" className="ml-2">
                    Group {selectedClass.groupCode}
                  </Badge>
                ) : (
                  <Badge tone="slate" className="ml-2">
                    Common / Classes 6-10
                  </Badge>
                )}
                <span className="block mt-0.5 text-slate-400">
                  {subjectsState.length} subjects configured
                </span>
              </div>
            </div>
          ) : null}
        </div>
      </Card>

      {error ? <ErrorState message={error} onRetry={refresh} /> : null}

      {!classId ? (
        <EmptyState
          icon="🏫"
          title="Choose a class and section"
          description="Select a class above to configure practical and theory mark distribution for each subject."
        />
      ) : loading ? (
        <Card>
          <TableSkeleton rows={6} cols={5} />
        </Card>
      ) : subjectsState.length === 0 ? (
        <EmptyState
          icon="📚"
          title="No subjects mapped for this class"
          description="Add subjects for this class or group in the Classes & sections setup."
        />
      ) : (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <Card className="border-emerald-100 bg-emerald-50/50 p-4">
              <p className="text-[11px] font-bold uppercase tracking-wide text-emerald-800">
                🔬 Practical Subjects (Yes)
              </p>
              <p className="mt-1 text-2xl font-bold text-emerald-900">{practicalCount}</p>
              <p className="text-xs text-emerald-700">Theory: 70 · Practical: 20 · Internal: 10 = 100</p>
            </Card>
            <Card className="border-brand-100 bg-brand-50/50 p-4">
              <p className="text-[11px] font-bold uppercase tracking-wide text-brand-800">
                📖 Non-Practical Subjects (No)
              </p>
              <p className="mt-1 text-2xl font-bold text-brand-900">{theoryCount}</p>
              <p className="text-xs text-brand-700">Theory: 90 · Internal: 10 = 100</p>
            </Card>
            <Card className="border-slate-200 bg-white p-4">
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
                Total Class Subjects
              </p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{subjectsState.length}</p>
              <p className="text-xs text-slate-400">Maximum 100 marks per subject</p>
            </Card>
          </div>

          <Card padded={false}>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-3.5">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">
                  Subject mark breakdown for {selectedClass?.name} - {selectedClass?.section}
                </h2>
                <p className="text-xs text-slate-500">
                  Toggle whether each subject has practical. Mark breakdown updates instantly.
                </p>
              </div>
              <Button onClick={saveAll} loading={saving} disabled={!dirty} size="sm">
                Save Changes
              </Button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-3 font-semibold">Subject</th>
                    <th className="px-3 py-3 font-semibold">If this subject having practical?</th>
                    <th className="px-3 py-3 font-semibold">Mark Breakdown</th>
                    <th className="px-3 py-3 font-semibold">Subject Teacher</th>
                    <th className="px-5 py-3 text-right font-semibold">Total Max</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {subjectsState.map((subject) => (
                    <tr key={subject.id} className="transition hover:bg-slate-50/60">
                      <td className="px-5 py-3.5">
                        <p className="font-semibold text-slate-900">{subject.name}</p>
                        <span className="font-mono text-[11px] text-slate-400">{subject.code}</span>
                      </td>

                      <td className="px-3 py-3.5">
                        <div className="inline-flex rounded-xl border border-slate-200 bg-slate-100 p-1">
                          <button
                            type="button"
                            onClick={() => togglePractical(subject.id, true)}
                            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                              subject.hasPractical
                                ? "bg-emerald-600 text-white shadow-sm"
                                : "text-slate-600 hover:text-slate-900"
                            }`}
                          >
                            <span>🔬</span> Yes (Practical)
                          </button>
                          <button
                            type="button"
                            onClick={() => togglePractical(subject.id, false)}
                            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                              !subject.hasPractical
                                ? "bg-brand-600 text-white shadow-sm"
                                : "text-slate-600 hover:text-slate-900"
                            }`}
                          >
                            <span>📖</span> No (Otherwise)
                          </button>
                        </div>
                      </td>

                      <td className="px-3 py-3.5">
                        {subject.hasPractical ? (
                          <div className="flex items-center gap-2">
                            <span className="rounded-lg bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-800 ring-1 ring-emerald-200">
                              Theory: 70
                            </span>
                            <span className="rounded-lg bg-teal-50 px-2 py-1 text-xs font-semibold text-teal-800 ring-1 ring-teal-200">
                              Practical: 20
                            </span>
                            <span className="rounded-lg bg-violet-50 px-2 py-1 text-xs font-semibold text-violet-800 ring-1 ring-violet-200">
                              Internal: 10
                            </span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="rounded-lg bg-brand-50 px-2 py-1 text-xs font-semibold text-brand-800 ring-1 ring-brand-200">
                              Theory: 90
                            </span>
                            <span className="rounded-lg bg-violet-50 px-2 py-1 text-xs font-semibold text-violet-800 ring-1 ring-violet-200">
                              Internal: 10
                            </span>
                          </div>
                        )}
                      </td>

                      <td className="px-3 py-3.5">
                        <select
                          value={subject.teacherId ? String(subject.teacherId) : ""}
                          onChange={(e) =>
                            setTeacher(subject.id, e.target.value ? Number(e.target.value) : null)
                          }
                          className="w-48 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 shadow-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
                        >
                          <option value="">Select teacher</option>
                          {teachers.data?.teachers.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.name}
                            </option>
                          ))}
                        </select>
                      </td>

                      <td className="px-5 py-3.5 text-right font-bold text-slate-900 tabular-nums">
                        100 marks
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3.5">
              <p className="text-xs text-slate-500">
                Rule: If practical = Yes → Theory 70 + Practical 20 + Internal 10. Otherwise → Theory 90 + Internal 10.
              </p>
              <Button onClick={saveAll} loading={saving} disabled={!dirty}>
                Save Mark Allocation
              </Button>
            </div>
          </Card>
        </div>
      )}
    </>
  );
}

"use client";

import Link from "next/link";
import { useState } from "react";
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  Field,
  Input,
  Modal,
  PageHeader,
  Select,
  Skeleton,
  useToast,
} from "@/components/ui";
import { apiRequest, useApi } from "@/lib/client";
import type { ExamRow } from "@/lib/shared-types";
import { ACADEMIC_YEARS, DEFAULT_ACADEMIC_YEAR } from "@/lib/academic";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const YEARS = ["2024", "2025", "2026", "2027", "2028"];

const emptyForm = {
  name: "",
  month: "September",
  year: "2026",
  maxMarks: "100",
  startDate: "",
  term: "Term 1",
  academicYear: DEFAULT_ACADEMIC_YEAR as string,
  isPublished: true,
};

export default function ExamsPage() {
  const toast = useToast();
  const { data, loading, error, refresh, setData } = useApi<{ exams: ExamRow[] }>("/api/exams");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ExamRow | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<ExamRow | null>(null);
  const [busyDelete, setBusyDelete] = useState(false);

  const exams = data?.exams ?? [];

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  }

  function openEdit(exam: ExamRow) {
    setEditing(exam);
    setForm({
      name: exam.name,
      month: exam.month ?? "September",
      year: exam.year ?? "2025",
      maxMarks: String(exam.maxMarks ?? 100),
      startDate: exam.startDate ?? "",
      term: exam.term ?? "Term 1",
      academicYear: exam.academicYear ?? "2025-2026",
      isPublished: exam.isPublished,
    });
    setOpen(true);
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    const previous = exams;
    const optimistic: ExamRow = {
      id: editing?.id ?? -Date.now(),
      name: form.name,
      month: form.month,
      year: form.year,
      term: form.term,
      academicYear: form.academicYear,
      maxMarks: Number(form.maxMarks) || 100,
      startDate: form.startDate || null,
      isPublished: form.isPublished,
      markCount: editing?.markCount ?? 0,
    };
    setData({
      exams: editing
        ? exams.map((e) => (e.id === editing.id ? optimistic : e))
        : [optimistic, ...exams],
    });
    setOpen(false);

    try {
      await apiRequest(editing ? `/api/exams/${editing.id}` : "/api/exams", {
        method: editing ? "PATCH" : "POST",
        body: JSON.stringify({
          name: form.name,
          month: form.month,
          year: form.year,
          maxMarks: form.maxMarks,
          startDate: form.startDate || null,
          term: form.term,
          academicYear: form.academicYear,
          isPublished: form.isPublished,
        }),
      });
      toast.push(editing ? "Examination updated" : `${form.name} scheduled`);
      await refresh();
    } catch (err) {
      setData({ exams: previous });
      toast.push(err instanceof Error ? err.message : "Could not save exam", "error");
    } finally {
      setSaving(false);
    }
  }

  async function togglePublish(exam: ExamRow) {
    const previous = exams;
    setData({ exams: exams.map((e) => (e.id === exam.id ? { ...e, isPublished: !e.isPublished } : e)) });
    try {
      await apiRequest(`/api/exams/${exam.id}`, {
        method: "PATCH",
        body: JSON.stringify({ isPublished: !exam.isPublished }),
      });
      toast.push(exam.isPublished ? "Results unpublished" : "Results published to staff");
    } catch (err) {
      setData({ exams: previous });
      toast.push(err instanceof Error ? err.message : "Could not update", "error");
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    setBusyDelete(true);
    const previous = exams;
    setData({ exams: exams.filter((e) => e.id !== deleting.id) });
    try {
      await apiRequest(`/api/exams/${deleting.id}`, { method: "DELETE" });
      toast.push("Examination removed");
      setDeleting(null);
      await refresh();
    } catch (err) {
      setData({ exams: previous });
      toast.push(err instanceof Error ? err.message : "Could not delete exam", "error");
    } finally {
      setBusyDelete(false);
    }
  }

  return (
    <>
      <PageHeader
        icon="🗓️"
        title="Examinations"
        subtitle="Academic details: Name of the Exam, Month, Year, Maximum Marks, and Start Date"
        actions={<Button onClick={openCreate}>+ Add examination</Button>}
      />

      {error ? <ErrorState message={error} onRetry={refresh} /> : null}

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-48 w-full" />
          ))}
        </div>
      ) : exams.length === 0 ? (
        <EmptyState
          icon="🗓️"
          title="No examinations yet"
          description="Schedule a unit test, quarterly or half yearly exam by providing Name of the Exam, Month, Year, Maximum Marks and Start Date."
          action={<Button onClick={openCreate}>Add first examination</Button>}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {exams.map((exam) => (
            <Card key={exam.id} className="flex flex-col justify-between transition hover:-translate-y-0.5 hover:shadow-lg">
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-base font-semibold text-slate-900">{exam.name}</h3>
                    <p className="text-xs font-medium text-brand-700">
                      📅 {exam.month ? `${exam.month} ` : ""}{exam.year ?? ""}
                      {exam.academicYear && !exam.year ? ` · ${exam.academicYear}` : ""}
                    </p>
                  </div>
                  <Badge tone={exam.isPublished ? "green" : "amber"}>
                    {exam.isPublished ? "Published" : "Draft"}
                  </Badge>
                </div>

                <dl className="mt-4 grid grid-cols-3 gap-2 text-sm">
                  <div className="rounded-xl bg-slate-50 p-2.5 text-center">
                    <dt className="text-[10px] uppercase font-semibold tracking-wide text-slate-500">Max Marks</dt>
                    <dd className="text-base font-bold text-slate-900">{exam.maxMarks}</dd>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-2.5 text-center">
                    <dt className="text-[10px] uppercase font-semibold tracking-wide text-slate-500">Start Date</dt>
                    <dd className="text-xs font-bold text-slate-800 mt-1">
                      {exam.startDate
                        ? new Date(exam.startDate).toLocaleDateString("en-IN", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })
                        : "TBD"}
                    </dd>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-2.5 text-center">
                    <dt className="text-[10px] uppercase font-semibold tracking-wide text-slate-500">Marks Done</dt>
                    <dd className="text-base font-bold text-slate-800">{exam.markCount}</dd>
                  </div>
                </dl>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <Link href={`/marks?examId=${exam.id}`} className="flex-1">
                  <Button size="sm" className="w-full">
                    Enter marks
                  </Button>
                </Link>
                <Button variant="secondary" size="sm" onClick={() => togglePublish(exam)}>
                  {exam.isPublished ? "Unpublish" : "Publish"}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => openEdit(exam)}>
                  Edit
                </Button>
                <Button variant="danger" size="sm" onClick={() => setDeleting(exam)}>
                  ✕
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Modal: Adding academic details */}
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? `Edit ${editing.name}` : "Add examination"}
        description="Add examination academic details: Name of the Exam, Month, Year, Maximum Marks and Start Date."
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button form="exam-form" type="submit" loading={saving}>
              {editing ? "Save changes" : "Save examination"}
            </Button>
          </>
        }
      >
        <form id="exam-form" onSubmit={save} className="space-y-4">
          <Field label="Name of the Exam" hint="e.g. Unit Test I, Quarterly Examination, Half Yearly Examination">
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Quarterly Examination"
              required
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Month">
              <Select value={form.month} onChange={(e) => setForm({ ...form, month: e.target.value })}>
                {MONTHS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Year">
              <div className="space-y-1">
                <Select
                  value={YEARS.includes(form.year) ? form.year : "custom"}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val !== "custom") setForm({ ...form, year: val });
                  }}
                >
                  {YEARS.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                  <option value="custom">Other year...</option>
                </Select>
                {!YEARS.includes(form.year) ? (
                  <Input
                    value={form.year}
                    onChange={(e) => setForm({ ...form, year: e.target.value })}
                    placeholder="e.g. 2026"
                  />
                ) : null}
              </div>
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Academic Year">
              <Select
                value={form.academicYear}
                onChange={(e) => setForm({ ...form, academicYear: e.target.value })}
              >
                {ACADEMIC_YEARS.map((yr) => (
                  <option key={yr} value={yr}>
                    {yr}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Maximum Marks" hint="e.g. 100">
              <Input
                type="number"
                value={form.maxMarks}
                onChange={(e) => setForm({ ...form, maxMarks: e.target.value })}
                min={1}
                required
              />
            </Field>

            <Field label="Start Date">
              <Input
                type="date"
                value={form.startDate}
                onChange={(e) => {
                  const val = e.target.value;
                  const d = new Date(val);
                  if (!isNaN(d.getTime())) {
                    const m = d.toLocaleString("en-US", { month: "long" });
                    const y = String(d.getFullYear());
                    setForm({ ...form, startDate: val, month: m, year: y });
                  } else {
                    setForm({ ...form, startDate: val });
                  }
                }}
                required
              />
            </Field>
          </div>

          <label className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2.5 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={form.isPublished}
              onChange={(e) => setForm({ ...form, isPublished: e.target.checked })}
              className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-400"
            />
            Publish results to teachers and staff
          </label>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleting)}
        title={`Delete ${deleting?.name ?? ""}?`}
        message="Every mark recorded for this examination will be permanently removed."
        onCancel={() => setDeleting(null)}
        onConfirm={confirmDelete}
        busy={busyDelete}
      />
    </>
  );
}

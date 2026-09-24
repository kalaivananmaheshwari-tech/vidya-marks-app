"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
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
  TableSkeleton,
  useToast,
} from "@/components/ui";
import { apiRequest, useApi } from "@/lib/client";
import type { ClassListRow, StudentRow } from "@/lib/shared-types";

const emptyForm = {
  name: "",
  admissionNo: "",
  rollNo: "",
  gender: "Female",
  classId: "",
  guardianName: "",
  contact: "",
  dob: "",
};

export default function StudentsPage() {
  const toast = useToast();
  const classes = useApi<{ classes: ClassListRow[] }>("/api/classes");
  const [classId, setClassId] = useState("");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const preset = params.get("classId");
    if (preset) setClassId(preset);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setQuery(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const url = useMemo(() => {
    const params = new URLSearchParams();
    if (classId) params.set("classId", classId);
    if (query) params.set("q", query);
    const qs = params.toString();
    return `/api/students${qs ? `?${qs}` : ""}`;
  }, [classId, query]);

  const { data, loading, error, refresh, setData, refreshing } = useApi<{ students: StudentRow[] }>(url, [url]);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<StudentRow | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<StudentRow | null>(null);
  const [busyDelete, setBusyDelete] = useState(false);

  const students = data?.students ?? [];

  function openCreate() {
    setEditing(null);
    setForm({ ...emptyForm, classId: classId || String(classes.data?.classes[0]?.id ?? "") });
    setOpen(true);
  }

  function openEdit(student: StudentRow) {
    setEditing(student);
    setForm({
      name: student.name,
      admissionNo: student.admissionNo,
      rollNo: String(student.rollNo),
      gender: student.gender,
      classId: String(student.classId),
      guardianName: student.guardianName ?? "",
      contact: student.contact ?? "",
      dob: student.dob ?? "",
    });
    setOpen(true);
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!form.classId) {
      toast.push("Pick a class for this student", "error");
      return;
    }
    setSaving(true);
    const previous = students;
    const cls = classes.data?.classes.find((c) => String(c.id) === form.classId);
    const optimistic: StudentRow = {
      id: editing?.id ?? -Date.now(),
      admissionNo: form.admissionNo || "Pending…",
      name: form.name,
      rollNo: Number(form.rollNo) || (editing?.rollNo ?? students.length + 1),
      gender: form.gender,
      dob: form.dob || null,
      classId: Number(form.classId),
      className: cls?.name ?? editing?.className ?? "",
      section: cls?.section ?? editing?.section ?? "",
      groupCode: cls?.groupCode ?? null,
      guardianName: form.guardianName || null,
      contact: form.contact || null,
      avgPercentage: editing?.avgPercentage ?? 0,
    };
    setData({
      students: editing
        ? students.map((s) => (s.id === editing.id ? optimistic : s))
        : [...students, optimistic],
    });
    setOpen(false);

    try {
      await apiRequest(editing ? `/api/students/${editing.id}` : "/api/students", {
        method: editing ? "PATCH" : "POST",
        body: JSON.stringify(form),
      });
      toast.push(editing ? "Student updated" : `${form.name} admitted`);
      await refresh();
    } catch (err) {
      setData({ students: previous });
      toast.push(err instanceof Error ? err.message : "Could not save student", "error");
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    setBusyDelete(true);
    const previous = students;
    setData({ students: students.filter((s) => s.id !== deleting.id) });
    try {
      await apiRequest(`/api/students/${deleting.id}`, { method: "DELETE" });
      toast.push("Student record removed");
      setDeleting(null);
      await refresh();
    } catch (err) {
      setData({ students: previous });
      toast.push(err instanceof Error ? err.message : "Could not delete student", "error");
    } finally {
      setBusyDelete(false);
    }
  }

  return (
    <>
      <PageHeader
        icon="🎓"
        title="Students"
        subtitle="Admission register with performance snapshot"
        actions={
          <div className="flex items-center gap-2">
            <Link href="/students/entry">
              <Button size="md">
                📝 Student Entry &amp; Marks
              </Button>
            </Link>
            <Button onClick={openCreate} variant="secondary">
              + Quick Admit
            </Button>
          </div>
        }
      />

      <Card className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex-1">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="🔍 Search by name, admission number or guardian"
          />
        </div>
        <Select value={classId} onChange={(e) => setClassId(e.target.value)} className="sm:w-60">
          <option value="">All classes</option>
          {classes.data?.classes.map((cls) => (
            <option key={cls.id} value={cls.id}>
              {cls.name} - {cls.section} {cls.groupCode ? `(${cls.groupCode})` : ""}
            </option>
          ))}
        </Select>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span className="rounded-full bg-slate-100 px-3 py-1 font-semibold text-slate-600">
            {students.length} students
          </span>
          {refreshing ? <span className="animate-pulse">Syncing…</span> : null}
        </div>
      </Card>

      {error ? <ErrorState message={error} onRetry={refresh} /> : null}

      {loading ? (
        <Card>
          <TableSkeleton rows={8} cols={5} />
        </Card>
      ) : students.length === 0 ? (
        <EmptyState
          icon="🎓"
          title={query || classId ? "No students match this filter" : "No students admitted yet"}
          description={
            query || classId
              ? "Try a different class or clear the search box."
              : "Add students to a class to start recording marks."
          }
          action={<Button onClick={openCreate}>Admit a student</Button>}
        />
      ) : (
        <Card padded={false}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3 font-semibold">Roll</th>
                  <th className="px-3 py-3 font-semibold">Student</th>
                  <th className="px-3 py-3 font-semibold">Class</th>
                  <th className="px-3 py-3 font-semibold">Guardian</th>
                  <th className="px-3 py-3 font-semibold">Contact</th>
                  <th className="px-3 py-3 text-right font-semibold">Average</th>
                  <th className="px-5 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {students.map((student) => (
                  <tr key={student.id} className="transition hover:bg-slate-50/70">
                    <td className="px-5 py-3 font-semibold tabular-nums text-slate-400">{student.rollNo}</td>
                    <td className="px-3 py-3">
                      <Link
                        href={`/students/${student.id}`}
                        className="font-medium text-slate-800 hover:text-brand-600"
                      >
                        {student.name}
                      </Link>
                      <p className="font-mono text-[11px] text-slate-400">{student.admissionNo}</p>
                    </td>
                    <td className="px-3 py-3">
                      <span className="text-slate-700">
                        {student.className} - {student.section}
                      </span>
                      {student.groupCode ? (
                        <Badge tone="sky" className="ml-2">
                          {student.groupCode}
                        </Badge>
                      ) : null}
                    </td>
                    <td className="px-3 py-3 text-slate-600">{student.guardianName ?? "—"}</td>
                    <td className="px-3 py-3 text-slate-500">{student.contact ?? "—"}</td>
                    <td className="px-3 py-3 text-right">
                      <span
                        className={`font-semibold tabular-nums ${
                          student.avgPercentage >= 75
                            ? "text-emerald-600"
                            : student.avgPercentage >= 50
                              ? "text-slate-800"
                              : student.avgPercentage > 0
                                ? "text-rose-600"
                                : "text-slate-400"
                        }`}
                      >
                        {student.avgPercentage ? `${student.avgPercentage}%` : "—"}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex justify-end items-center gap-1.5">
                        <Link href={`/students/entry?classId=${student.classId}&studentId=${student.id}`}>
                          <Button variant="secondary" size="sm">
                            📝 Entry &amp; Marks
                          </Button>
                        </Link>
                        <Link href={`/students/${student.id}`}>
                          <Button variant="ghost" size="sm">
                            Report
                          </Button>
                        </Link>
                        <Button variant="ghost" size="sm" onClick={() => openEdit(student)}>
                          Edit
                        </Button>
                        <Button variant="danger" size="sm" onClick={() => setDeleting(student)}>
                          ✕
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? `Edit ${editing.name}` : "Admit new student"}
        description="Admission numbers are generated automatically when left blank."
        width="max-w-2xl"
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button form="student-form" type="submit" loading={saving}>
              {editing ? "Save changes" : "Admit student"}
            </Button>
          </>
        }
      >
        <form id="student-form" onSubmit={save} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Full name">
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ananya Raman"
                required
              />
            </Field>
            <Field label="Class">
              <Select
                value={form.classId}
                onChange={(e) => setForm({ ...form, classId: e.target.value })}
                required
              >
                <option value="">Select class</option>
                {classes.data?.classes.map((cls) => (
                  <option key={cls.id} value={cls.id}>
                    {cls.name} - {cls.section} {cls.groupCode ? `(${cls.groupCode})` : ""}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Admission no.">
              <Input
                value={form.admissionNo}
                onChange={(e) => setForm({ ...form, admissionNo: e.target.value })}
                placeholder="Auto"
              />
            </Field>
            <Field label="Roll no.">
              <Input
                type="number"
                value={form.rollNo}
                onChange={(e) => setForm({ ...form, rollNo: e.target.value })}
                placeholder="Auto"
                min={1}
              />
            </Field>
            <Field label="Gender">
              <Select value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}>
                <option>Female</option>
                <option>Male</option>
                <option>Other</option>
              </Select>
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Guardian">
              <Input
                value={form.guardianName}
                onChange={(e) => setForm({ ...form, guardianName: e.target.value })}
                placeholder="Ravi Raman"
              />
            </Field>
            <Field label="Contact">
              <Input
                value={form.contact}
                onChange={(e) => setForm({ ...form, contact: e.target.value })}
                placeholder="+91 98400 00000"
              />
            </Field>
            <Field label="Date of birth">
              <Input type="date" value={form.dob} onChange={(e) => setForm({ ...form, dob: e.target.value })} />
            </Field>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleting)}
        title={`Remove ${deleting?.name ?? ""}?`}
        message="This deletes the student record and every mark recorded for them."
        onCancel={() => setDeleting(null)}
        onConfirm={confirmDelete}
        busy={busyDelete}
      />
    </>
  );
}

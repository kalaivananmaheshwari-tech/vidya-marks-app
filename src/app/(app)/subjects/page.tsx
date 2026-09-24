"use client";

import { useMemo, useState } from "react";
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
import type { GroupRow, SubjectRow, TeacherRow } from "@/lib/shared-types";

const emptyForm = {
  code: "",
  name: "",
  groupId: "",
  hasPractical: false,
  passMarks: "35",
  teacherId: "",
};

export default function SubjectsPage() {
  const toast = useToast();
  const { data, loading, error, refresh, setData } = useApi<{ subjects: SubjectRow[] }>("/api/subjects");
  const groups = useApi<{ groups: GroupRow[] }>("/api/groups");
  const teachers = useApi<{ teachers: TeacherRow[] }>("/api/teachers");

  const [filter, setFilter] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<SubjectRow | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<SubjectRow | null>(null);
  const [busyDelete, setBusyDelete] = useState(false);

  const subjects = useMemo(() => {
    const list = data?.subjects ?? [];
    if (!filter) return list;
    if (filter === "common") return list.filter((s) => !s.groupId && !s.classId);
    if (filter === "practical") return list.filter((s) => s.hasPractical);
    if (filter === "theory") return list.filter((s) => !s.hasPractical);
    return list.filter((s) => String(s.groupId) === filter);
  }, [data, filter]);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  }

  function openEdit(subject: SubjectRow) {
    setEditing(subject);
    setForm({
      code: subject.code,
      name: subject.name,
      groupId: subject.groupId ? String(subject.groupId) : "",
      hasPractical: subject.hasPractical,
      passMarks: String(subject.passMarks),
      teacherId: subject.teacherId ? String(subject.teacherId) : "",
    });
    setOpen(true);
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    const all = data?.subjects ?? [];
    const previous = all;
    const group = groups.data?.groups.find((g) => String(g.id) === form.groupId) ?? null;
    const teacher = teachers.data?.teachers.find((t) => String(t.id) === form.teacherId) ?? null;
    const hasPractical = Boolean(form.hasPractical);

    const optimistic: SubjectRow = {
      id: editing?.id ?? -Date.now(),
      code: form.code.toUpperCase(),
      name: form.name,
      groupId: group?.id ?? null,
      groupCode: group?.code ?? null,
      groupName: group?.name ?? null,
      classId: editing?.classId ?? null,
      hasPractical,
      theoryMarks: hasPractical ? 70 : 90,
      practicalMarks: hasPractical ? 20 : 0,
      internalMarks: 10,
      maxMarks: 100,
      passMarks: Number(form.passMarks) || 35,
      teacherId: teacher?.id ?? null,
      teacherName: teacher?.name ?? null,
      markCount: editing?.markCount ?? 0,
    };
    setData({
      subjects: editing ? all.map((s) => (s.id === editing.id ? optimistic : s)) : [...all, optimistic],
    });
    setOpen(false);

    try {
      await apiRequest(editing ? `/api/subjects/${editing.id}` : "/api/subjects", {
        method: editing ? "PATCH" : "POST",
        body: JSON.stringify({
          ...form,
          hasPractical,
          groupId: form.groupId || null,
          teacherId: form.teacherId || null,
        }),
      });
      toast.push(editing ? "Subject updated" : `${form.name} added`);
      await refresh();
    } catch (err) {
      setData({ subjects: previous });
      toast.push(err instanceof Error ? err.message : "Could not save subject", "error");
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    setBusyDelete(true);
    const all = data?.subjects ?? [];
    setData({ subjects: all.filter((s) => s.id !== deleting.id) });
    try {
      await apiRequest(`/api/subjects/${deleting.id}`, { method: "DELETE" });
      toast.push("Subject removed");
      setDeleting(null);
      await refresh();
    } catch (err) {
      setData({ subjects: all });
      toast.push(err instanceof Error ? err.message : "Could not delete subject", "error");
    } finally {
      setBusyDelete(false);
    }
  }

  return (
    <>
      <PageHeader
        icon="📚"
        title="Subjects"
        subtitle="Practical subjects: Theory 70 + Practical 20 + Internal 10. Non-practical: Theory 90 + Internal 10."
        actions={
          <>
            <Select value={filter} onChange={(e) => setFilter(e.target.value)} className="w-48">
              <option value="">All subjects</option>
              <option value="practical">🔬 Has Practical (70+20+10)</option>
              <option value="theory">📖 Non-Practical (90+10)</option>
              <option value="common">Common subjects</option>
              {groups.data?.groups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.code}
                </option>
              ))}
            </Select>
            <Button onClick={openCreate}>+ New subject</Button>
          </>
        }
      />

      {error ? <ErrorState message={error} onRetry={refresh} /> : null}

      {loading ? (
        <Card>
          <TableSkeleton rows={7} cols={5} />
        </Card>
      ) : subjects.length === 0 ? (
        <EmptyState
          icon="📚"
          title="No subjects found"
          description="Add subjects like English, Physics or Accountancy and configure practical marks."
          action={<Button onClick={openCreate}>Add subject</Button>}
        />
      ) : (
        <Card padded={false}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3 font-semibold">Code</th>
                  <th className="px-3 py-3 font-semibold">Subject</th>
                  <th className="px-3 py-3 font-semibold">Type</th>
                  <th className="px-3 py-3 font-semibold">Mark Breakdown</th>
                  <th className="px-3 py-3 font-semibold">Teacher</th>
                  <th className="px-3 py-3 text-right font-semibold">Marks Entered</th>
                  <th className="px-5 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {subjects.map((subject) => (
                  <tr key={subject.id} className="transition hover:bg-slate-50/70">
                    <td className="px-5 py-3">
                      <span className="rounded-md bg-brand-50 px-2 py-0.5 font-mono text-[11px] font-bold text-brand-700 ring-1 ring-inset ring-brand-200">
                        {subject.code}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <p className="font-medium text-slate-800">{subject.name}</p>
                      {subject.groupCode ? (
                        <p className="text-[11px] text-slate-400">Group {subject.groupCode}</p>
                      ) : null}
                    </td>
                    <td className="px-3 py-3">
                      {subject.hasPractical ? (
                        <Badge tone="green">🔬 Practical (Yes)</Badge>
                      ) : (
                        <Badge tone="slate">📖 Theory (No)</Badge>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      {subject.hasPractical ? (
                        <span className="inline-flex items-center gap-1.5 text-xs text-slate-600">
                          <span className="font-semibold text-slate-800">70</span> Theory +{" "}
                          <span className="font-semibold text-emerald-700">20</span> Prac +{" "}
                          <span className="font-semibold text-brand-700">10</span> Int ={" "}
                          <span className="font-bold text-slate-900">100</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-xs text-slate-600">
                          <span className="font-semibold text-slate-800">90</span> Theory +{" "}
                          <span className="font-semibold text-brand-700">10</span> Int ={" "}
                          <span className="font-bold text-slate-900">100</span>
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-slate-600">{subject.teacherName ?? "—"}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-slate-500">{subject.markCount}</td>
                    <td className="px-5 py-3">
                      <div className="flex justify-end gap-2">
                        <Button variant="secondary" size="sm" onClick={() => openEdit(subject)}>
                          Edit
                        </Button>
                        <Button variant="danger" size="sm" onClick={() => setDeleting(subject)}>
                          Delete
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
        title={editing ? `Edit ${editing.name}` : "New subject"}
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button form="subject-form" type="submit" loading={saving}>
              {editing ? "Save changes" : "Add subject"}
            </Button>
          </>
        }
      >
        <form id="subject-form" onSubmit={save} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Subject code">
              <Input
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                placeholder="PHY"
                required
              />
            </Field>
            <Field label="Subject name">
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Physics"
                required
              />
            </Field>
          </div>

          <Field label="Does this subject have practical?">
            <div className="grid grid-cols-2 gap-3 mt-1">
              <label
                className={`flex cursor-pointer items-center justify-between rounded-xl border p-3.5 transition ${
                  form.hasPractical
                    ? "border-emerald-500 bg-emerald-50/70 ring-2 ring-emerald-200"
                    : "border-slate-200 hover:bg-slate-50"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <input
                    type="radio"
                    name="hasPractical"
                    checked={form.hasPractical}
                    onChange={() => setForm({ ...form, hasPractical: true })}
                    className="h-4 w-4 text-emerald-600 focus:ring-emerald-400"
                  />
                  <div>
                    <span className="text-sm font-semibold text-slate-900">Yes (Practical)</span>
                    <p className="text-xs text-slate-500">Theory: 70 · Practical: 20 · Internal: 10</p>
                  </div>
                </div>
              </label>

              <label
                className={`flex cursor-pointer items-center justify-between rounded-xl border p-3.5 transition ${
                  !form.hasPractical
                    ? "border-brand-500 bg-brand-50/70 ring-2 ring-brand-200"
                    : "border-slate-200 hover:bg-slate-50"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <input
                    type="radio"
                    name="hasPractical"
                    checked={!form.hasPractical}
                    onChange={() => setForm({ ...form, hasPractical: false })}
                    className="h-4 w-4 text-brand-600 focus:ring-brand-400"
                  />
                  <div>
                    <span className="text-sm font-semibold text-slate-900">No (Theory only)</span>
                    <p className="text-xs text-slate-500">Theory: 90 · Internal: 10</p>
                  </div>
                </div>
              </label>
            </div>
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Group code" hint="Leave blank for common subject">
              <Select value={form.groupId} onChange={(e) => setForm({ ...form, groupId: e.target.value })}>
                <option value="">Common subject (all classes)</option>
                {groups.data?.groups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.code} · {group.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Subject teacher">
              <Select value={form.teacherId} onChange={(e) => setForm({ ...form, teacherId: e.target.value })}>
                <option value="">Not assigned</option>
                {teachers.data?.teachers.map((teacher) => (
                  <option key={teacher.id} value={teacher.id}>
                    {teacher.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleting)}
        title={`Delete ${deleting?.name ?? ""}?`}
        message="All marks recorded for this subject will be deleted as well."
        onCancel={() => setDeleting(null)}
        onConfirm={confirmDelete}
        busy={busyDelete}
      />
    </>
  );
}

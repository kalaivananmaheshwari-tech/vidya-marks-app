"use client";

import Link from "next/link";
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
import type { ClassListRow, GroupRow, TeacherRow } from "@/lib/shared-types";
import { ACADEMIC_YEARS, DEFAULT_ACADEMIC_YEAR } from "@/lib/academic";

const STANDARD_CLASSES = [
  "Class 6",
  "Class 7",
  "Class 8",
  "Class 9",
  "Class 10",
  "Class 11",
  "Class 12",
];

const DEFAULT_SUBJECTS_6_TO_10 = [
  "Language",
  "English",
  "Mathematics",
  "Science",
  "Social Science",
  "PET",
  "TNSPARK",
  "Science Tamil",
];

const DEFAULT_HSC_SUBS = [
  "Language (Tamil)",
  "English",
  "Physics",
  "Chemistry",
  "Biology",
  "Mathematics",
];

function isHsc(name: string): boolean {
  const n = name.trim().toLowerCase();
  return (
    n === "11" ||
    n === "12" ||
    /\b(11|12)\b/.test(n) ||
    /\b(xi|xii)\b/.test(n) ||
    n.includes("11") ||
    n.includes("12")
  );
}

const emptyForm = {
  name: "Class 10",
  section: "A",
  groupCode: "2502",
  groupId: "",
  sub1: "Language (Tamil)",
  sub2: "English",
  sub3: "Physics",
  sub4: "Chemistry",
  sub5: "Biology",
  sub6: "Mathematics",
  academicYear: DEFAULT_ACADEMIC_YEAR as string,
  room: "",
  classTeacherId: "",
};

export default function ClassesPage() {
  const toast = useToast();
  const { data, loading, error, refresh, setData } = useApi<{ classes: ClassListRow[] }>("/api/classes");
  const groups = useApi<{ groups: GroupRow[] }>("/api/groups");
  const teachers = useApi<{ teachers: TeacherRow[] }>("/api/teachers");

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ClassListRow | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<ClassListRow | null>(null);
  const [busyDelete, setBusyDelete] = useState(false);

  const classes = data?.classes ?? [];

  const isClass11or12 = useMemo(() => isHsc(form.name), [form.name]);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  }

  function openEdit(row: ClassListRow) {
    setEditing(row);
    setForm({
      name: row.name,
      section: row.section,
      groupCode: row.groupCode ?? "2502",
      groupId: row.groupId ? String(row.groupId) : "",
      sub1: DEFAULT_HSC_SUBS[0],
      sub2: DEFAULT_HSC_SUBS[1],
      sub3: DEFAULT_HSC_SUBS[2],
      sub4: DEFAULT_HSC_SUBS[3],
      sub5: DEFAULT_HSC_SUBS[4],
      sub6: DEFAULT_HSC_SUBS[5],
      academicYear: row.academicYear,
      room: row.room ?? "",
      classTeacherId: row.classTeacherId ? String(row.classTeacherId) : "",
    });
    setOpen(true);
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    const previous = classes;
    const group = isClass11or12
      ? groups.data?.groups.find((g) => g.code === form.groupCode || String(g.id) === form.groupId) ?? null
      : null;
    const teacher = teachers.data?.teachers.find((t) => String(t.id) === form.classTeacherId) ?? null;

    const optimistic: ClassListRow = {
      id: editing?.id ?? -Date.now(),
      name: form.name,
      section: form.section.toUpperCase(),
      groupId: group?.id ?? null,
      groupCode: isClass11or12 ? (group?.code ?? form.groupCode) : null,
      groupName: isClass11or12 ? (group?.name ?? `Group ${form.groupCode}`) : null,
      stream: isClass11or12 ? (group?.stream ?? "Science") : null,
      academicYear: form.academicYear,
      room: form.room || null,
      classTeacherId: teacher?.id ?? null,
      classTeacher: teacher?.name ?? null,
      studentCount: editing?.studentCount ?? 0,
    };

    setData({
      classes: editing
        ? classes.map((c) => (c.id === editing.id ? optimistic : c))
        : [...classes, optimistic],
    });
    setOpen(false);

    try {
      await apiRequest(editing ? `/api/classes/${editing.id}` : "/api/classes", {
        method: editing ? "PATCH" : "POST",
        body: JSON.stringify({
          name: form.name,
          section: form.section,
          academicYear: form.academicYear,
          room: form.room || null,
          classTeacherId: form.classTeacherId || null,
          groupCode: isClass11or12 ? form.groupCode : null,
          groupId: isClass11or12 ? (form.groupId || null) : null,
          subjects: isClass11or12
            ? [form.sub1, form.sub2, form.sub3, form.sub4, form.sub5, form.sub6]
            : undefined,
        }),
      });
      toast.push(editing ? "Class updated" : `${form.name} - ${form.section} created`);
      await refresh();
    } catch (err) {
      setData({ classes: previous });
      toast.push(err instanceof Error ? err.message : "Could not save class", "error");
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    setBusyDelete(true);
    const previous = classes;
    setData({ classes: classes.filter((c) => c.id !== deleting.id) });
    try {
      await apiRequest(`/api/classes/${deleting.id}`, { method: "DELETE" });
      toast.push("Class removed");
      setDeleting(null);
      await refresh();
    } catch (err) {
      setData({ classes: previous });
      toast.push(err instanceof Error ? err.message : "Could not delete class", "error");
    } finally {
      setBusyDelete(false);
    }
  }

  return (
    <>
      <PageHeader
        icon="🏫"
        title="Classes & sections"
        subtitle="Classes 11 & 12 use Group Code with 6 subjects. Classes 6 to 10 have Group Code disabled and use standard default subjects."
        actions={<Button onClick={openCreate}>+ New class</Button>}
      />

      {error ? <ErrorState message={error} onRetry={refresh} /> : null}

      {loading ? (
        <Card>
          <TableSkeleton rows={6} cols={5} />
        </Card>
      ) : classes.length === 0 ? (
        <EmptyState
          icon="🏫"
          title="No classes configured"
          description="Add a class such as Class 10 - A (standard subjects) or Class 11 - A (with Group Code and 6 subjects)."
          action={<Button onClick={openCreate}>Create first class</Button>}
        />
      ) : (
        <Card padded={false}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3 font-semibold">Class & Section</th>
                  <th className="px-3 py-3 font-semibold">Group Code</th>
                  <th className="px-3 py-3 font-semibold">Class Teacher</th>
                  <th className="px-3 py-3 font-semibold">Room</th>
                  <th className="px-3 py-3 text-right font-semibold">Students</th>
                  <th className="px-5 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {classes.map((row) => {
                  const hsc = isHsc(row.name);
                  return (
                    <tr key={row.id} className="transition hover:bg-slate-50/70">
                      <td className="px-5 py-3">
                        <p className="font-semibold text-slate-900">
                          {row.name} <span className="text-slate-400">·</span> Section {row.section}
                        </p>
                        <p className="text-xs text-slate-400">{row.academicYear}</p>
                      </td>
                      <td className="px-3 py-3">
                        {hsc ? (
                          row.groupCode ? (
                            <div className="flex items-center gap-1.5">
                              <span className="rounded-md bg-slate-900 px-2 py-0.5 font-mono text-[11px] font-bold text-white">
                                {row.groupCode}
                              </span>
                              <Badge tone="sky">11/12 Group</Badge>
                            </div>
                          ) : (
                            <Badge tone="amber">Group Pending</Badge>
                          )
                        ) : (
                          <Badge tone="slate">Disabled (Classes 6-10)</Badge>
                        )}
                      </td>
                      <td className="px-3 py-3 text-slate-600">{row.classTeacher ?? "—"}</td>
                      <td className="px-3 py-3 text-slate-500">{row.room ?? "—"}</td>
                      <td className="px-3 py-3 text-right font-semibold tabular-nums text-slate-800">
                        {row.studentCount}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex justify-end gap-1.5">
                          <Link href={`/reports?classId=${row.id}`}>
                            <Button variant="secondary" size="sm">
                              📑 Report
                            </Button>
                          </Link>
                          <Link href={`/mark-assign?classId=${row.id}`}>
                            <Button variant="ghost" size="sm">
                              ⚖️ Marks
                            </Button>
                          </Link>
                          <Link href={`/students?classId=${row.id}`}>
                            <Button variant="ghost" size="sm">
                              Roster
                            </Button>
                          </Link>
                          <Button variant="ghost" size="sm" onClick={() => openEdit(row)}>
                            Edit
                          </Button>
                          <Button variant="danger" size="sm" onClick={() => setDeleting(row)}>
                            ✕
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Modal for Creating or Editing Class */}
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? `Edit ${editing.name} - Section ${editing.section}` : "New class & section"}
        description="For Classes 11 & 12, enter the Group Code and 6 subjects. For Classes 6 to 10, Group Code is disabled and default subjects are auto-assigned."
        width="max-w-2xl"
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button form="class-form" type="submit" loading={saving}>
              {editing ? "Save changes" : "Create class"}
            </Button>
          </>
        }
      >
        <form id="class-form" onSubmit={save} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name of the class">
              <div className="space-y-1.5">
                <Select
                  value={STANDARD_CLASSES.includes(form.name) ? form.name : "custom"}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val !== "custom") setForm({ ...form, name: val });
                  }}
                >
                  {STANDARD_CLASSES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                  <option value="custom">Custom name...</option>
                </Select>
                {!STANDARD_CLASSES.includes(form.name) ? (
                  <Input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="e.g. Class 11"
                    required
                  />
                ) : null}
              </div>
            </Field>

            <Field label="Section">
              <Input
                value={form.section}
                onChange={(e) => setForm({ ...form, section: e.target.value.toUpperCase() })}
                placeholder="A"
                maxLength={3}
                required
              />
            </Field>
          </div>

          {/* Conditional rendering based on 11/12 vs 6 to 10 */}
          {isClass11or12 ? (
            <div className="rounded-2xl border border-sky-200 bg-sky-50/60 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-semibold text-sky-950">
                    🎯 Class 11 & 12: Group Code & 6 Subjects
                  </h4>
                  <p className="text-xs text-sky-800">
                    Enter the Group Code and customize Subject 1 to Subject 6.
                  </p>
                </div>
                <Badge tone="sky">Classes 11 & 12 Active</Badge>
              </div>

              <Field label="Group code (User enters Group Code)" hint="e.g. 2502, 2503, Bio-Maths, CS">
                <Input
                  value={form.groupCode}
                  onChange={(e) => setForm({ ...form, groupCode: e.target.value.toUpperCase() })}
                  placeholder="2502"
                  className="font-mono font-bold"
                  required
                />
              </Field>

              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-600">
                  Sub 1 to Sub 6 (User enters the 6 subjects)
                </label>
                <div className="grid gap-2.5 sm:grid-cols-2">
                  <Field label="Sub 1">
                    <Input
                      value={form.sub1}
                      onChange={(e) => setForm({ ...form, sub1: e.target.value })}
                      placeholder="Language (Tamil)"
                      required
                    />
                  </Field>
                  <Field label="Sub 2">
                    <Input
                      value={form.sub2}
                      onChange={(e) => setForm({ ...form, sub2: e.target.value })}
                      placeholder="English"
                      required
                    />
                  </Field>
                  <Field label="Sub 3">
                    <Input
                      value={form.sub3}
                      onChange={(e) => setForm({ ...form, sub3: e.target.value })}
                      placeholder="Physics"
                      required
                    />
                  </Field>
                  <Field label="Sub 4">
                    <Input
                      value={form.sub4}
                      onChange={(e) => setForm({ ...form, sub4: e.target.value })}
                      placeholder="Chemistry"
                      required
                    />
                  </Field>
                  <Field label="Sub 5">
                    <Input
                      value={form.sub5}
                      onChange={(e) => setForm({ ...form, sub5: e.target.value })}
                      placeholder="Biology / Computer Science"
                      required
                    />
                  </Field>
                  <Field label="Sub 6">
                    <Input
                      value={form.sub6}
                      onChange={(e) => setForm({ ...form, sub6: e.target.value })}
                      placeholder="Mathematics"
                      required
                    />
                  </Field>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-semibold text-slate-800">
                    📘 Class 6 to 10: Standard Curriculum
                  </h4>
                  <p className="text-xs text-slate-500">
                    Group code is disabled for Classes 6 to 10. Automatically sets default subjects:
                  </p>
                </div>
                <Badge tone="slate">Group Code Disabled</Badge>
              </div>

              <div className="flex flex-wrap gap-1.5 pt-1">
                {DEFAULT_SUBJECTS_6_TO_10.map((sub, idx) => (
                  <span
                    key={sub}
                    className="inline-flex items-center gap-1 rounded-lg bg-white px-2.5 py-1 text-xs font-medium text-slate-700 shadow-sm border border-slate-200"
                  >
                    <span className="font-semibold text-brand-600">{idx + 1}.</span> {sub}
                  </span>
                ))}
              </div>
              <p className="text-[11px] text-slate-400">
                You can configure practical vs non-practical theory/internal marks anytime in <strong>Mark Assign</strong>.
              </p>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Academic year">
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

            <Field label="Class teacher">
              <Select
                value={form.classTeacherId}
                onChange={(e) => setForm({ ...form, classTeacherId: e.target.value })}
              >
                <option value="">Not assigned</option>
                {teachers.data?.teachers.map((teacher) => (
                  <option key={teacher.id} value={teacher.id}>
                    {teacher.name}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Room / Block">
              <Input
                value={form.room}
                onChange={(e) => setForm({ ...form, room: e.target.value })}
                placeholder="Block B - 201"
              />
            </Field>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleting)}
        title={`Delete ${deleting?.name ?? ""} - Section ${deleting?.section ?? ""}?`}
        message="All students in this class and their marks will be permanently deleted."
        onCancel={() => setDeleting(null)}
        onConfirm={confirmDelete}
        busy={busyDelete}
      />
    </>
  );
}

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
import type { SubjectRow, TeacherRow } from "@/lib/shared-types";

type Me = {
  user: { id: number; name: string; role: string; schoolId: number } | null;
};

type SchoolInfo = { school: { name: string; udiseCode: string } | null };

/** Exact designations from handwritten academic notes */
const COMBO_DESIGNATIONS = [
  "PG Assistant",
  "BT Assistant",
  "Computer Instructor Gr-I",
  "Computer Instructor Gr-II",
  "Physical Director",
  "Sec. Gr. Asst",
  "PET",
  "Special Teacher",
  "Principal / Headmaster",
];

function randomPassword() {
  const words = ["Vidya", "Shiksha", "Gyan", "Vidhya", "Pathshala", "Guru"];
  const word = words[Math.floor(Math.random() * words.length)];
  return `${word}@${Math.floor(1000 + Math.random() * 8999)}`;
}

function slugify(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .trim()
    .split(/\s+/)[0]
    ?.slice(0, 12) ?? "";
}

const emptyForm = {
  name: "",
  username: "",
  password: "",
  designation: "PG Assistant",
  customDesignation: "",
  handlingSubjects: "",
  email: "",
  phone: "",
};

export default function StaffPage() {
  const toast = useToast();
  const me = useApi<Me>("/api/auth/me");
  const schoolInfo = useApi<SchoolInfo>("/api/auth/me");
  const { data, loading, error, refresh, setData } = useApi<{ teachers: TeacherRow[] }>("/api/teachers");
  const subjectsData = useApi<{ subjects: SubjectRow[] }>("/api/subjects");

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<TeacherRow | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<TeacherRow | null>(null);
  const [busyDelete, setBusyDelete] = useState(false);
  const [credentials, setCredentials] = useState<{ name: string; username: string; password: string } | null>(
    null,
  );
  const [resetTarget, setResetTarget] = useState<TeacherRow | null>(null);
  const [resetPassword, setResetPassword] = useState("");
  const [resetting, setResetting] = useState(false);

  const isAdmin = me.data?.user?.role === "admin";
  const udise = schoolInfo.data?.school?.udiseCode ?? "";
  const staff = data?.teachers ?? [];
  const admins = useMemo(() => staff.filter((t) => t.role === "admin"), [staff]);
  const teachers = useMemo(() => staff.filter((t) => t.role !== "admin"), [staff]);

  /** 1) Handling subjects uniquely taken from classes & sections */
  const uniqueClassSubjects = useMemo(() => {
    const set = new Set<string>();
    (subjectsData.data?.subjects ?? []).forEach((s) => {
      const trimmed = s.name.trim();
      if (trimmed) set.add(trimmed);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [subjectsData.data]);

  const selectedSubjectsList = useMemo(() => {
    return form.handlingSubjects
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }, [form.handlingSubjects]);

  function toggleSubject(subName: string) {
    const current = form.handlingSubjects
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const exists = current.includes(subName);
    const next = exists ? current.filter((s) => s !== subName) : [...current, subName];
    setForm((prev) => ({ ...prev, handlingSubjects: next.join(", ") }));
  }

  function openCreate() {
    setEditing(null);
    setForm({
      ...emptyForm,
      designation: "PG Assistant",
      password: randomPassword(),
    });
    setOpen(true);
  }

  function openEdit(teacher: TeacherRow) {
    setEditing(teacher);
    const isStandard = COMBO_DESIGNATIONS.includes(teacher.designation ?? "");
    setForm({
      name: teacher.name,
      username: teacher.username,
      password: "",
      designation: isStandard ? (teacher.designation ?? "PG Assistant") : "Other",
      customDesignation: isStandard ? "" : (teacher.designation ?? ""),
      handlingSubjects: teacher.handlingSubjects ?? "",
      email: teacher.email ?? "",
      phone: teacher.phone ?? "",
    });
    setOpen(true);
  }

  function onNameChange(value: string) {
    setForm((prev) => {
      const suggested = udise && slugify(value) ? `${udise}.${slugify(value)}` : prev.username;
      const shouldAutofill =
        !editing && (prev.username === "" || prev.username === `${udise}.${slugify(prev.name)}`);
      return { ...prev, name: value, username: shouldAutofill ? suggested : prev.username };
    });
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    const previous = staff;
    const finalDesignation =
      form.designation === "Other"
        ? form.customDesignation.trim() || "Staff Member"
        : form.designation;

    try {
      if (editing) {
        await apiRequest(`/api/teachers/${editing.id}`, {
          method: "PATCH",
          body: JSON.stringify({
            name: form.name,
            designation: finalDesignation,
            handlingSubjects: form.handlingSubjects,
            email: form.email,
            phone: form.phone,
          }),
        });
        toast.push("Teacher profile updated");
      } else {
        await apiRequest("/api/teachers", {
          method: "POST",
          body: JSON.stringify({
            ...form,
            designation: finalDesignation,
          }),
        });
        setCredentials({ name: form.name, username: form.username, password: form.password });
      }
      setOpen(false);
      await refresh();
    } catch (err) {
      setData({ teachers: previous });
      toast.push(err instanceof Error ? err.message : "Could not save teacher", "error");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(teacher: TeacherRow) {
    const previous = staff;
    setData({ teachers: staff.map((t) => (t.id === teacher.id ? { ...t, isActive: !t.isActive } : t)) });
    try {
      await apiRequest(`/api/teachers/${teacher.id}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: !teacher.isActive }),
      });
      toast.push(teacher.isActive ? "Login disabled" : "Login re-enabled");
    } catch (err) {
      setData({ teachers: previous });
      toast.push(err instanceof Error ? err.message : "Could not update", "error");
    }
  }

  async function doResetPassword() {
    if (!resetTarget) return;
    setResetting(true);
    try {
      await apiRequest(`/api/teachers/${resetTarget.id}`, {
        method: "PATCH",
        body: JSON.stringify({ password: resetPassword }),
      });
      setCredentials({
        name: resetTarget.name,
        username: resetTarget.username,
        password: resetPassword,
      });
      setResetTarget(null);
    } catch (err) {
      toast.push(err instanceof Error ? err.message : "Could not reset password", "error");
    } finally {
      setResetting(false);
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    setBusyDelete(true);
    const previous = staff;
    setData({ teachers: staff.filter((t) => t.id !== deleting.id) });
    try {
      await apiRequest(`/api/teachers/${deleting.id}`, { method: "DELETE" });
      toast.push("Teacher login removed");
      setDeleting(null);
      await refresh();
    } catch (err) {
      setData({ teachers: previous });
      toast.push(err instanceof Error ? err.message : "Could not remove teacher", "error");
    } finally {
      setBusyDelete(false);
    }
  }

  function renderCard(teacher: TeacherRow) {
    const admin = teacher.role === "admin";
    const handlingList = teacher.handlingSubjects
      ? teacher.handlingSubjects.split(",").map((s) => s.trim()).filter(Boolean)
      : [];

    return (
      <Card key={teacher.id} className="flex flex-col justify-between">
        <div>
          <div className="flex items-start gap-3">
            <span
              className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br text-sm font-bold text-white ${
                admin ? "from-brand-500 to-violet-500" : "from-emerald-500 to-teal-500"
              }`}
            >
              {teacher.name
                .split(" ")
                .slice(0, 2)
                .map((p) => p[0])
                .join("")
                .toUpperCase()}
            </span>
            <div className="min-w-0 flex-1">
              <h3 className="truncate text-sm font-semibold text-slate-900">{teacher.name}</h3>
              <p className="truncate font-mono text-[11px] text-brand-600">@{teacher.username}</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                <Badge tone={admin ? "brand" : "slate"}>
                  {admin ? "Admin (UDISE login)" : "Teacher"}
                </Badge>
                <Badge tone={teacher.isActive ? "green" : "rose"}>
                  {teacher.isActive ? "Active" : "Disabled"}
                </Badge>
              </div>
            </div>
          </div>

          <div className="mt-3 flex items-center gap-1.5 text-xs text-slate-600">
            <span className="font-semibold text-slate-800">Designation:</span>
            <span className="rounded bg-slate-100 px-2 py-0.5 font-medium text-slate-700">
              {teacher.designation ?? "Staff Member"}
            </span>
          </div>

          {/* Handling Subjects display */}
          <div className="mt-2.5 rounded-xl border border-slate-100 bg-slate-50/70 p-2.5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              📚 Handling Subjects:
            </p>
            {handlingList.length > 0 ? (
              <div className="mt-1.5 flex flex-wrap gap-1">
                {handlingList.map((sub) => (
                  <Badge key={sub} tone="brand">
                    {sub}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="mt-1 text-xs italic text-slate-400">No subjects assigned yet</p>
            )}
          </div>

          <div className="mt-3 grid grid-cols-3 gap-2 rounded-xl bg-slate-50 p-2.5 text-center">
            <div>
              <p className="text-base font-bold text-slate-800">{teacher.classCount}</p>
              <p className="text-[10px] uppercase tracking-wide text-slate-500">Classes</p>
            </div>
            <div>
              <p className="text-base font-bold text-slate-800">{teacher.subjectCount}</p>
              <p className="text-[10px] uppercase tracking-wide text-slate-500">Mapped</p>
            </div>
            <div>
              <p className="text-base font-bold text-slate-800">
                {teacher.lastLoginAt ? "✓" : "—"}
              </p>
              <p className="text-[10px] uppercase tracking-wide text-slate-500">Logged in</p>
            </div>
          </div>
        </div>

        {isAdmin ? (
          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" className="flex-1" onClick={() => openEdit(teacher)}>
              Edit
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setResetTarget(teacher);
                setResetPassword(randomPassword());
              }}
            >
              🔑 Reset
            </Button>
            {!admin ? (
              <>
                <Button variant="ghost" size="sm" onClick={() => toggleActive(teacher)}>
                  {teacher.isActive ? "Disable" : "Enable"}
                </Button>
                <Button variant="danger" size="sm" onClick={() => setDeleting(teacher)}>
                  ✕
                </Button>
              </>
            ) : null}
          </div>
        ) : (
          <p className="mt-4 text-xs text-slate-400">{teacher.phone ?? ""}</p>
        )}
      </Card>
    );
  }

  return (
    <>
      <PageHeader
        icon="👩‍🏫"
        title="Teachers & Staff"
        subtitle="Manage teachers: Name of the teacher, Handling subjects (from classes & sections), and Designation (Combo box)."
        actions={
          isAdmin ? (
            <Button onClick={openCreate}>+ Add teacher</Button>
          ) : (
            <Badge tone="slate">Read-only · admin access required</Badge>
          )
        }
      />

      {isAdmin ? (
        <Card className="border-brand-200 bg-gradient-to-br from-brand-50 to-violet-50">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Add Teacher Setup</h2>
              <p className="mt-1 text-sm text-slate-600">
                • <strong>Handling subjects:</strong> Click and pick from subjects uniquely created across your classes &amp; sections.
                <br />
                • <strong>Designation:</strong> Select from the official designation combo box (PG Assistant, BT Assistant, Computer Instructor, etc.).
              </p>
            </div>
          </div>
        </Card>
      ) : null}

      {error ? <ErrorState message={error} onRetry={refresh} /> : null}

      {loading ? (
        <Card>
          <TableSkeleton rows={6} cols={4} />
        </Card>
      ) : (
        <>
          <section>
            <h2 className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-400">
              School admin (Principal / Headmaster)
            </h2>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{admins.map(renderCard)}</div>
          </section>

          <section>
            <h2 className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-400">
              Teachers ({teachers.length})
            </h2>
            {teachers.length === 0 ? (
              <EmptyState
                icon="👩‍🏫"
                title="No teacher accounts created yet"
                description="Add teachers, set their designation and select their handling subjects from classes & sections."
                action={isAdmin ? <Button onClick={openCreate}>Add first teacher</Button> : undefined}
              />
            ) : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{teachers.map(renderCard)}</div>
            )}
          </section>
        </>
      )}

      {/* Add / Edit Teacher Modal */}
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? `Edit ${editing.name}` : "Add teacher"}
        description="Fill in the teacher's details. Select handling subjects from unique subjects in classes & sections."
        width="max-w-2xl"
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button form="staff-form" type="submit" loading={saving}>
              {editing ? "Save changes" : "Create teacher"}
            </Button>
          </>
        }
      >
        <form id="staff-form" onSubmit={save} className="space-y-4">
          <Field label="Name of the teacher">
            <Input
              value={form.name}
              onChange={(e) => onNameChange(e.target.value)}
              placeholder="e.g. Ramesh Iyer"
              required
            />
          </Field>

          {/* 1) Designation - Combo box with exact options */}
          <div className="space-y-2">
            <Field label="Designation (Combo box)">
              <Select
                value={form.designation}
                onChange={(e) => setForm({ ...form, designation: e.target.value })}
                required
              >
                {COMBO_DESIGNATIONS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
                <option value="Other">Other / Custom...</option>
              </Select>
            </Field>
            {form.designation === "Other" ? (
              <Field label="Specify custom designation">
                <Input
                  value={form.customDesignation}
                  onChange={(e) => setForm({ ...form, customDesignation: e.target.value })}
                  placeholder="e.g. Assistant Professor, Lab Instructor"
                  required
                />
              </Field>
            ) : null}
          </div>

          {/* 1) Handling subjects uniquely taken from classes & sections */}
          <div className="space-y-2 rounded-2xl border border-brand-100 bg-brand-50/40 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="text-xs font-bold uppercase tracking-wide text-brand-900">
                📚 Handling subjects (uniquely taken from classes &amp; sections)
              </label>
              <span className="text-[11px] font-semibold text-brand-700">
                {uniqueClassSubjects.length} unique subject{uniqueClassSubjects.length === 1 ? "" : "s"} in school
              </span>
            </div>

            <p className="text-xs text-slate-600">
              Click any subject below to select or unselect it for this teacher:
            </p>

            {uniqueClassSubjects.length > 0 ? (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {uniqueClassSubjects.map((subName) => {
                  const isSelected = selectedSubjectsList.includes(subName);
                  return (
                    <button
                      key={subName}
                      type="button"
                      onClick={() => toggleSubject(subName)}
                      className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition cursor-pointer ${
                        isSelected
                          ? "bg-brand-600 text-white shadow-sm ring-1 ring-brand-700"
                          : "border border-slate-200 bg-white text-slate-700 hover:border-brand-300 hover:bg-brand-50/50"
                      }`}
                    >
                      <span>{isSelected ? "✓" : "+"}</span>
                      <span>{subName}</span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs italic text-slate-400">
                No subjects created in classes &amp; sections yet. Setup classes &amp; sections first, or type subjects below.
              </p>
            )}

            <div className="pt-2">
              <Field
                label="Selected handling subjects list"
                hint="Auto-updated as you click subjects above. You can also edit or add custom subjects directly."
              >
                <Input
                  value={form.handlingSubjects}
                  onChange={(e) => setForm({ ...form, handlingSubjects: e.target.value })}
                  placeholder="e.g. Mathematics, Science, PET"
                />
              </Field>
            </div>
          </div>

          {!editing ? (
            <>
              <Field label="Login username" hint="Auto-suggested or customize">
                <Input
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value.toLowerCase() })}
                  placeholder={`${udise || "udise"}.ramesh`}
                  className="font-mono"
                  required
                />
              </Field>
              <Field label="Password" hint="Share this with the teacher; can be reset anytime">
                <div className="flex gap-2">
                  <Input
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    className="font-mono"
                    required
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setForm({ ...form, password: randomPassword() })}
                  >
                    🎲
                  </Button>
                </div>
              </Field>
            </>
          ) : (
            <Field label="Login username">
              <Input value={form.username} readOnly disabled className="font-mono bg-slate-50" />
            </Field>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Phone number">
              <Input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="+91 98400 00000"
              />
            </Field>
            <Field label="Email address (optional)">
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="teacher@school.edu"
              />
            </Field>
          </div>
        </form>
      </Modal>

      {/* reset password */}
      <Modal
        open={Boolean(resetTarget)}
        onClose={() => setResetTarget(null)}
        title={`Reset password for ${resetTarget?.name ?? ""}`}
        description="The old password stops working immediately."
        width="max-w-md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setResetTarget(null)}>
              Cancel
            </Button>
            <Button onClick={doResetPassword} loading={resetting}>
              Set new password
            </Button>
          </>
        }
      >
        <Field label="New password" hint="Minimum 6 characters">
          <div className="flex gap-2">
            <Input
              value={resetPassword}
              onChange={(e) => setResetPassword(e.target.value)}
              className="font-mono"
            />
            <Button type="button" variant="secondary" onClick={() => setResetPassword(randomPassword())}>
              🎲
            </Button>
          </div>
        </Field>
      </Modal>

      {/* credential handoff */}
      <Modal
        open={Boolean(credentials)}
        onClose={() => {
          setCredentials(null);
          void refresh();
        }}
        title="✅ Teacher login ready"
        description="Share these login credentials with the teacher."
        width="max-w-md"
        footer={
          <Button
            onClick={() => {
              setCredentials(null);
              void refresh();
            }}
          >
            Done
          </Button>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-slate-600">
            Give <strong>{credentials?.name}</strong> these credentials to sign in:
          </p>
          <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Username</p>
              <p className="font-mono text-sm font-semibold text-slate-900">{credentials?.username}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Password</p>
              <p className="font-mono text-sm font-semibold text-slate-900">{credentials?.password}</p>
            </div>
          </div>
          <Button
            variant="secondary"
            className="w-full"
            onClick={() => {
              void navigator.clipboard
                ?.writeText(`Username: ${credentials?.username}\nPassword: ${credentials?.password}`)
                .then(() => toast.push("Credentials copied to clipboard"))
                .catch(() => toast.push("Copy failed — note them manually", "error"));
            }}
          >
            📋 Copy credentials
          </Button>
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleting)}
        title={`Remove ${deleting?.name ?? ""}?`}
        message="Their login stops working. Classes and subjects they were assigned to will be left without a teacher."
        onCancel={() => setDeleting(null)}
        onConfirm={confirmDelete}
        busy={busyDelete}
      />
    </>
  );
}

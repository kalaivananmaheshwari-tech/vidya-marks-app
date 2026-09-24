"use client";

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
  TableSkeleton,
  useToast,
} from "@/components/ui";
import { apiRequest, useApi } from "@/lib/client";
import type { GroupRow } from "@/lib/shared-types";

const STREAMS = ["General", "Science", "Commerce", "Arts", "Vocational"];

const emptyForm = { code: "", name: "", stream: "Science", description: "" };

export default function GroupsPage() {
  const toast = useToast();
  const { data, loading, error, refresh, setData } = useApi<{ groups: GroupRow[] }>("/api/groups");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<GroupRow | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<GroupRow | null>(null);
  const [busyDelete, setBusyDelete] = useState(false);

  const groups = data?.groups ?? [];

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setModalOpen(true);
  }

  function openEdit(group: GroupRow) {
    setEditing(group);
    setForm({
      code: group.code,
      name: group.name,
      stream: group.stream,
      description: group.description ?? "",
    });
    setModalOpen(true);
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    const payload = { ...form, code: form.code.toUpperCase().trim() };

    // optimistic
    const previous = groups;
    if (editing) {
      setData({ groups: groups.map((g) => (g.id === editing.id ? { ...g, ...payload } : g)) });
    } else {
      setData({
        groups: [
          ...groups,
          {
            id: -Date.now(),
            ...payload,
            classCount: 0,
            subjectCount: 0,
            studentCount: 0,
          } as GroupRow,
        ],
      });
    }
    setModalOpen(false);

    try {
      await apiRequest(editing ? `/api/groups/${editing.id}` : "/api/groups", {
        method: editing ? "PATCH" : "POST",
        body: JSON.stringify(payload),
      });
      toast.push(editing ? "Group code updated" : `Group code ${payload.code} created`);
      await refresh();
    } catch (err) {
      setData({ groups: previous });
      toast.push(err instanceof Error ? err.message : "Could not save group", "error");
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    setBusyDelete(true);
    const previous = groups;
    setData({ groups: groups.filter((g) => g.id !== deleting.id) });
    try {
      await apiRequest(`/api/groups/${deleting.id}`, { method: "DELETE" });
      toast.push(`Group ${deleting.code} removed`);
      setDeleting(null);
      await refresh();
    } catch (err) {
      setData({ groups: previous });
      toast.push(err instanceof Error ? err.message : "Could not delete group", "error");
    } finally {
      setBusyDelete(false);
    }
  }

  return (
    <>
      <PageHeader
        icon="🧩"
        title="Group codes"
        subtitle="Streams and subject bundles that classes are mapped to"
        actions={<Button onClick={openCreate}>+ New group code</Button>}
      />

      {error ? <ErrorState message={error} onRetry={refresh} /> : null}

      {loading ? (
        <Card>
          <TableSkeleton rows={5} cols={4} />
        </Card>
      ) : groups.length === 0 ? (
        <EmptyState
          icon="🧩"
          title="No group codes yet"
          description="Create codes such as G101 (Bio-Maths) or G201 (Commerce) to bundle subjects for higher secondary classes."
          action={<Button onClick={openCreate}>Create first group code</Button>}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {groups.map((group) => (
            <Card key={group.id} className="flex flex-col justify-between transition hover:-translate-y-0.5 hover:shadow-lg">
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="rounded-lg bg-slate-900 px-2 py-1 font-mono text-xs font-bold text-white">
                        {group.code}
                      </span>
                      <Badge tone={group.stream === "Science" ? "sky" : group.stream === "Commerce" ? "amber" : "brand"}>
                        {group.stream}
                      </Badge>
                    </div>
                    <h3 className="mt-2 text-base font-semibold text-slate-900">{group.name}</h3>
                  </div>
                </div>
                <p className="mt-2 line-clamp-3 text-sm text-slate-500">
                  {group.description || "No description provided."}
                </p>
              </div>

              <div className="mt-4">
                <div className="grid grid-cols-3 gap-2 rounded-xl bg-slate-50 p-2.5 text-center">
                  {[
                    { label: "Classes", value: group.classCount },
                    { label: "Subjects", value: group.subjectCount },
                    { label: "Students", value: group.studentCount },
                  ].map((stat) => (
                    <div key={stat.label}>
                      <p className="text-base font-bold text-slate-800">{stat.value}</p>
                      <p className="text-[10px] uppercase tracking-wide text-slate-500">{stat.label}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex gap-2">
                  <Button variant="secondary" size="sm" className="flex-1" onClick={() => openEdit(group)}>
                    Edit
                  </Button>
                  <Button variant="danger" size="sm" onClick={() => setDeleting(group)}>
                    Delete
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? `Edit ${editing.code}` : "New group code"}
        description="Group codes drive which subjects a class studies."
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button form="group-form" type="submit" loading={saving}>
              {editing ? "Save changes" : "Create group"}
            </Button>
          </>
        }
      >
        <form id="group-form" onSubmit={save} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Group code" hint="e.g. G101, G201, GEN">
              <Input
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                placeholder="G101"
                required
              />
            </Field>
            <Field label="Stream">
              <Select value={form.stream} onChange={(e) => setForm({ ...form, stream: e.target.value })}>
                {STREAMS.map((stream) => (
                  <option key={stream}>{stream}</option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label="Group name">
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Bio-Maths Group"
              required
            />
          </Field>
          <Field label="Description">
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={3}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
              placeholder="Physics, Chemistry, Biology and Mathematics"
            />
          </Field>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleting)}
        title={`Delete group ${deleting?.code ?? ""}?`}
        message="Subjects linked to this group will also be removed, along with their marks. Classes will be reset to no group."
        onCancel={() => setDeleting(null)}
        onConfirm={confirmDelete}
        busy={busyDelete}
      />
    </>
  );
}

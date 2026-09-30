"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button, Card, Field, Input, Select } from "@/components/ui";
import { apiRequest } from "@/lib/client";

type AdminAccount = {
  username: string;
  schoolName: string;
  adminName: string;
  designation: string;
  phoneMasked: string;
  hasPhone: boolean;
};

const DESIGNATIONS = ["Principal", "Headmaster", "Headmistress", "Correspondent"];

/**
 * "Forgot password / change admin details" — opened from the sign-in page.
 * The admin username (school UDISE code) is picked from a list box and can
 * never be edited; the school's registered details are shown in the form.
 * Identity is verified with the registered phone number before the admin
 * name / phone / password can be updated (e.g. a new Headmaster takes charge).
 */
export default function RecoverForm() {
  const [accounts, setAccounts] = useState<AdminAccount[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [username, setUsername] = useState("");
  const [adminName, setAdminName] = useState("");
  const [designation, setDesignation] = useState("Principal");
  const [verifyPhone, setVerifyPhone] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const selected = accounts.find((a) => a.username === username) ?? null;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await apiRequest<{ admins: AdminAccount[] }>("/api/auth/admin-list");
        if (!cancelled) setAccounts(data.admins ?? []);
      } catch (err) {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : "Could not load admin accounts");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function pickAccount(value: string) {
    setUsername(value);
    setError(null);
    setSuccess(null);
    const acct = accounts.find((a) => a.username === value);
    setAdminName(acct?.adminName ?? "");
    setDesignation(acct?.designation ?? "Principal");
    setVerifyPhone("");
    setNewPhone("");
    setNewPassword("");
    setConfirmPassword("");
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    if (!username) return setError("Select your username (school UDISE code) first.");
    if (!adminName.trim()) return setError("Admin name is required.");
    if (!verifyPhone.trim()) return setError("Enter the registered phone number to verify your identity.");
    if (newPassword && newPassword.length < 6) {
      return setError("New password must be at least 6 characters.");
    }
    if (newPassword && newPassword !== confirmPassword) {
      return setError("New passwords do not match.");
    }

    setLoading(true);
    try {
      const data = await apiRequest<{ ok: boolean; message: string }>("/api/auth/admin-recover", {
        method: "POST",
        body: JSON.stringify({
          username,
          phone: verifyPhone,
          adminName,
          designation,
          newPhone: newPhone || undefined,
          newPassword: newPassword || undefined,
          confirmPassword: confirmPassword || undefined,
        }),
      });
      setSuccess(data.message);
      setVerifyPhone("");
      setNewPhone("");
      setNewPassword("");
      setConfirmPassword("");
      // Refresh the list so the displayed admin name stays current.
      try {
        const refreshed = await apiRequest<{ admins: AdminAccount[] }>("/api/auth/admin-list");
        setAccounts(refreshed.admins ?? []);
        const acct = refreshed.admins?.find((a) => a.username === username);
        if (acct) {
          setAdminName(acct.adminName);
          setDesignation(acct.designation);
        }
      } catch {
        /* non-fatal */
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update admin details");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="p-6 sm:p-8">
      <h2 className="text-xl font-semibold tracking-tight text-slate-900">
        Forgot password / change admin
      </h2>
      <p className="mt-1 text-sm text-slate-500">
        Select your username, verify with the registered phone number, then update the admin
        name or set a new password — e.g. when a new Headmaster / Headmistress / Principal
        takes charge.
      </p>

      {success ? (
        <div className="mt-6 space-y-4">
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            ✅ {success}
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/login" className="flex-1">
              <Button className="w-full">Go to sign in →</Button>
            </Link>
            <Button variant="secondary" onClick={() => setSuccess(null)}>
              Make another change
            </Button>
          </div>
        </div>
      ) : (
        <form onSubmit={submit} className="mt-6 space-y-5">
          {/* Step 1 · select the account */}
          <div className="space-y-4 rounded-2xl border border-slate-100 bg-slate-50/60 p-4">
            <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">
              Step 1 · Select your account
            </p>
            <Field
              label="Username (school UDISE code)"
              hint="Usernames are fixed — they can be selected but not edited."
            >
              <Select value={username} onChange={(e) => pickAccount(e.target.value)} required>
                <option value="">
                  {loadError
                    ? "Could not load accounts — try again"
                    : accounts.length === 0
                      ? "No admin accounts registered yet"
                      : "— Select your username —"}
                </option>
                {accounts.map((a) => (
                  <option key={a.username} value={a.username}>
                    {a.username} · {a.schoolName}
                  </option>
                ))}
              </Select>
            </Field>

            {selected ? (
              <div className="rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-700 shadow-sm">
                <p>
                  <span className="font-semibold text-slate-900">School:</span>{" "}
                  {selected.schoolName}
                </p>
                <p className="mt-0.5">
                  <span className="font-semibold text-slate-900">Registered admin:</span>{" "}
                  {selected.adminName} ({selected.designation})
                </p>
                <p className="mt-0.5">
                  <span className="font-semibold text-slate-900">Registered phone:</span>{" "}
                  {selected.phoneMasked || (
                    <span className="text-rose-600">not registered</span>
                  )}
                </p>
              </div>
            ) : null}
          </div>

          {/* Step 2 · verify & update */}
          {selected ? (
            <div className="space-y-4 rounded-2xl border border-slate-100 bg-slate-50/60 p-4">
              <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">
                Step 2 · Verify &amp; update
              </p>

              <Field
                label="Registered phone number (verification)"
                hint={
                  selected.hasPhone
                    ? `Must match the registered number ${selected.phoneMasked}`
                    : "No phone is registered for this school"
                }
              >
                <Input
                  value={verifyPhone}
                  onChange={(e) => setVerifyPhone(e.target.value)}
                  placeholder="+91 98400 11223"
                  inputMode="tel"
                  autoComplete="tel"
                  required
                />
              </Field>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Admin name">
                  <Input
                    value={adminName}
                    onChange={(e) => setAdminName(e.target.value)}
                    placeholder="New Headmaster / Principal name"
                    required
                  />
                </Field>
                <Field label="Designation">
                  <select
                    value={designation}
                    onChange={(e) => setDesignation(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
                  >
                    {DESIGNATIONS.map((d) => (
                      <option key={d}>{d}</option>
                    ))}
                  </select>
                </Field>
              </div>

              <Field label="New phone number (optional)" hint="Leave blank to keep the current number.">
                <Input
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  placeholder="+91 98400 11223"
                  inputMode="tel"
                />
              </Field>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="New password (optional)" hint="Leave blank to keep the current password.">
                  <Input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    autoComplete="new-password"
                  />
                </Field>
                <Field label="Confirm new password">
                  <Input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repeat new password"
                    autoComplete="new-password"
                    className={
                      confirmPassword.length > 0
                        ? confirmPassword === newPassword
                          ? "border-emerald-300"
                          : "border-rose-300"
                        : undefined
                    }
                  />
                </Field>
              </div>
            </div>
          ) : null}

          {error ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {error}
            </div>
          ) : null}

          <Button type="submit" className="w-full" loading={loading} disabled={!selected}>
            {loading ? "Updating…" : "Update admin details / reset password"}
          </Button>
          <p className="text-center text-xs text-slate-400">
            The username (UDISE code) can never be changed.
          </p>
        </form>
      )}
    </Card>
  );
}

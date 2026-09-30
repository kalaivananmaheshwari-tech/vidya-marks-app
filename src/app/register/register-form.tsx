"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Button, Card, Field, Input, Select } from "@/components/ui";
import { apiRequest } from "@/lib/client";
import { ACADEMIC_YEARS, DEFAULT_ACADEMIC_YEAR } from "@/lib/academic";

const STATES = [
  "Andhra Pradesh", "Assam", "Bihar", "Chhattisgarh", "Delhi", "Goa", "Gujarat", "Haryana",
  "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra",
  "Odisha", "Punjab", "Rajasthan", "Tamil Nadu", "Telangana", "Uttar Pradesh", "Uttarakhand",
  "West Bengal", "Other",
];

export default function RegisterForm() {
  const router = useRouter();
  const [form, setForm] = useState({
    schoolName: "",
    udiseCode: "",
    academicYear: DEFAULT_ACADEMIC_YEAR,
    district: "",
    state: "Tamil Nadu",
    adminName: "",
    designation: "Principal",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const udiseValid = /^\d{11}$/.test(form.udiseCode);
  const udiseTouched = form.udiseCode.length > 0;
  const passwordsMatch = form.password.length > 0 && form.password === form.confirmPassword;

  const strength = useMemo(() => {
    const p = form.password;
    let score = 0;
    if (p.length >= 6) score += 1;
    if (p.length >= 10) score += 1;
    if (/[A-Z]/.test(p) && /[a-z]/.test(p)) score += 1;
    if (/\d/.test(p)) score += 1;
    if (/[^A-Za-z0-9]/.test(p)) score += 1;
    return Math.min(score, 4);
  }, [form.password]);

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (!udiseValid) return setError("UDISE code must be exactly 11 digits.");
    if (form.password.length < 6) return setError("Password must be at least 6 characters.");
    if (form.password !== form.confirmPassword) return setError("Passwords do not match.");

    setLoading(true);
    try {
      await apiRequest("/api/auth/register", {
        method: "POST",
        body: JSON.stringify(form),
      });
      router.replace("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not register the school");
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-xl">
      <div className="mb-6 flex items-center gap-3 lg:hidden">
        <span className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-brand-600 to-violet-600 text-xl text-white shadow-lg">
          🎓
        </span>
        <div>
          <p className="text-lg font-semibold tracking-tight text-slate-900">Vidya Analytics</p>
          <p className="text-xs text-slate-500">Register your school</p>
        </div>
      </div>

      <Card className="p-6 sm:p-8">
        <h2 className="text-xl font-semibold tracking-tight text-slate-900">Register your school</h2>
        <p className="mt-1 text-sm text-slate-500">
          The UDISE code you enter becomes the <strong>admin username</strong> for this school.
        </p>

        <form onSubmit={submit} className="mt-6 space-y-5">
          <div className="space-y-4 rounded-2xl border border-slate-100 bg-slate-50/60 p-4">
            <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">
              School details
            </p>
            <Field label="Name of the school">
              <Input
                value={form.schoolName}
                onChange={(e) => set("schoolName", e.target.value)}
                placeholder="Govt. Higher Secondary School, Anna Nagar"
                required
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="UDISE code (11 digits)"
                hint="This is your admin login username."
              >
                <div className="relative">
                  <Input
                    value={form.udiseCode}
                    onChange={(e) => set("udiseCode", e.target.value.replace(/\D/g, "").slice(0, 11))}
                    placeholder="33064500112"
                    inputMode="numeric"
                    className={
                      udiseTouched
                        ? udiseValid
                          ? "border-emerald-300 pr-24 focus:ring-emerald-100"
                          : "border-amber-300 pr-24 focus:ring-amber-100"
                        : "pr-24"
                    }
                    required
                  />
                  <span
                    className={`pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold tabular-nums ${
                      udiseValid ? "text-emerald-600" : "text-slate-400"
                    }`}
                  >
                    {udiseValid ? "✓" : `${form.udiseCode.length}/11`}
                  </span>
                </div>
              </Field>

              <Field
                label="Academic Year (Select 15 Years)"
                hint="From 2026-2027 to consecutive 15 academic years"
              >
                <Select
                  value={form.academicYear}
                  onChange={(e) => set("academicYear", e.target.value)}
                  className="font-semibold text-brand-900"
                  required
                >
                  {ACADEMIC_YEARS.map((yr) => (
                    <option key={yr} value={yr}>
                      {yr}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="District">
                <Input
                  value={form.district}
                  onChange={(e) => set("district", e.target.value)}
                  placeholder="Coimbatore"
                />
              </Field>
              <Field label="State">
                <select
                  value={form.state}
                  onChange={(e) => set("state", e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
                >
                  {STATES.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </Field>
            </div>
          </div>

          <div className="space-y-4 rounded-2xl border border-slate-100 bg-slate-50/60 p-4">
            <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">
              Admin account (Principal / Headmaster)
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Your name">
                <Input
                  value={form.adminName}
                  onChange={(e) => set("adminName", e.target.value)}
                  placeholder="Dr. Meera Krishnan"
                  required
                />
              </Field>
              <Field label="Designation">
                <select
                  value={form.designation}
                  onChange={(e) => set("designation", e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
                >
                  <option>Principal</option>
                  <option>Headmaster</option>
                  <option>Headmistress</option>
                  <option>Correspondent</option>
                </select>
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Official email (optional)">
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => set("email", e.target.value)}
                  placeholder="office@school.edu"
                />
              </Field>
              <Field label="Phone (optional)">
                <Input
                  value={form.phone}
                  onChange={(e) => set("phone", e.target.value)}
                  placeholder="+91 98400 00000"
                />
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Create password">
                <Input
                  type="password"
                  value={form.password}
                  onChange={(e) => set("password", e.target.value)}
                  placeholder="At least 6 characters"
                  autoComplete="new-password"
                  required
                />
              </Field>
              <Field label="Confirm password">
                <Input
                  type="password"
                  value={form.confirmPassword}
                  onChange={(e) => set("confirmPassword", e.target.value)}
                  placeholder="Repeat password"
                  autoComplete="new-password"
                  className={
                    form.confirmPassword.length > 0
                      ? passwordsMatch
                        ? "border-emerald-300"
                        : "border-rose-300"
                      : undefined
                  }
                  required
                />
              </Field>
            </div>

            {form.password ? (
              <div>
                <div className="flex gap-1">
                  {[0, 1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className={`h-1.5 flex-1 rounded-full transition ${
                        i < strength
                          ? strength <= 1
                            ? "bg-rose-400"
                            : strength === 2
                              ? "bg-amber-400"
                              : strength === 3
                                ? "bg-lime-500"
                                : "bg-emerald-500"
                          : "bg-slate-200"
                      }`}
                    />
                  ))}
                </div>
                <p className="mt-1 text-[11px] text-slate-500">
                  {strength <= 1 ? "Weak" : strength === 2 ? "Fair" : strength === 3 ? "Good" : "Strong"}{" "}
                  password
                  {form.confirmPassword && !passwordsMatch ? " · passwords do not match yet" : ""}
                </p>
              </div>
            ) : null}
          </div>

          {error ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {error}
            </div>
          ) : null}

          <Button type="submit" className="w-full" loading={loading}>
            {loading ? "Creating your workspace…" : "Register school & open dashboard"}
          </Button>

          <p className="text-center text-sm text-slate-500">
            Already registered?{" "}
            <Link href="/login" className="font-semibold text-brand-600 hover:underline">
              Sign in here
            </Link>
          </p>
        </form>
      </Card>
    </div>
  );
}

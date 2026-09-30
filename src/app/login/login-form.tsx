"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Card, Field, Input } from "@/components/ui";
import { apiRequest } from "@/lib/client";

const DEMO_ACCOUNTS = [
  {
    role: "School admin · Principal / Headmaster",
    name: "Dr. Meera Krishnan",
    username: "33064500112",
    password: "admin@123",
    hint: "Logs in with the school UDISE code",
    icon: "🏛️",
    tone: "from-brand-500 to-violet-500",
  },
  {
    role: "Teacher · created by the admin",
    name: "Ramesh Iyer",
    username: "33064500112.ramesh",
    password: "teacher@123",
    hint: "Logs in with an admin-issued username",
    icon: "🧑‍🏫",
    tone: "from-emerald-500 to-teal-500",
  },
];

export default function LoginForm() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await apiRequest("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ username, password }),
      });
      router.replace("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to sign in");
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-md">
      <div className="mb-8 flex items-center gap-3 lg:hidden">
        <span className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-brand-600 to-violet-600 text-xl text-white shadow-lg">
          🎓
        </span>
        <div>
          <p className="text-lg font-semibold tracking-tight text-slate-900">Vidya Analytics</p>
          <p className="text-xs text-slate-500">School marks analysis workspace</p>
        </div>
      </div>

      <Card className="p-6 sm:p-8">
        <h2 className="text-xl font-semibold tracking-tight text-slate-900">Sign in</h2>
        <p className="mt-1 text-sm text-slate-500">
          Admins use the school <strong>UDISE code</strong>. Teachers use the username issued by their
          admin.
        </p>

        <form onSubmit={submit} className="mt-6 space-y-4">
          <Field label="UDISE code / Username">
            <Input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="33064500112"
              autoComplete="username"
              required
            />
          </Field>
          <Field label="Password">
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              required
            />
          </Field>

          {error ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {error}
            </div>
          ) : null}

          <Button type="submit" className="w-full" loading={loading}>
            {loading ? "Signing in…" : "Sign in"}
          </Button>
        </form>

        <div className="mt-6 rounded-xl border border-brand-100 bg-brand-50/70 p-4 text-center">
          <p className="text-sm font-medium text-slate-800">New school?</p>
          <p className="mt-0.5 text-xs text-slate-600">
            Register with your school name and 11-digit UDISE code.
          </p>
          <Link href="/register">
            <Button variant="secondary" size="sm" className="mt-3 w-full">
              Register your school →
            </Button>
          </Link>
        </div>

        <div className="mt-7">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Or explore the demo school
          </p>
          <div className="mt-3 space-y-2">
            {DEMO_ACCOUNTS.map((account) => (
              <button
                key={account.username}
                type="button"
                onClick={() => {
                  setUsername(account.username);
                  setPassword(account.password);
                }}
                className="flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-left transition hover:border-brand-300 hover:bg-brand-50/50"
              >
                <span
                  className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-gradient-to-br ${account.tone} text-base text-white`}
                >
                  {account.icon}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-slate-800">
                    {account.name}
                  </span>
                  <span className="block truncate text-xs text-slate-500">{account.role}</span>
                  <span className="mt-0.5 block truncate font-mono text-[10px] text-slate-400">
                    {account.username} · {account.password}
                  </span>
                </span>
                <span className="text-xs font-medium text-brand-600">Use</span>
              </button>
            ))}
          </div>
        </div>
      </Card>
    </div>
  );
}

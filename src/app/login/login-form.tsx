"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Card, Field, Input } from "@/components/ui";
import { apiRequest } from "@/lib/client";

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
      </Card>
    </div>
  );
}

"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { useToast } from "@/components/ui";
import { apiRequest, classNames } from "@/lib/client";

type NavItem = { href: string; label: string; icon: string; adminOnly?: boolean };
type NavGroup = { title: string; items: NavItem[] };

const NAV: NavGroup[] = [
  {
    title: "Overview",
    items: [{ href: "/dashboard", label: "Dashboard", icon: "📊" }],
  },
  {
    title: "Academic setup",
    items: [
      { href: "/exams", label: "1. Examinations", icon: "🗓️" },
      { href: "/staff", label: "2. Teachers", icon: "👩‍🏫" },
      { href: "/classes", label: "3. Classes & Sections", icon: "🏫" },
      { href: "/subjects", label: "4. Subjects", icon: "📚" },
      { href: "/mark-assign", label: "5. Marks Assign", icon: "⚖️" },
      { href: "/students/entry", label: "6. Student Entry and Marks", icon: "📝" },
      { href: "/students", label: "7. Students Register", icon: "🎓" },
      { href: "/marks", label: "8. Class wise and subject wise mark Entry", icon: "✍️" },
      { href: "/groups", label: "Group codes (11 & 12)", icon: "🧩" },
    ],
  },
  {
    title: "Official Reports",
    items: [
      { href: "/reports", label: "Official Mark Lists & Analysis", icon: "📑" },
    ],
  },
  {
    title: "Analysis",
    items: [
      { href: "/analysis/subject", label: "Subject-wise", icon: "🧪" },
      { href: "/analysis/class", label: "Class-wise", icon: "🏆" },
      { href: "/analysis/section", label: "Class & section", icon: "🧮" },
    ],
  },
  {
    title: "Administration",
    items: [
      { href: "/staff", label: "Teacher logins", icon: "👩‍🏫" },
      { href: "/help", label: "How to use", icon: "🧭" },
    ],
  },
];

export type ShellUser = {
  id: number;
  name: string;
  username: string;
  role: string;
  designation: string | null;
};

export type ShellSchool = {
  name: string;
  udiseCode: string;
  academicYear: string;
  district: string | null;
  state: string | null;
};

export default function Shell({
  user,
  school,
  children,
}: {
  user: ShellUser;
  school: ShellSchool;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const isAdmin = user.role === "admin";
  const initials = user.name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  async function logout() {
    setBusy(true);
    try {
      await apiRequest("/api/auth/logout", { method: "POST" });
      router.replace("/login");
      router.refresh();
    } catch {
      toast.push("Could not sign out. Try again.", "error");
      setBusy(false);
    }
  }

  const sidebar = (
    <div className="flex h-full flex-col bg-gradient-to-b from-slate-950 via-brand-950 to-slate-900 text-slate-300">
      <div className="px-4 py-4">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/10 text-lg backdrop-blur">
            🎓
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white" title={school.name}>
              {school.name}
            </p>
            <p className="truncate font-mono text-[10px] text-brand-300">UDISE {school.udiseCode}</p>
          </div>
        </div>
      </div>

      <nav className="scroll-thin flex-1 space-y-5 overflow-y-auto px-3 pb-6">
        {NAV.map((group) => (
          <div key={group.title}>
            <p className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
              {group.title}
            </p>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={classNames(
                      "group flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition",
                      active
                        ? "bg-white/12 font-semibold text-white shadow-inner ring-1 ring-white/10"
                        : "text-slate-400 hover:bg-white/5 hover:text-white",
                    )}
                  >
                    <span className="text-base">{item.icon}</span>
                    <span className="truncate">{item.label}</span>
                    {active ? <span className="ml-auto h-1.5 w-1.5 rounded-full bg-brand-300" /> : null}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-white/10 px-4 py-4">
        <div className="flex items-center gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-brand-400 to-violet-500 text-xs font-bold text-white">
            {initials}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-white">{user.name}</p>
            <p className="truncate font-mono text-[10px] text-slate-400">@{user.username}</p>
          </div>
        </div>
        <p className="mt-2 truncate text-[11px] text-slate-400">
          {isAdmin ? "🏛️ School admin" : `🧑‍🏫 ${user.designation || "Teacher"}`}
        </p>
        <button
          onClick={logout}
          disabled={busy}
          className="mt-3 w-full rounded-xl border border-white/10 px-3 py-2 text-xs font-medium text-slate-300 transition hover:bg-white/10 hover:text-white disabled:opacity-60"
        >
          {busy ? "Signing out…" : "Sign out"}
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 lg:block">{sidebar}</aside>

      {open ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="animate-fade-up absolute inset-y-0 left-0 w-72 shadow-2xl">{sidebar}</div>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col lg:ml-64">
        <header className="no-print sticky top-0 z-20 flex items-center gap-3 border-b border-slate-200/70 bg-white/80 px-4 py-3 backdrop-blur-md sm:px-6">
          <button
            onClick={() => setOpen(true)}
            className="rounded-lg border border-slate-200 p-2 text-slate-600 transition hover:bg-slate-50 lg:hidden"
            aria-label="Open navigation"
          >
            ☰
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-slate-800">{school.name}</p>
            <p className="truncate text-[11px] text-slate-500">
              {[school.district, school.state].filter(Boolean).join(", ") || "Academic year"} ·{" "}
              {school.academicYear}
            </p>
          </div>
          <span
            className={classNames(
              "hidden rounded-full px-3 py-1 text-[11px] font-semibold ring-1 ring-inset sm:inline-flex",
              isAdmin
                ? "bg-brand-50 text-brand-700 ring-brand-200"
                : "bg-emerald-50 text-emerald-700 ring-emerald-200",
            )}
          >
            {isAdmin ? "Admin access" : "Teacher access"}
          </span>
          <span
            className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-brand-500 to-violet-500 text-xs font-bold text-white shadow-sm"
            title={`${user.name} (@${user.username})`}
          >
            {initials}
          </span>
          <button
            onClick={logout}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 shadow-sm transition hover:bg-rose-100 hover:border-rose-300 focus:outline-none focus:ring-2 focus:ring-rose-400 disabled:opacity-60 cursor-pointer"
            title="Sign out of Vidya Analytics"
            aria-label="Logout"
          >
            <span>🚪</span>
            <span className="font-medium">Logout</span>
          </button>
        </header>

        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <div className="animate-fade-up mx-auto w-full max-w-7xl space-y-6">{children}</div>
        </main>
      </div>
    </div>
  );
}

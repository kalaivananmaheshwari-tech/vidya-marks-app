import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-xl">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-brand-50 text-2xl">
          🧭
        </div>
        <h1 className="mt-4 text-lg font-semibold text-slate-900">Page not found</h1>
        <p className="mt-2 text-sm text-slate-600">
          That address does not exist in this workspace. Use the links below to get back on track.
        </p>
        <div className="mt-6 flex flex-col gap-2">
          <Link
            href="/dashboard"
            className="w-full rounded-xl bg-gradient-to-r from-brand-600 to-violet-600 px-4 py-2.5 text-sm font-medium text-white transition hover:from-brand-500 hover:to-violet-500"
          >
            Go to dashboard
          </Link>
          <Link
            href="/login"
            className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Sign in
          </Link>
          <Link
            href="/register"
            className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Register a school
          </Link>
        </div>
      </div>
    </div>
  );
}

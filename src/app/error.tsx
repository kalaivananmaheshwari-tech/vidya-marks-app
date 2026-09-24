"use client";

import { useEffect } from "react";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Application error:", error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-xl">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-amber-50 text-2xl">
          ⚠️
        </div>
        <h1 className="mt-4 text-lg font-semibold text-slate-900">Something went wrong</h1>
        <p className="mt-2 text-sm text-slate-600">
          The page could not be loaded. This is usually temporary — try again in a moment.
        </p>
        <div className="mt-6 flex flex-col gap-2">
          <button
            onClick={reset}
            className="w-full rounded-xl bg-gradient-to-r from-brand-600 to-violet-600 px-4 py-2.5 text-sm font-medium text-white transition hover:from-brand-500 hover:to-violet-500"
          >
            Try again
          </button>
          <a
            href="/login"
            className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Back to sign in
          </a>
        </div>
      </div>
    </div>
  );
}

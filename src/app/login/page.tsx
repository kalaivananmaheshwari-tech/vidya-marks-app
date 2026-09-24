import Link from "next/link";
import { redirect } from "next/navigation";
import { ensureSeed } from "@/db/seed";
import { getAuth } from "@/lib/auth";
import LoginForm from "./login-form";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  await ensureSeed().catch(() => undefined);
  const auth = await getAuth();
  if (auth) redirect("/dashboard");

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      <section className="relative hidden overflow-hidden bg-gradient-to-br from-brand-950 via-brand-800 to-violet-700 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="pointer-events-none absolute -left-24 top-1/3 h-80 w-80 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute -right-10 bottom-0 h-72 w-72 rounded-full bg-sky-400/20 blur-3xl" />
        <div className="relative">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-white/15 text-xl backdrop-blur">
              🎓
            </span>
            <div>
              <p className="text-lg font-semibold tracking-tight">Vidya Analytics</p>
              <p className="text-xs text-white/60">School marks analysis platform</p>
            </div>
          </div>
        </div>

        <div className="relative max-w-md">
          <h1 className="text-4xl font-bold leading-tight tracking-tight">
            Turn mark sheets into decisions.
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-white/75">
            Each school registers with its UDISE code. The admin creates teacher logins, teachers key
            in marks, and everyone reads the same analysis — subject-wise, class-wise and class &amp;
            section-wise.
          </p>
          <div className="mt-8 grid grid-cols-3 gap-3">
            {[
              { label: "Subject analysis", icon: "📚" },
              { label: "Class comparison", icon: "🏫" },
              { label: "Section spread", icon: "🧮" },
            ].map((item) => (
              <div key={item.label} className="rounded-xl bg-white/10 p-3 backdrop-blur">
                <p className="text-lg">{item.icon}</p>
                <p className="mt-1 text-xs font-medium text-white/80">{item.label}</p>
              </div>
            ))}
          </div>
          <Link
            href="/register"
            className="mt-8 inline-flex items-center gap-2 rounded-xl bg-white/15 px-4 py-2.5 text-sm font-semibold backdrop-blur transition hover:bg-white/25"
          >
            Register a new school →
          </Link>
        </div>

        <p className="relative text-xs text-white/50">
          Academic year 2025 – 2026 · Data is isolated per school
        </p>
      </section>

      <section className="flex items-center justify-center px-5 py-12 sm:px-10">
        <LoginForm />
      </section>
    </div>
  );
}

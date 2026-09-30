import Link from "next/link";
import { redirect } from "next/navigation";
import { getAuth } from "@/lib/auth";
import RegisterForm from "./register-form";

export const dynamic = "force-dynamic";

export default async function RegisterPage() {
  const auth = await getAuth();
  if (auth) redirect("/dashboard");

  return (
    <div className="grid min-h-screen lg:grid-cols-[1fr_1.05fr]">
      <section className="relative hidden overflow-hidden bg-gradient-to-br from-brand-950 via-brand-800 to-violet-700 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="pointer-events-none absolute -left-24 top-1/3 h-80 w-80 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute -right-10 bottom-0 h-72 w-72 rounded-full bg-sky-400/20 blur-3xl" />

        <Link href="/login" className="relative flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-white/15 text-xl backdrop-blur">
            🎓
          </span>
          <div>
            <p className="text-lg font-semibold tracking-tight">Vidya Analytics</p>
            <p className="text-xs text-white/60">School marks analysis platform</p>
          </div>
        </Link>

        <div className="relative max-w-md">
          <h1 className="text-4xl font-bold leading-tight tracking-tight">
            Register your school in under a minute.
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-white/75">
            Your 11-digit UDISE code becomes the admin login for the school. As admin you then
            create a username and password for each teacher, and they enter marks for their subjects.
          </p>

          <ol className="mt-8 space-y-3">
            {[
              { n: "1", t: "Register the school", d: "Name + 11-digit UDISE code + your password" },
              { n: "2", t: "Create teacher logins", d: "Admin issues username & password per teacher" },
              { n: "3", t: "Set up classes & marks", d: "Group codes, students, exams, mark entry" },
              { n: "4", t: "Read the analysis", d: "Subject-wise, class-wise, section-wise" },
            ].map((step) => (
              <li key={step.n} className="flex gap-3 rounded-xl bg-white/10 p-3 backdrop-blur">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-white/20 text-xs font-bold">
                  {step.n}
                </span>
                <div>
                  <p className="text-sm font-semibold">{step.t}</p>
                  <p className="text-xs text-white/65">{step.d}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>

        <p className="relative text-xs text-white/50">
          Every school&apos;s data is fully isolated from other registered schools.
        </p>
      </section>

      <section className="flex items-center justify-center px-5 py-12 sm:px-10">
        <RegisterForm />
      </section>
    </div>
  );
}

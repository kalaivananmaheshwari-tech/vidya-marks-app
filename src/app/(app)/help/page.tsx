import Link from "next/link";
import { Badge, Card, PageHeader } from "@/components/ui";
import { GRADE_SCALE } from "@/lib/grades";
import { getAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

const SETUP_STEPS = [
  {
    step: "1",
    icon: "🏫",
    title: "Classes & sections",
    href: "/classes",
    body: "Name of the class & section. If Class is 11 or 12: display Group Code + Sub 1 to Sub 6 entered by user. If Class is 6 to 10: Group Code is disabled and sets to Default 8 subjects (Language, English, Mathematics, Science, Social Science, PET, TNSPARK, Science Tamil).",
    tip: "Classes 11 & 12 let you configure all 6 group subjects right in the modal.",
  },
  {
    step: "2",
    icon: "⚖️",
    title: "Mark assign",
    href: "/mark-assign",
    body: "Select class and section. For each subject, set 'If this subject having practical?'. If Yes: Theory 70, Practical 20, Internal 10 (Total 100). Otherwise: Theory 90, Internal 10 (Total 100).",
    tip: "You can change practical allocation for any subject anytime.",
  },
  {
    step: "3",
    icon: "👩‍🏫",
    title: "3.0 Teachers",
    href: "/staff",
    body: "Name of the teacher and Handling subjects. Each teacher receives an admin-issued login username and password so they can enter marks for their assigned classes and subjects.",
    tip: "Teachers can be assigned multiple handling subjects.",
  },
  {
    step: "4",
    icon: "📝",
    title: "Student entry & marks",
    href: "/students/entry",
    body: "Select Class, Section & Group code (if 11, 12 only). Subjects are automatically assigned with mark allotments (Theory 70/Prac 20/Int 10 or Theory 90/Int 10). Enter student details and marks. If marks were already entered for previous examinations, all previous examination details and marks are showed!",
    tip: "Previous exams are displayed with subject-by-subject marks, totals and pass/fail status.",
  },
  {
    step: "5",
    icon: "✍️",
    title: "Mark entry",
    href: "/marks",
    body: "Pick class, exam and subject. Enter Theory (max 70 or 90), Practical (max 20 if practical=Yes) and Internal (max 10). Total out of 100 auto-sums automatically.",
    tip: "Press Enter to jump to the next student. Full keyboard support.",
  },
  {
    step: "6",
    icon: "📊",
    title: "Mark analysis",
    href: "/dashboard",
    body: "Analyze performance Subject-wise, Class-wise, and Class & section-wise. Includes topper lists, failure lists, grade distribution and section spread comparisons.",
    tip: "Results update in real-time as marks are saved.",
  },
];

const ANALYSIS = [
  {
    icon: "🧪",
    title: "Subject-wise analysis",
    href: "/analysis/subject",
    question: "Which subject is dragging the school down?",
    body: "Average, highest, lowest, pass %, fail count and the topper for every subject. Click a row to see its grade donut and how each class performed.",
  },
  {
    icon: "🏆",
    title: "Class-wise analysis",
    href: "/analysis/class",
    question: "Which class is performing best?",
    body: "Classes ranked by average, with pass rate, distinctions, arrears, grade mix bar, strongest/weakest subject and the top 3 students per class.",
  },
  {
    icon: "🧮",
    title: "Class & section analysis",
    href: "/analysis/section",
    question: "Is section A far ahead of section B?",
    body: "Sections compared inside each grade with a spread badge. A spread above 8 points turns red — your signal to rebalance.",
  },
  {
    icon: "🧑‍🎓",
    title: "Student report card",
    href: "/students",
    question: "How is one child doing?",
    body: "Per-exam totals, class rank, subject-wise grades and a progression chart. Printable straight from the browser.",
  },
];

export default async function HelpPage() {
  const auth = await getAuth();
  const udise = auth?.school.udiseCode ?? "";
  const isAdmin = auth?.user.role === "admin";

  return (
    <>
      <PageHeader
        icon="🧭"
        title="How to use this workspace"
        subtitle="Registration, teacher logins, setup, mark entry and analysis"
        actions={
          <Link
            href="/dashboard"
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
          >
            Back to dashboard
          </Link>
        }
      />

      <Card className="border-brand-200 bg-gradient-to-br from-brand-50 to-violet-50">
        <h2 className="text-sm font-semibold text-slate-900">🔐 How logins work here</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <div className="rounded-xl border border-white bg-white/70 p-4">
            <Badge tone="brand">School admin</Badge>
            <p className="mt-2 text-sm text-slate-700">
              The person who registered the school. The username is the{" "}
              <strong>11-digit UDISE code</strong>
              {udise ? (
                <>
                  {" "}
                  — for this school that is{" "}
                  <code className="rounded bg-slate-900 px-1.5 py-0.5 font-mono text-xs text-white">
                    {udise}
                  </code>
                </>
              ) : null}
              . The password was chosen during registration.
            </p>
            <p className="mt-2 text-xs text-slate-500">
              Can do everything, including creating and disabling teacher logins.
            </p>
          </div>
          <div className="rounded-xl border border-white bg-white/70 p-4">
            <Badge tone="green">Teacher</Badge>
            <p className="mt-2 text-sm text-slate-700">
              Created by the admin on the{" "}
              <Link href="/staff" className="font-semibold text-brand-700 underline">
                Teacher logins
              </Link>{" "}
              page. Each teacher gets their own username (usually{" "}
              <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs">
                {udise || "udise"}.firstname
              </code>
              ) and a password set by the admin.
            </p>
            <p className="mt-2 text-xs text-slate-500">
              Full academic access, but cannot manage staff accounts.
            </p>
          </div>
        </div>
      </Card>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Part 1 · Setting up (once per academic year)
        </h2>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {SETUP_STEPS.map((item) => (
            <Card key={item.step} className="flex flex-col transition hover:-translate-y-0.5 hover:shadow-lg">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-violet-500 text-base font-bold text-white">
                  {item.step}
                </span>
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-slate-400">Step {item.step}</p>
                  <h3 className="text-sm font-semibold text-slate-900">
                    {item.icon} {item.title}
                  </h3>
                </div>
              </div>
              <p className="mt-3 flex-1 text-sm leading-relaxed text-slate-600">{item.body}</p>
              <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 ring-1 ring-inset ring-amber-100">
                💡 {item.tip}
              </p>
              <Link href={item.href} className="mt-3 text-xs font-semibold text-brand-600 hover:underline">
                Open {item.title.toLowerCase()} →
              </Link>
            </Card>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Part 2 · Reading the analysis
        </h2>
        <div className="grid gap-4 md:grid-cols-2">
          {ANALYSIS.map((item) => (
            <Card key={item.title} className="transition hover:-translate-y-0.5 hover:shadow-lg">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">
                    {item.icon} {item.title}
                  </h3>
                  <p className="mt-0.5 text-xs italic text-brand-600">“{item.question}”</p>
                </div>
                <Link href={item.href} className="shrink-0 text-xs font-semibold text-brand-600 hover:underline">
                  Open →
                </Link>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-slate-600">{item.body}</p>
            </Card>
          ))}
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="text-sm font-semibold text-slate-900">⌨️ Mark entry shortcuts</h2>
          <table className="mt-3 w-full text-sm">
            <tbody className="divide-y divide-slate-100">
              {[
                ["Enter or ↓", "Move to the next student"],
                ["↑", "Move to the previous student"],
                ["AB checkbox", "Mark absent (excluded from averages)"],
                ["Clear all entries", "Blank the whole sheet before re-keying"],
                ["Fill blanks with 0", "Give 0 to everyone still empty"],
                ["Save marks", "Writes the whole sheet at once — safe to repeat"],
              ].map(([key, meaning]) => (
                <tr key={key}>
                  <td className="py-2 pr-4 align-top">
                    <code className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                      {key}
                    </code>
                  </td>
                  <td className="py-2 text-slate-600">{meaning}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <Card>
          <h2 className="text-sm font-semibold text-slate-900">🏅 Grading scale used everywhere</h2>
          <div className="mt-3 space-y-1.5">
            {GRADE_SCALE.map((grade) => (
              <div key={grade.grade} className="flex items-center gap-3 text-sm">
                <span
                  className="grid h-7 w-9 shrink-0 place-items-center rounded-lg text-xs font-bold text-white"
                  style={{ backgroundColor: grade.color }}
                >
                  {grade.grade}
                </span>
                <span className="flex-1 text-slate-600">{grade.label}</span>
                <span className="tabular-nums text-xs font-semibold text-slate-500">
                  {grade.min}% and above
                </span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-slate-500">
            Pass line 35%. Distinction is any paper at 75%+. Absent papers are excluded from averages
            rather than counted as zero.
          </p>
        </Card>
      </div>

      <Card>
        <h2 className="text-sm font-semibold text-slate-900">👥 Who can do what</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="rounded-l-lg px-4 py-2 font-semibold">Action</th>
                <th className="px-4 py-2 font-semibold">Teacher</th>
                <th className="rounded-r-lg px-4 py-2 font-semibold">Admin (UDISE login)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {[
                ["Enter and edit marks", true, true],
                ["Manage students, classes, subjects, groups, exams", true, true],
                ["View every analysis report", true, true],
                ["Create teacher usernames & passwords", false, true],
                ["Reset a teacher's password / disable a login", false, true],
              ].map(([action, teacher, admin]) => (
                <tr key={String(action)}>
                  <td className="px-4 py-2.5 text-slate-700">{action}</td>
                  <td className="px-4 py-2.5">
                    {teacher ? <Badge tone="green">Allowed</Badge> : <Badge tone="rose">No</Badge>}
                  </td>
                  <td className="px-4 py-2.5">
                    {admin ? <Badge tone="green">Allowed</Badge> : <Badge tone="rose">No</Badge>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {isAdmin ? (
          <p className="mt-3 text-xs text-slate-500">
            You are signed in as the school admin, so every action above is available to you.
          </p>
        ) : null}
      </Card>

      <Card>
        <h2 className="text-sm font-semibold text-slate-900">🔁 Your working rhythm</h2>
        <div className="mt-3 grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Teacher · after each exam
            </p>
            <ol className="mt-2 space-y-1.5 text-sm text-slate-600">
              <li>1. Sign in with the username your admin gave you.</li>
              <li>2. Open Mark entry, select class, exam and your subject.</li>
              <li>3. Key the scores down the column, ticking AB where needed.</li>
              <li>4. Press Save marks, then check Subject-wise analysis.</li>
            </ol>
          </div>
          <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Admin · weekly review
            </p>
            <ol className="mt-2 space-y-1.5 text-sm text-slate-600">
              <li>1. Dashboard — filter by the latest exam, read the KPI row.</li>
              <li>2. Class-wise — find the bottom class and its weakest subject.</li>
              <li>3. Class &amp; section — check for a red section-spread badge.</li>
              <li>4. Needs attention — open those students, print report cards.</li>
            </ol>
          </div>
        </div>
      </Card>
    </>
  );
}

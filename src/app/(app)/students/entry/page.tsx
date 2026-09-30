"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Field,
  GradePill,
  Input,
  PageHeader,
  Select,
  TableSkeleton,
  useToast,
} from "@/components/ui";
import { apiRequest, useApi } from "@/lib/client";

type ClassItem = {
  id: number;
  name: string;
  section: string;
  groupId: number | null;
  groupCode: string | null;
  groupName: string | null;
  stream: string | null;
  isHsc: boolean;
};

type ExamItem = {
  id: number;
  name: string;
  month: string | null;
  year: string | null;
  maxMarks: number;
  term: string;
};

type SubjectItem = {
  id: number;
  code: string;
  name: string;
  hasPractical: boolean;
  theoryMarks: number;
  practicalMarks: number;
  internalMarks: number;
  maxMarks: number;
  passMarks: number;
  teacherName: string | null;
};

type StudentListItem = {
  id: number;
  rollNo: number;
  admissionNo: string;
  name: string;
  gender: string;
  guardianName: string | null;
  contact: string | null;
  dob: string | null;
};

type PrevExamRecord = {
  examId: number;
  examName: string;
  month: string | null;
  year: string | null;
  marks: Array<{
    subjectId: number;
    subjectName: string;
    subjectCode: string;
    theoryScore: number | null;
    practicalScore: number | null;
    internalScore: number | null;
    score: number | null;
    isAbsent: boolean;
    hasPractical: boolean;
    theoryMax: number;
    practicalMax: number;
    internalMax: number;
    totalMax: number;
    passed: boolean;
  }>;
  total: number;
  maxTotal: number;
  percentage: number;
  grade: string;
  passed: boolean;
};

type ApiResponse = {
  classes: ClassItem[];
  exams: ExamItem[];
  selectedClass: ClassItem | null;
  subjects: SubjectItem[];
  students: StudentListItem[];
  selectedStudent: StudentListItem | null;
  previousExams: PrevExamRecord[];
  currentExamMarks: Record<
    number,
    {
      theoryScore: number | null;
      practicalScore: number | null;
      internalScore: number | null;
      score: number | null;
      isAbsent: boolean;
    }
  >;
};

type MarkDraft = {
  theoryScore: string;
  practicalScore: string;
  internalScore: string;
  isAbsent: boolean;
};

export default function StudentEntryPage() {
  const toast = useToast();

  const [classId, setClassId] = useState<string>("");
  const [studentMode, setStudentMode] = useState<"existing" | "new">("existing");
  const [studentId, setStudentId] = useState<string>("");
  const [examId, setExamId] = useState<string>("");

  // Student details form
  const [studentForm, setStudentForm] = useState({
    name: "",
    rollNo: "",
    admissionNo: "",
    gender: "Female",
    guardianName: "",
    contact: "",
    dob: "",
  });

  // Marks inputs: subjectId -> MarkDraft
  const [marksDrafts, setMarksDrafts] = useState<Record<number, MarkDraft>>({});
  const [saving, setSaving] = useState(false);

  // Read initial query params from URL
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const cId = params.get("classId");
      const sId = params.get("studentId");
      const eId = params.get("examId");
      if (cId) setClassId(cId);
      if (sId) {
        setStudentId(sId);
        setStudentMode("existing");
      }
      if (eId) setExamId(eId);
    }
  }, []);

  // Fetch initial & contextual data
  const queryUrl = useMemo(() => {
    const params = new URLSearchParams();
    if (classId) params.set("classId", classId);
    if (studentId && studentMode === "existing") params.set("studentId", studentId);
    if (examId) params.set("examId", examId);
    return `/api/student-entry?${params.toString()}`;
  }, [classId, studentId, studentMode, examId]);

  const { data, loading, error, refresh } = useApi<ApiResponse>(queryUrl, [queryUrl]);

  // Set default class & exam when data loads
  useEffect(() => {
    if (!classId && data?.classes && data.classes.length > 0) {
      setClassId(String(data.classes[0].id));
    }
  }, [data?.classes, classId]);

  useEffect(() => {
    if (!examId && data?.exams && data.exams.length > 0) {
      setExamId(String(data.exams[0].id));
    }
  }, [data?.exams, examId]);

  // When class changes, reset student selection
  useEffect(() => {
    if (data?.students) {
      if (data.students.length > 0 && studentMode === "existing") {
        // pick first student if not selected or invalid
        if (!studentId || !data.students.some((s) => String(s.id) === studentId)) {
          setStudentId(String(data.students[0].id));
        }
      } else if (data.students.length === 0) {
        setStudentMode("new");
        setStudentId("");
      }
    }
  }, [data?.students, studentId, studentMode]);

  // When selected student changes, populate student form
  useEffect(() => {
    if (studentMode === "existing" && data?.selectedStudent) {
      const s = data.selectedStudent;
      setStudentForm({
        name: s.name,
        rollNo: String(s.rollNo),
        admissionNo: s.admissionNo,
        gender: s.gender,
        guardianName: s.guardianName ?? "",
        contact: s.contact ?? "",
        dob: s.dob ?? "",
      });
    } else if (studentMode === "new") {
      setStudentForm({
        name: "",
        rollNo: "",
        admissionNo: "",
        gender: "Female",
        guardianName: "",
        contact: "",
        dob: "",
      });
    }
  }, [data?.selectedStudent, studentMode]);

  // Populate marks draft from currentExamMarks (if previously entered)
  useEffect(() => {
    const next: Record<number, MarkDraft> = {};
    const subjects = data?.subjects ?? [];

    for (const sub of subjects) {
      const existing = data?.currentExamMarks?.[sub.id];
      if (existing) {
        next[sub.id] = {
          theoryScore: existing.theoryScore !== null ? String(existing.theoryScore) : "",
          practicalScore: existing.practicalScore !== null ? String(existing.practicalScore) : "",
          internalScore: existing.internalScore !== null ? String(existing.internalScore) : "",
          isAbsent: existing.isAbsent,
        };
      } else {
        next[sub.id] = {
          theoryScore: "",
          practicalScore: "",
          internalScore: "",
          isAbsent: false,
        };
      }
    }
    setMarksDrafts(next);
  }, [data?.subjects, data?.currentExamMarks]);

  const selectedClass = data?.selectedClass;
  const isClass11or12 = selectedClass?.isHsc ?? false;
  const subjects = data?.subjects ?? [];
  const students = data?.students ?? [];
  const previousExams = data?.previousExams ?? [];

  // Check if current exam marks were previously entered
  const isCurrentExamPreEntered = useMemo(() => {
    if (!data?.currentExamMarks) return false;
    return Object.keys(data.currentExamMarks).length > 0;
  }, [data?.currentExamMarks]);

  function setDraft(subId: number, patch: Partial<MarkDraft>) {
    setMarksDrafts((prev) => {
      const curr = prev[subId] ?? {
        theoryScore: "",
        practicalScore: "",
        internalScore: "",
        isAbsent: false,
      };
      return { ...prev, [subId]: { ...curr, ...patch } };
    });
  }

  function getDraftTotal(d?: MarkDraft): number | null {
    if (!d || d.isAbsent) return null;
    const t = d.theoryScore !== "" ? Number(d.theoryScore) : null;
    const p = d.practicalScore !== "" ? Number(d.practicalScore) : null;
    const i = d.internalScore !== "" ? Number(d.internalScore) : null;

    if (t === null && p === null && i === null) return null;
    return (t ?? 0) + (p ?? 0) + (i ?? 0);
  }

  async function handleSaveAll() {
    if (!classId) {
      toast.push("Please select Class & Section first.", "error");
      return;
    }
    if (studentMode === "new" && !studentForm.name.trim()) {
      toast.push("Please enter Student Name.", "error");
      return;
    }

    setSaving(true);
    try {
      const marksPayload = subjects.map((sub) => {
        const d = marksDrafts[sub.id] ?? {
          theoryScore: "",
          practicalScore: "",
          internalScore: "",
          isAbsent: false,
        };

        return {
          subjectId: sub.id,
          theoryScore: d.theoryScore !== "" ? Number(d.theoryScore) : null,
          practicalScore: d.practicalScore !== "" ? Number(d.practicalScore) : null,
          internalScore: d.internalScore !== "" ? Number(d.internalScore) : null,
          isAbsent: d.isAbsent,
        };
      });

      const res = await apiRequest<{ student: StudentListItem; savedMarksCount: number }>(
        "/api/student-entry",
        {
          method: "POST",
          body: JSON.stringify({
            classId: Number(classId),
            studentId: studentMode === "existing" && studentId ? Number(studentId) : null,
            name: studentForm.name,
            rollNo: studentForm.rollNo ? Number(studentForm.rollNo) : null,
            admissionNo: studentForm.admissionNo || null,
            gender: studentForm.gender,
            guardianName: studentForm.guardianName || null,
            contact: studentForm.contact || null,
            dob: studentForm.dob || null,
            examId: examId ? Number(examId) : null,
            marks: examId ? marksPayload : [],
          }),
        },
      );

      toast.push(
        `Saved details and ${res.savedMarksCount} marks for ${res.student.name}`,
        "success",
      );

      if (studentMode === "new") {
        setStudentMode("existing");
        setStudentId(String(res.student.id));
      }
      await refresh();
    } catch (err) {
      toast.push(err instanceof Error ? err.message : "Failed to save student entry", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageHeader
        icon="📝"
        title="Student Entry & Marks"
        subtitle="Select class, section & group code (11 & 12 only). Subjects are automatically assigned with mark allotments. Enter student details and examination marks."
        actions={
          <div className="flex items-center gap-2">
            <Link href="/students">
              <Button variant="secondary" size="sm">
                🎓 Student Register
              </Button>
            </Link>
            <Button onClick={handleSaveAll} loading={saving}>
              💾 Save Student &amp; Marks
            </Button>
          </div>
        }
      />

      {error ? <ErrorState message={error} onRetry={refresh} /> : null}

      {/* Step 1: Class, Section, and Group Code (if 11, 12 only) */}
      <Card className="border-brand-100 bg-gradient-to-r from-white via-brand-50/20 to-violet-50/20">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wide text-brand-900">
              1. Class, Section &amp; Group Code
            </h2>
            <p className="text-xs text-slate-500">
              If Class is 11 or 12: Group code is displayed. If Class is 6 to 10: Group code is disabled.
            </p>
          </div>
          {selectedClass ? (
            <Badge tone={isClass11or12 ? "sky" : "slate"}>
              {isClass11or12 ? "Classes 11 & 12 (HSC)" : "Classes 6 to 10"}
            </Badge>
          ) : null}
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Class & Section">
            <Select value={classId} onChange={(e) => setClassId(e.target.value)}>
              <option value="">Select a class...</option>
              {data?.classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} - {c.section} {c.groupCode ? `(Group ${c.groupCode})` : ""}
                </option>
              ))}
            </Select>
          </Field>

          {/* Group code (displayed for 11 & 12 only) */}
          <Field
            label="Group Code"
            hint={
              isClass11or12
                ? "Auto-loaded from Class & Section setup"
                : "Disabled for Classes 6 to 10"
            }
          >
            {isClass11or12 ? (
              <div className="flex items-center gap-2 mt-1">
                <span className="rounded-xl border border-sky-300 bg-sky-50 px-3 py-2 font-mono text-sm font-bold text-sky-900 shadow-sm">
                  {selectedClass?.groupCode || "No Group Code"}
                </span>
                <span className="text-xs font-medium text-slate-600">
                  {selectedClass?.groupName || selectedClass?.stream || "Assigned Stream"}
                </span>
              </div>
            ) : (
              <div className="mt-1">
                <span className="inline-flex items-center rounded-xl border border-slate-200 bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-500">
                  🚫 Group Code Disabled (Classes 6-10)
                </span>
              </div>
            )}
          </Field>

          <Field label="Examination (For Mark Entry)">
            <Select value={examId} onChange={(e) => setExamId(e.target.value)}>
              <option value="">Select an examination...</option>
              {data?.exams.map((ex) => (
                <option key={ex.id} value={ex.id}>
                  {ex.name} {ex.month ? `(${ex.month} ${ex.year ?? ""})` : ""}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </Card>

      {/* Step 2: Automatically Assigned Subjects with Marks Allotment */}
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wide text-slate-800">
              2. Automatically Assigned Subjects &amp; Mark Allotment
            </h2>
            <p className="text-xs text-slate-500">
              Assigned automatically for {selectedClass ? `${selectedClass.name} - ${selectedClass.section}` : "selected class"}.
              Practical = Yes: Theory 70 + Practical 20 + Internal 10. Practical = No: Theory 90 + Internal 10.
            </p>
          </div>
          <Badge tone="green">{subjects.length} Subjects Assigned</Badge>
        </div>

        {loading ? (
          <div className="pt-3">
            <TableSkeleton rows={4} cols={4} />
          </div>
        ) : subjects.length === 0 ? (
          <div className="py-6 text-center text-xs text-slate-400">
            Select a class above to see assigned subjects with mark allotment.
          </div>
        ) : (
          <div className="mt-3 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {subjects.map((sub, idx) => (
              <div
                key={sub.id}
                className="flex flex-col justify-between rounded-xl border border-slate-200 bg-slate-50/60 p-3"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-slate-900 text-sm truncate">
                      {idx + 1}. {sub.name}
                    </span>
                    <span className="font-mono text-[10px] text-slate-400">{sub.code}</span>
                  </div>
                  <div className="mt-1.5 flex items-center gap-1.5">
                    {sub.hasPractical ? (
                      <Badge tone="green">🔬 Practical (70+20+10)</Badge>
                    ) : (
                      <Badge tone="slate">📖 Theory (90+10)</Badge>
                    )}
                  </div>
                </div>

                <div className="mt-2.5 pt-2 border-t border-slate-200/60 text-[11px] text-slate-600">
                  {sub.hasPractical ? (
                    <span className="tabular-nums">
                      Theory: <strong>{sub.theoryMarks}</strong> · Prac: <strong>{sub.practicalMarks}</strong> · Int: <strong>{sub.internalMarks}</strong> = <strong>100</strong>
                    </span>
                  ) : (
                    <span className="tabular-nums">
                      Theory: <strong>{sub.theoryMarks}</strong> · Int: <strong>{sub.internalMarks}</strong> = <strong>100</strong>
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Step 3: Student Selection / Entry & Student Details */}
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wide text-slate-800">
              3. Student Details Entry
            </h2>
            <p className="text-xs text-slate-500">
              Pick an existing student from this class to view previous exam details &amp; enter marks, OR admit a new student.
            </p>
          </div>

          <div className="inline-flex rounded-xl border border-slate-200 bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => setStudentMode("existing")}
              className={`rounded-lg px-3 py-1 text-xs font-semibold transition cursor-pointer ${
                studentMode === "existing"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              👤 Existing Student ({students.length})
            </button>
            <button
              type="button"
              onClick={() => {
                setStudentMode("new");
                setStudentId("");
              }}
              className={`rounded-lg px-3 py-1 text-xs font-semibold transition cursor-pointer ${
                studentMode === "new"
                  ? "bg-brand-600 text-white shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              ➕ New Student Entry
            </button>
          </div>
        </div>

        {studentMode === "existing" ? (
          <div className="mt-4">
            <Field label="Choose Student from this class">
              <Select value={studentId} onChange={(e) => setStudentId(e.target.value)}>
                {students.map((s) => (
                  <option key={s.id} value={s.id}>
                    Roll {s.rollNo}: {s.name} ({s.admissionNo})
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        ) : null}

        {/* Student Inputs */}
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Student Full Name">
            <Input
              value={studentForm.name}
              onChange={(e) => setStudentForm({ ...studentForm, name: e.target.value })}
              placeholder="e.g. Ananya Raman"
              required
            />
          </Field>
          <Field label="Roll No. (Auto or Custom)">
            <Input
              type="number"
              value={studentForm.rollNo}
              onChange={(e) => setStudentForm({ ...studentForm, rollNo: e.target.value })}
              placeholder="Auto"
            />
          </Field>
          <Field label="Admission No. (Auto or Custom)">
            <Input
              value={studentForm.admissionNo}
              onChange={(e) => setStudentForm({ ...studentForm, admissionNo: e.target.value })}
              placeholder="Auto"
            />
          </Field>
          <Field label="Gender">
            <Select
              value={studentForm.gender}
              onChange={(e) => setStudentForm({ ...studentForm, gender: e.target.value })}
            >
              <option>Female</option>
              <option>Male</option>
              <option>Other</option>
            </Select>
          </Field>
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <Field label="Guardian Name">
            <Input
              value={studentForm.guardianName}
              onChange={(e) => setStudentForm({ ...studentForm, guardianName: e.target.value })}
              placeholder="Father / Mother name"
            />
          </Field>
          <Field label="Contact Phone">
            <Input
              value={studentForm.contact}
              onChange={(e) => setStudentForm({ ...studentForm, contact: e.target.value })}
              placeholder="+91 98400 00000"
            />
          </Field>
          <Field label="Date of Birth">
            <Input
              type="date"
              value={studentForm.dob}
              onChange={(e) => setStudentForm({ ...studentForm, dob: e.target.value })}
            />
          </Field>
        </div>
      </Card>

      {/* Step 4: PREVIOUS EXAMINATIONS RECORD (If already entered, all details showed!) */}
      {studentMode === "existing" && studentId ? (
        <Card className="border-violet-200 bg-gradient-to-br from-violet-50/40 via-white to-brand-50/30">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-violet-100 pb-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base">📋</span>
                <h2 className="text-sm font-bold uppercase tracking-wide text-violet-950">
                  Previous Examination Record (All Showed)
                </h2>
              </div>
              <p className="text-xs text-slate-600">
                All examination marks previously entered for <strong>{studentForm.name || "this student"}</strong> are listed below:
              </p>
            </div>

            <Badge tone="brand">
              {previousExams.length} Previous Exam{previousExams.length === 1 ? "" : "s"} on Record
            </Badge>
          </div>

          {previousExams.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-xs text-slate-400 italic">
                No marks entered in previous examinations yet for this student. Enter marks below to record their first exam.
              </p>
            </div>
          ) : (
            <div className="mt-4 space-y-4">
              {previousExams.map((pExam) => (
                <div
                  key={pExam.examId}
                  className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 text-sm">
                        🗓️ {pExam.examName}
                      </span>
                      {pExam.month || pExam.year ? (
                        <span className="text-xs text-slate-500">
                          ({pExam.month} {pExam.year})
                        </span>
                      ) : null}
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="text-xs text-slate-600">
                        Total: <strong className="text-slate-900 font-bold">{pExam.total}</strong> / {pExam.maxTotal}
                      </span>
                      <span className="font-bold text-sm text-brand-700 tabular-nums">
                        {pExam.percentage}%
                      </span>
                      <GradePill grade={pExam.grade} />
                      <Badge tone={pExam.passed ? "green" : "rose"}>
                        {pExam.passed ? "Passed" : "Arrear(s)"}
                      </Badge>
                    </div>
                  </div>

                  {/* Subject breakdown table for this previous exam */}
                  <div className="overflow-x-auto mt-2.5">
                    <table className="w-full text-xs">
                      <thead className="bg-slate-50 text-slate-500 uppercase font-semibold">
                        <tr>
                          <th className="px-3 py-1.5 text-left">Subject</th>
                          <th className="px-2 py-1.5 text-center">Theory</th>
                          <th className="px-2 py-1.5 text-center">Practical</th>
                          <th className="px-2 py-1.5 text-center">Internal</th>
                          <th className="px-2 py-1.5 text-center">Total (/100)</th>
                          <th className="px-3 py-1.5 text-right">Result</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {pExam.marks.map((m) => (
                          <tr key={m.subjectId} className="hover:bg-slate-50/50">
                            <td className="px-3 py-1.5 font-medium text-slate-800">
                              {m.subjectName}
                              <span className="ml-1 text-[10px] text-slate-400">({m.subjectCode})</span>
                            </td>
                            <td className="px-2 py-1.5 text-center tabular-nums text-slate-700">
                              {m.isAbsent ? "—" : (m.theoryScore ?? "—")}
                              <span className="text-[10px] text-slate-400">/{m.theoryMax}</span>
                            </td>
                            <td className="px-2 py-1.5 text-center tabular-nums text-slate-700">
                              {m.hasPractical ? (
                                <>
                                  {m.isAbsent ? "—" : (m.practicalScore ?? "—")}
                                  <span className="text-[10px] text-slate-400">/{m.practicalMax}</span>
                                </>
                              ) : (
                                <span className="text-slate-300">N/A</span>
                              )}
                            </td>
                            <td className="px-2 py-1.5 text-center tabular-nums text-slate-700">
                              {m.isAbsent ? "—" : (m.internalScore ?? "—")}
                              <span className="text-[10px] text-slate-400">/{m.internalMax}</span>
                            </td>
                            <td className="px-2 py-1.5 text-center font-bold tabular-nums">
                              {m.isAbsent ? (
                                <Badge tone="rose">Absent</Badge>
                              ) : (
                                <span className={m.passed ? "text-slate-900" : "text-rose-600"}>
                                  {m.score ?? 0}
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-1.5 text-right">
                              {m.isAbsent ? (
                                <Badge tone="rose">AB</Badge>
                              ) : m.passed ? (
                                <Badge tone="green">Pass</Badge>
                              ) : (
                                <Badge tone="rose">Fail</Badge>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      ) : null}

      {/* Step 5: Enter Marks for Selected Examination */}
      <Card padded={false}>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-3.5 bg-slate-50/50">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold uppercase tracking-wide text-slate-900">
                4. Enter Examination Marks
              </h2>
              {isCurrentExamPreEntered ? (
                <Badge tone="green">✓ Previously entered — ready to update</Badge>
              ) : (
                <Badge tone="amber">New mark entry</Badge>
              )}
            </div>
            <p className="text-xs text-slate-500">
              Exam: <strong>{data?.exams.find((e) => String(e.id) === examId)?.name || "Selected Examination"}</strong> · Student: <strong>{studentForm.name || "Selected Student"}</strong>
            </p>
          </div>

          <Button onClick={handleSaveAll} loading={saving} size="sm">
            💾 Save Student &amp; Marks
          </Button>
        </div>

        {subjects.length === 0 ? (
          <div className="p-8 text-center">
            <EmptyState
              icon="📚"
              title="No subjects available"
              description="Please select a Class & Section to load assigned subjects with mark allotment."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 border-b border-slate-100">
                <tr>
                  <th className="px-5 py-3 font-semibold">Subject &amp; Mark Allotment</th>
                  <th className="px-3 py-3 font-semibold">Theory</th>
                  <th className="px-3 py-3 font-semibold text-emerald-800">Practical</th>
                  <th className="px-3 py-3 font-semibold text-brand-800">Internal</th>
                  <th className="px-3 py-3 font-semibold text-slate-900">Total (/100)</th>
                  <th className="px-3 py-3 text-center font-semibold">Absent</th>
                  <th className="px-5 py-3 text-right font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {subjects.map((sub, idx) => {
                  const d = marksDrafts[sub.id] ?? {
                    theoryScore: "",
                    practicalScore: "",
                    internalScore: "",
                    isAbsent: false,
                  };
                  const total = getDraftTotal(d);
                  const passed = total !== null && total >= sub.passMarks;

                  return (
                    <tr key={sub.id} className="transition hover:bg-slate-50/60">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-900">
                            {idx + 1}. {sub.name}
                          </span>
                          <span className="font-mono text-[10px] text-slate-400">({sub.code})</span>
                        </div>
                        <div className="mt-0.5">
                          {sub.hasPractical ? (
                            <span className="text-[11px] text-emerald-700 font-medium">
                              🔬 Practical: Theory /{sub.theoryMarks} · Prac /{sub.practicalMarks} · Int /{sub.internalMarks}
                            </span>
                          ) : (
                            <span className="text-[11px] text-slate-500">
                              📖 Theory /{sub.theoryMarks} · Int /{sub.internalMarks}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Theory input */}
                      <td className="px-3 py-3">
                        <input
                          type="number"
                          inputMode="numeric"
                          value={d.isAbsent ? "" : d.theoryScore}
                          disabled={d.isAbsent}
                          min={0}
                          max={sub.theoryMarks}
                          onChange={(e) => setDraft(sub.id, { theoryScore: e.target.value })}
                          className="w-20 rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm font-semibold tabular-nums text-slate-800 shadow-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100 disabled:bg-slate-100"
                          placeholder={`0-${sub.theoryMarks}`}
                        />
                      </td>

                      {/* Practical input (if hasPractical) */}
                      <td className="px-3 py-3">
                        {sub.hasPractical ? (
                          <input
                            type="number"
                            inputMode="numeric"
                            value={d.isAbsent ? "" : d.practicalScore}
                            disabled={d.isAbsent}
                            min={0}
                            max={sub.practicalMarks}
                            onChange={(e) => setDraft(sub.id, { practicalScore: e.target.value })}
                            className="w-20 rounded-lg border border-emerald-200 bg-emerald-50/40 px-2.5 py-1.5 text-sm font-semibold tabular-nums text-emerald-900 shadow-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100 disabled:bg-slate-100"
                            placeholder={`0-${sub.practicalMarks}`}
                          />
                        ) : (
                          <span className="text-xs text-slate-300 italic">—</span>
                        )}
                      </td>

                      {/* Internal input */}
                      <td className="px-3 py-3">
                        <input
                          type="number"
                          inputMode="numeric"
                          value={d.isAbsent ? "" : d.internalScore}
                          disabled={d.isAbsent}
                          min={0}
                          max={sub.internalMarks}
                          onChange={(e) => setDraft(sub.id, { internalScore: e.target.value })}
                          className="w-20 rounded-lg border border-violet-200 bg-violet-50/40 px-2.5 py-1.5 text-sm font-semibold tabular-nums text-violet-900 shadow-sm focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100 disabled:bg-slate-100"
                          placeholder={`0-${sub.internalMarks}`}
                        />
                      </td>

                      {/* Auto-sum Total */}
                      <td className="px-3 py-3 font-bold tabular-nums">
                        {d.isAbsent ? (
                          <span className="text-slate-400">—</span>
                        ) : total !== null ? (
                          <span
                            className={`rounded-md px-2 py-1 ${
                              passed ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-700"
                            }`}
                          >
                            {total} / 100
                          </span>
                        ) : (
                          <span className="text-slate-300">0</span>
                        )}
                      </td>

                      {/* Absent checkbox */}
                      <td className="px-3 py-3 text-center">
                        <input
                          type="checkbox"
                          checked={d.isAbsent}
                          onChange={(e) => setDraft(sub.id, { isAbsent: e.target.checked })}
                          className="h-4 w-4 rounded border-slate-300 text-rose-600 focus:ring-rose-400"
                        />
                      </td>

                      {/* Status */}
                      <td className="px-5 py-3 text-right">
                        {d.isAbsent ? (
                          <Badge tone="rose">Absent</Badge>
                        ) : total === null ? (
                          <Badge tone="slate">Pending</Badge>
                        ) : passed ? (
                          <Badge tone="green">{total}% Pass</Badge>
                        ) : (
                          <Badge tone="amber">{total}% Fail</Badge>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3.5 bg-slate-50/40">
          <p className="text-xs text-slate-500">
            Total out of 100 auto-sums in real time. Click Save to store both student details and examination marks.
          </p>
          <Button onClick={handleSaveAll} loading={saving}>
            💾 Save Student &amp; Marks
          </Button>
        </div>
      </Card>
    </>
  );
}

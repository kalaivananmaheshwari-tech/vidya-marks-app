"use client";

import Link from "next/link";
import { Fragment, useEffect, useMemo, useState } from "react";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Field,
  GradePill,
  Input,
  Modal,
  PageHeader,
  Select,
  TableSkeleton,
  useToast,
} from "@/components/ui";
import { apiRequest, useApi } from "@/lib/client";
import { gradeFor } from "@/lib/grades";

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
  rollNo: number; // Used as Exam No.
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

  // Track the highest or most recently entered Exam No. per class to allow automatic incrementing
  const [lastExamNoByClass, setLastExamNoByClass] = useState<Record<string, number>>({});

  // Student details form: Only Name, Exam No. (Roll No.), and Gender (no admission no, guardian, phone, dob)
  const [studentForm, setStudentForm] = useState({
    name: "",
    rollNo: "", // Exam No.
    gender: "Female",
  });

  // Marks inputs: subjectId -> MarkDraft
  const [marksDrafts, setMarksDrafts] = useState<Record<number, MarkDraft>>({});
  const [saving, setSaving] = useState(false);

  // Modal report state
  const [showReportModal, setShowReportModal] = useState(false);

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
        if (!studentId || !data.students.some((s) => String(s.id) === studentId)) {
          setStudentId(String(data.students[0].id));
        }
      } else if (data.students.length === 0) {
        setStudentMode("new");
        setStudentId("");
      }
    }
  }, [data?.students, studentId, studentMode]);

  // Auto-calculate the next Exam No. for this class & section
  const nextAutoExamNo = useMemo(() => {
    const studentsInClass = data?.students ?? [];
    const validNos = studentsInClass
      .map((s) => Number(s.rollNo))
      .filter((n) => !isNaN(n) && n > 0);
    const maxInClass = validNos.length > 0 ? Math.max(...validNos) : 0;
    const lastSaved = classId ? lastExamNoByClass[classId] ?? 0 : 0;
    const peak = Math.max(maxInClass, lastSaved);
    return peak > 0 ? String(peak + 1) : "";
  }, [data?.students, classId, lastExamNoByClass]);

  // When selected student or studentMode changes, update studentForm
  useEffect(() => {
    if (studentMode === "existing" && data?.selectedStudent) {
      const s = data.selectedStudent;
      setStudentForm({
        name: s.name,
        rollNo: String(s.rollNo),
        gender: s.gender,
      });
    } else if (studentMode === "new") {
      setStudentForm((prev) => ({
        name: "",
        rollNo: nextAutoExamNo || prev.rollNo || "",
        gender: "Female",
      }));
    }
  }, [data?.selectedStudent, studentMode, nextAutoExamNo]);

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

  // Restrict mark input: the user cannot input greater than the assigned marks
  function handleScoreChange(
    subId: number,
    field: "theoryScore" | "practicalScore" | "internalScore",
    rawVal: string,
    maxLimit: number,
    fieldTitle: string,
    inputEl?: HTMLInputElement,
  ) {
    if (rawVal === "") {
      setDraft(subId, { [field]: "" });
      return;
    }
    const num = Number(rawVal);
    if (isNaN(num)) return;
    if (num < 0) {
      if (inputEl) inputEl.value = "0";
      setDraft(subId, { [field]: "0" });
      return;
    }
    if (num > maxLimit) {
      toast.push(`Mark cannot exceed assigned ${fieldTitle} maximum (${maxLimit})`, "error");
      // Wipe the rejected value from the screen immediately. The DOM node is
      // cleared directly because React skips re-rendering when the state value
      // is unchanged (e.g. the field was already empty), which would otherwise
      // leave the out-of-range number visible in the input.
      if (inputEl) inputEl.value = "";
      setDraft(subId, { [field]: "" });
      return;
    }
    setDraft(subId, { [field]: rawVal });
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

        const parseAndClamp = (v: string, limit: number) => {
          if (v === "") return null;
          const n = Number(v);
          if (isNaN(n)) return null;
          return Math.min(Math.max(0, n), limit);
        };

        return {
          subjectId: sub.id,
          theoryScore: d.isAbsent ? null : parseAndClamp(d.theoryScore, sub.theoryMarks),
          practicalScore: d.isAbsent ? null : parseAndClamp(d.practicalScore, sub.practicalMarks),
          internalScore: d.isAbsent ? null : parseAndClamp(d.internalScore, sub.internalMarks),
          isAbsent: d.isAbsent,
        };
      });

      const enteredExamNo = studentForm.rollNo ? Number(studentForm.rollNo) : null;

      const res = await apiRequest<{ student: StudentListItem; savedMarksCount: number }>(
        "/api/student-entry",
        {
          method: "POST",
          body: JSON.stringify({
            classId: Number(classId),
            studentId: studentMode === "existing" && studentId ? Number(studentId) : null,
            name: studentForm.name.trim(),
            rollNo: enteredExamNo,
            gender: studentForm.gender,
            examId: examId ? Number(examId) : null,
            marks: examId ? marksPayload : [],
          }),
        },
      );

      // Track last saved Exam No for this class so next student increments automatically
      if (enteredExamNo) {
        setLastExamNoByClass((prev) => ({
          ...prev,
          [classId]: enteredExamNo,
        }));
      }

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

  // Switch to new student entry and prefill next auto-incremented Exam No
  function switchToNewStudent() {
    setStudentMode("new");
    setStudentId("");
    const nextNo = nextAutoExamNo;
    setStudentForm({
      name: "",
      rollNo: nextNo,
      gender: "Female",
    });
  }

  return (
    <>
      <PageHeader
        icon="📝"
        title="Student Entry & Marks"
        subtitle="Select class, section & exam. Auto-incremented Exam No., auto-assigned subjects, multi-exam report and restricted mark entry."
        actions={
          <div className="flex items-center gap-2">
            {previousExams.length > 0 ? (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowReportModal(true)}
                className="border-violet-300 bg-violet-50 text-violet-900 hover:bg-violet-100"
              >
                📊 Click Report (Table Format)
              </Button>
            ) : null}
            <Link href="/students">
              <Button variant="secondary" size="sm">
                🎓 Students Register
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
                <span className="text-xs font-medium text-slate-600 truncate">
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
              Includes TNSPARK. Practical = Yes: Theory 70 + Practical 20 + Internal 10. Practical = No: Theory 90 + Internal 10.
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
              Pick an existing student by Exam No. OR admit a new student with auto-incremented Exam No.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {previousExams.length > 0 ? (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowReportModal(true)}
                className="border-violet-300 bg-violet-50 text-violet-900 hover:bg-violet-100"
              >
                📊 Click Report
              </Button>
            ) : null}

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
                onClick={switchToNewStudent}
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
        </div>

        {studentMode === "existing" ? (
          <div className="mt-4">
            <Field label="Choose Student from this class (by Exam No.)">
              <Select value={studentId} onChange={(e) => setStudentId(e.target.value)}>
                {students.map((s) => (
                  <option key={s.id} value={s.id}>
                    Exam No. {s.rollNo}: {s.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        ) : null}

        {/* Clean Student Inputs: Only Name, Exam No., and Gender */}
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <Field label="Student Full Name">
            <Input
              value={studentForm.name}
              onChange={(e) => setStudentForm({ ...studentForm, name: e.target.value })}
              placeholder="e.g. Ananya Raman"
              required
            />
          </Field>

          <Field
            label="Exam No."
            hint={
              studentMode === "new"
                ? nextAutoExamNo
                  ? `Auto-incremented from previous Exam No. in this class & section`
                  : `Enter initial Exam No. (e.g. 1001). Next students will auto-increment.`
                : "Student examination registration number"
            }
          >
            <Input
              type="number"
              value={studentForm.rollNo}
              onChange={(e) => setStudentForm({ ...studentForm, rollNo: e.target.value })}
              placeholder={nextAutoExamNo || "e.g. 1001"}
              min={1}
              required
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

        {studentMode === "new" ? (
          <div className="mt-3 flex items-center justify-between rounded-xl bg-amber-50/70 border border-amber-200/80 px-4 py-2.5 text-xs text-amber-900">
            <div className="flex items-center gap-2">
              <span>💡</span>
              <span>
                <strong>Auto-increment feature:</strong> Enter the first Exam No. for student 1 in this class &amp; section. When you add the next student, the Exam No. automatically increments by 1.
              </span>
            </div>
            {studentForm.rollNo ? (
              <span className="font-semibold text-amber-800">
                Next student will be #{Number(studentForm.rollNo) + 1}
              </span>
            ) : null}
          </div>
        ) : null}
      </Card>

      {/* Step 4: EXAMINATION MARKS REPORT (TABLE FORMAT) */}
      {studentMode === "existing" && studentId ? (
        <Card className="border-violet-200 bg-gradient-to-br from-violet-50/30 via-white to-brand-50/20">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-violet-100 pb-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base">📊</span>
                <h2 className="text-sm font-bold uppercase tracking-wide text-violet-950">
                  Exam Marks Report (Multi-Exam Table Format)
                </h2>
              </div>
              <p className="text-xs text-slate-600">
                Exam marks shown in table format: first column Subjects, next columns divided into corresponding exams with Marks, % and Grade.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowReportModal(true)}
                className="border-violet-300 bg-white text-violet-900 hover:bg-violet-50 shadow-sm"
              >
                🔍 Open in Movable Window
              </Button>
              <Badge tone="brand">
                {previousExams.length} Exam{previousExams.length === 1 ? "" : "s"} on Record
              </Badge>
            </div>
          </div>

          {previousExams.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-xs text-slate-400 italic">
                No examination marks recorded yet for <strong>{studentForm.name || "this student"}</strong>. Enter marks below in Step 4 and click Save.
              </p>
            </div>
          ) : (
            <div className="mt-4">
              {/* SIDE-BY-SIDE MULTI-EXAM TABLE */}
              <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-sm">
                <table className="w-full min-w-[720px] text-xs border-collapse">
                  <thead>
                    {/* Primary Header Row: Subjects & Exam Names */}
                    <tr className="bg-slate-100/90 text-slate-800">
                      <th
                        rowSpan={2}
                        className="border border-slate-200 px-4 py-2.5 text-left font-bold text-slate-900 bg-slate-100"
                      >
                        Subjects
                      </th>
                      {previousExams.map((pExam) => (
                        <th
                          key={pExam.examId}
                          colSpan={3}
                          className="border border-slate-200 px-3 py-2 text-center font-bold bg-violet-100/70 text-violet-950"
                        >
                          {pExam.examName} {pExam.month ? `(${pExam.month})` : ""}
                        </th>
                      ))}
                    </tr>
                    {/* Secondary Sub-columns: Marks, %, Grade */}
                    <tr className="bg-slate-50 text-slate-600 font-semibold">
                      {previousExams.map((pExam) => (
                        <Fragment key={pExam.examId}>
                          <th className="border border-slate-200 px-2 py-1.5 text-center">Marks</th>
                          <th className="border border-slate-200 px-2 py-1.5 text-center">%</th>
                          <th className="border border-slate-200 px-2 py-1.5 text-center">Grade</th>
                        </Fragment>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {subjects.map((sub, idx) => (
                      <tr key={sub.id} className="transition hover:bg-slate-50/70">
                        <td className="border border-slate-200 px-4 py-2 font-medium text-slate-800">
                          <span className="font-semibold text-slate-900">{idx + 1}. {sub.name}</span>{" "}
                          <span className="font-mono text-[10px] text-slate-400">({sub.code})</span>
                        </td>
                        {previousExams.map((pExam) => {
                          const m = pExam.marks.find((mk) => mk.subjectId === sub.id);
                          if (!m) {
                            return (
                              <Fragment key={pExam.examId}>
                                <td className="border border-slate-200 px-2 py-2 text-center text-slate-300">—</td>
                                <td className="border border-slate-200 px-2 py-2 text-center text-slate-300">—</td>
                                <td className="border border-slate-200 px-2 py-2 text-center text-slate-300">—</td>
                              </Fragment>
                            );
                          }
                          if (m.isAbsent) {
                            return (
                              <Fragment key={pExam.examId}>
                                <td className="border border-slate-200 px-2 py-2 text-center font-bold text-rose-600">AB</td>
                                <td className="border border-slate-200 px-2 py-2 text-center text-slate-400">—</td>
                                <td className="border border-slate-200 px-2 py-2 text-center font-bold text-rose-600">AB</td>
                              </Fragment>
                            );
                          }

                          const score = m.score ?? 0;
                          const max = m.totalMax || 100;
                          const pct = Math.round((score / max) * 100);
                          const gr = gradeFor(pct).grade;

                          return (
                            <Fragment key={pExam.examId}>
                              <td className="border border-slate-200 px-2 py-2 text-center font-semibold tabular-nums text-slate-800">
                                {score}
                              </td>
                              <td className="border border-slate-200 px-2 py-2 text-center tabular-nums text-slate-600">
                                {pct}%
                              </td>
                              <td className="border border-slate-200 px-2 py-2 text-center">
                                <span
                                  className={`inline-block rounded px-1.5 py-0.5 text-[11px] font-bold ${
                                    m.passed
                                      ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
                                      : "bg-rose-50 text-rose-700 ring-1 ring-rose-200"
                                  }`}
                                >
                                  {gr}
                                </span>
                              </td>
                            </Fragment>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="border-t-2 border-slate-300 bg-slate-50 font-bold text-slate-900">
                    {/* Total Marks */}
                    <tr>
                      <td className="border border-slate-200 px-4 py-2 font-bold text-slate-900 bg-slate-100/60">
                        Total Marks
                      </td>
                      {previousExams.map((pExam) => (
                        <td
                          key={pExam.examId}
                          colSpan={3}
                          className="border border-slate-200 px-2 py-2 text-center tabular-nums font-bold text-slate-900"
                        >
                          {pExam.total} / {pExam.maxTotal}
                        </td>
                      ))}
                    </tr>

                    {/* Percentage */}
                    <tr>
                      <td className="border border-slate-200 px-4 py-2 font-bold text-slate-900 bg-slate-100/60">
                        Percentage (%)
                      </td>
                      {previousExams.map((pExam) => (
                        <td
                          key={pExam.examId}
                          colSpan={3}
                          className="border border-slate-200 px-2 py-2 text-center tabular-nums font-bold text-brand-700"
                        >
                          {pExam.percentage}%
                        </td>
                      ))}
                    </tr>

                    {/* Overall Grade */}
                    <tr>
                      <td className="border border-slate-200 px-4 py-2 font-bold text-slate-900 bg-slate-100/60">
                        Overall Grade
                      </td>
                      {previousExams.map((pExam) => (
                        <td
                          key={pExam.examId}
                          colSpan={3}
                          className="border border-slate-200 px-2 py-2 text-center"
                        >
                          <GradePill grade={pExam.grade} />
                        </td>
                      ))}
                    </tr>

                    {/* Result */}
                    <tr>
                      <td className="border border-slate-200 px-4 py-2 font-bold text-slate-900 bg-slate-100/60">
                        Result
                      </td>
                      {previousExams.map((pExam) => (
                        <td
                          key={pExam.examId}
                          colSpan={3}
                          className="border border-slate-200 px-2 py-2 text-center"
                        >
                          <Badge tone={pExam.passed ? "green" : "rose"}>
                            {pExam.passed ? "Passed" : "Arrear(s)"}
                          </Badge>
                        </td>
                      ))}
                    </tr>
                  </tfoot>
                </table>
              </div>
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
              Exam: <strong>{data?.exams.find((e) => String(e.id) === examId)?.name || "Selected Examination"}</strong> · Student: <strong>{studentForm.name || "Selected Student"} (Exam No: {studentForm.rollNo || "—"})</strong>
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button onClick={switchToNewStudent} variant="secondary" size="sm">
              ➕ Add Next Student
            </Button>
            <Button onClick={handleSaveAll} loading={saving} size="sm">
              💾 Save Student &amp; Marks
            </Button>
          </div>
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
                  <th className="px-3 py-3 font-semibold">Theory (Max)</th>
                  <th className="px-3 py-3 font-semibold text-emerald-800">Practical (Max)</th>
                  <th className="px-3 py-3 font-semibold text-brand-800">Internal (Max)</th>
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

                      {/* Theory input with strict upper bound validation */}
                      <td className="px-3 py-3">
                        <input
                          type="number"
                          inputMode="numeric"
                          value={d.isAbsent ? "" : d.theoryScore}
                          disabled={d.isAbsent}
                          min={0}
                          max={sub.theoryMarks}
                          onChange={(e) =>
                            handleScoreChange(
                              sub.id,
                              "theoryScore",
                              e.target.value,
                              sub.theoryMarks,
                              "Theory",
                              e.currentTarget,
                            )
                          }
                          className="w-24 rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm font-semibold tabular-nums text-slate-800 shadow-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100 disabled:bg-slate-100"
                          placeholder={`0-${sub.theoryMarks}`}
                        />
                      </td>

                      {/* Practical input (if hasPractical) with strict upper bound validation */}
                      <td className="px-3 py-3">
                        {sub.hasPractical ? (
                          <input
                            type="number"
                            inputMode="numeric"
                            value={d.isAbsent ? "" : d.practicalScore}
                            disabled={d.isAbsent}
                            min={0}
                            max={sub.practicalMarks}
                            onChange={(e) =>
                              handleScoreChange(
                                sub.id,
                                "practicalScore",
                                e.target.value,
                                sub.practicalMarks,
                                "Practical",
                              )
                            }
                            className="w-24 rounded-lg border border-emerald-200 bg-emerald-50/40 px-2.5 py-1.5 text-sm font-semibold tabular-nums text-emerald-900 shadow-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100 disabled:bg-slate-100"
                            placeholder={`0-${sub.practicalMarks}`}
                          />
                        ) : (
                          <span className="text-xs text-slate-300 italic">—</span>
                        )}
                      </td>

                      {/* Internal input with strict upper bound validation */}
                      <td className="px-3 py-3">
                        <input
                          type="number"
                          inputMode="numeric"
                          value={d.isAbsent ? "" : d.internalScore}
                          disabled={d.isAbsent}
                          min={0}
                          max={sub.internalMarks}
                          onChange={(e) =>
                            handleScoreChange(
                              sub.id,
                              "internalScore",
                              e.target.value,
                              sub.internalMarks,
                              "Internal",
                            )
                          }
                          className="w-24 rounded-lg border border-violet-200 bg-violet-50/40 px-2.5 py-1.5 text-sm font-semibold tabular-nums text-violet-900 shadow-sm focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100 disabled:bg-slate-100"
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

        <div className="flex flex-wrap items-center justify-between border-t border-slate-100 px-5 py-3.5 bg-slate-50/40 gap-2">
          <p className="text-xs text-slate-500">
            Total out of 100 auto-sums in real time. Input cannot exceed assigned marks. Click Save to record.
          </p>
          <div className="flex items-center gap-2">
            <Button onClick={switchToNewStudent} variant="secondary" size="sm">
              ➕ Add Next Student
            </Button>
            <Button onClick={handleSaveAll} loading={saving}>
              💾 Save Student &amp; Marks
            </Button>
          </div>
        </div>
      </Card>

      {/* MOVABLE REPORT MODAL (When clicking "Click Report") */}
      <Modal
        open={showReportModal}
        onClose={() => setShowReportModal(false)}
        title={`Exam Marks Report — ${studentForm.name || "Student"} (Exam No: ${studentForm.rollNo || "—"})`}
        description={`Class & Section: ${selectedClass?.name || ""} - ${selectedClass?.section || ""} | All Examinations Comparison Table`}
        width="max-w-5xl"
        footer={
          <div className="flex items-center justify-between w-full">
            <span className="text-xs text-slate-500">
              Exam No: <strong>{studentForm.rollNo}</strong> · {studentForm.name}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                onClick={() => {
                  if (typeof window !== "undefined") window.print();
                }}
              >
                🖨️ Print Report
              </Button>
              <Button onClick={() => setShowReportModal(false)}>
                Close
              </Button>
            </div>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200/80 bg-slate-50/60 p-3.5 flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-base font-bold text-slate-900">{studentForm.name || "Student Name"}</p>
              <p className="text-xs text-slate-600">
                Exam No: <strong className="font-mono text-slate-900">{studentForm.rollNo}</strong> · Gender: <strong>{studentForm.gender}</strong> · Class: <strong>{selectedClass?.name} - {selectedClass?.section}</strong>
              </p>
            </div>
            <Badge tone="brand">{previousExams.length} Examinations on Record</Badge>
          </div>

          {previousExams.length === 0 ? (
            <p className="py-6 text-center text-xs text-slate-400 italic">
              No examination marks recorded yet for this student.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-slate-800">
                    <th
                      rowSpan={2}
                      className="border border-slate-200 px-4 py-2.5 text-left font-bold text-slate-900 bg-slate-100"
                    >
                      Subjects
                    </th>
                    {previousExams.map((pExam) => (
                      <th
                        key={pExam.examId}
                        colSpan={3}
                        className="border border-slate-200 px-3 py-2 text-center font-bold bg-violet-100/70 text-violet-950"
                      >
                        {pExam.examName} {pExam.month ? `(${pExam.month})` : ""}
                      </th>
                    ))}
                  </tr>
                  <tr className="bg-slate-50 text-slate-600 font-semibold">
                    {previousExams.map((pExam) => (
                      <Fragment key={pExam.examId}>
                        <th className="border border-slate-200 px-2 py-1.5 text-center">Marks</th>
                        <th className="border border-slate-200 px-2 py-1.5 text-center">%</th>
                        <th className="border border-slate-200 px-2 py-1.5 text-center">Grade</th>
                      </Fragment>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {subjects.map((sub, idx) => (
                    <tr key={sub.id} className="transition hover:bg-slate-50/70">
                      <td className="border border-slate-200 px-4 py-2 font-medium text-slate-800">
                        <span className="font-semibold text-slate-900">{idx + 1}. {sub.name}</span>{" "}
                        <span className="font-mono text-[10px] text-slate-400">({sub.code})</span>
                      </td>
                      {previousExams.map((pExam) => {
                        const m = pExam.marks.find((mk) => mk.subjectId === sub.id);
                        if (!m) {
                          return (
                            <Fragment key={pExam.examId}>
                              <td className="border border-slate-200 px-2 py-2 text-center text-slate-300">—</td>
                              <td className="border border-slate-200 px-2 py-2 text-center text-slate-300">—</td>
                              <td className="border border-slate-200 px-2 py-2 text-center text-slate-300">—</td>
                            </Fragment>
                          );
                        }
                        if (m.isAbsent) {
                          return (
                            <Fragment key={pExam.examId}>
                              <td className="border border-slate-200 px-2 py-2 text-center font-bold text-rose-600">AB</td>
                              <td className="border border-slate-200 px-2 py-2 text-center text-slate-400">—</td>
                              <td className="border border-slate-200 px-2 py-2 text-center font-bold text-rose-600">AB</td>
                            </Fragment>
                          );
                        }

                        const score = m.score ?? 0;
                        const max = m.totalMax || 100;
                        const pct = Math.round((score / max) * 100);
                        const gr = gradeFor(pct).grade;

                        return (
                          <Fragment key={pExam.examId}>
                            <td className="border border-slate-200 px-2 py-2 text-center font-semibold tabular-nums text-slate-800">
                              {score}
                            </td>
                            <td className="border border-slate-200 px-2 py-2 text-center tabular-nums text-slate-600">
                              {pct}%
                            </td>
                            <td className="border border-slate-200 px-2 py-2 text-center">
                              <span
                                className={`inline-block rounded px-1.5 py-0.5 text-[11px] font-bold ${
                                  m.passed
                                    ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
                                    : "bg-rose-50 text-rose-700 ring-1 ring-rose-200"
                                }`}
                              >
                                {gr}
                              </span>
                            </td>
                          </Fragment>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t-2 border-slate-300 bg-slate-50 font-bold text-slate-900">
                  <tr>
                    <td className="border border-slate-200 px-4 py-2 font-bold text-slate-900 bg-slate-100/60">
                      Total Marks
                    </td>
                    {previousExams.map((pExam) => (
                      <td
                        key={pExam.examId}
                        colSpan={3}
                        className="border border-slate-200 px-2 py-2 text-center tabular-nums font-bold text-slate-900"
                      >
                        {pExam.total} / {pExam.maxTotal}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="border border-slate-200 px-4 py-2 font-bold text-slate-900 bg-slate-100/60">
                      Percentage (%)
                    </td>
                    {previousExams.map((pExam) => (
                      <td
                        key={pExam.examId}
                        colSpan={3}
                        className="border border-slate-200 px-2 py-2 text-center tabular-nums font-bold text-brand-700"
                      >
                        {pExam.percentage}%
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="border border-slate-200 px-4 py-2 font-bold text-slate-900 bg-slate-100/60">
                      Overall Grade
                    </td>
                    {previousExams.map((pExam) => (
                      <td
                        key={pExam.examId}
                        colSpan={3}
                        className="border border-slate-200 px-2 py-2 text-center"
                      >
                        <GradePill grade={pExam.grade} />
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="border border-slate-200 px-4 py-2 font-bold text-slate-900 bg-slate-100/60">
                      Result
                    </td>
                    {previousExams.map((pExam) => (
                      <td
                        key={pExam.examId}
                        colSpan={3}
                        className="border border-slate-200 px-2 py-2 text-center"
                      >
                        <Badge tone={pExam.passed ? "green" : "rose"}>
                          {pExam.passed ? "Passed" : "Arrear(s)"}
                        </Badge>
                      </td>
                    ))}
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      </Modal>
    </>
  );
}

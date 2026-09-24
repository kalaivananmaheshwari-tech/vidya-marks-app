export type GroupRow = {
  id: number;
  code: string;
  name: string;
  stream: string;
  description: string | null;
  classCount: number;
  subjectCount: number;
  studentCount: number;
};

export type ClassListRow = {
  id: number;
  name: string;
  section: string;
  groupId: number | null;
  groupCode: string | null;
  groupName: string | null;
  stream: string | null;
  academicYear: string;
  room: string | null;
  classTeacherId: number | null;
  classTeacher: string | null;
  studentCount: number;
};

export type SubjectRow = {
  id: number;
  code: string;
  name: string;
  groupId: number | null;
  groupCode: string | null;
  groupName: string | null;
  classId: number | null;
  hasPractical: boolean;
  theoryMarks: number;
  practicalMarks: number;
  internalMarks: number;
  maxMarks: number;
  passMarks: number;
  teacherId: number | null;
  teacherName: string | null;
  markCount: number;
};

export type ExamRow = {
  id: number;
  name: string;
  month: string | null;
  year: string | null;
  term: string;
  academicYear: string;
  maxMarks: number;
  startDate: string | null;
  isPublished: boolean;
  markCount: number;
};

export type StudentRow = {
  id: number;
  admissionNo: string;
  name: string;
  rollNo: number;
  gender: string;
  dob: string | null;
  classId: number;
  className: string;
  section: string;
  groupCode: string | null;
  guardianName: string | null;
  contact: string | null;
  avgPercentage: number;
};

export type TeacherRow = {
  id: number;
  name: string;
  username: string;
  email: string | null;
  role: string;
  designation: string | null;
  phone: string | null;
  handlingSubjects: string | null;
  isActive: boolean;
  lastLoginAt: string | null;
  classCount: number;
  subjectCount: number;
};

export type MarkAssignItem = {
  id: number;
  code: string;
  name: string;
  hasPractical: boolean;
  theoryMarks: number;
  practicalMarks: number;
  internalMarks: number;
  maxMarks: number;
  passMarks: number;
  teacherId: number | null;
  teacherName: string | null;
};

export type SchoolRow = {
  id: number;
  name: string;
  udiseCode: string;
  district: string | null;
  state: string | null;
  academicYear: string;
};

export type StudentTotalRow = {
  studentId: number;
  studentName: string;
  admissionNo: string;
  rollNo: number;
  classId: number;
  classLabel: string;
  total: number;
  maxTotal: number;
  percentage: number;
  grade: string;
  subjectsCount: number;
  failedSubjects: number;
  rank: number;
};

export type OverviewResponse = {
  kpis: {
    students: number;
    classes: number;
    subjects: number;
    exams: number;
    staff: number;
    average: number;
    passRate: number;
    distinctionRate: number;
    marksEntered: number;
    absent: number;
  };
  classComparison: Array<{
    classId: number;
    label: string;
    groupCode: string | null;
    average: number;
    passRate: number;
    students: number;
  }>;
  subjectSnapshot: Array<{
    subjectId: number;
    name: string;
    code: string;
    average: number;
    passRate: number;
    attempts: number;
  }>;
  gradeDistribution: Array<{ grade: string; label: string; color: string; count: number }>;
  examTrend: Array<{ examId: number; name: string; average: number; passRate: number }>;
  topStudents: StudentTotalRow[];
  needsAttention: StudentTotalRow[];
};

export type SubjectAnalysisRow = {
  subjectId: number;
  name: string;
  code: string;
  attempts: number;
  average: number;
  highest: number;
  lowest: number;
  passRate: number;
  failCount: number;
  distinction: number;
  absent: number;
  topper: { name: string; score: number; classLabel: string } | null;
  grades: Record<string, number>;
  classSplit: Array<{ classLabel: string; average: number; passRate: number }>;
};

export type ClassAnalysisRow = {
  classId: number;
  className: string;
  section: string;
  label: string;
  groupCode: string | null;
  students: number;
  average: number;
  passRate: number;
  highest: number;
  lowest: number;
  distinction: number;
  failCount: number;
  grades: Record<string, number>;
  toppers: StudentTotalRow[];
  strongest: { subjectId: number; name: string; code: string; average: number; passRate: number } | null;
  weakest: { subjectId: number; name: string; code: string; average: number; passRate: number } | null;
  subjectStats: Array<{ subjectId: number; name: string; code: string; average: number; passRate: number }>;
};

export type SectionAnalysisGrade = {
  grade: string;
  average: number;
  passRate: number;
  students: number;
  spread: number;
  sections: Array<{
    section: string;
    classId: number;
    groupCode: string | null;
    students: number;
    average: number;
    passRate: number;
    highest: number;
    distinction: number;
    failCount: number;
    topper: StudentTotalRow | null;
    grades: Record<string, number>;
  }>;
};

export type StudentReport = {
  profile: {
    id: number;
    name: string;
    admissionNo: string;
    rollNo: number;
    gender: string;
    guardianName: string | null;
    contact: string | null;
    classId: number;
    className: string;
    section: string;
  };
  examCards: Array<{
    examId: number;
    examName: string;
    total: number;
    maxTotal: number;
    percentage: number;
    grade: string;
    rank: number | null;
    classSize: number;
    subjects: Array<{
      subjectId: number;
      name: string;
      code: string;
      score: number | null;
      maxMarks: number;
      isAbsent: boolean;
      percentage: number;
      grade: string;
      passed: boolean;
    }>;
  }>;
  overall: {
    attempts: number;
    average: number;
    highest: number;
    lowest: number;
    passRate: number;
    distinction: number;
    grades: Record<string, number>;
  };
  subjectTrend: Array<{ name: string; average: number; points: Array<{ exam: string; value: number }> }>;
};

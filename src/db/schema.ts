import {
  boolean,
  date,
  integer,
  pgTable,
  real,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/** A registered school. The 11-digit UDISE code is the admin's login username. */
export const schools = pgTable("schools", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  udiseCode: text("udise_code").notNull().unique(),
  district: text("district"),
  state: text("state"),
  email: text("email"),
  phone: text("phone"),
  academicYear: text("academic_year").notNull().default("2026-2027"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Staff logins.
 * - role "admin"   -> school admin (Principal / Headmaster), username = school UDISE code
 * - role "teacher" -> created by the admin, with a username + password issued by the admin
 */
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  schoolId: integer("school_id")
    .notNull()
    .references(() => schools.id, { onDelete: "cascade" }),
  username: text("username").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").notNull().default("teacher"),
  designation: text("designation"),
  email: text("email"),
  phone: text("phone"),
  handlingSubjects: text("handling_subjects"),
  isActive: boolean("is_active").notNull().default(true),
  mustChangePassword: boolean("must_change_password").notNull().default(false),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const sessions = pgTable("sessions", {
  token: text("token").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Group codes (streams) e.g. G102, 2502 - Bio-Maths group for Classes 11 & 12. Scoped per school. */
export const groups = pgTable(
  "groups",
  {
    id: serial("id").primaryKey(),
    schoolId: integer("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "cascade" }),
    code: text("code").notNull(),
    name: text("name").notNull(),
    stream: text("stream").notNull().default("General"),
    description: text("description"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("groups_school_code_idx").on(t.schoolId, t.code)],
);

export const classes = pgTable(
  "classes",
  {
    id: serial("id").primaryKey(),
    schoolId: integer("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    section: text("section").notNull().default("A"),
    groupId: integer("group_id").references(() => groups.id, { onDelete: "set null" }),
    academicYear: text("academic_year").notNull().default("2025-2026"),
    room: text("room"),
    classTeacherId: integer("class_teacher_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("classes_school_unique_idx").on(t.schoolId, t.name, t.section, t.academicYear)],
);

/**
 * Subjects.
 * - hasPractical: if true -> Theory: 70, Practical: 20, Internal: 10 (Total 100)
 *                 otherwise -> Theory: 90, Internal: 10 (Total 100)
 */
export const subjects = pgTable(
  "subjects",
  {
    id: serial("id").primaryKey(),
    schoolId: integer("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "cascade" }),
    classId: integer("class_id").references(() => classes.id, { onDelete: "cascade" }),
    code: text("code").notNull(),
    name: text("name").notNull(),
    groupId: integer("group_id").references(() => groups.id, { onDelete: "cascade" }),
    hasPractical: boolean("has_practical").notNull().default(false),
    theoryMarks: integer("theory_marks").notNull().default(90),
    practicalMarks: integer("practical_marks").notNull().default(0),
    internalMarks: integer("internal_marks").notNull().default(10),
    maxMarks: integer("max_marks").notNull().default(100),
    passMarks: integer("pass_marks").notNull().default(35),
    teacherId: integer("teacher_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("subjects_school_code_idx").on(t.schoolId, t.code)],
);

export const students = pgTable(
  "students",
  {
    id: serial("id").primaryKey(),
    schoolId: integer("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "cascade" }),
    admissionNo: text("admission_no").notNull(),
    emisId: text("emis_id"),
    name: text("name").notNull(),
    rollNo: integer("roll_no").notNull().default(1),
    gender: text("gender").notNull().default("Female"),
    dob: date("dob"),
    classId: integer("class_id")
      .notNull()
      .references(() => classes.id, { onDelete: "cascade" }),
    guardianName: text("guardian_name"),
    contact: text("contact"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("students_school_admission_idx").on(t.schoolId, t.admissionNo)],
);

export const exams = pgTable("exams", {
  id: serial("id").primaryKey(),
  schoolId: integer("school_id")
    .notNull()
    .references(() => schools.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  month: text("month"),
  year: text("year"),
  term: text("term").notNull().default("Term 1"),
  academicYear: text("academic_year").notNull().default("2026-2027"),
  maxMarks: integer("max_marks").notNull().default(100),
  startDate: date("start_date"),
  isPublished: boolean("is_published").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const marks = pgTable(
  "marks",
  {
    id: serial("id").primaryKey(),
    schoolId: integer("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "cascade" }),
    studentId: integer("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    subjectId: integer("subject_id")
      .notNull()
      .references(() => subjects.id, { onDelete: "cascade" }),
    examId: integer("exam_id")
      .notNull()
      .references(() => exams.id, { onDelete: "cascade" }),
    theoryScore: real("theory_score"),
    practicalScore: real("practical_score"),
    internalScore: real("internal_score"),
    faAScore: real("fa_a_score"),
    faBScore: real("fa_b_score"),
    saScore: real("sa_score"),
    score: real("score"),
    isAbsent: boolean("is_absent").notNull().default(false),
    enteredById: integer("entered_by_id").references(() => users.id, { onDelete: "set null" }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("marks_unique_idx").on(t.studentId, t.subjectId, t.examId)],
);

export type School = typeof schools.$inferSelect;
export type User = typeof users.$inferSelect;
export type Group = typeof groups.$inferSelect;
export type ClassRow = typeof classes.$inferSelect;
export type Subject = typeof subjects.$inferSelect;
export type Student = typeof students.$inferSelect;
export type Exam = typeof exams.$inferSelect;
export type Mark = typeof marks.$inferSelect;

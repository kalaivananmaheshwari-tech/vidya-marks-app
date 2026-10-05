import {
  boolean,
  date,
  integer,
  pgTable,
  real,
  numeric,
  serial,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  jsonb,
  index,
  foreignKey,
} from "drizzle-orm/pg-core";

/** A registered school. The 11-digit UDISE code is the admin's login username. */
export const schools = pgTable("schools", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  udiseCode: text("udise_code").notNull().unique(),
  district: text("district"),
  educationalDistrict: text("educational_district"),
  block: text("block"),
  management: text("management"),
  schoolType: text("school_type"),
  adminContactNumber: text("admin_contact_number"),
  academicYearId: uuid("academic_year_id"),
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
  schoolId: integer("school_id").references(() => schools.id, { onDelete: "cascade" }),
  userType: text("user_type"),
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
  membershipId: uuid("membership_id"),
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
    archivedAt: timestamp("archived_at", { withTimezone: true }),
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
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    schoolId: integer("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    section: text("section").notNull().default("A"),
    groupId: integer("group_id").references(() => groups.id, { onDelete: "set null" }),
    academicYearId: uuid("academic_year_id"),
    academicYear: text("academic_year").notNull().default("2026-2027"),
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
    archivedAt: timestamp("archived_at", { withTimezone: true }),
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
    uuid: uuid("uuid").notNull().defaultRandom().unique(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    schoolId: integer("school_id")
      .notNull()
      .references(() => schools.id, { onDelete: "cascade" }),
    admissionNo: text("admission_no").notNull(),
    emisId: text("emis_id"),
    medium: text("medium"),
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
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  schoolId: integer("school_id")
    .notNull()
    .references(() => schools.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  month: text("month"),
  year: text("year"),
  term: text("term").notNull().default("Term 1"),
  academicYearId: uuid("academic_year_id"),
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
    studentUuid: uuid("student_uuid"),
    enrollmentId: uuid("enrollment_id"),
    classSectionId: uuid("class_section_id"),
    classSubjectId: uuid("class_subject_id"),
    allocationId: uuid("allocation_id"),
    allocationSnapshot: jsonb("allocation_snapshot").$type<Record<string, unknown>>(),
    status: text("status").notNull().default("PENDING"),
    isExempt: boolean("is_exempt").notNull().default(false),
    theoryScore: real("theory_score"),
    practicalScore: real("practical_score"),
    internalScore: real("internal_score"),
    faAScore: real("fa_a_score"),
    faBScore: real("fa_b_score"),
    saScore: real("sa_score"),
    score: real("score"),
    scoreExact:numeric("score_exact",{mode:"number"}),
    theoryScoreExact:numeric("theory_score_exact",{mode:"number"}),
    practicalScoreExact:numeric("practical_score_exact",{mode:"number"}),
    internalScoreExact:numeric("internal_score_exact",{mode:"number"}),
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

/** Relational additions. Legacy integer IDs and tables stay intact for compatibility. */
export const academicYears = pgTable("academic_years", {
  id: uuid("id").primaryKey().defaultRandom(),
  label: text("label").notNull().unique(),
  startYear: integer("start_year").notNull().unique(),
  endYear: integer("end_year").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
export const userIdentities = pgTable("user_identities", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: integer("user_id").notNull().references(() => users.id),
  provider: text("provider").notNull().default("password"),
  subject: text("subject").notNull(),
}, (t) => [uniqueIndex("identities_provider_subject_idx").on(t.provider, t.subject)]);
export const schoolMemberships = pgTable("school_memberships", {
  id: uuid("id").primaryKey().defaultRandom(),
  schoolId: integer("school_id").notNull().references(() => schools.id),
  userId: integer("user_id").notNull().references(() => users.id),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex("memberships_school_user_idx").on(t.schoolId, t.userId), uniqueIndex("memberships_school_id_idx").on(t.schoolId, t.id)]);
export const membershipRoles = pgTable("membership_roles", {
  id: uuid("id").primaryKey().defaultRandom(),
  membershipId: uuid("membership_id").notNull().references(() => schoolMemberships.id),
  role: text("role").notNull(),
}, (t) => [uniqueIndex("membership_roles_unique_idx").on(t.membershipId, t.role)]);
export const teacherProfiles = pgTable("teacher_profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  schoolId: integer("school_id").notNull().references(() => schools.id),
  userId: integer("user_id").notNull().references(() => users.id),
  membershipId: uuid("membership_id").notNull(),
}, (t) => [uniqueIndex("teacher_profiles_school_user_idx").on(t.schoolId, t.userId), uniqueIndex("teacher_profiles_school_id_idx").on(t.schoolId, t.id),
  foreignKey({ name: "teacher_profiles_membership_scope_fk", columns: [t.schoolId, t.membershipId], foreignColumns: [schoolMemberships.schoolId, schoolMemberships.id] })]);
export const sections = pgTable("sections", {
  id: uuid("id").primaryKey().defaultRandom(),
  schoolId: integer("school_id").notNull().references(() => schools.id),
  name: text("name").notNull(),
}, (t) => [uniqueIndex("sections_school_name_idx").on(t.schoolId, t.name), uniqueIndex("sections_school_id_idx").on(t.schoolId, t.id)]);
export const classSections = pgTable("class_sections", {
  id: uuid("id").primaryKey().defaultRandom(),
  schoolId: integer("school_id").notNull().references(() => schools.id),
  classId: integer("class_id").notNull().references(() => classes.id),
  sectionId: uuid("section_id").notNull(),
  academicYearId: uuid("academic_year_id").notNull().references(() => academicYears.id),
}, (t) => [uniqueIndex("class_sections_legacy_class_idx").on(t.classId), uniqueIndex("class_sections_school_id_idx").on(t.schoolId, t.id),
  foreignKey({ name: "class_sections_section_scope_fk", columns: [t.schoolId, t.sectionId], foreignColumns: [sections.schoolId, sections.id] })]);
export const classSubjects = pgTable("class_subjects", {
  id: uuid("id").primaryKey().defaultRandom(),
  schoolId: integer("school_id").notNull().references(() => schools.id),
  classSectionId: uuid("class_section_id").notNull(),
  classId: integer("class_id").notNull().references(() => classes.id),
  subjectId: integer("subject_id").notNull().references(() => subjects.id),
  isRequired: boolean("is_required").notNull().default(true),
}, (t) => [uniqueIndex("class_subjects_class_subject_idx").on(t.classId, t.subjectId), uniqueIndex("class_subjects_school_id_idx").on(t.schoolId, t.id),
  uniqueIndex("class_subjects_school_id_section_idx").on(t.schoolId, t.id, t.classSectionId),
  foreignKey({ name: "class_subjects_section_scope_fk", columns: [t.schoolId, t.classSectionId], foreignColumns: [classSections.schoolId, classSections.id] })]);
export const teacherSubjectAssignments = pgTable("teacher_subject_assignments", {
  id: uuid("id").primaryKey().defaultRandom(),
  schoolId: integer("school_id").notNull().references(() => schools.id),
  classId: integer("class_id").notNull().references(() => classes.id),
  subjectId: integer("subject_id").notNull().references(() => subjects.id),
  classSubjectId: uuid("class_subject_id").notNull(),
  teacherId: integer("teacher_id").notNull().references(() => users.id),
  teacherProfileId: uuid("teacher_profile_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex("assignments_class_subject_idx").on(t.classId, t.subjectId), index("assignments_school_teacher_idx").on(t.schoolId, t.teacherId),
  foreignKey({ name: "assignment_subject_scope_fk", columns: [t.schoolId, t.classSubjectId], foreignColumns: [classSubjects.schoolId, classSubjects.id] }),
  foreignKey({ name: "assignment_teacher_scope_fk", columns: [t.schoolId, t.teacherProfileId], foreignColumns: [teacherProfiles.schoolId, teacherProfiles.id] })]);
export const studentEnrollments = pgTable("student_enrollments", {
  id: uuid("id").primaryKey().defaultRandom(),
  schoolId: integer("school_id").notNull().references(() => schools.id),
  studentId: integer("student_id").notNull().references(() => students.id),
  studentUuid: uuid("student_uuid").notNull().references(() => students.uuid),
  classId: integer("class_id").notNull().references(() => classes.id),
  classSectionId: uuid("class_section_id").notNull(),
  academicYearId: uuid("academic_year_id").notNull().references(() => academicYears.id),
  examNumber: integer("exam_number").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex("enrollments_student_class_idx").on(t.studentUuid, t.classSectionId), uniqueIndex("enrollments_scope_identity_idx").on(t.schoolId, t.id, t.classSectionId, t.studentUuid),
  foreignKey({ name: "enrollment_section_scope_fk", columns: [t.schoolId, t.classSectionId], foreignColumns: [classSections.schoolId, classSections.id] })]);
export const markAllocations = pgTable("mark_allocations", {
  id: uuid("id").primaryKey().defaultRandom(),
  schoolId: integer("school_id").notNull().references(() => schools.id),
  classSubjectId: uuid("class_subject_id").notNull(),
  hasPractical: boolean("has_practical").notNull().default(false),
  mode: text("mode").notNull(),
  theoryMarks: integer("theory_marks").notNull(),
  practicalMarks: integer("practical_marks").notNull(),
  internalMarks: integer("internal_marks").notNull(),
  maxMarks: integer("max_marks").notNull().default(100),
  passMarks: integer("pass_marks").notNull().default(35),
}, (t) => [uniqueIndex("allocation_class_subject_idx").on(t.classSubjectId), uniqueIndex("allocations_school_id_idx").on(t.schoolId, t.id),
  foreignKey({ name: "allocation_subject_scope_fk", columns: [t.schoolId, t.classSubjectId], foreignColumns: [classSubjects.schoolId, classSubjects.id] })]);
export const markAllocationComponents = pgTable("mark_allocation_components", {
  id: uuid("id").primaryKey().defaultRandom(), schoolId: integer("school_id").notNull(),
  allocationId: uuid("allocation_id").notNull(), kind: text("kind").notNull(), maximum: integer("maximum").notNull(),
}, (t) => [uniqueIndex("allocation_component_unique_idx").on(t.allocationId, t.kind),
  foreignKey({ name: "allocation_component_scope_fk", columns: [t.schoolId, t.allocationId], foreignColumns: [markAllocations.schoolId, markAllocations.id] })]);
export const assessmentMarkComponents = pgTable("assessment_mark_components", {
  id: uuid("id").primaryKey().defaultRandom(), schoolId: integer("school_id").notNull(),
  markId: integer("mark_id").notNull().references(() => marks.id), kind: text("kind").notNull(), score: real("score"), scoreExact:numeric("score_exact",{mode:"number"}),
}, (t) => [uniqueIndex("assessment_component_unique_idx").on(t.markId, t.kind)]);
export const geographicScopes = pgTable("geographic_scopes", {
  userId: integer("user_id").primaryKey().references(() => users.id),
  role: text("role").notNull(), district: text("district").notNull(),
  educationalDistrict: text("educational_district"), block: text("block"),
});
export const auditEvents = pgTable("audit_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  actorId: integer("actor_id").references(() => users.id),
  schoolId: integer("school_id").references(() => schools.id),
  action: text("action").notNull(), entityType: text("entity_type").notNull(), entityId: text("entity_id"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("audit_school_created_idx").on(t.schoolId, t.createdAt)]);
export const recoveryChallenges = pgTable("recovery_challenges", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: integer("user_id").references(() => users.id),
  usernameKey: text("username_key").notNull(), otpHash: text("otp_hash").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  attempts: integer("attempts").notNull().default(0),
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("recovery_username_created_idx").on(t.usernameKey, t.createdAt)]);
export const securityRateLimits = pgTable("security_rate_limits", {
  key: text("key").primaryKey(), windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
  hits: integer("hits").notNull().default(1),
});
export const schoolPolicies = pgTable("school_policies", {
  schoolId: integer("school_id").primaryKey().references(() => schools.id),
  settings: jsonb("settings").$type<Record<string, unknown>>().notNull().default({}),
});

/** Append-only, scoped publication revisions. No inferred legacy revisions. */
export const examPublications = pgTable("exam_publications", {
  id: uuid("id").primaryKey().defaultRandom(), schoolId: integer("school_id").notNull().references(()=>schools.id),
  examId: integer("exam_id").notNull(), classId: integer("class_id").notNull(), generation: integer("generation").notNull(),
  data: jsonb("data").$type<import("@/lib/assessments").AssessmentData>().notNull(),
  schoolHeader: jsonb("school_header").$type<School>().notNull(), publishedBy: integer("published_by").notNull().references(()=>users.id),
  publishedAt: timestamp("published_at",{withTimezone:true}).notNull().defaultNow(),
},(t)=>[uniqueIndex("publication_revision_idx").on(t.schoolId,t.examId,t.classId,t.generation),
  foreignKey({name:"publication_exam_scope_fk",columns:[t.schoolId,t.examId],foreignColumns:[exams.schoolId,exams.id]}),
  foreignKey({name:"publication_class_scope_fk",columns:[t.schoolId,t.classId],foreignColumns:[classes.schoolId,classes.id]})]);

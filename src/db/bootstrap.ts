import { sql } from "drizzle-orm";
import { db } from "@/db";

/**
 * Creates every table if it is missing and applies additive migrations.
 *
 * This makes the app self-healing: if the container restarts against a fresh or
 * partially migrated database, the schema is automatically synchronized.
 */
let schemaPromise: Promise<void> | null = null;

export function ensureSchema(): Promise<void> {
  if (!schemaPromise) {
    schemaPromise = createSchema().catch((error) => {
      schemaPromise = null;
      throw error;
    });
  }
  return schemaPromise;
}

async function createSchema(): Promise<void> {
  await db.execute(sql`
    create table if not exists schools (
      id serial primary key,
      name text not null,
      udise_code text not null unique,
      district text,
      state text,
      email text,
      phone text,
      academic_year text not null default '2026-2027',
      created_at timestamptz not null default now()
    )
  `);

  await db.execute(sql`
    create table if not exists users (
      id serial primary key,
      school_id integer not null references schools(id) on delete cascade,
      username text not null unique,
      name text not null,
      password_hash text not null,
      role text not null default 'teacher',
      designation text,
      email text,
      phone text,
      handling_subjects text,
      is_active boolean not null default true,
      must_change_password boolean not null default false,
      last_login_at timestamptz,
      created_at timestamptz not null default now()
    )
  `);

  await db.execute(sql`
    create table if not exists sessions (
      token text primary key,
      user_id integer not null references users(id) on delete cascade,
      expires_at timestamptz not null,
      created_at timestamptz not null default now()
    )
  `);

  await db.execute(sql`
    create table if not exists groups (
      id serial primary key,
      school_id integer not null references schools(id) on delete cascade,
      code text not null,
      name text not null,
      stream text not null default 'General',
      description text,
      created_at timestamptz not null default now()
    )
  `);
  await db.execute(
    sql`create unique index if not exists groups_school_code_idx on groups (school_id, code)`,
  );

  await db.execute(sql`
    create table if not exists classes (
      id serial primary key,
      school_id integer not null references schools(id) on delete cascade,
      name text not null,
      section text not null default 'A',
      group_id integer references groups(id) on delete set null,
      academic_year text not null default '2025-2026',
      room text,
      class_teacher_id integer references users(id) on delete set null,
      created_at timestamptz not null default now()
    )
  `);
  await db.execute(
    sql`create unique index if not exists classes_school_unique_idx on classes (school_id, name, section, academic_year)`,
  );

  await db.execute(sql`
    create table if not exists subjects (
      id serial primary key,
      school_id integer not null references schools(id) on delete cascade,
      class_id integer references classes(id) on delete cascade,
      code text not null,
      name text not null,
      group_id integer references groups(id) on delete cascade,
      has_practical boolean not null default false,
      theory_marks integer not null default 90,
      practical_marks integer not null default 0,
      internal_marks integer not null default 10,
      max_marks integer not null default 100,
      pass_marks integer not null default 35,
      teacher_id integer references users(id) on delete set null,
      created_at timestamptz not null default now()
    )
  `);
  await db.execute(
    sql`create unique index if not exists subjects_school_code_idx on subjects (school_id, code)`,
  );

  await db.execute(sql`
    create table if not exists students (
      id serial primary key,
      school_id integer not null references schools(id) on delete cascade,
      admission_no text not null,
      name text not null,
      roll_no integer not null default 1,
      gender text not null default 'Female',
      dob date,
      class_id integer not null references classes(id) on delete cascade,
      guardian_name text,
      contact text,
      created_at timestamptz not null default now()
    )
  `);
  await db.execute(
    sql`create unique index if not exists students_school_admission_idx on students (school_id, admission_no)`,
  );

  await db.execute(sql`
    create table if not exists exams (
      id serial primary key,
      school_id integer not null references schools(id) on delete cascade,
      name text not null,
      month text,
      year text,
      term text not null default 'Term 1',
      academic_year text not null default '2025-2026',
      max_marks integer not null default 100,
      start_date date,
      is_published boolean not null default false,
      created_at timestamptz not null default now()
    )
  `);

  await db.execute(sql`
    create table if not exists marks (
      id serial primary key,
      school_id integer not null references schools(id) on delete cascade,
      student_id integer not null references students(id) on delete cascade,
      subject_id integer not null references subjects(id) on delete cascade,
      exam_id integer not null references exams(id) on delete cascade,
      theory_score real,
      practical_score real,
      internal_score real,
      score real,
      is_absent boolean not null default false,
      entered_by_id integer references users(id) on delete set null,
      updated_at timestamptz not null default now()
    )
  `);
  await db.execute(
    sql`create unique index if not exists marks_unique_idx on marks (student_id, subject_id, exam_id)`,
  );

  // Safe migrations for existing databases
  await db.execute(sql`
    alter table subjects add column if not exists class_id integer references classes(id) on delete cascade;
    alter table subjects add column if not exists has_practical boolean not null default false;
    alter table subjects add column if not exists theory_marks integer not null default 90;
    alter table subjects add column if not exists practical_marks integer not null default 0;
    alter table subjects add column if not exists internal_marks integer not null default 10;

    alter table marks add column if not exists theory_score real;
    alter table marks add column if not exists practical_score real;
    alter table marks add column if not exists internal_score real;
    alter table marks add column if not exists fa_a_score real;
    alter table marks add column if not exists fa_b_score real;
    alter table marks add column if not exists sa_score real;

    alter table students add column if not exists emis_id text;

    alter table users add column if not exists handling_subjects text;

    alter table exams add column if not exists month text;
    alter table exams add column if not exists year text;
  `);
}

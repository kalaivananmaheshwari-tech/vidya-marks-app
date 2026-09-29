import { sql } from "drizzle-orm";
import { db } from "@/db";
import { ensureSchema } from "@/db/bootstrap";
import { classes, exams, groups, marks, schools, students, subjects, users } from "@/db/schema";
import { hashPassword } from "@/lib/auth";

/** Demo school credentials shown on the login page. */
export const DEMO = {
  udise: "33064500112",
  schoolName: "Sri Vidya Peeth Higher Secondary School",
  adminPassword: "admin@123",
  teacherUsername: "33064500112.ramesh",
  teacherPassword: "teacher@123",
};

function makeRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

const FIRST_NAMES = [
  "Aarav", "Aditi", "Advika", "Akash", "Ananya", "Arjun", "Bhavana", "Charan", "Dhanush", "Deepika",
  "Divya", "Eshwar", "Farhan", "Gayathri", "Harini", "Hemanth", "Ishaan", "Janani", "Kavya", "Karthik",
  "Lakshmi", "Manoj", "Meenakshi", "Naveen", "Nithya", "Oviya", "Pranav", "Priya", "Rahul", "Ramya",
  "Sanjay", "Sandhya", "Surya", "Swathi", "Tarun", "Tanvi", "Uday", "Vaishnavi", "Varun", "Yamini",
  "Zara", "Nikhil", "Keerthi", "Rithika", "Vikram", "Anjali", "Rohit", "Sneha", "Gokul", "Pooja",
];

const LAST_NAMES = [
  "Raman", "Iyer", "Sharma", "Nair", "Menon", "Pillai", "Reddy", "Kumar", "Verma", "Das",
  "Krishnan", "Subramani", "Balaji", "Chandran", "Joshi", "Patel", "Rao", "Sundar", "Gupta", "Mohan",
];

const GUARDIANS = ["Ravi", "Lakshman", "Suresh", "Anand", "Mahesh", "Vijay", "Prakash", "Ganesh"];

export type SeedResult = { seeded: boolean; reason?: string };

let seedPromise: Promise<SeedResult> | null = null;

export function ensureSeed(): Promise<SeedResult> {
  if (!seedPromise) {
    seedPromise = runSeed().catch((error) => {
      seedPromise = null;
      throw error;
    });
  }
  return seedPromise;
}

async function demoExists(): Promise<boolean> {
  const result = await db.execute<{ count: string }>(
    sql`select count(*)::text as count from schools where udise_code = ${DEMO.udise}`,
  );
  const rows = result.rows as Array<{ count: string }>;
  return Number(rows[0]?.count ?? "0") > 0;
}

/**
 * Seeds one fully populated demo school.
 */
export async function runSeed(force = false): Promise<SeedResult> {
  await ensureSchema();

  if (!force && (await demoExists())) {
    return { seeded: false, reason: "already-populated" };
  }

  const lock = await db.execute<{ locked: boolean }>(
    sql`select pg_try_advisory_lock(918273645) as locked`,
  );
  const locked = (lock.rows as Array<{ locked: boolean }>)[0]?.locked;
  if (!locked) return { seeded: false, reason: "locked" };

  try {
    if (force) {
      await db.execute(sql`delete from schools where udise_code = ${DEMO.udise}`);
    } else if (await demoExists()) {
      return { seeded: false, reason: "already-populated" };
    }

    const [school] = await db
      .insert(schools)
      .values({
        name: DEMO.schoolName,
        udiseCode: DEMO.udise,
        district: "Coimbatore",
        state: "Tamil Nadu",
        email: "office@vidyapeeth.edu",
        phone: "+91 422 246 8800",
        academicYear: "2026-2027",
      })
      .returning();
    const schoolId = school.id;

    // 3.0 Teachers: Name of the teacher, Handling subjects
    const staff = await db
      .insert(users)
      .values([
        {
          schoolId,
          username: DEMO.udise,
          name: "Dr. Meera Krishnan",
          passwordHash: hashPassword(DEMO.adminPassword),
          role: "admin",
          designation: "Principal / Headmaster",
          handlingSubjects: "Administration, Moral Science",
          email: "principal@vidyapeeth.edu",
          phone: "+91 98400 11223",
        },
        {
          schoolId,
          username: DEMO.teacherUsername,
          name: "Ramesh Iyer",
          passwordHash: hashPassword(DEMO.teacherPassword),
          role: "teacher",
          designation: "PG Teacher - Mathematics",
          handlingSubjects: "Mathematics, Business Mathematics, Computer Science",
          phone: "+91 98400 44556",
        },
        {
          schoolId,
          username: `${DEMO.udise}.anita`,
          name: "Anita Sharma",
          passwordHash: hashPassword(DEMO.teacherPassword),
          role: "teacher",
          designation: "PG Teacher - Physics",
          handlingSubjects: "Physics, General Science",
          phone: "+91 98400 77889",
        },
        {
          schoolId,
          username: `${DEMO.udise}.joseph`,
          name: "Joseph Fernandes",
          passwordHash: hashPassword(DEMO.teacherPassword),
          role: "teacher",
          designation: "PG Teacher - English",
          handlingSubjects: "English, History",
          phone: "+91 98401 22334",
        },
        {
          schoolId,
          username: `${DEMO.udise}.kavitha`,
          name: "Kavitha Balan",
          passwordHash: hashPassword(DEMO.teacherPassword),
          role: "teacher",
          designation: "PG Teacher - Biology",
          handlingSubjects: "Biology, Chemistry, Science Tamil",
          phone: "+91 98402 55667",
        },
        {
          schoolId,
          username: `${DEMO.udise}.suresh`,
          name: "Suresh Nair",
          passwordHash: hashPassword(DEMO.teacherPassword),
          role: "teacher",
          designation: "PG Teacher - Commerce",
          handlingSubjects: "Commerce, Accountancy, Economics",
          phone: "+91 98403 88990",
        },
      ])
      .returning({ id: users.id, name: users.name });

    const teacherId = (i: number) => staff[i % staff.length].id;

    // Groups for 11 and 12
    const groupRows = await db
      .insert(groups)
      .values([
        {
          schoolId,
          code: "GEN",
          name: "General Academic",
          stream: "General",
          description: "Curriculum for secondary grades (Classes 6 - 10).",
        },
        {
          schoolId,
          code: "2502",
          name: "Bio-Maths Group",
          stream: "Science",
          description: "Group 2502: Physics, Chemistry, Biology and Mathematics.",
        },
        {
          schoolId,
          code: "2503",
          name: "Computer Science Group",
          stream: "Science",
          description: "Group 2503: Physics, Chemistry, Mathematics and Computer Science.",
        },
        {
          schoolId,
          code: "2701",
          name: "Commerce Group",
          stream: "Commerce",
          description: "Group 2701: Accountancy, Commerce, Economics and Business Mathematics.",
        },
        {
          schoolId,
          code: "2801",
          name: "Humanities Group",
          stream: "Arts",
          description: "Group 2801: History, Political Science, Geography and Economics.",
        },
      ])
      .returning({ id: groups.id, code: groups.code });

    const g = Object.fromEntries(groupRows.map((row) => [row.code, row.id])) as Record<string, number>;

    // 2. Mark Assign: If practical -> Theory 70, Practical 20, Internal 10. Otherwise -> Theory 90, Internal 10.
    const subjectRows = await db
      .insert(subjects)
      .values([
        // Common
        { schoolId, code: "ENG", name: "English", groupId: null, hasPractical: false, theoryMarks: 90, practicalMarks: 0, internalMarks: 10, teacherId: teacherId(3) },
        { schoolId, code: "LNG", name: "Language (Tamil)", groupId: null, hasPractical: false, theoryMarks: 90, practicalMarks: 0, internalMarks: 10, teacherId: teacherId(5) },
        // Secondary (Classes 6-10)
        { schoolId, code: "MAT-G", name: "Mathematics", groupId: g.GEN, hasPractical: false, theoryMarks: 90, practicalMarks: 0, internalMarks: 10, teacherId: teacherId(1) },
        { schoolId, code: "SCI-G", name: "Science", groupId: g.GEN, hasPractical: true, theoryMarks: 70, practicalMarks: 20, internalMarks: 10, teacherId: teacherId(2) },
        { schoolId, code: "SOC-G", name: "Social Science", groupId: g.GEN, hasPractical: false, theoryMarks: 90, practicalMarks: 0, internalMarks: 10, teacherId: teacherId(5) },
        { schoolId, code: "PET-G", name: "PET", groupId: g.GEN, hasPractical: false, theoryMarks: 90, practicalMarks: 0, internalMarks: 10, teacherId: teacherId(1) },
        { schoolId, code: "TNS-G", name: "TNSPARK", groupId: g.GEN, hasPractical: false, theoryMarks: 90, practicalMarks: 0, internalMarks: 10, teacherId: teacherId(4) },
        { schoolId, code: "SCT-G", name: "Science Tamil", groupId: g.GEN, hasPractical: true, theoryMarks: 70, practicalMarks: 20, internalMarks: 10, teacherId: teacherId(4) },
        // Higher Secondary (Group 2502)
        { schoolId, code: "PHY-1", name: "Physics", groupId: g["2502"], hasPractical: true, theoryMarks: 70, practicalMarks: 20, internalMarks: 10, teacherId: teacherId(2) },
        { schoolId, code: "CHE-1", name: "Chemistry", groupId: g["2502"], hasPractical: true, theoryMarks: 70, practicalMarks: 20, internalMarks: 10, teacherId: teacherId(4) },
        { schoolId, code: "BIO-1", name: "Biology", groupId: g["2502"], hasPractical: true, theoryMarks: 70, practicalMarks: 20, internalMarks: 10, teacherId: teacherId(4) },
        { schoolId, code: "MAT-1", name: "Mathematics", groupId: g["2502"], hasPractical: false, theoryMarks: 90, practicalMarks: 0, internalMarks: 10, teacherId: teacherId(1) },
        // Higher Secondary (Group 2503)
        { schoolId, code: "PHY-2", name: "Physics", groupId: g["2503"], hasPractical: true, theoryMarks: 70, practicalMarks: 20, internalMarks: 10, teacherId: teacherId(2) },
        { schoolId, code: "CHE-2", name: "Chemistry", groupId: g["2503"], hasPractical: true, theoryMarks: 70, practicalMarks: 20, internalMarks: 10, teacherId: teacherId(4) },
        { schoolId, code: "MAT-2", name: "Mathematics", groupId: g["2503"], hasPractical: false, theoryMarks: 90, practicalMarks: 0, internalMarks: 10, teacherId: teacherId(1) },
        { schoolId, code: "CSC-2", name: "Computer Science", groupId: g["2503"], hasPractical: true, theoryMarks: 70, practicalMarks: 20, internalMarks: 10, teacherId: teacherId(1) },
        // Commerce Group 2701
        { schoolId, code: "ACC", name: "Accountancy", groupId: g["2701"], hasPractical: false, theoryMarks: 90, practicalMarks: 0, internalMarks: 10, teacherId: teacherId(5) },
        { schoolId, code: "COM", name: "Commerce", groupId: g["2701"], hasPractical: false, theoryMarks: 90, practicalMarks: 0, internalMarks: 10, teacherId: teacherId(5) },
        { schoolId, code: "ECO", name: "Economics", groupId: g["2701"], hasPractical: false, theoryMarks: 90, practicalMarks: 0, internalMarks: 10, teacherId: teacherId(5) },
        { schoolId, code: "BMA", name: "Business Mathematics", groupId: g["2701"], hasPractical: false, theoryMarks: 90, practicalMarks: 0, internalMarks: 10, teacherId: teacherId(1) },
      ])
      .returning({
        id: subjects.id,
        code: subjects.code,
        groupId: subjects.groupId,
        hasPractical: subjects.hasPractical,
        theoryMarks: subjects.theoryMarks,
        practicalMarks: subjects.practicalMarks,
        internalMarks: subjects.internalMarks,
      });

    // 1. Classes & sections setup
    // 6 to 10: Group Code disabled (null)
    // 11 & 12: Group Code displayed (2502, 2503, 2701...)
    const classPlan = [
      { name: "Class 9", section: "A", group: "GEN", room: "Block A - 101", teacher: 1 },
      { name: "Class 9", section: "B", group: "GEN", room: "Block A - 102", teacher: 3 },
      { name: "Class 10", section: "A", group: "GEN", room: "Block A - 201", teacher: 2 },
      { name: "Class 10", section: "B", group: "GEN", room: "Block A - 202", teacher: 4 },
      { name: "Class 11", section: "A", group: "2503", room: "Block B - 301", teacher: 1 },
      { name: "Class 11", section: "B", group: "2701", room: "Block B - 302", teacher: 5 },
      { name: "Class 12", section: "A", group: "2502", room: "Block C - 401", teacher: 4 },
      { name: "Class 12", section: "B", group: "2701", room: "Block C - 402", teacher: 3 },
    ];

    const classRows = await db
      .insert(classes)
      .values(
        classPlan.map((c) => ({
          schoolId,
          name: c.name,
          section: c.section,
          groupId: g[c.group],
          academicYear: "2026-2027",
          room: c.room,
          classTeacherId: teacherId(c.teacher),
        })),
      )
      .returning({ id: classes.id, name: classes.name, section: classes.section, groupId: classes.groupId });

    const examRows = await db
      .insert(exams)
      .values([
        {
          schoolId,
          name: "Unit Test I",
          month: "July",
          year: "2026",
          term: "Term 1",
          academicYear: "2026-2027",
          maxMarks: 100,
          startDate: "2026-07-14",
          isPublished: true,
        },
        {
          schoolId,
          name: "Quarterly Examination",
          month: "September",
          year: "2026",
          term: "Term 1",
          academicYear: "2026-2027",
          maxMarks: 100,
          startDate: "2026-09-22",
          isPublished: true,
        },
        {
          schoolId,
          name: "Half Yearly Examination",
          month: "December",
          year: "2026",
          term: "Term 2",
          academicYear: "2026-2027",
          maxMarks: 100,
          startDate: "2026-12-08",
          isPublished: true,
        },
      ])
      .returning({ id: exams.id, name: exams.name });

    const rand = makeRandom(20260215);
    const studentValues: Array<typeof students.$inferInsert> = [];
    const abilities = new Map<string, number>();
    let counter = 1000;

    classRows.forEach((cls, classIndex) => {
      const count = 14 + Math.floor(rand() * 5);
      for (let i = 0; i < count; i += 1) {
        const first = FIRST_NAMES[Math.floor(rand() * FIRST_NAMES.length)];
        const last = LAST_NAMES[Math.floor(rand() * LAST_NAMES.length)];
        counter += 1;
        const admissionNo = `VP2025${counter}`;
        studentValues.push({
          schoolId,
          admissionNo,
          name: `${first} ${last}`,
          rollNo: i + 1,
          gender: rand() > 0.48 ? "Female" : "Male",
          classId: cls.id,
          guardianName: `${GUARDIANS[Math.floor(rand() * GUARDIANS.length)]} ${last}`,
          contact: `+91 9${Math.floor(100000000 + rand() * 899999999)}`,
        });
        const classBias = [4, -3, 6, -5, 8, 1, 10, -2][classIndex % 8];
        abilities.set(admissionNo, 58 + classBias + (rand() - 0.42) * 46);
      }
    });

    const insertedStudents = await db
      .insert(students)
      .values(studentValues)
      .returning({ id: students.id, admissionNo: students.admissionNo, classId: students.classId });

    const subjectsForGroup = (groupId: number | null) =>
      subjectRows.filter((s) => s.groupId === null || s.groupId === groupId);

    const classById = new Map(classRows.map((c) => [c.id, c]));
    const markValues: Array<typeof marks.$inferInsert> = [];

    for (const student of insertedStudents) {
      const cls = classById.get(student.classId);
      if (!cls) continue;
      const base = abilities.get(student.admissionNo) ?? 60;
      const subjectList = subjectsForGroup(cls.groupId);

      examRows.forEach((exam, examIndex) => {
        const trend = examIndex * 2.4;
        for (const subject of subjectList) {
          const subjectSwing = (rand() - 0.5) * 24;
          const noise = (rand() - 0.5) * 12;
          let totalScore = base + trend + subjectSwing + noise;
          totalScore = Math.max(8, Math.min(99, totalScore));
          const absent = rand() < 0.012;

          let theoryScore: number | null = null;
          let practicalScore: number | null = null;
          let internalScore: number | null = null;

          if (!absent) {
            const ratio = totalScore / 100;
            if (subject.hasPractical) {
              // Theory 70, Practical 20, Internal 10
              theoryScore = Math.round(ratio * 70);
              practicalScore = Math.round(ratio * 20);
              internalScore = Math.round(ratio * 10);
            } else {
              // Theory 90, Internal 10
              theoryScore = Math.round(ratio * 90);
              practicalScore = 0;
              internalScore = Math.round(ratio * 10);
            }
            totalScore = (theoryScore ?? 0) + (practicalScore ?? 0) + (internalScore ?? 0);
          }

          markValues.push({
            schoolId,
            studentId: student.id,
            subjectId: subject.id,
            examId: exam.id,
            theoryScore,
            practicalScore,
            internalScore,
            score: absent ? null : Math.round(totalScore),
            isAbsent: absent,
            enteredById: staff[1 + (examIndex % (staff.length - 1))].id,
          });
        }
      });
    }

    for (let i = 0; i < markValues.length; i += 500) {
      await db.insert(marks).values(markValues.slice(i, i + 500));
    }

    return { seeded: true };
  } finally {
    await db.execute(sql`select pg_advisory_unlock(918273645)`);
  }
}

import { afterAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { sql } from "drizzle-orm";
import type { Database } from "@/db";
import { migrateDatabase } from "@/db/migrate";

const instances: PGlite[] = [];
function fresh() { const p = new PGlite(); instances.push(p); return drizzle(p) as unknown as Database; }
afterAll(async () => { for (const p of instances) await p.close(); });
describe("safe additive migrations", () => {
  it("seeds 15 relational years and is idempotent/checksummed", async () => {
    const db = fresh();
    expect(await migrateDatabase(db)).toHaveLength(5);
    expect(await migrateDatabase(db)).toEqual([]);
    const years = await db.execute<{ label: string }>(sql`select label from academic_years order by start_year`);
    expect(years.rows).toHaveLength(15); expect(years.rows[0].label).toBe("2026-2027"); expect(years.rows[14].label).toBe("2040-2041");
    await db.execute(sql`insert into academic_years(label,start_year,end_year) values('2041-2042',2041,2042)`);
    expect((await db.execute(sql`select id from academic_years where label='2041-2042'`)).rows).toHaveLength(1);
  });
  it("preserves legacy IDs, marks, sessions and backfills stable membership/enrollment identities", async () => {
    const db = fresh(); await migrateDatabase(db, "0001_legacy_schema.sql");
    await db.execute(sql`insert into schools(id,name,udise_code) values(10,'Legacy School','33000000010')`);
    await db.execute(sql`insert into users(id,school_id,username,name,password_hash,role) values(20,10,'legacy','Teacher','not-used','teacher')`);
    await db.execute(sql`insert into classes(id,school_id,name,section,academic_year) values(30,10,'Class 10','A','2026-2027')`);
    await db.execute(sql`insert into subjects(id,school_id,class_id,code,name,teacher_id) values(40,10,30,'MAT','Mathematics',20)`);
    await db.execute(sql`insert into students(id,school_id,admission_no,name,roll_no,class_id) values(50,10,'ADM50','Child',7,30)`);
    await db.execute(sql`insert into exams(id,school_id,name,academic_year) values(60,10,'Quarterly','2026-2027')`);
    await db.execute(sql`insert into marks(id,school_id,student_id,subject_id,exam_id,theory_score,internal_score,score) values(70,10,50,40,60,75,8,83)`);
    await db.execute(sql`insert into sessions(token,user_id,expires_at) values('legacy-token',20,now()+interval '1 day')`);
    await migrateDatabase(db);
    const mark = (await db.execute<{ id:number; score:number; student_uuid:string; enrollment_id:string; allocation_snapshot:{legacy:boolean} }>(sql`select * from marks where id=70`)).rows[0];
    expect(mark.id).toBe(70); expect(mark.score).toBe(83); expect(mark.student_uuid).toMatch(/^[a-f0-9-]{36}$/); expect(mark.enrollment_id).toMatch(/^[a-f0-9-]{36}$/); expect(mark.allocation_snapshot.legacy).toBe(true);
    expect((await db.execute(sql`select token,membership_id from sessions`)).rows[0].token).toBe('legacy-token');
    expect((await db.execute(sql`select * from teacher_subject_assignments`)).rows).toHaveLength(1);
    expect((await db.execute(sql`select mode,theory_marks,internal_marks from mark_allocations`)).rows[0]).toMatchObject({mode:'TOTAL',theory_marks:0,internal_marks:0});
  });
  it("duplicate legacy exam numbers roll back; no renumbering or deletion", async () => {
    const db = fresh(); await migrateDatabase(db, "0001_legacy_schema.sql");
    await db.execute(sql`insert into schools(id,name,udise_code) values(1,'School','33000000001')`);
    await db.execute(sql`insert into classes(id,school_id,name,academic_year) values(1,1,'Class 7','2026-2027')`);
    await db.execute(sql`insert into students(school_id,admission_no,name,roll_no,class_id) values(1,'a','A',1,1),(1,'b','B',1,1)`);
    await expect(migrateDatabase(db)).rejects.toThrow();
    expect((await db.execute(sql`select name,roll_no from students order by admission_no`)).rows).toEqual([{name:'A',roll_no:1},{name:'B',roll_no:1}]);
    expect((await db.execute(sql`select version from vidya_schema_migrations`)).rows).toHaveLength(1);
  });
  it("school-scope FKs reject cross-school references and UDISE is immutable", async () => {
    const db = fresh(); await migrateDatabase(db);
    await db.execute(sql`insert into schools(id,name,udise_code) values(1,'A','33000000001'),(2,'B','33000000002')`);
    await db.execute(sql`insert into groups(id,school_id,code,name) values(1,1,'G','Group')`);
    await expect(db.execute(sql`insert into classes(school_id,name,group_id) values(2,'Class 11',1)`)).rejects.toThrow();
    await expect(db.execute(sql`update schools set udise_code='33000000003' where id=1`)).rejects.toThrow();
    await expect(db.execute(sql`insert into geographic_scopes(user_id,role,district) values(9,'BEO','Coimbatore')`)).rejects.toThrow();
  });
});

import {beforeAll,afterAll,describe,it,expect,vi} from "vitest";
import {eq,and} from "drizzle-orm";
import {db,closeDatabase} from "@/db";
import {migrateDatabase} from "@/db/migrate";
import {runSeed,DEMO} from "@/db/seed";
import {schools,classes,exams,examPublications,marks} from "@/db/schema";
beforeAll(async()=>{await migrateDatabase();});afterAll(async()=>{vi.unstubAllEnvs();await closeDatabase();});
describe("existing opt-in demo data remains non-destructive",()=>{
  it("is disabled unless explicitly requested and never supports reset",async()=>{vi.stubEnv("DEMO_MODE","0");expect(await runSeed()).toMatchObject({seeded:false});await expect(runSeed(true)).rejects.toThrow("Destructive reseeding is disabled.");});
  it("creates approved class allocations and verified snapshots, and a repeated seed changes nothing",async()=>{vi.stubEnv("DEMO_MODE","1");expect(await runSeed()).toMatchObject({seeded:true});const [school]=await db.select().from(schools).where(eq(schools.udiseCode,DEMO.udise));const cls=await db.select().from(classes).where(eq(classes.schoolId,school.id));expect(cls.filter((c)=>["Class 9","Class 10"].includes(c.name)).every((c)=>c.groupId===null)).toBe(true);const examRows=await db.select().from(exams).where(eq(exams.schoolId,school.id));expect(examRows.every((e)=>e.isPublished)).toBe(true);expect(await db.select().from(examPublications).where(eq(examPublications.schoolId,school.id))).toHaveLength(examRows.length*cls.length);const before=await db.select().from(marks).where(eq(marks.schoolId,school.id));expect(await runSeed()).toMatchObject({seeded:false});expect(await db.select().from(marks).where(eq(marks.schoolId,school.id))).toEqual(before);expect(before.every((m)=>m.status!=="NUMERIC" || m.scoreExact!==null)).toBe(true);},30000);
});

import {randomUUID} from "node:crypto";
import {afterAll,beforeAll,describe,expect,it} from "vitest";
import {db,closeDatabase} from "@/db";
import {migrateDatabase} from "@/db/migrate";
import {users,geographicScopes} from "@/db/schema";
import {schoolFixture} from "./fixtures";
import {hashPassword,issueSession,authForToken,type AuthContext} from "@/lib/auth";
import {saveMarkBatch} from "@/lib/mark-entry";
import {publishResult} from "@/lib/exam-service";
import {geographicReport} from "@/lib/geographic-reports";
const district=`Coimbatore-${randomUUID().slice(0,8)}`;
let a:Awaited<ReturnType<typeof schoolFixture>>,b:typeof a,c:typeof a,outside:typeof a;
let ceo:AuthContext,deo:AuthContext,beo:AuthContext;
async function officer(role:"CEO"|"DEO"|"BEO"){
  const [user]=await db.insert(users).values({schoolId:null,username:`${role}.${randomUUID().slice(0,8)}`,name:`Test ${role}`,role,userType:role,passwordHash:hashPassword("OfficerTest@1234")}).returning();
  await db.insert(geographicScopes).values({userId:user.id,role,district:` ${district.toUpperCase()} `,educationalDistrict:role==="CEO"?null:"Pollachi",block:role==="BEO"?"Block A":null});
  const s=await issueSession(user.id,null);return (await authForToken(s.rawToken))!;
}
async function fill(f:typeof a,score:number){for(const group of [f.a,f.b])for(const sub of group.subjects)await saveMarkBatch(group===f.a && sub.id===f.a.subjects[0].id?f.teacherA:f.teacherB,{classId:group.cls.id,examId:f.exam.id,subjectId:sub.id,entries:(group===f.a?[f.student1,f.student2]:[f.student3]).map((s)=>({enrollmentId:s.enrollmentId,score}))});await publishResult(f.admin,f.exam.id,true);}
beforeAll(async()=>{await migrateDatabase();a=await schoolFixture(district,"Pollachi","Block A");b=await schoolFixture(district,"Pollachi","Block B");c=await schoolFixture(district,"Coimbatore","Block C");outside=await schoolFixture(`Erode-${randomUUID().slice(0,8)}`);await fill(a,80);await fill(b,80);await fill(c,70);await fill(outside,95);ceo=await officer("CEO");deo=await officer("DEO");beo=await officer("BEO");},60000);afterAll(closeDatabase);
describe("persisted geographic report permissions",()=>{
  it("CEO sees only registered District; DEO only Educational District; BEO only Block",async()=>{expect((await geographicReport(ceo,{})).schools.map((s)=>s.id).sort()).toEqual([a.school.id,b.school.id,c.school.id].sort());expect((await geographicReport(deo,{})).schools.map((s)=>s.id).sort()).toEqual([a.school.id,b.school.id].sort());expect((await geographicReport(beo,{})).schools.map((s)=>s.id)).toEqual([a.school.id]);});
  it("cross-district, cross-educational-district, cross-block and school-ID widening are forbidden",async()=>{await expect(geographicReport(ceo,{district:outside.school.district!})).rejects.toMatchObject({status:403});await expect(geographicReport(deo,{educationalDistrict:"Coimbatore"})).rejects.toMatchObject({status:403});await expect(geographicReport(beo,{block:"Block B"})).rejects.toMatchObject({status:403});await expect(geographicReport(beo,{schoolId:b.school.id})).rejects.toMatchObject({status:403});await expect(geographicReport(a.admin,{})).rejects.toMatchObject({status:403});});
  it("management/class/subject filters and Male/Female/Total are real published aggregates; school rank is 1,1,3 by average",async()=>{const report=await geographicReport(ceo,{academicYear:"2026-2027",examName:"Quarterly Examination",management:"Government",className:"Class 10",subjectName:"Mathematics"});expect(report.rows).toHaveLength(3);expect(report.rows.map((r)=>r.rank)).toEqual([1,1,3]);expect(report.rows[0].male.totalStudents).toBe(1);expect(report.rows[0].female.totalStudents).toBe(2);expect(report.rows[0].total.totalStudents).toBe(3);expect(JSON.stringify(report)).not.toContain("Student A");expect((await geographicReport(ceo,{examName:"Quarterly Examination",management:"Aided"})).rows).toEqual([]);});
  it("tampered context scope cannot widen authority; the service reloads persisted scope",async()=>{const forged={...beo,geographicScope:{...beo.geographicScope!,role:"CEO",district:outside.school.district!}};expect((await geographicReport(forged,{})).schools.map((s)=>s.id)).toEqual([a.school.id]);});
});

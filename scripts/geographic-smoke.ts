import {config} from "dotenv";
import {readFile,writeFile} from "node:fs/promises";
import {randomBytes,randomInt} from "node:crypto";
import assert from "node:assert/strict";
import {and,eq} from "drizzle-orm";
import {db,closeDatabase} from "../src/db";
import {schools,users,geographicScopes} from "../src/db/schema";
import {hashPassword} from "../src/lib/auth";
config({path:".cache/http-verification/connection.env",quiet:true});
async function main(){
  const database=new URL(process.env.DATABASE_URL ?? "");if(!["localhost","127.0.0.1"].includes(database.hostname) || !database.pathname.startsWith("/vidya_http_") || process.env.ALLOW_TEST_WRITES!=="1")throw new Error("ISOLATED_TEST_ONLY");
  const filename=".cache/api-verification/fixture.json";const f=JSON.parse(await readFile(filename,"utf8")) as {base:string;admin:{username:string};schoolName:string;classId:number;examId:number;officers?:Record<string,{username:string;password:string}>};const base=new URL(f.base);assert.ok(["localhost","127.0.0.1"].includes(base.hostname));const nonce=randomBytes(4).toString("hex");
  const [schoolA]=await db.select().from(schools).where(and(eq(schools.udiseCode,f.admin.username),eq(schools.name,f.schoolName)));assert.ok(schoolA);
  const makeSchool=(district:string,education:string,block:string)=>({name:`Geographic verification ${nonce}`,udiseCode:`33${String(randomInt(1e9)).padStart(9,"0")}`,district,educationalDistrict:education,block,management:"Government",schoolType:"Secondary"});
  const [outside]=await db.insert(schools).values(makeSchool("Erode","Erode","Erode North")).returning();const [otherEducation]=await db.insert(schools).values(makeSchool("Coimbatore","Coimbatore","Perur")).returning();const [otherBlock]=await db.insert(schools).values(makeSchool("Coimbatore","Pollachi","Udumalpet")).returning();
  const officers:Record<string,{username:string;password:string}>={};let checks=0,tamperingChecks=0;
  for(const role of ["CEO","DEO","BEO"]){const username=`geo.${role.toLowerCase()}.${nonce}`;const password=`Geographic!${randomBytes(12).toString("hex")}`;const [user]=await db.insert(users).values({schoolId:null,username,passwordHash:hashPassword(password),name:`Verification ${role}`,role:"teacher",userType:role,mustChangePassword:false}).returning();await db.insert(geographicScopes).values({userId:user.id,role,district:"Coimbatore",educationalDistrict:role!=="CEO"?"Pollachi":null,block:role==="BEO"?"Kinathukadavu":null});
    // Trusted test fixture insertion is NOT a public officer provisioning/verification workflow.
    const login=await fetch(f.base+"/api/auth/login",{method:"POST",headers:{origin:base.origin,"content-type":"application/json"},body:JSON.stringify({username,password})});assert.equal(login.status,200);const cookie=login.headers.getSetCookie().find((c)=>c.startsWith("sms_session="))!.split(";")[0];const headers={origin:base.origin,cookie};
    const report=await fetch(f.base+"/api/reports/geographic?academicYear=2026-2027&examName=Quarterly%20Verification",{headers});assert.equal(report.status,200);const data=await report.json() as {scope:{role:string};schools:Array<{id:number}>;rows:Array<{schoolId:number;rank:number|null}>};assert.equal(data.scope.role,role);const ids=data.schools.map((s)=>s.id);assert.ok(ids.includes(schoolA.id));assert.ok(!ids.includes(outside.id));assert.equal(ids.includes(otherEducation.id),role==="CEO");assert.equal(ids.includes(otherBlock.id),role!=="BEO");assert.equal(data.rows.length,8);assert.ok(data.rows.every((r)=>r.schoolId===schoolA.id && r.rank===1));assert.ok(!JSON.stringify(data).includes("Verification One"));
    const forbidden=[`schoolId=${outside.id}`,"district=Erode"];if(role!=="CEO")forbidden.push("educationalDistrict=Coimbatore");if(role==="BEO")forbidden.push("block=Udumalpet");
    for(const q of forbidden){const denied=await fetch(`${f.base}/api/reports/geographic?${q}`,{headers});assert.equal(denied.status,403);tamperingChecks++;}
    for(const q of ["role=CEO","role=ADMIN","teacherId=1"]){const denied=await fetch(`${f.base}/api/reports/geographic?${q}`,{headers});assert.equal(denied.status,400);tamperingChecks++;}
    // The broader optional filters of CEO/DEO may narrow a result, never widen the persisted scope.
    for(const q of ["educationalDistrict=Erode","block=Erode%20North"].filter((q)=>role==="CEO" || (role==="DEO" && q.startsWith("block=")))){const narrowed=await fetch(`${f.base}/api/reports/geographic?${q}`,{headers});assert.equal(narrowed.status,200);assert.deepEqual((await narrowed.json()).schools,[]);tamperingChecks++;}
    const ignoredIdentity=await fetch(`${f.base}/api/reports/geographic?teacher_id=1`,{headers});assert.equal(ignoredIdentity.status,200);assert.equal((await ignoredIdentity.json()).scope.role,role);tamperingChecks++;
    for(const path of ["/api/classes","/api/teachers","/api/groups","/api/student-entry"]){const schoolOnly=await fetch(f.base+path,{headers});assert.equal(schoolOnly.status,403);tamperingChecks++;}
    const adminWrite=await fetch(f.base+"/api/classes",{method:"POST",headers:{...headers,"content-type":"application/json"},body:JSON.stringify({name:"Class 10",section:"Z"})});assert.equal(adminWrite.status,403);tamperingChecks++;checks++;console.log(`PASS geographic ${checks}: ${role} persisted scope and hierarchy, no out-of-scope schools/student names, no school administration`);officers[role]={username,password};
  }
  f.officers=officers;await writeFile(filename,JSON.stringify(f),{mode:0o600});console.log(`Geographic HTTP verification passed: 3 role checks; ${tamperingChecks} individual tampering/administration assertions. Authority activation remains blocked; fixtures are isolated and private.`);
}
void main().catch(()=>{console.error("Geographic HTTP verification failed; credential/response details suppressed.");process.exitCode=1;}).finally(closeDatabase);

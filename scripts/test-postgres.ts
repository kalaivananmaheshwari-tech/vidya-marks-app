import { config } from "dotenv";
import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { Client } from "pg";
config({path:".cache/vidya-postgres/connection.env",quiet:true});
async function main() {
  const url=process.env.LOCAL_TEST_DATABASE_URL ?? process.env.DATABASE_URL;
  if(!url)throw new Error("Start pnpm db:local or provide LOCAL_TEST_DATABASE_URL for a local PostgreSQL server.");
  const parsed=new URL(url);
  if(!["127.0.0.1","localhost"].includes(parsed.hostname))throw new Error("This runner only creates disposable test databases on a local server.");
  const database=`vidya_test_${randomBytes(8).toString("hex")}`;const client=new Client({connectionString:url});await client.connect();let created=false;
  try {
    await client.query(`create database "${database}"`);created=true;
    parsed.pathname=`/${database}`;
    const exit=await new Promise<number>((resolve,reject)=>{const child=spawn("pnpm",["exec","vitest","run"],{stdio:"inherit",env:{...process.env,TEST_DATABASE_URL:parsed.toString()}});child.on("error",reject);child.on("exit",(code)=>resolve(code ?? 1));});
    process.exitCode=exit;
    console.log(`Native PostgreSQL test runner exited ${exit}.`);
  } finally {
    // Only the fresh, random database created by this invocation is cleaned up. Never reset the app database.
    if(created)await client.query(`drop database "${database}" with(force)`);
    await client.end();
  }
}
main().catch(()=>{console.error("Native PostgreSQL test runner failed; no application database was reset.");process.exitCode=1;});

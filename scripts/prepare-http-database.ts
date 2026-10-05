import {config} from "dotenv";
import {Client} from "pg";
import {randomBytes} from "node:crypto";
import {mkdir,writeFile} from "node:fs/promises";
import {spawn} from "node:child_process";
config({path:".cache/vidya-postgres/connection.env",quiet:true});
async function main(){const input=process.env.LOCAL_TEST_DATABASE_URL ?? process.env.DATABASE_URL;if(!input)throw new Error("LOCAL_DATABASE_REQUIRED");const url=new URL(input);if(!["localhost","127.0.0.1"].includes(url.hostname))throw new Error("LOCAL_ONLY");const client=new Client({connectionString:input});await client.connect();const name=`vidya_http_${randomBytes(6).toString("hex")}`;try{await client.query(`create database "${name}"`);}finally{await client.end();}url.pathname=`/${name}`;await mkdir(".cache/http-verification",{recursive:true,mode:0o700});await writeFile(".cache/http-verification/connection.env",`DATABASE_URL=${JSON.stringify(url.toString())}\n`,{mode:0o600});const code=await new Promise<number>((resolve,reject)=>{const p=spawn("pnpm",["run","db:migrate"],{stdio:"inherit",env:{...process.env,DATABASE_URL:url.toString()}});p.once("error",reject);p.once("exit",(c)=>resolve(c ?? 1));});process.exitCode=code;console.log("Isolated HTTP verification database prepared. No existing database was reset or dropped. Connection details are stored privately in .cache.");}
void main().catch(()=>{console.error("HTTP verification database preparation failed; connection details suppressed and existing data untouched.");process.exitCode=1;});

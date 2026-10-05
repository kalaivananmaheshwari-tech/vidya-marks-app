import {createHash,randomBytes} from "node:crypto";
import {cp,mkdir,readdir,readFile,stat} from "node:fs/promises";
import path from "node:path";
import {PGlite} from "@electric-sql/pglite";
import {drizzle} from "drizzle-orm/pglite";
import {migrateDatabase} from "../src/db/migrate";
import type {Database} from "../src/db";
const source=path.resolve(".pgdata");const tables=["schools","users","sessions","groups","classes","subjects","students","exams","marks"];
async function physicalFingerprint(root:string){const hashes:string[]=[];async function walk(dir:string){for(const name of (await readdir(dir)).sort()){const file=path.join(dir,name);const info=await stat(file);if(info.isDirectory())await walk(file);else if(info.isFile())hashes.push(path.relative(root,file)+":"+createHash("sha256").update(await readFile(file)).digest("hex"));}}await walk(root);return createHash("sha256").update(hashes.join("\n")).digest("hex");}
async function main(){
  const before=await physicalFingerprint(source);const copy=path.resolve(`.cache/legacy-copy-${randomBytes(6).toString("hex")}`);await mkdir(path.dirname(copy),{recursive:true});await cp(source,copy,{recursive:true,errorOnExist:true,force:false});
  const pg=new PGlite(copy);await pg.waitReady;const executor=drizzle(pg) as unknown as Database;
  try{
    const manifests:Array<{table:string;columns:string[];count:number;digest:string}>=[];
    for(const table of tables){const cols=await pg.query<{column_name:string}>("select column_name from information_schema.columns where table_schema='public' and table_name=$1 order by ordinal_position",[table]);if(!cols.rows.length)continue;
      const columns=cols.rows.map((c)=>c.column_name);const selection=columns.map((c)=>`"${c}"`).join(",");const rows=await pg.query(`select ${selection} from "${table}" order by ${table==="sessions"?'"token"':'"id"'}`);manifests.push({table,columns,count:rows.rows.length,digest:createHash("sha256").update(JSON.stringify(rows.rows)).digest("hex")});
    }
    const applied=await migrateDatabase(executor);const results=[];
    for(const m of manifests){const rows=await pg.query(`select ${m.columns.map((c)=>`"${c}"`).join(",")} from "${m.table}" order by ${m.table==="sessions"?'"token"':'"id"'}`);results.push({table:m.table,countBefore:m.count,countAfter:rows.rows.length,legacyColumnsIdentical:createHash("sha256").update(JSON.stringify(rows.rows)).digest("hex")===m.digest});}
    const physicalUnchanged=await physicalFingerprint(source)===before;console.log(JSON.stringify({verification:"migrate a COPY of the existing embedded store only",applied,originalStoreByteForByteUnchanged:physicalUnchanged,tables:results},null,2));
    if(!physicalUnchanged || results.some((r)=>!r.legacyColumnsIdentical))process.exitCode=1;
  }finally{await pg.close();}
}
main().catch(()=>{console.error("Copied-store verification failed. Original store was not opened by the database engine or migrated; no repair or PID-file deletion was attempted.");process.exitCode=1;});

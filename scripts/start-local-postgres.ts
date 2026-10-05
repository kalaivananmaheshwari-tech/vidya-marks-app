import EmbeddedPostgres from "embedded-postgres";
import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

async function main() {
  if(process.env.NODE_ENV==="production") throw new Error("Local verification database is development-only.");
  const root=path.resolve(".cache/vidya-postgres");mkdirSync(root,{recursive:true});
  const file=path.join(root,"settings.json");
  const settings=existsSync(file)?JSON.parse(readFileSync(file,"utf8")) as {user:string;password:string;port:number}:{user:"vidya_dev",password:randomBytes(24).toString("hex"),port:5433};
  if(!existsSync(file))writeFileSync(file,JSON.stringify(settings),{mode:0o600});
  const pg=new EmbeddedPostgres({databaseDir:path.join(root,"cluster"),...settings,authMethod:"scram-sha-256",persistent:true,createPostgresUser:false,initdbFlags:["--locale=C.UTF-8","--lc-messages=C"],postgresFlags:["-h","0.0.0.0"],onLog:()=>{},onError:()=>{}});
  if(!existsSync(path.join(root,"cluster/PG_VERSION"))) await pg.initialise();
  await pg.start();
  const client=pg.getPgClient("postgres","127.0.0.1");await client.connect();
  const found=await client.query("select 1 from pg_database where datname='vidya_local_verification'");
  if(!found.rowCount)await client.query("create database vidya_local_verification"); await client.end();
  const url=`postgresql://${settings.user}:${settings.password}@127.0.0.1:${settings.port}/vidya_local_verification`;
  writeFileSync(path.join(root,"connection.env"),`DATABASE_URL=${url}\n`,{mode:0o600});
  // Do not overwrite developer configuration. Only this explicitly started, isolated database is created.
  console.log("Native PostgreSQL ready on port 5433 (development verification only). Connection environment: .cache/vidya-postgres/connection.env");
  let stopping=false;const stop=async()=>{if(stopping)return;stopping=true;await pg.stop();process.exit(0);};
  process.on("SIGINT",()=>void stop());process.on("SIGTERM",()=>void stop());
}
main().catch(()=>{console.error("Local PostgreSQL could not start. Existing data/configuration was not reset.");process.exit(1);});

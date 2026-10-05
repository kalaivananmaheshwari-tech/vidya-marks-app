import {readFile} from "node:fs/promises";
import path from "node:path";
export const dynamic="force-dynamic";
export async function GET(){const content=await readFile(path.join(process.cwd(),"openapi.json"),"utf8");return new Response(content,{headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"public, max-age=60"}});}

import binary from "@sparticuz/chromium";
import {createRequire} from "node:module";
import {readFile,mkdir,writeFile} from "node:fs/promises";
import {brotliDecompressSync} from "node:zlib";
import {execFileSync,spawn} from "node:child_process";
import path from "node:path";
async function main(){
  const require=createRequire(import.meta.url);const root=path.resolve(path.dirname(require.resolve("@sparticuz/chromium")),"../..");const dir=path.resolve(".cache/chromium-libs");await mkdir(dir,{recursive:true});const tar=path.join(dir,"libraries.tar");await writeFile(tar,brotliDecompressSync(await readFile(path.join(root,"bin/al2023.tar.br"))));execFileSync("tar",["-xf",tar,"-C",dir]);
  const executable=process.env.PLAYWRIGHT_EXECUTABLE_PATH ?? await binary.executablePath();
  // Browser security stays enabled; do NOT use the package's Lambda-only disable-web-security defaults for API/UI verification.
  const args=binary.args.filter((a)=>!a.startsWith("--disable-web-security") && !a.startsWith("--allow-running-insecure-content") && !a.startsWith("--single-process") && !a.startsWith("--disable-site-isolation-trials"));
  const env={...process.env,PLAYWRIGHT_EXECUTABLE_PATH:executable,VIDYA_CHROMIUM_ARGS:JSON.stringify(args),LD_LIBRARY_PATH:[path.join(dir,"lib"),process.env.LD_LIBRARY_PATH ?? ""].filter(Boolean).join(":"),FONTCONFIG_PATH:"/tmp/fonts"};
  const code=await new Promise<number>((resolve,reject)=>{const child=spawn("pnpm",["exec","playwright","test",...process.argv.slice(2).filter((arg)=>arg!=="--")],{stdio:"inherit",env});child.once("error",reject);child.once("exit",(c)=>resolve(c ?? 1));});process.exitCode=code;
}
void main().catch(()=>{console.error("Browser verification setup failed. No application data was reset.");process.exitCode=1;});

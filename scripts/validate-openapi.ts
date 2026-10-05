import SwaggerParser from "@apidevtools/swagger-parser";
async function main(){const api=await SwaggerParser.validate("openapi.json");console.log(`OpenAPI contract valid: ${Object.keys(api.paths ?? {}).length} documented existing API paths.`);}
void main().catch(()=>{console.error("OpenAPI validation failed.");process.exitCode=1;});

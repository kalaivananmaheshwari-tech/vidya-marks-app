import "dotenv/config";
import { migrateDatabase } from "../src/db/migrate";
import { closeDatabase } from "../src/db";

async function main() {
try {
  const versions = await migrateDatabase();
  console.log(versions.length ? `Applied: ${versions.join(", ")}` : "Schema already current; no changes.");
} catch {
  console.error("Migration failed and rolled back. Check duplicates, academic-year labels and school-scope references on a backed-up database. No automatic data repair was attempted.");
  process.exitCode = 1;
} finally {
  await closeDatabase();
}
}
void main();

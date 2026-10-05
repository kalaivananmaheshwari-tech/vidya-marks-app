import { migrateDatabase, schemaIsReady } from "@/db/migrate";

let schemaPromise: Promise<void> | null = null;
/** Production checks readiness; it never mutates schema on a public request. */
export function ensureSchema(): Promise<void> {
  if (!schemaPromise) schemaPromise = prepare().catch((error) => { schemaPromise = null; throw error; });
  return schemaPromise;
}
async function prepare() {
  if (process.env.NODE_ENV !== "production" && process.env.AUTO_MIGRATE === "1") {
    await migrateDatabase();
  } else if (!(await schemaIsReady())) {
    throw new Error("Database migration required. Back up and run pnpm run db:migrate before starting the app.");
  }
}

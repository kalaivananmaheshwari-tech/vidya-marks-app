import { drizzle as drizzleNodePg } from "drizzle-orm/node-postgres";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { PGlite } from "@electric-sql/pglite";
import { Pool } from "pg";

export type Database = ReturnType<typeof drizzleNodePg>;
export type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
export type DbExecutor = Pick<Database, "select" | "insert" | "update" | "delete" | "execute">;
const globalForDb = globalThis as typeof globalThis & {
  __vidyaPool?: Pool; __vidyaPglite?: PGlite; __vidyaDb?: Database;
};

/** Every supplied DATABASE_URL, including local PostgreSQL, is honored. */
function database(): Database {
  if (globalForDb.__vidyaDb) return globalForDb.__vidyaDb;
  const url = process.env.DATABASE_URL;
  if (url) {
    const parsed = new URL(url);
    if (!["postgres:", "postgresql:"].includes(parsed.protocol) || url.includes("placeholder")) throw new Error("A valid PostgreSQL DATABASE_URL is required.");
    const pool = globalForDb.__vidyaPool ?? new Pool({ connectionString: url, connectionTimeoutMillis: 5000, max: 10 });
    globalForDb.__vidyaPool = pool;
    pool.on("error", () => console.error("[database] connection unavailable"));
    globalForDb.__vidyaDb = drizzleNodePg(pool);
  } else if (process.env.VIDYA_DEV_DATABASE === "pglite" && process.env.NODE_ENV !== "production") {
    // Existing embedded PostgreSQL support is explicitly development/test-only.
    // Never unlink a PID/lock file or use embedded storage silently in production.
    const instance = globalForDb.__vidyaPglite ?? new PGlite(process.env.PGLITE_DATA_DIR || "./.pgdata");
    globalForDb.__vidyaPglite = instance;
    globalForDb.__vidyaDb = drizzlePglite(instance) as unknown as Database;
  } else {
    throw new Error("DATABASE_URL is required. Embedded PostgreSQL must be explicitly enabled for development.");
  }
  return globalForDb.__vidyaDb;
}

// Lazy initialization makes builds independent of a live database/credentials.
export const db = new Proxy({} as Database, {
  get(_target, property) {
    const instance = database();
    const value = Reflect.get(instance, property);
    return typeof value === "function" ? value.bind(instance) : value;
  },
});
export const databaseMode = () => process.env.DATABASE_URL ? "postgresql" : "development-pglite";
export async function closeDatabase() {
  if (globalForDb.__vidyaPool) await globalForDb.__vidyaPool.end();
  if (globalForDb.__vidyaPglite) await globalForDb.__vidyaPglite.close();
  delete globalForDb.__vidyaDb; delete globalForDb.__vidyaPool; delete globalForDb.__vidyaPglite;
}

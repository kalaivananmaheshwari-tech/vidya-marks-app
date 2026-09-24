import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

// Fallback connection string during build time so `next build` doesn't crash
// if DATABASE_URL environment variable is being set or during static page collection
const databaseUrl =
  process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/placeholder";

const globalForDb = globalThis as typeof globalThis & {
  __arenaNextJsPostgresqlPool?: Pool;
};

export const pool =
  globalForDb.__arenaNextJsPostgresqlPool ??
  new Pool({
    connectionString: databaseUrl,
    connectionTimeoutMillis: 5000,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.__arenaNextJsPostgresqlPool = pool;
}

export const db = drizzle(pool);

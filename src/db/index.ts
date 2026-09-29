import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { drizzle as drizzleNodePg } from "drizzle-orm/node-postgres";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { PGlite } from "@electric-sql/pglite";
import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL;

/**
 * Serverless hosts (Vercel, AWS Lambda) hand every invocation a read-only project
 * directory plus a writable `/tmp`. An embedded database living there is wiped on
 * the next cold start, so production deployments must supply a real `DATABASE_URL`
 * (Neon / Supabase / any PostgreSQL). See DEPLOYMENT.md.
 */
const isServerless = Boolean(
  process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME,
);

// Use external postgres pool if a remote connection string is provided
const isRemotePg = Boolean(
  databaseUrl &&
    !databaseUrl.includes("placeholder") &&
    !databaseUrl.includes("127.0.0.1") &&
    !databaseUrl.includes("localhost"),
);

/** `postgres` = persistent external database, `pglite` = embedded (dev/demo only). */
export const dbMode: "postgres" | "pglite" = isRemotePg ? "postgres" : "pglite";

type NodePgDb = ReturnType<typeof drizzleNodePg>;

const globalForDb = globalThis as typeof globalThis & {
  __arenaNextJsPostgresqlPool?: Pool;
  __arenaNextJsPgliteInstance?: PGlite;
  __arenaNextJsDb?: NodePgDb;
  __arenaPgliteShutdownHookRegistered?: boolean;
};

export const pool =
  globalForDb.__arenaNextJsPostgresqlPool ??
  new Pool({
    connectionString:
      databaseUrl || "postgresql://postgres:postgres@localhost:5432/placeholder",
    connectionTimeoutMillis: 5000,
    // Serverless functions are short-lived and scale horizontally: a small pool
    // keeps us well inside the connection limit of a Neon free-tier database.
    max: isServerless ? 3 : 10,
  });

globalForDb.__arenaNextJsPostgresqlPool = pool;

function initDb(): NodePgDb {
  if (globalForDb.__arenaNextJsDb) {
    return globalForDb.__arenaNextJsDb;
  }

  let dbInstance: unknown;
  if (isRemotePg) {
    dbInstance = drizzleNodePg(pool);
  } else {
    if (isServerless) {
      console.warn(
        "[db] DATABASE_URL is not set on a serverless host. Falling back to an " +
          "embedded database in /tmp — data will NOT survive a cold start. " +
          "Add DATABASE_URL (Neon connection string) in your hosting dashboard.",
      );
    }

    const pglitePath =
      process.env.PGLITE_DATA_DIR ||
      (isServerless
        ? path.join(os.tmpdir(), "vidya-pgdata")
        : "./.pgdata");
    const pidFile = path.join(pglitePath, "postmaster.pid");
    if (fs.existsSync(pidFile)) {
      try {
        fs.unlinkSync(pidFile);
      } catch {
        // ignore
      }
    }

    const pglite =
      globalForDb.__arenaNextJsPgliteInstance ?? new PGlite(pglitePath);
    globalForDb.__arenaNextJsPgliteInstance = pglite;
    dbInstance = drizzlePglite(pglite);

    if (
      typeof process !== "undefined" &&
      !globalForDb.__arenaPgliteShutdownHookRegistered
    ) {
      globalForDb.__arenaPgliteShutdownHookRegistered = true;
      const cleanup = async () => {
        if (globalForDb.__arenaNextJsPgliteInstance) {
          try {
            await globalForDb.__arenaNextJsPgliteInstance.close();
          } catch {
            // ignore
          }
        }
      };
      process.on("SIGTERM", cleanup);
      process.on("SIGINT", cleanup);
    }
  }

  const typedDb = dbInstance as NodePgDb;
  globalForDb.__arenaNextJsDb = typedDb;
  return typedDb;
}

export const db: NodePgDb = initDb();

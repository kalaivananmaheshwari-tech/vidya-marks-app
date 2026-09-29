import fs from "node:fs";
import path from "node:path";
import { drizzle as drizzleNodePg } from "drizzle-orm/node-postgres";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { PGlite } from "@electric-sql/pglite";
import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL;
// Use external postgres pool if a remote connection string is provided
const isRemotePg = Boolean(
  databaseUrl &&
    !databaseUrl.includes("placeholder") &&
    !databaseUrl.includes("127.0.0.1") &&
    !databaseUrl.includes("localhost"),
);

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
    const pglitePath = process.env.PGLITE_DATA_DIR || "./.pgdata";
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

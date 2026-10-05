import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { sqlStatements } from "@/db/sql-statements";
import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import { db, type Database } from "@/db";

export const REQUIRED_MIGRATION = "0005_exact_numeric_marks.sql";
/** Atomic/versioned/checksummed; concurrent deploys serialize on a transaction lock. */
export async function migrateDatabase(database: Database = db, through?: string): Promise<string[]> {
  const directory = path.join(process.cwd(), "migrations");
  const files = (await readdir(directory)).filter((f) => /^\d{4}_[a-z0-9_]+\.sql$/.test(f)).sort();
  return database.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(8392147)`);
    await tx.execute(sql`create table if not exists vidya_schema_migrations(version text primary key, checksum text not null, applied_at timestamptz not null default now())`);
    const existing = await tx.execute<{ version: string; checksum: string }>(sql`select version,checksum from vidya_schema_migrations`);
    const applied = new Map(existing.rows.map((r) => [r.version, r.checksum]));
    const newVersions: string[] = [];
    for (const file of files) {
      if (through && file > through) break;
      const source = await readFile(path.join(directory, file), "utf8");
      const checksum = createHash("sha256").update(source).digest("hex");
      if (applied.has(file)) {
        if (applied.get(file) !== checksum) throw new Error("An applied migration checksum changed. Restore the original migration and add a new version.");
        continue;
      }
      for (const statement of sqlStatements(source)) await tx.execute(sql.raw(statement));
      await tx.execute(sql`insert into vidya_schema_migrations(version,checksum) values(${file},${checksum})`);
      newVersions.push(file);
    }
    return newVersions;
  });
}
export async function schemaIsReady(database: Database = db): Promise<boolean> {
  const result = await database.execute<{ present: string | null }>(sql`select to_regclass('public.vidya_schema_migrations')::text as present`);
  if (!result.rows[0]?.present) return false;
  const version = await database.execute(sql`select version from vidya_schema_migrations where version=${REQUIRED_MIGRATION}`);
  return version.rows.length > 0;
}

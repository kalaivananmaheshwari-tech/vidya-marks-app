/**
 * Runs once when the Next.js server process boots (before the first request).
 *
 * Warming the database here means a visitor who opens the app immediately after a
 * restart gets a fully working page instead of a cold-start error.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  // Skip during build time or placeholder env
  if (!process.env.DATABASE_URL || process.env.DATABASE_URL.includes("placeholder")) {
    return;
  }

  try {
    const { ensureSchema } = await import("@/db/bootstrap");
    const { ensureSeed } = await import("@/db/seed");

    await ensureSchema();
    const result = await ensureSeed();
    console.log(
      result.seeded
        ? "[bootstrap] schema ready, demo school seeded"
        : `[bootstrap] schema ready (${result.reason ?? "ok"})`,
    );
  } catch (error) {
    // Never block server startup — requests retry the bootstrap lazily.
    console.error("[bootstrap] deferred:", error instanceof Error ? error.message : error);
  }
}

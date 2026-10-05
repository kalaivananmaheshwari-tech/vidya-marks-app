export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.NEXT_PHASE === "phase-production-build" || process.env.npm_lifecycle_event === "build") return;
  try {
    const { ensureSchema } = await import("@/db/bootstrap");
    const { ensureSeed } = await import("@/db/seed");
    await ensureSchema(); const result = await ensureSeed();
    console.log("[bootstrap] schema ready", { demoSeeded: result.seeded });
  } catch {
    // Readiness stays unavailable until configuration/migrations are resolved.
    // Never log database connection strings or underlying provider errors.
    console.error("[bootstrap] database not ready; check configuration and migrations");
  }
}

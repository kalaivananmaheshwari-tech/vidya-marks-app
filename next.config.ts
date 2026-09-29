import type { NextConfig } from "next";

/**
 * `output: "standalone"` is only enabled for container builds (Docker / Railway /
 * Render / Fly). It is left off for normal `next build` + `next start` runs so the
 * dev preview behaves exactly as before.
 */
const isContainerBuild = process.env.DOCKER_BUILD === "1";

const nextConfig: NextConfig = {
  ...(isContainerBuild ? { output: "standalone" as const } : {}),
  serverExternalPackages: ["@electric-sql/pglite", "pg"],
  poweredByHeader: false,
};

export default nextConfig;

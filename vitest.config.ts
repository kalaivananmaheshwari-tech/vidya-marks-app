import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    fileParallelism: false,
    testTimeout: 30000,
    hookTimeout: 60000,
    env: { DATABASE_URL: process.env.TEST_DATABASE_URL ?? "", VIDYA_DEV_DATABASE: "pglite", PGLITE_DATA_DIR: "memory://", NODE_ENV: "test" },
  },
});

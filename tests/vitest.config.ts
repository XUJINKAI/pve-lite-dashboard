import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  root: fileURLToPath(new URL("../", import.meta.url)),
  test: {
    environment: "jsdom",
    include: ["tests/unit/**/*.test.ts"],
    passWithNoTests: false,
    coverage: { reportsDirectory: fileURLToPath(new URL("./coverage", import.meta.url)) },
  },
});

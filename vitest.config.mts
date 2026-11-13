import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    include: ["tests/unit/**/*.test.ts", "tests/integration/**/*.test.ts"],
    environment: "node",
    globals: false,
    coverage: { provider: "v8", include: ["src/lib/**", "src/server/**"] },
  },
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "src") } },
});

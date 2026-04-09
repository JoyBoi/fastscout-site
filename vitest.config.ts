import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    // Unit tests only — integration tests require a running server (npm run test:integration)
    include: ["src/**/*.test.ts", "convex/**/*.test.ts"],
    globals: true,
    coverage: {
      provider: "v8",
      include: ["src/lib/**", "src/pages/api/**", "convex/**"],
      exclude: ["convex/_generated/**"],
    },
  },
});

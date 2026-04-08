import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "convex/**/*.test.ts"],
    globals: true,
    coverage: {
      provider: "v8",
      include: ["src/lib/**", "src/pages/api/**", "convex/**"],
      exclude: ["convex/_generated/**"],
    },
  },
});

import { describe, it, expect } from "vitest";
import { BASE_URL } from "./setup";

describe("POST /api/token", () => {
  it("returns 401 when no auth cookie is present", async () => {
    const res = await fetch(`${BASE_URL}/api/token`, { method: "POST" });
    expect(res.status).toBe(401);
  });

  it("returns 401 for GET requests without auth", async () => {
    const res = await fetch(`${BASE_URL}/api/token`);
    // Middleware protects this route — unauthenticated GET should be blocked
    expect([401, 302, 403]).toContain(res.status);
  });
});

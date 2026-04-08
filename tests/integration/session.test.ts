import { describe, it, expect } from "vitest";
import { BASE_URL } from "./setup";

describe("GET /api/session", () => {
  it("returns authenticated: false when no cookie is set", async () => {
    const res = await fetch(`${BASE_URL}/api/session`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.authenticated).toBe(false);
    expect(body.subscriptionActive).toBe(false);
  });

  it("returns JSON content-type", async () => {
    const res = await fetch(`${BASE_URL}/api/session`);
    expect(res.headers.get("content-type")).toMatch(/application\/json/);
  });
});

import { describe, it, expect } from "vitest";
import { BASE_URL } from "./setup";

describe("GET /api/extension/data", () => {
  it("returns JSON with makes and models arrays", async () => {
    const res = await fetch(`${BASE_URL}/api/extension/data`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("makes");
    expect(body).toHaveProperty("models");
    expect(Array.isArray(body.makes)).toBe(true);
    expect(Array.isArray(body.models)).toBe(true);
  });

  it("returns minified format with id and n fields", async () => {
    const res = await fetch(`${BASE_URL}/api/extension/data`);
    const body = await res.json();
    if (body.makes.length > 0) {
      expect(body.makes[0]).toHaveProperty("id");
      expect(body.makes[0]).toHaveProperty("n");
    }
    if (body.models.length > 0) {
      expect(body.models[0]).toHaveProperty("id");
      expect(body.models[0]).toHaveProperty("n");
      expect(body.models[0]).toHaveProperty("m"); // makeId
    }
  });
});

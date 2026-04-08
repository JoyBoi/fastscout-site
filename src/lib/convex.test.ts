import { describe, it, expect, vi } from "vitest";
import { parseCookie } from "./cookie";

// Test cookie parsing logic (the core of getConvexServerClient)
// ConvexHttpClient can't be easily tested in isolation without mocking the entire module,
// so we test the cookie extraction behavior directly.

describe("convex client cookie extraction", () => {
  it("extracts convex_token from cookie header", () => {
    const token = "eyJhbGciOiJIUzI1NiJ9.test.sig";
    const cookieHeader = `convex_token=${token}; other=value`;
    const extracted = parseCookie(cookieHeader, "convex_token");
    expect(extracted).toBe(token);
  });

  it("returns null when convex_token is absent", () => {
    const extracted = parseCookie("session=abc; theme=dark", "convex_token");
    expect(extracted).toBeNull();
  });

  it("returns null for empty cookie header", () => {
    const extracted = parseCookie("", "convex_token");
    expect(extracted).toBeNull();
  });

  it("handles JWT with = padding in token value", () => {
    const token = "header.payload.sig==";
    const extracted = parseCookie(`convex_token=${token}`, "convex_token");
    expect(extracted).toBe(token);
  });
});

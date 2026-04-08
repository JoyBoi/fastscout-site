import { describe, it, expect } from "vitest";
import { cookieOptions, parseCookie } from "./cookie";

describe("cookieOptions", () => {
  it("returns secure + sameSite=none + domain for https", () => {
    const opts = cookieOptions("https://fastscout.app");
    expect(opts.secure).toBe(true);
    expect(opts.sameSite).toBe("none");
    expect(opts.domain).toBe(".fastscout.app");
    expect(opts.httpOnly).toBe(true);
    expect(opts.path).toBe("/");
  });

  it("returns no domain + sameSite=lax for localhost", () => {
    const opts = cookieOptions("http://localhost:4321");
    expect(opts.secure).toBe(false);
    expect(opts.sameSite).toBe("lax");
    expect(opts.domain).toBeUndefined();
    expect(opts.httpOnly).toBe(true);
  });

  it("returns no domain for 127.0.0.1", () => {
    const opts = cookieOptions("http://127.0.0.1:4321");
    expect(opts.domain).toBeUndefined();
    expect(opts.secure).toBe(false);
  });

  it("handles invalid URL gracefully", () => {
    const opts = cookieOptions("not-a-url");
    expect(opts.secure).toBe(false);
    expect(opts.sameSite).toBe("lax");
    expect(opts.httpOnly).toBe(true);
  });
});

describe("parseCookie", () => {
  it("returns value for existing cookie", () => {
    expect(parseCookie("foo=bar; baz=qux", "foo")).toBe("bar");
    expect(parseCookie("foo=bar; baz=qux", "baz")).toBe("qux");
  });

  it("returns null for missing cookie", () => {
    expect(parseCookie("foo=bar", "missing")).toBeNull();
  });

  it("handles empty cookie header", () => {
    expect(parseCookie("", "foo")).toBeNull();
  });

  it("handles encoded values", () => {
    const encoded = encodeURIComponent("my token value");
    expect(parseCookie(`convex_token=${encoded}`, "convex_token")).toBe("my token value");
  });

  it("handles value with = sign (e.g., JWT)", () => {
    const jwt = "eyJhbGciOiJIUzI1NiJ9.payload.sig==";
    expect(parseCookie(`token=${jwt}`, "token")).toBe(jwt);
  });
});

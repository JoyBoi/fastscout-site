import { describe, it, expect, vi } from "vitest";

// Stub generated Convex modules (not available until `npx convex dev` is run)
vi.mock("./_generated/server", () => ({ action: vi.fn(), httpAction: vi.fn(), internalAction: vi.fn() }));
vi.mock("./_generated/api", () => ({ api: {}, internal: {} }));
vi.mock("@convex-dev/auth/server", () => ({ getAuthUserId: vi.fn() }));
vi.mock("./_ratelimiter", () => ({ rateLimiter: { limit: vi.fn() } }));

import { resolvePriceId } from "./stripe";

const prices = {
  monthly: "price_monthly_123",
  yearly: "price_yearly_456",
  quarterly: "price_quarterly_789",
  default: "price_monthly_123",
};

describe("resolvePriceId", () => {
  it("returns explicit priceId when provided", () => {
    expect(resolvePriceId("yearly", "price_explicit", prices)).toBe("price_explicit");
  });

  it("resolves monthly price by interval", () => {
    expect(resolvePriceId("monthly", undefined, prices)).toBe("price_monthly_123");
  });

  it("resolves yearly price by interval", () => {
    expect(resolvePriceId("yearly", undefined, prices)).toBe("price_yearly_456");
  });

  it("resolves quarterly price by interval", () => {
    expect(resolvePriceId("quarterly", undefined, prices)).toBe("price_quarterly_789");
  });

  it("falls back to monthly when interval is undefined", () => {
    expect(resolvePriceId(undefined, undefined, prices)).toBe("price_monthly_123");
  });

  it("falls back to default when interval is unknown", () => {
    expect(resolvePriceId("unknown_interval", undefined, prices)).toBe("price_monthly_123");
  });

  it("returns undefined when no prices are configured", () => {
    expect(resolvePriceId("monthly", undefined, {})).toBeUndefined();
  });

  it("explicit priceId takes priority over any interval", () => {
    expect(resolvePriceId(undefined, "price_override", prices)).toBe("price_override");
  });
});

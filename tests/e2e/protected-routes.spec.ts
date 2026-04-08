import { test, expect } from "@playwright/test";

test.describe("Protected routes (unauthenticated)", () => {
  // page.goto follows redirects — confirm we end up on /auth
  test("dashboard redirects to /auth", async ({ page }) => {
    await page.goto("/dashboard");
    expect(page.url()).toContain("/auth");
  });

  test("i18n: /fr/dashboard redirects to /auth", async ({ page }) => {
    await page.goto("/fr/dashboard");
    expect(page.url()).toContain("/auth");
  });

  test("i18n: /en/dashboard redirects to /auth", async ({ page }) => {
    await page.goto("/en/dashboard");
    expect(page.url()).toContain("/auth");
  });

  test("i18n: /nl/dashboard redirects to /auth", async ({ page }) => {
    await page.goto("/nl/dashboard");
    expect(page.url()).toContain("/auth");
  });

  test("POST /api/token returns 401 without auth cookie", async ({ request }) => {
    const res = await request.post("/api/token");
    expect(res.status()).toBe(401);
  });

  test("middleware emits security headers on public page", async ({ page }) => {
    const res = await page.goto("/");
    const headers = res?.headers() ?? {};
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["x-frame-options"]).toBe("DENY");
    expect(headers["x-xss-protection"]).toBeDefined();
    expect(headers["referrer-policy"]).toBeDefined();
  });

  test("auth page itself has security headers", async ({ page }) => {
    const res = await page.goto("/auth");
    const headers = res?.headers() ?? {};
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["x-frame-options"]).toBe("DENY");
  });
});

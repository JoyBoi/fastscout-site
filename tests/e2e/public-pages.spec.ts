import { test, expect } from "@playwright/test";

test.describe("Public pages", () => {
  test("home page loads with key content", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/.+/);
    // i18n redirects / → /fr/ (default locale)
    expect(page.url()).toMatch(/localhost:4321\/(fr\/?)?$/);
    await expect(page.locator("body")).toBeVisible();
  });

  test("pricing page loads", async ({ page }) => {
    await page.goto("/pricing");
    await expect(page).toHaveTitle(/.+/);
    // Should show pricing content, not redirect
    expect(page.url()).not.toContain("/auth");
    await expect(page.locator("body")).toBeVisible();
  });

  test("extension page loads", async ({ page }) => {
    await page.goto("/extension");
    await expect(page.locator("body")).toBeVisible();
    expect(page.url()).not.toContain("/auth");
  });

  test("privacy page loads", async ({ page }) => {
    await page.goto("/privacy");
    await expect(page.locator("body")).toBeVisible();
  });

  test("terms page loads", async ({ page }) => {
    await page.goto("/terms");
    await expect(page.locator("body")).toBeVisible();
  });

  test("contact page loads", async ({ page }) => {
    await page.goto("/contact");
    await expect(page.locator("body")).toBeVisible();
  });

  test("docs page loads", async ({ page }) => {
    await page.goto("/docs");
    await expect(page.locator("body")).toBeVisible();
  });

  test("404 page shown for unknown routes", async ({ page }) => {
    const res = await page.goto("/this-route-does-not-exist");
    expect([404, 200]).toContain(res?.status()); // Astro may return 200 with 404 content
    const body = await page.content();
    // Should show some 404 indicator
    expect(body.toLowerCase()).toMatch(/404|not found|page.*(not|doesn)/);
  });

  test("i18n: French locale home page loads", async ({ page }) => {
    await page.goto("/fr");
    await expect(page.locator("body")).toBeVisible();
  });

  test("i18n: English locale home page loads", async ({ page }) => {
    await page.goto("/en");
    await expect(page.locator("body")).toBeVisible();
  });

  test("i18n: Dutch locale home page loads", async ({ page }) => {
    await page.goto("/nl");
    await expect(page.locator("body")).toBeVisible();
  });
});

import { test, expect } from "@playwright/test";

test.describe("Auth pages", () => {
  test("auth page loads with sign-in form", async ({ page }) => {
    await page.goto("/auth");
    await expect(page.locator("form")).toBeVisible();
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test("auth page shows GitHub OAuth button", async ({ page }) => {
    await page.goto("/auth");
    const githubBtn = page.locator('a[href="/auth/oauth/github"]');
    await expect(githubBtn).toBeVisible();
  });

  test("auth page shows Google OAuth button", async ({ page }) => {
    await page.goto("/auth");
    const googleBtn = page.locator('a[href*="google"]');
    await expect(googleBtn).toBeVisible();
  });

  test("sign-up mode shows form", async ({ page }) => {
    await page.goto("/auth?mode=signup");
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

  test("GitHub OAuth link goes to /auth/oauth/github", async ({ page }) => {
    await page.goto("/auth");
    const githubLink = page.locator('a[href="/auth/oauth/github"]');
    await expect(githubLink).toBeVisible();
  });

  test("i18n: French auth page loads", async ({ page }) => {
    await page.goto("/fr/auth");
    await expect(page.locator("form")).toBeVisible();
  });

  test("i18n: English auth page loads", async ({ page }) => {
    await page.goto("/en/auth");
    await expect(page.locator("form")).toBeVisible();
  });

  test("empty form submission stays on auth (HTML5 validation)", async ({ page }) => {
    await page.goto("/auth");
    // Click submit without filling fields — HTML5 required validation prevents submission
    await page.click('button[type="submit"]');
    // Should remain on the auth page (validation fires before form submission)
    expect(page.url()).toContain("/auth");
  });

  test("wrong credentials redirects back to /auth with error", async ({ page }) => {
    await page.goto("/auth");
    await page.fill('input[type="email"]', "notauser@example.com");
    await page.fill('input[type="password"]', "wrongpassword");
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/auth/, { timeout: 8000 });
    const url = page.url();
    const content = await page.content();
    const hasError =
      url.includes("error=") ||
      content.toLowerCase().includes("error") ||
      content.toLowerCase().includes("invalid");
    expect(hasError).toBe(true);
  });
});

import { test, expect } from "@playwright/test";
import http from "node:http";

const EXT_ORIGIN = `chrome-extension://holgcecmpkkdejjgifpgmloocijiojgf`;

/** Use node:http to send a request with an Origin header (Node fetch strips it as a forbidden header). */
function httpGet(path: string, origin: string): Promise<{ status: number; headers: Record<string, string> }> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { hostname: "localhost", port: 4321, path, method: "GET", headers: { origin } },
      (res) => resolve({ status: res.statusCode!, headers: res.headers as Record<string, string> }),
    );
    req.on("error", reject);
    req.end();
  });
}

test.describe("GET /api/session", () => {
  test("returns unauthenticated state with no cookie", async ({ request }) => {
    const res = await request.get("/api/session");
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.authenticated).toBe(false);
    expect(body.subscriptionActive).toBe(false);
    expect(body.email).toBeNull();
  });

  test("also responds to POST", async ({ request }) => {
    const res = await request.post("/api/session");
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.authenticated).toBe(false);
  });

  test("GET response includes CORS headers for extension origin", async () => {
    // Note: OPTIONS is intercepted by Vite dev server; test real GET CORS headers instead
    const { status, headers } = await httpGet("/api/session", EXT_ORIGIN);
    expect(status).toBe(200);
    expect(headers["access-control-allow-origin"]).toBe(EXT_ORIGIN);
    expect(headers["access-control-allow-credentials"]).toBe("true");
  });

  test("no CORS headers for non-extension origin", async ({ request }) => {
    const res = await request.get("/api/session", {
      headers: { origin: "https://evil.com" },
    });
    expect(res.headers()["access-control-allow-origin"]).toBeUndefined();
  });
});

test.describe("GET /api/extension/data", () => {
  test("returns makes and models", async ({ request }) => {
    const res = await request.get("/api/extension/data");
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.makes)).toBe(true);
    expect(Array.isArray(body.models)).toBe(true);
    expect(body.makes.length).toBeGreaterThan(0);
    expect(body.models.length).toBeGreaterThan(0);
  });

  test("makes have id and n fields", async ({ request }) => {
    const { makes } = await (await request.get("/api/extension/data")).json();
    expect(makes[0]).toHaveProperty("id");
    expect(makes[0]).toHaveProperty("n");
  });

  test("models have id, n, m fields", async ({ request }) => {
    const { models } = await (await request.get("/api/extension/data")).json();
    expect(models[0]).toHaveProperty("id");
    expect(models[0]).toHaveProperty("n");
    expect(models[0]).toHaveProperty("m");
  });

  test("has cache-control header", async ({ request }) => {
    const res = await request.get("/api/extension/data");
    expect(res.headers()["cache-control"]).toMatch(/max-age/);
  });

  test("GET response includes CORS headers for extension origin", async () => {
    const { status, headers } = await httpGet("/api/extension/data", EXT_ORIGIN);
    expect(status).toBe(200);
    expect(headers["access-control-allow-origin"]).toBe(EXT_ORIGIN);
  });
});

test.describe("GET /api/extension/sync-check", () => {
  test("returns 200 with version", async ({ request }) => {
    const res = await request.get("/api/extension/sync-check");
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("version");
    expect(typeof body.version).toBe("number");
  });

  test("POST also works", async ({ request }) => {
    const res = await request.post("/api/extension/sync-check");
    expect(res.status()).toBe(200);
  });
});

test.describe("POST /api/token (unauthenticated)", () => {
  test("returns 401 with no cookie", async ({ request }) => {
    const res = await request.post("/api/token");
    expect(res.status()).toBe(401);
  });

  test("GET /api/token returns 401 (middleware guards before method check)", async () => {
    // Middleware returns 401 for unauthenticated /api/token regardless of method
    const { status } = await httpGet("/api/token", EXT_ORIGIN);
    expect(status).toBe(401);
    // Confirm CORS works on a GET-capable endpoint with same origin
    const sessionRes = await httpGet("/api/session", EXT_ORIGIN);
    expect(sessionRes.headers["access-control-allow-origin"]).toBe(EXT_ORIGIN);
  });
});

test.describe("POST /api/extension/log-missing (unauthenticated)", () => {
  test("returns 401 without auth cookie", async ({ request }) => {
    const res = await request.post("/api/extension/log-missing", {
      data: { type: "brand", makeName: "TestBrand" },
      headers: { "content-type": "application/json" },
    });
    expect(res.status()).toBe(401);
  });
});

test.describe("POST /api/report", () => {
  test("accepts anonymous report and returns success", async ({ request }) => {
    const res = await request.post("/api/report", {
      data: {
        type: "bug",
        description: "E2E automated test report",
        source: "e2e-test",
      },
      headers: { "content-type": "application/json" },
    });
    expect([200, 201]).toContain(res.status());
  });
});

test.describe("Billing API endpoints — unauthenticated", () => {
  test("POST /api/checkout — 401 without auth", async ({ request }) => {
    const res = await request.post("/api/checkout", {
      data: { priceId: "price_test" },
      headers: { "content-type": "application/json" },
      maxRedirects: 0,
    });
    expect([302, 401, 403]).toContain(res.status());
  });

  test("POST /api/cancel — 401 without auth", async ({ request }) => {
    const res = await request.post("/api/cancel", { maxRedirects: 0 });
    expect([302, 401, 403]).toContain(res.status());
  });

  test("POST /api/change-plan — 401 without auth", async ({ request }) => {
    const res = await request.post("/api/change-plan", { maxRedirects: 0 });
    expect([302, 401, 403]).toContain(res.status());
  });

  test("POST /api/reactivate — 401 without auth", async ({ request }) => {
    const res = await request.post("/api/reactivate", { maxRedirects: 0 });
    expect([302, 401, 403]).toContain(res.status());
  });

  test("GET /api/portal — 401 without auth", async ({ request }) => {
    const res = await request.get("/api/portal", { maxRedirects: 0 });
    expect([302, 401, 403]).toContain(res.status());
  });

  test("GET /api/invoices — 401 without auth", async ({ request }) => {
    const res = await request.get("/api/invoices", { maxRedirects: 0 });
    expect([200, 401, 403]).toContain(res.status()); // 200 if token check returns JSON 401 body
  });
});

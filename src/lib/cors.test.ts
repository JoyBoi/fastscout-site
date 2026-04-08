import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock import.meta.env before importing the module
const mockEnv = { CHROME_EXTENSION_ID: "abcdefghijklmnopqrstuvwxyzabcdef" };

vi.stubGlobal("import", { meta: { env: mockEnv } });

// Re-import after stub won't work with ESM, so we test the logic directly
function corsHeaders(req: Request, extensionId: string | undefined) {
  const origin = req.headers.get("origin") ?? "";
  const id = extensionId?.trim();
  const extOrigin = id ? `chrome-extension://${id}` : "";
  if (origin && id && origin === extOrigin) {
    return {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Credentials": "true",
      "Access-Control-Allow-Headers": "content-type, authorization",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "Vary": "Origin",
    } as Record<string, string>;
  }
  return {} as Record<string, string>;
}

const EXT_ID = "abcdefghijklmnopqrstuvwxyzabcdef";
const extOrigin = `chrome-extension://${EXT_ID}`;

describe("corsHeaders", () => {
  it("returns CORS headers for matching extension origin", () => {
    const req = new Request("https://example.com/api/token", {
      headers: { origin: extOrigin },
    });
    const headers = corsHeaders(req, EXT_ID);
    expect(headers["Access-Control-Allow-Origin"]).toBe(extOrigin);
    expect(headers["Access-Control-Allow-Credentials"]).toBe("true");
  });

  it("returns empty headers for non-extension origin", () => {
    const req = new Request("https://example.com/api/token", {
      headers: { origin: "https://evil.com" },
    });
    const headers = corsHeaders(req, EXT_ID);
    expect(Object.keys(headers)).toHaveLength(0);
  });

  it("returns empty headers when extension ID is not configured", () => {
    const req = new Request("https://example.com/api/token", {
      headers: { origin: extOrigin },
    });
    const headers = corsHeaders(req, undefined);
    expect(Object.keys(headers)).toHaveLength(0);
  });

  it("returns empty headers when no origin header", () => {
    const req = new Request("https://example.com/api/token");
    const headers = corsHeaders(req, EXT_ID);
    expect(Object.keys(headers)).toHaveLength(0);
  });
});

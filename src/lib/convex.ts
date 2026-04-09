import { ConvexHttpClient } from "convex/browser";

let _client: ConvexHttpClient | null = null;

/** Unauthenticated singleton — use for public queries only. */
export function getConvexClient(): ConvexHttpClient {
  if (!_client) {
    const url = import.meta.env.CONVEX_URL;
    if (!url) throw new Error("CONVEX_URL environment variable is required");
    _client = new ConvexHttpClient(url);
  }
  return _client;
}

function parseCookie(cookieHeader: string, name: string): string | null {
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : null;
}

/** Per-request client with convex_token auth set if present. */
export function getConvexServerClient(request: Request): { client: ConvexHttpClient; token: string | null } {
  const url = import.meta.env.CONVEX_URL;
  if (!url) throw new Error("CONVEX_URL environment variable is required");
  const client = new ConvexHttpClient(url);
  const token = parseCookie(request.headers.get("cookie") ?? "", "convex_token");
  if (token) client.setAuth(token);
  return { client, token };
}

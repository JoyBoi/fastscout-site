import type { MiddlewareHandler } from "astro";

// Security headers applied to all responses
const securityHeaders: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "X-XSS-Protection": "1; mode=block",
  "Referrer-Policy": "strict-origin-when-cross-origin",
};

function addSecurityHeaders(response: Response): Response {
  const newHeaders = new Headers(response.headers);
  for (const [key, value] of Object.entries(securityHeaders)) {
    newHeaders.set(key, value);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders,
  });
}

function hasConvexToken(request: Request): boolean {
  const cookie = request.headers.get("cookie") ?? "";
  return /(?:^|;\s*)convex_token=/.test(cookie);
}

export const onRequest: MiddlewareHandler = async (ctx, next) => {
  const { url } = ctx;
  const pathname = new URL(url).pathname;

  // Protect dashboard: redirect to auth page if no session cookie
  if (pathname.startsWith("/dashboard") || pathname.match(/^\/[a-z]{2}\/dashboard/)) {
    if (!hasConvexToken(ctx.request)) {
      const locale = pathname.match(/^\/([a-z]{2})\//)?.[1] || "fr";
      return addSecurityHeaders(
        new Response(null, { status: 302, headers: { Location: `/${locale}/auth` } })
      );
    }
  }

  // Protect token endpoint: return 401 if no session cookie
  if (pathname.startsWith("/api/token")) {
    if (!hasConvexToken(ctx.request)) {
      return addSecurityHeaders(
        new Response(JSON.stringify({ error: "unauthorized" }), {
          status: 401,
          headers: { "content-type": "application/json" },
        })
      );
    }
  }

  const response = await next();
  return addSecurityHeaders(response);
};

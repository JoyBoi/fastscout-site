import type { MiddlewareHandler } from "astro";
import { createServerClient, parseCookieHeader } from "@supabase/ssr";
import type { CookieMethodsServer } from "@supabase/ssr";

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

export const onRequest: MiddlewareHandler = async (ctx, next) => {
  const { url } = ctx;
  const pathname = new URL(url).pathname;

  if (pathname.startsWith("/dashboard") || pathname.startsWith("/api/token")) {
    const cookieMethods: CookieMethodsServer = {
      getAll: async () =>
        (parseCookieHeader(ctx.request.headers.get("cookie") ?? "") || []).map((c) => ({
          name: c.name,
          value: c.value ?? "",
        })),
      setAll: async (cookies) => {
        cookies.forEach(({ name, value, options }) => {
          ctx.cookies.set(name, value, options as any);
        });
      },
    };

    const supabase = createServerClient(
      import.meta.env.PUBLIC_SUPABASE_URL,
      import.meta.env.PUBLIC_SUPABASE_ANON_KEY,
      {
        cookies: cookieMethods,
      }
    );
    const { data } = await supabase.auth.getUser();
    if (!data.user) {
      if (pathname.startsWith("/dashboard")) {
        return addSecurityHeaders(new Response(null, { status: 302, headers: { Location: "/auth" } }));
      }
      if (pathname.startsWith("/api/token")) {
        return addSecurityHeaders(new Response("Unauthorized", { status: 401 }));
      }
    }
  }

  const response = await next();
  return addSecurityHeaders(response);
};

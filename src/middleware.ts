import type { MiddlewareHandler } from "astro";
import { createServerClient, parseCookieHeader } from "@supabase/ssr";
import type { CookieMethodsServer } from "@supabase/ssr";

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
        return new Response(null, { status: 302, headers: { Location: "/auth" } });
      }
      if (pathname.startsWith("/api/token")) {
        return new Response("Unauthorized", { status: 401 });
      }
    }
  }

  return next();
};

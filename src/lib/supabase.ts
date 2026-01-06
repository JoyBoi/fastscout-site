import type { AstroGlobal } from "astro";
import { createServerClient, parseCookieHeader, serializeCookieHeader } from "@supabase/ssr";
import type { CookieMethodsServer } from "@supabase/ssr";
import { createClient as createBrowserClient } from "@supabase/supabase-js";

export function getSupabaseServerClient(Astro: AstroGlobal | { request: Request; cookies?: { set: (name: string, value: string, options?: any) => void } }) {
  const cookieMethods: CookieMethodsServer = {
    getAll: async () =>
      (parseCookieHeader(Astro.request.headers.get("cookie") ?? "") || []).map((c) => ({
        name: c.name,
        value: c.value ?? "",
      })),
    setAll: async (cookies) => {
      const siteUrl = import.meta.env.SITE_URL as string | undefined;
      let domain: string | undefined;
      let secure = false;
      let sameSite: "none" | "lax" | "strict" | undefined;
      try {
        if (siteUrl && /^https?:\/\//.test(siteUrl)) {
          const u = new URL(siteUrl);
          const host = u.hostname;
          const isLocal = host === "localhost" || host.endsWith(".localhost");
          if (!isLocal) {
            domain = `.${host}`;
          } else {
            domain = undefined;
          }
          secure = u.protocol === "https:";
          sameSite = secure ? "none" : "lax";
        }
      } catch {}
      cookies.forEach(({ name, value, options }) => {
        const o = {
          ...options,
          path: "/",
          domain: domain ?? (options as any)?.domain,
          secure: secure ?? (options as any)?.secure,
          sameSite: (sameSite ?? (options as any)?.sameSite) as any,
        };
        const header = serializeCookieHeader(name, value, o as any);
        const anyAstro = Astro as any;
        if (anyAstro?.response?.headers) {
          anyAstro.response.headers.append("Set-Cookie", header);
        } else if (anyAstro?.cookies?.set) {
          anyAstro.cookies.set(name, value, o as any);
        }
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
  return supabase;
}

export function getSupabaseBrowserClient() {
  return createBrowserClient(
    import.meta.env.PUBLIC_SUPABASE_URL,
    import.meta.env.PUBLIC_SUPABASE_ANON_KEY
  );
}

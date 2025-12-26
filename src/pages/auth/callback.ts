import type { APIRoute } from "astro";
import { getSupabaseServerClient } from "../../lib/supabase";

export const GET: APIRoute = async (ctx) => {
  const siteUrl = import.meta.env.SITE_URL as string;
  const supabase = getSupabaseServerClient(ctx as any);
  const code = new URL(ctx.url).searchParams.get("code");
  if (!code) return new Response("Missing code", { status: 400 });
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return new Response("OAuth callback failed", { status: 401 });
  try {
    const u = new URL(siteUrl);
    const host = u.hostname;
    const isLocal = host === "localhost" || host.endsWith(".localhost");
    const domain = isLocal ? undefined : host;
    const secure = u.protocol === "https:";
    const sameSite = secure ? "none" : "lax";
    ctx.cookies.set("fs_session", "1", {
      path: "/",
      domain,
      secure,
      sameSite,
      httpOnly: true,
      maxAge: 60 * 60 * 24 * 365,
    });
  } catch {}
  return new Response(null, { status: 302, headers: { Location: `${siteUrl}/dashboard` } });
};

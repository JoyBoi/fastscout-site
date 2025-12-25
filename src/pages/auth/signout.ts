import type { APIRoute } from "astro";
import { getSupabaseServerClient } from "../../lib/supabase";

export const GET: APIRoute = async (ctx) => {
  const supabase = getSupabaseServerClient(ctx as any);
  await supabase.auth.signOut();
  const siteUrl = import.meta.env.SITE_URL as string;
  try {
    const u = new URL(siteUrl);
    const host = u.hostname;
    const isLocal = host === "localhost" || host.endsWith(".localhost");
    const domain = isLocal ? undefined : `.${host}`;
    const secure = u.protocol === "https:";
    const sameSite = secure ? "none" : "lax";
    ctx.cookies.set("fs_session", "", {
      path: "/",
      domain,
      secure,
      sameSite,
      httpOnly: true,
      maxAge: 0,
    });
  } catch {}
  return new Response(null, { status: 302, headers: { Location: siteUrl } });
};

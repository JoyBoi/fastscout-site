import type { APIRoute } from "astro";
import { getSupabaseServerClient } from "../../lib/supabase";

export const POST: APIRoute = async (ctx) => {
  const supabase = getSupabaseServerClient(ctx as any);
  let email = "";
  let password = "";
  try {
    const form = await ctx.request.formData();
    email = String(form.get("email") ?? "").trim();
    password = String(form.get("password") ?? "");
  } catch {}
  if (!email || !password) return new Response(null, { status: 302, headers: { Location: "/auth?error=missing_credentials" } });

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  const siteUrl = import.meta.env.SITE_URL as string;
  if (error || !data?.session) return new Response(null, { status: 302, headers: { Location: "/auth?error=invalid_credentials" } });
  try {
    const u = new URL(siteUrl);
    const host = u.hostname;
    const isLocal = host === "localhost" || host.endsWith(".localhost");
    const domain = isLocal ? undefined : `.${host}`;
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

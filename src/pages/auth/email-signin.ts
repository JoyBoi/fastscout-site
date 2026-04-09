import type { APIRoute } from "astro";
import { cookieOptions } from "../../lib/cookie";

export const prerender = false;

export const POST: APIRoute = async (ctx) => {
  const formData = await ctx.request.formData();
  const email = formData.get("email")?.toString()?.trim()?.toLowerCase();
  const password = formData.get("password")?.toString();
  const locale = formData.get("locale")?.toString() || "fr";
  const siteUrl = import.meta.env.SITE_URL?.trim();
  const convexSiteUrl = import.meta.env.PUBLIC_CONVEX_SITE_URL?.trim();

  if (!email || !password) {
    return new Response(null, { status: 302, headers: { Location: `/${locale}/auth?error=missing_fields` } });
  }

  const res = await fetch(`${convexSiteUrl}/api/auth/signin/password`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password, flow: "signIn" }),
  }).catch(() => null);

  if (!res || !res.ok) {
    return new Response(null, { status: 302, headers: { Location: `/${locale}/auth?error=invalid_credentials` } });
  }

  const data = (await res.json()) as { token?: string; redirect?: string; verifier?: string };

  if (data.redirect && data.verifier) {
    // Email verification required
    return new Response(null, { status: 302, headers: { Location: `/${locale}/auth?message=check_email` } });
  }

  if (!data.token) {
    return new Response(null, { status: 302, headers: { Location: `/${locale}/auth?error=sign_in_failed` } });
  }

  ctx.cookies.set("convex_token", data.token, { ...cookieOptions(siteUrl), maxAge: 60 * 60 * 24 });
  return new Response(null, { status: 302, headers: { Location: `/${locale}/dashboard?welcome=1` } });
};

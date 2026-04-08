import type { APIRoute } from "astro";
import { cookieOptions } from "../../lib/cookie";
export const prerender = false;

export const GET: APIRoute = async (ctx) => {
  const siteUrl = import.meta.env.SITE_URL;
  const convexUrl = import.meta.env.PUBLIC_CONVEX_URL;
  const code = new URL(ctx.request.url).searchParams.get("code");
  if (!code)
    return new Response(null, { status: 302, headers: { Location: "/auth?error=missing_code" } });

  const res = await fetch(`${convexUrl}/api/auth/token`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ code }),
  });
  if (!res.ok)
    return new Response(null, { status: 302, headers: { Location: "/auth?error=token_exchange_failed" } });

  const data = (await res.json()) as { token?: string };
  if (!data.token)
    return new Response(null, { status: 302, headers: { Location: "/auth?error=no_token" } });

  ctx.cookies.set("convex_token", data.token, { ...cookieOptions(siteUrl), maxAge: 60 * 60 * 24 });
  return new Response(null, { status: 302, headers: { Location: `${siteUrl}/dashboard` } });
};

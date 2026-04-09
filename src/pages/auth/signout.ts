import type { APIRoute } from "astro";
import { cookieOptions } from "../../lib/cookie";

export const prerender = false;

function signOut(ctx: Parameters<APIRoute>[0]) {
  const siteUrl = import.meta.env.SITE_URL?.trim();
  ctx.cookies.set("convex_token", "", { ...cookieOptions(siteUrl), maxAge: 0 });
  return new Response(null, { status: 302, headers: { Location: "/" } });
}

export const POST: APIRoute = signOut;
export const GET: APIRoute = signOut;

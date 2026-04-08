import type { APIRoute } from "astro";
export const prerender = false;
export const GET: APIRoute = async () => {
  const convexUrl = import.meta.env.PUBLIC_CONVEX_URL?.trim();
  const siteUrl = import.meta.env.SITE_URL?.trim();
  const redirectTo = encodeURIComponent(`${siteUrl}/auth/callback`);
  return new Response(null, { status: 302, headers: { Location: `${convexUrl}/api/auth/signin/github?redirectTo=${redirectTo}` } });
};

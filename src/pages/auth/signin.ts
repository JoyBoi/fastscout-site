import type { APIRoute } from "astro";
export const prerender = false;
// Legacy route — redirects to GitHub OAuth
export const GET: APIRoute = async () => {
  const convexUrl = import.meta.env.PUBLIC_CONVEX_URL;
  const siteUrl = import.meta.env.SITE_URL;
  const redirectTo = encodeURIComponent(`${siteUrl}/auth/callback`);
  return new Response(null, { status: 302, headers: { Location: `${convexUrl}/api/auth/signin/github?redirectTo=${redirectTo}` } });
};

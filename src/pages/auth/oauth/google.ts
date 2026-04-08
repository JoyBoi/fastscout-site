import type { APIRoute } from "astro";
import { getConvexClient } from "../../../lib/convex";
import { api } from "../../../../convex/_generated/api";
export const prerender = false;

export const GET: APIRoute = async (ctx) => {
  const siteUrl = import.meta.env.SITE_URL?.trim();
  const redirectTo = `${siteUrl}/auth/callback`;

  const convex = getConvexClient();
  let result: { redirect?: string; verifier?: string };
  try {
    result = await convex.action(api.auth.signIn, {
      provider: "google",
      params: { redirectTo },
    });
  } catch (e: any) {
    return new Response(null, {
      status: 302,
      headers: { Location: `${siteUrl}/auth?error=${encodeURIComponent(e?.message ?? "oauth_error")}` },
    });
  }

  if (!result.redirect) {
    return new Response(null, {
      status: 302,
      headers: { Location: `${siteUrl}/auth?error=no_redirect` },
    });
  }

  return new Response(null, { status: 302, headers: { Location: result.redirect } });
};

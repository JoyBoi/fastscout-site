import type { APIRoute } from "astro";
import { getConvexClient } from "../../../lib/convex";
import { cookieOptions } from "../../../lib/cookie";
import { api } from "../../../../convex/_generated/api";
export const prerender = false;

export const GET: APIRoute = async (ctx) => {
  const siteUrl = import.meta.env.SITE_URL?.trim();
  const redirectTo = `${siteUrl}/auth/callback`;

  const convex = getConvexClient();
  let result: { redirect?: string; verifier?: string };
  try {
    result = await convex.action(api.auth.signIn, {
      provider: "github",
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

  // Store verifier in a short-lived cookie so callback.ts can use it
  const headers = new Headers({ Location: result.redirect });
  if (result.verifier) {
    const opts = cookieOptions(siteUrl);
    const secure = opts.secure ? "; Secure" : "";
    const sameSite = `; SameSite=${opts.secure ? "None" : "Lax"}`;
    const domain = opts.domain ? `; Domain=${opts.domain}` : "";
    headers.append(
      "Set-Cookie",
      `convex_verifier=${encodeURIComponent(result.verifier)}; Path=/; Max-Age=600; HttpOnly${secure}${sameSite}${domain}`,
    );
  }

  return new Response(null, { status: 302, headers });
};

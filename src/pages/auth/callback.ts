import type { APIRoute } from "astro";
import { cookieOptions, parseCookie } from "../../lib/cookie";
import { getConvexClient } from "../../lib/convex";
import { api } from "../../../convex/_generated/api";

export const prerender = false;

export const GET: APIRoute = async (ctx) => {
  const siteUrl = import.meta.env.SITE_URL?.trim();
  const code = new URL(ctx.request.url).searchParams.get("code");

  if (!code) {
    return new Response(null, {
      status: 302,
      headers: { Location: `${siteUrl}/auth?error=missing_code` },
    });
  }

  // Retrieve verifier stored during OAuth initiation
  const cookieHeader = ctx.request.headers.get("cookie") ?? "";
  const verifier = parseCookie(cookieHeader, "convex_verifier") ?? undefined;

  const convex = getConvexClient();
  let result: { tokens?: { token: string; refreshToken?: string } | null };
  try {
    result = await convex.action(api.auth.signIn, {
      params: { code },
      verifier,
    });
  } catch (e: any) {
    const msg = encodeURIComponent(e?.message ?? "token_exchange_failed");
    return new Response(null, {
      status: 302,
      headers: { Location: `${siteUrl}/auth?error=${msg}` },
    });
  }

  const token = result?.tokens?.token;
  if (!token) {
    return new Response(null, {
      status: 302,
      headers: { Location: `${siteUrl}/auth?error=no_token` },
    });
  }

  const opts = cookieOptions(siteUrl);
  const secure = opts.secure ? "; Secure" : "";
  const sameSite = `; SameSite=${opts.secure ? "None" : "Lax"}`;
  const domain = opts.domain ? `; Domain=${opts.domain}` : "";
  const maxAge = 60 * 60 * 24; // 24h

  // Set auth cookie and clear the verifier cookie
  const responseHeaders = new Headers({
    Location: `${siteUrl}/dashboard?welcome=1`,
  });
  responseHeaders.append(
    "Set-Cookie",
    `convex_token=${encodeURIComponent(token)}; Path=/; Max-Age=${maxAge}; HttpOnly${secure}${sameSite}${domain}`,
  );
  responseHeaders.append(
    "Set-Cookie",
    `convex_verifier=; Path=/; Max-Age=0; HttpOnly${secure}${sameSite}${domain}`,
  );

  return new Response(null, { status: 302, headers: responseHeaders });
};

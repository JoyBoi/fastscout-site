import type { APIRoute } from "astro";
import { corsHeaders, preflight } from "../../../lib/cors";
import { getConvexClient } from "../../../lib/convex";
import { api } from "../../../../convex/_generated/api";

export const prerender = false;

// ---------------------------------------------------------------------------
// POST /api/auth/extension-login
// Accepts { email, password } from extension popup, validates credentials via
// Convex Auth password provider, returns a short-lived extension JWT.
// ---------------------------------------------------------------------------
export const POST: APIRoute = async (ctx) => {
  const pf = preflight(ctx.request);
  if (pf) return pf;

  const headers = { "content-type": "application/json", ...corsHeaders(ctx.request) };

  let payload: { email?: string; password?: string };
  try {
    payload = await ctx.request.json();
  } catch {
    return new Response(JSON.stringify({ error: "invalid_json" }), { status: 400, headers });
  }

  const email = payload.email?.trim()?.toLowerCase();
  const password = payload.password;

  if (!email || !password) {
    return new Response(JSON.stringify({ error: "missing_fields" }), { status: 400, headers });
  }

  // Rate limit
  const convex = getConvexClient();
  let allowed: boolean;
  try {
    allowed = await convex.mutation(api.rateLimit.checkRateLimit, { userId: email, action: "token" });
  } catch {
    allowed = false;
  }
  if (!allowed) {
    return new Response(JSON.stringify({ error: "rate_limited" }), { status: 429, headers });
  }

  // Sign in via Convex Auth password provider
  const convexSiteUrl = import.meta.env.PUBLIC_CONVEX_SITE_URL?.trim();
  const res = await fetch(`${convexSiteUrl}/api/auth/signin/password`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password, flow: "signIn" }),
  }).catch(() => null);

  if (!res || !res.ok) {
    return new Response(JSON.stringify({ error: "invalid_credentials" }), { status: 401, headers });
  }

  const data = (await res.json()) as { token?: string };
  if (!data.token) {
    return new Response(JSON.stringify({ error: "invalid_credentials" }), { status: 401, headers });
  }

  return new Response(
    JSON.stringify({ ok: true, email, convex_token: data.token }),
    { status: 200, headers },
  );
};

export const OPTIONS: APIRoute = async (ctx) => {
  const pf = preflight(ctx.request);
  if (pf) return pf;
  return new Response(null, { status: 204, headers: { ...corsHeaders(ctx.request) } });
};

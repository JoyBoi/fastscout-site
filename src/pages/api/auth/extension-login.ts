import type { APIRoute } from "astro";
import bcrypt from "bcryptjs";
import { corsHeaders, preflight } from "../../../lib/cors";
import { makeSessionCookieHeader } from "../../../lib/auth";
import { getConvexClient } from "../../../lib/convex";
import { api } from "../../../../convex/_generated/api";

export const prerender = false;

// ---------------------------------------------------------------------------
// POST /api/auth/extension-login
// Accepts { email, password } from extension popup, validates credentials,
// sets ab_session cookie, returns JSON result.
// ---------------------------------------------------------------------------
export const POST: APIRoute = async (ctx) => {
  const pf = preflight(ctx.request);
  if (pf) return pf;

  const headers = { "content-type": "application/json", ...corsHeaders(ctx.request) };

  // Rate limit
  const convex = getConvexClient();

  // Parse body
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

  // Rate limit using existing token policy (10/5min) to prevent brute force
  let allowed: boolean;
  try {
    allowed = await convex.mutation(api.rateLimit.checkRateLimit, {
      userId: email,
      action: "token",
    });
  } catch {
    allowed = false;
  }
  if (!allowed) {
    return new Response(JSON.stringify({ error: "rate_limited" }), { status: 429, headers });
  }

  // Validate credentials
  const user = await convex.query(api.users.getByEmail, { email });

  if (!user || !user.passwordHash) {
    return new Response(JSON.stringify({ error: "invalid_credentials" }), { status: 401, headers });
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    return new Response(JSON.stringify({ error: "invalid_credentials" }), { status: 401, headers });
  }

  // Set session cookie
  const cookieHeader = makeSessionCookieHeader(ctx.request, user._id, user.email);

  return new Response(
    JSON.stringify({
      ok: true,
      email: user.email,
      displayName: user.name || user.fullName || user.email,
    }),
    {
      status: 200,
      headers: {
        ...headers,
        "Set-Cookie": cookieHeader,
      },
    },
  );
};

export const OPTIONS: APIRoute = async (ctx) => {
  const pf = preflight(ctx.request);
  if (pf) return pf;
  return new Response(null, { status: 204, headers: { ...corsHeaders(ctx.request) } });
};

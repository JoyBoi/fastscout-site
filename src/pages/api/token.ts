import type { APIRoute } from "astro";
import jwt from "jsonwebtoken";
import { findActiveSubscriptionByEmail, findActiveSubscriptionByCustomerId } from "../../lib/stripe";
import { getAuthenticatedUser } from "../../lib/auth";
import { corsHeaders, preflight } from "../../lib/cors";
import { getConvexClient } from "../../lib/convex";
import { api } from "../../../convex/_generated/api";

export const prerender = false;

export const POST: APIRoute = async (ctx) => {
  const pf = preflight(ctx.request);
  if (pf) return pf;
  const sessionUser = getAuthenticatedUser(ctx.request);
  if (!sessionUser) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { "content-type": "application/json", ...corsHeaders(ctx.request) } });
  const email = sessionUser.email;
  const userId = sessionUser.userId;

  const convex = getConvexClient();
  let allowed: boolean;
  try {
    allowed = await convex.mutation(api.rateLimit.checkRateLimit, { userId, action: "token" });
  } catch {
    allowed = false;
  }
  // Fail closed: deny on rate limit error (don't allow if mutation fails)
  if (!allowed) return new Response(JSON.stringify({ error: "rate_limited" }), { status: 429, headers: { "content-type": "application/json", ...corsHeaders(ctx.request) } });

  let customerId: string | undefined;
  const status = await convex.query(api.subscriptions.getByUserId, { userId });
  let active = !!status?.active;
  if (!active) {
    const billingCustomer = await convex.query(api.billingCustomers.getByUserId, { userId });
    customerId = billingCustomer?.stripeCustomerId;
    if (customerId) active = (await findActiveSubscriptionByCustomerId(customerId)).active;
    else active = (await findActiveSubscriptionByEmail(email)).active;
  }
  if (!active) return new Response(JSON.stringify({ error: "no_subscription" }), { status: 402, headers: { "content-type": "application/json", ...corsHeaders(ctx.request) } });

  const payload = {
    email,
    customerId,
    scope: ["bridge:access"],
  };
  const secret = import.meta.env.JWT_SECRET;
  if (!secret) return new Response(JSON.stringify({ error: "server_error" }), { status: 500, headers: { "content-type": "application/json", ...corsHeaders(ctx.request) } });
  const token = jwt.sign(payload, secret, { expiresIn: "1h" });
  return new Response(JSON.stringify({ token }), { status: 200, headers: { "content-type": "application/json", ...corsHeaders(ctx.request) } });
};

export const OPTIONS: APIRoute = async (ctx) => {
  return new Response(null, { status: 204, headers: corsHeaders(ctx.request) });
};

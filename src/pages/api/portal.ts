import type { APIRoute } from "astro";
import { getAuthenticatedUser } from "../../lib/auth";
import stripe from "../../lib/stripe";
import { corsHeaders, preflight } from "../../lib/cors";
import { getConvexClient } from "../../lib/convex";
import { api } from "../../../convex/_generated/api";

export const prerender = false;

export const POST: APIRoute = async (ctx) => {
  const pf = preflight(ctx.request);
  if (pf) return pf;
  const sessionUser = getAuthenticatedUser(ctx.request);
  if (!sessionUser) return new Response("Unauthorized", { status: 401, headers: { ...corsHeaders(ctx.request) } });
  const userId = sessionUser.userId;
  const email = sessionUser.email;

  const convex = getConvexClient();
  const siteUrl = import.meta.env.SITE_URL as string;
  let allowed: boolean;
  try {
    allowed = await convex.mutation(api.rateLimit.checkRateLimit, { userId, action: "portal" });
  } catch {
    allowed = false;
  }
  // Fail closed: deny on rate limit error (don't allow if mutation fails)
  if (!allowed) return new Response(null, { status: 302, headers: { Location: `${siteUrl}/dashboard?error=rate_limited`, ...corsHeaders(ctx.request) } as Record<string, string> });

  let customerId: string | undefined;
  const billingCustomer = await convex.query(api.billingCustomers.getByUserId, { userId });
  customerId = billingCustomer?.stripeCustomerId;
  if (!customerId) {
    const customers = await stripe.customers.list({ email, limit: 1 });
    customerId = customers.data[0]?.id;
    if (!customerId) return new Response("no_customer", { status: 404, headers: { ...corsHeaders(ctx.request) } });
  }
  const portal = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${siteUrl}/dashboard`,
  });
  return new Response(null, {
    status: 302,
    headers: { Location: portal.url ?? siteUrl, ...corsHeaders(ctx.request) } as Record<string, string>,
  });
};

export const OPTIONS: APIRoute = async (ctx) => {
  const pf = preflight(ctx.request);
  if (pf) return pf;
  return new Response(null, { status: 204, headers: { ...corsHeaders(ctx.request) } });
};

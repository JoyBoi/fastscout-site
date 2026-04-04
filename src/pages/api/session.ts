import type { APIRoute } from "astro";
import { getAuthenticatedUser } from "../../lib/auth";
import { findActiveSubscriptionByEmail, findActiveSubscriptionByCustomerId } from "../../lib/stripe";
import { corsHeaders, preflight } from "../../lib/cors";
import { getConvexClient } from "../../lib/convex";
import { api } from "../../../convex/_generated/api";

export const prerender = false;

export const POST: APIRoute = async (ctx) => {
  const pf = preflight(ctx.request);
  if (pf) return pf;
  const sessionUser = getAuthenticatedUser(ctx.request);
  if (!sessionUser) {
    return new Response(JSON.stringify({ authenticated: false, subscriptionActive: false, email: null, displayName: null }), {
      status: 200,
      headers: { "content-type": "application/json", ...corsHeaders(ctx.request) },
    });
  }
  const email = sessionUser.email;
  const userId = sessionUser.userId;

  // Fetch user name from Convex
  const convex = getConvexClient();
  let displayName: string | null = email;
  try {
    const user = await convex.query(api.users.getById, { userId });
    if (user?.name) displayName = user.name;
  } catch {}

  let subscriptionActive = false;
  let priceId: string | undefined;
  let periodEnd: string | undefined;

  // Fetch both from Convex in parallel - billing_customers is cheap and we may need it
  const [status, billingCustomer] = await Promise.all([
    convex.query(api.subscriptions.getByUserId, { userId }),
    convex.query(api.billingCustomers.getByUserId, { userId })
  ]);

  if (status) {
    subscriptionActive = !!status.active;
    priceId = status.priceId ?? undefined;
    periodEnd = status.currentPeriodEnd ?? undefined;
  }

  // Only call Stripe if DB says not active
  if (!subscriptionActive && email) {
    const customerId = billingCustomer?.stripeCustomerId as string | undefined;
    if (customerId) {
      const res = await findActiveSubscriptionByCustomerId(customerId);
      subscriptionActive = res.active;
      priceId = priceId ?? res.priceId;
      periodEnd = periodEnd ?? res.periodEnd;
    } else {
      const res = await findActiveSubscriptionByEmail(email);
      subscriptionActive = res.active;
      priceId = priceId ?? res.priceId;
      periodEnd = periodEnd ?? res.periodEnd;
    }
  }
  return new Response(JSON.stringify({ authenticated: true, subscriptionActive, priceId, periodEnd, email, displayName }), {
    status: 200,
    headers: { "content-type": "application/json", ...corsHeaders(ctx.request) },
  });
};

export const OPTIONS: APIRoute = async (ctx) => {
  const pf = preflight(ctx.request);
  if (pf) return pf;
  return new Response(null, { status: 204, headers: { ...corsHeaders(ctx.request) } });
};

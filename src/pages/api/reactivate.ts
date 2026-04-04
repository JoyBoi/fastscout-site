import type { APIRoute } from "astro";
import { getAuthenticatedUser } from "../../lib/auth";
import stripe from "../../lib/stripe";
import { getConvexClient } from "../../lib/convex";
import { api } from "../../../convex/_generated/api";

export const prerender = false;

export const POST: APIRoute = async (ctx) => {
  const sessionUser = getAuthenticatedUser(ctx.request);
  if (!sessionUser) return new Response("Unauthorized", { status: 401 });
  const userId = sessionUser.userId;

  const convex = getConvexClient();
  const siteUrl = import.meta.env.SITE_URL as string;
  let allowed: boolean;
  try {
    allowed = await convex.mutation(api.rateLimit.checkRateLimit, { userId, action: "reactivate" });
  } catch {
    allowed = false;
  }
  if (!allowed) return new Response(null, { status: 302, headers: { Location: `${siteUrl}/dashboard?error=rate_limited` } });

  const billing = await convex.query(api.billingCustomers.getByUserId, { userId });
  if (!billing?.stripeCustomerId) {
    return new Response(null, { status: 302, headers: { Location: `${siteUrl}/dashboard?error=no_active_subscription` } });
  }

  const subscriptions = await stripe.subscriptions.list({ customer: billing.stripeCustomerId, limit: 1 });
  const subscription = subscriptions.data[0];
  if (!subscription || !subscription.cancel_at_period_end) {
    return new Response(null, { status: 302, headers: { Location: `${siteUrl}/dashboard?error=no_active_subscription` } });
  }

  await stripe.subscriptions.update(subscription.id, { cancel_at_period_end: false });
  return new Response(null, { status: 302, headers: { Location: `${siteUrl}/dashboard` } });
};

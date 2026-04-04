import type { APIRoute } from "astro";
import { getAuthenticatedUser } from "../../lib/auth";
import stripe, { findActiveSubscriptionByEmail, findActiveSubscriptionByCustomerId } from "../../lib/stripe";
import { getConvexClient } from "../../lib/convex";
import { api } from "../../../convex/_generated/api";

export const prerender = false;

export const POST: APIRoute = async (ctx) => {
  const sessionUser = getAuthenticatedUser(ctx.request);
  if (!sessionUser) return new Response("Unauthorized", { status: 401 });
  const userId = sessionUser.userId;
  const email = sessionUser.email;

  const convex = getConvexClient();
  const siteUrl = import.meta.env.SITE_URL as string;
  let allowed: boolean;
  try {
    allowed = await convex.mutation(api.rateLimit.checkRateLimit, { userId, action: "cancel" });
  } catch {
    allowed = false;
  }
  if (!allowed) return new Response(null, { status: 302, headers: { Location: `${siteUrl}/dashboard?error=rate_limited` } });

  let atPeriodEnd = true;
  try {
    const form = await (ctx.request as Request).formData();
    const val = form.get("at_period_end");
    if (typeof val === "string") atPeriodEnd = val === "true";
  } catch {}

  const billing = await convex.query(api.billingCustomers.getByUserId, { userId });
  let sub;
  if (billing?.stripeCustomerId) {
    sub = await findActiveSubscriptionByCustomerId(billing.stripeCustomerId);
  } else {
    sub = await findActiveSubscriptionByEmail(email);
  }
  if (!sub.active || !sub.customerId) {
    return new Response(null, { status: 302, headers: { Location: `${siteUrl}/dashboard?error=no_active_subscription` } });
  }

  const subscriptions = await stripe.subscriptions.list({ customer: sub.customerId, status: "active", limit: 1 });
  const subscription = subscriptions.data[0];
  if (!subscription) {
    return new Response(null, { status: 302, headers: { Location: `${siteUrl}/dashboard?error=no_active_subscription` } });
  }

  if (atPeriodEnd) {
    await stripe.subscriptions.update(subscription.id, { cancel_at_period_end: true });
  } else {
    await stripe.subscriptions.cancel(subscription.id);
  }

  return new Response(null, { status: 302, headers: { Location: `${siteUrl}/dashboard` } });
};

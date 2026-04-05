import type { APIRoute } from "astro";
import { getAuthenticatedUser } from "../../lib/auth";
import stripe, { findActiveSubscriptionByEmail } from "../../lib/stripe";
import { preflight, corsHeaders } from "../../lib/cors";
import { getConvexClient } from "../../lib/convex";
import { api } from "../../../convex/_generated/api";

export const prerender = false;

export const POST: APIRoute = async (ctx) => {
  const pf = preflight(ctx.request);
  if (pf) return pf;
  const sessionUser = getAuthenticatedUser(ctx.request);
  if (!sessionUser) return new Response(null, { status: 302, headers: { Location: "/auth?mode=signup" } });
  const userId = sessionUser.userId;
  const email = sessionUser.email;

  const form = await ctx.request.formData();
  const plan = (form.get("plan") as string | null) ?? null;
  const monthly = import.meta.env.STRIPE_PRICE_ID_MONTHLY as string | undefined;
  const yearly = import.meta.env.STRIPE_PRICE_ID_YEARLY as string | undefined;
  const quarterly = import.meta.env.STRIPE_PRICE_ID_QUARTERLY as string | undefined;
  const halfyearly = import.meta.env.STRIPE_PRICE_ID_HALFYEARLY as string | undefined;
  const fallback = import.meta.env.STRIPE_PRICE_ID as string | undefined;
  let priceId: string | undefined;
  if (plan === "monthly") priceId = monthly ?? fallback;
  else if (plan === "annual") priceId = yearly ?? fallback;
  else if (plan === "quarterly") priceId = quarterly ?? fallback;
  else if (plan === "halfyearly") priceId = halfyearly ?? fallback;
  else priceId = fallback;

  const convex = getConvexClient();
  let allowed: boolean;
  try {
    allowed = await convex.mutation(api.rateLimit.checkRateLimit, { userId, action: "checkout" });
  } catch {
    allowed = false;
  }
  const siteUrl = import.meta.env.SITE_URL as string;
  // Fail closed: deny on rate limit error (don't allow if mutation fails)
  if (!allowed) {
    return new Response(null, { status: 302, headers: { Location: `${siteUrl}/pricing?error=rate_limited`, ...corsHeaders(ctx.request) } as Record<string, string> });
  }
  const existing = await findActiveSubscriptionByEmail(email);
  if (existing.active) {
    return new Response(null, { status: 302, headers: { Location: `${siteUrl}/pricing?error=already_subscribed`, ...corsHeaders(ctx.request) } as Record<string, string> });
  }
  if (!priceId) return new Response(null, { status: 302, headers: { Location: `${siteUrl}/pricing?error=missing_price_id`, ...corsHeaders(ctx.request) } as Record<string, string> });

  // Determine metered price for extra vehicle usage based on selected plan
  const isStarter = plan === "monthly" || plan === "annual" || !plan;
  const meteredPriceId = isStarter
    ? (import.meta.env.STRIPE_METERED_PRICE_ID_STARTER as string | undefined)
    : (import.meta.env.STRIPE_METERED_PRICE_ID_PRO as string | undefined);

  const lineItems: Array<{ price: string; quantity?: number }> = [
    { price: priceId, quantity: 1 },
  ];
  if (meteredPriceId) {
    lineItems.push({ price: meteredPriceId });
  }

  try {
    const sessionStripe = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer_email: email,
      line_items: lineItems,
      success_url: `${siteUrl}/dashboard`,
      cancel_url: `${siteUrl}/pricing`,
      metadata: { userId },
      subscription_data: { metadata: { userId } },
    });
    return new Response(null, { status: 302, headers: { Location: sessionStripe.url ?? siteUrl, ...corsHeaders(ctx.request) } as Record<string, string> });
  } catch {
    return new Response(null, { status: 302, headers: { Location: `${siteUrl}/pricing?error=checkout_failed`, ...corsHeaders(ctx.request) } as Record<string, string> });
  }
};

export const GET: APIRoute = async (ctx) => {
  const pf = preflight(ctx.request);
  if (pf) return pf;
  const sessionUser = getAuthenticatedUser(ctx.request);
  const siteUrl = import.meta.env.SITE_URL as string;
  if (!sessionUser) return new Response(null, { status: 302, headers: { Location: "/auth?mode=signup" } });
  return new Response(null, { status: 302, headers: { Location: `${siteUrl}/pricing`, ...corsHeaders(ctx.request) } as Record<string, string> });
};

export const OPTIONS: APIRoute = async (ctx) => {
  const pf = preflight(ctx.request);
  if (pf) return pf;
  return new Response(null, { status: 204, headers: { ...corsHeaders(ctx.request) } });
};

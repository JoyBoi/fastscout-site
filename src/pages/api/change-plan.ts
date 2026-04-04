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
    allowed = await convex.mutation(api.rateLimit.checkRateLimit, { userId, action: "change_plan" });
  } catch {
    allowed = false;
  }
  // Fail closed: deny on rate limit error (don't allow if mutation fails)
  if (!allowed) {
    return new Response(null, { status: 302, headers: { Location: `${siteUrl}/pricing?error=rate_limited`, ...corsHeaders(ctx.request) } as Record<string, string> });
  }
  let body: Record<string, string> = {};
  try {
    const form = await (ctx.request as Request).formData();
    const plan = form.get("plan");
    const priceId = form.get("price_id");
    if (typeof plan === "string") body.plan = plan;
    if (typeof priceId === "string") body.price_id = priceId;
  } catch {}
  const monthly = import.meta.env.STRIPE_PRICE_ID_MONTHLY as string | undefined;
  const yearly = import.meta.env.STRIPE_PRICE_ID_YEARLY as string | undefined;
  const fallback = import.meta.env.STRIPE_PRICE_ID as string | undefined;
  let targetPriceId: string | undefined;
  if (typeof body.price_id === "string" && body.price_id.length > 0) targetPriceId = body.price_id;
  else if (body.plan === "monthly") targetPriceId = monthly ?? fallback;
  else if (body.plan === "annual") targetPriceId = yearly ?? fallback;
  else targetPriceId = fallback;
  if (!targetPriceId) {
    return new Response(null, { status: 302, headers: { Location: `${siteUrl}/pricing?error=missing_price_id`, ...corsHeaders(ctx.request) } as Record<string, string> });
  }
  if (!email || !userId) {
    return new Response("Unauthorized", { status: 401, headers: { ...corsHeaders(ctx.request) } });
  }
  let customerId: string | undefined;
  const billingCustomer = await convex.query(api.billingCustomers.getByUserId, { userId });
  customerId = billingCustomer?.stripeCustomerId as string | undefined;
  if (!customerId) {
    const customers = await stripe.customers.list({ email, limit: 1 });
    customerId = customers.data[0]?.id;
  }
  if (!customerId) {
    const created = await stripe.customers.create({ email });
    customerId = created.id;
  }

  // Fetch subscriptions and schedules in parallel
  const [subsResult, schedulesResult] = await Promise.all([
    stripe.subscriptions.list({ customer: customerId, status: "active", limit: 1 }),
    stripe.subscriptionSchedules.list({ customer: customerId, limit: 20 })
  ]);

  const sub = subsResult.data[0];
  if (!sub) {
    return new Response(null, { status: 302, headers: { Location: `${siteUrl}/pricing?error=no_active_subscription`, ...corsHeaders(ctx.request) } as Record<string, string> });
  }
  const currentPrice = sub.items.data[0]?.price?.id;
  if (currentPrice === targetPriceId) {
    return new Response(null, { status: 302, headers: { Location: `${siteUrl}/dashboard?success=plan_unchanged`, ...corsHeaders(ctx.request) } as Record<string, string> });
  }
  const currentPeriodEnd = sub.current_period_end;
  let schedule = schedulesResult.data.find((s) => s.subscription === sub.id);
  if (!schedule) {
    schedule = await stripe.subscriptionSchedules.create({
      from_subscription: sub.id,
      end_behavior: "release",
    });
  }
  const phases = schedule.phases;
  const start = phases[0]?.start_date ?? sub.current_period_start;
  await stripe.subscriptionSchedules.update(schedule.id, {
    end_behavior: "release",
    phases: [
      {
        items: sub.items.data.map((item) => ({ price: item.price.id, quantity: item.quantity ?? 1 })),
        start_date: start,
        end_date: currentPeriodEnd,
      },
      {
        items: [{ price: targetPriceId, quantity: 1 }],
        start_date: currentPeriodEnd,
        proration_behavior: "none",
      },
    ],
  });
  return new Response(null, { status: 302, headers: { Location: `${siteUrl}/dashboard?success=plan_change_scheduled`, ...corsHeaders(ctx.request) } as Record<string, string> });
};

export const OPTIONS: APIRoute = async (ctx) => {
  const pf = preflight(ctx.request);
  if (pf) return pf;
  return new Response(null, { status: 204, headers: { ...corsHeaders(ctx.request) } });
};

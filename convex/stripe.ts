"use node";
import { action, httpAction, internalAction } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import Stripe from "stripe";
import { api, internal } from "./_generated/api";
import { rateLimiter } from "./_ratelimiter";

function getStripe(): Stripe {
  return new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2024-04-10" });
}

async function getActiveOrTrialingSub(stripe: Stripe, customerId: string): Promise<Stripe.Subscription | null> {
  const active = await stripe.subscriptions.list({ customer: customerId, status: "active", limit: 1 });
  if (active.data[0]) return active.data[0];
  const trialing = await stripe.subscriptions.list({ customer: customerId, status: "trialing", limit: 1 });
  return trialing.data[0] ?? null;
}

async function ensureStripeCustomer(
  ctx: { runQuery: Function; runMutation: Function },
  userId: string,
  email: string,
): Promise<string> {
  const billing = (await ctx.runQuery(api.subscriptions.getBillingCustomer)) as { stripeCustomerId: string } | null;
  if (billing?.stripeCustomerId) return billing.stripeCustomerId;
  const stripe = getStripe();
  const customer = await stripe.customers.create({ email });
  await ctx.runMutation(internal.subscriptions.upsertBillingCustomer, {
    userId: userId as any,
    stripeCustomerId: customer.id,
  });
  return customer.id;
}

/** Pure helper — exported for unit tests */
export function resolvePriceId(
  interval: string | undefined,
  explicitPriceId: string | undefined,
  prices: Record<string, string | undefined>,
): string | undefined {
  if (explicitPriceId) return explicitPriceId;
  if (!interval) return prices["monthly"] ?? prices["default"];
  return prices[interval] ?? prices["default"];
}

function priceIntervalSeconds(interval: string, count: number): number {
  if (interval === "year") return count * 365 * 24 * 3600;
  if (interval === "week") return count * 7 * 24 * 3600;
  return count * 30 * 24 * 3600; // month (and fallback)
}

export const createCheckout = action({
  args: { priceId: v.string() },
  handler: async (ctx, { priceId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("unauthorized");
    await rateLimiter.limit(ctx, "checkout", { key: userId, throws: true });
    const user = (await ctx.runQuery(api.users.getViewer)) as { email?: string } | null;
    if (!user?.email) throw new Error("no_email");
    const stripe = getStripe();
    const customerId = await ensureStripeCustomer(ctx, userId, user.email);

    const activeSubs = await stripe.subscriptions.list({ customer: customerId, status: "active", limit: 1 });
    const trialSubs = activeSubs.data.length === 0
      ? await stripe.subscriptions.list({ customer: customerId, status: "trialing", limit: 1 })
      : { data: [] };
    const activeSub = activeSubs.data[0] ?? trialSubs.data[0] ?? null;

    if (!activeSub) {
      // No existing subscription — create a fresh one
      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        customer: customerId,
        client_reference_id: userId,
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: `${process.env.SITE_URL}/dashboard`,
        cancel_url: `${process.env.SITE_URL}/pricing`,
      });
      return { url: session.url };
    }

    // Active subscription exists — charge for an extension / plan switch.
    // The webhook will push trial_end forward (no second concurrent subscription).
    const price = await stripe.prices.retrieve(priceId);
    const intervalSecs = priceIntervalSeconds(
      price.recurring?.interval ?? "month",
      price.recurring?.interval_count ?? 1,
    );
    const productId = typeof price.product === "string" ? price.product : (price.product as any).id;

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer: customerId,
      client_reference_id: userId,
      line_items: [{
        price_data: {
          currency: price.currency,
          unit_amount: price.unit_amount!,
          product: productId,
        },
        quantity: 1,
      }],
      metadata: {
        type: "extension",
        userId,
        subscriptionId: activeSub.id,
        newPriceId: priceId,
        currentPeriodEnd: String(activeSub.current_period_end),
        intervalSecs: String(intervalSecs),
      },
      success_url: `${process.env.SITE_URL}/dashboard`,
      cancel_url: `${process.env.SITE_URL}/pricing`,
    });
    return { url: session.url };
  },
});

export const changePlan = action({
  args: { targetPriceId: v.string() },
  handler: async (ctx, { targetPriceId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("unauthorized");
    await rateLimiter.limit(ctx, "change_plan", { key: userId, throws: true });
    const billing = (await ctx.runQuery(api.subscriptions.getBillingCustomer)) as { stripeCustomerId: string } | null;
    if (!billing?.stripeCustomerId) throw new Error("no_customer");
    const stripe = getStripe();
    const sub = await getActiveOrTrialingSub(stripe, billing.stripeCustomerId);
    if (!sub) throw new Error("no_active_subscription");
    const currentPrice = sub.items.data[0]?.price?.id;
    if (currentPrice === targetPriceId) return { status: "unchanged" };
    let schedule = (await stripe.subscriptionSchedules.list({ customer: billing.stripeCustomerId, limit: 20 })).data.find((s) => s.subscription === sub.id);
    if (!schedule) {
      schedule = await stripe.subscriptionSchedules.create({ from_subscription: sub.id, end_behavior: "release" });
    }
    await stripe.subscriptionSchedules.update(schedule.id, {
      end_behavior: "release",
      phases: [
        {
          items: sub.items.data.map((i) => ({ price: i.price.id, quantity: i.quantity ?? 1 })),
          start_date: schedule.phases[0].start_date,
          end_date: sub.current_period_end,
        },
        {
          items: [{ price: targetPriceId, quantity: 1 }],
          start_date: sub.current_period_end,
          proration_behavior: "none",
        },
      ],
    });
    return { status: "scheduled", switchAt: sub.current_period_end };
  },
});

export const cancel = action({
  args: { atPeriodEnd: v.boolean() },
  handler: async (ctx, { atPeriodEnd }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("unauthorized");
    await rateLimiter.limit(ctx, "cancel", { key: userId, throws: true });
    const billing = (await ctx.runQuery(api.subscriptions.getBillingCustomer)) as { stripeCustomerId: string } | null;
    if (!billing?.stripeCustomerId) throw new Error("no_customer");
    const stripe = getStripe();
    const sub = await getActiveOrTrialingSub(stripe, billing.stripeCustomerId);
    if (!sub) throw new Error("no_active_subscription");
    if (atPeriodEnd) {
      await stripe.subscriptions.update(sub.id, { cancel_at_period_end: true });
    } else {
      await stripe.subscriptions.cancel(sub.id);
    }
    return { status: "ok" };
  },
});

export const cancelQueued = action({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("unauthorized");
    await rateLimiter.limit(ctx, "cancel_queued", { key: userId, throws: true });
    const billing = (await ctx.runQuery(api.subscriptions.getBillingCustomer)) as { stripeCustomerId: string } | null;
    if (!billing?.stripeCustomerId) throw new Error("no_customer");
    const stripe = getStripe();
    const sub = await getActiveOrTrialingSub(stripe, billing.stripeCustomerId);
    if (!sub) throw new Error("no_active_subscription");
    const schedules = await stripe.subscriptionSchedules.list({ customer: billing.stripeCustomerId, limit: 20 });
    const schedule = schedules.data.find((s) => s.subscription === sub.id);
    if (!schedule) return { status: "no_schedule" };
    await stripe.subscriptionSchedules.release(schedule.id);
    return { status: "released" };
  },
});

export const reactivate = action({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("unauthorized");
    await rateLimiter.limit(ctx, "reactivate", { key: userId, throws: true });
    const billing = (await ctx.runQuery(api.subscriptions.getBillingCustomer)) as { stripeCustomerId: string } | null;
    if (!billing?.stripeCustomerId) throw new Error("no_customer");
    const stripe = getStripe();
    const sub = await getActiveOrTrialingSub(stripe, billing.stripeCustomerId);
    if (!sub?.cancel_at_period_end) return { status: "not_pending_cancel" };
    await stripe.subscriptions.update(sub.id, { cancel_at_period_end: false });
    return { status: "reactivated" };
  },
});

export const createPortal = action({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("unauthorized");
    await rateLimiter.limit(ctx, "portal", { key: userId, throws: true });
    const billing = (await ctx.runQuery(api.subscriptions.getBillingCustomer)) as { stripeCustomerId: string } | null;
    if (!billing?.stripeCustomerId) throw new Error("no_customer");
    const stripe = getStripe();
    const portal = await stripe.billingPortal.sessions.create({
      customer: billing.stripeCustomerId,
      return_url: `${process.env.SITE_URL}/dashboard`,
    });
    return { url: portal.url };
  },
});

export const getInvoices = action({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("unauthorized");
    await rateLimiter.limit(ctx, "invoices", { key: userId, throws: true });
    const billing = (await ctx.runQuery(api.subscriptions.getBillingCustomer)) as { stripeCustomerId: string } | null;
    if (!billing?.stripeCustomerId) return { invoices: [] };
    const stripe = getStripe();
    const list = await stripe.invoices.list({ customer: billing.stripeCustomerId, limit: 20 });
    return {
      invoices: list.data.map((inv) => ({
        id: inv.id,
        status: inv.status,
        amount_due: inv.amount_due,
        currency: inv.currency,
        hosted_invoice_url: inv.hosted_invoice_url,
        invoice_pdf: inv.invoice_pdf,
        created: inv.created,
      })),
    };
  },
});

/** Called from http.ts via runAction to keep the Stripe SDK out of the V8 HTTP router. */
export const handleWebhookRequest = internalAction({
  args: { signature: v.string(), body: v.string() },
  handler: async (ctx, { signature, body }) => {
    const stripe = getStripe();
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET!);
    } catch {
      return { status: 400, text: "bad_signature" };
    }
    await ctx.runAction(internal.stripe.processWebhookEvent, {
      eventType: event.type,
      eventData: JSON.stringify(event.data.object),
    });
    return { status: 200, text: "ok" };
  },
});

export const processWebhookEvent = internalAction({
  args: { eventType: v.string(), eventData: v.string() },
  handler: async (ctx, { eventType, eventData }) => {
    const obj = JSON.parse(eventData) as Record<string, any>;

    if (eventType === "checkout.session.completed") {
      const meta = (obj.metadata ?? {}) as Record<string, string>;

      // Extension / plan-switch: push trial_end forward, change price if needed
      if (meta.type === "extension") {
        const { subscriptionId, newPriceId, currentPeriodEnd, intervalSecs, userId } = meta;
        if (!subscriptionId || !newPriceId || !userId) return;
        const stripe = getStripe();
        const sub = await stripe.subscriptions.retrieve(subscriptionId);
        const currentItemId = sub.items.data[0]?.id;
        const currentPriceId = sub.items.data[0]?.price?.id;
        const newTrialEnd = parseInt(currentPeriodEnd, 10) + parseInt(intervalSecs, 10);

        const updateParams: Stripe.SubscriptionUpdateParams = {
          trial_end: newTrialEnd,
          proration_behavior: "none",
          cancel_at_period_end: false,
        };
        if (currentPriceId !== newPriceId && currentItemId) {
          updateParams.items = [{ id: currentItemId, price: newPriceId }];
        }
        await stripe.subscriptions.update(subscriptionId, updateParams);

        // Optimistically update Convex — the subscription.updated webhook will also fire
        await ctx.runMutation(internal.subscriptions.upsertFromWebhook, {
          userId: userId as any,
          stripeSubscriptionId: subscriptionId,
          status: "trialing",
          priceId: newPriceId,
          periodEnd: newTrialEnd,
          cancelAtPeriodEnd: false,
        });
        return;
      }

      // New subscription checkout
      const userId = obj.client_reference_id as string | undefined;
      const customerId = obj.customer as string | undefined;
      const subId = obj.subscription as string | undefined;
      if (!userId || !customerId) return;
      await ctx.runMutation(internal.subscriptions.upsertBillingCustomer, {
        userId: userId as any,
        stripeCustomerId: customerId,
      });
      if (subId) {
        const stripe = getStripe();
        const s = await stripe.subscriptions.retrieve(subId);
        await ctx.runMutation(internal.subscriptions.upsertFromWebhook, {
          userId: userId as any,
          stripeSubscriptionId: s.id,
          status: s.status,
          priceId: s.items.data[0]?.price?.id,
          periodEnd: s.current_period_end,
          cancelAtPeriodEnd: s.cancel_at_period_end,
        });
      }
      return;
    }

    if (
      eventType === "customer.subscription.created" ||
      eventType === "customer.subscription.updated" ||
      eventType === "customer.subscription.deleted"
    ) {
      const customerId = obj.customer as string;
      const billing = (await ctx.runQuery(internal.subscriptions.getByStripeCustomerId, {
        stripeCustomerId: customerId,
      })) as { userId: string } | null;
      if (!billing?.userId) return;
      await ctx.runMutation(internal.subscriptions.upsertFromWebhook, {
        userId: billing.userId as any,
        stripeSubscriptionId: obj.id,
        status: obj.status,
        priceId: obj.items?.data?.[0]?.price?.id,
        periodEnd: obj.current_period_end,
        cancelAtPeriodEnd: obj.cancel_at_period_end ?? false,
      });
    }
  },
});

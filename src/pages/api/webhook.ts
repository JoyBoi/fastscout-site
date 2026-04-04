import type { APIRoute } from "astro";
import stripe from "../../lib/stripe";
import { getConvexClient } from "../../lib/convex";
import { api } from "../../../convex/_generated/api";
import type Stripe from "stripe";

export const prerender = false;

async function resolveUserId(
  convex: ReturnType<typeof getConvexClient>,
  stripeCustomerId: string,
  metadata?: Stripe.Metadata | null
): Promise<string | null> {
  if (metadata?.userId) return metadata.userId;
  const record = await convex.query(
    api.billingCustomers.getByStripeCustomerId,
    { stripeCustomerId }
  );
  return record?.userId ?? null;
}

export const POST: APIRoute = async (ctx) => {
  const sig = ctx.request.headers.get("stripe-signature");
  if (!sig) return new Response("Missing signature", { status: 400 });

  const body = await ctx.request.text();
  const secret = import.meta.env.STRIPE_WEBHOOK_SECRET;

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, sig, secret);
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return new Response("Webhook signature verification failed", { status: 400 });
  }

  const convex = getConvexClient();
  console.log(`Webhook received: ${event.type} (${event.id})`);

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode !== "subscription") break;
        const customerId = typeof session.customer === "string"
          ? session.customer
          : session.customer?.id;
        if (!customerId) break;
        const userId = await resolveUserId(convex, customerId, session.metadata);
        if (!userId) {
          console.error(`checkout.session.completed: could not resolve userId for customer ${customerId}`);
          return new Response("Could not resolve userId", { status: 500 });
        }

        await convex.mutation(api.billingCustomers.upsert, {
          userId,
          stripeCustomerId: customerId,
        });
        console.log(`Mapped userId=${userId} to customer=${customerId}`);

        const subscriptionId = typeof session.subscription === "string"
          ? session.subscription
          : session.subscription?.id;
        if (subscriptionId) {
          const sub = await stripe.subscriptions.retrieve(subscriptionId);
          await convex.mutation(api.subscriptions.upsert, {
            userId,
            active: sub.status === "active" || sub.status === "trialing",
            priceId: sub.items.data[0]?.price?.id,
            currentPeriodEnd: new Date(sub.current_period_end * 1000).toISOString(),
          });
          console.log(`Subscription synced: userId=${userId} active=${sub.status === "active" || sub.status === "trialing"}`);
        }
        break;
      }

      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        const customerId = typeof sub.customer === "string"
          ? sub.customer
          : sub.customer.id;
        const userId = await resolveUserId(convex, customerId, sub.metadata);
        if (!userId) {
          console.warn(`subscription.updated: could not resolve userId for customer ${customerId}, skipping`);
          break;
        }
        const active = sub.status === "active" || sub.status === "trialing";
        await convex.mutation(api.subscriptions.upsert, {
          userId,
          active,
          priceId: sub.items.data[0]?.price?.id,
          currentPeriodEnd: new Date(sub.current_period_end * 1000).toISOString(),
        });
        console.log(`Subscription updated: userId=${userId} active=${active} price=${sub.items.data[0]?.price?.id}`);
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const customerId = typeof sub.customer === "string"
          ? sub.customer
          : sub.customer.id;
        const userId = await resolveUserId(convex, customerId, sub.metadata);
        if (!userId) {
          console.warn(`subscription.deleted: could not resolve userId for customer ${customerId}, skipping`);
          break;
        }
        await convex.mutation(api.subscriptions.upsert, {
          userId,
          active: false,
          priceId: undefined,
          currentPeriodEnd: undefined,
        });
        console.log(`Subscription deleted: userId=${userId}`);
        break;
      }

      case "invoice.payment_failed": {
        // Don't deactivate here — Stripe retries payments during dunning.
        // The subscription will be deleted if all retries fail,
        // which is handled by customer.subscription.deleted above.
        const invoice = event.data.object as Stripe.Invoice;
        console.warn(`Payment failed for customer ${invoice.customer}, letting dunning handle it`);
        break;
      }
    }
  } catch (err) {
    console.error(`Webhook handler error for ${event.type}:`, err);
    return new Response("Webhook handler failed", { status: 500 });
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
};

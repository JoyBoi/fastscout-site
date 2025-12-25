import Stripe from "stripe";

const stripe = new Stripe(import.meta.env.STRIPE_SECRET_KEY as string, {
  apiVersion: "2024-04-10",
});

export default stripe;

export async function findActiveSubscriptionByEmail(email: string) {
  const customers = await stripe.customers.list({ email, limit: 1 });
  const customer = customers.data[0];
  if (!customer) return { active: false };

  const subs = await stripe.subscriptions.list({ customer: customer.id, status: "active", limit: 1 });
  const sub = subs.data[0];
  const active = !!sub;
  return {
    active,
    customerId: customer.id,
    priceId: sub?.items?.data?.[0]?.price?.id,
    periodEnd: sub ? new Date(sub.current_period_end * 1000).toISOString() : undefined,
  };
}

export async function findActiveSubscriptionByCustomerId(customerId: string) {
  const subs = await stripe.subscriptions.list({ customer: customerId, status: "active", limit: 1 });
  const sub = subs.data[0];
  const active = !!sub;
  return {
    active,
    customerId,
    priceId: sub?.items?.data?.[0]?.price?.id,
    periodEnd: sub ? new Date(sub.current_period_end * 1000).toISOString() : undefined,
  };
}

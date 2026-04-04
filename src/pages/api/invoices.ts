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
  if (!sessionUser) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { "content-type": "application/json", ...corsHeaders(ctx.request) } });
  const userId = sessionUser.userId;
  const email = sessionUser.email;

  const convex = getConvexClient();
  const billing = await convex.query(api.billingCustomers.getByUserId, { userId });
  let customerId = billing?.stripeCustomerId as string | undefined;
  if (!customerId) {
    const customers = await stripe.customers.list({ email, limit: 1 });
    customerId = customers.data[0]?.id;
  }
  if (!customerId) {
    return new Response(JSON.stringify({ error: "no_customer" }), { status: 404, headers: { "content-type": "application/json", ...corsHeaders(ctx.request) } });
  }

  const invoices = await stripe.invoices.list({ customer: customerId, limit: 20 });
  return new Response(JSON.stringify(invoices.data), { status: 200, headers: { "content-type": "application/json", ...corsHeaders(ctx.request) } });
};

export const OPTIONS: APIRoute = async (ctx) => {
  const pf = preflight(ctx.request);
  if (pf) return pf;
  return new Response(null, { status: 204, headers: { ...corsHeaders(ctx.request) } });
};

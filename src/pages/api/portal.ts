import type { APIRoute } from "astro";
import { getSupabaseServerClient } from "../../lib/supabase";
import stripe, { findActiveSubscriptionByEmail } from "../../lib/stripe";
import { corsHeaders, preflight } from "../../lib/cors";
import { getConvexClient } from "../../lib/convex";
import { api } from "../../../convex/_generated/api";

export const prerender = false;

export const POST: APIRoute = async (ctx) => {
  const pf = preflight(ctx.request);
  if (pf) return pf;
  const supabase = getSupabaseServerClient(ctx as any);
  const { data: { session } } = await supabase.auth.getSession();
  const accessToken = session?.access_token;
  if (!accessToken) return new Response("Unauthorized", { status: 401, headers: { ...corsHeaders(ctx.request) } });

  const convex = getConvexClient();
  const siteUrl = import.meta.env.SITE_URL as string;
  let allowed: boolean;
  try {
    allowed = session.user?.id ? await convex.mutation(api.rateLimit.checkRateLimit, { userId: session.user.id, action: "portal", maxCount: 5, windowSeconds: 60 }) : false;
  } catch {
    allowed = false;
  }
  // Fail closed: deny on rate limit error (don't allow if mutation fails)
  if (!allowed) return new Response(null, { status: 302, headers: { Location: `${siteUrl}/dashboard?error=rate_limited`, ...corsHeaders(ctx.request) } as Record<string, string> });

  const base = import.meta.env.STRIPE_WRAPPER_BASE_URL as string;

  if (base && /^https?:\/\/.*/.test(base)) {
    const res = await fetch(`${base}/create-portal-session`, {
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (res.ok) {
      const json = await res.json() as { url?: string };
      return new Response(null, { status: 302, headers: { Location: json.url ?? siteUrl, ...corsHeaders(ctx.request) } as Record<string, string> });
    }
  }

  const { data } = await supabase.auth.getUser();
  const email = data.user?.email;
  const userId = data.user?.id;
  if (!email || !userId) return new Response("Unauthorized", { status: 401, headers: { ...corsHeaders(ctx.request) } });

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

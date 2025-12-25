import type { APIRoute } from "astro";
import { getSupabaseServerClient } from "../../lib/supabase";
import { findActiveSubscriptionByEmail, findActiveSubscriptionByCustomerId } from "../../lib/stripe";
import { corsHeaders, preflight } from "../../lib/cors";

export const GET: APIRoute = async (ctx) => {
  const pf = preflight(ctx.request);
  if (pf) return pf;
  const supabase = getSupabaseServerClient(ctx as any);
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user) {
    return new Response(JSON.stringify({ authenticated: false, subscriptionActive: false }), {
      status: 200,
      headers: { "content-type": "application/json", ...corsHeaders(ctx.request) },
    });
  }
  const email = user.email as string | undefined;
  const userId = user.id as string;
  let subscriptionActive = false;
  let priceId: string | undefined;
  let periodEnd: string | undefined;
  const { data: status } = await supabase
    .from("subscription_status")
    .select("active, price_id, current_period_end")
    .eq("user_id", userId)
    .maybeSingle();
  if (status) {
    subscriptionActive = !!status.active;
    priceId = status.price_id ?? undefined;
    periodEnd = status.current_period_end ?? undefined;
  }
  if (!subscriptionActive && email) {
    const { data: map } = await supabase
      .from("billing_customers")
      .select("stripe_customer_id")
      .eq("user_id", userId)
      .maybeSingle();
    const customerId = map?.stripe_customer_id as string | undefined;
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
  return new Response(JSON.stringify({ authenticated: true, subscriptionActive, priceId, periodEnd }), {
    status: 200,
    headers: { "content-type": "application/json", ...corsHeaders(ctx.request) },
  });
};

export const OPTIONS: APIRoute = async (ctx) => {
  const pf = preflight(ctx.request);
  if (pf) return pf;
  return new Response(null, { status: 204, headers: { ...corsHeaders(ctx.request) } });
};


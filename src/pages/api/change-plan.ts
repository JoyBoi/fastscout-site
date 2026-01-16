import type { APIRoute } from "astro";
import { getSupabaseServerClient } from "../../lib/supabase";
import stripe from "../../lib/stripe";
import { corsHeaders, preflight } from "../../lib/cors";

export const POST: APIRoute = async (ctx) => {
  const pf = preflight(ctx.request);
  if (pf) return pf;
  const supabase = getSupabaseServerClient(ctx as any);
  const { data: { session } } = await supabase.auth.getSession();
  const accessToken = session?.access_token;
  if (!accessToken) return new Response("Unauthorized", { status: 401, headers: { ...corsHeaders(ctx.request) } });
  const { data: allowed, error: rlError } = await supabase.rpc("check_rate_limit", {
    action: "change_plan",
    max_count: 5,
    window_seconds: 300,
  });
  const siteUrl = import.meta.env.SITE_URL as string;
  const proceed = rlError ? true : !!allowed;
  if (!proceed) {
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
  const base = import.meta.env.STRIPE_WRAPPER_BASE_URL as string;
  const hasWrapper = !!base && /^https?:\/\/.*/.test(base);
  if (hasWrapper) {
    const res = await fetch(`${base}/change-plan`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const txt = await res.text();
      if (txt.includes("missing_price_id")) {
        return new Response(null, { status: 302, headers: { Location: `${siteUrl}/pricing?error=missing_price_id`, ...corsHeaders(ctx.request) } as Record<string, string> });
      }
      return new Response(null, { status: 302, headers: { Location: `${siteUrl}/pricing?error=change_plan_failed`, ...corsHeaders(ctx.request) } as Record<string, string> });
    }
    return new Response(null, { status: 302, headers: { Location: `${siteUrl}/dashboard?success=plan_change_scheduled`, ...corsHeaders(ctx.request) } as Record<string, string> });
  }
  const monthly = import.meta.env.STRIPE_PRICE_ID_MONTHLY as string | undefined;
  const yearly = import.meta.env.STRIPE_PRICE_ID_YEARLY as string | undefined;
  const quarterly = import.meta.env.STRIPE_PRICE_ID_QUARTERLY as string | undefined;
  const halfyearly = import.meta.env.STRIPE_PRICE_ID_HALFYEARLY as string | undefined;
  const fallback = import.meta.env.STRIPE_PRICE_ID as string | undefined;
  let targetPriceId: string | undefined;
  if (typeof body.price_id === "string" && body.price_id.length > 0) targetPriceId = body.price_id;
  else if (body.plan === "monthly") targetPriceId = monthly ?? fallback;
  else if (body.plan === "annual") targetPriceId = yearly ?? fallback;
  else if (body.plan === "quarterly") targetPriceId = quarterly ?? fallback;
  else if (body.plan === "halfyearly") targetPriceId = halfyearly ?? fallback;
  else targetPriceId = fallback;
  if (!targetPriceId) {
    return new Response(null, { status: 302, headers: { Location: `${siteUrl}/pricing?error=missing_price_id`, ...corsHeaders(ctx.request) } as Record<string, string> });
  }
  const { data: userData } = await supabase.auth.getUser();
  const email = userData.user?.email;
  const userId = userData.user?.id;
  if (!email || !userId) {
    return new Response("Unauthorized", { status: 401, headers: { ...corsHeaders(ctx.request) } });
  }
  let customerId: string | undefined;
  const { data: map } = await supabase
    .from("billing_customers")
    .select("stripe_customer_id")
    .eq("user_id", userId)
    .maybeSingle();
  customerId = map?.stripe_customer_id as string | undefined;
  if (!customerId) {
    const customers = await stripe.customers.list({ email, limit: 1 });
    customerId = customers.data[0]?.id;
  }
  if (!customerId) {
    const created = await stripe.customers.create({ email });
    customerId = created.id;
  }
  const subs = await stripe.subscriptions.list({ customer: customerId, status: "active", limit: 1 });
  const sub = subs.data[0];
  if (!sub) {
    return new Response(null, { status: 302, headers: { Location: `${siteUrl}/pricing?error=no_active_subscription`, ...corsHeaders(ctx.request) } as Record<string, string> });
  }
  const currentPrice = sub.items.data[0]?.price?.id;
  if (currentPrice === targetPriceId) {
    return new Response(null, { status: 302, headers: { Location: `${siteUrl}/dashboard?success=plan_unchanged`, ...corsHeaders(ctx.request) } as Record<string, string> });
  }
  const currentPeriodEnd = sub.current_period_end;
  const schedulesPage = await stripe.subscriptionSchedules.list({ customer: customerId, limit: 20 });
  let schedule = schedulesPage.data.find((s) => s.subscription === sub.id);
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

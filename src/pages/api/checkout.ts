import type { APIRoute } from "astro";
import { getSupabaseServerClient } from "../../lib/supabase";
import stripe, { findActiveSubscriptionByEmail } from "../../lib/stripe";
import { preflight, corsHeaders } from "../../lib/cors";

export const POST: APIRoute = async (ctx) => {
  const pf = preflight(ctx.request);
  if (pf) return pf;
  const supabase = getSupabaseServerClient(ctx as any);
  const { data: { session } } = await supabase.auth.getSession();
  const accessToken = session?.access_token;
  if (!accessToken) return new Response(null, { status: 302, headers: { Location: "/auth?mode=signup" } });

  const form = await ctx.request.formData();
  const plan = (form.get("plan") as string | null) ?? null;
  const monthly = import.meta.env.STRIPE_PRICE_ID_MONTHLY as string | undefined;
  const yearly = import.meta.env.STRIPE_PRICE_ID_YEARLY as string | undefined;
  const fallback = import.meta.env.STRIPE_PRICE_ID as string | undefined;
  let priceId: string | undefined;
  if (plan === "monthly") priceId = monthly ?? fallback;
  else if (plan === "annual") priceId = yearly ?? fallback;
  else priceId = fallback;

  const { data: allowed, error: rlError } = await supabase.rpc("check_rate_limit", {
    action: "checkout",
    max_count: 3,
    window_seconds: 60,
  });
  const siteUrl = import.meta.env.SITE_URL as string;
  // Fail closed: deny on rate limit error (don't allow if RPC fails)
  if (rlError || !allowed) {
    return new Response(null, { status: 302, headers: { Location: `${siteUrl}/pricing?error=rate_limited`, ...corsHeaders(ctx.request) } as Record<string, string> });
  }
  const base = import.meta.env.STRIPE_WRAPPER_BASE_URL as string;
  if (base && /^https?:\/\/.*/.test(base)) {
    const res = await fetch(`${base}/create-checkout-session`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "content-type": "application/json" },
      body: JSON.stringify(priceId ? { price_id: priceId } : {}),
    });
    if (res.ok) {
      const json = await res.json() as { url?: string };
      return new Response(null, { status: 302, headers: { Location: json.url ?? siteUrl, ...corsHeaders(ctx.request) } as Record<string, string> });
    }
  }

  const { data: user } = await supabase.auth.getUser();
  const email = user.user?.email;
  if (!email) return new Response(null, { status: 302, headers: { Location: "/auth", ...corsHeaders(ctx.request) } as Record<string, string> });
  const existing = await findActiveSubscriptionByEmail(email);
  if (existing.active) {
    return new Response(null, { status: 302, headers: { Location: `${siteUrl}/pricing?error=already_subscribed`, ...corsHeaders(ctx.request) } as Record<string, string> });
  }
  if (!priceId) return new Response(null, { status: 302, headers: { Location: `${siteUrl}/pricing?error=missing_price_id`, ...corsHeaders(ctx.request) } as Record<string, string> });
  try {
    const sessionStripe = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer_email: email,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${siteUrl}/dashboard`,
      cancel_url: `${siteUrl}/pricing`,
    });
    return new Response(null, { status: 302, headers: { Location: sessionStripe.url ?? siteUrl, ...corsHeaders(ctx.request) } as Record<string, string> });
  } catch {
    return new Response(null, { status: 302, headers: { Location: `${siteUrl}/pricing?error=checkout_failed`, ...corsHeaders(ctx.request) } as Record<string, string> });
  }
};

export const GET: APIRoute = async (ctx) => {
  const pf = preflight(ctx.request);
  if (pf) return pf;
  const supabase = getSupabaseServerClient(ctx as any);
  const { data: { session } } = await supabase.auth.getSession();
  const accessToken = session?.access_token;
  const siteUrl = import.meta.env.SITE_URL as string;
  if (!accessToken) return new Response(null, { status: 302, headers: { Location: "/auth?mode=signup" } });
  return new Response(null, { status: 302, headers: { Location: `${siteUrl}/pricing`, ...corsHeaders(ctx.request) } as Record<string, string> });
};

export const OPTIONS: APIRoute = async (ctx) => {
  const pf = preflight(ctx.request);
  if (pf) return pf;
  return new Response(null, { status: 204, headers: { ...corsHeaders(ctx.request) } });
};

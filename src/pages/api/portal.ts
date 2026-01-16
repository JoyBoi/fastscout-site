import type { APIRoute } from "astro";
import { getSupabaseServerClient } from "../../lib/supabase";
import stripe from "../../lib/stripe";
import { corsHeaders, preflight } from "../../lib/cors";

export const GET: APIRoute = async (ctx) => {
  const pf = preflight(ctx.request);
  if (pf) return pf;
  const supabase = getSupabaseServerClient(ctx as any);
  const { data: { session } } = await supabase.auth.getSession();
  const accessToken = session?.access_token;
  if (!accessToken) return new Response("Unauthorized", { status: 401, headers: { ...corsHeaders(ctx.request) } });

  const { data: allowed, error: rlError } = await supabase.rpc("check_rate_limit", {
    action: "portal",
    max_count: 5,
    window_seconds: 60,
  });
  // Fail closed: deny on rate limit error (don't allow if RPC fails)
  const proceed = rlError ? false : !!allowed;
  const siteUrl = import.meta.env.SITE_URL as string;
  if (!proceed) return new Response(null, { status: 302, headers: { Location: `${siteUrl}/dashboard?error=rate_limited`, ...corsHeaders(ctx.request) } as Record<string, string> });

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
  const { data: map } = await supabase
    .from("billing_customers")
    .select("stripe_customer_id")
    .eq("user_id", userId)
    .maybeSingle();
  customerId = map?.stripe_customer_id;
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

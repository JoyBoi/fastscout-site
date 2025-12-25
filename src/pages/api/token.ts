import type { APIRoute } from "astro";
import jwt from "jsonwebtoken";
import { findActiveSubscriptionByEmail, findActiveSubscriptionByCustomerId } from "../../lib/stripe";
import { getSupabaseServerClient } from "../../lib/supabase";
import { corsHeaders, preflight } from "../../lib/cors";

export const POST: APIRoute = async (ctx) => {
  const pf = preflight(ctx.request);
  if (pf) return pf;
  const supabase = getSupabaseServerClient(ctx as any);
  const { data } = await supabase.auth.getUser();
  const email = data.user?.email;
  const userId = data.user?.id;
  if (!email || !userId) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { "content-type": "application/json", ...corsHeaders(ctx.request) } });

  const { data: allowed, error: rlError } = await supabase.rpc("check_rate_limit", {
    action: "token",
    max_count: 10,
    window_seconds: 300,
  });
  if (rlError) return new Response(JSON.stringify({ error: "rate_limit_error" }), { status: 500, headers: { "content-type": "application/json", ...corsHeaders(ctx.request) } });
  if (!allowed) return new Response(JSON.stringify({ error: "rate_limited" }), { status: 429, headers: { "content-type": "application/json", ...corsHeaders(ctx.request) } });

  let customerId: string | undefined;
  const { data: status } = await supabase
    .from("subscription_status")
    .select("active")
    .eq("user_id", userId)
    .maybeSingle();
  let active = !!status?.active;
  if (!active) {
    const { data: map } = await supabase
      .from("billing_customers")
      .select("stripe_customer_id")
      .eq("user_id", userId)
      .maybeSingle();
    customerId = map?.stripe_customer_id;
    if (customerId) active = (await findActiveSubscriptionByCustomerId(customerId)).active;
    else active = (await findActiveSubscriptionByEmail(email)).active;
  }
  if (!active) return new Response(JSON.stringify({ error: "no_subscription" }), { status: 402, headers: { "content-type": "application/json", ...corsHeaders(ctx.request) } });

  const payload = {
    email,
    customerId,
    scope: ["bridge:access"],
  };

  const jwtSecret = import.meta.env.JWT_SECRET as string | undefined;
  if (!jwtSecret || jwtSecret.length < 16) return new Response(JSON.stringify({ error: "misconfigured_jwt" }), { status: 500, headers: { "content-type": "application/json", ...corsHeaders(ctx.request) } });
  const extensionToken = jwt.sign(payload, jwtSecret, { expiresIn: "7d" });
  return new Response(JSON.stringify({ token: extensionToken }), { status: 200, headers: { "content-type": "application/json", ...corsHeaders(ctx.request) } });
};

export const OPTIONS: APIRoute = async (ctx) => {
  const pf = preflight(ctx.request);
  if (pf) return pf;
  return new Response(null, { status: 204, headers: { ...corsHeaders(ctx.request) } });
};

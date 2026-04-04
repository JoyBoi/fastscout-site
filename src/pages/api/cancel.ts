import type { APIRoute } from "astro";
import { getSupabaseServerClient } from "../../lib/supabase";
import stripe, { findActiveSubscriptionByEmail } from "../../lib/stripe";
import { corsHeaders, preflight } from "../../lib/cors";
import { getConvexClient } from "../../lib/convex";
import { api } from "../../../convex/_generated/api";

export const prerender = false;

export const POST: APIRoute = async (ctx) => {
  const supabase = getSupabaseServerClient(ctx as any);
  const { data: { session } } = await supabase.auth.getSession();
  const accessToken = session?.access_token;
  if (!accessToken) return new Response("Unauthorized", { status: 401 });

  const convex = getConvexClient();
  const siteUrl = import.meta.env.SITE_URL as string;
  let allowed: boolean;
  try {
    allowed = session.user?.id ? await convex.mutation(api.rateLimit.checkRateLimit, { userId: session.user.id, action: "cancel", maxCount: 5, windowSeconds: 300 }) : false;
  } catch {
    allowed = false;
  }
  if (!allowed) return new Response(null, { status: 302, headers: { Location: `${siteUrl}/dashboard?error=rate_limited` } });

  const base = import.meta.env.STRIPE_WRAPPER_BASE_URL as string;
  if (!base || !/^https?:\/\/.*/.test(base)) return new Response(null, { status: 302, headers: { Location: `${siteUrl}/dashboard?error=misconfigured_edge_function` } });

  let atPeriodEnd = true;
  try {
    const form = await (ctx.request as Request).formData();
    const val = form.get("at_period_end");
    if (typeof val === "string") atPeriodEnd = val === "true";
  } catch {}

  const res = await fetch(`${base}/cancel`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "content-type": "application/json" },
    body: JSON.stringify({ at_period_end: atPeriodEnd }),
  });
  if (!res.ok) return new Response("Failed to cancel", { status: res.status });
  return new Response(null, { status: 302, headers: { Location: `${siteUrl}/dashboard` } });
};

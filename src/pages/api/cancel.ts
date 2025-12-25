import type { APIRoute } from "astro";
import { getSupabaseServerClient } from "../../lib/supabase";

export const POST: APIRoute = async (ctx) => {
  const supabase = getSupabaseServerClient(ctx as any);
  const { data: { session } } = await supabase.auth.getSession();
  const accessToken = session?.access_token;
  if (!accessToken) return new Response("Unauthorized", { status: 401 });

  const { data: allowed, error: rlError } = await supabase.rpc("check_rate_limit", {
    action: "cancel",
    max_count: 5,
    window_seconds: 300,
  });
  const siteUrl = import.meta.env.SITE_URL as string;
  if (rlError) return new Response(null, { status: 302, headers: { Location: `${siteUrl}/dashboard?error=rate_limit_error` } });
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

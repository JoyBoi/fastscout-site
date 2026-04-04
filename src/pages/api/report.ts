import type { APIRoute } from "astro";
import { getSupabaseServerClient } from "../../lib/supabase";
import { corsHeaders, preflight } from "../../lib/cors";
import { getConvexClient } from "../../lib/convex";
import { api } from "../../../convex/_generated/api";

export const prerender = false;

export const POST: APIRoute = async (ctx) => {
  const pf = preflight(ctx.request);
  if (pf) return pf;

  const supabase = getSupabaseServerClient(ctx as any);
  // Check auth - optional, capture if available
  const { data: { user } } = await supabase.auth.getUser();

  let payload: any;
  try {
    payload = await ctx.request.json();
  } catch {
    return new Response(JSON.stringify({ error: "invalid_json" }), {
      status: 400,
      headers: { "content-type": "application/json", ...corsHeaders(ctx.request) },
    });
  }

  const { title, description, type, source, metadata } = payload;

  if (!description) {
    return new Response(JSON.stringify({ error: "missing_description" }), {
      status: 400,
      headers: { "content-type": "application/json", ...corsHeaders(ctx.request) },
    });
  }

  const validTypes = ['bug', 'feature_request', 'other'];
  const finalType = validTypes.includes(type) ? type : 'bug';

  const convex = getConvexClient();
  try {
    await convex.mutation(api.reports.create, {
      userId: user?.id || undefined,
      title: title || undefined,
      description,
      type: finalType,
      source: source || 'webapp',
      metadata: metadata || {},
    });
  } catch (error: any) {
    console.error("Report insert error:", error);
    return new Response(JSON.stringify({ error: "insert_failed", details: error.message }), {
      status: 500,
      headers: { "content-type": "application/json", ...corsHeaders(ctx.request) },
    });
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "content-type": "application/json", ...corsHeaders(ctx.request) },
  });
};

export const OPTIONS: APIRoute = async (ctx) => {
  const pf = preflight(ctx.request);
  if (pf) return pf;
  return new Response(null, { status: 204, headers: { ...corsHeaders(ctx.request) } });
};

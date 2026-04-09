import type { APIRoute } from "astro";
import { getConvexServerClient } from "../../lib/convex";
import { corsHeaders, preflight } from "../../lib/cors";
import { api } from "../../../convex/_generated/api";

export const prerender = false;

export const POST: APIRoute = async (ctx) => {
  const pf = preflight(ctx.request);
  if (pf) return pf;

  const { client } = getConvexServerClient(ctx.request);

  let payload: any;
  try {
    payload = await ctx.request.json();
  } catch {
    return new Response(JSON.stringify({ error: "invalid_json" }), { status: 400, headers: { "content-type": "application/json", ...corsHeaders(ctx.request) } });
  }

  const { title, description, type, source, metadata } = payload;
  if (!description) return new Response(JSON.stringify({ error: "missing_description" }), { status: 400, headers: { "content-type": "application/json", ...corsHeaders(ctx.request) } });

  const validTypes = ["bug", "feature_request", "other"] as const;
  const finalType = validTypes.includes(type) ? type : "bug";

  try {
    await client.mutation(api.reports.create, {
      title: title || undefined,
      description,
      type: finalType,
      source: source || "webapp",
      metadata: metadata || {},
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: "insert_failed", details: e?.message }), { status: 500, headers: { "content-type": "application/json", ...corsHeaders(ctx.request) } });
  }

  return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "content-type": "application/json", ...corsHeaders(ctx.request) } });
};

export const OPTIONS: APIRoute = async (ctx) => {
  const pf = preflight(ctx.request);
  if (pf) return pf;
  return new Response(null, { status: 204, headers: { ...corsHeaders(ctx.request) } });
};

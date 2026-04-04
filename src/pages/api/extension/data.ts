import type { APIRoute } from "astro";
import { corsHeaders, preflight } from "../../../lib/cors";
import { getConvexClient } from "../../../lib/convex";
import { api } from "../../../../convex/_generated/api";

export const prerender = false;

export const GET: APIRoute = async (ctx) => {
  const pf = preflight(ctx.request);
  if (pf) return pf;

  const convex = getConvexClient();

  try {
    const data = await convex.query(api.extensionData.getData, {});
    const body = JSON.stringify(data);

    return new Response(body, {
      status: 200,
      headers: {
        "content-type": "application/json",
        // Cache for 1 hour
        "Cache-Control": "public, max-age=3600",
        ...corsHeaders(ctx.request),
      },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: "fetch_failed" }), {
      status: 500,
      headers: { "content-type": "application/json", ...corsHeaders(ctx.request) },
    });
  }
};

export const OPTIONS: APIRoute = async (ctx) => {
  const pf = preflight(ctx.request);
  if (pf) return pf;
  return new Response(null, { status: 204, headers: { ...corsHeaders(ctx.request) } });
};

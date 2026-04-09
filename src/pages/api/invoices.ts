import type { APIRoute } from "astro";
import { getConvexServerClient } from "../../lib/convex";
import { corsHeaders, preflight } from "../../lib/cors";
import { api } from "../../../convex/_generated/api";

export const prerender = false;

async function handleInvoices(ctx: Parameters<APIRoute>[0]): Promise<Response> {
  const pf = preflight(ctx.request);
  if (pf) return pf;
  const { client } = getConvexServerClient(ctx.request);
  const viewer = await client.query(api.users.getViewer).catch(() => null);
  if (!viewer) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { "content-type": "application/json", ...corsHeaders(ctx.request) } });

  try {
    const result = await client.action(api.stripe.getInvoices);
    return new Response(JSON.stringify(result), { status: 200, headers: { "content-type": "application/json", ...corsHeaders(ctx.request) } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message ?? "invoices_failed" }), { status: 500, headers: { "content-type": "application/json", ...corsHeaders(ctx.request) } });
  }
}

export const GET: APIRoute = handleInvoices;
export const POST: APIRoute = handleInvoices;

export const OPTIONS: APIRoute = async (ctx) => {
  const pf = preflight(ctx.request);
  if (pf) return pf;
  return new Response(null, { status: 204, headers: { ...corsHeaders(ctx.request) } });
};

import type { APIRoute } from "astro";
import { getConvexServerClient } from "../../lib/convex";
import { corsHeaders, preflight } from "../../lib/cors";
import { api } from "../../../convex/_generated/api";

export const prerender = false;

async function handleSession(ctx: Parameters<APIRoute>[0]): Promise<Response> {
  const pf = preflight(ctx.request);
  if (pf) return pf;

  const { client, token } = getConvexServerClient(ctx.request);

  if (!token) {
    return new Response(
      JSON.stringify({ authenticated: false, subscriptionActive: false, email: null, displayName: null }),
      { status: 200, headers: { "content-type": "application/json", ...corsHeaders(ctx.request) } },
    );
  }

  const [viewer, sub] = await Promise.all([
    client.query(api.users.getViewer).catch(() => null),
    client.query(api.subscriptions.getStatus).catch(() => null),
  ]);

  if (!viewer) {
    return new Response(
      JSON.stringify({ authenticated: false, subscriptionActive: false, email: null, displayName: null }),
      { status: 200, headers: { "content-type": "application/json", ...corsHeaders(ctx.request) } },
    );
  }

  const email = (viewer as any).email ?? null;
  const displayName = (viewer as any).name ?? (viewer as any).email ?? null;
  const subscriptionActive = sub ? sub.status === "active" || sub.status === "trialing" : false;
  const priceId = sub?.priceId ?? undefined;
  const periodEnd = sub?.periodEnd ? new Date(sub.periodEnd * 1000).toISOString() : undefined;

  return new Response(
    JSON.stringify({ authenticated: true, subscriptionActive, priceId, periodEnd, email, displayName }),
    { status: 200, headers: { "content-type": "application/json", ...corsHeaders(ctx.request) } },
  );
}

export const GET: APIRoute = handleSession;
export const POST: APIRoute = handleSession;

export const OPTIONS: APIRoute = async (ctx) => {
  const pf = preflight(ctx.request);
  if (pf) return pf;
  return new Response(null, { status: 204, headers: { ...corsHeaders(ctx.request) } });
};

import type { APIRoute } from "astro";
import jwt from "jsonwebtoken";
import { getConvexServerClient } from "../../lib/convex";
import { corsHeaders, preflight } from "../../lib/cors";
import { api } from "../../../convex/_generated/api";

export const prerender = false;

export const POST: APIRoute = async (ctx) => {
  const pf = preflight(ctx.request);
  if (pf) return pf;

  const { client, token: convexToken } = getConvexServerClient(ctx.request);
  if (!convexToken) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { "content-type": "application/json", ...corsHeaders(ctx.request) } });

  const [viewer, sub] = await Promise.all([
    client.query(api.users.getViewer).catch(() => null),
    client.query(api.subscriptions.getStatus).catch(() => null),
  ]);

  if (!viewer) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { "content-type": "application/json", ...corsHeaders(ctx.request) } });

  const active = sub ? sub.status === "active" || sub.status === "trialing" : false;
  if (!active) return new Response(JSON.stringify({ error: "no_subscription" }), { status: 402, headers: { "content-type": "application/json", ...corsHeaders(ctx.request) } });

  const secret = import.meta.env.JWT_SECRET;
  if (!secret) return new Response(JSON.stringify({ error: "server_error" }), { status: 500, headers: { "content-type": "application/json", ...corsHeaders(ctx.request) } });

  const email = (viewer as any).email ?? null;
  const token = jwt.sign({ email, scope: ["bridge:access"] }, secret, { expiresIn: "1h" });
  return new Response(JSON.stringify({ token }), { status: 200, headers: { "content-type": "application/json", ...corsHeaders(ctx.request) } });
};

export const OPTIONS: APIRoute = async (ctx) => {
  return new Response(null, { status: 204, headers: corsHeaders(ctx.request) });
};

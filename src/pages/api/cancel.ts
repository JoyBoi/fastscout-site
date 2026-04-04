import type { APIRoute } from "astro";
import jwt from "jsonwebtoken";
import { getAuthenticatedUser } from "../../lib/auth";
import { corsHeaders } from "../../lib/cors";
import { getConvexClient } from "../../lib/convex";
import { api } from "../../../convex/_generated/api";

export const prerender = false;

export const POST: APIRoute = async (ctx) => {
  const sessionUser = getAuthenticatedUser(ctx.request);
  if (!sessionUser) return new Response("Unauthorized", { status: 401 });
  const userId = sessionUser.userId;
  const email = sessionUser.email;

  const convex = getConvexClient();
  const siteUrl = import.meta.env.SITE_URL as string;
  let allowed: boolean;
  try {
    allowed = await convex.mutation(api.rateLimit.checkRateLimit, { userId, action: "cancel" });
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

  const secret = import.meta.env.JWT_SECRET as string;
  const accessToken = jwt.sign({ userId, email }, secret, { expiresIn: "5m" });
  const res = await fetch(`${base}/cancel`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "content-type": "application/json" },
    body: JSON.stringify({ at_period_end: atPeriodEnd }),
  });
  if (!res.ok) return new Response("Failed to cancel", { status: res.status });
  return new Response(null, { status: 302, headers: { Location: `${siteUrl}/dashboard` } });
};

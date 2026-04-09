import type { APIRoute } from "astro";
import { corsHeaders, preflight } from "../../../lib/cors";
import { getConvexServerClient } from "../../../lib/convex";
import { createHash } from "node:crypto";
import { api } from "../../../../convex/_generated/api";

function normalize(s: string | undefined | null) {
  return (s ?? "").trim().toLowerCase();
}

export const prerender = false;

export const POST: APIRoute = async (ctx) => {
  const pf = preflight(ctx.request);
  if (pf) return pf;

  const { client } = getConvexServerClient(ctx.request);
  const viewer = await client.query(api.users.getViewer).catch(() => null);
  if (!viewer) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { "content-type": "application/json", ...corsHeaders(ctx.request) } });

  let payload: any;
  try {
    payload = await ctx.request.json();
  } catch {
    return new Response(JSON.stringify({ error: "invalid_json" }), { status: 400, headers: { "content-type": "application/json", ...corsHeaders(ctx.request) } });
  }

  const type: "brand" | "model" | undefined = payload?.type;
  if (type !== "brand" && type !== "model") return new Response(JSON.stringify({ error: "invalid_type" }), { status: 400, headers: { "content-type": "application/json", ...corsHeaders(ctx.request) } });

  const makeId = payload?.makeId ? String(payload.makeId) : undefined;
  const makeName = payload?.makeName ? String(payload.makeName) : undefined;
  const modelName = payload?.modelName ? String(payload.modelName) : undefined;
  const platform = payload?.platform ? String(payload.platform) : undefined;
  const pageUrl = payload?.url ? String(payload.url) : undefined;

  const fpBase = [type, normalize(makeId), normalize(makeName), normalize(modelName), normalize(platform), normalize(pageUrl)].join("|");
  const fingerprint = createHash("sha256").update(fpBase).digest("hex");

  try {
    await client.mutation(api.missingEntries.log, { fingerprint, type, makeId, makeName, modelName, platform, pageUrl });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message ?? "upsert_failed" }), { status: 500, headers: { "content-type": "application/json", ...corsHeaders(ctx.request) } });
  }
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "content-type": "application/json", ...corsHeaders(ctx.request) } });
};

export const OPTIONS: APIRoute = async (ctx) => {
  const pf = preflight(ctx.request);
  if (pf) return pf;
  return new Response(null, { status: 204, headers: { ...corsHeaders(ctx.request) } });
};

import type { APIRoute } from "astro";
import { corsHeaders, preflight } from "../../../lib/cors";
import { getSupabaseServerClient } from "../../../lib/supabase";
import { createHash } from "node:crypto";

function normalize(s: string | undefined | null) {
  return (s ?? "").trim().toLowerCase();
}

export const POST: APIRoute = async (ctx) => {
  const pf = preflight(ctx.request);
  if (pf) return pf;

  const supabase = getSupabaseServerClient(ctx as any);
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json", ...corsHeaders(ctx.request) },
    });
  }

  const { data: allowed, error: rlError } = await supabase.rpc("check_rate_limit", {
    action: "log_missing",
    max_count: 20,
    window_seconds: 60,
  });
  if (rlError || !allowed) {
    return new Response(JSON.stringify({ error: "rate_limited" }), {
      status: 429,
      headers: { "content-type": "application/json", ...corsHeaders(ctx.request) },
    });
  }

  let payload: any;
  try {
    payload = await ctx.request.json();
  } catch {
    return new Response(JSON.stringify({ error: "invalid_json" }), {
      status: 400,
      headers: { "content-type": "application/json", ...corsHeaders(ctx.request) },
    });
  }

  const type: "brand" | "model" | undefined = payload?.type;
  if (type !== "brand" && type !== "model") {
    return new Response(JSON.stringify({ error: "invalid_type" }), {
      status: 400,
      headers: { "content-type": "application/json", ...corsHeaders(ctx.request) },
    });
  }
  const makeId: string | undefined = payload?.makeId ? String(payload.makeId) : undefined;
  const makeName: string | undefined = payload?.makeName ? String(payload.makeName) : undefined;
  const modelName: string | undefined = payload?.modelName ? String(payload.modelName) : undefined;
  const platform: string | undefined = payload?.platform ? String(payload.platform) : undefined;
  const url: string | undefined = payload?.url ? String(payload.url) : undefined;

  const fpBase = [type, normalize(makeId), normalize(makeName), normalize(modelName), normalize(platform), normalize(url)].join("|");
  const fingerprint = createHash("sha256").update(fpBase).digest("hex");
  const now = new Date().toISOString();

  const row = {
    type,
    make_id: makeId ?? null,
    make_name: makeName ?? null,
    model_name: modelName ?? null,
    platform: platform ?? null,
    page_url: url ?? null,
    fingerprint,
    last_seen_at: now,
  };

  const { error } = await supabase.from("missing_entries").upsert(row, { onConflict: "fingerprint" });
  if (error) {
    return new Response(JSON.stringify({ error: "upsert_failed" }), {
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

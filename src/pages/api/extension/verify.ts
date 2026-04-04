import type { APIRoute } from "astro";
import { corsHeaders, preflight } from "../../../lib/cors";
import { getAuthenticatedUser } from "../../../lib/auth";
import { getConvexClient } from "../../../lib/convex";
import { api } from "../../../../convex/_generated/api";

export const prerender = false;

// ---------------------------------------------------------------------------
// Prompt templates
// ---------------------------------------------------------------------------

const SEARCH_SYSTEM_PROMPT = `You validate vehicle data extracted from car trading platforms before it's used on AutoScout24 SEARCH.

ONLY check these fields (the ones actually used in AS24 search URL):
- BODY TYPE: Berline(6), Break(5), Cabriolet(2), Citadine(1), Coupé(3), Monospace(12), SUV/4x4/Pick-Up(4), Utilitaire(13), Autres(7)
- FUEL: Essence(B), Diesel(D), Electrique(E), Hybride-essence(2), Hybride-diesel(3), GPL(L), CNG(C), Hydrogène(H), Autres(O)
- TRANSMISSION: Automatique(A), Manuelle(M), Semi-automatique(S)

DO NOT check or flag: drive type, color, interior, upholstery, doors, seats, emission class, engine size. These are NOT used in the search URL.

Return JSON: {"status":"ok"|"warnings"|"errors","issues":[{"field":"<name>","severity":"error"|"warning"|"critical","extracted":"<source value>","mapped":"<AS24 code or null>","expected":"<correct AS24 label or null>","message":"<explanation>"}],"confidence":0.0-1.0}

STRICT RULES (anti-hallucination):
- "error" = definitely wrong mapping (BMW X5 mapped to Coupé → should be SUV/4x4)
- "warning" = suspicious but possible (Clio with 200kW)
- "critical" = serious mechanical/structural problem found in damage descriptions
- ONLY flag issues you are CERTAIN about. When in doubt, do NOT flag.
- NEVER invent or assume damage that is not explicitly described in the data.
- NEVER flag a field if it's correctly mapped. If body=SUV and mapped=4, that's correct — don't flag it.
- Empty issues array = data looks correct. This is the EXPECTED outcome for most vehicles.
- Check: brand+model vs body type, fuel vs model (Tesla=Electric), power range vs model, transmission vs model (EV=Automatic), mileage vs year
- "UNMAPPED" in mapped field = flag as error with correct AS24 label
- Messages in French, under 80 chars.

DAMAGE ANALYSIS (only if damages[] is provided in the data):
- Flag as "critical" ONLY if damage descriptions explicitly mention: engine/moteur, gearbox/boîte de vitesses, turbo, chassis/châssis, flood/inondation, fire/incendie, airbag deployed
- Flag cosmetic damage as "warning" ONLY if total repair cost > 3000€
- IGNORE minor cosmetic damage (scratches, small dents, paint chips)
- NEVER assume mechanical damage from cosmetic descriptions. A dent is NOT engine damage.
- If no damages provided, skip damage analysis entirely — do NOT mention damage at all.`;

const MANUAL_LISTING_EXTRA = `
IMPORTANT: This is for MANUAL LISTING (form fill), not search. Check ALL fields including:
COLORS: Argent(12), Beige(1), Blanc(14), Bleu(2), Bronze(4), Brun(3), Gris(6), Jaune(5), Mauve(13), Noir(11), Or(16), Orange(15), Rouge(10), Vert(7)
INTERIOR COLORS: Beige(1), Blanc(11), Bleu(6), Brun(4), Gris(3), Jaune(9), Noir(2), Orange(10), Rouge(7), Vert(8), Autres(5)
UPHOLSTERY: Alcantara(AL), Tissu(CL), Cuir(FL), Cuir partiel(PL), Velours(VL), Autre(OT)
EMISSION: Euro 0-6
DRIVE: 4x4(4), Avant/FWD(F), Arrière/RWD(R)
FIELD DEPENDENCY CHAIN: Make → Model → Year → Month → Body → Fuel → Transmission → Power → Version → Mileage
Each field only enables after previous is selected. If Make fails, everything downstream fails.

Also check: color extracted vs color code, upholstery consistency, year+month from registration date.`;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface VerifyPayload {
  flow: "search" | "manual_listing";
  car: Record<string, unknown>;
  mapped: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildUserMessage(payload: VerifyPayload): string {
  const { car, mapped } = payload;
  const lines: string[] = [
    `Verify: ${car.brand || "?"} ${car.model || "?"}`,
    `Extracted → Mapped AS24:`,
    `  Body: "${car.carBody || "?"}" → ${mapped.bodytype || "UNMAPPED"}`,
    `  Fuel: "${car.fuelType || "?"}" → ${mapped.fuel || "UNMAPPED"}`,
    `  Trans: "${car.transmission || "?"}" → ${mapped.gearingtype || "UNMAPPED"}`,
    `  Drive: "${car.driveType || "?"}" → ${mapped.drivetype || "UNMAPPED"}`,
    `  Power: ${car.kw || car.power || "?"} kW, Year: ${car.year || "?"}, Mileage: ${car.mileage || "?"} km`,
  ];

  if (payload.flow === "manual_listing") {
    lines.push(
      `  Color: "${car.color || "?"}" → ${mapped.color || "UNMAPPED"}`,
      `  Interior: "${car.interiorColor || "?"}" → ${mapped.interiorColor || "UNMAPPED"}`,
      `  Upholstery: "${car.upholstery || "?"}" → ${mapped.upholstery || "UNMAPPED"}`,
      `  Emission: "${car.emissionStandard || "?"}" → ${mapped.emclass || "UNMAPPED"}`,
      `  Doors: ${car.doors || "?"}, Seats: ${car.seats || "?"}`,
      `  Registration: ${car.registration || "?"} → Year: ${mapped.firstreg_year || "?"}, Month: ${mapped.firstreg_mth || "?"}`,
      `  Version: ${car.version || "?"}`,
    );
  }

  // Damage data (from CarCollect)
  const damages = car.damages as Array<Record<string, unknown>> | undefined;
  if (damages && Array.isArray(damages) && damages.length > 0) {
    lines.push(`Damages (${damages.length}):`);
    for (const d of damages.slice(0, 10)) {
      const loc = d.location || "?";
      const type = d.type || "?";
      const desc = d.description || "";
      const cost = d.cost ? `${d.cost}€` : "";
      lines.push(`  - [${loc}] ${type}${desc ? ` — "${desc}"` : ""}${cost ? ` — ${cost}` : ""}`);
    }
  }

  // Condition data
  if (car.paintCondition) lines.push(`Paint condition: ${car.paintCondition}`);
  if (car.interiorCondition) lines.push(`Interior condition: ${car.interiorCondition}`);
  if (car.napCheck !== undefined) lines.push(`NAP check: ${car.napCheck}`);

  return lines.join("\n");
}

function getSystemPrompt(flow: "search" | "manual_listing"): string {
  if (flow === "manual_listing") {
    return SEARCH_SYSTEM_PROMPT + MANUAL_LISTING_EXTRA;
  }
  return SEARCH_SYSTEM_PROMPT;
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export const POST: APIRoute = async (ctx) => {
  const pf = preflight(ctx.request);
  if (pf) return pf;

  const headers = { "content-type": "application/json", ...corsHeaders(ctx.request) };

  // Auth
  const sessionUser = getAuthenticatedUser(ctx.request);
  if (!sessionUser) {
    return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers });
  }
  const userId = sessionUser.userId;

  // Rate limit
  const convex = getConvexClient();
  let allowed: boolean;
  try {
    allowed = await convex.mutation(api.rateLimit.checkRateLimit, {
      userId,
      action: "extension_verify",
    });
  } catch {
    allowed = false;
  }
  if (!allowed) {
    return new Response(JSON.stringify({ error: "rate_limited" }), { status: 429, headers });
  }

  // Parse body
  let payload: VerifyPayload;
  try {
    payload = await ctx.request.json();
  } catch {
    return new Response(JSON.stringify({ error: "invalid_json" }), { status: 400, headers });
  }

  // Validate
  if (!payload.flow || !["search", "manual_listing"].includes(payload.flow)) {
    return new Response(JSON.stringify({ error: "invalid_flow" }), { status: 400, headers });
  }
  if (!payload.car || !payload.car.brand) {
    return new Response(JSON.stringify({ error: "missing_car_data" }), { status: 400, headers });
  }

  // OpenRouter call
  const apiKey = import.meta.env.OPENROUTER_API_KEY as string | undefined;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "ai_not_configured" }), { status: 503, headers });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const orResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.0-flash-001",
        temperature: 0,
        max_tokens: 500,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: getSystemPrompt(payload.flow) },
          { role: "user", content: buildUserMessage(payload) },
        ],
      }),
    });

    if (!orResponse.ok) {
      const errText = await orResponse.text().catch(() => "");
      return new Response(
        JSON.stringify({ error: "ai_error" }),
        { status: 502, headers },
      );
    }

    const orData = await orResponse.json();
    const content = orData?.choices?.[0]?.message?.content;

    if (!content) {
      return new Response(
        JSON.stringify({ status: "ok", issues: [], confidence: 0 }),
        { status: 200, headers },
      );
    }

    // Parse and validate AI JSON response
    let raw: Record<string, unknown>;
    try {
      raw = JSON.parse(content);
    } catch {
      return new Response(
        JSON.stringify({ status: "ok", issues: [], confidence: 0 }),
        { status: 200, headers },
      );
    }

    // Sanitize: only forward expected shape, cap issues at 20
    const validStatus = ["ok", "warnings", "errors"];
    const validSeverity = ["error", "warning", "critical"];
    const hasCritical = Array.isArray(raw.issues) && raw.issues.some((i: Record<string, unknown>) => i.severity === "critical");
    const status = hasCritical ? "errors" : (validStatus.includes(raw.status as string) ? raw.status : "ok");
    const confidence = typeof raw.confidence === "number" ? Math.min(Math.max(raw.confidence, 0), 1) : 0;
    const rawIssues = Array.isArray(raw.issues) ? raw.issues.slice(0, 20) : [];
    const issues = rawIssues.map((i: Record<string, unknown>) => ({
      field: typeof i.field === "string" ? i.field.slice(0, 50) : "unknown",
      severity: validSeverity.includes(i.severity as string) ? i.severity as string : "warning",
      extracted: typeof i.extracted === "string" ? i.extracted.slice(0, 100) : "",
      mapped: typeof i.mapped === "string" ? i.mapped.slice(0, 50) : null,
      expected: typeof i.expected === "string" ? i.expected.slice(0, 100) : null,
      message: typeof i.message === "string" ? i.message.slice(0, 200) : "",
    }));

    return new Response(JSON.stringify({ status, issues, confidence }), { status: 200, headers });
  } catch (err: unknown) {
    if (err instanceof Error && err.name === "AbortError") {
      return new Response(JSON.stringify({ error: "ai_timeout" }), { status: 504, headers });
    }
    return new Response(
      JSON.stringify({ error: "ai_error", detail: err instanceof Error ? err.message : String(err) }),
      { status: 502, headers },
    );
  } finally {
    clearTimeout(timeout);
  }
};

export const OPTIONS: APIRoute = async (ctx) => {
  const pf = preflight(ctx.request);
  if (pf) return pf;
  return new Response(null, { status: 204, headers: { ...corsHeaders(ctx.request) } });
};

import type { APIRoute } from "astro";
import { getAuthenticatedUser } from "../../../lib/auth";
import { getConvexClient } from "../../../lib/convex";
import { api } from "../../../../convex/_generated/api";

export const prerender = false;

function escCsv(val: unknown): string {
  if (val === null || val === undefined) return "";
  const s = String(val);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

// ---------------------------------------------------------------------------
// GET /api/activity/export?from=2026-01-01&to=2026-04-04&type=all
// ---------------------------------------------------------------------------
export const GET: APIRoute = async (ctx) => {
  const sessionUser = getAuthenticatedUser(ctx.request);
  if (!sessionUser) {
    return new Response("Unauthorized", { status: 401 });
  }

  const url = new URL(ctx.request.url);
  const from = url.searchParams.get("from")
    ? new Date(url.searchParams.get("from")!).getTime()
    : undefined;
  const to = url.searchParams.get("to")
    ? new Date(url.searchParams.get("to")!).getTime()
    : undefined;
  const type = url.searchParams.get("type");
  const requestedUserId = url.searchParams.get("userId");

  let targetUserId: string | undefined = sessionUser.userId;
  if (requestedUserId && requestedUserId !== sessionUser.userId) {
    const convex = getConvexClient();
    const user = await convex.query(api.users.getByEmail, { email: sessionUser.email });
    if (user?.role !== "admin") {
      return new Response("Forbidden", { status: 403 });
    }
    targetUserId = requestedUserId === "all" ? undefined : requestedUserId;
  }

  const convex = getConvexClient();
  const events = await convex.query(api.activityEvents.exportByUser, {
    userId: targetUserId,
    from,
    to,
    type: type && type !== "all" ? (type as any) : undefined,
  });

  const csvHeader = "Date,Type,Platform,Brand,Model,VIN,Year,Mileage,Price,Source URL,AS24 URL,Status,Fields Total,Fields Success,Fields Error,Duration (ms),Bid Amount,Error";
  const rows = events.map((e: any) => [
    new Date(e.ts).toISOString(),
    e.type,
    e.platform,
    e.car?.brand ?? "",
    e.car?.model ?? "",
    e.car?.vin ?? "",
    e.car?.year ?? "",
    e.car?.mileage ?? "",
    e.car?.price ?? "",
    e.sourceUrl ?? "",
    e.as24Url ?? "",
    e.result?.status ?? "",
    e.result?.fieldsTotal ?? "",
    e.result?.fieldsSuccess ?? "",
    e.result?.fieldsError ?? "",
    e.result?.durationMs ?? "",
    e.result?.bidAmount ?? "",
    e.result?.errorMessage ?? "",
  ].map(escCsv).join(","));

  const csv = [csvHeader, ...rows].join("\n");
  const today = new Date().toISOString().slice(0, 10);

  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename=activity-export-${today}.csv`,
    },
  });
};

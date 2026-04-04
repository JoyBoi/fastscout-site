import type { APIRoute } from "astro";
import { getAuthenticatedUser } from "../../../lib/auth";
import { getConvexClient } from "../../../lib/convex";
import { api } from "../../../../convex/_generated/api";

export const prerender = false;

// ---------------------------------------------------------------------------
// GET /api/activity?limit=20&cursor=xxx&type=search&userId=xxx
// Dealer sees own events; admin can pass userId for any user
// ---------------------------------------------------------------------------
export const GET: APIRoute = async (ctx) => {
  const headers = { "content-type": "application/json" };

  const sessionUser = getAuthenticatedUser(ctx.request);
  if (!sessionUser) {
    return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers });
  }

  const url = new URL(ctx.request.url);
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "20", 10) || 20, 100);
  const cursor = url.searchParams.get("cursor") ? Number(url.searchParams.get("cursor")) : undefined;
  const type = url.searchParams.get("type") || undefined;
  const requestedUserId = url.searchParams.get("userId");

  // For now, always use the authenticated user's ID
  // Admin override: check role if requestedUserId is provided
  let targetUserId = sessionUser.userId;
  if (requestedUserId && requestedUserId !== sessionUser.userId) {
    const convex = getConvexClient();
    const user = await convex.query(api.users.getByEmail, { email: sessionUser.email });
    if (user?.role !== "admin") {
      return new Response(JSON.stringify({ error: "forbidden" }), { status: 403, headers });
    }
    targetUserId = requestedUserId;
  }

  const convex = getConvexClient();
  try {
    const result = await convex.query(api.activityEvents.listByUser, {
      userId: targetUserId,
      type: type as any,
      limit,
      cursor,
    });
    return new Response(JSON.stringify(result), { status: 200, headers });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "query_failed", detail: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers },
    );
  }
};

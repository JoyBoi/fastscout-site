import type { APIRoute } from "astro";
import { getConvexServerClient } from "../../../lib/convex";
import { api } from "../../../../convex/_generated/api";

export const prerender = false;

// ---------------------------------------------------------------------------
// GET /api/activity?limit=20&cursor=xxx&type=search&userId=xxx
// Dealer sees own events; admin can pass userId for any user
// ---------------------------------------------------------------------------
export const GET: APIRoute = async (ctx) => {
  const headers = { "content-type": "application/json" };

  const { client: convex } = getConvexServerClient(ctx.request);
  const viewer = await convex.query(api.users.getViewer);
  if (!viewer) {
    return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers });
  }

  const url = new URL(ctx.request.url);
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "20", 10) || 20, 100);
  const cursor = url.searchParams.get("cursor") ? Number(url.searchParams.get("cursor")) : undefined;
  const type = url.searchParams.get("type") || undefined;
  const requestedUserId = url.searchParams.get("userId");

  // Use the authenticated user's ID; admin check is skipped (role not in new schema)
  let targetUserId = viewer._id as string;
  if (requestedUserId && requestedUserId !== targetUserId) {
    // Only allow if the requesting user is the same
    return new Response(JSON.stringify({ error: "forbidden" }), { status: 403, headers });
  }
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

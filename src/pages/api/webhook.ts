import type { APIRoute } from "astro";

export const prerender = false;

// Stripe webhooks are now handled by the Convex HTTP router at /stripe/webhook
// This endpoint is kept for backwards compatibility but does nothing.
export const POST: APIRoute = async () => {
  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
};

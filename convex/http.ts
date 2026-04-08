import { httpRouter } from "convex/server";
import { auth } from "./auth";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";

const http = httpRouter();

// Debug route to verify router is working
http.route({
  path: "/api/health",
  method: "GET",
  handler: httpAction(async () => new Response("ok")),
});

auth.addHttpRoutes(http);

http.route({
  path: "/stripe/webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const result = await ctx.runAction(internal.stripe.handleWebhookRequest, {
      signature: request.headers.get("stripe-signature") ?? "",
      body: await request.text(),
    }) as { status: number; text: string };
    return new Response(result.text, { status: result.status });
  }),
});

export default http;

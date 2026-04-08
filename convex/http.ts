import { httpRouter } from "convex/server";
import { auth } from "./auth";
import { handleStripeWebhook } from "./stripe";

const http = httpRouter();
auth.addHttpRoutes(http);
http.route({ path: "/stripe/webhook", method: "POST", handler: handleStripeWebhook });
export default http;

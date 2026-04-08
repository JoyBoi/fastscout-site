import { defineApp } from "convex/server";
import rateLimiter from "@convex-dev/ratelimiter/convex.config";

const app = defineApp();
app.use(rateLimiter);

export default app;

import { RateLimiter } from "@convex-dev/ratelimiter";
import { components } from "./_generated/api";

export const rateLimiter = new RateLimiter(components.rateLimiter, {
  token:        { kind: "fixed window", rate: 10, period: 300_000 },
  checkout:     { kind: "fixed window", rate: 3,  period: 60_000  },
  cancel:       { kind: "fixed window", rate: 5,  period: 300_000 },
  change_plan:  { kind: "fixed window", rate: 5,  period: 300_000 },
  reactivate:   { kind: "fixed window", rate: 5,  period: 300_000 },
  portal:       { kind: "fixed window", rate: 5,  period: 60_000  },
  log_missing:  { kind: "fixed window", rate: 20, period: 60_000  },
  invoices:     { kind: "fixed window", rate: 10, period: 300_000 },
  cancel_queued:{ kind: "fixed window", rate: 5,  period: 300_000 },
});

# Activity Tracking & KPI Dashboard — Design Spec

## Context

AutoBridge is a Chrome extension that extracts vehicle data from dealer platforms (FastBack, Auto1, CarCollect) and generates AutoScout24 search URLs or auto-fills AS24 listing forms. The companion web app (fast-scout-app) handles auth, billing, and data sync.

**Problem:** There is no visibility into extension usage. Dealers can't see their activity history or performance metrics. The platform owner has no usage analytics. Manual listing results are stored only in local IndexedDB (device-only, lost on reinstall).

**Goal:** Track every user action server-side and surface KPIs in two dashboards — one for dealers (own activity), one for admin (all users).

## Scope

- **In scope:** Event tracking (extraction, search, listing, bid, error), dealer dashboard, admin dashboard, CSV export
- **Out of scope (v2+):** Email digests, extension badge counts, real-time notifications, materialized stats tables

---

## 1. Data Model

### `activityEvents` table (Convex)

```ts
activityEvents: defineTable({
  userId: v.string(),
  type: v.union(
    v.literal("extraction"),
    v.literal("search"),
    v.literal("manual_listing"),
    v.literal("bid"),
    v.literal("error")
  ),
  platform: v.union(
    v.literal("fastback"),
    v.literal("auto1"),
    v.literal("carcollect"),
    v.literal("autoscout24"),
    v.literal("unknown")
  ),
  ts: v.number(), // Unix timestamp (ms)

  car: v.optional(v.object({
    brand: v.string(),
    model: v.string(),
    vin: v.optional(v.string()),
    year: v.optional(v.string()),
    mileage: v.optional(v.number()),
    fuelType: v.optional(v.string()),
    transmission: v.optional(v.string()),
    power: v.optional(v.string()),
    price: v.optional(v.number()),
    color: v.optional(v.string()),
    registration: v.optional(v.string()),
  })),

  sourceUrl: v.optional(v.string()),
  as24Url: v.optional(v.string()),

  result: v.optional(v.object({
    status: v.optional(v.union(
      v.literal("success"),
      v.literal("partial"),
      v.literal("failed")
    )),
    fieldsTotal: v.optional(v.number()),
    fieldsSuccess: v.optional(v.number()),
    fieldsError: v.optional(v.number()),
    fieldsSkipped: v.optional(v.number()),
    durationMs: v.optional(v.number()),
    bidAmount: v.optional(v.number()),
    errorMessage: v.optional(v.string()),
    errorContext: v.optional(v.string()),
  })),

  fieldResults: v.optional(v.array(v.object({
    fieldName: v.string(),
    status: v.union(
      v.literal("success"),
      v.literal("error"),
      v.literal("skipped"),
      v.literal("manual")
    ),
    attemptedValue: v.optional(v.string()),
    selectedValue: v.optional(v.string()),
    errorMessage: v.optional(v.string()),
  }))),
})
  .index("by_userId", ["userId"])
  .index("by_userId_type", ["userId", "type"])
  .index("by_userId_ts", ["userId", "ts"])
  .index("by_ts", ["ts"])
  .index("by_type_ts", ["type", "ts"]),
```

**Design decisions:**
- Car data is denormalized (snapshot at time of action, not a reference)
- `fieldResults` only populated for `manual_listing` events
- `ts` is client-side timestamp (extension time), `_creationTime` is server-side

---

## 2. Data Flow

```
Content script (main.ts / manualListing.ts)
  → chrome.runtime.sendMessage({ type: "TRACK_ACTIVITY", payload })
    → Background service worker (index.ts)
      → fetch POST /api/extension/activity (cookie auth, fire-and-forget)
        → Astro API endpoint (validates, extracts userId)
          → Convex mutation: activityEvents.insert
```

**Failure handling:** Background queues failed events in `chrome.storage.local` under key `activity_queue`. On next successful send or extension startup, flushes the queue via batch endpoint.

---

## 3. API Endpoints

### `POST /api/extension/activity`
- Auth: cookie-based (`getAuthenticatedUser()`)
- Rate limit: 60 events/minute per user
- Body: `ActivityEventPayload` (see data model fields minus `userId`)
- Response: `{ ok: true }` or `{ error: string }`

### `POST /api/extension/activity/batch`
- Same auth. Accepts `{ events: ActivityEventPayload[] }` (max 20)
- For queue flush after offline period

### `GET /api/activity?limit=20&cursor=xxx&type=search`
- Auth: cookie-based. Dealer sees own events, admin can pass `userId`
- Returns `{ events: [], nextCursor: string | null }`

### `GET /api/activity/export?from=YYYY-MM-DD&to=YYYY-MM-DD&type=all`
- Auth: cookie-based. Dealer=own data, admin can export any user
- Returns CSV file (up to 5000 rows)
- Columns: Date, Type, Platform, Brand, Model, VIN, Year, Mileage, Price, Source URL, AS24 URL, Status, Fields Total, Fields Success, Fields Error, Duration (ms), Bid Amount, Error

---

## 4. Extension Instrumentation

### New file: `src/services/activityTracker.ts`

```ts
async function trackEvent(event: Omit<ActivityEventPayload, "ts">): Promise<void>
```

Sends `TRACK_ACTIVITY` message to background. Background handles network.

### Instrumentation points

| Event | File | Trigger location |
|-------|------|-----------------|
| `extraction` | `src/content/main.ts` | After each `lastCarData` assignment (4 platform-specific paths) |
| `search` | `src/content/main.ts` | After `generateAutoScoutUrl()` returns non-null URL |
| `manual_listing` | `src/content/manualListing.ts` | Where `SAVE_LISTING_RECORD` message is sent |
| `bid` | `src/content/main.ts` | In `handleBidData()` after bid fill succeeds |
| `error` | `src/background/index.ts` | In `logError()` for operation-level failures only |

### New message type in background

```ts
case "TRACK_ACTIVITY": {
  trackActivityEvent(message.payload);
  sendResponse({ success: true });
  return true;
}
```

---

## 5. Convex Functions

New file: `convex/activityEvents.ts`

| Function | Type | Purpose |
|----------|------|---------|
| `insert` | mutation | Insert single event |
| `insertBatch` | mutation | Insert up to 20 events |
| `listByUser` | query | Paginated dealer timeline, optional type filter |
| `statsByUser` | query | Aggregated stats for user over date range |
| `globalStats` | query | Admin: aggregate across all users |
| `listAll` | query | Admin: paginated global timeline |
| `exportByUser` | query | Up to 5000 events for CSV |

---

## 6. Dashboard Pages

### Dealer Activity — `/[locale]/activity`

1. **Stats strip** (4 cards):
   - Total Actions (this month)
   - Searches Generated
   - Listings Created (with success rate %)
   - Bids Placed

2. **Funnel visualization** (horizontal bars, pure CSS):
   - Extraction → Search → Listing → Success
   - Conversion % between each stage

3. **Activity timeline** (filterable table):
   - Columns: Time, Type (color badge), Vehicle (brand + model), Platform, Source Link, AS24 Link, Status, Duration
   - Filter row: All | Extractions | Searches | Listings | Bids | Errors
   - "Load more" pagination

4. **CSV Export** button in page header

### Admin Activity — `/admin/activity`

1. **Global stats strip**: Total events, active users, events/day
2. **User leaderboard**: Top users by volume this period
3. **Global timeline**: Same as dealer + user email column
4. **Date range filter**: 7d / 30d / 90d buttons

### Navigation

Add "Activity" link in the dashboard header nav, next to existing billing dashboard.

---

## 7. Verification Plan

### Unit tests
- Convex functions: test insert, query with filters, pagination, stats aggregation
- Activity tracker: test queue/retry logic with mocked fetch

### E2E tests
- Navigate to FastBack, extract a car → verify extraction event appears in dashboard
- Generate AS24 URL → verify search event
- Complete manual listing → verify listing event with field results
- Export CSV → verify file downloads with correct data

### Manual verification
- Check Convex dashboard for event records after extension use
- Verify admin view shows cross-user data
- Test offline queue: disconnect, use extension, reconnect → events sync

---

## 8. Files to Create/Modify

### fast-scout-app (web app)
- `convex/schema.ts` — add `activityEvents` table
- `convex/activityEvents.ts` — **new** — queries and mutations
- `src/pages/api/extension/activity.ts` — **new** — receive events from extension
- `src/pages/api/activity.ts` — **new** — paginated query for dashboard
- `src/pages/api/activity/export.ts` — **new** — CSV export
- `src/pages/[locale]/activity.astro` — **new** — dealer dashboard
- `src/pages/admin/activity.astro` — **new** — admin dashboard

### ext-fastscout-bridge (extension)
- `src/services/activityTracker.ts` — **new** — event tracking service
- `src/background/index.ts` — add `TRACK_ACTIVITY` message handler
- `src/content/main.ts` — instrument extraction, search, bid events
- `src/content/manualListing.ts` — instrument listing completion event

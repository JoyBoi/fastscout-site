# Inline Popup Login — Design Spec

## Context

The AutoBridge extension currently requires users to click "Sign In to AutoBridge" which opens the web app in a new browser tab. Users must log in on the web, then wait for the extension to pick up the session cookie. This is friction — especially on mobile (Kiwi Browser).

**Goal:** Add an email + password login form directly inside the extension popup. No tab redirect needed. Account creation ("Sign up") still happens on the web app.

## Scope

- **In scope:** Email + password sign-in form in the extension popup
- **Out of scope:** Sign-up, forgot password, OAuth — these stay on the web app

---

## 1. New API Endpoint

### `POST /api/auth/extension-login`

**File:** `src/pages/api/auth/extension-login.ts` (fast-scout-app)

**Request:**
```json
{ "email": "user@example.com", "password": "..." }
```

**Response (success):**
```json
{ "ok": true, "email": "user@example.com", "displayName": "John" }
```
- Sets `ab_session` cookie in `Set-Cookie` header (same JWT cookie as web login)
- CORS headers for extension origin (`chrome-extension://<id>`)
- `Access-Control-Allow-Credentials: true`

**Response (error):**
```json
{ "error": "invalid_credentials" }
```

**Security:**
- Rate limited: reuse existing `token` rate limit policy (10/5min) to prevent brute force
- Input validation: email format, password non-empty
- Same bcrypt comparison as `/auth/email-signin`
- No timing leaks: same response time for "user not found" vs "wrong password"

---

## 2. Extension Popup UI

### Modified login view in `src/popup/index.html`

Replace the current login section:
```html
<!-- Current: single button -->
<button id="login-btn-main">Sign In to AutoBridge</button>
```

With:
```html
<!-- New: inline login form -->
<form id="login-form">
  <input type="email" id="login-email" placeholder="Email" required />
  <input type="password" id="login-password" placeholder="Password" required />
  <div id="login-error" style="display:none;"></div>
  <button type="submit" id="login-btn-submit">Sign In</button>
</form>
<p class="login-footer">
  No account? <a id="signup-link">Sign up</a>
</p>
```

Style: match existing popup theme (purple gradient button, clean inputs, ~320px width).

---

## 3. Extension Popup Logic

### Modified `src/popup/main.ts`

- Form submit handler:
  1. Prevent default, show loading state on button
  2. Send `chrome.runtime.sendMessage({ type: "AUTH_SIGN_IN_DIRECT", payload: { email, password } })`
  3. On success: call `checkAuthState()` to refresh UI → shows main view
  4. On error: show error message below form ("Invalid email or password")

- "Sign up" link opens web app auth page (same as current behavior):
  ```ts
  chrome.runtime.sendMessage({ type: "FS_OPEN_SIGNIN" });
  ```

---

## 4. Background Service Worker

### New handler in `src/background/index.ts`

```ts
case "AUTH_SIGN_IN_DIRECT": {
  const { email, password } = message.payload || {};
  fetch(`${SITE_URL}/api/auth/extension-login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ email, password }),
  })
    .then(async (resp) => {
      const data = await resp.json();
      if (data.ok) {
        await refreshState(); // picks up the new session cookie
        sendResponse({ success: true, email: data.email });
      } else {
        sendResponse({ success: false, error: data.error });
      }
    })
    .catch(() => sendResponse({ success: false, error: "network_error" }));
  return true; // async response
}
```

Key: `credentials: "include"` ensures the `Set-Cookie` header from the response is stored by the browser, which the existing auth flow already relies on.

---

## 5. Data Flow

```
Popup form submit
  → chrome.runtime.sendMessage("AUTH_SIGN_IN_DIRECT", { email, password })
    → Background: fetch POST /api/auth/extension-login (credentials: include)
      → Web app: validate credentials, set ab_session cookie
    ← Response: { ok: true, email }
    → Background: refreshState() (reads session, caches token)
  ← sendResponse: { success: true }
→ Popup: checkAuthState() → shows main view
```

---

## 6. Files to Create/Modify

| File | Change |
|------|--------|
| `fast-scout-app/src/pages/api/auth/extension-login.ts` | **New** — login endpoint |
| `ext-fastscout-bridge/src/popup/index.html` | **Modified** — replace button with form |
| `ext-fastscout-bridge/src/popup/main.ts` | **Modified** — add form handler |
| `ext-fastscout-bridge/src/background/index.ts` | **Modified** — add AUTH_SIGN_IN_DIRECT handler |

---

## 7. Verification

1. Open extension popup → see email + password form
2. Enter valid credentials → popup transitions to main view, shows "Signed in as..."
3. Enter invalid credentials → error message appears below form
4. Click "Sign up" → opens web app auth page in new tab
5. After popup login, extension features (extraction, search, listing) all work
6. Refresh popup → stays logged in (session cookie persists)

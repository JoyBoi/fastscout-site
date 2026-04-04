import jwt from "jsonwebtoken";
import type { AstroGlobal } from "astro";

interface SessionPayload {
  userId: string;
  email: string;
}

const COOKIE_NAME = "ab_session";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

function getJwtSecret(): string {
  const secret = import.meta.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET not configured");
  return secret;
}

function getCookieOptions(request: Request): {
  secure: boolean;
  sameSite: "lax";
  domain: string | undefined;
} {
  const url = new URL(request.url);
  const isLocalhost = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  return {
    secure: url.protocol === "https:",
    sameSite: "lax",
    domain: isLocalhost ? undefined : `.${url.hostname}`,
  };
}

/**
 * Extract and verify the session JWT from the request cookie.
 * Returns { userId, email } or null if not authenticated.
 */
export function getAuthenticatedUser(request: Request): SessionPayload | null {
  const cookieHeader = request.headers.get("cookie") ?? "";
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${COOKIE_NAME}=([^;]+)`));
  if (!match) return null;

  try {
    const payload = jwt.verify(match[1], getJwtSecret()) as SessionPayload;
    if (!payload.userId || !payload.email) return null;
    return payload;
  } catch {
    return null;
  }
}

/**
 * Set the session cookie on an Astro response.
 */
export function setSessionCookie(
  cookies: AstroGlobal["cookies"],
  request: Request,
  userId: string,
  email: string,
): void {
  const token = jwt.sign({ userId, email }, getJwtSecret(), { expiresIn: "30d" });
  const opts = getCookieOptions(request);
  cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: opts.secure,
    sameSite: opts.sameSite,
    domain: opts.domain,
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });
}

/**
 * Clear the session cookie.
 */
export function clearSessionCookie(
  cookies: AstroGlobal["cookies"],
  request: Request,
): void {
  const opts = getCookieOptions(request);
  cookies.set(COOKIE_NAME, "", {
    httpOnly: true,
    secure: opts.secure,
    sameSite: opts.sameSite,
    domain: opts.domain,
    path: "/",
    maxAge: 0,
  });
}

/**
 * Set session cookie via raw Set-Cookie header (for API routes that return Response directly).
 */
export function makeSessionCookieHeader(request: Request, userId: string, email: string): string {
  const token = jwt.sign({ userId, email }, getJwtSecret(), { expiresIn: "30d" });
  const opts = getCookieOptions(request);
  const parts = [
    `${COOKIE_NAME}=${token}`,
    `Path=/`,
    `Max-Age=${COOKIE_MAX_AGE}`,
    `HttpOnly`,
  ];
  if (opts.secure) parts.push("Secure");
  parts.push(`SameSite=Lax`);
  if (opts.domain) parts.push(`Domain=${opts.domain}`);
  return parts.join("; ");
}

export function makeClearCookieHeader(request: Request): string {
  const opts = getCookieOptions(request);
  const parts = [
    `${COOKIE_NAME}=`,
    `Path=/`,
    `Max-Age=0`,
    `HttpOnly`,
  ];
  if (opts.secure) parts.push("Secure");
  parts.push(`SameSite=Lax`);
  if (opts.domain) parts.push(`Domain=${opts.domain}`);
  return parts.join("; ");
}

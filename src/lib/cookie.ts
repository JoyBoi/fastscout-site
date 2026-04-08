export function cookieOptions(siteUrl: string): {
  path: string;
  domain?: string;
  secure: boolean;
  sameSite: "none" | "lax";
  httpOnly: boolean;
} {
  try {
    const u = new URL(siteUrl);
    const host = u.hostname;
    const isLocal = host === "localhost" || host.endsWith(".localhost") || host === "127.0.0.1";
    const isHttps = u.protocol === "https:";
    return {
      path: "/",
      domain: isLocal ? undefined : `.${host}`,
      secure: isHttps,
      sameSite: isHttps ? "none" : "lax",
      httpOnly: true,
    };
  } catch {
    return { path: "/", secure: false, sameSite: "lax", httpOnly: true };
  }
}

export function parseCookie(cookieHeader: string, name: string): string | null {
  for (const part of cookieHeader.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (k.trim() === name) return decodeURIComponent(rest.join("="));
  }
  return null;
}

import { NextResponse, type NextRequest } from "next/server";

/**
 * First gate for the CRM (edge runtime, no database): requests without a session cookie
 * never reach CRM pages or APIs. Route handlers and pages then validate the session itself.
 * Also marks every CRM response non-indexable, non-cacheable and non-frameable.
 */
const COOKIE = process.env.NODE_ENV === "production" ? "__Host-auv_crm" : "auv_crm";
const PUBLIC = new Set(["/crm/login", "/api/crm/auth/login"]);

function harden(res: NextResponse) {
  res.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
  res.headers.set("Cache-Control", "private, no-store");
  res.headers.set("X-Frame-Options", "DENY");
  res.headers.set("Referrer-Policy", "same-origin");
  res.headers.set("X-Content-Type-Options", "nosniff");
  return res;
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const hasCookie = Boolean(req.cookies.get(COOKIE)?.value);
  const isApi = pathname.startsWith("/api/crm");

  if (!hasCookie && !PUBLIC.has(pathname)) {
    if (isApi) return harden(NextResponse.json({ error: "Not signed in." }, { status: 401 }));
    const url = req.nextUrl.clone();
    url.pathname = "/crm/login";
    url.search = "";
    return harden(NextResponse.redirect(url));
  }
  return harden(NextResponse.next());
}

export const config = { matcher: ["/crm", "/crm/:path*", "/api/crm/:path*"] };

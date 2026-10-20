import { NextResponse, type NextRequest } from "next/server";

/**
 * Optimistic (not authoritative) session check: redirects requests that carry
 * no session cookie away from private areas. Real verification happens in the
 * Data Access Layer on every private render and action.
 */
const PRIVATE_PREFIXES = [
  "/",
  "/scout",
  "/applications",
  "/documents",
  "/profile",
  "/relocation",
  "/automation",
  "/settings",
];

const PUBLIC_PREFIXES = ["/login", "/privacy", "/onboarding", "/api", "/_next"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return NextResponse.next();
  }

  const isPrivate = PRIVATE_PREFIXES.some((p) =>
    p === "/" ? pathname === "/" : pathname.startsWith(p),
  );
  if (!isPrivate) {
    return NextResponse.next();
  }

  const hasSession = request.cookies.has("relocateos_session");
  if (!hasSession) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

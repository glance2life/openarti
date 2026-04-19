import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login", "/register"];
const PUBLIC_PREFIXES = ["/s/", "/join/"];

export function middleware(request: NextRequest) {
  // better-auth adds the __Secure- prefix when the cookie is issued over
  // HTTPS with Secure=true (prod), and omits it locally over HTTP.
  const session =
    request.cookies.get("__Secure-better-auth.session_token") ||
    request.cookies.get("better-auth.session_token");
  const { pathname } = request.nextUrl;
  const isPublicPath =
    PUBLIC_PATHS.includes(pathname) ||
    PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));

  // No cookie at all → redirect to login (unless already on a public path)
  if (!isPublicPath && !session) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Don't redirect public→home based on cookie alone — cookie may be stale.
  // The login page handles the redirect client-side after verifying the session.
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|assets|api).*)"],
};

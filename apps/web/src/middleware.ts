import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const session = request.cookies.get("better-auth.session_token");
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/settings") && !session) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if ((pathname === "/login" || pathname === "/register") && session) {
    return NextResponse.redirect(new URL("/settings", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/login", "/register", "/settings/:path*"],
};

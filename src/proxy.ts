import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const publicPaths = ["/sign-in", "/not-invited", "/api/auth"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (publicPaths.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return NextResponse.next();
  }
  const cookie =
    request.cookies.get("better-auth.session_token") ??
    request.cookies.get("__Secure-better-auth.session_token");
  if (!cookie) {
    const url = request.nextUrl.clone();
    url.pathname = "/sign-in";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

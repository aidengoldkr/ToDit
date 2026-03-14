import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

const LANDING_BYPASS_PARAM = "landing";

export async function middleware(request: NextRequest) {
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });

  const { pathname, searchParams } = request.nextUrl;
  const allowLandingView = searchParams.get(LANDING_BYPASS_PARAM) === "1";
  const isProtectedRoute =
    pathname.startsWith("/dashboard") || pathname.startsWith("/todo") || pathname.startsWith("/upload");

  if (!token) {
    return isProtectedRoute
      ? NextResponse.redirect(new URL("/", request.url))
      : NextResponse.next();
  }

  if (pathname === "/" && !allowLandingView) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/dashboard/:path*", "/todo/:path*", "/upload/:path*"],
};

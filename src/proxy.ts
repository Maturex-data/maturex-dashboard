import { type NextRequest, NextResponse } from "next/server";
import { ACCESS_COOKIE_NAME, verifyAccessToken } from "@/lib/jwt-service";

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 1. Bypass static assets, internal Next.js requests, public media, api auth routes, and secret-protected cron endpoints
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/cron/") ||
    pathname === "/api/ec/sheet-import/cron" ||
    pathname.startsWith("/favicon.ico") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  // 2. Read access token from cookie
  const accessToken = req.cookies.get(ACCESS_COOKIE_NAME)?.value;
  const user = accessToken ? await verifyAccessToken(accessToken) : null;

  // 3. If accessing /auth/login or /auth/register while already authenticated, redirect to /
  if (
    pathname.startsWith("/auth/login") ||
    pathname.startsWith("/auth/register")
  ) {
    if (user) {
      return NextResponse.redirect(new URL("/", req.url));
    }
    return NextResponse.next();
  }

  // 4. Handle protected API routes: return 401/403 JSON if unauthenticated or not admin
  if (pathname.startsWith("/api/")) {
    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized. Authentication required." },
        { status: 401 },
      );
    }
    if (user.role !== "admin") {
      return NextResponse.json(
        { error: "Forbidden. Admin privileges required." },
        { status: 403 },
      );
    }
    return NextResponse.next();
  }

  // 5. If not authenticated or not admin, redirect to login
  if ((!user || user.role !== "admin") && !pathname.startsWith("/auth")) {
    const loginUrl = new URL("/auth/login", req.url);
    if (pathname !== "/") {
      loginUrl.searchParams.set("callbackUrl", pathname);
    }
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (images, etc)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

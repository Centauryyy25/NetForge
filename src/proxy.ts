import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import type { Role } from "@/lib/constants";

// Public routes that don't require authentication
const publicPaths = ["/login", "/api/auth", "/api/health"];

// Role-based access control for dashboard routes
const roleAccess: Record<string, Role[]> = {
  "/settings": ["admin"],
  "/settings/users": ["admin"],
  "/reports": ["admin"],
  "/customers": ["admin", "operator"],
  "/customers/new": ["admin", "operator"],
  "/packages": ["admin", "operator"],
  "/packages/new": ["admin"],
  "/payments": ["admin", "operator"],
  "/payments/new": ["admin", "operator"],
  "/bandwidth": ["admin", "operator", "technician"],
  "/ticket": ["admin", "operator", "technician"],
  "/activity-logs": ["admin", "operator"],
};

const authProxy = auth((req) => {
  const { pathname } = req.nextUrl;
  const isAuthenticated = !!req.auth;
  const userRole = req.auth?.user?.role as Role | undefined;

  const isPublicPath = publicPaths.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  );

  // Allow static files and Next.js internals
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  // Handle unauthenticated state
  if (!isPublicPath && !isAuthenticated) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // If trying to access /login while already authenticated, redirect to home
  if (isPublicPath && isAuthenticated && pathname === "/login") {
    return NextResponse.redirect(new URL("/", req.url));
  }

  // Handle RBAC
  if (isAuthenticated && userRole && !isPublicPath) {
    let requiredRoles: Role[] | undefined;

    // Find the most specific path match for RBAC (for exact matches or prefix matches if needed)
    // Here we just do exact match, or check if the pathname starts with the protected path
    for (const [path, roles] of Object.entries(roleAccess)) {
      if (pathname === path || pathname.startsWith(`${path}/`)) {
        requiredRoles = roles;
        break;
      }
    }

    if (requiredRoles && !requiredRoles.includes(userRole)) {
      // User doesn't have permission, redirect to unauthorized page or dashboard
      return NextResponse.redirect(new URL("/", req.url));
    }
  }

  return NextResponse.next();
});

export function proxy(request: NextRequest) {
  return authProxy(request, {} as any);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon)
     * - public files (e.g. logo)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

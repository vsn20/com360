import { NextResponse } from "next/server";

// Simple function to decode JWT without verification (avoids crypto)
const decodeJwt = (token) => {
  try {
    const base64Url = token.split('.')[1]; // Get the payload part
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = Buffer.from(base64, 'base64').toString('utf8');
    return JSON.parse(jsonPayload);
  } catch (error) {
    console.log("Middleware: Error decoding JWT:", error.message);
    return null;
  }
};

export async function middleware(request) {
  const { pathname } = request.nextUrl;

  // Skip middleware for non-protected routes
  if (
    pathname.startsWith("/login") ||
    pathname.startsWith("/api") ||
    pathname === "/" ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/static")
  ) {
    console.log("Middleware: Skipping for non-protected route:", pathname);
    return NextResponse.next();
  }

  // Check if the route matches /homepage/[role]/feature (e.g., /homepage/admin/sales)
  const segments = pathname.split("/");
  if (segments.length < 3 || segments[1] !== "homepage") {
    console.log("Middleware: Route does not match /homepage/[role]:", pathname);
    return NextResponse.next();
  }

  const role = segments[2]; // e.g., "admin"
  const feature = segments.length > 3 ? segments[3] : null; // e.g., "sales" or null for /homepage/admin
  console.log("Middleware: Processing route:", pathname, "Role:", role, "Feature:", feature || "none");

  // Get the JWT token from cookies
  const token = request.cookies.get("jwt_token")?.value;
  console.log("Middleware: JWT token:", token ? "Present" : "Missing");

  if (!token) {
    console.log("Middleware: No token found, redirecting to login");
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Decode the token to get the features (no verification, avoids crypto)
  const decoded = decodeJwt(token);
  if (!decoded) {
    console.log("Middleware: Failed to decode token, redirecting to login");
    return NextResponse.redirect(new URL("/login", request.url));
  }

  console.log("Middleware: Decoded token:", decoded);

  // If the route is just /homepage/[role], allow access (no feature to check)
  if (!feature) {
    console.log("Middleware: No feature to check, proceeding to homepage");
    return NextResponse.next();
  }

  // Check if the user has access to the feature
  const features = decoded.features || [];
  const hasAccess = features.includes(`/${feature}`);
  console.log("Middleware: Features in token:", features);
  console.log("Middleware: Has access to feature", feature, ":", hasAccess);

  if (!hasAccess) {
    console.log(`Middleware: No access to feature ${feature}, redirecting to /homepage/${role}`);
    return NextResponse.redirect(new URL(`/homepage/${role}`, request.url));
  }

  console.log(`Middleware: Access granted to feature ${feature}`);
  return NextResponse.next();
}

export const config = {
  matcher: ["/homepage/:role/:path*"],
};
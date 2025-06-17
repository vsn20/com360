import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { getAllFeatures } from "./app/serverActions/getAllFeatures";

const JWT_SECRET = process.env.JWT_SECRET;

// Function to verify JWT
const verifyJwt = (token) => {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    console.log("Middleware: Error verifying JWT:", error.message);
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
    pathname.startsWith("/static") ||
    pathname.startsWith("/home") ||
    pathname.startsWith("/about") ||
    pathname.startsWith("/contact")
  ) {
    console.log("Middleware: Skipping for non-protected route:", pathname);
    return NextResponse.next();
  }

  // Handle /login route specifically
  if (pathname === "/login") {
    console.log("Middleware: Processing /login route");

    // Get the JWT token from cookies
    const token = request.cookies.get("jwt_token")?.value;
    console.log("Middleware: JWT token:", token ? "Present" : "Missing");

    if (token) {
      // Verify the token
      const decoded = verifyJwt(token);
      if (decoded && decoded.rolename) {
        const role = decoded.rolename;
        console.log("Middleware: User is logged in, redirecting to /homepage/", role);
        return NextResponse.redirect(new URL(`/homepage/${role}`, request.url));
      } else {
        console.log("Middleware: Invalid token, clearing cookie and allowing access to /login");
        const response = NextResponse.next();
        response.cookies.delete("jwt_token");
        return response;
      }
    } else {
      console.log("Middleware: No token found, allowing access to /login");
      return NextResponse.next();
    }
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

  // Verify the token
  const decoded = verifyJwt(token);
  if (!decoded) {
    console.log("Middleware: Failed to verify token, redirecting to login");
    const response = NextResponse.redirect(new URL("/login", request.url));
    response.cookies.delete("jwt_token");
    return response;
  }

  console.log("Middleware: Decoded token:", decoded);

  // If the route is just /homepage/[role], allow access (no feature to check)
  if (!feature) {
    console.log("Middleware: No feature to check, proceeding to homepage");
    return NextResponse.next();
  }

  // Fetch features dynamically
  const { success, features, error: fetchError } = await getAllFeatures();
  if (!success) {
    console.log("Middleware: Failed to fetch features:", fetchError);
    return NextResponse.redirect(new URL(`/homepage/${role}`, request.url));
  }

  // Transform features into an array of href strings
  const featureHrefs = features.map(feature => feature.href);
  console.log("Middleware: Feature hrefs:", featureHrefs);

  const hasAccess = featureHrefs.includes(`/${feature}`);
  console.log("Middleware: Has access to feature", feature, ":", hasAccess);

  if (!hasAccess) {
    console.log(`Middleware: No access to feature ${feature}, redirecting to /homepage/${role}`);
    return NextResponse.redirect(new URL(`/homepage/${role}`, request.url));
  }

  console.log(`Middleware: Access granted to feature ${feature}`);
  return NextResponse.next();
}

export const config = {
  matcher: ["/homepage/:role/:path*", "/login"],
};
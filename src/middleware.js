import { NextResponse } from "next/server";
import { jwtVerify } from "jose";

const JWT_SECRET = process.env.JWT_SECRET;

export async function middleware(request) {
  console.log("Middleware called");

  const path = request.nextUrl.pathname;
  const isPublicPath = ["/login"].includes(path);

  // Define role-specific paths
  const adminPaths = ["/admin", "/admin/:path*"];
  const employeePaths = ["/employee", "/employee/:path*"];

  const token = request.cookies.get("jwt_token")?.value;

  if (!token) {
    if (!isPublicPath) {
      console.log("No JWT token found, redirecting to /login");
      return NextResponse.redirect(new URL("/login", request.url));
    }
    return NextResponse.next();
  }

  try {
    const secret = new TextEncoder().encode(JWT_SECRET);
    const { payload } = await jwtVerify(token, secret);
    console.log("JWT token verified, user:", payload.userId, "role:", payload.roleid);

    // Attach userId and roleid to the request
    request.userId = payload.userId;
    request.roleid = payload.roleid;

    // Redirect authenticated users from /login to their respective homepage
    if (isPublicPath) {
      const redirectPath = payload.roleid === 1 ? "/admin/homepage" : "/employee/homepage";
      console.log(`User is authenticated, redirecting to ${redirectPath}`);
      return NextResponse.redirect(new URL(redirectPath, request.url));
    }

    // Authorization: Check role-based access
    const isAdmin = payload.roleid === 1;
    const isEmployee = payload.roleid === 2;

    const isAdminPath = adminPaths.some(pattern => {
      const regex = new RegExp("^" + pattern.replace(":path*", "[^/]+(/[^/]+)*") + "$");
      return regex.test(path);
    });

    const isEmployeePath = employeePaths.some(pattern => {
      const regex = new RegExp("^" + pattern.replace(":path*", "[^/]+(/[^/]+)*") + "$");
      return regex.test(path);
    });

    // Restrict access to /admin/homepage and /employee/homepage based on role
    if (path === "/admin/homepage" && !isAdmin) {
      console.log("Unauthorized: Non-admin user tried to access /admin/homepage");
      return NextResponse.redirect(new URL("/employee/homepage", request.url));
    }

    if (path === "/employee/homepage" && !isEmployee) {
      console.log("Unauthorized: Non-employee user tried to access /employee/homepage");
      return NextResponse.redirect(new URL("/admin/homepage", request.url));
    }

    // Restrict other admin and employee paths
    if (isAdminPath && !isAdmin && path !== "/admin/homepage") {
      console.log("Unauthorized: Non-admin user tried to access admin route");
      return NextResponse.redirect(new URL("/employee/homepage", request.url));
    }

    if (isEmployeePath && !isEmployee && path !== "/employee/homepage") {
      console.log("Unauthorized: Non-employee user tried to access employee route");
      return NextResponse.redirect(new URL("/admin/homepage", request.url));
    }

    return NextResponse.next();
  } catch (error) {
    console.log("Invalid JWT token:", error.message);
    const response = NextResponse.redirect(new URL("/login", request.url));
    response.cookies.delete("jwt_token");
    return response;
  }
}

export const config = {
  matcher: ["/login", "/admin/:path*", "/employee/:path*"],
};
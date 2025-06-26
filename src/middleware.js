import { NextResponse } from 'next/server';

export async function middleware(request) {
  console.log("Middleware called for path:", request.nextUrl.pathname);

  // Define public paths that don't require authentication (Navbar pages)
  const publicPaths = [
    '/',
    '/about',
    '/jobs',
    '/features',
    '/pricing',
    '/contact',
    '/support',
    '/docs',
    '/login',
    '/register',
    '/jobs/jobslogin'

  ];

  const { pathname } = request.nextUrl;

  // Get the token from cookies
  const token = request.cookies.get('jwt_token')?.value;

  // If no token, allow public paths and redirect protected paths to /login
  if (!token) {
    if (publicPaths.includes(pathname)) {
      console.log(`No token: Public path accessed: ${pathname}`);
      return NextResponse.next();
    }
    console.log("No token found, redirecting to login");
    return NextResponse.redirect(new URL('/login', request.url));
  }

  try {
    // Handle public paths (except /login) for authenticated users
    if (publicPaths.includes(pathname) && pathname !== '/login') {
      console.log(`Authenticated user attempting to access restricted public path: ${pathname}`);
      const verifyResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/verify-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: `jwt_token=${token}`,
        },
        body: JSON.stringify({ token }), // No pathname to get accessibleItems
      });

      const result = await verifyResponse.json();

      if (verifyResponse.ok && result.success && result.accessibleItems) {
        const redirectPath = result.accessibleItems.length > 0 ? result.accessibleItems[0].href : '/userscreens';
        console.log(`Authenticated user redirected from ${pathname} to ${redirectPath}`);
        return NextResponse.redirect(new URL(redirectPath, request.url));
      }
      // If token is invalid, allow access to public path
      console.log(`Invalid token, allowing access to ${pathname}`);
      return NextResponse.next();
    }

    // Allow /login for authenticated users
    if (pathname === '/login') {
      console.log(`Authenticated user accessing /login`);
      return NextResponse.next();
    }

    // Handle protected paths
    const verifyResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/verify-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `jwt_token=${token}`,
      },
      body: JSON.stringify({ token, pathname }),
    });

    const result = await verifyResponse.json();

    if (!verifyResponse.ok || result.error) {
      console.log(`Access denied: ${result.error}`);
      if (verifyResponse.status === 403 && result.error === 'Access denied' && result.accessibleItems) {
        const redirectPath = result.accessibleItems.length > 0 ? result.accessibleItems[0].href : '/userscreens';
        console.log(`Redirecting to least priority path ${redirectPath} for inaccessible path: ${pathname}`);
        return NextResponse.redirect(new URL(redirectPath, request.url));
      }
      console.log(`Redirecting to /login for path: ${pathname}`);
      return NextResponse.redirect(new URL('/login', request.url));
    }

    console.log(`Access granted to ${pathname}`);
    return NextResponse.next();
  } catch (error) {
    console.error("Middleware error:", error.message);
    return NextResponse.redirect(new URL('/login', request.url));
  }
}

export const config = {
  matcher: [
    // Match all paths except:
    // - API routes
    // - Next.js internal static/image/favicon files
    // - .well-known paths (to avoid DevTools-related errors)
    '/((?!api|_next/static|_next/image|favicon.ico|.well-known).*)',
  ],
};

import { NextResponse } from 'next/server';

export async function middleware(request) {
  console.log("Middleware called for path:", request.nextUrl.pathname);

  // Define public paths that don't require authentication
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
    '/jobs/jobslogin',
  ];

  // Define paths that only require authentication (not role-based permissions)
  const authenticatedPaths = ['/uploads/:path*']; // Allow /uploads/... for authenticated users

  const { pathname } = request.nextUrl;

  // Get the token from cookies
  const token = request.cookies.get('jwt_token')?.value;

  // Allow public paths without a token
  if (!token) {
    if (publicPaths.includes(pathname)) {
      console.log(`No token: Public path accessed: ${pathname}`);
      return NextResponse.next();
    }
    console.log("No token found, redirecting to login");
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Check if the path matches /uploads/...
  const isUploadPath = pathname.match(/^\/uploads\/.+/);
  if (isUploadPath) {
    console.log(`Authenticated user accessing upload path: ${pathname}`);
    // Verify token to ensure user is authenticated
    try {
      const verifyResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/verify-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: `jwt_token=${token}`,
        },
        body: JSON.stringify({ token }), // No pathname needed for /uploads/...
      });

      const result = await verifyResponse.json();
      if (verifyResponse.ok && result.success) {
        console.log(`Access granted to ${pathname} for authenticated user`);
        return NextResponse.next();
      }
      console.log(`Invalid token for ${pathname}, redirecting to login`);
      return NextResponse.redirect(new URL('/login', request.url));
    } catch (error) {
      console.error(`Error verifying token for ${pathname}:`, error.message);
      return NextResponse.redirect(new URL('/login', request.url));
    }
  }

  // Handle public paths (except /login) for authenticated users
  if (publicPaths.includes(pathname) && pathname !== '/login') {
    console.log(`Authenticated user attempting to access restricted public path: ${pathname}`);
    const verifyResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/verify-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `jwt_token=${token}`,
      },
      body: JSON.stringify({ token }),
    });

    const result = await verifyResponse.json();

    if (verifyResponse.ok && result.success && result.accessibleItems) {
      const redirectPath = result.accessibleItems.length > 0 ? result.accessibleItems[0].href : '/userscreens';
      console.log(`Authenticated user redirected from ${pathname} to ${redirectPath}`);
      return NextResponse.redirect(new URL(redirectPath, request.url));
    }
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
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|.well-known).*)',
  ],
};

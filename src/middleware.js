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

  const { pathname } = request.nextUrl;

  // Handle resume paths (/uploads/resumes/*)
  const isResumePath = pathname.match(/^\/uploads\/resumes\/(.+)_(.+)_(.+\.pdf)$/);
  if (isResumePath) {
    const jobToken = request.cookies.get('job_jwt_token')?.value;
    if (!jobToken) {
      console.log("No job_jwt_token found for resume path, redirecting to jobs login");
      return NextResponse.redirect(new URL('/jobs/jobslogin', request.url));
    }

    try {
      const verifyResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/jobs/verify-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: `job_jwt_token=${jobToken}`,
        },
        body: JSON.stringify({ token: jobToken }),
      });

      const result = await verifyResponse.json();
      console.log('Verify Token Response for resume path:', result); // Debug

      if (verifyResponse.ok && result.success) {
        const candidate_id = result.user?.cid; // Extract cid from result.user
        const resumeCandidateId = isResumePath[1]; // Extract candidate_id from filename

        if (!candidate_id) {
          console.log('No candidate_id found in verify-token response');
          return new Response(JSON.stringify({ error: 'Unauthorized: Invalid token response' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        if (candidate_id.toString() !== resumeCandidateId) {
          console.log(`Unauthorized: candidate_id ${candidate_id} does not match resume candidate_id ${resumeCandidateId}`);
          return new Response(JSON.stringify({ error: 'Unauthorized: Cannot access another candidate\'s resume' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        console.log(`Access granted to resume path ${pathname} for candidate_id ${candidate_id}`);
        return NextResponse.next();
      }

      console.log("Invalid job_jwt_token for resume path, redirecting to jobs login");
      return NextResponse.redirect(new URL('/jobs/jobslogin', request.url));
    } catch (error) {
      console.error('Error verifying job_jwt_token for resume path:', error.message);
      return NextResponse.redirect(new URL('/jobs/jobslogin', request.url));
    }
  }

  // Special handling for job candidate paths
  const isJobCandidatePath = pathname.startsWith('/jobs/jobapplications') || pathname.startsWith('/jobs/apply/');
  if (isJobCandidatePath) {
    const jobToken = request.cookies.get('job_jwt_token')?.value;

    if (!jobToken) {
      console.log("No job_jwt_token found for job candidate path, redirecting to jobs login");
      return NextResponse.redirect(new URL('/jobs/jobslogin', request.url));
    }

    try {
      const verifyResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/jobs/verify-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: `job_jwt_token=${jobToken}`,
        },
        body: JSON.stringify({ token: jobToken }),
      });

      const result = await verifyResponse.json();

      if (verifyResponse.ok && result.success) {
        console.log("Job token verified, access granted to:", pathname);
        return NextResponse.next();
      }

      console.log("Invalid job_jwt_token, redirecting to jobs login");
      return NextResponse.redirect(new URL('/jobs/jobslogin', request.url));
    } catch (error) {
      console.error("Error verifying job_jwt_token:", error.message);
      return NextResponse.redirect(new URL('/jobs/jobslogin', request.url));
    }
  }

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

  // Check if the path matches /uploads/... (excluding /uploads/resumes/*)
  const isUploadPath = pathname.match(/^\/Uploads\/(?!resumes\/).+/);
  if (isUploadPath) {
    console.log(`Authenticated user accessing upload path: ${pathname}`);
    try {
      const verifyResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/verify-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: `jwt_token=${token}`,
        },
        body: JSON.stringify({ token }),
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
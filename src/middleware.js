import { NextResponse } from 'next/server';

// Function to decode JWT (server-side, reused from your layout)
const decodeJwt = (token) => {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = Buffer.from(base64, 'base64').toString('utf8');
    return JSON.parse(jsonPayload);
  } catch (error) {
    console.error('Error decoding JWT:', error);
    return null;
  }
};

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

  // Handle org logo paths (/uploads/orglogos/:orgid.jpg)
  const isOrgLogoPath = pathname.match(/^\/uploads\/orglogos\/(\d+)\.jpg$/);
  if (isOrgLogoPath) {
    const requestedOrgId = isOrgLogoPath[1]; // Extract orgid from path
    const token = request.cookies.get('jwt_token')?.value;

    if (!token) {
      console.log("No jwt_token found for org logo path, redirecting to login");
      return NextResponse.redirect(new URL('/login', request.url));
    }

    try {
      // Decode JWT to get user details
      const decoded = decodeJwt(token);
      if (!decoded || !decoded.orgid) {
        console.log("Invalid or missing orgid in JWT for org logo path, redirecting to login");
        return NextResponse.redirect(new URL('/login', request.url));
      }

      const userOrgId = decoded.orgid.toString();
      if (userOrgId === requestedOrgId) {
        console.log(`Access granted to org logo path ${pathname} for orgid ${userOrgId}`);
        return NextResponse.next();
      } else {
        console.log(`Unauthorized: User orgid ${userOrgId} does not match requested orgid ${requestedOrgId}`);
        return new Response(JSON.stringify({ error: 'Unauthorized: Cannot access another organization\'s logo' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    } catch (error) {
      console.error('Error verifying JWT for org logo path:', error.message);
      return NextResponse.redirect(new URL('/login', request.url));
    }
  }

  // Handle resume paths (/uploads/resumes/applicationid_date.pdf)
  const isResumePath = pathname.match(/^\/Uploads\/resumes\/(.+)_(.+)\.pdf$/);
  if (isResumePath) {
    const applicationId = isResumePath[1]; // Extract applicationid from path
    const jobToken = request.cookies.get('job_jwt_token')?.value;
    
    if (!jobToken) {
      console.log("No job_jwt_token found for resume path, redirecting to jobs login");
      return NextResponse.redirect(new URL('/jobs/jobslogin', request.url));
    }

    try {
      // Verify the job token first
      const verifyResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/jobs/verify-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: `job_jwt_token=${jobToken}`,
        },
        body: JSON.stringify({ token: jobToken }),
      });

      const result = await verifyResponse.json();
      console.log('Verify Token Response for resume path:', result);

      if (verifyResponse.ok && result.success) {
        const candidate_id = result.user?.cid;

        if (!candidate_id) {
          console.log('No candidate_id found in verify-token response');
          return new Response(JSON.stringify({ error: 'Unauthorized: Invalid token response' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        // Use API route to verify resume access
        try {
          const verifyResumeResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/jobs/verify-resume-access`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
              applicationId: applicationId,
              token: jobToken 
            }),
          });

          const verifyResult = await verifyResumeResponse.json();

          if (!verifyResumeResponse.ok) {
            console.log(`Resume access verification failed: ${verifyResult.error}`);
            return new Response(JSON.stringify({ error: `Unauthorized: ${verifyResult.error}` }), {
              status: verifyResumeResponse.status,
              headers: { 'Content-Type': 'application/json' },
            });
          }

          console.log(`Access granted to resume path ${pathname} for candidate_id ${candidate_id} and applicationid ${applicationId}`);
          return NextResponse.next();

        } catch (apiError) {
          console.error('Error verifying resume access:', apiError.message);
          return new Response(JSON.stringify({ error: 'Internal server error' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          });
        }
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

  // Check if the path matches /uploads/... (excluding /uploads/resumes/* and /uploads/orglogos/*)
  const isUploadPath = pathname.match(/^\/Uploads\/(?!resumes\/|orglogos\/).+/);
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
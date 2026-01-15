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
  // console.log("Middleware called for path:", request.nextUrl.pathname);

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
    '/FeePayment',
    '/Subscriber/SubscribeSignup',
    '/FeePayment/ProFeepayment',
    '/Subscriber/ProSubscribeSignup',
    '/FeePayment/GrowthFeePayment',
    '/Subscriber/GrowthSubscribeSignup',
    '/FeePayment/EnterpriseFeePayment',
    '/Subscriber/EnterpriseSubscribeSignup',
    '/COM360LOGOS.jpg', 
  ];

  const { pathname } = request.nextUrl;

  // Allow logo path for everyone without any checks
  if (pathname === '/COM360LOGOS.jpg') {
    return NextResponse.next();
  }

  // -----------------------------------------------------------------------------
  // 1. Handle Lead Assignment Resumes
  // -----------------------------------------------------------------------------
  const isLeadResumePath = pathname.match(/^\/files\/leads_assignment\/resumes\/(\d+)_.+$/);
  if (isLeadResumePath) {
    const fileOrgId = isLeadResumePath[1]; 
    const token = request.cookies.get('jwt_token')?.value;

    console.log('Lead Assignment Resume path detected:', pathname);

    if (!token) {
      console.log("No token for Lead Resume, redirecting");
      return NextResponse.redirect(new URL('/login', request.url));
    }

    try {
      const decoded = decodeJwt(token);
      if (!decoded || !decoded.orgid) {
        return NextResponse.redirect(new URL('/login', request.url));
      }

      if (parseInt(decoded.orgid) === parseInt(fileOrgId)) {
        return NextResponse.next(); 
      } else {
        console.log(`Unauthorized: Org mismatch for Lead Resume. User: ${decoded.orgid}, File: ${fileOrgId}`);
        return new Response(JSON.stringify({ error: 'Unauthorized: Cannot access files from another organization' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    } catch (error) {
      console.error('Error verifying Lead Resume access:', error);
      return NextResponse.redirect(new URL('/login', request.url));
    }
  }

  // -----------------------------------------------------------------------------
  // 2. Handle expense attachment paths
  // -----------------------------------------------------------------------------
  const isExpensePath = pathname.match(/^\/uploads\/expenses\/expense_(.+)_(\d+)\.(jpg|jpeg|png|pdf|gif)$/i);
  if (isExpensePath) {
    const expenseId = isExpensePath[1]; 
    const token = request.cookies.get('jwt_token')?.value;

    if (!token) return NextResponse.redirect(new URL('/login', request.url));

    try {
      const decoded = decodeJwt(token);
      if (!decoded || !decoded.orgid || !decoded.empid) {
        return NextResponse.redirect(new URL('/login', request.url));
      }

      const verifyResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/expenses/verify-attachment-access`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: `jwt_token=${token}` },
        body: JSON.stringify({ token, expenseId, orgid: decoded.orgid, empid: decoded.empid }),
      });

      const result = await verifyResponse.json();
      if (verifyResponse.ok && result.success) return NextResponse.next();
      
      return new Response(JSON.stringify({ error: result.error || 'Unauthorized' }), { status: 403 });
    } catch (error) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
  }

  // -----------------------------------------------------------------------------
  // 3. Handle Service Request attachment paths
  // -----------------------------------------------------------------------------
  const isServiceRequestPath = pathname.match(/^\/uploads\/ServiceRequests\/.+$/i);
  if (isServiceRequestPath) {
    const token = request.cookies.get('jwt_token')?.value;
    if (!token) return NextResponse.redirect(new URL('/login', request.url));

    try {
      const decoded = decodeJwt(token);
      if (!decoded || !decoded.orgid) return NextResponse.redirect(new URL('/login', request.url));

      const verifyResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/verify-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: `jwt_token=${token}` },
        body: JSON.stringify({ token, pathname }),
      });

      const result = await verifyResponse.json();
      if (verifyResponse.ok && result.success) return NextResponse.next();

      return new Response(JSON.stringify({ error: result.error || 'Unauthorized' }), { status: 403 });
    } catch (error) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
  }

  // -----------------------------------------------------------------------------
  // 4. Handle Invoice attachment paths
  // -----------------------------------------------------------------------------
  const isInvoicePath = pathname.match(/^\/uploads\/Invoices\/(\d+)_.+$/i);
  if (isInvoicePath) {
    const fileOrgId = isInvoicePath[1];
    const token = request.cookies.get('jwt_token')?.value;

    if (!token) return NextResponse.redirect(new URL('/login', request.url));

    try {
      const decoded = decodeJwt(token);
      if (!decoded || !decoded.orgid) return NextResponse.redirect(new URL('/login', request.url));

      if (parseInt(fileOrgId) === parseInt(decoded.orgid)) {
        return NextResponse.next();
      } else {
        return new Response(JSON.stringify({ error: 'Unauthorized Org' }), { status: 403 });
      }
    } catch (error) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
  }

  // -----------------------------------------------------------------------------
  // 5. Handle signature paths
  // -----------------------------------------------------------------------------
  const isSignaturePath = pathname.match(/^\/signatures\/form_(\d+)_(employee|employer)\.(png|svg)$/);
  if (isSignaturePath) {
    const formId = isSignaturePath[1];
    const token = request.cookies.get('jwt_token')?.value;

    if (!token) return NextResponse.redirect(new URL('/login', request.url));

    try {
      const decoded = decodeJwt(token);
      if (!decoded || !decoded.orgid) return NextResponse.redirect(new URL('/login', request.url));

      const verifyResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/verify-signature-access`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: `jwt_token=${token}` },
        body: JSON.stringify({ token, formId, orgid: decoded.orgid, empid: decoded.empid }),
      });

      const result = await verifyResponse.json();
      if (verifyResponse.ok && result.success) return NextResponse.next();
      
      return new Response(JSON.stringify({ error: result.error || 'Unauthorized' }), { status: 403 });
    } catch (error) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
  }

  // -----------------------------------------------------------------------------
  // 6. Handle org logo paths
  // -----------------------------------------------------------------------------
  const isOrgLogoPath = pathname.match(/^\/uploads\/orglogos\/(\d+)\.jpg$/);
  if (isOrgLogoPath) {
    const requestedOrgId = isOrgLogoPath[1];
    const token = request.cookies.get('jwt_token')?.value;

    if (!token) return NextResponse.redirect(new URL('/login', request.url));

    try {
      const decoded = decodeJwt(token);
      if (!decoded || !decoded.orgid) return NextResponse.redirect(new URL('/login', request.url));

      if (decoded.orgid.toString() === requestedOrgId) return NextResponse.next();
      
      return new Response(JSON.stringify({ error: 'Unauthorized Org Logo' }), { status: 403 });
    } catch (error) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
  }

  // -----------------------------------------------------------------------------
  // 7. Handle offer letter paths
  // -----------------------------------------------------------------------------
  const isOfferLetterPath = pathname.match(/^\/uploads\/offerletter\/(.+)_(.+)\.pdf$/);
  if (isOfferLetterPath) {
    const applicationId = isOfferLetterPath[1];
    const jwtToken = request.cookies.get('jwt_token')?.value;
    const authHeader = request.headers.get('authorization');
    const headerToken = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

    if (!jwtToken && !headerToken) return NextResponse.redirect(new URL('/login', request.url));

    try {
      const tokenToUse = jwtToken || headerToken;
      const verifyResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/verify-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: jwtToken ? `jwt_token=${jwtToken}` : '' },
        body: JSON.stringify({ token: tokenToUse, pathname }),
      });

      const result = await verifyResponse.json();
      if (verifyResponse.ok && result.success) {
        const decoded = decodeJwt(tokenToUse);
        if (decoded && decoded.orgid) {
          const appIdOrgPrefix = parseInt(applicationId.split('-')[0]);
          if (appIdOrgPrefix === parseInt(decoded.orgid)) return NextResponse.next();
        }
        return new Response(JSON.stringify({ error: 'Unauthorized: Invalid token data' }), { status: 401 });
      }
      return NextResponse.redirect(new URL('/login', request.url));
    } catch (error) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
  }

  // -----------------------------------------------------------------------------
  // 8. Handle Resume paths (General)
  // -----------------------------------------------------------------------------
  const isResumePath = pathname.match(/^\/uploads\/resumes\/(.+)_(.+)\.pdf$/);
  if (isResumePath) {
    const applicationId = isResumePath[1];
    const jwtToken = request.cookies.get('jwt_token')?.value;
    const jobToken = request.cookies.get('job_jwt_token')?.value;
    const authHeader = request.headers.get('authorization');
    const headerToken = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

    if (!jwtToken && !jobToken && !headerToken) return NextResponse.redirect(new URL('/login', request.url));

    try {
      if (jwtToken || (headerToken && !jobToken)) {
        const tokenToUse = jwtToken || headerToken;
        const verifyResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/verify-token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Cookie: jwtToken ? `jwt_token=${jwtToken}` : '' },
          body: JSON.stringify({ token: tokenToUse, pathname }),
        });

        const result = await verifyResponse.json();
        if (verifyResponse.ok && result.success) {
          const decoded = decodeJwt(tokenToUse);
          if (decoded && decoded.orgid) {
            const appIdOrgPrefix = parseInt(applicationId.split('-')[0]);
            if (appIdOrgPrefix === parseInt(decoded.orgid)) return NextResponse.next();
          }
          return new Response(JSON.stringify({ error: 'Unauthorized: Invalid token data' }), { status: 401 });
        }
        return NextResponse.redirect(new URL('/login', request.url));
      } else if (jobToken || headerToken) {
        const tokenToUse = jobToken || headerToken;
        const verifyResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/jobs/verify-resume-access`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Cookie: jobToken ? `job_jwt_token=${jobToken}` : '' },
          body: JSON.stringify({ token: tokenToUse, applicationId }),
        });
        const result = await verifyResponse.json();
        if (verifyResponse.ok && result.success) return NextResponse.next();
        return new Response(JSON.stringify({ error: result.error || 'Unauthorized' }), { status: 401 });
      }
    } catch (error) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
  }

  // -----------------------------------------------------------------------------
  // 9. Handle Job Candidate Paths
  // -----------------------------------------------------------------------------
  const isJobCandidatePath = pathname.startsWith('/jobs/jobapplications') || pathname.startsWith('/jobs/apply/');
  if (isJobCandidatePath) {
    const jobToken = request.cookies.get('job_jwt_token')?.value;
    if (!jobToken) return NextResponse.redirect(new URL('/jobs/jobslogin', request.url));

    try {
      const verifyResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/jobs/verify-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: `job_jwt_token=${jobToken}` },
        body: JSON.stringify({ token: jobToken }),
      });
      const result = await verifyResponse.json();
      if (verifyResponse.ok && result.success) return NextResponse.next();
      return NextResponse.redirect(new URL('/jobs/jobslogin', request.url));
    } catch (error) {
      return NextResponse.redirect(new URL('/jobs/jobslogin', request.url));
    }
  }

  // -----------------------------------------------------------------------------
  // 10. Handle Project Detail Paths (/userscreens/projects/[projectId])
  // -----------------------------------------------------------------------------
  // UPDATED: Changed regex from /projects/ to /userscreens/projects/
  const isProjectDetailPath = pathname.match(/^\/userscreens\/project\/overview\/[^\/]+$/);
  if (isProjectDetailPath) {
    const token = request.cookies.get('jwt_token')?.value;
    if (!token) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
    
    try {
      const verifyResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/verify-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: `jwt_token=${token}` },
        // Maps the dynamic project path to the generic permission key
        body: JSON.stringify({ token, pathname: '/userscreens/project/overview' }),
      });
      
      const result = await verifyResponse.json();
      if (verifyResponse.ok && result.success) {
        return NextResponse.next();
      }
      return NextResponse.redirect(new URL('/login', request.url));
    } catch (error) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
  }

  // -----------------------------------------------------------------------------
  // 11. General Page Authentication Fallback
  // -----------------------------------------------------------------------------
  const token = request.cookies.get('jwt_token')?.value;

  if (!token) {
    if (publicPaths.includes(pathname)) return NextResponse.next();
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Handle generic uploads path
  const isUploadPath = pathname.match(/^\/uploads\/(?!resumes\/|orglogos\/).+/);
  if (isUploadPath) {
    try {
      const verifyResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/verify-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: `jwt_token=${token}` },
        body: JSON.stringify({ token }),
      });
      const result = await verifyResponse.json();
      if (verifyResponse.ok && result.success) return NextResponse.next();
      return NextResponse.redirect(new URL('/login', request.url));
    } catch (error) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
  }

  // Allow public paths (except login) for auth users
  if (publicPaths.includes(pathname) && pathname !== '/login') {
    const verifyResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/verify-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: `jwt_token=${token}` },
      body: JSON.stringify({ token }),
    });
    const result = await verifyResponse.json();
    if (verifyResponse.ok && result.success && result.accessibleItems) {
      const redirectPath = result.accessibleItems.length > 0 ? result.accessibleItems[0].href : '/userscreens';
      return NextResponse.redirect(new URL(redirectPath, request.url));
    }
    return NextResponse.next();
  }

  if (pathname === '/login') return NextResponse.next();

  // Verify generic pages
  const verifyResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/verify-token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: `jwt_token=${token}` },
    body: JSON.stringify({ token, pathname }),
  });

  const result = await verifyResponse.json();

  if (!verifyResponse.ok || result.error) {
    if (verifyResponse.status === 403 && result.error === 'Access denied' && result.accessibleItems) {
      const redirectPath = result.accessibleItems.length > 0 ? result.accessibleItems[0].href : '/userscreens';
      return NextResponse.redirect(new URL(redirectPath, request.url));
    }
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|.well-known|pdf\\.worker\\.min\\.mjs).*)',
  ],
};
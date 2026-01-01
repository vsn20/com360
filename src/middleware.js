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
  console.log("All cookies:", Object.fromEntries(request.cookies.getAll().map(c => [c.name, c.value])));

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
    '/COM360LOGOS.jpg', // Add logo path
  ];

  const { pathname } = request.nextUrl;

  // Allow logo path for everyone without any checks
  if (pathname === '/COM360LOGOS.jpg') {
    console.log(`Logo path accessed: ${pathname} - allowing unrestricted access`);
    return NextResponse.next();
  }

  // Handle expense attachment paths (/uploads/expenses/expense_EXP-xxx_timestamp.ext)
  const isExpensePath = pathname.match(/^\/uploads\/expenses\/expense_(.+)_(\d+)\.(jpg|jpeg|png|pdf|gif)$/i);
  if (isExpensePath) {
    const expenseId = isExpensePath[1]; // Extract expense ID from filename
    const token = request.cookies.get('jwt_token')?.value;

    console.log('Expense attachment path detected:', pathname);
    console.log('Extracted expense ID from filename:', expenseId);

    if (!token) {
      console.log("No jwt_token found for expense attachment path, redirecting to login");
      return NextResponse.redirect(new URL('/login', request.url));
    }

    try {
      const decoded = decodeJwt(token);
      if (!decoded || !decoded.orgid || !decoded.empid) {
        console.log("Invalid or missing orgid/empid in JWT for expense attachment path, redirecting to login");
        return NextResponse.redirect(new URL('/login', request.url));
      }

      // Verify the user has access to this expense attachment
      const verifyResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/expenses/verify-attachment-access`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: `jwt_token=${token}`,
        },
        body: JSON.stringify({ 
          token, 
          expenseId,
          orgid: decoded.orgid,
          empid: decoded.empid
        }),
      });

      const result = await verifyResponse.json();
      console.log('Verify Attachment Access Response:', result);

      if (verifyResponse.ok && result.success) {
        console.log(`Access granted to expense attachment ${pathname}`);
        return NextResponse.next();
      } else {
        console.log(`Access denied to expense attachment ${pathname}: ${result.error}`);
        return new Response(JSON.stringify({ error: result.error || 'Unauthorized: Cannot access this expense attachment' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    } catch (error) {
      console.error('Error verifying JWT for expense attachment path:', error.message);
      return NextResponse.redirect(new URL('/login', request.url));
    }
  }

  // Handle signature paths (/signatures/form_:formId_:type.png or .svg)
  const isSignaturePath = pathname.match(/^\/signatures\/form_(\d+)_(employee|employer)\.(png|svg)$/);
  if (isSignaturePath) {
    const formId = isSignaturePath[1]; // Extract form ID from filename
    const token = request.cookies.get('jwt_token')?.value;

    console.log('Signature path detected:', pathname);
    console.log('Extracted form ID from filename:', formId);

    if (!token) {
      console.log("No jwt_token found for signature path, redirecting to login");
      return NextResponse.redirect(new URL('/login', request.url));
    }

    try {
      const decoded = decodeJwt(token);
      if (!decoded || !decoded.orgid || !decoded.empid) {
        console.log("Invalid or missing orgid/empid in JWT for signature path, redirecting to login");
        return NextResponse.redirect(new URL('/login', request.url));
      }

      // Verify the user has access to this signature by checking form ownership
      const verifyResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/verify-signature-access`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: `jwt_token=${token}`,
        },
        body: JSON.stringify({ 
          token, 
          formId,
          orgid: decoded.orgid,
          empid: decoded.empid
        }),
      });

      const result = await verifyResponse.json();
      console.log('Verify Signature Access Response:', result);

      if (verifyResponse.ok && result.success) {
        console.log(`Access granted to signature ${pathname}`);
        return NextResponse.next();
      } else {
        console.log(`Access denied to signature ${pathname}: ${result.error}`);
        return new Response(JSON.stringify({ error: result.error || 'Unauthorized: Cannot access this signature' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    } catch (error) {
      console.error('Error verifying JWT for signature path:', error.message);
      return NextResponse.redirect(new URL('/login', request.url));
    }
  }

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

  // Handle offer letter paths (/uploads/offerletter/:applicationid_:timestamp.pdf)
  const isOfferLetterPath = pathname.match(/^\/uploads\/offerletter\/(.+)_(.+)\.pdf$/);
  if (isOfferLetterPath) {
    const applicationId = isOfferLetterPath[1]; // Extract applicationid from path
    const jwtToken = request.cookies.get('jwt_token')?.value;
    const authHeader = request.headers.get('authorization'); // Check for Authorization header
    const headerToken = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

    console.log('Offer letter path detected:', pathname);
    console.log('jwt_token:', jwtToken || 'not found');
    console.log('Authorization header token:', headerToken || 'not found');

    if (!jwtToken && !headerToken) {
      console.log("No jwt_token or Authorization header found for offer letter path, redirecting to login");
      return NextResponse.redirect(new URL('/login', request.url));
    }

    try {
      const tokenToUse = jwtToken || headerToken;
      console.log(`Verifying jwt_token for offer letter path with applicationId: ${applicationId}`);
      const verifyResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/verify-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: jwtToken ? `jwt_token=${jwtToken}` : '',
        },
        body: JSON.stringify({ token: tokenToUse, pathname }),
      });

      const result = await verifyResponse.json();
      console.log('Verify Token Response for offer letter path:', result);

      if (verifyResponse.ok && result.success) {
        const decoded = decodeJwt(tokenToUse);
        if (decoded && decoded.orgid) {
          // ✅ FIX: Split application ID by '-' to check full Org ID prefix (e.g. 39 from 39-1)
          const appIdOrgPrefix = parseInt(applicationId.split('-')[0]);
          
          if (appIdOrgPrefix === parseInt(decoded.orgid)) {
            console.log(`Access granted to offer letter path ${pathname} for orgid ${decoded.orgid} and applicationId ${applicationId}`);
            return NextResponse.next();
          } else {
            console.log(`Access denied to ${pathname} for orgid ${decoded.orgid} (orgid mismatch with ${appIdOrgPrefix})`);
            return new Response(JSON.stringify({ error: 'Unauthorized: orgid mismatch' }), {
              status: 403,
              headers: { 'Content-Type': 'application/json' },
            });
          }
        }
        console.log('No orgid in decoded token for offer letter path');
        return new Response(JSON.stringify({ error: 'Unauthorized: Invalid token data' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      console.log("Invalid jwt_token for offer letter path, redirecting to login");
      return NextResponse.redirect(new URL('/login', request.url));
    } catch (error) {
      console.error('Error verifying token for offer letter path:', error.message);
      return NextResponse.redirect(new URL('/login', request.url));
    }
  }

  // Handle resume paths (/uploads/resumes/:applicationid_:timestamp.pdf)
  const isResumePath = pathname.match(/^\/uploads\/resumes\/(.+)_(.+)\.pdf$/);
  if (isResumePath) {
    const applicationId = isResumePath[1]; // Extract applicationid from path
    const jwtToken = request.cookies.get('jwt_token')?.value;
    const jobToken = request.cookies.get('job_jwt_token')?.value;
    const authHeader = request.headers.get('authorization'); // Check for Authorization header
    const headerToken = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

    console.log('Resume path detected:', pathname);
    console.log('jwt_token:', jwtToken || 'not found');
    console.log('job_jwt_token:', jobToken || 'not found');
    console.log('Authorization header token:', headerToken || 'not found');

    if (!jwtToken && !jobToken && !headerToken) {
      console.log("No jwt_token, job_jwt_token, or Authorization header found for resume path, redirecting to login");
      return NextResponse.redirect(new URL('/login', request.url));
    }

    try {
      // Prioritize jwt_token for organization users
      if (jwtToken || (headerToken && !jobToken)) {
        const tokenToUse = jwtToken || headerToken;
        console.log(`Verifying jwt_token for resume path with applicationId: ${applicationId}`);
        const verifyResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/verify-token`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Cookie: jwtToken ? `jwt_token=${jwtToken}` : '',
          },
          body: JSON.stringify({ token: tokenToUse, pathname }),
        });

        const result = await verifyResponse.json();
        console.log('Verify Token Response for resume path:', result);

        if (verifyResponse.ok && result.success) {
          const decoded = decodeJwt(tokenToUse);
          if (decoded && decoded.orgid) {
            // ✅ FIX: Split application ID by '-' to check full Org ID prefix
            const appIdOrgPrefix = parseInt(applicationId.split('-')[0]);
            
            if (appIdOrgPrefix === parseInt(decoded.orgid)) {
              console.log(`Access granted to resume path ${pathname} for orgid ${decoded.orgid} and applicationId ${applicationId}`);
              return NextResponse.next();
            } else {
              console.log(`Access denied to ${pathname} for orgid ${decoded.orgid} (orgid mismatch with ${appIdOrgPrefix})`);
              return new Response(JSON.stringify({ error: 'Unauthorized: orgid mismatch' }), {
                status: 403,
                headers: { 'Content-Type': 'application/json' },
              });
            }
          }
          console.log('No orgid in decoded token for resume path');
          return new Response(JSON.stringify({ error: 'Unauthorized: Invalid token data' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        console.log("Invalid jwt_token for resume path, redirecting to login");
        return NextResponse.redirect(new URL('/login', request.url));
      } else if (jobToken || headerToken) {
        // Use job_jwt_token for C_CANDIDATE access
        const tokenToUse = jobToken || headerToken;
        console.log(`Verifying job_jwt_token for resume path with applicationId: ${applicationId}`);
        const verifyResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/jobs/verify-resume-access`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Cookie: jobToken ? `job_jwt_token=${jobToken}` : '',
          },
          body: JSON.stringify({ token: tokenToUse, applicationId }),
        });

        const result = await verifyResponse.json();
        console.log('Verify Resume Access Response for resume path:', result);

        if (verifyResponse.ok && result.success) {
          console.log(`Access granted to resume path ${pathname} for candidate_id ${result.candidate_id} and applicationId ${applicationId}`);
          return NextResponse.next();
        } else {
          console.log(`Access denied to resume path ${pathname}: ${result.error}`);
          return new Response(JSON.stringify({ error: result.error || 'Unauthorized: Invalid job token' }), {
            status: verifyResponse.status || 401,
            headers: { 'Content-Type': 'application/json' },
          });
        }
      }
    } catch (error) {
      console.error('Error verifying token for resume path:', error.message);
      return NextResponse.redirect(new URL('/login', request.url));
    }
  }

  // Special handling for job C_CANDIDATE paths
  const isJobCandidatePath = pathname.startsWith('/jobs/jobapplications') || pathname.startsWith('/jobs/apply/');
  if (isJobCandidatePath) {
    const jobToken = request.cookies.get('job_jwt_token')?.value;

    if (!jobToken) {
      console.log("No job_jwt_token found for job C_CANDIDATE path, redirecting to jobs login");
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
  const isUploadPath = pathname.match(/^\/uploads\/(?!resumes\/|orglogos\/).+/);
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
    // Exclude static assets EXCEPT /uploads/expenses/ which need auth
    '/((?!api|_next/static|_next/image|favicon.ico|.well-known|pdf\\.worker\\.min\\.mjs).*)',
  ],
};
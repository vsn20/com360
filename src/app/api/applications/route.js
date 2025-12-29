import { verify } from 'jsonwebtoken';
import { getCandidateApplicationsWithDetails } from '@/app/utils/config/jobsdb';
import { cookies } from 'next/headers';

export async function GET(request) {
  try {
    // Extract JWT from 'job_jwt_token' cookie
    const cookieStore = await cookies();
    const token = cookieStore.get('job_jwt_token')?.value;
    if (!token) {
      return new Response(JSON.stringify({ error: 'Unauthorized: Missing job_jwt_token' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    let candidate_id;
    try {
      const decoded = verify(token, process.env.JWT_SECRET);
      candidate_id = decoded.cid;
    } catch (error) {
      console.error('JWT verification error:', error.message);
      return new Response(JSON.stringify({ error: 'Unauthorized: Invalid job_jwt_token' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Fetch applications from ALL company databases
    const C_APPLICATIONS = await getCandidateApplicationsWithDetails(candidate_id);

    console.log('Applications Query Result:', C_APPLICATIONS.length, 'applications found across all databases');

    return new Response(JSON.stringify({ C_APPLICATIONS }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error fetching C_APPLICATIONS:', error);
    return new Response(JSON.stringify({ error: 'Failed to fetch C_APPLICATIONS' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
import { getCandidateApplications } from '@/app/utils/config/jobsdb';
import { verify } from 'jsonwebtoken';

export async function GET(request) {
  try {
    const token = request.cookies.get('job_jwt_token')?.value;

    console.log('job_jwt_token in application-status:', token ? 'Present' : 'Missing'); // Debug

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
      console.log('Decoded candidate_id:', candidate_id); // Debug
    } catch (error) {
      console.error('JWT verification error:', error.message);
      return new Response(JSON.stringify({ error: 'Unauthorized: Invalid job_jwt_token' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Get applications from all databases
    const applications = await getCandidateApplications(candidate_id);

    console.log('Application Status Query Result:', applications.length, 'applications found'); // Debug
    const appliedJobIds = applications.map((app) => app.jobid).filter((id) => id !== undefined);
    
    return new Response(JSON.stringify({ appliedJobIds }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error fetching application status:', error.message);
    return new Response(JSON.stringify({ error: 'Failed to fetch application status' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
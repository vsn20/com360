import DBconnection from '@/app/utils/config/db';
import { verify } from 'jsonwebtoken';

export async function GET(request) {
  try {
    const pool = await DBconnection();
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

    const [C_APPLICATIONS] = await pool.query(
      `SELECT jobid FROM C_APPLICATIONS WHERE candidate_id = ?`,
      [candidate_id]
    );

    console.log('Application Status Query Result:', C_APPLICATIONS); // Debug
    const appliedJobIds = C_APPLICATIONS.map((app) => app.jobid).filter((id) => id !== undefined);
    
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
import { verify } from 'jsonwebtoken';
import DBconnection from '@/app/utils/config/db';
import { cookies } from 'next/headers';

export async function GET(request) {
  try {
    const pool = await DBconnection();

    // Extract JWT from 'job_jwt_token' cookie
    const cookieStore = cookies();
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

    // Fetch applications with organization and job details
    const [applications] = await pool.query(`
      SELECT 
        a.applicationid,
        a.orgid,
        a.jobid,
        a.applieddate,
        a.status,
        a.resumepath,
        a.candidate_id,
        a.salary_expected,
        o.orgname,
        ej.display_job_name
      FROM applications a
      JOIN C_ORG o ON a.orgid = o.orgid
      JOIN externaljobs ej ON a.jobid = ej.jobid
      WHERE a.candidate_id = ?
    `, [candidate_id]);

    console.log('Applications Query Result:', applications); // Debug: Log query result

    return new Response(JSON.stringify({ applications }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error fetching applications:', error);
    return new Response(JSON.stringify({ error: 'Failed to fetch applications' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
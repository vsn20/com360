import DBconnection from '@/app/utils/config/db';
import { verify } from 'jsonwebtoken';

export async function GET(request, { params }) {
  try {
    const pool = await DBconnection();
    const { jobid } = params; // Destructure params to access jobid

    console.log('Fetching job details for jobid:', jobid); // Debug log

    // Extract JWT from 'job_jwt_token' cookie using request.cookies
    const token = request.cookies.get('job_jwt_token')?.value;
    console.log('job_jwt_token:', token ? 'Present' : 'Missing'); // Debug log

    if (!token) {
      return Response.json({ error: 'Unauthorized: Missing job_jwt_token' }, { status: 401 });
    }

    let candidate_id;
    try {
      const decoded = verify(token, process.env.JWT_SECRET); // Replace with your JWT secret
      candidate_id = decoded.cid;
      console.log('Decoded candidate_id:', candidate_id); // Debug log
    } catch (error) {
      console.error('JWT verification error:', error.message);
      return Response.json({ error: 'Unauthorized: Invalid job_jwt_token' }, { status: 401 });
    }

    // Check if the candidate has already applied for this job
    const [existingApplication] = await pool.query(
      `SELECT applicationid FROM applications WHERE jobid = ? AND candidate_id = ?`,
      [jobid, candidate_id]
    );
    console.log('Existing application:', existingApplication); // Debug log

    // Fetch job details
    const [jobDetails] = await pool.query(`
      SELECT ej.jobid, ej.orgid, ej.lastdate_for_application,
             o.orgname, r.jobtitle, r.type, r.description, r.keyresponsibilities,
             s.value AS state_value, c.value AS country_value
      FROM externaljobs ej
      JOIN C_ORG o ON ej.orgid = o.orgid
      JOIN org_role_table r ON ej.roleid = r.roleid
      LEFT JOIN C_STATE s ON ej.stateid = s.ID
      LEFT JOIN C_COUNTRY c ON ej.countryid = c.ID
      WHERE ej.jobid = ? AND ej.active = 1 AND r.is_active = 1
    `, [jobid]);

    if (jobDetails.length === 0) {
      console.log('Job not found for jobid:', jobid); // Debug log
      return Response.json({ error: 'Job not found' }, { status: 404 });
    }

    return Response.json({
      job: jobDetails[0],
      hasApplied: existingApplication.length > 0
    });
  } catch (error) {
    console.error('Error fetching job details:', error);
    return Response.json({ error: 'Failed to fetch job details' }, { status: 500 });
  }
}
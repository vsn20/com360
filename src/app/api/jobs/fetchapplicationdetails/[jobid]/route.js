import DBconnection from '@/app/utils/config/db';
import { verify } from 'jsonwebtoken';

export async function GET(request, { params }) {
  try {
    const pool = await DBconnection();
    const { jobid } = params;

    console.log('Fetching job details for jobid:', jobid);

    const token = request.cookies.get('job_jwt_token')?.value;
    console.log('job_jwt_token:', token ? 'Present' : 'Missing');

    if (!token) {
      return Response.json({ error: 'Unauthorized: Missing job_jwt_token' }, { status: 401 });
    }

    let candidate_id;
    try {
      const decoded = verify(token, process.env.JWT_SECRET);
      candidate_id = decoded.cid;
      console.log('Decoded candidate_id:', candidate_id);
    } catch (error) {
      console.error('JWT verification error:', error.message);
      return Response.json({ error: 'Unauthorized: Invalid job_jwt_token' }, { status: 401 });
    }

    const [existingApplication] = await pool.query(
      `SELECT applicationid FROM C_APPLICATIONS WHERE jobid = ? AND candidate_id = ?`,
      [jobid, candidate_id]
    );
    console.log('Existing application:', existingApplication);

    const [jobDetails] = await pool.query(`
      SELECT ej.jobid, ej.orgid, ej.lastdate_for_application,
             ej.display_job_name, ej.job_type AS job_type_id, ej.description,
             ej.countryid, ej.stateid, ej.custom_state_name,
             o.orgname, c.value AS country_value, s.value AS state_value,
             g.name AS job_type
      FROM C_EXTERNAL_JOBS ej
      JOIN C_ORG o ON ej.orgid = o.orgid
      LEFT JOIN C_COUNTRY c ON ej.countryid = c.ID
      LEFT JOIN C_STATE s ON ej.stateid = s.ID
      LEFT JOIN C_GENERIC_VALUES g ON ej.job_type = g.id
      WHERE ej.jobid = ? AND ej.active = 1
    `, [jobid]);

    if (jobDetails.length === 0) {
      console.log('Job not found for jobid:', jobid);
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
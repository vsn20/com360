import DBconnection from '@/app/utils/config/db';
import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';

export async function GET() {
  try {
    const pool = await DBconnection();
    const cookieStore = await cookies();
    const token = cookieStore.get('job_jwt_token')?.value;

    let appliedJobs = [];
    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const [applications] = await pool.query(
          `SELECT jobid FROM applications WHERE candidate_id = ? AND status = 'submitted'`,
          [decoded.cid]
        );
        appliedJobs = applications.map((app) => app.jobid);
      } catch (jwtError) {
        console.warn('JWT verification failed:', jwtError.message);
      }
    }

    const [orgs] = await pool.query('SELECT orgid, orgname FROM C_ORG');

    const [jobs] = await pool.query(`
      SELECT ej.jobid, ej.orgid, ej.lastdate_for_application, ej.active,
             ej.display_job_name, ej.job_type AS job_type_id, ej.description,
             ej.countryid, ej.stateid, ej.custom_state_name,
             o.orgname, c.value AS country_value, s.value AS state_value,
             g.name AS job_type
      FROM externaljobs ej
      JOIN C_ORG o ON ej.orgid = o.orgid
      LEFT JOIN C_COUNTRY c ON ej.countryid = c.ID
      LEFT JOIN C_STATE s ON ej.stateid = s.ID
      LEFT JOIN generic_values g ON ej.job_type = g.id
      WHERE ej.active = 1
    `);

    return Response.json({ orgs, jobs, appliedJobs });
  } catch (error) {
    console.error('Error fetching jobs:', error.message);
    return Response.json({ error: 'Failed to fetch jobs' }, { status: 500 });
  }
}
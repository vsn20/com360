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
        // Continue with empty appliedJobs instead of throwing error
      }
    }

    const [orgs] = await pool.query('SELECT orgid, orgname FROM C_ORG');

    const [jobs] = await pool.query(`
      SELECT ej.jobid, ej.orgid, ej.roleid, ej.lastdate_for_application, ej.active,
             o.orgname, r.jobtitle, r.type, r.description, r.keyresponsibilities,
             s.value AS state_value, c.value AS country_value
      FROM externaljobs ej
      JOIN C_ORG o ON ej.orgid = o.orgid
      JOIN org_role_table r ON ej.roleid = r.roleid
      LEFT JOIN C_STATE s ON ej.stateid = s.ID
      LEFT JOIN C_COUNTRY c ON ej.countryid = c.ID
      WHERE ej.active = 1 AND r.is_active = 1
    `);

    return Response.json({ orgs, jobs, appliedJobs });
  } catch (error) {
    console.error('Error fetching jobs:', error.message);
    return Response.json({ error: 'Failed to fetch jobs' }, { status: 500 });
  }
}
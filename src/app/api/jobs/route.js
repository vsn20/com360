import DBconnection from '@/app/utils/config/db';

export async function GET() {
  try {
    const pool = await DBconnection();

    // Fetch organizations
    const [orgs] = await pool.query('SELECT orgid, orgname FROM C_ORG');

    // Fetch jobs with only the 'value' field from state and country tables
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

    return Response.json({ orgs, jobs });
  } catch (error) {
    console.error('Error fetching jobs:', error);
    return Response.json({ error: 'Failed to fetch jobs' }, { status: 500 });
  }
}
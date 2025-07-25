import { getAllroles } from "@/app/serverActions/getAllroles";
import AddEmployee from "@/app/components/Employee/AddEmployee";
import { cookies } from "next/headers";
import DBconnection from "@/app/utils/config/db";
import { fetchLeaveTypes } from "@/app/serverActions/Employee/overview";

// Simple function to decode JWT without verification
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

export default async function AddEmployeePage({ searchParams }) {
  const { error: queryError } = searchParams || {};
  const error = queryError ? decodeURIComponent(queryError) : null;

  // Initialize variables
  let orgid = null;
  let currentrole = null;
  let employees = [];
  let countries = [];
  let states = [];
  let departments = [];
  let payFrequencies = [];
  let jobTitles = [];
  let statuses = [];
  let workerCompClasses = [];

  try {
    // Establish database connection
    const pool = await DBconnection();

    // Get orgid and empid from token
    const cookieStore = cookies();
    const token = cookieStore.get('jwt_token')?.value;

    if (token) {
      const decoded = decodeJwt(token);
      if (decoded && decoded.orgid && decoded.empid) {
        orgid = decoded.orgid;

        // Fetch user's roles from emp_role_assign
        const [roleRows] = await pool.query(
          'SELECT r.roleid, r.rolename, r.isadmin FROM emp_role_assign era ' +
          'JOIN org_role_table r ON era.roleid = r.roleid AND era.orgid = r.orgid ' +
          'WHERE era.empid = ? AND era.orgid = ? LIMIT 1',
          [decoded.empid, orgid]
        );

        if (roleRows && roleRows.length > 0) {
          currentrole = roleRows[0].rolename || roleRows[0].roleid.toString();
        } else {
          console.warn('No roles found for empid:', decoded.empid);
        }

        // Fetch all employees for the given orgid
        [employees] = await pool.query(
          'SELECT empid, EMP_FST_NAME, EMP_LAST_NAME, roleid FROM C_EMP WHERE orgid = ?',
          [orgid]
        );

        // Fetch active departments for the organization
        [departments] = await pool.query(
          'SELECT id, name FROM org_departments WHERE orgid = ? AND isactive = 1',
          [orgid]
        );

        // Fetch active pay frequencies for the organization
        [payFrequencies] = await pool.query(
          'SELECT id, Name FROM generic_values WHERE g_id = 4 AND orgid = ? AND isactive = 1',
          [orgid]
        );

        // Fetch active job titles for the organization
        [jobTitles] = await pool.query(
          'SELECT job_title, level FROM org_jobtitles WHERE orgid = ? AND is_active = 1',
          [orgid]
        );

        // Fetch active statuses for the organization
        [statuses] = await pool.query(
          'SELECT id, Name FROM generic_values WHERE g_id = 3 AND cutting = 1 AND orgid = ? AND isactive = 1',
          [orgid]
        );
      } else {
        console.error('Invalid token or missing empid/orgid');
      }
    } else {
      console.error('No JWT token found');
    }

    // Fetch active countries
    [countries] = await pool.query(
      'SELECT ID, VALUE FROM C_COUNTRY WHERE ACTIVE = 1'
    );

    // Fetch active states
    [states] = await pool.query(
      'SELECT ID, VALUE FROM C_STATE WHERE ACTIVE = 1'
    );

    // Fetch worker compensation classes
    [workerCompClasses] = await pool.query(
      'SELECT class_code, phraseology FROM worker_comp'
    );

  } catch (error) {
    console.error('Error fetching data:', error);
    // Proceed with partial data
  }

  // Fetch all roles for the role dropdown
  const { success, roles, error: fetchError } = await getAllroles();

  if (!success) {
    return (
      <div style={{ padding: "20px", maxWidth: "600px", margin: "0 auto" }}>
        <h1>Add Employee</h1>
        <p style={{ color: "red" }}>{fetchError || "Failed to load roles."}</p>
      </div>
    );
  }

  // Fetch leave types
  let leaveTypes = [];
  try {
    leaveTypes = await fetchLeaveTypes();
  } catch (err) {
    console.error('Error fetching leave types:', err);
    // Proceed without leaveTypes, as it's optional
  }

  return (
    <AddEmployee
      roles={roles}
      currentrole={currentrole}
      orgid={orgid}
      error={error}
      employees={employees}
      leaveTypes={leaveTypes}
      countries={countries}
      states={states}
      departments={departments}
      payFrequencies={payFrequencies}
      jobTitles={jobTitles}
      statuses={statuses}
      workerCompClasses={workerCompClasses}
    />
  );
}
import { getAllroles } from "@/app/serverActions/getAllroles";
import AddEmployee from "@/app/components/Employee/AddEmployee";
import { cookies } from "next/headers";
import DBconnection from "@/app/utils/config/db";

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

  // Get the orgid and currentrole from the token
  let orgid = null;
  let currentrole = null;
  let employees = [];
  try {
    const cookieStore = cookies();
    const token = cookieStore.get('jwt_token')?.value;

    if (token) {
      const decoded = decodeJwt(token);
      if (decoded && decoded.orgid) {
        orgid = decoded.orgid;

        // Fetch the current role based on orgid and roleid from the token
        const pool = await DBconnection();
        const [roleRows] = await pool.query(
          'SELECT roleid, rolename FROM org_role_table WHERE orgid = ? AND roleid = ? LIMIT 1',
          [orgid, decoded.roleid]
        );

        if (roleRows && roleRows.length > 0) {
          currentrole = roleRows[0].rolename || roleRows[0].roleid.toString(); // Use rolename if available, fallback to roleid
        }

        // Fetch all employees for the given orgid
        [employees] = await pool.query(
          'SELECT empid, EMP_FST_NAME, EMP_LAST_NAME, roleid FROM C_EMP WHERE orgid = ?',
          [orgid]
        );
      }
    }
  } catch (error) {
    console.error('Error decoding token, fetching role, or fetching employees:', error);
    // Proceed without currentrole or employees if decoding or query fails, as permission will be handled in middleware
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

  return (
    <AddEmployee
      roles={roles}
      currentrole={currentrole} // Dynamically set based on orgid and roleid
      orgid={orgid}
      error={error}
      employees={employees} // Pass the fetched employees
    />
  );
}
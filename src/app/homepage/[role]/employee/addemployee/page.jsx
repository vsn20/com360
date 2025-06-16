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

export default async function AddEmployeePage({ params, searchParams }) {
  const role = params?.role || "";
  const { success, roles, error: fetchError } = await getAllroles();
  const error = searchParams?.error || null;

  // Get the orgid from the token
  let orgid = null;
  try {
    const cookieStore = cookies();
    const token = cookieStore.get('jwt_token')?.value;

    if (!token) {
      return (
        <div style={{ padding: "20px", maxWidth: "600px", margin: "0 auto" }}>
          <h1>Add Employee</h1>
          <p style={{ color: "red" }}>No token found. Please log in.</p>
        </div>
      );
    }

    const decoded = decodeJwt(token);
    if (!decoded || !decoded.roleid) {
      return (
        <div style={{ padding: "20px", maxWidth: "600px", margin: "0 auto" }}>
          <h1>Add Employee</h1>
          <p style={{ color: "red" }}>Invalid token or roleid not found.</p>
        </div>
      );
    }

    const adminRoleId = decoded.roleid;
    const pool = await DBconnection();
    const [roleRows] = await pool.query(
      'SELECT orgid FROM org_role_table WHERE roleid = ? AND isadmin = 1 LIMIT 1',
      [adminRoleId]
    );

    if (!roleRows || roleRows.length === 0) {
      return (
        <div style={{ padding: "20px", maxWidth: "600px", margin: "0 auto" }}>
          <h1>Add Employee</h1>
          <p style={{ color: "red" }}>Admin role not found or not an admin.</p>
        </div>
      );
    }

    orgid = roleRows[0].orgid;
  } catch (error) {
    return (
      <div style={{ padding: "20px", maxWidth: "600px", margin: "0 auto" }}>
        <h1>Add Employee</h1>
        <p style={{ color: "red" }}>Failed to fetch organization ID: {error.message}</p>
      </div>
    );
  }

  // Handle fetch error for roles
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
      currentrole={role}
      orgid={orgid}
      error={error}
    />
  );
}
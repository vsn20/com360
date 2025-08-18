import AddRole from "../../../../components/AddRole";
import { cookies } from "next/headers";
import DBconnection from "../../../../utils/config/db";

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

export default async function AddRolePage({ searchParams }) {
  const { error: queryError } = searchParams || {};
  const error = queryError ? decodeURIComponent(queryError) : null;

  // Get the orgid and currentRole from the token
  let orgid = null;
  let currentRole = null;
  try {
    const cookieStore = cookies();
    const token = cookieStore.get('jwt_token')?.value;

    if (!token) {
      return (
        <div style={{ padding: "20px", maxWidth: "600px", margin: "0 auto" }}>
          <h1>Add Role</h1>
          <p style={{ color: "red" }}>No token found. Please log in.</p>
        </div>
      );
    }

    const decoded = decodeJwt(token);
    if (!decoded || !decoded.orgid || !decoded.empid) {
      return (
        <div style={{ padding: "20px", maxWidth: "600px", margin: "0 auto" }}>
          <h1>Add Role</h1>
          <p style={{ color: "red" }}>Invalid token or organization/employee not found.</p>
        </div>
      );
    }

    orgid = decoded.orgid;

    // Fetch the current role from C_EMP_ROLE_ASSIGN using empid
    const pool = await DBconnection();
    const [roleRows] = await pool.query(
      `SELECT r.rolename, r.roleid 
       FROM C_EMP_ROLE_ASSIGN era 
       JOIN C_ORG_ROLE_TABLE r ON era.roleid = r.roleid 
       WHERE era.empid = ? AND r.orgid = ? AND r.is_active = 1 
       LIMIT 1`,
      [decoded.empid, orgid]
    );

    if (roleRows && roleRows.length > 0) {
      currentRole = roleRows[0].rolename || roleRows[0].roleid.toString();
    } else {
      console.log('No active role found for empid:', decoded.empid);
      // Allow access even if no role is assigned, as per "access for everyone" requirement
    }

  } catch (error) {
    console.error('Error decoding token or fetching role:', error);
    return (
      <div style={{ padding: "20px", maxWidth: "600px", margin: "0 auto" }}>
        <h1>Add Role</h1>
        <p style={{ color: "red" }}>Error fetching user details: {error.message}</p>
      </div>
    );
  }

  return (
    <AddRole
      currentRole={currentRole}
      orgid={orgid}
      error={error}
    />
  );
}
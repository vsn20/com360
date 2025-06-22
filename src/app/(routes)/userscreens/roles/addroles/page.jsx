import { getAllFeatures } from "../../../../serverActions/getAllFeatures";
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

  // Get the orgid and currentrole from the token
  let orgid = null;
  let currentRole = null;
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
          currentRole = roleRows[0].rolename || roleRows[0].roleid.toString(); // Use rolename if available, fallback to roleid
        }

        // Check if the user has the "add role" feature (example logic; adjust based on your schema)
        const [permissionRows] = await pool.query(
          'SELECT menuid FROM role_menu_permissions WHERE roleid = ? AND menuid = ?',
          [decoded.roleid, 1] // Assuming menuid 1 is for "add role"; adjust the ID as per your menu table
        );

        if (!permissionRows || permissionRows.length === 0) {
          return (
            <div style={{ padding: "20px", maxWidth: "600px", margin: "0 auto" }}>
              <h1>Add Role</h1>
              <p style={{ color: "red" }}>You do not have permission to add a role.</p>
            </div>
          );
        }
      } else {
        return (
          <div style={{ padding: "20px", maxWidth: "600px", margin: "0 auto" }}>
            <h1>Add Role</h1>
            <p style={{ color: "red" }}>Invalid token or organization not found.</p>
          </div>
        );
      }
    } else {
      return (
        <div style={{ padding: "20px", maxWidth: "600px", margin: "0 auto" }}>
          <h1>Add Role</h1>
          <p style={{ color: "red" }}>No token found. Please log in.</p>
        </div>
      );
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

  // Fetch all features for the feature checkboxes
  const { success, features, error: fetchError } = await getAllFeatures();

  if (!success) {
    return (
      <div style={{ padding: "20px", maxWidth: "600px", margin: "0 auto" }}>
        <h1>Add Role</h1>
        <p style={{ color: "red" }}>{fetchError || "Failed to load features."}</p>
      </div>
    );
  }

  return (
    <AddRole
      features={features}
      currentRole={currentRole}
      orgid={orgid}
      error={error}
    />
  );
}
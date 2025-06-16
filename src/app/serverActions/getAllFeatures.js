'use server';

import DBconnection from "../utils/config/db";
import { cookies } from 'next/headers';

// Simple function to decode JWT without verification (similar to middleware)
const decodeJwt = (token) => {
  try {
    const base64Url = token.split('.')[1]; // Get the payload part
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = Buffer.from(base64, 'base64').toString('utf8');
    return JSON.parse(jsonPayload);
  } catch (error) {
    console.error('Error decoding JWT:', error);
    return null;
  }
};

export async function getAllFeatures() {
  try {
    // Get the JWT token from cookies
    const cookieStore = cookies();
    const token = cookieStore.get('jwt_token')?.value;

    if (!token) {
      return { success: false, error: 'No token found. Please log in.' };
    }

    // Decode the token to get the roleid
    const decoded = decodeJwt(token);
    if (!decoded || !decoded.roleid) {
      return { success: false, error: 'Invalid token or roleid not found.' };
    }

    const adminRoleId = decoded.roleid; // e.g., 1 for naman

    const pool = await DBconnection();

    // Fetch the admin's orgid from org_role_table
    const [roleRows] = await pool.query(
      'SELECT orgid FROM org_role_table WHERE roleid = ? AND isadmin = 1 LIMIT 1',
      [adminRoleId]
    );

    if (!roleRows || roleRows.length === 0) {
      return { success: false, error: 'Admin role not found or not an admin.' };
    }

    const orgid = roleRows[0].orgid;

    // Fetch the admin's accessible features from role_menu_permissions
    const [permissionRows] = await pool.query(
      'SELECT menuid FROM role_menu_permissions WHERE roleid = ?',
      [adminRoleId]
    );

    if (!permissionRows || permissionRows.length === 0) {
      return { success: true, features: [] }; // No features accessible
    }

    const accessibleMenuIds = permissionRows.map(row => row.menuid);

    // Fetch the corresponding features from sidebarmenu
    const [featureRows] = await pool.query(
      'SELECT id, name, href, hassubmenu FROM sidebarmenu WHERE id IN (?)',
      [accessibleMenuIds]
    );

    return { success: true, features: featureRows };
  } catch (error) {
    console.error('Error fetching features:', error);
    return { success: false, error: 'Failed to fetch features: ' + error.message };
  }
}
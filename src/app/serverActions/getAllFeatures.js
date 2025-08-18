"use server";

import DBconnection from "../utils/config/db";
import { cookies } from "next/headers";

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

export async function getAllFeatures() {
  try {
    const cookieStore = cookies();
    const token = cookieStore.get('jwt_token')?.value;

    if (!token) {
      console.log('No token found');
      return { success: false, error: 'No token found. Please log in.', features: [] };
    }

    const decoded = decodeJwt(token);
    if (!decoded || !decoded.orgid || !decoded.empid) {
      console.log('Invalid token or orgid/empid not found');
      return { success: false, error: 'Invalid token or organization/employee not found.', features: [] };
    }

    const orgId = decoded.orgid;
    if (!orgId) {
      console.log('orgId is undefined or invalid');
      return { success: false, error: 'Organization ID is missing or invalid.', features: [] };
    }

    const pool = await DBconnection();
    console.log("MySQL connection pool acquired");

    // Find the admin role for the organization
    const [adminRoleRows] = await pool.execute(
      `SELECT roleid 
       FROM C_ORG_ROLE_TABLE 
       WHERE orgid = ? AND isadmin = 1 AND is_active = 1`,
      [orgId]
    );

    if (adminRoleRows.length === 0) {
      console.log('No active admin role found for orgId:', orgId);
      return { success: false, error: 'No active admin role found for this organization.', features: [] };
    }

    const adminRoleId = adminRoleRows[0].roleid;

    // Fetch menus assigned to the admin role
    const [menuRows] = await pool.execute(
      `SELECT DISTINCT m.id, m.name, m.hassubmenu
       FROM C_MENU m 
       JOIN C_ROLE_MENU_PERMISSIONS rmp ON m.id = rmp.menuid 
       WHERE rmp.roleid = ? AND m.is_active = 1`,
      [adminRoleId]
    );

    const features = await Promise.all(menuRows.map(async (C_MENU) => {
      if (C_MENU.hassubmenu === 'yes') {
        const [submenuRows] = await pool.query(
          `SELECT C_SUBMENU.id, C_SUBMENU.name, C_SUBMENU.url
           FROM C_SUBMENU
           JOIN C_ROLE_MENU_PERMISSIONS rmp ON C_SUBMENU.id = rmp.submenuid
           WHERE rmp.roleid = ? AND C_SUBMENU.menuid = ? AND C_SUBMENU.is_active = 1`,
          [adminRoleId, C_MENU.id]
        );
        return { ...C_MENU, C_SUBMENU: submenuRows };
      }
      return { ...C_MENU, C_SUBMENU: [] };
    }));

    console.log('Fetched admin role features:', features);
    return { success: true, features };
  } catch (error) {
    console.error('Error fetching features:', error);
    return { success: false, error: `Failed to fetch features: ${error.message}`, features: [] };
  }
}
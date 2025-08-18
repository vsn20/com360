'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import DBconnection from '../utils/config/db';

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
    const empId = decoded.empid;
    if (!orgId || !empId) {
      console.log('orgId or empId is undefined or invalid');
      return { success: false, error: 'Organization or employee ID is missing or invalid.', features: [] };
    }

    const pool = await DBconnection();
    console.log('MySQL connection pool acquired');

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

    // Check if the employee is assigned the admin role in C_EMP_ROLE_ASSIGN
    const [roleAssignmentRows] = await pool.execute(
      `SELECT * 
       FROM C_EMP_ROLE_ASSIGN 
       WHERE empid = ? AND roleid = ? AND orgid = ?`,
      [empId, adminRoleId, orgId]
    );

    if (roleAssignmentRows.length === 0) {
      console.log('Employee not assigned active admin role:', empId, 'for orgId:', orgId);
      return { success: false, error: 'You do not have permission to access feature priorities.', features: [] };
    }

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

export async function savePriorities(formData) {
  try {
    const cookieStore = cookies();
    const token = cookieStore.get('jwt_token')?.value;

    if (!token) {
      throw new Error('No JWT token found');
    }

    const decoded = decodeJwt(token);
    if (!decoded || !decoded.orgid || !decoded.empid) {
      throw new Error('Invalid token or orgid/empid not found');
    }

    const orgId = decoded.orgid;
    const empId = decoded.empid;
    if (!orgId || !empId) {
      throw new Error('Organization or employee ID is missing or invalid');
    }

    const pool = await DBconnection();
    console.log('MySQL connection pool acquired for savePriorities');

    // Find the admin role for the organization
    const [adminRoleRows] = await pool.execute(
      `SELECT roleid 
       FROM C_ORG_ROLE_TABLE 
       WHERE orgid = ? AND isadmin = 1 AND is_active = 1`,
      [orgId]
    );

    if (adminRoleRows.length === 0) {
      console.log('No active admin role found for orgId:', orgId);
      throw new Error('No active admin role found for this organization');
    }

    const adminRoleId = adminRoleRows[0].roleid;

    // Check if the employee is assigned the admin role in C_EMP_ROLE_ASSIGN
    const [roleAssignmentRows] = await pool.execute(
      `SELECT * 
       FROM C_EMP_ROLE_ASSIGN 
       WHERE empid = ? AND roleid = ? AND orgid = ?`,
      [empId, adminRoleId, orgId]
    );

    if (roleAssignmentRows.length === 0) {
      console.log('Employee not assigned active admin role:', empId, 'for orgId:', orgId);
      throw new Error('You do not have permission to save feature priorities');
    }

    const priorities = Object.fromEntries(formData.entries());
    console.log('Form Data:', priorities);

    const updatePromises = Object.entries(priorities)
      .filter(([key]) => !key.endsWith('_type')) // Skip hidden type fields
      .map(async ([id, priority]) => {
        const itemId = parseInt(id);
        const type = priorities[`${id}_type`];
        const column = type === 'C_SUBMENU' ? 'submenuid' : 'menuid';

        if (!type) return;

        const [existing] = await pool.query(
          `SELECT * FROM C_ORG_MENU_PRIORITY WHERE ${column} = ? AND orgid = ?`,
          [itemId, orgId]
        );

        if (existing.length > 0) {
          await pool.query(
            `UPDATE C_ORG_MENU_PRIORITY SET priority = ? WHERE ${column} = ? AND orgid = ?`,
            [priority, itemId, orgId]
          );
        } else {
          await pool.query(
            `INSERT INTO C_ORG_MENU_PRIORITY (orgid, ${column}, priority) VALUES (?, ?, ?)`,
            [orgId, itemId, priority]
          );
        }
      });

    await Promise.all(updatePromises);
    console.log('Priorities saved successfully for orgId:', orgId);

    // Redirect after successful save
   
  } catch (error) {
    console.error('Error saving priorities:', error);
    throw new Error(error.message || 'Failed to save priorities');
  }
}
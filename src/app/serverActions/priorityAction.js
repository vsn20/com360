'use server';

import { cookies } from 'next/headers';
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

export async function getMenusWithPriorities() {
  try {
    const cookieStore = cookies();
    const token = cookieStore.get('jwt_token')?.value;

    if (!token) {
      return { success: false, error: 'No token found. Please log in.', menus: [] };
    }

    const decoded = decodeJwt(token);
    if (!decoded || !decoded.orgid || !decoded.empid) {
      return { success: false, error: 'Invalid token or organization/employee not found.', menus: [] };
    }

    const orgId = decoded.orgid;
    const pool = await DBconnection();

    // Get existing priorities for this organization
    const [priorityRows] = await pool.execute(
      `SELECT menuid, submenuid, priority 
       FROM C_ORG_MENU_PRIORITY 
       WHERE orgid = ? 
       ORDER BY priority`,
      [orgId]
    );

    // Create priority lookup map
    const priorityMap = new Map();
    priorityRows.forEach(row => {
      const key = row.submenuid ? `submenu_${row.submenuid}` : `menu_${row.menuid}`;
      priorityMap.set(key, row.priority);
    });

    // Fetch menu structure
    const [menuRows] = await pool.execute(
      `SELECT DISTINCT
        m.id AS menuid,
        m.name AS menuname,
        m.url AS menuhref,
        m.hassubmenu
      FROM C_MENU m 
      WHERE m.is_active = 1
      ORDER BY m.id`
    );

    // Build menu structure with priorities
    const menusWithPriorities = await Promise.all(
      menuRows.map(async (menu) => {
        if (menu.hassubmenu === 'yes') {
          // Fetch submenus
          const [submenuRows] = await pool.execute(
            `SELECT id, name, url
             FROM C_SUBMENU
             WHERE menuid = ? AND is_active = 1
             ORDER BY id`,
            [menu.menuid]
          );

          const submenusWithPriorities = submenuRows.map(submenu => ({
            id: submenu.id,
            title: submenu.name,
            href: submenu.url,
            priority: priorityMap.get(`submenu_${submenu.id}`) || null
          }));

          return {
            id: menu.menuid,
            title: menu.menuname,
            href: menu.menuhref || null,
            C_SUBMENU: submenusWithPriorities,
            priority: null // Parent menus with submenus don't have priorities
          };
        } else {
          return {
            id: menu.menuid,
            title: menu.menuname,
            href: menu.menuhref,
            C_SUBMENU: [],
            priority: priorityMap.get(`menu_${menu.menuid}`) || null
          };
        }
      })
    );

    return { success: true, menus: menusWithPriorities };
  } catch (error) {
    console.error('Error fetching menus with priorities:', error);
    return { success: false, error: `Failed to fetch menus: ${error.message}`, menus: [] };
  }
}

export async function savePriorities(prioritiesData) {
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

    const pool = await DBconnection();
    console.log('Saving priorities for orgId:', orgId, 'Data:', prioritiesData);

    // Verify admin permissions
    const [adminRoleRows] = await pool.execute(
      `SELECT roleid 
       FROM C_ORG_ROLE_TABLE 
       WHERE orgid = ? AND isadmin = 1 AND is_active = 1`,
      [orgId]
    );

    if (adminRoleRows.length === 0) {
      throw new Error('No active admin role found for this organization');
    }

    const adminRoleId = adminRoleRows[0].roleid;

    const [roleAssignmentRows] = await pool.execute(
      `SELECT * FROM C_EMP_ROLE_ASSIGN 
       WHERE empid = ? AND roleid = ? AND orgid = ?`,
      [empId, adminRoleId, orgId]
    );

    if (roleAssignmentRows.length === 0) {
      throw new Error('You do not have permission to save feature priorities');
    }

    // --- CHANGED: Use query() instead of execute() for START TRANSACTION ---
    await pool.query('START TRANSACTION');

    try {
      // CRITICAL: Delete ALL existing priorities for this specific orgid ONLY
      // execute() is fine here because we are using parameters (?)
      const [deleteResult] = await pool.execute(
        'DELETE FROM C_ORG_MENU_PRIORITY WHERE orgid = ?',
        [orgId]
      );
      console.log(`Deleted ${deleteResult.affectedRows} existing priority records for orgid: ${orgId}`);

      // Insert new priorities with proper validation
      for (const item of prioritiesData) {
        if (!item.menuid || !item.priority) {
          console.warn('Skipping invalid priority item:', item);
          continue;
        }

        if (item.submenuid !== null && item.submenuid !== undefined) {
          // Submenu priority - insert with both menuid and submenuid
          await pool.execute(
            'INSERT INTO C_ORG_MENU_PRIORITY (orgid, menuid, submenuid, priority) VALUES (?, ?, ?, ?)',
            [orgId, item.menuid, item.submenuid, item.priority]
          );
        } else {
          // Standalone menu priority - insert with menuid and NULL submenuid
          await pool.execute(
            'INSERT INTO C_ORG_MENU_PRIORITY (orgid, menuid, submenuid, priority) VALUES (?, ?, NULL, ?)',
            [orgId, item.menuid, item.priority]
          );
        }
      }

      // --- CHANGED: Use query() instead of execute() for COMMIT ---
      await pool.query('COMMIT');
      console.log(`Successfully saved ${prioritiesData.length} priority records for orgId: ${orgId}`);
      
      return { success: true, message: 'Priorities saved successfully' };

    } catch (error) {
      // --- CHANGED: Use query() instead of execute() for ROLLBACK ---
      await pool.query('ROLLBACK');
      console.error('Transaction rolled back due to error:', error);
      throw error;
    }

  } catch (error) {
    console.error('Error saving priorities:', error);
    throw new Error(error.message || 'Failed to save priorities');
  }
}

// Keep your existing getAllFeatures function for backward compatibility
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
      `SELECT * FROM C_EMP_ROLE_ASSIGN 
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

    return { success: true, features };
  } catch (error) {
    console.error('Error fetching features:', error);
    return { success: false, error: `Failed to fetch features: ${error.message}`, features: [] };
  }
}
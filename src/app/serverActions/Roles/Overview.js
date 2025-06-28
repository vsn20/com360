"use server";

import DBconnection from "@/app/utils/config/db";
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

export async function fetchRolesByOrgId() {
  try {
    const cookieStore = cookies();
    const token = cookieStore.get('jwt_token')?.value;

    if (!token) {
      console.log('No token found');
      throw new Error('No token found. Please log in.');
    }

    const decoded = decodeJwt(token);
    if (!decoded || !decoded.orgid) {
      console.log('Invalid token or orgid not found');
      throw new Error('Invalid token or orgid not found.');
    }

    const orgId = decoded.orgid;
    if (!orgId) {
      console.log('orgId is undefined or invalid');
      throw new Error('Organization ID is missing or invalid.');
    }

    console.log(`Fetching roles for orgId: ${orgId}`);

    const pool = await DBconnection();
    console.log("MySQL connection pool acquired");
    const [rows] = await pool.execute(
      `SELECT DISTINCT roleid, orgid, rolename, isadmin 
       FROM org_role_table 
       WHERE orgid = ? AND is_active = 1`,
      [orgId]
    );
    console.log('Fetched roles:', rows);
    return rows;
  } catch (error) {
    console.error('Error fetching roles:', error.message);
    throw new Error(`Failed to fetch roles: ${error.message}`);
  }
}

export async function fetchUserPermissions() {
  try {
    const cookieStore = cookies();
    const token = cookieStore.get('jwt_token')?.value;

    if (!token) {
      console.log('No token found');
      throw new Error('No token found. Please log in.');
    }

    const decoded = decodeJwt(token);
    if (!decoded || !decoded.orgid || !decoded.roleid) {
      console.log('Invalid token or orgid/roleid not found');
      throw new Error('Invalid token or orgid/roleid not found.');
    }

    const orgId = decoded.orgid;
    const roleid = decoded.roleid;
    if (!orgId || !roleid) {
      console.log('orgId or roleid is undefined or invalid');
      throw new Error('Organization ID or Role ID is missing or invalid.');
    }

    console.log(`Fetching permissions for roleid: ${roleid}, orgId: ${orgId}`);

    const pool = await DBconnection();
    console.log("MySQL connection pool acquired");

    // Fetch isadmin from org_role_table
    let isAdmin = false;
    try {
      const [adminRows] = await pool.query(
        'SELECT isadmin FROM org_role_table WHERE roleid = ? AND orgid = ?',
        [roleid, orgId]
      );
      if (adminRows.length > 0) {
        isAdmin = adminRows[0].isadmin === 1;
      }
    } catch (error) {
      console.error('Error fetching isadmin from org_role_table:', error.message);
      isAdmin = false;
    }

    // Fetch menu permissions
    const [rows] = await pool.query(
      `SELECT 
        m.id AS menuid,
        m.name AS menuname,
        m.url AS menuhref,
        m.hassubmenu,
        sm.id AS submenuid,
        sm.name AS submenuname,
        sm.url AS submenuurl,
        omp.priority
      FROM org_menu_priority omp
      JOIN menu m ON m.id = omp.menuid AND m.is_active = 1
      LEFT JOIN submenu sm ON sm.id = omp.submenuid AND sm.is_active = 1
      JOIN role_menu_permissions rmp 
          ON rmp.menuid = omp.menuid 
         AND (rmp.submenuid = omp.submenuid OR omp.submenuid IS NULL)
      WHERE rmp.roleid = ? AND omp.orgid = ?
      ORDER BY omp.priority`,
      [roleid, orgId]
    );

    const accessibleItems = [];
    const menuMap = new Map();
    let hasAddRoles = false;
    let hasAddEmployee = false;

    for (const row of rows) {
      const { menuid, menuname, menuhref, hassubmenu, submenuid, submenuname, submenuurl, priority } = row;
      if (!menuMap.has(menuid)) {
        menuMap.set(menuid, {
          title: menuname,
          href: menuhref || null,
          submenu: [],
          priority: priority || 0,
        });
      }
      const menu = menuMap.get(menuid);
      if (hassubmenu === 'yes' && submenuid && submenuurl) {
        menu.submenu.push({
          title: submenuname,
          href: submenuurl,
          priority: priority || menu.submenu.length + 1,
        });
        if (submenuurl === '/userscreens/roles/addroles') {
          hasAddRoles = true;
        }
        if (submenuurl === '/userscreens/employee/addemployee') {
          hasAddEmployee = true;
        }
      } else if (menuhref && !menu.href) {
        menu.href = menuhref;
      }
    }

    menuMap.forEach(menu => {
      if (menu.href) {
        accessibleItems.push({
          href: menu.href,
          isMenu: true,
          priority: menu.priority,
        });
      }
      menu.submenu.forEach((sub) => {
        accessibleItems.push({
          href: sub.href,
          isMenu: false,
          priority: sub.priority,
        });
      });
    });

    if (isAdmin) {
      accessibleItems.push({
        href: '/userscreens/prioritysetting',
        isMenu: true,
        priority: 1000,
      });
    }

    if (hasAddEmployee) {
      accessibleItems.push({
        href: '/userscreens/employee/edit/:empid',
        isMenu: true,
        priority: 1001,
      });
    }

    if (hasAddRoles) {
      accessibleItems.push({
        href: '/userscreens/roles/edit/:roleid',
        isMenu: true,
        priority: 1002,
      });
    }

    accessibleItems.sort((a, b) => a.priority - b.priority);
    console.log('Fetched permissions:', accessibleItems);
    return accessibleItems;
  } catch (error) {
    console.error('Error fetching permissions:', error.message);
    throw new Error(`Failed to fetch permissions: ${error.message}`);
  }
}

export async function fetchRoleById(roleid) {
  try {
    const cookieStore = cookies();
    const token = cookieStore.get('jwt_token')?.value;

    if (!token) {
      console.log('No token found');
      throw new Error('No token found. Please log in.');
    }

    const decoded = decodeJwt(token);
    if (!decoded || !decoded.orgid) {
      console.log('Invalid token or orgid not found');
      throw new Error('Invalid token or orgid not found.');
    }

    const orgId = decoded.orgid;
    if (!orgId) {
      console.log('orgId is undefined or invalid');
      throw new Error('Organization ID is missing or invalid.');
    }

    if (!roleid) {
      console.log('roleid is missing');
      throw new Error('Role ID is required.');
    }

    console.log(`Fetching role with roleid: ${roleid} for orgId: ${orgId}`);

    const pool = await DBconnection();
    console.log("MySQL connection pool acquired");

    // Fetch role details
    const [roleRows] = await pool.execute(
      `SELECT roleid, orgid, rolename, is_active, CREATED_DATE, 
              salaryrange, type, description, vacantposts, jobtitle, keyresponsibilities 
       FROM org_role_table 
       WHERE roleid = ? AND orgid = ?`,
      [roleid, orgId]
    );

    if (roleRows.length === 0) {
      console.log('Role not found');
      throw new Error('Role not found.');
    }

    // Fetch associated permissions
    const [permissionRows] = await pool.execute(
      `SELECT menuid, submenuid 
       FROM role_menu_permissions 
       WHERE roleid = ?`,
      [roleid]
    );

    console.log('Fetched role:', roleRows[0], 'Permissions:', permissionRows);
    return { role: roleRows[0], permissions: permissionRows };
  } catch (error) {
    console.error('Error fetching role:', error.message);
    throw new Error(`Failed to fetch role: ${error.message}`);
  }
}

export async function fetchMenusAndSubmenus() {
  try {
    const cookieStore = cookies();
    const token = cookieStore.get('jwt_token')?.value;

    if (!token) {
      console.log('No token found');
      throw new Error('No token found. Please log in.');
    }

    const decoded = decodeJwt(token);
    if (!decoded || !decoded.orgid) {
      console.log('Invalid token or orgid not found');
      throw new Error('Invalid token or orgid not found.');
    }

    const orgId = decoded.orgid;
    if (!orgId) {
      console.log('orgId is undefined or invalid');
      throw new Error('Organization ID is missing or invalid.');
    }

    console.log(`Fetching menus and submenus for orgId: ${orgId}`);

    const pool = await DBconnection();
    console.log("MySQL connection pool acquired");

    const [menuRows] = await pool.execute(
      `SELECT DISTINCT m.id AS menuid, m.name AS menuname, m.url AS menuurl 
       FROM menu m 
       JOIN org_menu_priority omp ON m.id = omp.menuid 
       WHERE omp.orgid = ? AND m.is_active = 1`,
      [orgId]
    );

    const [submenuRows] = await pool.execute(
      `SELECT DISTINCT sm.id AS submenuid, sm.name AS submenuname, sm.url AS submenuurl, sm.menuid 
       FROM submenu sm 
       JOIN org_menu_priority omp ON sm.id = omp.submenuid 
       WHERE omp.orgid = ? AND sm.is_active = 1`,
      [orgId]
    );

    console.log('Fetched menus:', menuRows, 'Submenus:', submenuRows);
    return { menus: menuRows, submenus: submenuRows };
  } catch (error) {
    console.error('Error fetching menus and submenus:', error.message);
    throw new Error(`Failed to fetch menus and submenus: ${error.message}`);
  }
}

export async function updateRole(prevState, formData) {
  try {
    const roleid = formData.get('roleid');
    const rolename = formData.get('rolename');
    const is_active = formData.get('is_active') === '1' ? 1 : 0;
    const salaryrange = formData.get('salaryrange') || null;
    const type = formData.get('type') || null;
    const description = formData.get('description') || null;
    const vacantposts = formData.get('vacantposts') || null;
    const jobtitle = formData.get('jobtitle') || null;
    const keyresponsibilities = formData.get('keyresponsibilities') || null;
    const permissions = JSON.parse(formData.get('permissions') || '[]');

    console.log("Form data received:", {
      roleid, rolename, is_active, salaryrange, type, 
      description, vacantposts, jobtitle, keyresponsibilities, permissions
    });

    const cookieStore = cookies();
    const token = cookieStore.get('jwt_token')?.value;

    if (!token) {
      console.log('No token found');
      return { error: 'No token found. Please log in.' };
    }

    const decoded = decodeJwt(token);
    if (!decoded || !decoded.orgid) {
      console.log('Invalid token or orgid not found');
      return { error: 'Invalid token or orgid not found.' };
    }

    const orgId = decoded.orgid;
    if (!orgId) {
      console.log('orgId is undefined or invalid');
      return { error: 'Organization ID is missing or invalid.' };
    }

    // Validation
    if (!roleid) return { error: 'Role ID is required.' };
    if (!rolename) return { error: 'Role name is required.' };

    const pool = await DBconnection();
    console.log("MySQL connection pool acquired");

    // Check if role exists
    const [existing] = await pool.execute(
      'SELECT roleid FROM org_role_table WHERE roleid = ? AND orgid = ?',
      [roleid, orgId]
    );
    if (existing.length === 0) {
      console.log('Role not found');
      return { error: 'Role not found.' };
    }

    // Update org_role_table
    await pool.query(
      `UPDATE org_role_table 
       SET rolename = ?, is_active = ?, 
           salaryrange = ?, type = ?, description = ?, vacantposts = ?, 
           jobtitle = ?, keyresponsibilities = ?
       WHERE roleid = ? AND orgid = ?`,
      [
        rolename, is_active, salaryrange, type, 
        description, vacantposts, jobtitle, keyresponsibilities, roleid, orgId
      ]
    );

    // Update role_menu_permissions
    await pool.query(
      'DELETE FROM role_menu_permissions WHERE roleid = ?',
      [roleid]
    );

    for (const perm of permissions) {
      if (perm.menuid) {
        await pool.query(
          `INSERT INTO role_menu_permissions (roleid, menuid, submenuid, CREATED_DATE) 
           VALUES (?, ?, ?, CURRENT_TIMESTAMP)`,
          [roleid, perm.menuid, perm.submenuid || null]
        );
      }
    }

    console.log(`Role updated: roleid ${roleid}`);
    return { success: true };
  } catch (error) {
    console.error('Error updating role:', error.message);
    return { error: `Failed to update role: ${error.message}` };
  }
}
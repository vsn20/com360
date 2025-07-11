"use server";

import DBconnection from "@/app/utils/config/db";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

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
      `SELECT DISTINCT roleid, orgid, rolename, is_active, CREATED_DATE 
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
      `SELECT roleid, orgid, rolename, isadmin, is_active, CREATED_DATE, 
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

    console.log(`Fetching admin role menus and submenus for orgId: ${orgId}`);

    const pool = await DBconnection();
    console.log("MySQL connection pool acquired");

    // Find the admin role for the organization
    const [adminRoleRows] = await pool.execute(
      `SELECT roleid 
       FROM org_role_table 
       WHERE orgid = ? AND isadmin = 1 AND is_active = 1`,
      [orgId]
    );

    if (adminRoleRows.length === 0) {
      console.log('No active admin role found for orgId:', orgId);
      throw new Error('No active admin role found for this organization.');
    }

    const adminRoleId = adminRoleRows[0].roleid;

    // Fetch menus assigned to the admin role
    const [menuRows] = await pool.execute(
      `SELECT DISTINCT m.id AS menuid, m.name AS menuname, m.url AS menuurl, m.hassubmenu 
       FROM menu m 
       JOIN role_menu_permissions rmp ON m.id = rmp.menuid 
       WHERE rmp.roleid = ? AND m.is_active = 1`,
      [adminRoleId]
    );

    // Fetch submenus assigned to the admin role
    const [submenuRows] = await pool.execute(
      `SELECT DISTINCT sm.id AS submenuid, sm.name AS submenuname, sm.url AS submenuurl, sm.menuid 
       FROM submenu sm 
       JOIN role_menu_permissions rmp ON sm.id = rmp.submenuid 
       WHERE rmp.roleid = ? AND sm.is_active = 1`,
      [adminRoleId]
    );

    console.log('Fetched admin role menus:', menuRows, 'Submenus:', submenuRows);
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
    const permissions = JSON.parse(formData.get('permissions') || '[]');

    console.log("Form data received:", {
      roleid, rolename, is_active, permissions
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

    const pool = await DBconnection();
    console.log("MySQL connection pool acquired");

    // Check if role exists and is not admin
    const [existing] = await pool.execute(
      'SELECT roleid, isadmin FROM org_role_table WHERE roleid = ? AND orgid = ?',
      [roleid, orgId]
    );
    if (existing.length === 0) {
      console.log('Role not found');
      return { error: 'Role not found.' };
    }
    if (existing[0].isadmin === 1) {
      console.log('Cannot update admin role');
      return { error: 'Cannot update admin role.' };
    }

    // Update role details only if rolename is provided (i.e., updating role details)
    if (rolename !== null) {
      if (!rolename) return { error: 'Role name is required.' };

      // Check for duplicate rolename within the same orgid
      const [duplicateRole] = await pool.execute(
        'SELECT roleid FROM org_role_table WHERE rolename = ? AND orgid = ? AND roleid != ?',
        [rolename, orgId, roleid]
      );
      if (duplicateRole.length > 0) {
        console.log('Role name already exists');
        return { error: 'Role name already exists for this organization.' };
      }

      await pool.query(
        `UPDATE org_role_table 
         SET rolename = ?, is_active = ?
         WHERE roleid = ? AND orgid = ?`,
        [rolename, is_active, roleid, orgId]
      );
    }

    // Update permissions if provided
    if (permissions.length >= 0) {
      // Fetch existing permissions for the role
      const [existingPermissions] = await pool.execute(
        `SELECT menuid, submenuid 
         FROM role_menu_permissions 
         WHERE roleid = ?`,
        [roleid]
      );

      // Create sets for comparison
      const existingPermissionSet = new Set(
        existingPermissions.map(p => `${p.menuid}:${p.submenuid || 'null'}`)
      );
      const newPermissionSet = new Set(
        permissions.map(p => `${p.menuid}:${p.submenuid || 'null'}`)
      );

      // Delete permissions that are in the database but not in the new permissions
      const permissionsToDelete = existingPermissions.filter(
        p => !newPermissionSet.has(`${p.menuid}:${p.submenuid || 'null'}`)
      );
      for (const perm of permissionsToDelete) {
        await pool.query(
          `DELETE FROM role_menu_permissions 
           WHERE roleid = ? AND menuid = ? AND (submenuid = ? OR (submenuid IS NULL AND ? IS NULL))`,
          [roleid, perm.menuid, perm.submenuid, perm.submenuid]
        );
      }

      // Insert only new permissions
      const newPermissions = permissions.filter(
        p => !existingPermissionSet.has(`${p.menuid}:${p.submenuid || 'null'}`)
      );
      for (const perm of newPermissions) {
        if (perm.menuid) {
          await pool.query(
            `INSERT INTO role_menu_permissions (roleid, menuid, submenuid, CREATED_DATE) 
             VALUES (?, ?, ?, CURRENT_TIMESTAMP)`,
            [roleid, perm.menuid, perm.submenuid || null]
          );
        }
      }
    }

    console.log(`Role updated: roleid ${roleid}`);
    return { success: true };
  } catch (error) {
    console.error('Error updating role:', error.message);
    return { error: `Failed to update role: ${error.message}` };
  }
}

export async function addRole(formData) {
  const roleName = formData.get('roleName');
  const permissionsJson = formData.get('permissions');
  const currentRole = formData.get('currentRole');
  const orgid = formData.get('orgid');
  const isadmin = 0;

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

  const effectiveOrgid = orgid || decoded.orgid;

  if (!roleName || roleName.trim() === '') {
    console.log('Role name is required');
    return { error: 'Role name is required.' };
  }

  if (!permissionsJson) {
    console.log('No permissions selected');
    return { error: 'Please select at least one feature.' };
  }

  let permissions = [];
  try {
    permissions = JSON.parse(permissionsJson);
    if (!Array.isArray(permissions)) {
      throw new Error('Invalid permissions format');
    }
  } catch (error) {
    console.error('Error parsing permissions:', error);
    return { error: 'Invalid permissions data.' };
  }

  const pool = await DBconnection();
  let connection;
  try {
    connection = await pool.getConnection();
    console.log('Acquired connection for queries:', connection);

    // Validate that each selected menu with hassubmenu='yes' has at least one submenu
    const menuIds = [...new Set(permissions.map(p => p.menuid))];
    const [menuRows] = await connection.query(
      'SELECT id, hassubmenu FROM menu WHERE id IN (?)',
      [menuIds]
    );
    const featureMap = menuRows.reduce((map, row) => {
      map[row.id] = row.hassubmenu;
      return map;
    }, {});

    const invalidSelections = menuIds
      .filter(id => featureMap[id] === 'yes')
      .filter(id => permissions.filter(p => p.menuid === id && p.submenuid).length === 0);
    if (invalidSelections.length > 0) {
      console.log('Invalid selections:', invalidSelections);
      return { error: 'Please select at least one submenu for each feature with submenus.' };
    }

    // Check if role name already exists for this orgid
    const [existingRole] = await connection.query(
      'SELECT roleid FROM org_role_table WHERE orgid = ? AND rolename = ?',
      [effectiveOrgid, roleName]
    );
    if (existingRole.length > 0) {
      console.log('Role name already exists');
      return { error: 'Role name already exists.' };
    }

    // Generate new roleid in format orgid-(number of roles + 1)
    const [roleCountRows] = await connection.query(
      'SELECT COUNT(*) AS count FROM org_role_table WHERE orgid = ?',
      [effectiveOrgid]
    );
    const roleCount = roleCountRows[0].count;
    const newRoleId = `${effectiveOrgid}-${roleCount + 1}`;

    // Insert into org_role_table
    const [roleResult] = await connection.query(
      'INSERT INTO org_role_table (roleid, orgid, rolename, isadmin) VALUES (?, ?, ?, ?)',
      [newRoleId, effectiveOrgid, roleName, isadmin]
    );
    console.log('Role added successfully, newRoleId:', newRoleId);

    // Insert permissions into role_menu_permissions
    const permissionValues = permissions.map(p => [newRoleId, p.menuid, p.submenuid]);
    if (permissionValues.length > 0) {
      await connection.query(
        'INSERT INTO role_menu_permissions (roleid, menuid, submenuid) VALUES ?',
        [permissionValues]
      );
      console.log('Permissions added successfully for roleId:', newRoleId);
    }

  } catch (error) {
    console.error('Error adding role or permissions:', error);
    return { error: `Failed to add role: ${error.message}` };
  } finally {
    if (connection) {
      connection.release(); // Release the connection back to the pool
    }
  }

  return redirect(`/userscreens/roles/addroles?success=Role%20added%20successfully`);
}
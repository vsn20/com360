"use server";

import DBconnection from "@/app/utils/config/db";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

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
    const cookieStore = await cookies();
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
       FROM C_ORG_ROLE_TABLE 
       WHERE orgid = ?`,
      [orgId]
    );
    console.log('Fetched roles:', rows);
    return rows;
  } catch (error) {
    console.error('Error fetching roles:', error.message);
    throw new Error(`Failed to fetch roles: ${error.message}`);
  }
}

export async function fetchRoleById(roleid) {
  try {
    const cookieStore = await cookies();
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

    const [roleRows] = await pool.execute(
      `SELECT roleid, orgid, rolename, isadmin, is_active, CREATED_DATE, 
              salaryrange, type, description, vacantposts, jobtitle, keyresponsibilities 
       FROM C_ORG_ROLE_TABLE 
       WHERE roleid = ? AND orgid = ?`,
      [roleid, orgId]
    );

    if (roleRows.length === 0) {
      console.log('Role not found');
      throw new Error('Role not found.');
    }

    // MODIFIED: Added teamdata and individualdata to the SELECT statement
    const [permissionRows] = await pool.execute(
      `SELECT menuid, submenuid, alldata, teamdata, individualdata
       FROM C_ROLE_MENU_PERMISSIONS 
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
    const cookieStore = await cookies();
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

    const [adminRoleRows] = await pool.execute(
      `SELECT roleid 
       FROM C_ORG_ROLE_TABLE 
       WHERE orgid = ? AND isadmin = 1`,
      [orgId]
    );

    if (adminRoleRows.length === 0) {
      console.log('No active admin role found for orgId:', orgId);
      throw new Error('No active admin role found for this organization.');
    }

    const adminRoleId = adminRoleRows[0].roleid;

    const [menuRows] = await pool.execute(
      `SELECT DISTINCT m.id AS menuid, m.name AS menuname, m.url AS menuurl, m.hassubmenu 
       FROM C_MENU m 
       JOIN C_ROLE_MENU_PERMISSIONS rmp ON m.id = rmp.menuid 
       WHERE rmp.roleid = ?`,
      [adminRoleId]
    );

    const [submenuRows] = await pool.execute(
      `SELECT DISTINCT sm.id AS submenuid, sm.name AS submenuname, sm.url AS submenuurl, sm.menuid 
       FROM C_SUBMENU sm 
       JOIN C_ROLE_MENU_PERMISSIONS rmp ON sm.id = rmp.submenuid 
       WHERE rmp.roleid = ?`,
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

    const cookieStore = await cookies();
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

    if (!roleid) return { error: 'Role ID is required.' };

    const pool = await DBconnection();
    console.log("MySQL connection pool acquired");

    const [existing] = await pool.execute(
      'SELECT roleid, isadmin FROM C_ORG_ROLE_TABLE WHERE roleid = ? AND orgid = ?',
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

    if (rolename !== null) {
      if (!rolename) return { error: 'Role name is required.' };

      const [duplicateRole] = await pool.execute(
        'SELECT roleid FROM C_ORG_ROLE_TABLE WHERE rolename = ? AND orgid = ? AND roleid != ?',
        [rolename, orgId, roleid]
      );
      if (duplicateRole.length > 0) {
        console.log('Role name already exists');
        return { error: 'Role name already exists for this organization.' };
      }

      await pool.query(
        `UPDATE C_ORG_ROLE_TABLE 
         SET rolename = ?, is_active = ?
         WHERE roleid = ? AND orgid = ?`,
        [rolename, is_active, roleid, orgId]
      );
    }

    if (permissions.length >= 0) {
      // MODIFIED: Fetching new columns to compare for updates
      const [existingPermissions] = await pool.execute(
        `SELECT menuid, submenuid, alldata, teamdata, individualdata
         FROM C_ROLE_MENU_PERMISSIONS 
         WHERE roleid = ?`,
        [roleid]
      );

      const existingPermissionSet = new Set(
        existingPermissions.map(p => `${p.menuid}:${p.submenuid || 'null'}`)
      );
      const newPermissionSet = new Set(
        permissions.map(p => `${p.menuid}:${p.submenuid || 'null'}`)
      );

      const permissionsToDelete = existingPermissions.filter(
        p => !newPermissionSet.has(`${p.menuid}:${p.submenuid || 'null'}`)
      );
      for (const perm of permissionsToDelete) {
        await pool.query(
          `DELETE FROM C_ROLE_MENU_PERMISSIONS 
           WHERE roleid = ? AND menuid = ? AND (submenuid = ? OR (submenuid IS NULL AND ? IS NULL))`,
          [roleid, perm.menuid, perm.submenuid, perm.submenuid]
        );
      }

      const newPermissions = permissions.filter(
        p => !existingPermissionSet.has(`${p.menuid}:${p.submenuid || 'null'}`)
      );
      for (const perm of newPermissions) {
        if (perm.menuid) {
          // MODIFIED: Inserting new columns
          await pool.query(
            `INSERT INTO C_ROLE_MENU_PERMISSIONS (roleid, menuid, submenuid, alldata, teamdata, individualdata, CREATED_DATE) 
             VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
            [roleid, perm.menuid, perm.submenuid || null, perm.alldata || 0, perm.teamdata || 0, perm.individualdata || 0]
          );
        }
      }

      // MODIFIED: Update alldata, teamdata, and individualdata for existing permissions
      const permissionsToUpdate = permissions.filter(p => {
        const existingPerm = existingPermissions.find(ep => 
          ep.menuid === p.menuid && (ep.submenuid || null) === (p.submenuid || null)
        );
        return existingPerm && (
          p.alldata !== existingPerm.alldata ||
          p.teamdata !== existingPerm.teamdata ||
          p.individualdata !== existingPerm.individualdata
        );
      });

      for (const perm of permissionsToUpdate) {
        await pool.query(
          `UPDATE C_ROLE_MENU_PERMISSIONS 
           SET alldata = ?, teamdata = ?, individualdata = ?
           WHERE roleid = ? AND menuid = ? AND (submenuid = ? OR (submenuid IS NULL AND ? IS NULL))`,
          [perm.alldata || 0, perm.teamdata || 0, perm.individualdata || 0, roleid, perm.menuid, perm.submenuid, perm.submenuid]
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

export async function addRole(formData) {
  const roleName = formData.get('roleName');
  const permissionsJson = formData.get('permissions');
  const currentRole = formData.get('currentRole');
  const orgid = formData.get('orgid');
  const isadmin = 0;

  const cookieStore = await cookies();
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

    const menuIds = [...new Set(permissions.map(p => p.menuid))];
    const [menuRows] = await connection.query(
      'SELECT id, hassubmenu FROM C_MENU WHERE id IN (?)',
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
      return { error: 'Please select at least one C_SUBMENU for each feature with submenus.' };
    }

    const [existingRole] = await connection.query(
      'SELECT roleid FROM C_ORG_ROLE_TABLE WHERE orgid = ? AND rolename = ?',
      [effectiveOrgid, roleName]
    );
    if (existingRole.length > 0) {
      console.log('Role name already exists');
      return { error: 'Role name already exists.' };
    }

    const [roleCountRows] = await connection.query(
      'SELECT COUNT(*) AS count FROM C_ORG_ROLE_TABLE WHERE orgid = ?',
      [effectiveOrgid]
    );
    const roleCount = roleCountRows[0].count;
    const newRoleId = `${effectiveOrgid}-${roleCount + 1}`;

    const [roleResult] = await connection.query(
      'INSERT INTO C_ORG_ROLE_TABLE (roleid, orgid, rolename, isadmin) VALUES (?, ?, ?, ?)',
      [newRoleId, effectiveOrgid, roleName, isadmin]
    );
    console.log('Role added successfully, newRoleId:', newRoleId);

    // MODIFIED: Adding teamdata and individualdata to the permission values
    const permissionValues = permissions.map(p => [newRoleId, p.menuid, p.submenuid || null, p.alldata || 0, p.teamdata || 0, p.individualdata || 0]);
    if (permissionValues.length > 0) {
      // MODIFIED: Added teamdata and individualdata to the INSERT statement
      await connection.query(
        'INSERT INTO C_ROLE_MENU_PERMISSIONS (roleid, menuid, submenuid, alldata, teamdata, individualdata) VALUES ?',
        [permissionValues]
      );
      console.log('Permissions added successfully for roleId:', newRoleId);
    }
  } catch (error) {
    console.error('Error adding role or permissions:', error);
    return { error: `Failed to add role: ${error.message}` };
  } 
}
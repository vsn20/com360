'use server';

import DBconnection from "../utils/config/db";
import { redirect } from "next/navigation";
import { cookies } from 'next/headers';

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

export async function addRole(formData) {
  const roleName = formData.get('roleName');
  const selectedFeatures = formData.getAll('features'); // Array of selected feature IDs
  const currentRole = formData.get('currentRole');
  const isadmin = 0;

  // Get the JWT token from cookies
  const cookieStore = cookies();
  const token = cookieStore.get('jwt_token')?.value;

  if (!token) {
    console.log('Redirecting: No token found');
    return redirect(`/homepage/${currentRole}/role/addrole?error=No%20token%20found.%20Please%20log%20in.`);
  }

  // Decode the token to get the roleid
  const decoded = decodeJwt(token);
  if (!decoded || !decoded.roleid) {
    console.log('Redirecting: Invalid token or roleid not found');
    return redirect(`/homepage/${currentRole}/role/addrole?error=Invalid%20token%20or%20roleid%20not%20found.`);
  }

  const roleid = decoded.roleid; // e.g., 1 for naman

  // Fetch the orgid from org_role_table using the roleid
  let orgid;
  try {
    const pool = await DBconnection();
    const [roleRows] = await pool.query(
      'SELECT orgid FROM org_role_table WHERE roleid = ? LIMIT 1',
      [roleid]
    );

    if (!roleRows || roleRows.length === 0) {
      console.log('Redirecting: Organization not found');
      return redirect(`/homepage/${currentRole}/role/addrole?error=Organization%20not%20found%20for%20this%20role.`);
    }

    orgid = roleRows[0].orgid;
  } catch (error) {
    console.error('Error fetching orgid:', error);
    console.log('Redirecting: Failed to fetch orgid');
    return redirect(`/homepage/${currentRole}/role/addrole?error=Failed%20to%20fetch%20organization%20ID:%20${encodeURIComponent(error.message)}`);
  }

  // Validation
  if (!roleName || roleName.trim() === '') {
    console.log('Redirecting: Role name is required');
    return redirect(`/homepage/${currentRole}/role/addrole?error=Role%20name%20is%20required.`);
  }
  if (!selectedFeatures || selectedFeatures.length === 0) {
    console.log('Redirecting: No features selected');
    return redirect(`/homepage/${currentRole}/role/addrole?error=Please%20select%20at%20least%20one%20feature.`);
  }

  let redirectPath = `/homepage/${currentRole}/role`; // Default success path
  try {
    const pool = await DBconnection();

    // Insert the new role into org_role_table
    const [roleResult] = await pool.query(
      'INSERT INTO org_role_table (orgid, rolename, isadmin, CREATED_BY, LAST_UPDATED_BY, MODIFICATION_NUM) VALUES (?, ?, ?, ?, ?, ?)',
      [orgid, roleName, isadmin, 'system', 'system', 1]
    );
    const newRoleId = roleResult.insertId;

    // Fetch hassubmenu for the selected features
    const [menuRows] = await pool.query(
      'SELECT id, hassubmenu FROM sidebarmenu WHERE id IN (?)',
      [selectedFeatures]
    );

    // Map features to determine if they have submenus
    const featureMap = menuRows.reduce((map, row) => {
      map[row.id] = row.hassubmenu;
      return map;
    }, {});

    // Fetch submenu IDs for features that have submenus
    const featuresWithSubmenu = selectedFeatures.filter(id => featureMap[id]);
    let submenuMap = {};
    if (featuresWithSubmenu.length > 0) {
      const [submenuRows] = await pool.query(
        'SELECT id, menuid FROM submenu WHERE menuid IN (?)',
        [featuresWithSubmenu]
      );
      submenuRows.forEach(row => {
        if (!submenuMap[row.menuid]) {
          submenuMap[row.menuid] = row.id; // Take the first submenu ID if multiple exist
        }
      });
    }

    // Insert permissions into role_menu_permissions
    const permissionValues = selectedFeatures.map((featureId) => {
      const hasSubmenu = featureMap[featureId] || false;
      const submenuId = hasSubmenu ? submenuMap[featureId] || null : null;
      return [
        newRoleId,
        featureId, // menuid
        submenuId, // submenuid: NULL if no submenu or no matching submenu ID
        'system',
        'system',
        1, // MODIFICATION_NUM
      ];
    });

    await pool.query(
      'INSERT INTO role_menu_permissions (roleid, menuid, submenuid, CREATED_BY, LAST_UPDATED_BY, MODIFICATION_NUM) VALUES ?',
      [permissionValues]
    );
  } catch (error) {
    console.error('Error adding role:', error);
    // If the error is NEXT_REDIRECT, don't redirect again
    if (error.message && error.message.includes('NEXT_REDIRECT')) {
      console.log('Caught NEXT_REDIRECT error, avoiding second redirect');
      redirectPath = `/homepage/${currentRole}/role/addrole?error=Internal%20redirect%20error`;
    } else {
      redirectPath = `/homepage/${currentRole}/role/addrole?error=Failed%20to%20add%20role:%20${encodeURIComponent(error.message)}`;
    }
  }

  console.log(`Redirecting to: ${redirectPath}`);
  redirect(redirectPath);
}
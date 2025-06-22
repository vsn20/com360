"use server";

import DBconnection from "../utils/config/db";
import { redirect } from "next/navigation";
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

export async function addRole(formData) {
  const roleName = formData.get('roleName');
  const selectedFeatures = formData.getAll('features');
  const selectedSubmenus = formData.getAll('submenus').map(item => {
    const [menuid, submenuId] = item.split(':');
    return { menuid: Number(menuid), submenuid: Number(submenuId) };
  });
  const currentRole = formData.get('currentRole');
  const orgid = formData.get('orgid');
  const isadmin = 0;

  // Get the JWT token from cookies
  const cookieStore = cookies();
  const token = cookieStore.get('jwt_token')?.value;

  if (!token) {
    console.log('No token found');
    return { error: 'No token found. Please log in.' };
  }

  // Decode the token to get the orgid
  const decoded = decodeJwt(token);
  if (!decoded || !decoded.orgid) {
    console.log('Invalid token or orgid not found');
    return { error: 'Invalid token or orgid not found.' };
  }

  // Use orgid from token if form orgid is missing
  const effectiveOrgid = orgid || decoded.orgid;

  // Validation for required fields
  if (!roleName || roleName.trim() === '') {
    console.log('Role name is required');
    return { error: 'Role name is required.' };
  }
  if (!selectedFeatures || selectedFeatures.length === 0) {
    console.log('No features selected');
    return { error: 'Please select at least one feature.' };
  }

  try {
    const pool = await DBconnection();

    // Check if role name already exists for this orgid
    const [existingRole] = await pool.query(
      'SELECT roleid FROM org_role_table WHERE orgid = ? AND rolename = ?',
      [effectiveOrgid, roleName]
    );
    if (existingRole.length > 0) {
      console.log('Role name already exists');
      return { error: 'Role name already exists.' };
    }

    // Insert into org_role_table
    const [roleResult] = await pool.query(
      'INSERT INTO org_role_table (orgid, rolename, isadmin) VALUES (?, ?, ?)',
      [effectiveOrgid, roleName, isadmin]
    );
    const newRoleId = roleResult.insertId;
    console.log('Role added successfully, newRoleId:', newRoleId);

    // Fetch hassubmenu for the selected features
    const [menuRows] = await pool.query(
      'SELECT id, hassubmenu FROM menu WHERE id IN (?)',
      [selectedFeatures]
    );

    const featureMap = menuRows.reduce((map, row) => {
      map[row.id] = row.hassubmenu;
      return map;
    }, {});

    // Prepare permission values
    const permissionValues = [];
    selectedFeatures.forEach((featureId) => {
      const hasSubmenu = featureMap[featureId] === 'yes';
      const selectedSubmenu = selectedSubmenus.find(s => s.menuid === Number(featureId));
      const submenuId = hasSubmenu && selectedSubmenu ? selectedSubmenu.submenuid : null;
      permissionValues.push([newRoleId, Number(featureId), submenuId]);
    });

    // Insert permissions into role_menu_permissions
    if (permissionValues.length > 0) {
      await pool.query(
        'INSERT INTO role_menu_permissions (roleid, menuid, submenuid) VALUES ?',
        [permissionValues]
      );
      console.log('Permissions added successfully for roleId:', newRoleId);
    }

  } catch (error) {
    console.error('Error adding role or permissions:', error);
    return { error: `Failed to add role: ${error.message}` };
  }

  // Redirect to the add role page with success
  return redirect(`/userscreens/roles/addroles?success=Role%20added%20successfully`);
}
'use server';

import DBconnection from "../utils/config/db";
import { cookies } from "next/headers";

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

export async function getAllroles() {
  try {
    const cookieStore = cookies();
    const token = cookieStore.get('jwt_token')?.value;

    if (!token) {
      return { success: false, error: 'No token found. Please log in.' };
    }

    const decoded = decodeJwt(token);
    if (!decoded || !decoded.empid || !decoded.orgid) {
      return { success: false, error: 'Invalid token or empid/orgid not found.' };
    }

    const { empid, orgid } = decoded;

    const pool = await DBconnection();

    // Fetch user's roles from emp_role_assign
    const [roleRows] = await pool.query(
      'SELECT roleid FROM emp_role_assign WHERE empid = ? AND orgid = ?',
      [empid, orgid]
    );

    if (!roleRows || roleRows.length === 0) {
      return { success: false, error: 'No roles assigned to employee.' };
    }

    const roleids = roleRows.map(row => row.roleid);

    // Check if user has an admin role
    const [adminRows] = await pool.query(
      'SELECT isadmin FROM org_role_table WHERE roleid IN (?) AND orgid = ?',
      [roleids, orgid]
    );

    const isAdmin = adminRows.some(row => row.isadmin === 1);
    // if (!isAdmin) {
    //   return { success: false, error: 'User is not authorized to view roles.' };
    // }

    // Fetch all roles for the organization
    const [allRoles] = await pool.query(
      'SELECT roleid, rolename FROM org_role_table WHERE orgid = ?',
      [orgid]
    );

    if (!allRoles || allRoles.length === 0) {
      return { success: true, roles: [] };
    }

    return { success: true, roles: allRoles };
  } catch (error) {
    console.error('Error fetching roles:', error);
    return { success: false, error: 'Failed to fetch roles: ' + error.message };
  }
}
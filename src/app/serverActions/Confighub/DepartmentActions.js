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

/**
 * Fetch all departments for the current organization
 */
export async function fetchDepartments() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('jwt_token')?.value;

    if (!token) {
      throw new Error('No token found. Please log in.');
    }

    const decoded = decodeJwt(token);
    if (!decoded || !decoded.orgid) {
      throw new Error('Invalid token or orgid not found.');
    }

    const orgId = decoded.orgid;
    const pool = await DBconnection();

    const [rows] = await pool.execute(
      `SELECT id, name, orgid, isactive
       FROM C_ORG_DEPARTMENTS
       WHERE orgid = ?
       ORDER BY name`,
      [orgId]
    );

    console.log(`Fetched ${rows.length} departments for orgId: ${orgId}`);
    return rows;
  } catch (error) {
    console.error('Error fetching departments:', error.message);
    throw new Error(`Failed to fetch departments: ${error.message}`);
  }
}

/**
 * Add a new department
 */
export async function addDepartment(prevState, formData) {
  try {
    const name = formData.get('name');
    const isactive = formData.get('isactive') === 'true';

    const cookieStore = await cookies();
    const token = cookieStore.get('jwt_token')?.value;

    if (!token) {
      return { error: 'No token found. Please log in.' };
    }

    const decoded = decodeJwt(token);
    if (!decoded || !decoded.orgid) {
      return { error: 'Invalid token or orgid not found.' };
    }

    const orgId = decoded.orgid;

    if (!name || name.trim() === '') {
      return { error: 'Department name is required.' };
    }

    const pool = await DBconnection();

    // Check for duplicate department name (case-insensitive)
    const [existing] = await pool.execute(
      'SELECT id FROM C_ORG_DEPARTMENTS WHERE LOWER(name) = LOWER(?) AND orgid = ?',
      [name.trim(), orgId]
    );

    if (existing.length > 0) {
      return { error: 'A department with this name already exists.' };
    }

    // Generate unique ID (orgid-timestamp-random)
    const uniqueId = `${orgId}-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

    // Insert new department
    await pool.query(
      `INSERT INTO C_ORG_DEPARTMENTS (id, name, orgid, isactive)
       VALUES (?, ?, ?, ?)`,
      [uniqueId, name.trim(), orgId, isactive ? 1 : 0]
    );

    console.log(`Department added: ${name} with id: ${uniqueId}`);
    return { success: true, id: uniqueId, name: name.trim(), isactive };
  } catch (error) {
    console.error('Error adding department:', error.message);
    return { error: `Failed to add department: ${error.message}` };
  }
}

/**
 * Update an existing department
 */
export async function updateDepartment(prevState, formData) {
  try {
    const id = formData.get('id');
    const name = formData.get('name');
    const isactive = formData.get('isactive') === 'true';

    const cookieStore = await cookies();
    const token = cookieStore.get('jwt_token')?.value;

    if (!token) {
      return { error: 'No token found. Please log in.' };
    }

    const decoded = decodeJwt(token);
    if (!decoded || !decoded.orgid) {
      return { error: 'Invalid token or orgid not found.' };
    }

    const orgId = decoded.orgid;

    if (!id) {
      return { error: 'Department ID is required.' };
    }

    if (!name || name.trim() === '') {
      return { error: 'Department name is required.' };
    }

    const pool = await DBconnection();

    // Check if department exists and belongs to this org
    const [existingDept] = await pool.execute(
      'SELECT id FROM C_ORG_DEPARTMENTS WHERE id = ? AND orgid = ?',
      [id, orgId]
    );

    if (existingDept.length === 0) {
      return { error: 'Department not found.' };
    }

    // Check for duplicate name (excluding current department)
    const [duplicate] = await pool.execute(
      'SELECT id FROM C_ORG_DEPARTMENTS WHERE LOWER(name) = LOWER(?) AND orgid = ? AND id != ?',
      [name.trim(), orgId, id]
    );

    if (duplicate.length > 0) {
      return { error: 'A department with this name already exists.' };
    }

    // Update department
    await pool.query(
      `UPDATE C_ORG_DEPARTMENTS SET name = ?, isactive = ? WHERE id = ? AND orgid = ?`,
      [name.trim(), isactive ? 1 : 0, id, orgId]
    );

    console.log(`Department updated: id ${id}, name ${name}`);
    return { success: true, id, name: name.trim(), isactive };
  } catch (error) {
    console.error('Error updating department:', error.message);
    return { error: `Failed to update department: ${error.message}` };
  }
}

/**
 * Delete a department (soft delete by setting isactive = 0)
 */
export async function deleteDepartment(id) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('jwt_token')?.value;

    if (!token) {
      return { error: 'No token found. Please log in.' };
    }

    const decoded = decodeJwt(token);
    if (!decoded || !decoded.orgid) {
      return { error: 'Invalid token or orgid not found.' };
    }

    const orgId = decoded.orgid;

    if (!id) {
      return { error: 'Department ID is required.' };
    }

    const pool = await DBconnection();

    // Check if department exists and belongs to this org
    const [existingDept] = await pool.execute(
      'SELECT id FROM C_ORG_DEPARTMENTS WHERE id = ? AND orgid = ?',
      [id, orgId]
    );

    if (existingDept.length === 0) {
      return { error: 'Department not found.' };
    }

    // Soft delete by setting isactive = 0
    await pool.query(
      `UPDATE C_ORG_DEPARTMENTS SET isactive = 0 WHERE id = ? AND orgid = ?`,
      [id, orgId]
    );

    console.log(`Department soft deleted: id ${id}`);
    return { success: true };
  } catch (error) {
    console.error('Error deleting department:', error.message);
    return { error: `Failed to delete department: ${error.message}` };
  }
}

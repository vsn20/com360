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

export async function fetchConfigData() {
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

    console.log(`Fetching configuration data for orgId: ${orgId}`);

    const pool = await DBconnection();
    console.log("MySQL connection pool acquired");
    const [rows] = await pool.execute(
      `SELECT gn.g_id, gn.Name AS category, gv.id, gv.Name AS value, gv.isactive
       FROM C_GENERIC_NAMES gn
       LEFT JOIN C_GENERIC_VALUES gv ON gn.g_id = gv.g_id AND gv.orgid = ?
       ORDER BY gn.Name, gv.Name`,
      [orgId]
    );
    console.log('Fetched configuration data:', rows);
    return rows;
  } catch (error) {
    console.error('Error fetching configuration data:', error.message);
    throw new Error(`Failed to fetch configuration data: ${error.message}`);
  }
}

export async function addConfigValue(prevState, formData) {
  try {
    const g_id = formData.get('g_id');
    const valueName = formData.get('valueName');
    const isactive = formData.get('isactive') === 'true'; // Convert string to boolean

    console.log("Form data received:", { g_id, valueName, isactive });

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

    if (!g_id) return { error: 'Category ID is required.' };
    if (!valueName) return { error: 'Value name is required.' };

    const pool = await DBconnection();
    console.log("MySQL connection pool acquired");

    // Check if category exists
    const [category] = await pool.execute(
      'SELECT g_id FROM C_GENERIC_NAMES WHERE g_id = ?',
      [g_id]
    );
    if (category.length === 0) {
      console.log('Category not found');
      return { error: 'Category not found.' };
    }

    // Check for duplicate value
    const [existing] = await pool.execute(
      'SELECT id FROM C_GENERIC_VALUES WHERE g_id = ? AND Name = ? AND orgid = ?',
      [g_id, valueName, orgId]
    );
    if (existing.length > 0) {
      console.log('Value already exists');
      return { error: 'Value already exists for this category.' };
    }

    // Insert new value
    await pool.query(
      `INSERT INTO C_GENERIC_VALUES (g_id, Name, isactive, orgid, cutting)
       VALUES (?, ?, ?, ?, NULL)`,
      [g_id, valueName, isactive, orgId]
    );
    console.log(`Config value added: g_id ${g_id}, value ${valueName}`);
    return { success: true, g_id, valueName, isactive };
  } catch (error) {
    console.error('Error adding configuration value:', error.message);
    return { error: `Failed to add configuration value: ${error.message}` };
  }
}

export async function updateConfigValue(prevState, formData) {
  try {
    const id = formData.get('id');
    const g_id = formData.get('g_id');
    const valueName = formData.get('valueName');
    const isactive = formData.get('isactive') === 'true'; // Convert string to boolean

    console.log("Form data received for update:", { id, g_id, valueName, isactive });

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

    if (!id) return { error: 'Value ID is required.' };
    if (!g_id) return { error: 'Category ID is required.' };
    if (!valueName) return { error: 'Value name is required.' };

    const pool = await DBconnection();
    console.log("MySQL connection pool acquired");

    // Check if category exists
    const [category] = await pool.execute(
      'SELECT g_id FROM C_GENERIC_NAMES WHERE g_id = ?',
      [g_id]
    );
    if (category.length === 0) {
      console.log('Category not found');
      return { error: 'Category not found.' };
    }

    // Check if value exists
    const [existingValue] = await pool.execute(
      'SELECT id FROM C_GENERIC_VALUES WHERE id = ? AND g_id = ? AND orgid = ?',
      [id, g_id, orgId]
    );
    if (existingValue.length === 0) {
      console.log('Value not found');
      return { error: 'Value not found.' };
    }

    // Check for duplicate value (excluding current id)
    const [duplicate] = await pool.execute(
      'SELECT id FROM C_GENERIC_VALUES WHERE g_id = ? AND Name = ? AND orgid = ? AND id != ?',
      [g_id, valueName, orgId, id]
    );
    if (duplicate.length > 0) {
      console.log('Value already exists');
      return { error: 'Value already exists for this category.' };
    }

    // Update value
    await pool.query(
      `UPDATE C_GENERIC_VALUES SET Name = ?, isactive = ? WHERE id = ? AND g_id = ? AND orgid = ?`,
      [valueName, isactive, id, g_id, orgId]
    );
    console.log(`Config value updated: id ${id}, g_id ${g_id}, value ${valueName}`);
    return { success: true, id, g_id, valueName, isactive };
  } catch (error) {
    console.error('Error updating configuration value:', error.message);
    return { error: `Failed to update configuration value: ${error.message}` };
  }
}
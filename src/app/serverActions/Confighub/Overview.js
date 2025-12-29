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

// Helper function to convert bit fields to boolean
const convertBitToBoolean = (bitValue) => {
  if (bitValue === null || bitValue === undefined) return false;
  if (typeof bitValue === 'number') return bitValue === 1;
  if (Buffer.isBuffer(bitValue)) return bitValue[0] === 1;
  if (bitValue instanceof Uint8Array) return bitValue[0] === 1;
  return Boolean(bitValue);
};

// Fetch generic names for a specific category
export async function fetchGenericNames(category) {
  try {
    const cookieStore = cookies();
    const token = cookieStore.get('jwt_token')?.value;

    if (!token) {
      throw new Error('No token found. Please log in.');
    }

    const decoded = decodeJwt(token);
    if (!decoded || !decoded.orgid) {
      throw new Error('Invalid token or orgid not found.');
    }

    const pool = await DBconnection();
    const [rows] = await pool.execute(
      `SELECT g_id, Name, category, child_gid, single_value, active, description
       FROM C_GENERIC_NAMES
       WHERE category = ? AND active = 1 AND g_id NOT IN (15, 16, 17)
       ORDER BY Name`,
      [category]
    );
    
    // Convert bit fields to boolean for client compatibility
    const processedRows = rows.map(row => ({
      ...row,
      single_value: convertBitToBoolean(row.single_value),
      active: convertBitToBoolean(row.active)
    }));
    
    console.log(`Fetched ${processedRows.length} generic names for category: ${category}`);
    return processedRows;
  } catch (error) {
    console.error('Error fetching generic names:', error.message);
    throw new Error(`Failed to fetch generic names: ${error.message}`);
  }
}

// Fetch all configuration data (generic values)
export async function fetchConfigData() {
  try {
    const cookieStore = cookies();
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
    // Fetch both user's org values AND system defaults (orgid=-1)
    const [rows] = await pool.execute(
      `SELECT id, g_id, Name, isactive, parent_value_id, display_order, orgid
       FROM C_GENERIC_VALUES
       WHERE (orgid = ? OR orgid = -1) AND g_id NOT IN (15, 16, 17)
       ORDER BY g_id, orgid DESC, display_order, Name`,
      [orgId]
    );
    
    // Mark default values (orgid=-1) as isDefault for UI to handle
    const processedRows = rows.map(row => ({
      ...row,
      isDefault: row.orgid === -1
    }));
    
    console.log(`Fetched ${processedRows.length} configuration values (including defaults) for orgId: ${orgId}`);
    return processedRows;
  } catch (error) {
    console.error('Error fetching configuration data:', error.message);
    throw new Error(`Failed to fetch configuration data: ${error.message}`);
  }
}

// Add new configuration value
export async function addConfigValue(prevState, formData) {
  try {
    const g_id = formData.get('g_id');
    const valueName = formData.get('valueName');
    const isactive = formData.get('isactive') === 'true';
    const parent_value_id = formData.get('parent_value_id') || null;

    console.log("Form data received:", { g_id, valueName, isactive, parent_value_id });

    const cookieStore = cookies();
    const token = cookieStore.get('jwt_token')?.value;

    if (!token) {
      return { error: 'No token found. Please log in.' };
    }

    const decoded = decodeJwt(token);
    if (!decoded || !decoded.orgid) {
      return { error: 'Invalid token or orgid not found.' };
    }

    const orgId = decoded.orgid;

    if (!g_id) return { error: 'Category ID is required.' };
    if (!valueName) return { error: 'Value name is required.' };

    const pool = await DBconnection();

    // Check if category exists and get single_value restriction
    const [category] = await pool.execute(
      'SELECT g_id, single_value FROM C_GENERIC_NAMES WHERE g_id = ?',
      [g_id]
    );
    if (category.length === 0) {
      return { error: 'Category not found.' };
    }

    // Check single_value restriction
    const singleValue = convertBitToBoolean(category[0].single_value);
    if (singleValue) {
      // Check if a value already exists for this g_id and context
      const [existingCount] = await pool.execute(
        'SELECT COUNT(*) as count FROM C_GENERIC_VALUES WHERE g_id = ? AND orgid = ? AND (parent_value_id = ? OR (parent_value_id IS NULL AND ? IS NULL))',
        [g_id, orgId, parent_value_id, parent_value_id]
      );
      
      if (existingCount[0].count > 0) {
        return { error: 'Cannot add new value. This configuration allows only a single value. Please edit the existing value instead.' };
      }
    }

    // Check for duplicate value in same context (same g_id, parent_value_id, and orgid)
    const [existing] = await pool.execute(
      'SELECT id FROM C_GENERIC_VALUES WHERE g_id = ? AND Name = ? AND orgid = ? AND (parent_value_id = ? OR (parent_value_id IS NULL AND ? IS NULL))',
      [g_id, valueName, orgId, parent_value_id, parent_value_id]
    );
    if (existing.length > 0) {
      return { error: 'Value already exists in this context.' };
    }

    // Check for case-insensitive duplicate against system defaults (orgid=-1)
    const [defaultDuplicate] = await pool.execute(
      'SELECT id, Name FROM C_GENERIC_VALUES WHERE g_id = ? AND LOWER(Name) = LOWER(?) AND orgid = -1 AND (parent_value_id = ? OR (parent_value_id IS NULL AND ? IS NULL))',
      [g_id, valueName, parent_value_id, parent_value_id]
    );
    if (defaultDuplicate.length > 0) {
      return { error: `Cannot add value. "${defaultDuplicate[0].Name}" already exists as a system default.` };
    }

    // Get max display_order for this context
    const [maxOrder] = await pool.execute(
      'SELECT MAX(display_order) as max_order FROM C_GENERIC_VALUES WHERE g_id = ? AND orgid = ? AND (parent_value_id = ? OR (parent_value_id IS NULL AND ? IS NULL))',
      [g_id, orgId, parent_value_id, parent_value_id]
    );
    const nextOrder = (maxOrder[0].max_order || 0) + 1;

    // Insert new value
    await pool.query(
      `INSERT INTO C_GENERIC_VALUES (g_id, Name, isactive, orgid, parent_value_id, display_order, cutting)
       VALUES (?, ?, ?, ?, ?, ?, NULL)`,
      [g_id, valueName, isactive, orgId, parent_value_id, nextOrder]
    );
    
    console.log(`Config value added: g_id ${g_id}, value ${valueName}, order ${nextOrder}`);
    return { success: true, g_id, valueName, isactive, parent_value_id, display_order: nextOrder };
  } catch (error) {
    console.error('Error adding configuration value:', error.message);
    return { error: `Failed to add configuration value: ${error.message}` };
  }
}

// Update configuration value
export async function updateConfigValue(prevState, formData) {
  try {
    const id = formData.get('id');
    const g_id = formData.get('g_id');
    const valueName = formData.get('valueName');
    const isactive = formData.get('isactive') === 'true';
    const parent_value_id = formData.get('parent_value_id') || null;

    console.log("Form data received for update:", { id, g_id, valueName, isactive, parent_value_id });

    const cookieStore = cookies();
    const token = cookieStore.get('jwt_token')?.value;

    if (!token) {
      return { error: 'No token found. Please log in.' };
    }

    const decoded = decodeJwt(token);
    if (!decoded || !decoded.orgid) {
      return { error: 'Invalid token or orgid not found.' };
    }

    const orgId = decoded.orgid;

    if (!id) return { error: 'Value ID is required.' };
    if (!g_id) return { error: 'Category ID is required.' };
    if (!valueName) return { error: 'Value name is required.' };

    const pool = await DBconnection();

    // Check if value exists
    const [existingValue] = await pool.execute(
      'SELECT id FROM C_GENERIC_VALUES WHERE id = ? AND g_id = ? AND orgid = ?',
      [id, g_id, orgId]
    );
    if (existingValue.length === 0) {
      return { error: 'Value not found.' };
    }

    // Check for duplicate value (excluding current id)
    const [duplicate] = await pool.execute(
      'SELECT id FROM C_GENERIC_VALUES WHERE g_id = ? AND Name = ? AND orgid = ? AND id != ? AND (parent_value_id = ? OR (parent_value_id IS NULL AND ? IS NULL))',
      [g_id, valueName, orgId, id, parent_value_id, parent_value_id]
    );
    if (duplicate.length > 0) {
      return { error: 'Value already exists in this context.' };
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

// Update display order for multiple values (drag-drop)
export async function updateDisplayOrder(orderUpdates) {
  try {
    const cookieStore = cookies();
    const token = cookieStore.get('jwt_token')?.value;

    if (!token) {
      return { error: 'No token found. Please log in.' };
    }

    const decoded = decodeJwt(token);
    if (!decoded || !decoded.orgid) {
      return { error: 'Invalid token or orgid not found.' };
    }

    const orgId = decoded.orgid;
    const pool = await DBconnection();

    // Update each item's display_order
    for (const update of orderUpdates) {
      await pool.query(
        `UPDATE C_GENERIC_VALUES SET display_order = ? WHERE id = ? AND orgid = ?`,
        [update.display_order, update.id, orgId]
      );
    }

    console.log(`Updated display order for ${orderUpdates.length} items`);
    return { success: true };
  } catch (error) {
    console.error('Error updating display order:', error.message);
    return { error: `Failed to update display order: ${error.message}` };
  }
}
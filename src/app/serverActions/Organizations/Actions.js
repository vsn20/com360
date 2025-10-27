'use server';
import DBconnection from '@/app/utils/config/db';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret';

const decodeJwt = (token) => {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    console.error('Error decoding JWT:', error.message);
    return null;
  }
};

const formatDate = (date) => {
    if (!date || isNaN(new Date(date))) return '';
    const d = new Date(date);
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${month}/${day}/${d.getFullYear()}`;
};

const getCurrentUserEmpIdName = async (pool, userId, orgId) => {
  try {
    const [userRows] = await pool.execute(
      'SELECT empid FROM C_USER WHERE username = ? AND orgid = ?',
      [userId, orgId]
    );
    if (userRows.length === 0) {
      console.error('User not found in C_USER for username:', userId);
      return 'unknown';
    }
    let empid = userRows[0].empid;

    const [empRows] = await pool.execute(
      'SELECT EMP_FST_NAME, EMP_LAST_NAME FROM C_EMP WHERE empid = ? AND orgid = ?',
      [empid, orgId]
    );
    if (empRows.length === 0) {
      console.error('Employee not found in C_EMP for empid:', empid);
      return `${empid}-unknown`;
    }
    const { EMP_FST_NAME, EMP_LAST_NAME } = empRows[0];
    return `${empid}-${EMP_FST_NAME} ${EMP_LAST_NAME}`;
  } catch (error) {
    console.error('Error fetching empid-name:', error.message);
    return 'system';
  }
};

export async function addorganization(formData) {
  let pool;
  let retryCount = 0;
  const maxRetries = 2;
  const usaCountryId = '185';

  while (retryCount <= maxRetries) {
    try {
      const cookieStore = cookies();
      const token = cookieStore.get('jwt_token')?.value;

      if (!token) {
        return { error: 'No token found. Please log in.' };
      }

      const decoded = decodeJwt(token);
      if (!decoded || !decoded.orgid || !decoded.userId) {
        return { error: 'Invalid token or orgid/userId not found.' };
      }

      const orgId = decoded.orgid;
      const userId = decoded.userId;

      const suborgname = formData.get('suborgname')?.trim();
      const isstatus = formData.get('isstatus')?.trim();
      const addresslane1 = formData.get('addresslane1')?.trim() || null;
      const addresslane2 = formData.get('addresslane2')?.trim() || null;
      const country = formData.get('country')?.trim() || null;
      const state = formData.get('state')?.trim() || null;
      const customStateName = formData.get('customStateName')?.trim() || null;
      const postalcode = formData.get('postalcode')?.trim() || null;
      const trade_name = formData.get('trade_name')?.trim() || null;
      const registration_number = formData.get('registration_number')?.trim() || null;
      const company_type = formData.get('company_type')?.trim() || null;
      const industry = formData.get('industry')?.trim() || null;

      if (!suborgname) {
        return { error: 'Organization name is required.' };
      }

      const isUSA = country === usaCountryId;
      const state_val = isUSA ? state : null;
      const custom_val = !isUSA ? customStateName : null;

      pool = await DBconnection();

      const [counts] = await pool.query('SELECT COUNT(*) as count FROM C_SUB_ORG WHERE orgid = ?', [orgId]);
      const updatedCount = counts[0].count;
      const suborgid = `${orgId}-${updatedCount + 1}`;

      const isActive = isstatus === 'Active' ? 1 : 0;
      const createdBy = await getCurrentUserEmpIdName(pool, userId, orgId);

      await pool.query(
        `INSERT INTO C_SUB_ORG (
          suborgid, orgid, suborgname, isstatus, addresslane1, addresslane2, 
          country, state, CUSTOME_STATE_NAME, postalcode, created_by, created_date,
          trade_name, registration_number, company_type, industry
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, ?, ?, ?)`,
        [
          suborgid,
          orgId,
          suborgname,
          isActive,
          addresslane1,
          addresslane2,
          country,
          state_val,
          custom_val,
          postalcode,
          createdBy,
          trade_name,
          registration_number,
          company_type,
          industry
        ]
      );

      return { success: true };
    } catch (error) {
      console.error('Error adding organization:', error.message);
      if (error.message.includes('Pool is closed') && retryCount < maxRetries) {
        retryCount++;
        continue;
      }
      return { error: `Failed to add organization: ${error.message}` };
    }
  }
  return { error: 'Failed to add organization after multiple retries: Pool is closed' };
}

export async function getorgdetailsbyid(suborgid) {
  let pool;
  let retryCount = 0;
  const maxRetries = 2;

  while (retryCount <= maxRetries) {
    try {
      pool = await DBconnection();
      const [rows] = await pool.query(
        `SELECT suborgid, orgid, suborgname, isstatus, addresslane1, addresslane2, 
         country, state, CUSTOME_STATE_NAME, postalcode, created_by, created_date, updated_by, updated_date,
         trade_name, registration_number, company_type, industry
         FROM C_SUB_ORG WHERE suborgid = ?`,
        [suborgid]
      );
      return rows.length > 0 ? rows[0] : null;
    } catch (error) {
      console.error('Error fetching organization details:', error.message);
      if (error.message.includes('Pool is closed') && retryCount < maxRetries) {
        retryCount++;
        continue;
      }
      throw new Error(`Failed to fetch organization details: ${error.message}`);
    }
  }
  throw new Error('Failed to fetch organization details after multiple retries: Pool is closed');
}

export async function updateorganization(formData) {
  let pool;
  let retryCount = 0;
  const maxRetries = 2;
  const usaCountryId = '185';

  while (retryCount <= maxRetries) {
    try {
      const cookieStore = cookies();
      const token = cookieStore.get('jwt_token')?.value;

      if (!token) {
        return { error: 'No token found. Please log in.' };
      }

      const decoded = decodeJwt(token);
      if (!decoded || !decoded.orgid || !decoded.userId) {
        return { error: 'Invalid token or orgid/userId not found.' };
      }

      const orgId = decoded.orgid;
      const userId = decoded.userId;

      const suborgname = formData.get('suborgname')?.trim();
      const isstatus = formData.get('isstatus')?.trim();
      const addresslane1 = formData.get('addresslane1')?.trim() || null;
      const addresslane2 = formData.get('addresslane2')?.trim() || null;
      const country = formData.get('country')?.trim() || null;
      const state = formData.get('state')?.trim() || null;
      const customStateName = formData.get('customStateName')?.trim() || null;
      const postalcode = formData.get('postalcode')?.trim() || null;
      const suborgid = formData.get('suborgid')?.trim();
      const trade_name = formData.get('trade_name')?.trim() || null;
      const registration_number = formData.get('registration_number')?.trim() || null;
      const company_type = formData.get('company_type')?.trim() || null;
      const industry = formData.get('industry')?.trim() || null;

      if (!suborgname) {
        return { error: 'Organization name is required.' };
      }

      const isUSA = country === usaCountryId;
      const state_val = isUSA ? state : null;
      const custom_val = !isUSA ? customStateName : null;

      pool = await DBconnection();
      const isActive = isstatus === 'Active' ? 1 : 0;
      const updatedBy = await getCurrentUserEmpIdName(pool, userId, orgId);

      const [result] = await pool.query(
        `UPDATE C_SUB_ORG SET 
          suborgname = ?, isstatus = ?, addresslane1 = ?, addresslane2 = ?, 
          country = ?, state = ?, CUSTOME_STATE_NAME = ?, postalcode = ?, 
          trade_name = ?, registration_number = ?, company_type = ?, industry = ?,
          updated_by = ?, updated_date = NOW() 
         WHERE suborgid = ?`,
        [
          suborgname, isActive, addresslane1, addresslane2, country,
          state_val, custom_val, postalcode, 
          trade_name, registration_number, company_type, industry,
          updatedBy, suborgid,
        ]
      );

      if (result.affectedRows > 0) {
        return { success: true };
      } else {
        return { error: 'No organization found to update' };
      }
    } catch (error) {
      console.error('Error updating organization:', error.message);
      if (error.message.includes('Pool is closed') && retryCount < maxRetries) {
        retryCount++;
        continue;
      }
      return { error: `Failed to update organization: ${error.message}` };
    }
  }
  return { error: 'Failed to update organization after multiple retries: Pool is closed' };
}

export async function fetchSubOrgDocumentsById(suborgid) {
  try {
    const cookieStore = cookies();
    const token = cookieStore.get('jwt_token')?.value;
    if (!token) throw new Error('No token found. Please log in.');

    const decoded = decodeJwt(token);
    if (!decoded || !decoded.orgid) throw new Error('Invalid token or orgid not found.');

    const orgId = decoded.orgid;
    if (!suborgid) throw new Error('Sub-Organization ID is required.');

    const pool = await DBconnection();
    const [rows] = await pool.query(
      `SELECT id, suborgid, orgid, document_name, document_type, document_path, document_purpose, 
              created_by, updated_by, created_date, last_updated_date 
       FROM C_SUB_ORG_DOCUMENTS 
       WHERE suborgid = ? AND orgid = ?`,
      [suborgid, orgId]
    );

    if (rows.length === 0) return [];
    
    return rows.map((doc) => ({
      ...doc,
      last_updated_date: formatDate(doc.last_updated_date),
    }));
  } catch (error) {
    console.error('Error fetching sub-organization documents:', error.message);
    throw new Error(`Failed to fetch sub-organization documents: ${error.message}`);
  }
}
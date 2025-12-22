'use server';

import DBconnection from '@/app/utils/config/db';
import { cookies } from 'next/headers';
import fs from 'fs/promises';
import path from 'path';

// Helper: Decode JWT
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

const formatDateForDB = (dateStr) => {
  if (!dateStr) return null;
  const date = new Date(dateStr + 'T00:00:00Z');
  if (isNaN(date.getTime())) return null;
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * 1. Get User Context
 */
export async function getUserContext() {
  const cookieStore = cookies();
  const token = cookieStore.get('jwt_token')?.value;
  if (!token) throw new Error('Unauthorized');

  const decoded = decodeJwt(token);
  if (!decoded || !decoded.orgid || !decoded.empid) throw new Error('Invalid Token');

  const { empid, orgid } = decoded;
  const pool = await DBconnection();

  // Get User's Suborg
  const [empRows] = await pool.query('SELECT suborgid FROM C_EMP WHERE empid = ?', [empid]);
  const userSuborgId = empRows.length > 0 ? empRows[0].suborgid : null;

  // Check Admin Status
  const [roleRows] = await pool.query(`
    SELECT r.isadmin 
    FROM C_EMP_ROLE_ASSIGN ra
    JOIN C_ORG_ROLE_TABLE r ON ra.roleid = r.roleid AND ra.orgid = r.orgid
    WHERE ra.empid = ? AND ra.orgid = ?
  `, [empid, orgid]);

  const isAdmin = roleRows.some(row => row.isadmin === 1);

  return { isAdmin, userSuborgId, orgid, empid };
}

/**
 * 2. Fetch Records
 */
export async function fetchGlobalImmigrationRecords() {
  const { isAdmin, userSuborgId, orgid } = await getUserContext();
  const pool = await DBconnection();

  // STRICT FILTERING:
  // Admin: See everything in ORG.
  // Non-Admin: See ONLY records matching their suborgid.
  let whereClause = `i.orgid = ?`;
  const params = [orgid];

  if (!isAdmin) {
    whereClause += ` AND i.suborgid = ?`; 
    params.push(userSuborgId);
  }

  const query = `
    WITH RankedRecords AS (
      SELECT 
        i.*,
        ROW_NUMBER() OVER (PARTITION BY i.document_number ORDER BY i.last_updated_date DESC) as rn
      FROM C_EMP_IMMIGRATION i
      WHERE ${whereClause}
    )
    SELECT 
      rr.id,
      rr.document_number,
      rr.petitioner_name,
      rr.beneficiary_empid,
      rr.beneficiary_custom_name,
      rr.immigration_status,
      rr.document_type,
      rr.subtype,
      rr.document_path,
      rr.last_updated_uscis,
      DATE_FORMAT(rr.issue_date, '%Y-%m-%d') as issue_date,
      
      g_type.Name as type_name,
      g_subtype.Name as subtype_name,
      g_status.Name as status_name,
      
      -- Display Name Logic
      CASE 
        WHEN rr.beneficiary_empid = 'OTHER' THEN rr.beneficiary_custom_name
        ELSE CONCAT(e_ben.EMP_FST_NAME, ' ', e_ben.EMP_LAST_NAME)
      END as beneficiary_display_name

    FROM RankedRecords rr
    LEFT JOIN C_GENERIC_VALUES g_type ON rr.document_type = g_type.id
    LEFT JOIN C_GENERIC_VALUES g_subtype ON rr.subtype = g_subtype.id
    LEFT JOIN C_GENERIC_VALUES g_status ON rr.immigration_status = g_status.id
    LEFT JOIN C_EMP e_ben ON rr.beneficiary_empid = e_ben.empid
    WHERE rr.rn = 1 
    ORDER BY rr.last_updated_date DESC
  `;

  const [rows] = await pool.query(query, params);
  return { records: rows, isAdmin, userSuborgId };
}

/**
 * 3. Add Record
 */
export async function addGlobalImmigrationRecord(formData) {
  try {
    const { isAdmin, userSuborgId, orgid, empid: loggedInUser } = await getUserContext();
    const pool = await DBconnection();

    const employeeSelection = formData.get('employeeSelection'); 
    const beneficiaryNameCustom = formData.get('beneficiaryNameCustom');
    const companySelection = formData.get('companySelection'); 
    const petitionerName = formData.get('petitionerName');
    const file = formData.get('file');
    
    let documentPath = null;
    let documentName = formData.get('documentName') || null;

    // --- EMPID LOGIC ---
    // If 'OTHER' is selected, store 'OTHER' in empid column.
    // If a real employee is selected, store their ID.
    const ownerEmpId = (employeeSelection === 'OTHER') ? 'OTHER' : employeeSelection;
    
    // Store 'OTHER' or Employee ID in beneficiary_empid for consistency
    const finalBeneficiaryId = employeeSelection;

    // --- SUBORG LOGIC ---
    let finalSuborgId = companySelection;
    if (!isAdmin) {
      finalSuborgId = userSuborgId; // Force user's suborg
    }

    // --- FILE UPLOAD ---
    if (file && file.size > 0) {
        const extension = file.name.split('.').pop().toLowerCase();
        const uniqueSuffix = Date.now();
        const safeName = (documentName || file.name).replace(/[^a-zA-Z0-9]/g, '_');
        
        // Use 'EXT' prefix if ownerEmpId is 'OTHER', else use ID
        const prefix = ownerEmpId === 'OTHER' ? 'EXT' : ownerEmpId; 
        const filename = `${prefix}_IMM_${safeName}_${uniqueSuffix}.${extension}`;
        
        const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'immigration');
        const filePath = path.join(uploadDir, filename);
  
        await fs.mkdir(uploadDir, { recursive: true });
        await fs.writeFile(filePath, Buffer.from(await file.arrayBuffer()));
  
        documentPath = `/uploads/immigration/${filename}`;
        if (!documentName) documentName = file.name; 
    }

    await pool.query(`
      INSERT INTO C_EMP_IMMIGRATION (
        empid, orgid, document_type, subtype, document_number, immigration_status, 
        issue_date, expiry_date, eligible_review_date, comments, 
        beneficiary_empid, beneficiary_custom_name,
        suborgid, petitioner_name, document_path, document_name,
        created_by, updated_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      ownerEmpId, // Now stores 'OTHER' if custom
      orgid,
      formData.get('documentType'),
      formData.get('subtype') || null,
      formData.get('documentNumber'),
      formData.get('immigrationStatus') || null,
      formatDateForDB(formData.get('issueDate')),
      formatDateForDB(formData.get('expiryDate')),
      formatDateForDB(formData.get('eligibleReviewDate')),
      formData.get('comments'),
      finalBeneficiaryId, 
      beneficiaryNameCustom || null,
      finalSuborgId, 
      petitionerName,
      documentPath,
      documentName,
      loggedInUser,
      loggedInUser
    ]);

    return { success: true };
  } catch (error) {
    console.error('Error adding global immigration:', error);
    return { error: error.message };
  }
}

// Re-export dropdown fetchers to be used in page.jsx
export async function fetchEmployeesForDropdown() {
  const { isAdmin, userSuborgId, orgid } = await getUserContext();
  const pool = await DBconnection();
  let query = `SELECT empid, EMP_FST_NAME, EMP_LAST_NAME FROM C_EMP WHERE orgid = ?`;
  const params = [orgid];
  if (!isAdmin) {
    query += ` AND suborgid = ?`;
    params.push(userSuborgId);
  }
  const [rows] = await pool.query(query, params);
  return rows;
}

export async function fetchSuborgsForDropdown() {
  const { orgid } = await getUserContext();
  const pool = await DBconnection();
  const [rows] = await pool.query('SELECT suborgid, suborgname FROM C_SUB_ORG WHERE orgid = ? AND isstatus = 1', [orgid]);
  return rows;
}
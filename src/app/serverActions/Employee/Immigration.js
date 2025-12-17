'use server';

import DBconnection from '@/app/utils/config/db';
import { cookies } from 'next/headers';
import fs from 'fs/promises';
import path from 'path';

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
  // Parse the date string and create a date using UTC to avoid timezone shifts
  const date = new Date(dateStr + 'T00:00:00Z');
  if (isNaN(date.getTime())) return null;
  
  // Format as YYYY-MM-DD using UTC methods
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
};

const formatDateFromDB = (date) => {
  if (!date) return '';
  
  // If it's already a string in YYYY-MM-DD format, return as is
  if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}/.test(date)) {
    return date.split('T')[0];
  }
  
  // If it's a Date object
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  
  // Use UTC methods to avoid timezone issues
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
};

export async function fetchImmigrationData(empid) {
  try {
    const cookieStore = cookies();
    const token = cookieStore.get('jwt_token')?.value;
    const decoded = decodeJwt(token);
    if (!decoded || !decoded.orgid) throw new Error('Unauthorized');

    const pool = await DBconnection();
    
    const [rows] = await pool.query(`
      SELECT 
        i.id,
        i.empid,
        i.orgid,
        i.document_type,
        i.subtype,
        i.immigration_status,
        i.document_number,
        DATE_FORMAT(i.issue_date, '%Y-%m-%d') as issue_date,
        DATE_FORMAT(i.expiry_date, '%Y-%m-%d') as expiry_date,
        DATE_FORMAT(i.eligible_review_date, '%Y-%m-%d') as eligible_review_date,
        i.comments,
        i.created_by,
        i.created_date,
        i.updated_by,
        i.last_updated_date,
        i.document_path,
        i.document_name,
        g_status.Name as status_name,
        g_type.Name as type_name,
        g_subtype.Name as subtype_name
      FROM C_EMP_IMMIGRATION i
      LEFT JOIN C_GENERIC_VALUES g_status ON i.immigration_status = g_status.id
      LEFT JOIN C_GENERIC_VALUES g_type ON i.document_type = g_type.id
      LEFT JOIN C_GENERIC_VALUES g_subtype ON i.subtype = g_subtype.id
      WHERE i.empid = ? AND i.orgid = ?
      ORDER BY i.expiry_date DESC
    `, [empid, decoded.orgid]);

    return rows.map(row => ({
      ...row,
      // Dates are already formatted by DATE_FORMAT in the query
      // Just ensure they're strings, no additional processing needed
      created_date: row.created_date ? row.created_date.toISOString() : null,
      last_updated_date: row.last_updated_date ? row.last_updated_date.toISOString() : null,
    }));

  } catch (error) {
    console.error('Error fetching immigration data:', error);
    return [];
  }
}

export async function addImmigrationData(formData) {
  try {
    const cookieStore = cookies();
    const token = cookieStore.get('jwt_token')?.value;
    const decoded = decodeJwt(token);
    if (!decoded || !decoded.orgid) throw new Error('Unauthorized');

    const empId = formData.get('empid');
    const file = formData.get('file');
    let documentPath = null;
    let documentName = formData.get('documentName') || null;

    // Handle File Upload
    if (file && file.size > 0) {
      const extension = file.name.split('.').pop().toLowerCase();
      const uniqueSuffix = Date.now();
      // Use provided name or filename, sanitize it
      const safeName = (documentName || file.name).replace(/[^a-zA-Z0-9]/g, '_');
      const filename = `${empId}_IMM_${safeName}_${uniqueSuffix}.${extension}`;
      
      const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'immigration');
      const filePath = path.join(uploadDir, filename);

      await fs.mkdir(uploadDir, { recursive: true });
      await fs.writeFile(filePath, Buffer.from(await file.arrayBuffer()));

      documentPath = `/uploads/immigration/${filename}`;
      // If user didn't provide a specific name, use the original file name
      if (!documentName) documentName = file.name; 
    }

    const pool = await DBconnection();
    
    await pool.query(`
      INSERT INTO C_EMP_IMMIGRATION (
        empid, orgid, document_type, subtype, document_number, immigration_status, 
        issue_date, expiry_date, eligible_review_date, comments, 
        document_path, document_name,
        created_by, updated_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      empId,
      decoded.orgid,
      formData.get('documentType'),
      formData.get('subtype') || null,
      formData.get('documentNumber'),
      formData.get('immigrationStatus') || null,
      formatDateForDB(formData.get('issueDate')),
      formatDateForDB(formData.get('expiryDate')),
      formatDateForDB(formData.get('eligibleReviewDate')),
      formData.get('comments'),
      documentPath,
      documentName,
      decoded.userId,
      decoded.userId
    ]);

    return { success: true };
  } catch (error) {
    console.error('Error adding immigration data:', error);
    return { error: error.message };
  }
}

export async function updateImmigrationData(formData) {
  try {
    const cookieStore = cookies();
    const token = cookieStore.get('jwt_token')?.value;
    const decoded = decodeJwt(token);
    if (!decoded || !decoded.orgid) throw new Error('Unauthorized');

    const empId = formData.get('empid');
    const id = formData.get('id');
    const file = formData.get('file');
    const oldDocumentPath = formData.get('oldDocumentPath');
    let documentName = formData.get('documentName');

    const pool = await DBconnection();
    let updateQuery = `
      UPDATE C_EMP_IMMIGRATION SET
        document_type = ?,
        subtype = ?,
        document_number = ?,
        immigration_status = ?,
        issue_date = ?,
        expiry_date = ?,
        eligible_review_date = ?,
        comments = ?,
        document_name = ?,
        updated_by = ?,
        last_updated_date = NOW()
    `;

    const params = [
      formData.get('documentType'),
      formData.get('subtype') || null,
      formData.get('documentNumber'),
      formData.get('immigrationStatus') || null,
      formatDateForDB(formData.get('issueDate')),
      formatDateForDB(formData.get('expiryDate')),
      formatDateForDB(formData.get('eligibleReviewDate')),
      formData.get('comments'),
      documentName,
      decoded.userId
    ];

    // Handle File Replacement
    if (file && file.size > 0) {
      // 1. Delete old file
      if (oldDocumentPath) {
        const fullOldPath = path.join(process.cwd(), 'public', oldDocumentPath);
        await fs.unlink(fullOldPath).catch(err => 
          console.warn(`Failed to delete old file: ${err.message}`)
        );
      }

      // 2. Save new file
      const extension = file.name.split('.').pop().toLowerCase();
      const uniqueSuffix = Date.now();
      const safeName = (documentName || file.name).replace(/[^a-zA-Z0-9]/g, '_');
      const filename = `${empId}_IMM_${safeName}_${uniqueSuffix}.${extension}`;
      
      const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'immigration');
      const filePath = path.join(uploadDir, filename);

      await fs.mkdir(uploadDir, { recursive: true });
      await fs.writeFile(filePath, Buffer.from(await file.arrayBuffer()));

      const documentPath = `/uploads/immigration/${filename}`;
      
      updateQuery += `, document_path = ?`;
      params.push(documentPath);
    }

    updateQuery += ` WHERE id = ? AND empid = ? AND orgid = ?`;
    params.push(id, empId, decoded.orgid);

    await pool.query(updateQuery, params);

    return { success: true };
  } catch (error) {
    console.error('Error updating immigration data:', error);
    return { error: error.message };
  }
}

export async function deleteImmigrationData(id) {
  try {
    const cookieStore = cookies();
    const token = cookieStore.get('jwt_token')?.value;
    const decoded = decodeJwt(token);
    if (!decoded || !decoded.orgid) throw new Error('Unauthorized');

    const pool = await DBconnection();

    // 1. Get path to delete file
    const [rows] = await pool.query('SELECT document_path FROM C_EMP_IMMIGRATION WHERE id = ? AND orgid = ?', [id, decoded.orgid]);
    
    if (rows.length > 0 && rows[0].document_path) {
      const fullPath = path.join(process.cwd(), 'public', rows[0].document_path);
      await fs.unlink(fullPath).catch(err => console.warn(`Failed to delete file: ${err.message}`));
    }

    // 2. Delete record
    await pool.query('DELETE FROM C_EMP_IMMIGRATION WHERE id = ? AND orgid = ?', [id, decoded.orgid]);

    return { success: true };
  } catch (error) {
    console.error('Error deleting immigration data:', error);
    return { error: error.message };
  }
}
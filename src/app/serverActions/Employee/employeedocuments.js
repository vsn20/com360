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

const compareDates = (startStr, endStr) => {
  if (!startStr || !endStr) return true; // Skip if either is missing

  // Parse to Date objects, focusing on date part only
  const startDate = new Date(startStr);
  const endDate = new Date(endStr);

  // Compare only date parts (ignore time)
  startDate.setHours(0, 0, 0, 0);
  endDate.setHours(0, 0, 0, 0);

  return startDate <= endDate;
};

export async function addDocument(formData) {
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
    const userId = decoded.userId;

    const empId = formData.get('empid');
    if (!empId) {
      throw new Error('Employee ID is required.');
    }

    const documentName = formData.get('documentName') || null;
    const documentType = formData.get('documentType') || null;
    const subtype = formData.get('subtype') || null;
    const documentPurpose = formData.get('documentPurpose') || null;
    let startdate = formData.get('startdate') || null;
    let enddate = formData.get('enddate') || null;
    const comments = formData.get('comments') || null;
    const file = formData.get('file');

    if (!file) {
      throw new Error('File is required for document upload.');
    }

    // Validate startdate <= enddate
    if (!compareDates(startdate, enddate)) {
      throw new Error('Start date must be less than or equal to end date.');
    }

    // Handle date formatting for DB (add time if only date provided)
    if (startdate && !startdate.includes(' ')) {
      startdate += ' 00:00:00';
    }
    if (enddate && !enddate.includes(' ')) {
      enddate += ' 00:00:00';
    }

    const extension = file.name.split('.').pop().toLowerCase();
    const uniqueSuffix = Date.now();
    const filename = `${empId}_${documentName?.replace(/[^a-zA-Z0-9]/g, '_') || file.name.replace(/\.[^/.]+$/, '')}_${uniqueSuffix}.${extension}`;
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'documents');
    const filePath = path.join(uploadDir, filename);

    await fs.mkdir(uploadDir, { recursive: true });
    await fs.writeFile(filePath, Buffer.from(await file.arrayBuffer()));

    const documentPath = `/uploads/documents/${filename}`;

    const pool = await DBconnection();
    const [result] = await pool.query(
      `INSERT INTO C_EMP_DOCUMENTS (empid, orgid, document_name, document_type, subtype, document_path, document_purpose, comments, startdate, enddate, created_by, updated_by, created_date, last_updated_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [empId, orgId, documentName, documentType, subtype, documentPath, documentPurpose, comments, startdate, enddate, userId, userId]
    );
    return result.insertId;
  } catch (error) {
    console.error('Error adding document:', error.message);
    throw new Error(`Failed to add document: ${error.message}`);
  }
}

export async function updateDocument(formData) {
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
    const userId = decoded.userId;

    const id = formData.get('id');
    const empId = formData.get('empid');
    if (!id || !empId) {
      throw new Error('Document ID and Employee ID are required.');
    }

    const documentName = formData.get('documentName') || null;
    const documentType = formData.get('documentType') || null;
    const subtype = formData.get('subtype') || null;
    const documentPurpose = formData.get('documentPurpose') || null;
    let comments = formData.get('comments') || null;
    let startdate = formData.get('startdate') || null;
    let enddate = formData.get('enddate') || null;
    const file = formData.get('file');
    const oldDocumentPath = formData.get('oldDocumentPath');

    // Validate startdate <= enddate
    if (!compareDates(startdate, enddate)) {
      throw new Error('Start date must be less than or equal to end date.');
    }

    // Handle date formatting for DB
    if (startdate && !startdate.includes(' ')) {
      startdate += ' 00:00:00';
    }
    if (enddate && !enddate.includes(' ')) {
      enddate += ' 00:00:00';
    }

    const pool = await DBconnection();
    let updateQuery = `UPDATE C_EMP_DOCUMENTS SET updated_by = ?, last_updated_date = NOW()`;
    const params = [userId];

    // Always update these fields if provided (set to null if empty)
    const safeValue = (val) => val || null;
    if (documentName !== undefined) {
      updateQuery += ', document_name = ?';
      params.push(safeValue(documentName));
    }
    if (documentType !== undefined) {
      updateQuery += ', document_type = ?';
      params.push(safeValue(documentType));
    }
    if (subtype !== undefined) {
      updateQuery += ', subtype = ?';
      params.push(safeValue(subtype));
    }
    if (documentPurpose !== undefined) {
      updateQuery += ', document_purpose = ?';
      params.push(safeValue(documentPurpose));
    }
    if (comments !== undefined) {
      updateQuery += ', comments = ?';
      params.push(safeValue(comments));
    }
    if (startdate !== undefined) {
      updateQuery += ', startdate = ?';
      params.push(safeValue(startdate));
    }
    if (enddate !== undefined) {
      updateQuery += ', enddate = ?';
      params.push(safeValue(enddate));
    }

    // If a new file is uploaded, handle deletion of old and saving of new
    if (file) {
      // 1. Delete the old file from the filesystem if it exists
      if (oldDocumentPath) {
        const fullOldPath = path.join(process.cwd(), 'public', oldDocumentPath);
        await fs.unlink(fullOldPath).catch(err => 
          console.warn(`Failed to delete old file, it might not exist: ${err.message}`)
        );
      }

      // 2. Save the new file
      const extension = file.name.split('.').pop().toLowerCase();
      const uniqueSuffix = Date.now();
      const filename = `${empId}_${documentName?.replace(/[^a-zA-Z0-9]/g, '_') || file.name.replace(/\.[^/.]+$/, '')}_${uniqueSuffix}.${extension}`;
      const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'documents');
      const newFilePath = path.join(uploadDir, filename);

      await fs.mkdir(uploadDir, { recursive: true });
      await fs.writeFile(newFilePath, Buffer.from(await file.arrayBuffer()));

      // 3. Update path (type is handled separately above)
      const documentPath = `/uploads/documents/${filename}`;
      updateQuery += ', document_path = ?';
      params.push(documentPath);
    }

    updateQuery += ' WHERE id = ? AND empid = ? AND orgid = ?';
    params.push(id, empId, orgId);

    const [result] = await pool.query(updateQuery, params);
    if (result.affectedRows === 0) {
      throw new Error('Document not found or unauthorized.');
    }
    return true;
  } catch (error) {
    console.error('Error updating document:', error.message);
    throw new Error(`Failed to update document: ${error.message}`);
  }
}

export async function deleteDocument(id) {
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

    if (!id) {
      throw new Error('Document ID is required.');
    }

    const pool = await DBconnection();

    const [docResult] = await pool.query(
      `SELECT document_path FROM C_EMP_DOCUMENTS WHERE id = ? AND orgid = ?`,
      [id, orgId]
    );

    if (docResult.length > 0 && docResult[0].document_path) {
      const filePath = path.join(process.cwd(), 'public', docResult[0].document_path);
      await fs.unlink(filePath).catch(err => console.warn(`Failed to delete file: ${err.message}`));
    }

    const [result] = await pool.query(
      `DELETE FROM C_EMP_DOCUMENTS WHERE id = ? AND orgid = ?`,
      [id, orgId]
    );

    if (result.affectedRows === 0) {
      throw new Error('Document not found or unauthorized to delete.');
    }
    return true;
  } catch (error) {
    console.error('Error deleting document:', error.message);
    throw new Error(`Failed to delete document: ${error.message}`);
  }
}
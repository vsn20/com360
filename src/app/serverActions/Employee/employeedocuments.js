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

export async function addDocument(formData) {
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
    const userId = decoded.userId;

    const empId = formData.get('empid');
    if (!empId) {
      console.log('empid is missing');
      throw new Error('Employee ID is required.');
    }

    const documentName = formData.get('documentName') || '';
    const documentPurpose = formData.get('documentPurpose') || '';
    const file = formData.get('file');

    if (!file) {
      console.log('No file uploaded');
      throw new Error('File is required for document upload.');
    }

    const extension = file.name.split('.').pop().toLowerCase();
    const filename = `${empId}_${documentName || file.name.replace(/\.[^/.]+$/, '')}.${extension}`;
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'documents');
    const filePath = path.join(uploadDir, filename);

    // Ensure upload directory exists
    await fs.mkdir(uploadDir, { recursive: true });

    // Save file to disk
    await fs.writeFile(filePath, Buffer.from(await file.arrayBuffer()));

    const documentType = extension === 'pdf' ? 'pdf' : extension === 'jpg' ? 'jpg' : extension === 'jpeg' ? 'jpeg' : 'unknown';
    const documentPath = `/uploads/documents/${filename}`;

    const pool = await DBconnection();
    console.log('MySQL connection pool acquired');

    const [result] = await pool.query(
      `INSERT INTO C_EMP_DOCUMENTS (empid, orgid, document_name, document_type, document_path, document_purpose, created_by, updated_by, created_date, last_updated_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [empId, orgId, documentName, documentType, documentPath, documentPurpose, userId, userId]
    );
    console.log(`Document added, insertId: ${result.insertId}`);
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
      console.log('No token found');
      throw new Error('No token found. Please log in.');
    }

    const decoded = decodeJwt(token);
    if (!decoded || !decoded.orgid) {
      console.log('Invalid token or orgid not found');
      throw new Error('Invalid token or orgid not found.');
    }
    const orgId = decoded.orgid;
    const userId = decoded.userId;

    const id = formData.get('id');
    const empId = formData.get('empid');
    if (!id) {
      console.log('Document ID is missing');
      throw new Error('Document ID is required.');
    }
    if (!empId) {
      console.log('empid is missing');
      throw new Error('Employee ID is required.');
    }

    const documentName = formData.get('documentName');
    const documentPurpose = formData.get('documentPurpose');
    const file = formData.get('file');

    const pool = await DBconnection();
    console.log('MySQL connection pool acquired');

    let updateQuery = `UPDATE C_EMP_DOCUMENTS SET updated_by = ?, last_updated_date = NOW()`;
    const params = [userId];

    if (documentName) {
      updateQuery += ', document_name = ?';
      params.push(documentName);
    }
    if (documentPurpose) {
      updateQuery += ', document_purpose = ?';
      params.push(documentPurpose);
    }
    if (file) {
      const extension = file.name.split('.').pop().toLowerCase();
      const filename = `${empId}_${documentName || file.name.replace(/\.[^/.]+$/, '')}.${extension}`;
      const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'documents');
      const filePath = path.join(uploadDir, filename);

      await fs.mkdir(uploadDir, { recursive: true });
      await fs.writeFile(filePath, Buffer.from(await file.arrayBuffer()));

      const documentType = extension === 'pdf' ? 'pdf' : extension === 'jpg' ? 'jpg' : extension === 'jpeg' ? 'jpeg' : 'unknown';
      const documentPath = `/uploads/documents/${filename}`;

      updateQuery += ', document_type = ?, document_path = ?';
      params.push(documentType, documentPath);
    }

    updateQuery += ' WHERE id = ? AND empid = ? AND orgid = ?';
    params.push(id, empId, orgId);

    const [result] = await pool.query(updateQuery, params);
    if (result.affectedRows === 0) {
      console.log('Document not found or unauthorized');
      throw new Error('Document not found or unauthorized.');
    }
    console.log(`Document updated, affectedRows: ${result.affectedRows}`);
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
      console.log('No token found');
      throw new Error('No token found. Please log in.');
    }

    const decoded = decodeJwt(token);
    if (!decoded || !decoded.orgid) {
      console.log('Invalid token or orgid not found');
      throw new Error('Invalid token or orgid not found.');
    }
    const orgId = decoded.orgid;

    if (!id) {
      console.log('Document ID is missing');
      throw new Error('Document ID is required.');
    }

    const pool = await DBconnection();
    console.log('MySQL connection pool acquired');

    const [docResult] = await pool.query(
      `SELECT document_path FROM C_EMP_DOCUMENTS WHERE id = ? AND orgid = ?`,
      [id, orgId]
    );
    if (docResult.length === 0) {
      console.log('Document not found or unauthorized');
      throw new Error('Document not found or unauthorized.');
    }

    const filePath = path.join(process.cwd(), 'public', docResult[0].document_path.replace('/uploads/documents/', 'uploads/documents/'));
    await fs.unlink(filePath).catch(err => console.warn('Failed to delete file:', err.message));

    const [result] = await pool.query(
      `DELETE FROM C_EMP_DOCUMENTS WHERE id = ? AND orgid = ?`,
      [id, orgId]
    );
    if (result.affectedRows === 0) {
      console.log('Document not found or unauthorized');
      throw new Error('Document not found or unauthorized.');
    }
    console.log(`Document deleted, affectedRows: ${result.affectedRows}`);
    return true;
  } catch (error) {
    console.error('Error deleting document:', error.message);
    throw new Error(`Failed to delete document: ${error.message}`);
  }
}
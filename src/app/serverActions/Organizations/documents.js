'use server';

import DBconnection from '@/app/utils/config/db';
import { cookies } from 'next/headers';
import fs from 'fs/promises';
import path from 'path';
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

export async function addSubOrgDocument(formData) {
  try {
    const cookieStore = cookies();
    const token = cookieStore.get('jwt_token')?.value;
    if (!token) throw new Error('No token found. Please log in.');

    const decoded = decodeJwt(token);
    if (!decoded || !decoded.orgid) throw new Error('Invalid token or orgid not found.');
    
    const orgId = decoded.orgid;
    const userId = decoded.userId;

    const suborgid = formData.get('suborgid');
    if (!suborgid) throw new Error('Sub-Organization ID is required.');

    const documentName = formData.get('documentName') || '';
    const documentPurpose = formData.get('documentPurpose') || '';
    const file = formData.get('file');
    if (!file) throw new Error('File is required for document upload.');

    const extension = file.name.split('.').pop().toLowerCase();
    const uniqueSuffix = Date.now();
    const filename = `${suborgid}_${documentName.replace(/[^a-zA-Z0-9]/g, '_') || file.name.replace(/\.[^/.]+$/, '')}_${uniqueSuffix}.${extension}`;
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'suborg_documents');
    const filePath = path.join(uploadDir, filename);

    await fs.mkdir(uploadDir, { recursive: true });
    await fs.writeFile(filePath, Buffer.from(await file.arrayBuffer()));

    const documentType = extension === 'pdf' ? 'pdf' : ['jpg', 'jpeg'].includes(extension) ? extension : 'unknown';
    const documentPath = `/uploads/suborg_documents/${filename}`;

    const pool = await DBconnection();
    const [result] = await pool.query(
      `INSERT INTO C_SUB_ORG_DOCUMENTS (suborgid, orgid, document_name, document_type, document_path, document_purpose, created_by, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [suborgid, orgId, documentName, documentType, documentPath, documentPurpose, userId, userId]
    );
    return result.insertId;
  } catch (error) {
    console.error('Error adding sub-org document:', error.message);
    throw new Error(`Failed to add document: ${error.message}`);
  }
}

export async function updateSubOrgDocument(formData) {
  try {
    const cookieStore = cookies();
    const token = cookieStore.get('jwt_token')?.value;
    if (!token) throw new Error('No token found. Please log in.');

    const decoded = decodeJwt(token);
    if (!decoded || !decoded.orgid) throw new Error('Invalid token or orgid not found.');

    const orgId = decoded.orgid;
    const userId = decoded.userId;
    const id = formData.get('id');
    const suborgid = formData.get('suborgid');

    if (!id || !suborgid) throw new Error('Document ID and Sub-Organization ID are required.');

    const documentName = formData.get('documentName');
    const documentPurpose = formData.get('documentPurpose');
    const file = formData.get('file');
    const oldDocumentPath = formData.get('oldDocumentPath');

    const pool = await DBconnection();
    let updateQuery = `UPDATE C_SUB_ORG_DOCUMENTS SET updated_by = ?, last_updated_date = NOW()`;
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
      if (oldDocumentPath) {
        const fullOldPath = path.join(process.cwd(), 'public', oldDocumentPath);
        await fs.unlink(fullOldPath).catch(err => console.warn(`Failed to delete old file: ${err.message}`));
      }

      const extension = file.name.split('.').pop().toLowerCase();
      const uniqueSuffix = Date.now();
      const filename = `${suborgid}_${(documentName || file.name.replace(/\.[^/.]+$/, '')).replace(/[^a-zA-Z0-9]/g, '_')}_${uniqueSuffix}.${extension}`;
      const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'suborg_documents');
      const newFilePath = path.join(uploadDir, filename);

      await fs.mkdir(uploadDir, { recursive: true });
      await fs.writeFile(newFilePath, Buffer.from(await file.arrayBuffer()));

      const documentType = extension === 'pdf' ? 'pdf' : ['jpg', 'jpeg'].includes(extension) ? extension : 'unknown';
      const documentPath = `/uploads/suborg_documents/${filename}`;

      updateQuery += ', document_type = ?, document_path = ?';
      params.push(documentType, documentPath);
    }

    updateQuery += ' WHERE id = ? AND suborgid = ? AND orgid = ?';
    params.push(id, suborgid, orgId);

    const [result] = await pool.query(updateQuery, params);
    if (result.affectedRows === 0) throw new Error('Document not found or unauthorized.');
    
    return true;
  } catch (error) {
    console.error('Error updating sub-org document:', error.message);
    throw new Error(`Failed to update document: ${error.message}`);
  }
}

export async function deleteSubOrgDocument(id) {
  try {
    const cookieStore = cookies();
    const token = cookieStore.get('jwt_token')?.value;
    if (!token) throw new Error('No token found. Please log in.');

    const decoded = decodeJwt(token);
    if (!decoded || !decoded.orgid) throw new Error('Invalid token or orgid not found.');
    
    const orgId = decoded.orgid;
    if (!id) throw new Error('Document ID is required.');

    const pool = await DBconnection();
    const [docResult] = await pool.query(
      `SELECT document_path FROM C_SUB_ORG_DOCUMENTS WHERE id = ? AND orgid = ?`,
      [id, orgId]
    );

    if (docResult.length > 0 && docResult[0].document_path) {
      const filePath = path.join(process.cwd(), 'public', docResult[0].document_path);
      await fs.unlink(filePath).catch(err => console.warn(`Failed to delete file: ${err.message}`));
    }

    const [result] = await pool.query(
      `DELETE FROM C_SUB_ORG_DOCUMENTS WHERE id = ? AND orgid = ?`,
      [id, orgId]
    );

    if (result.affectedRows === 0) throw new Error('Document not found or unauthorized to delete.');
    
    return true;
  } catch (error) {
    console.error('Error deleting sub-org document:', error.message);
    throw new Error(`Failed to delete document: ${error.message}`);
  }
}


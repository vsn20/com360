'use server';

import { cookies } from 'next/headers';
import DBconnection from '@/app/utils/config/db';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

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

export async function addServiceRequest(formData) {
  const cookieStore = await cookies();
  const token = cookieStore.get('jwt_token')?.value;
  const decoded = token ? decodeJwt(token) : null;

  if (!decoded || !decoded.orgid || !decoded.empid) {
    console.error('Invalid token: Decoded token is null or missing orgid/empid', { decoded, token });
    return { success: false, error: 'Invalid or missing authentication token' };
  }

  const orgid = formData.get('orgid');
  const empid = formData.get('empid');

  console.log('Token validation:', {
    decodedOrgid: decoded.orgid,
    decodedEmpid: decoded.empid,
    formOrgid: orgid,
    formEmpid: empid,
  });

  if (decoded.orgid != orgid || decoded.empid != empid) {
    console.error('Token mismatch error:', {
      decodedOrgid: decoded.orgid,
      decodedEmpid: decoded.empid,
      formOrgid: orgid,
      formEmpid: empid,
    });
    return { success: false, error: 'Unauthorized: Token does not match provided orgid or empid' };
  }

  let pool;
  let retryCount = 0;
  const maxRetries = 2;

  while (retryCount <= maxRetries) {
    try {
      console.log(`Attempting to connect to MySQL (attempt ${retryCount + 1})...`);
      pool = await DBconnection();
      console.log('MySQL connection pool acquired');

      // Validate priority
      const [validPriority] = await pool.query(
        'SELECT id FROM C_GENERIC_VALUES WHERE g_id = ? AND Name = ? AND orgid = ? AND isactive = 1',
        [11, formData.get('priorityCd'), orgid]
      );
      if (validPriority.length === 0) {
        console.log('Error: Invalid priority');
        return { success: false, error: 'Invalid priority.' };
      }

      // Validate type
      const [validType] = await pool.query(
        'SELECT id FROM C_GENERIC_VALUES WHERE g_id = ? AND Name = ? AND orgid = ? AND isactive = 1',
        [12, formData.get('typeCd'), orgid]
      );
      if (validType.length === 0) {
        console.log('Error: Invalid type');
        return { success: false, error: 'Invalid type.' };
      }

      // Validate sub-type if provided
      if (formData.get('subTypeCd')) {
        const [validSubType] = await pool.query(
          'SELECT id FROM C_GENERIC_VALUES WHERE g_id = ? AND Name = ? AND orgid = ? AND isactive = 1',
          [13, formData.get('subTypeCd'), orgid]
        );
        if (validSubType.length === 0) {
          console.log('Error: Invalid sub-type');
          return { success: false, error: 'Invalid sub-type.' };
        }
      }

      // Generate SR_NUM
      const [countRows] = await pool.query(
        'SELECT COUNT(*) as count FROM C_SRV_REQ WHERE ORG_ID = ?',
        [orgid]
      );
      const requestCount = countRows[0].count + 1;
      const srNum = `${orgid}-${requestCount}`;

      // Define insert columns
      const insertColumns = [
        'SR_NUM', 'ORG_ID', 'SERVICE_NAME', 'STATUS_CD', 'PRIORITY_CD', 'TYPE_CD', 'SUB_TYPE_CD',
        'ASSIGNED_TO', 'DUE_DATE', 'ESCALATED_FLAG', 'ESCALATED_TO', 'ESCALATED_DATE',
        'DESCRIPTION', 'COMMENTS', 'CONTACT_ID', 'ACCOUNT_ID', 'ASSET_ID', 'PAR_ROW_ID',
        'CREATED_BY', 'CREATED', 'LAST_UPD_BY', 'LAST_UPD',
      ];

      // Define insert values
      const insertValues = [
        srNum,
        orgid,
        formData.get('serviceName') || null,
        formData.get('statusCd') || 'Open',
        formData.get('priorityCd') || null,
        formData.get('typeCd') || null,
        formData.get('subTypeCd') || null,
        formData.get('assignedTo') || null,
        formData.get('dueDate') || null,
        formData.get('escalatedFlag') === 'true' ? 1 : 0,
        formData.get('escalatedTo') || null,
        formData.get('escalatedDate') || null,
        formData.get('description') || null,
        formData.get('comments') || null,
        formData.get('contactId') || null,
        formData.get('accountId') || null,
        formData.get('assetId') || null,
        formData.get('parRowId') || null,
        empid,
        new Date(),
        empid,
        new Date(),
      ];

      // Ensure column and value counts match
      if (insertValues.length !== insertColumns.length) {
        console.error('Mismatch: values length =', insertValues.length, 'columns length =', insertColumns.length);
        return { success: false, error: 'Internal error: column count mismatch' };
      }

      // Insert service request
      const insertQuery = `
        INSERT INTO C_SRV_REQ (${insertColumns.join(', ')})
        VALUES (${insertValues.map(() => '?').join(', ')})
      `;
      const [result] = await pool.query(insertQuery, insertValues);
      if (result.affectedRows === 0) {
        console.log('Error: Failed to create service request');
        return { success: false, error: 'Failed to create service request' };
      }

      // Handle attachments
      const attachments = [];
      const fileComments = [];
      const fileStatuses = [];
      const attachmentPaths = [];

      for (const [key, value] of formData.entries()) {
        if (key.startsWith('attachment[')) {
          attachments.push(value);
        } else if (key.startsWith('fileComments[')) {
          fileComments.push(value);
        } else if (key.startsWith('fileStatuses[')) {
          fileStatuses.push(value);
        }
      }

      if (attachments.length > 0) {
        const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'ServiceRequests');
        await mkdir(uploadDir, { recursive: true });
        for (let i = 0; i < attachments.length; i++) {
          const file = attachments[i];
          const timestamp = new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 14);
          const uuid = uuidv4();
          const uniqueFileName = `${path.parse(file.name).name}_${timestamp}_${uuid}${path.extname(file.name)}`;
          const filePath = path.join(uploadDir, uniqueFileName);
          const arrayBuffer = await file.arrayBuffer();
          await writeFile(filePath, Buffer.from(arrayBuffer));
          attachmentPaths.push(uniqueFileName);
          await pool.query(
            'INSERT INTO C_SRV_REQ_ATT (SR_ID, TYPE_CD, FILE_NAME, FILE_PATH, COMMENTS, ATTACHMENT_STATUS, CREATED_BY, CREATED, LAST_UPD_BY, LAST_UPD) VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), ?, NOW())',
            [
              srNum,
              file.type || 'application/octet-stream',
              file.name,
              uniqueFileName,
              fileComments[i] || null,
              'Creator',
              empid,
              empid,
            ]
          );
        }
      }

      console.log('Service request created successfully:', { srNum, attachmentPaths });
      return { success: true, srNum, attachmentPaths };
    } catch (error) {
      console.error('Error creating service request:', error);
      if (error.message.includes('Pool is closed') && retryCount < maxRetries) {
        console.log('Pool is closed, retrying connection...');
        retryCount++;
        continue;
      }
      return { success: false, error: error.message || 'Failed to create service request' };
    }
  }

  console.error('Failed to create service request after multiple retries: Pool is closed');
  return { success: false, error: 'Failed to create service request after multiple retries: Pool is closed' };
}
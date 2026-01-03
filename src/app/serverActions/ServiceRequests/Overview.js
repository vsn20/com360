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

export async function fetchServiceRequestById(srNum, orgid, empid) {
  try {
    const pool = await DBconnection();
    const [rows] = await pool.query(
      'SELECT SR_NUM, ORG_ID, SERVICE_NAME, STATUS_CD, PRIORITY_CD, TYPE_CD, SUB_TYPE_CD, ASSIGNED_TO, DUE_DATE, ESCALATED_FLAG, ESCALATED_TO, ESCALATED_DATE, DESCRIPTION, COMMENTS, CONTACT_ID, ACCOUNT_ID, ASSET_ID, PAR_ROW_ID, CATEGORY_CD, CREATED, CREATED_BY, LAST_UPD, LAST_UPD_BY FROM C_SRV_REQ WHERE SR_NUM = ? AND ORG_ID = ? AND CREATED_BY = ?',
      [srNum, orgid, empid]
    );
    let accountRows ;
    let accountname='-';
   if(rows[0].ACCOUNT_ID!=null){
     [accountRows] = await pool.execute(
          'SELECT ACCNT_ID, ALIAS_NAME FROM C_ACCOUNT WHERE ORGID = ? AND ACCNT_ID=? ',
          [orgid,rows[0].ACCOUNT_ID]
        );
         accountname=accountRows[0].ALIAS_NAME
      }

   

    
    const s=rows[0];
    const [employees] = await pool.query(
          'SELECT  EMP_FST_NAME, EMP_LAST_NAME FROM C_EMP WHERE empid = ?',
          [s.ASSIGNED_TO]
      );

    if (rows.length === 0) {
      throw new Error('Service request not found or you do not have access');
    }

    const [attachments] = await pool.query(
      'SELECT SR_ATT_ID, SR_ID, TYPE_CD, FILE_NAME, FILE_PATH, COMMENTS, ATTACHMENT_STATUS, CREATED, CREATED_BY, LAST_UPD, LAST_UPD_BY FROM C_SRV_REQ_ATT WHERE SR_ID = ? AND CREATED_BY=?',
      [srNum,empid]
    );
    console.log(`Fetched attachments for SR_ID=${srNum} at ${new Date().toISOString()}:`, attachments);

    return { ...rows[0], attachments ,employees:employees[0],accountname:accountname};
  } catch (error) {
    console.error('Error fetching service request:', error);
    throw new Error(error.message || 'Failed to fetch service request');
  }
}

export async function getemployeename(srnum){
  try {
      const pool = await DBconnection();
      const [employees] = await pool.query(
          'SELECT  EMP_FST_NAME, EMP_LAST_NAME FROM C_EMP WHERE empid = ?',
          [srnum]
      );
      return {employees};
    
  } catch (error) {
     console.error('Error fetching service request:', error);
  }
}

const getdisplayprojectid = (prjid) => {
    return prjid.split('-')[1] || prjid;
};

export async function getparentsr(srnum) {
  const cookieStore = await cookies();
  const token = cookieStore.get('jwt_token')?.value;
  if (!token) {
    console.error('No JWT token found');
    return { success: false, error: 'No authentication token found' };
  }

  const decoded = decodeJwt(token);
  if (!decoded || !decoded.orgid || !decoded.empid) {
    console.error('Invalid token: Decoded token is null or missing orgid/empid', { decoded });
    return { success: false, error: 'Invalid or missing authentication token' };
  }

  const orgid = decoded.orgid;
  const empid = decoded.empid;

  try {
    const pool = await DBconnection();
    const [serviceRequests] = await pool.query(
      'SELECT SR_NUM, SERVICE_NAME, STATUS_CD FROM C_SRV_REQ WHERE CREATED_BY = ? AND ORG_ID = ?',
      [empid, orgid]
    );

    // Extract numeric part of srnum
    const srNumNumeric = parseInt(getdisplayprojectid(srnum), 10);
    if (isNaN(srNumNumeric)) {
      console.error('Invalid srNum format:', srnum);
      return { success: false, error: 'Invalid service request number format' };
    }

    // Filter service requests where numeric part of SR_NUM is greater than srNumNumeric
    const filteredRequests = serviceRequests.filter((request) => {
      const requestNum = parseInt(getdisplayprojectid(request.SR_NUM), 10);
      return !isNaN(requestNum) && requestNum < srNumNumeric;
    });

    return { success: true, serviceRequests: filteredRequests };
  } catch (error) {
    console.error('Error fetching parent service requests:', error);
    return { success: false, error: error.message || 'Failed to fetch parent service requests' };
  }
}

export async function updateServiceRequest(formData) {
  const cookieStore = await cookies();
  const token = cookieStore.get('jwt_token')?.value;
  const decoded = token ? decodeJwt(token) : null;

  if (!decoded || !decoded.orgid || !decoded.empid) {
    console.error('Invalid token: Decoded token is null or missing orgid/empid', { decoded, token });
    return { success: false, error: 'Invalid or missing authentication token' };
  }

  const orgid = formData.get('orgid');
  const empid = formData.get('empid');
  const srNum = formData.get('SR_NUM');
  const section = formData.get('section');

  console.log('Token validation:', {
    decodedOrgid: decoded.orgid,
    decodedEmpid: decoded.empid,
    formOrgid: orgid,
    formEmpid: empid,
    srNum,
    section
  });

  if (decoded.orgid != orgid || decoded.empid != empid) {
    console.error('Token mismatch error:', {
      decodedOrgid: decoded.orgid,
      decodedEmpid: decoded.empid,
      formOrgid: orgid,
      formEmpid: empid
    });
    return { success: false, error: 'Unauthorized: Token does not match provided orgid or empid' };
  }

  try {
    const pool = await DBconnection();

    // Validate priority, type, and sub-type for 'basic' section
    if (section === 'basic') {
      const priorityCd = formData.get('priorityCd')?.trim();
      const typeCd = formData.get('typeCd')?.trim();
      const subTypeCd = formData.get('subTypeCd')?.trim();

      if (priorityCd) {
        const [validPriority] = await pool.query(
          'SELECT id FROM C_GENERIC_VALUES WHERE g_id = ? AND Name = ? AND orgid = ? AND isactive = 1',
          [11, priorityCd, orgid]
        );
        if (validPriority.length === 0) {
          console.log('Error: Invalid priority');
          return { success: false, error: 'Invalid priority.' };
        }
      }

      if (typeCd) {
        const [validType] = await pool.query(
          'SELECT id FROM C_GENERIC_VALUES WHERE g_id = ? AND Name = ? AND orgid = ? AND isactive = 1',
          [12, typeCd, orgid]
        );
        if (validType.length === 0) {
          console.log('Error: Invalid type');
          return { success: false, error: 'Invalid type.' };
        }
      }

      if (subTypeCd) {
        const [validSubType] = await pool.query(
          'SELECT id FROM C_GENERIC_VALUES WHERE g_id = ? AND Name = ? AND orgid = ? AND isactive = 1',
          [13, subTypeCd, orgid]
        );
        if (validSubType.length === 0) {
          console.log('Error: Invalid sub-type');
          return { success: false, error: 'Invalid sub-type.' };
        }
      }
    }

    let updateQuery = '';
    const updateValues = [];

    if (section === 'basic') {
      updateQuery = `
        UPDATE C_SRV_REQ SET
          SERVICE_NAME = ?,
          STATUS_CD = ?,
          PRIORITY_CD = ?,
          TYPE_CD = ?,
          SUB_TYPE_CD = ?,
          ASSIGNED_TO = ?,
          DUE_DATE = ?,
          CATEGORY_CD = ?,
          LAST_UPD_BY = ?,
          LAST_UPD = NOW()
        WHERE SR_NUM = ? AND ORG_ID = ? AND CREATED_BY = ?
      `;
      updateValues.push(
        formData.get('serviceName') || null,
        formData.get('statusCd') || null,
        formData.get('priorityCd') || null,
        formData.get('typeCd') || null,
        formData.get('subTypeCd') || null,
        formData.get('assignedTo') || null,
        formData.get('dueDate') || null,
        formData.get('categoryCd') || null,
        empid,
        srNum,
        orgid,
        empid
      );
    } else if (section === 'additional') {
      updateQuery = `
        UPDATE C_SRV_REQ SET
          ESCALATED_FLAG = ?,
          ESCALATED_TO = ?,
          ESCALATED_DATE = ?,
          CONTACT_ID = ?,
          ACCOUNT_ID = ?,
          ASSET_ID = ?,
          PAR_ROW_ID = ?,
          LAST_UPD_BY = ?,
          LAST_UPD = NOW()
        WHERE SR_NUM = ? AND ORG_ID = ? AND CREATED_BY = ?
      `;
      updateValues.push(
        formData.get('escalatedFlag') === 'true' ? 1 : 0,
        formData.get('escalatedTo') || null,
        formData.get('escalatedDate') || null,
        formData.get('contactId') || null,
        formData.get('accountId') || null,
        formData.get('assetId') || null,
        formData.get('parRowId') || null,
        empid,
        srNum,
        orgid,
        empid
      );
    } else if (section === 'description') {
      updateQuery = `
        UPDATE C_SRV_REQ SET
          DESCRIPTION = ?,
          COMMENTS = ?,
          LAST_UPD_BY = ?,
          LAST_UPD = NOW()
        WHERE SR_NUM = ? AND ORG_ID = ? AND CREATED_BY = ?
      `;
      updateValues.push(
        formData.get('description') || null,
        formData.get('comments') || null,
        empid,
        srNum,
        orgid,
        empid
      );
    } else if (section === 'attachments') {
      const attachments = [];
      const fileComments = [];
      const fileStatuses = [];
      const fileTypes = [];
      const existingFiles = [];

      for (const [key, value] of formData.entries()) {
        if (key.startsWith('attachment[')) {
          attachments.push(value);
        } else if (key.startsWith('fileComments[')) {
          fileComments.push(value);
        } else if (key.startsWith('fileStatuses[')) {
          fileStatuses.push(value);
        } else if (key.startsWith('fileTypes[')) {
          fileTypes.push(value);
        } else if (key.startsWith('existingFiles[')) {
          existingFiles.push(JSON.parse(value));
        }
      }

      // Fetch current attachments from the database
      const [currentAttachments] = await pool.query(
        'SELECT SR_ATT_ID FROM C_SRV_REQ_ATT WHERE SR_ID = ? AND CREATED_BY=?',
        [srNum,empid]
      );
      const currentAttachmentIds = currentAttachments.map((att) => att.SR_ATT_ID);
      const submittedAttachmentIds = existingFiles.map((file) => file.sr_att_id);

      // Delete attachments that are no longer in existingFiles
      const attachmentsToDelete = currentAttachmentIds.filter(
        (id) => !submittedAttachmentIds.includes(id)
      );
      if (attachmentsToDelete.length > 0) {
        await pool.query(
          'DELETE FROM C_SRV_REQ_ATT WHERE SR_ATT_ID IN (?) AND SR_ID = ?',
          [attachmentsToDelete, srNum]
        );
        console.log(`Deleted attachments for SR_ID=${srNum}:`, attachmentsToDelete);
      }

      // Update existing attachments
      for (const fileObj of existingFiles) {
        await pool.query(
          'UPDATE C_SRV_REQ_ATT SET COMMENTS = ?, ATTACHMENT_STATUS = ?, TYPE_CD = ?, LAST_UPD_BY = ?, LAST_UPD = NOW() WHERE SR_ATT_ID = ? AND SR_ID = ?',
          [fileObj.comments || null, fileObj.attachmentStatus || null, fileObj.type || null, empid, fileObj.sr_att_id, srNum]
        );
      }

      // Add new attachments
      if (attachments.length > 0) {
        const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'ServiceRequests');
        await mkdir(uploadDir, { recursive: true });
        for (let i = 0; i < attachments.length; i++) {
          const file = attachments[i];
          const timestamp = new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 14); // e.g., 20250721114223
          const uuid = uuidv4();
          const uniqueFileName = `${path.parse(file.name).name}_${timestamp}_${uuid}${path.extname(file.name)}`;
          const filePath = path.join(uploadDir, uniqueFileName);
          const arrayBuffer = await file.arrayBuffer();
          await writeFile(filePath, Buffer.from(arrayBuffer));
          await pool.query(
            'INSERT INTO C_SRV_REQ_ATT (SR_ID, TYPE_CD, FILE_NAME, FILE_PATH, COMMENTS, ATTACHMENT_STATUS, CREATED_BY, CREATED, LAST_UPD_BY, LAST_UPD) VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), ?, NOW())',
            [
              srNum,
              fileTypes[i] || file.type || 'application/octet-stream',
              file.name,
              uniqueFileName,
              fileComments[i] || null,
              fileStatuses[i] || null,
              empid,
              empid
            ]
          );
          console.log(`Attachment inserted: SR_ID=${srNum}, FILE_PATH=${uniqueFileName}`);
        }
      }

      return { success: true };
    }

    if (updateQuery) {
      const [result] = await pool.query(updateQuery, updateValues);
      if (result.affectedRows === 0) {
        return { success: false, error: 'Service request not found or you do not have access' };
      }
    }

    return { success: true };
  } catch (error) {
    console.error('Error updating service request:', error);
    return { success: false, error: error.message || 'Failed to update service request' };
  }
}

// Fetch activities for a service request (for creator to view resolver's work)
export async function fetchActivitiesForCreator(srNum, orgid, empid) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('jwt_token')?.value;
    if (!token) {
      console.error('No JWT token found');
      return { success: false, error: 'No authentication token found', activityRows: [] };
    }

    const decoded = decodeJwt(token);
    if (!decoded || decoded.orgid != orgid || decoded.empid != empid) {
      console.error('Invalid token or unauthorized access');
      return { success: false, error: 'Invalid or unauthorized authentication token', activityRows: [] };
    }

    const pool = await DBconnection();
    
    const [activityRows] = await pool.query(
      `SELECT ACT_ID, SR_ID, TYPE, SUB_TYPE, COMMENTS, START_DATE, END_DATE, 
              CREATED, CREATED_BY, LAST_UPD, LAST_UPD_BY 
       FROM C_SRV_ACTIVITIES 
       WHERE SR_ID = ?`,
      [srNum]
    );

    // Enrich rows with employee names
    const enrichedRows = await Promise.all(
      activityRows.map(async (details) => {
        try {
          const [empname] = await pool.query(
            'SELECT EMP_FST_NAME, EMP_LAST_NAME FROM C_EMP WHERE empid = ?',
            [details.CREATED_BY]
          );
          return {
            ...details,
            CREATED_BY_NAME: empname[0]
              ? `${empname[0].EMP_FST_NAME} ${empname[0].EMP_LAST_NAME}`
              : 'Unknown',
          };
        } catch (error) {
          console.error(`Error fetching employee name for CREATED_BY ${details.CREATED_BY}:`, error);
          return {
            ...details,
            CREATED_BY_NAME: 'Unknown',
          };
        }
      })
    );

    return { success: true, activityRows: enrichedRows };
  } catch (error) {
    console.error('Error fetching activities for creator:', error);
    return { success: false, error: error.message || 'Failed to fetch activities', activityRows: [] };
  }
}

// Fetch resolver attachments for a service request (for creator to view)
export async function fetchResolverAttachmentsForCreator(srNum, orgid, empid) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('jwt_token')?.value;
    if (!token) {
      console.error('No JWT token found');
      return { success: false, error: 'No authentication token found', attachments: [] };
    }

    const decoded = decodeJwt(token);
    if (!decoded || decoded.orgid != orgid || decoded.empid != empid) {
      console.error('Invalid token or unauthorized access');
      return { success: false, error: 'Invalid or unauthorized authentication token', attachments: [] };
    }

    const pool = await DBconnection();

    // Get attachments not created by the service request creator (i.e., resolver attachments)
    const [attachmentRows] = await pool.query(
      `SELECT SR_ATT_ID, SR_ID, FILE_NAME, FILE_PATH, TYPE_CD, COMMENTS, ATTACHMENT_STATUS, CREATED, CREATED_BY 
       FROM C_SRV_REQ_ATT 
       WHERE SR_ID = ? AND CREATED_BY != ?`,
      [srNum, empid]
    );

    // Enrich with creator names
    const enrichedAttachments = await Promise.all(
      attachmentRows.map(async (att) => {
        try {
          const [empname] = await pool.query(
            'SELECT EMP_FST_NAME, EMP_LAST_NAME FROM C_EMP WHERE empid = ?',
            [att.CREATED_BY]
          );
          return {
            ...att,
            CREATED_BY_NAME: empname[0]
              ? `${empname[0].EMP_FST_NAME} ${empname[0].EMP_LAST_NAME}`
              : 'Unknown',
          };
        } catch (error) {
          return {
            ...att,
            CREATED_BY_NAME: 'Unknown',
          };
        }
      })
    );

    return { success: true, attachments: enrichedAttachments };
  } catch (error) {
    console.error('Error fetching resolver attachments for creator:', error);
    return { success: false, error: error.message || 'Failed to fetch resolver attachments', attachments: [] };
  }
}
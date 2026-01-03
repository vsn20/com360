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

export async function fetchreqbyid() {
  let orgid, empid;
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('jwt_token')?.value;
    if (!token) {
      console.error('No JWT token found in cookies');
      throw new Error('Authentication token is missing');
    }

    const decoded = decodeJwt(token);
    if (!decoded || !decoded.orgid || !decoded.empid) {
      console.error('Invalid token: Decoded token is null or missing orgid/empid', { decoded });
      throw new Error('Invalid or missing authentication token');
    }

    orgid = decoded.orgid;
    empid = decoded.empid;

    const pool = await DBconnection();
    console.log('Connection established');

    const [features] = await pool.query(
      `SELECT roleid FROM C_EMP_ROLE_ASSIGN WHERE empid = ? AND orgid = ?`,
      [empid, orgid]
    );
    const roleids = features.map(details => details.roleid);
    // console.log("roleeeeeeeeee", roleids);

    let menuresults = [];
    if (roleids.length > 0) {
      [menuresults] = await pool.query(
        `SELECT alldata FROM C_ROLE_MENU_PERMISSIONS WHERE roleid IN (?) AND menuid = 11 AND alldata = 1`,
        [roleids]
      );
    }

    let rows;
    const allpermissions = menuresults.length > 0;
    // console.log("permissssssssssssssssssss", allpermissions);
    if (allpermissions) {
      [rows] = await pool.query(
        'SELECT SR_NUM, SERVICE_NAME, STATUS_CD, CREATED_BY, PRIORITY_CD FROM C_SRV_REQ WHERE ORG_ID = ?',
        [orgid]
      );
    } else {
      [rows] = await pool.query(
        'SELECT SR_NUM, SERVICE_NAME, STATUS_CD, CREATED_BY, PRIORITY_CD FROM C_SRV_REQ WHERE ASSIGNED_TO = ? AND ORG_ID = ?',
        [empid, orgid]
      );
    }

    



    // Enrich rows with employee full names
    const enrichedRows = await Promise.all(
      rows.map(async (details) => {
        try {
          const [empname] = await pool.query(
            'SELECT EMP_FST_NAME, EMP_LAST_NAME FROM C_EMP WHERE empid = ?',
            [details.CREATED_BY]
          );

          return {
            ...details,
            CREATED_BY: empname[0]
              ? `${empname[0].EMP_FST_NAME} ${empname[0].EMP_LAST_NAME}`
              : details.CREATED_BY || 'Unknown',
          };
        } catch (error) {
          console.error(`Error fetching employee name for CREATED_BY ${details.CREATED_BY}:`, error);
          return {
            ...details,
            CREATED_BY: details.CREATED_BY || 'Unknown',
          };
        }
      })
    );

    if (enrichedRows.length === 0) {
      console.log('No service requests found for ASSIGNED_TO:', empid);
    }

    return { rows: enrichedRows };
  } catch (error) {
    console.error('Error fetching service requests:', error);
    throw new Error(error.message || 'Failed to fetch service requests');
  }
}
export async function fetchServiceRequestById(SR_NUM, orgid, empid) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('jwt_token')?.value;
    if (!token) {
      console.error('No JWT token found in cookies');
      throw new Error('Authentication token is missing');
    }

    const decoded = decodeJwt(token);
    if (!decoded || decoded.orgid !== orgid || decoded.empid !== empid) {
      console.error('Invalid token or unauthorized access', { decoded, orgid, empid });
      throw new Error('Invalid or unauthorized authentication token');
    }

    const pool = await DBconnection();
    console.log('Connection established for fetchServiceRequestById');

    const [requestRows] = await pool.query(
      `SELECT SR_NUM, SERVICE_NAME, STATUS_CD, PRIORITY_CD, TYPE_CD, SUB_TYPE_CD, 
              CREATED_BY, ASSIGNED_TO, DUE_DATE, ESCALATED_FLAG, ESCALATED_TO, 
              ESCALATED_DATE, DESCRIPTION, COMMENTS, CONTACT_ID, ACCOUNT_ID, 
              ASSET_ID, PAR_ROW_ID, ORG_ID 
       FROM C_SRV_REQ 
       WHERE SR_NUM = ? AND ORG_ID = ?`,
      [SR_NUM, orgid]
    );
      

     let accountRows ;
    let accountname='-';
   if(requestRows[0].ACCOUNT_ID!=null){
     [accountRows] = await pool.execute(
          'SELECT ACCNT_ID, ALIAS_NAME FROM C_ACCOUNT WHERE ORGID = ? AND ACCNT_ID=? ',
          [orgid,requestRows[0].ACCOUNT_ID]
        );
         accountname=accountRows[0].ALIAS_NAME
      }



        const [empname] = await pool.query(
            'SELECT EMP_FST_NAME, EMP_LAST_NAME FROM C_EMP WHERE empid = ?',
            [requestRows[0].CREATED_BY]
          );

          let employeename=`${empname[0].EMP_FST_NAME} ${empname[0].EMP_LAST_NAME}`

    if (requestRows.length === 0) {
      console.log('No service request found for SR_NUM:', SR_NUM, 'ORG_ID:', orgid);
      throw new Error('Service request not found');
    }

    const serviceRequest = requestRows[0];
    
    const [attachmentRows] = await pool.query(
      `SELECT SR_ATT_ID, SR_ID, FILE_NAME, FILE_PATH, TYPE_CD, COMMENTS, ATTACHMENT_STATUS 
       FROM C_SRV_REQ_ATT 
       WHERE SR_ID = ? AND CREATED_BY = ?`,
      [SR_NUM, serviceRequest.CREATED_BY]
    );

    return {
      ...serviceRequest,
      attachments: attachmentRows || [],
      CREATED_BY:employeename,
      accountname:accountname
    };
  } catch (error) {
    console.error('Error fetching service request by ID:', error);
    throw new Error(error.message || 'Failed to fetch service request');
  }
}

export async function fetchActivitiesBySrId(SR_NUM, orgid, empid) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('jwt_token')?.value;
    if (!token) {
      console.error('No JWT token found in cookies');
      throw new Error('Authentication token is missing');
    }

    const decoded = decodeJwt(token);
    if (!decoded || decoded.orgid !== orgid || decoded.empid !== empid) {
      console.error('Invalid token or unauthorized access', { decoded, orgid, empid });
      throw new Error('Invalid or unauthorized authentication token');
    }

    const pool = await DBconnection();
    console.log('Connection established for fetchActivitiesBySrId');

    const [activityRows] = await pool.query(
      `SELECT ACT_ID, SR_ID, TYPE, SUB_TYPE, COMMENTS, START_DATE, END_DATE, 
              CREATED, CREATED_BY, LAST_UPD, LAST_UPD_BY 
       FROM C_SRV_ACTIVITIES 
       WHERE SR_ID = ?`,
      [SR_NUM]
    );

    const enrichedRows = await Promise.all(
      activityRows.map(async (details) => {
        try {
          const [empname] = await pool.query(
            'SELECT EMP_FST_NAME, EMP_LAST_NAME FROM C_EMP WHERE empid = ?',
            [details.CREATED_BY]
          );

          return {
            ...details,
            CREATED_BY: empname[0]
              ? `${empname[0].EMP_FST_NAME} ${empname[0].EMP_LAST_NAME}`
              : details.CREATED_BY || 'Unknown',
          };
        } catch (error) {
          console.error(`Error fetching employee name for CREATED_BY ${details.CREATED_BY}:`, error);
          return {
            ...details,
            CREATED_BY: details.CREATED_BY || 'Unknown',
          };
        }
      })
    );

    if (enrichedRows.length === 0) {
      console.log('No service requests found for ASSIGNED_TO:', empid);
    }

    return {activityRows:enrichedRows};
  } catch (error) {
    console.error('Error fetching activities by SR_ID:', error);
    throw new Error(error.message || 'Failed to fetch activities');
  }
}

export async function addActivity(activityData) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('jwt_token')?.value;
    if (!token) {
      console.error('No JWT token found in cookies');
      throw new Error('Authentication token is missing');
    }

    const decoded = decodeJwt(token);
    if (!decoded || decoded.orgid !== activityData.orgid || decoded.empid !== activityData.empid) {
      console.error('Invalid token or unauthorized access', { decoded, orgid: activityData.orgid, empid: activityData.empid });
      throw new Error('Invalid or unauthorized authentication token');
    }

    const pool = await DBconnection();
    console.log('Connection established for addActivity');

    const [result] = await pool.query(
      `INSERT INTO C_SRV_ACTIVITIES (SR_ID, TYPE, SUB_TYPE, COMMENTS, START_DATE, END_DATE, CREATED_BY, LAST_UPD_BY)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        activityData.SR_ID,
        activityData.TYPE,
        activityData.SUB_TYPE,
        activityData.COMMENTS,
        activityData.START_DATE || null,
        activityData.END_DATE || null,
        activityData.empid,
        activityData.empid,
      ]
    );

    if (result.affectedRows === 0) {
      console.error('No activity inserted', { activityData });
      throw new Error('Failed to insert activity');
    }

    return { success: true, insertId: result.insertId };
  } catch (error) {
    console.error('Error adding activity:', error);
    return { success: false, error: error.message || 'Failed to add activity' };
  }
}

export async function updateServiceRequestStatus({ SR_NUM, orgid, empid, statusCd }) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('jwt_token')?.value;
    if (!token) {
      console.error('No JWT token found in cookies');
      throw new Error('Authentication token is missing');
    }

    const decoded = decodeJwt(token);
    if (!decoded || decoded.orgid !== orgid || decoded.empid !== empid) {
      console.error('Invalid token or unauthorized access', { decoded, orgid, empid });
      throw new Error('Invalid or unauthorized authentication token');
    }

    const pool = await DBconnection();
    console.log('Connection established for updateServiceRequestStatus');

    const [result] = await pool.query(
      'UPDATE C_SRV_REQ SET STATUS_CD = ? WHERE SR_NUM = ? AND ORG_ID = ?',
      [statusCd, SR_NUM, orgid]
    );

    if (result.affectedRows === 0) {
      console.error('No service request found or no changes made', { SR_NUM, orgid });
      throw new Error('Service request not found or no changes made');
    }

    return { success: true };
  } catch (error) {
    console.error('Error updating service request status:', error);
    return { success: false, error: error.message || 'Failed to update service request status' };
  }
}

export async function addAttachment(attachmentData, file) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('jwt_token')?.value;
    if (!token) {
      console.error('No JWT token found in cookies');
      throw new Error('Authentication token is missing');
    }

    const decoded = decodeJwt(token);
    if (!decoded || decoded.orgid !== attachmentData.orgid || decoded.empid !== attachmentData.empid) {
      console.error('Invalid token or unauthorized access', { decoded, orgid: attachmentData.orgid, empid: attachmentData.empid });
      throw new Error('Invalid or unauthorized authentication token');
    }

    const uploadDir = path.join(process.cwd(), 'public', 'uploads','ServiceRequests');
    await mkdir(uploadDir, { recursive: true });
    const timestamp = new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 14);
    const uuid = uuidv4();
    const uniqueFileName = `${path.parse(file.name).name}_${timestamp}_${uuid}${path.extname(file.name)}`;
    const filePath = path.join(uploadDir, uniqueFileName);
    await writeFile(filePath, Buffer.from(await file.arrayBuffer()));

    const pool = await DBconnection();
    console.log('Connection established for addAttachment');

    const [result] = await pool.query(
      `INSERT INTO C_SRV_REQ_ATT (SR_ID, FILE_NAME, FILE_PATH, TYPE_CD, COMMENTS, ATTACHMENT_STATUS, CREATED_BY)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        attachmentData.SR_ID,
        file.name,
        uniqueFileName,
        attachmentData.TYPE_CD || '',
        attachmentData.COMMENTS || '',
        'Active',
        attachmentData.empid
      ]
    );

    if (result.affectedRows === 0) {
      console.error('No attachment inserted', { attachmentData });
      throw new Error('Failed to insert attachment');
    }

    return { success: true, insertId: result.insertId };
  } catch (error) {
    console.error('Error adding attachment:', error);
    return { success: false, error: error.message || 'Failed to add attachment' };
  }
}

export async function updateActivity(activityData) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('jwt_token')?.value;
    if (!token) {
      console.error('No JWT token found in cookies');
      throw new Error('Authentication token is missing');
    }

    const decoded = decodeJwt(token);
    if (!decoded || decoded.orgid !== activityData.orgid || decoded.empid !== activityData.empid) {
      console.error('Invalid token or unauthorized access', { decoded, orgid: activityData.orgid, empid: activityData.empid });
      throw new Error('Invalid or unauthorized authentication token');
    }

    const pool = await DBconnection();
    console.log('Connection established for updateActivity');

    const [result] = await pool.query(
      `UPDATE C_SRV_ACTIVITIES 
       SET TYPE = ?, SUB_TYPE = ?, COMMENTS = ?, START_DATE = ?, END_DATE = ?, LAST_UPD_BY = ?
       WHERE ACT_ID = ? AND SR_ID = ?`,
      [
        activityData.TYPE,
        activityData.SUB_TYPE,
        activityData.COMMENTS,
        activityData.START_DATE || null,
        activityData.END_DATE || null,
        activityData.empid,
        activityData.ACT_ID,
        activityData.SR_ID
      ]
    );

    if (result.affectedRows === 0) {
      console.error('No activity updated', { activityData });
      throw new Error('Activity not found or no changes made');
    }

    return { success: true };
  } catch (error) {
    console.error('Error updating activity:', error);
    return { success: false, error: error.message || 'Failed to update activity' };
  }
}

export async function fetchResolverAttachments(SR_NUM, orgid, empid) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('jwt_token')?.value;
    if (!token) {
      console.error('No JWT token found in cookies');
      throw new Error('Authentication token is missing');
    }

    const decoded = decodeJwt(token);
    if (!decoded || decoded.orgid !== orgid || decoded.empid !== empid) {
      console.error('Invalid token or unauthorized access', { decoded, orgid, empid });
      throw new Error('Invalid or unauthorized authentication token');
    }

    const pool = await DBconnection();
    console.log('Connection established for fetchResolverAttachments');

    const [requestRows] = await pool.query(
      `SELECT ASSIGNED_TO 
       FROM C_SRV_REQ 
       WHERE SR_NUM = ? AND ORG_ID = ?`,
      [SR_NUM, orgid]
    );

    if (requestRows.length === 0) {
      console.log('No service request found for SR_NUM:', SR_NUM, 'ORG_ID:', orgid);
      throw new Error('Service request not found');
    }

    const assignedTo = requestRows[0].ASSIGNED_TO;

    const [attachmentRows] = await pool.query(
      `SELECT SR_ATT_ID, SR_ID, FILE_NAME, FILE_PATH, TYPE_CD, COMMENTS, ATTACHMENT_STATUS 
       FROM C_SRV_REQ_ATT 
       WHERE SR_ID = ? AND CREATED_BY = ?`,
      [SR_NUM, assignedTo]
    );

    return attachmentRows || [];
  } catch (error) {
    console.error('Error fetching resolver attachments:', error);
    throw new Error(error.message || 'Failed to fetch resolver attachments');
  }
}

export async function deleteAttachment({ SR_ATT_ID, SR_ID, orgid, empid }) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('jwt_token')?.value;
    if (!token) {
      console.error('No JWT token found in cookies');
      throw new Error('Authentication token is missing');
    }

    const decoded = decodeJwt(token);
    if (!decoded || decoded.orgid !== orgid || decoded.empid !== empid) {
      console.error('Invalid token or unauthorized access', { decoded, orgid, empid });
      throw new Error('Invalid or unauthorized authentication token');
    }

    const pool = await DBconnection();
    console.log('Connection established for deleteAttachment');

    const [res]=await pool.query(
        'select CREATED_BY FROM C_SRV_REQ WHERE SR_NUM=?',
        [SR_ID]
    );
    const s=res[0];
    const [result] = await pool.query(
      `DELETE FROM C_SRV_REQ_ATT WHERE SR_ATT_ID = ? AND SR_ID = ? AND CREATED_BY != ?`,
      [SR_ATT_ID, SR_ID,s.CREATED_BY]
    );

    if (result.affectedRows === 0) {
      console.error('No attachment deleted', { SR_ATT_ID, SR_ID, empid });
      throw new Error('Attachment not found or you do not have permission to delete it');
    }

    return { success: true };
  } catch (error) {
    console.error('Error deleting attachment:', error);
    return { success: false, error: error.message || 'Failed to delete attachment' };
  }
}
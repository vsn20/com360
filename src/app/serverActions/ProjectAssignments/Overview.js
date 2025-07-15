'use server';

import DBconnection from '@/app/utils/config/db';
import { cookies } from 'next/headers';

const decodeJwt = (token) => {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = Buffer.from(base64, 'base64').toString('utf8');
    return JSON.parse(jsonPayload);
  } catch (error) {
    console.error('Error decoding JWT:', error.message);
    return null;
  }
};

const getCurrentUserEmpIdName = async (pool, userId, orgId) => {
  try {
    const [userRows] = await pool.execute(
      'SELECT empid FROM C_USER WHERE username = ? AND orgid = ?',
      [userId, orgId]
    );
    if (userRows.length === 0) {
      console.error('User not found in C_USER for username:', userId);
      return 'system';
    }
    const empid = userRows[0].empid;

    const [empRows] = await pool.execute(
      'SELECT EMP_FST_NAME, EMP_LAST_NAME, roleid FROM C_EMP WHERE empid = ? AND orgid = ?',
      [empid, orgId]
    );
    if (empRows.length === 0) {
      console.error('Employee not found in C_EMP for empid:', empid);
      return `${empid}-unknown`;
    }
    const { EMP_FST_NAME, EMP_LAST_NAME, roleid } = empRows[0];
    const [roleRows] = await pool.execute(
      'SELECT rolename FROM org_role_table WHERE roleid = ? AND orgid = ?',
      [roleid, orgId]
    );
    const { rolename } = roleRows[0] || { rolename: 'Unknown' };
    return `${empid}-${EMP_FST_NAME} ${EMP_LAST_NAME} (${rolename})`;
  } catch (error) {
    console.error('Error fetching empid-name:', error.message);
    return 'system';
  }
};

export async function fetchProjectsForAssignment() {
  let pool;
  try {
    const cookieStore = await cookies();
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
    if (!orgId) {
      console.log('orgId is undefined or invalid');
      throw new Error('Organization ID is missing or invalid.');
    }

    console.log(`Fetching projects for orgId: ${orgId}`);
    pool = await DBconnection();
    const [rows] = await pool.execute(
      `SELECT PRJ_ID, PRJ_NAME, PRS_DESC, ACCNT_ID, START_DT, END_DT 
       FROM C_PROJECT 
       WHERE ORG_ID = ?`,
      [orgId]
    );
    console.log('Fetched projects:', rows);
    return rows;
  } catch (error) {
    console.error('Error fetching projects for assignment:', error.message);
    throw new Error(`Failed to fetch projects for assignment: ${error.message}`);
  }
}

export async function fetchProjectAssignmentDetails(PRJ_ID, EMP_ID) {
  let pool;
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('jwt_token')?.value;

    if (!token) {
      console.log('No token found');
      throw new Error('No token found. Please log in.');
    }

    if (!PRJ_ID) {
      console.log('Project ID is required');
      throw new Error('Project ID is required');
    }

    pool = await DBconnection();
    let query = `
      SELECT 
        pe.ROW_ID,
        pe.EMP_ID,
        pe.PRJ_ID,
        DATE_FORMAT(pe.START_DT, '%Y-%m-%d') AS START_DT,
        DATE_FORMAT(pe.END_DT, '%Y-%m-%d') AS END_DT,
        pe.BILL_RATE,
        pe.BILL_TYPE,
        pe.OT_BILL_RATE,
        pe.OT_BILL_TYPE,
        pe.BILLABLE_FLAG,
        pe.OT_BILLABLE_FLAG,
        pe.PAY_TERM,
        pe.CREATED_BY,
        pe.LAST_UPDATED_BY,
        DATE_FORMAT(pe.LAST_UPDATED_DATE, '%Y-%m-%d') AS LAST_UPDATED_DATE,
        CONCAT(COALESCE(e.EMP_FST_NAME, ''), ' ', COALESCE(e.EMP_MID_NAME, ''), ' ', COALESCE(e.EMP_LAST_NAME, '')) AS EMP_NAME
      FROM C_PROJ_EMP pe
      LEFT JOIN C_EMP e ON pe.EMP_ID = e.empid
      WHERE pe.PRJ_ID = ?
    `;
    let params = [PRJ_ID];

    if (EMP_ID) {
      query += ` AND pe.EMP_ID = ?`;
      params.push(EMP_ID);
    }

    const [rows] = await pool.execute(query, params);
    console.log('Fetched assignment details:', rows);
    return rows;
  } catch (error) {
    console.error('Error fetching assignment details:', error.message);
    throw new Error(`Failed to fetch assignment details: ${error.message}`);
  }
}

export async function updateProjectAssignment(formData) {
  const PRJ_ID = formData.get('PRJ_ID')?.trim();
  const EMP_ID = formData.get('EMP_ID')?.trim();
  const section = formData.get('section')?.trim();

  console.log('updateProjectAssignment FormData:', {
    PRJ_ID,
    EMP_ID,
    section,
    formData: Object.fromEntries(formData)
  });

  const cookieStore = cookies();
  const token = cookieStore.get('jwt_token')?.value;

  if (!token) {
    console.log('No token found');
    return { error: 'No token found. Please log in.', success: false };
  }

  const decoded = decodeJwt(token);
  if (!decoded || !decoded.orgid || !decoded.userId) {
    console.log('Invalid token or orgid/userId not found');
    return { error: 'Invalid token or orgid/userId not found.', success: false };
  }

  const orgId = decoded.orgid;
  const userId = decoded.userId;

  if (!PRJ_ID || !EMP_ID) {
    console.log('Project ID and Employee ID are required');
    return { error: 'Project ID and Employee ID are required.', success: false };
  }

  let pool;
  let retryCount = 0;
  const maxRetries = 2;

  while (retryCount <= maxRetries) {
    try {
      console.log(`Attempting to connect to MySQL (attempt ${retryCount + 1})...`);
      pool = await DBconnection();
      console.log('MySQL connection pool acquired');

      const [existing] = await pool.execute(
        'SELECT ROW_ID, START_DT, END_DT FROM C_PROJ_EMP WHERE PRJ_ID = ? AND EMP_ID = ?',
        [PRJ_ID, EMP_ID]
      );
      if (existing.length === 0) {
        console.log('Assignment not found');
        return { error: 'Assignment not found.', success: false };
      }

      const [project] = await pool.execute(
        'SELECT START_DT, END_DT FROM C_PROJECT WHERE PRJ_ID = ? AND ORG_ID = ?',
        [PRJ_ID, orgId]
      );
      if (project.length === 0) {
        console.log('Project not found');
        return { error: 'Project not found.', success: false };
      }
      const projectStartDt = project[0].START_DT;
      const projectEndDt = project[0].END_DT;

      const updatedBy = await getCurrentUserEmpIdName(pool, userId, orgId);
      let affectedRows = 0;

      if (section === 'basic') {
        const startDt = formData.get('START_DT')?.trim() || null;
        const endDt = formData.get('END_DT')?.trim() || null;

        console.log('Basic details:', { startDt, endDt, updatedBy });

        if (!startDt) {
          console.log('Start Date is required');
          return { error: 'Start Date is required.', success: false };
        }
        if (startDt && projectStartDt && new Date(startDt) < new Date(projectStartDt)) {
          console.log('Assignment start date must be on or after project start date');
          return { error: `Assignment start date must be on or after project start date (${projectStartDt.toISOString().split('T')[0]}).`, success: false };
        }
        if (endDt && projectEndDt && new Date(endDt) > new Date(projectEndDt)) {
          console.log('Assignment end date must be on or before project end date');
          return { error: `Assignment end date must be on or before project end date (${projectEndDt.toISOString().split('T')[0]}).`, success: false };
        }

        const [result] = await pool.query(
          `UPDATE C_PROJ_EMP 
           SET START_DT = ?, END_DT = ?, 
               LAST_UPDATED_BY = ?, LAST_UPDATED_DATE = ?, MODIFICATION_NUM = MODIFICATION_NUM + 1
           WHERE PRJ_ID = ? AND EMP_ID = ?`,
          [startDt, endDt, updatedBy, new Date(), PRJ_ID, EMP_ID]
        );

        affectedRows += result.affectedRows;
        console.log(`Basic details update result: ${result.affectedRows} rows affected for PRJ_ID ${PRJ_ID}, EMP_ID ${EMP_ID}`);
      } else if (section === 'additional') {
        const billRate = formData.get('BILL_RATE') ? parseFloat(formData.get('BILL_RATE')) : null;
        const billType = formData.get('BILL_TYPE')?.trim() || null;
        const otBillRate = formData.get('OT_BILL_RATE') ? parseFloat(formData.get('OT_BILL_RATE')) : null;
        const otBillType = formData.get('OT_BILL_TYPE')?.trim() || null;
        const billableFlag = formData.get('BILLABLE_FLAG')?.trim() === '1' ? 1 : 0;
        const otBillableFlag = formData.get('OT_BILLABLE_FLAG')?.trim() === '1' ? 1 : 0;
        const payTerm = formData.get('PAY_TERM')?.trim() || null;

        console.log('Additional details:', {
          billRate, billType, otBillRate, otBillType, billableFlag, otBillableFlag, payTerm, updatedBy
        });

        if (!billRate) {
          console.log('Bill Rate is required');
          return { error: 'Bill Rate is required.', success: false };
        }
        if (!billType) {
          console.log('Bill Type is required');
          return { error: 'Bill Type is required.', success: false };
        }
        if (!payTerm) {
          console.log('Payment Term is required');
          return { error: 'Payment Term is required.', success: false };
        }

        if (billType) {
          const [billTypeCheck] = await pool.execute(
            'SELECT id FROM generic_values WHERE g_id = 7 AND Name = ? AND orgid = ? AND isactive = 1',
            [billType, orgId]
          );
          if (billTypeCheck.length === 0) {
            console.log('Invalid bill type');
            return { error: 'Invalid bill type.', success: false };
          }
        }

        if (otBillType) {
          const [otBillTypeCheck] = await pool.execute(
            'SELECT id FROM generic_values WHERE g_id = 8 AND Name = ? AND orgid = ? AND isactive = 1',
            [otBillType, orgId]
          );
          if (otBillTypeCheck.length === 0) {
            console.log('Invalid OT bill type');
            return { error: 'Invalid OT bill type.', success: false };
          }
        }

        if (payTerm) {
          const [payTermCheck] = await pool.execute(
            'SELECT id FROM generic_values WHERE g_id = 9 AND Name = ? AND orgid = ? AND isactive = 1',
            [payTerm, orgId]
          );
          if (payTermCheck.length === 0) {
            console.log('Invalid pay term');
            return { error: 'Invalid pay term.', success: false };
          }
        }

        const [result] = await pool.query(
          `UPDATE C_PROJ_EMP 
           SET BILL_RATE = ?, BILL_TYPE = ?, OT_BILL_RATE = ?, OT_BILL_TYPE = ?, 
               BILLABLE_FLAG = ?, OT_BILLABLE_FLAG = ?, PAY_TERM = ?, 
               LAST_UPDATED_BY = ?, LAST_UPDATED_DATE = ?, MODIFICATION_NUM = MODIFICATION_NUM + 1
           WHERE PRJ_ID = ? AND EMP_ID = ?`,
          [
            billRate, billType, otBillRate, otBillType, billableFlag, otBillableFlag, payTerm,
            updatedBy, new Date(), PRJ_ID, EMP_ID
          ]
        );

        affectedRows += result.affectedRows;
        console.log(`Additional details update result: ${result.affectedRows} rows affected for PRJ_ID ${PRJ_ID}, EMP_ID ${EMP_ID}`);
      } else {
        console.log('Invalid section:', section);
        return { error: 'Invalid section specified.', success: false };
      }

      if (affectedRows === 0) {
        console.log('No rows updated for PRJ_ID:', PRJ_ID, 'EMP_ID:', EMP_ID);
        return { error: 'No changes were applied.', success: false };
      }

      console.log(`Assignment updated: PRJ_ID ${PRJ_ID}, EMP_ID ${EMP_ID}, section ${section}, affectedRows: ${affectedRows}`);
      return { success: true, updatedBy };
    } catch (error) {
      console.error('Error updating project assignment:', error.message);
      if (error.message.includes('Pool is closed') && retryCount < maxRetries) {
        console.log('Pool is closed, retrying connection...');
        retryCount++;
        continue;
      }
      return { error: `Failed to update project assignment: ${error.message}`, success: false };
    }
  }

  return { error: 'Failed to update project assignment after multiple retries: Pool is closed', success: false };
}
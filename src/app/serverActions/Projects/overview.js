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
    console.error('Error decoding JWT:', error);
    return null;
  }
};

const getCurrentUserEmpIdName = async (pool, userId, orgId) => {
  try {
    // Fetch empid from C_USER using username (userId)
    const [userRows] = await pool.execute(
      'SELECT empid FROM C_USER WHERE username = ? AND orgid = ?',
      [userId, orgId]
    );
    if (userRows.length === 0) {
      console.error('User not found in C_USER for username:', userId);
      return 'unknown';
    }
    const empid = userRows[0].empid;

    // Fetch employee name from C_EMP
    const [empRows] = await pool.execute(
      'SELECT EMP_FST_NAME, EMP_LAST_NAME,roleid FROM C_EMP WHERE empid = ? AND orgid = ?',
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

export async function updateproject(formData) {
  const prjId = formData.get('PRJ_ID')?.trim();
  const section = formData.get('section')?.trim();

  console.log('updateproject FormData:', {
    prjId,
    section,
    formData: Object.fromEntries(formData)
  });

  const cookieStore = cookies();
  const token = cookieStore.get('jwt_token')?.value;

  if (!token) {
    console.log('No token found');
    return { error: 'No token found. Please log in.' };
  }

  const decoded = decodeJwt(token);
  if (!decoded || !decoded.orgid || !decoded.userId) {
    console.log('Invalid token or orgid/userId not found');
    return { error: 'Invalid token or orgid/userId not found.' };
  }

  const orgId = decoded.orgid;
  const userId = decoded.userId;

  if (!prjId) {
    console.log('Project ID is required');
    return { error: 'Project ID is required.' };
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
        'SELECT PRJ_ID FROM C_PROJECT WHERE PRJ_ID = ? AND ORG_ID = ?',
        [prjId, orgId]
      );
      if (existing.length === 0) {
        console.log('Project not found');
        return { error: 'Project not found.' };
      }

      const updatedBy = await getCurrentUserEmpIdName(pool, userId, orgId);
      let affectedRows = 0;

      if (section === 'basic') {
        const prjName = formData.get('PRJ_NAME')?.trim();
        const prsDesc = formData.get('PRS_DESC')?.trim() || null;
        const accntId = formData.get('ACCNT_ID')?.trim();

        console.log('Basic details:', { prjName, prsDesc, accntId, updatedBy });

        if (!prjName) {
          console.log('Project name is required');
          return { error: 'Project name is required.' };
        }
        if (!accntId) {
          console.log('Account is required');
          return { error: 'Account is required.' };
        }

        const [accountCheck] = await pool.execute(
          'SELECT ACCNT_ID FROM C_ACCOUNT WHERE ACCNT_ID = ? AND ORGID = ? AND ACTIVE_FLAG = 1',
          [accntId, orgId]
        );
        if (accountCheck.length === 0) {
          console.log('Invalid or inactive account');
          return { error: 'Invalid or inactive account.' };
        }

        const [result] = await pool.query(
          `UPDATE C_PROJECT 
           SET PRJ_NAME = ?, PRS_DESC = ?, ACCNT_ID = ?, 
               Updatedby = ?, last_updated_date = ?
           WHERE PRJ_ID = ? AND ORG_ID = ?`,
          [prjName, prsDesc, accntId, updatedBy, new Date(), prjId, orgId]
        );

        affectedRows += result.affectedRows;
        console.log(`Basic details update result: ${result.affectedRows} rows affected for PRJ_ID ${prjId}`);
      } else if (section === 'additional') {
        const billRate = formData.get('BILL_RATE') ? parseFloat(formData.get('BILL_RATE')) : null;
        const billType = formData.get('BILL_TYPE')?.trim() || null;
        const otBillRate = formData.get('OT_BILL_RATE') ? parseFloat(formData.get('OT_BILL_RATE')) : null;
        const otBillType = formData.get('OT_BILL_TYPE')?.trim() || null;
        const billableFlag = formData.get('BILLABLE_FLAG')?.trim() === '1' ? 1 : 0;
        const startDt = formData.get('START_DT') || null;
        const endDt = formData.get('END_DT') || null;
        const clientId = formData.get('CLIENT_ID')?.trim() || null;
        const payTerm = formData.get('PAY_TERM')?.trim() || null;
        const invoiceEmail = formData.get('INVOICE_EMAIL')?.trim() || null;
        const invoiceFax = formData.get('INVOICE_FAX')?.trim() || null;
        const invoicePhone = formData.get('INVOICE_PHONE')?.trim() || null;

        console.log('Additional details:', {
          billRate, billType, otBillRate, otBillType, billableFlag, startDt, endDt,
          clientId, payTerm, invoiceEmail, invoiceFax, invoicePhone, updatedBy
        });

        if (!clientId) {
          console.log('Client is required');
          return { error: 'Client is required.' };
        }

        const [clientCheck] = await pool.execute(
          'SELECT ACCNT_ID FROM C_ACCOUNT WHERE ACCNT_ID = ? AND ORGID = ? AND ACTIVE_FLAG = 1',
          [clientId, orgId]
        );
        if (clientCheck.length === 0) {
          console.log('Invalid or inactive client');
          return { error: 'Invalid or inactive client.' };
        }

        if (billType) {
          const [billTypeCheck] = await pool.execute(
            'SELECT id FROM C_GENERIC_VALUES WHERE g_id = 7 AND Name = ? AND orgid = ? AND isactive = 1',
            [billType, orgId]
          );
          if (billTypeCheck.length === 0) {
            console.log('Invalid bill type');
            return { error: 'Invalid bill type.' };
          }
        }

        if (otBillType) {
          const [otBillTypeCheck] = await pool.execute(
            'SELECT id FROM C_GENERIC_VALUES WHERE g_id = 8 AND Name = ? AND orgid = ? AND isactive = 1',
            [otBillType, orgId]
          );
          if (otBillTypeCheck.length === 0) {
            console.log('Invalid OT bill type');
            return { error: 'Invalid OT bill type.' };
          }
        }

        if (payTerm) {
          const [payTermCheck] = await pool.execute(
            'SELECT id FROM C_GENERIC_VALUES WHERE g_id = 9 AND Name = ? AND orgid = ? AND isactive = 1',
            [payTerm, orgId]
          );
          if (payTermCheck.length === 0) {
            console.log('Invalid pay term');
            return { error: 'Invalid pay term.' };
          }
        }

        const [result] = await pool.query(
          `UPDATE C_PROJECT 
           SET BILL_RATE = ?, BILL_TYPE = ?, OT_BILL_RATE = ?, OT_BILL_TYPE = ?, 
               BILLABLE_FLAG = ?, START_DT = ?, END_DT = ?, CLIENT_ID = ?, 
               PAY_TERM = ?, INVOICE_EMAIL = ?, INVOICE_FAX = ?, INVOICE_PHONE = ?, 
               Updatedby = ?, last_updated_date = ?
           WHERE PRJ_ID = ? AND ORG_ID = ?`,
          [
            billRate, billType, otBillRate, otBillType, billableFlag, startDt, endDt,
            clientId, payTerm, invoiceEmail, invoiceFax, invoicePhone, updatedBy,
            new Date(), prjId, orgId
          ]
        );

        affectedRows += result.affectedRows;
        console.log(`Additional details update result: ${result.affectedRows} rows affected for PRJ_ID ${prjId}`);
      } else {
        console.log('Invalid section:', section);
        return { error: 'Invalid section specified.' };
      }

      if (affectedRows === 0) {
        console.log('No rows updated for PRJ_ID:', prjId);
        return { error: 'No changes were applied.' };
      }

      console.log(`Project updated: PRJ_ID ${prjId}, section ${section}, affectedRows: ${affectedRows}`);
      return { success: true, updatedBy };
    } catch (error) {
      console.error('Error updating project:', error.message);
      if (error.message.includes('Pool is closed') && retryCount < maxRetries) {
        console.log('Pool is closed, retrying connection...');
        retryCount++;
        continue;
      }
      return { error: `Failed to update project: ${error.message}` };
    } 
  }

  return { error: 'Failed to update project after multiple retries: Pool is closed' };
}

export async function fetchprojectsbyorgid() {
  let pool;
  try {
    const cookieStore = cookies();
    const cookie = cookieStore.get('jwt_token');
    const token = cookie?.value;

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
    console.log('MySQL connected');
    const [rows] = await pool.execute(
      `SELECT PRJ_ID, PRJ_NAME, PRS_DESC, ACCNT_ID, ORG_ID, BILL_RATE, BILL_TYPE, OT_BILL_RATE, OT_BILL_TYPE,
              BILLABLE_FLAG, START_DT, END_DT, CLIENT_ID, PAY_TERM, INVOICE_EMAIL, INVOICE_FAX, INVOICE_PHONE,
              Createdby, Updatedby,last_updated_date
       FROM C_PROJECT WHERE ORG_ID = ?`,
      [orgId]
    );
    console.log('Fetched projects:', rows);
    return rows;
  } catch (error) {
    console.error('Error fetching projects:', error.message);
    throw new Error(`Failed to fetch projects: ${error.message}`);
  } 
}

export async function fetchaccountsbyorgid() {
  let pool;
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
    if (!orgId) {
      console.log('orgId is undefined or invalid');
      throw new Error('Organization ID is missing or invalid.');
    }

    console.log(`Fetching accounts for orgId: ${orgId}`);
    pool = await DBconnection();
    console.log('MySQL connection pool acquired');
    const [rows] = await pool.execute(
      `SELECT ACCNT_ID, ALIAS_NAME FROM C_ACCOUNT WHERE ORGID = ? AND ACTIVE_FLAG = 1`,
      [orgId]
    );
    if (rows.length === 0) {
      console.log('No accounts found for orgId:', orgId);
      throw new Error('No accounts found for the given organization.');
    }

    console.log('Fetched accounts:', rows);
    return rows;
  } catch (error) {
    console.error('Error fetching account:', error.message);
    throw new Error(`Failed to fetch account: ${error.message}`);
  } 
}

export async function fetchProjectById(prjId) {
  let pool;
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
    if (!orgId) {
      console.log('orgId is undefined or invalid');
      throw new Error('Organization ID is missing or invalid.');
    }

    if (!prjId) {
      console.log('Project ID is required');
      throw new Error('Project ID is required.');
    }

    console.log(`Fetching project for prjId: ${prjId}, orgId: ${orgId}`);
    pool = await DBconnection();
    console.log('MySQL connection pool acquired');
    const [rows] = await pool.execute(
      `SELECT PRJ_ID, PRJ_NAME, PRS_DESC, ACCNT_ID, ORG_ID, BILL_RATE, BILL_TYPE, OT_BILL_RATE, OT_BILL_TYPE,
              BILLABLE_FLAG, START_DT, END_DT, CLIENT_ID, PAY_TERM, INVOICE_EMAIL, INVOICE_FAX, INVOICE_PHONE,
              Createdby, Updatedby,last_updated_date
       FROM C_PROJECT WHERE PRJ_ID = ? AND ORG_ID = ?`,
      [prjId, orgId]
    );

    if (rows.length === 0) {
      console.log('No project found for prjId:', prjId);
      throw new Error('No project found for the given ID.');
    }

    console.log('Fetched project:', rows[0]);
    return rows[0];
  } catch (error) {
    console.error('Error fetching project:', error.message);
    throw new Error(`Failed to fetch project: ${error.message}`);
  }
}
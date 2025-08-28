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
    const [userRows] = await pool.execute(
      'SELECT empid FROM C_USER WHERE username = ? AND orgid = ?',
      [userId, orgId]
    );
    if (userRows.length === 0) {
      console.error('User not found in C_USER for username:', userId);
      return 'unknown';
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
    const { EMP_FST_NAME, EMP_LAST_NAME } = empRows[0];
    return `${empid}-${EMP_FST_NAME} ${EMP_LAST_NAME}`;
  } catch (error) {
    console.error('Error fetching empid-name:', error.message);
    return 'system';
  }
};

const getSuborgIdForAccount = async (pool, accntId, orgId) => {
  try {
    const [rows] = await pool.execute(
      'SELECT suborgid FROM C_ACCOUNT WHERE ACCNT_ID = ? AND ORGID = ? AND ACTIVE_FLAG = 1',
      [accntId, orgId]
    );
    return rows.length > 0 ? rows[0].suborgid : null;
  } catch (error) {
    console.error('Error fetching suborgid for account:', error.message);
    return null;
  }
};

export async function addProject(prevState, formData) {
  const prjName = formData.get('prjName')?.trim();
  const prsDesc = formData.get('prsDesc')?.trim() || null;
  const accntId = formData.get('accntId')?.trim();
  const billRate = formData.get('billRate') ? parseFloat(formData.get('billRate')) : null;
  const billType = formData.get('billType') ? String(formData.get('billType')).trim() : null;
  const otBillRate = formData.get('otBillRate') ? parseFloat(formData.get('otBillRate')) : null;
  const otBillType = formData.get('otBillType') ? String(formData.get('otBillType')).trim() : null;
  const billableFlag = formData.get('billableFlag')?.trim() || 'No';
  const startDt = formData.get('startDt') || null;
  const endDt = formData.get('endDt') || null;
  const clientId = formData.get('clientId')?.trim() || null;
  const payTerm = formData.get('payTerm') ? String(formData.get('payTerm')).trim() : null;
  const invoiceEmail = formData.get('invoiceEmail')?.trim() || null;
  const invoiceFax = formData.get('invoiceFax')?.trim() || null;
  const invoicePhone = formData.get('invoicePhone')?.trim() || null;
  const suborgid = formData.get('suborgid')?.trim() || null;
  const billTypes = JSON.parse(formData.get('billTypes') || '[]');
  const otBillTypes = JSON.parse(formData.get('otBillTypes') || '[]');
  const payTerms = JSON.parse(formData.get('payTerms') || '[]');

  console.log('Form data received:', {
    prjName,
    prsDesc,
    accntId,
    orgId: 'from JWT',
    billRate,
    billType,
    otBillRate,
    otBillType,
    billableFlag,
    startDt,
    endDt,
    clientId,
    payTerm,
    invoiceEmail,
    invoiceFax,
    invoicePhone,
    suborgid,
    billTypes,
    otBillTypes,
    payTerms,
  });

  const cookieStore = cookies();
  const token = cookieStore.get('jwt_token')?.value;

  if (!token) {
    console.log('Redirecting: No token found');
    return { error: 'No token found. Please log in.' };
  }

  const decoded = decodeJwt(token);
  if (!decoded || !decoded.orgid || !decoded.userId) {
    console.log('Redirecting: Invalid token or orgid/userId not found');
    return { error: 'Invalid token or orgid/userId not found.' };
  }

  const orgId = decoded.orgid;
  const userId = decoded.userId;

  if (!prjName || prjName.trim() === '') {
    console.log('Redirecting: Project name is required');
    return { error: 'Project name is required.' };
  }
  if (!accntId) {
    console.log('Redirecting: Account is required');
    return { error: 'Account is required.' };
  }
  if (!orgId) {
    console.log('Redirecting: Organization ID is required');
    return { error: 'Organization ID is required.' };
  }
  if (!clientId) {
    console.log('Redirecting: Client is required');
    return { error: 'Client is required.' };
  }

  if (billType && !billTypes.some(type => String(type.id) === billType)) {
    console.log('Redirecting: Invalid bill type', { billType, billTypes });
    return { error: 'Invalid bill type.' };
  }

  if (otBillType && !otBillTypes.some(type => String(type.id) === otBillType)) {
    console.log('Redirecting: Invalid OT bill type', { otBillType, otBillTypes });
    return { error: 'Invalid OT bill type.' };
  }

  if (payTerm && !payTerms.some(term => String(term.id) === payTerm)) {
    console.log('Redirecting: Invalid pay term', { payTerm, payTerms });
    return { error: 'Invalid pay term.' };
  }

  let pool;
  let retryCount = 0;
  const maxRetries = 2;

  while (retryCount <= maxRetries) {
    try {
      console.log(`Attempting to connect to MySQL (attempt ${retryCount + 1})...`);
      pool = await DBconnection();
      console.log('MySQL connection pool acquired');

      const [accountCheck] = await pool.execute(
        'SELECT ACCNT_ID, suborgid FROM C_ACCOUNT WHERE ACCNT_ID = ? AND ORGID = ? AND ACTIVE_FLAG = 1',
        [accntId, orgId]
      );
      if (accountCheck.length === 0) {
        console.log('Redirecting: Invalid or inactive account');
        return { error: 'Invalid or inactive account.' };
      }

      let effectiveSuborgid = suborgid;
      if (!suborgid && accountCheck[0].suborgid) {
        effectiveSuborgid = accountCheck[0].suborgid;
        console.log(`Using suborgid ${effectiveSuborgid} from account ${accntId}`);
      }

      const [clientCheck] = await pool.execute(
        'SELECT ACCNT_ID FROM C_ACCOUNT WHERE ACCNT_ID = ? AND ORGID = ? AND ACTIVE_FLAG = 1',
        [clientId, orgId]
      );
      if (clientCheck.length === 0) {
        console.log('Redirecting: Invalid or inactive client');
        return { error: 'Invalid or inactive client.' };
      }

      if (effectiveSuborgid) {
        const [suborgCheck] = await pool.execute(
          'SELECT suborgid FROM C_SUB_ORG WHERE suborgid = ? AND orgid = ? AND isstatus = 1',
          [effectiveSuborgid, orgId]
        );
        if (suborgCheck.length === 0) {
          console.log('Redirecting: Invalid suborganization');
          return { error: 'Invalid suborganization.' };
        }
      }

      const createdBy = await getCurrentUserEmpIdName(pool, userId, orgId);
      const [countResult] = await pool.query('SELECT COUNT(*) AS count FROM C_PROJECT WHERE ORG_ID = ?', [orgId]);
      const prjCount = countResult[0].count;
      const prjId = `${orgId}-${prjCount + 1}`;

      const insertColumns = [
        'PRJ_ID', 'PRJ_NAME', 'PRS_DESC', 'ACCNT_ID', 'ORG_ID', 'BILL_RATE', 'BILL_TYPE',
        'OT_BILL_RATE', 'OT_BILL_TYPE', 'BILLABLE_FLAG', 'START_DT', 'END_DT', 'CLIENT_ID',
        'PAY_TERM', 'INVOICE_EMAIL', 'INVOICE_FAX', 'INVOICE_PHONE', 'ROW_ID', 'Createdby', 'suborgid'
      ];

      const values = [
        prjId,
        prjName,
        prsDesc,
        accntId,
        parseInt(orgId, 10),
        billRate,
        billType,
        otBillRate,
        otBillType,
        billableFlag === 'Yes' ? 1 : 0,
        startDt,
        endDt,
        clientId,
        payTerm,
        invoiceEmail,
        invoiceFax,
        invoicePhone,
        null,
        createdBy,
        effectiveSuborgid
      ];

      // console.log('Inserting project with columns:', insertColumns);
      // console.log('Inserting project with values:', values);

      if (values.length !== insertColumns.length) {
        console.error('Mismatch: values length =', values.length, 'columns length =', insertColumns.length);
        return { error: 'Internal error: column count mismatch' };
      }

      const placeholders = values.map(() => '?').join(', ');
      const query = `INSERT INTO C_PROJECT (${insertColumns.join(', ')}) VALUES (${placeholders})`;

      // console.log('Executing query:', query);
      const [result] = await pool.query(query, values);
      // console.log(`Project added with PRJ_ID: ${prjId}, affected rows: ${result.affectedRows}`);

      return { success: true };
    } catch (error) {
      console.error('Error adding project:', error.message, error.stack);
      if (error.message.includes('Pool is closed') && retryCount < maxRetries) {
        console.log('Pool is closed, retrying connection...');
        retryCount++;
        continue;
      }
      return { error: `Failed to add project: ${error.message}` };
    }
  }

  return { error: 'Failed to add project after multiple retries: Pool is closed' };
}

export async function fetchAccountsByOrgId(orgId) {
  let connection;
  try {
    connection = await DBconnection();
    console.log('Fetching accounts for orgId:', orgId);
    const [rows] = await connection.execute(
      'SELECT a.ACCNT_ID, a.ALIAS_NAME, a.suborgid, s.suborgname FROM C_ACCOUNT a LEFT JOIN C_SUB_ORG s ON a.suborgid = s.suborgid AND a.ORGID = s.orgid WHERE a.ORGID = ? AND a.ACTIVE_FLAG = 1',
      [orgId]
    );
    console.log('Fetched accounts:', rows);
    return rows;
  } catch (error) {
    console.error('Error fetching accounts:', {
      message: error.message,
      code: error.code,
      sql: error.sql,
      sqlState: error.sqlState,
      sqlMessage: error.sqlMessage,
      orgId: orgId,
    });
    throw new Error('Failed to fetch accounts: ' + error.message);
  }
}
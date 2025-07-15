'use server';

import DBconnection from '@/app/utils/config/db';
import { cookies } from 'next/headers';

// Simple function to decode JWT without verification
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

// Helper function to get current user's empid-name
const getCurrentUserEmpIdName = async (pool, userId, orgId) => {
  try {
    // Fetch empid from C_USER using username (userId)
    const [userRows] = await pool.execute(
      'SELECT empid FROM C_USER WHERE username = ? AND orgid = ?',
      [userId, orgId]
    );
    if (userRows.length === 0) {
      console.error('User not found in C_USER for username:', userId);
      return 'system';
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
    const { EMP_FST_NAME, EMP_LAST_NAME,roleid } = empRows[0];
     const [rolerows] = await pool.execute(
      'SELECT rolename FROM org_role_table WHERE roleid= ? AND orgid = ?',
      [roleid, orgId]
    );
    const{rolename}=rolerows[0];
    return `${empid}-${EMP_FST_NAME} ${EMP_LAST_NAME} (${rolename})`;
  } catch (error) {
    console.error('Error fetching empid-name:', error.message);
    return 'system';
  }
};

export async function addProject(prevState, formData) {
  // Extract form data
  const prjName = formData.get('prjName')?.trim();
  const prsDesc = formData.get('prsDesc')?.trim() || null;
  const accntId = formData.get('accntId')?.trim();
  const billRate = formData.get('billRate') ? parseFloat(formData.get('billRate')) : null;
  const billType = formData.get('billType')?.trim() || null;
  const otBillRate = formData.get('otBillRate') ? parseFloat(formData.get('otBillRate')) : null;
  const otBillType = formData.get('otBillType')?.trim() || null;
  const billableFlag = formData.get('billableFlag')?.trim() || 'No';
  const startDt = formData.get('startDt') || null;
  const endDt = formData.get('endDt') || null;
  const clientId = formData.get('clientId')?.trim() || null;
  const payTerm = formData.get('payTerm')?.trim() || null;
  const invoiceEmail = formData.get('invoiceEmail')?.trim() || null;
  const invoiceFax = formData.get('invoiceFax')?.trim() || null;
  const invoicePhone = formData.get('invoicePhone')?.trim() || null;
  const billTypes = JSON.parse(formData.get('billTypes') || '[]');
  const otBillTypes = JSON.parse(formData.get('otBillTypes') || '[]');
  const payTerms = JSON.parse(formData.get('payTerms') || '[]');

  // Log form data for debugging
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
    billTypes,
    otBillTypes,
    payTerms,
  });

  // Get the JWT token from cookies
  const cookieStore = cookies();
  const token = cookieStore.get('jwt_token')?.value;

  if (!token) {
    console.log('Redirecting: No token found');
    return { error: 'No token found. Please log in.' };
  }

  // Decode the token to get the orgid and userId
  const decoded = decodeJwt(token);
  if (!decoded || !decoded.orgid || !decoded.userId) {
    console.log('Redirecting: Invalid token or orgid/userId not found');
    return { error: 'Invalid token or orgid/userId not found.' };
  }

  const orgId = decoded.orgid;
  const userId = decoded.userId;

  // Validation for required fields
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

  // Validate billType if provided
  if (billType && !billTypes.some(type => type.Name === billType)) {
    console.log('Redirecting: Invalid bill type');
    return { error: 'Invalid bill type.' };
  }

  // Validate otBillType if provided
  if (otBillType && !otBillTypes.some(type => type.Name === otBillType)) {
    console.log('Redirecting: Invalid OT bill type');
    return { error: 'Invalid OT bill type.' };
  }

  // Validate payTerm if provided
  if (payTerm && !payTerms.some(term => term.Name === payTerm)) {
    console.log('Redirecting: Invalid pay term');
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

      // Validate accntId
      const [accountCheck] = await pool.execute(
        'SELECT ACCNT_ID FROM C_ACCOUNT WHERE ACCNT_ID = ? AND ORGID = ? AND ACTIVE_FLAG = 1',
        [accntId, orgId]
      );
      if (accountCheck.length === 0) {
        console.log('Redirecting: Invalid or inactive account');
        return { error: 'Invalid or inactive account.' };
      }

      // Validate clientId
      const [clientCheck] = await pool.execute(
        'SELECT ACCNT_ID FROM C_ACCOUNT WHERE ACCNT_ID = ? AND ORGID = ? AND ACTIVE_FLAG = 1',
        [clientId, orgId]
      );
      if (clientCheck.length === 0) {
        console.log('Redirecting: Invalid or inactive client');
        return { error: 'Invalid or inactive client.' };
      }

      // Get current user's empid-name
      const createdBy = await getCurrentUserEmpIdName(pool, userId, orgId);
     // const updatedBy= await getCurrentUserEmpIdName(pool, userId, orgId);
      // Get the current number of records in C_PROJECT and add 1 for PRJ_ID
      const [countResult] = await pool.query('SELECT COUNT(*) AS count FROM C_PROJECT WHERE ORG_ID = ?', [orgId]);
      const prjCount = countResult[0].count;
      const prjId = `${orgId}-${prjCount + 1}`; // Generate PRJ_ID with orgId prefix

      // Define insert columns (all 18 columns from C_PROJECT schema)
      const insertColumns = [
        'PRJ_ID', 'PRJ_NAME', 'PRS_DESC', 'ACCNT_ID', 'ORG_ID', 'BILL_RATE', 'BILL_TYPE',
        'OT_BILL_RATE', 'OT_BILL_TYPE', 'BILLABLE_FLAG', 'START_DT', 'END_DT', 'CLIENT_ID',
        'PAY_TERM', 'INVOICE_EMAIL', 'INVOICE_FAX', 'INVOICE_PHONE', 'ROW_ID','Createdby'
      ];

      // Define values (matching all 18 columns)
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
        null, // ROW_ID (auto-incremented by database)
        createdBy,
      ];

      // Log column and value counts for debugging
      console.log('Inserting project with', values.length, 'values');
      console.log('Column count:', insertColumns.length);

      // Ensure column and value counts match
      if (values.length !== insertColumns.length) {
        console.error('Mismatch: values length =', values.length, 'columns length =', insertColumns.length);
        return { error: 'Internal error: column count mismatch' };
      }

      // Prepare query
      const placeholders = values.map(() => '?').join(', ');
      const query = `INSERT INTO C_PROJECT (${insertColumns.join(', ')}) VALUES (${placeholders})`;

      // Log query values for debugging
      console.log('Executing query with values:', values);

      // Execute query
      await pool.query(query, values);
      console.log(`Project added with PRJ_ID: ${prjId}`);

      return { success: true }; // Indicate success
    } catch (error) {
      console.error('Error adding project:', error.message);
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
      'SELECT ACCNT_ID, ALIAS_NAME FROM C_ACCOUNT WHERE ORGID = ? AND ACTIVE_FLAG = 1',
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
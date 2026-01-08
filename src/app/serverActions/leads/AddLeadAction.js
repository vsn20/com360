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
      'SELECT EMP_FST_NAME, EMP_LAST_NAME FROM C_EMP WHERE empid = ? AND orgid = ?',
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

export async function addLead(prevState, formData) {
  const leadName = formData.get('leadName')?.trim();
  const leadDesc = formData.get('leadDesc')?.trim() || null;
  const accntId = formData.get('accntId')?.trim();
  const cost = formData.get('cost') ? parseFloat(formData.get('cost')) : null;
  const billType = formData.get('billType') ? String(formData.get('billType')).trim() : null;
  const otCost = formData.get('otCost') ? parseFloat(formData.get('otCost')) : null;
  const otBillType = formData.get('otBillType') ? String(formData.get('otBillType')).trim() : null;
  const billableFlag = formData.get('billableFlag')?.trim() || 'No';
  const startDt = formData.get('startDt') || null;
  const endDt = formData.get('endDt') || null;
  const clientId = formData.get('clientId')?.trim() || null;
  const payTerm = formData.get('payTerm') ? String(formData.get('payTerm')).trim() : null;
  const suborgid = formData.get('suborgid')?.trim() || null;
  const industries = formData.get('industries') ? String(formData.get('industries')).trim() : null;
  const billTypes = JSON.parse(formData.get('billTypes') || '[]');
  const otBillTypes = JSON.parse(formData.get('otBillTypes') || '[]');
  const payTerms = JSON.parse(formData.get('payTerms') || '[]');

  console.log('Lead form data received:', {
    leadName,
    leadDesc,
    accntId,
    cost,
    billType,
    otCost,
    otBillType,
    billableFlag,
    startDt,
    endDt,
    clientId,
    payTerm,
    suborgid,
    industries,
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

  if (!leadName || leadName.trim() === '') {
    console.log('Redirecting: Lead name is required');
    return { error: 'Lead name is required.' };
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
      const [countResult] = await pool.query('SELECT COUNT(*) AS count FROM C_LEADS WHERE ORG_ID = ?', [orgId]);
      const leadCount = countResult[0].count;
      const leadId = `${orgId}-LEAD-${leadCount + 1}`;

      const insertColumns = [
        'LEAD_ID', 'LEAD_NAME', 'LEAD_DESC', 'ACCNT_ID', 'ORG_ID', 'COST', 'BILL_TYPE',
        'OT_COST', 'OT_BILL_TYPE', 'BILLABLE_FLAG', 'START_DT', 'END_DT', 'CLIENT_ID',
        'PAY_TERM', 'CREATED_BY', 'suborgid', 'Industries'
      ];

      const values = [
        leadId,
        leadName,
        leadDesc,
        accntId,
        parseInt(orgId, 10),
        cost,
        billType,
        otCost,
        otBillType,
        billableFlag === 'Yes' ? 1 : 0,
        startDt,
        endDt,
        clientId,
        payTerm,
        createdBy,
        effectiveSuborgid,
        industries
      ];

      const placeholders = values.map(() => '?').join(', ');
      const query = `INSERT INTO C_LEADS (${insertColumns.join(', ')}) VALUES (${placeholders})`;

      await pool.query(query, values);

      return { success: true };
    } catch (error) {
      console.error('Error adding lead:', error.message, error.stack);
      if (error.message.includes('Pool is closed') && retryCount < maxRetries) {
        console.log('Pool is closed, retrying connection...');
        retryCount++;
        continue;
      }
      return { error: `Failed to add lead: ${error.message}` };
    }
  }

  return { error: 'Failed to add lead after multiple retries: Pool is closed' };
}

export async function fetchAccountsByOrgId(orgId) {
  let connection;
  try {
    connection = await DBconnection();
    console.log('Fetching accounts for orgId:', orgId);
    const [rows] = await connection.execute(
      'SELECT a.ACCNT_ID, a.ALIAS_NAME, a.suborgid, a.ourorg, s.suborgname FROM C_ACCOUNT a LEFT JOIN C_SUB_ORG s ON a.suborgid = s.suborgid AND a.ORGID = s.orgid WHERE a.ORGID = ? AND a.ACTIVE_FLAG = 1',
      [orgId]
    );
    console.log('Fetched accounts:', rows);
    return rows;
  } catch (error) {
    console.error('Error fetching accounts:', error.message);
    throw new Error('Failed to fetch accounts: ' + error.message);
  }
}
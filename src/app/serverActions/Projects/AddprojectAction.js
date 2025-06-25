"use server";

import DBconnection from "@/app/utils/config/db";
import { cookies } from "next/headers";

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

export async function addProject(prevState, formData) {
  const prjName = formData.get('prjName');
  const prsDesc = formData.get('prsDesc') || null;
  const accntId = formData.get('accntId');
  const billRate = formData.get('billRate') || null;
  const billType = formData.get('billType') || null;
  const otBillRate = formData.get('otBillRate') || null;
  const otBillType = formData.get('otBillType') || null;
  const billableFlag = formData.get('billableFlag') || 'No';
  const startDt = formData.get('startDt') || null;
  const endDt = formData.get('endDt') || null;
  const clientId = formData.get('clientId') || null;
  const payTerm = formData.get('payTerm') || null;
  const invoiceEmail = formData.get('invoiceEmail') || null;
  const invoiceFax = formData.get('invoiceFax') || null;
  const invoicePhone = formData.get('invoicePhone') || null;

  // Get the JWT token from cookies
  const cookieStore = cookies();
  const token = cookieStore.get('jwt_token')?.value;

  if (!token) {
    console.log('Redirecting: No token found');
    return { error: 'No token found. Please log in.' };
  }

  // Decode the token to get the orgid
  const decoded = decodeJwt(token);
  if (!decoded || !decoded.orgid) {
    console.log('Redirecting: Invalid token or orgid not found');
    return { error: 'Invalid token or orgid not found.' };
  }

  const orgId = decoded.orgid;

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

  try {
    const pool = await DBconnection();

    // Get the current number of records in C_PROJECT and add 1 for PRJ_ID
    const [countResult] = await pool.query('SELECT COUNT(*) AS count FROM C_PROJECT');
    const prjCount = countResult[0].count;
    const prjId = `PRJ_${prjCount + 1}`; // Generate PRJ_ID with prefix

    // Insert into C_PROJECT table
    await pool.query(
      `INSERT INTO C_PROJECT (
        PRJ_ID, PRJ_NAME, PRS_DESC, ACCNT_ID, ORG_ID, BILL_RATE, BILL_TYPE,
        OT_BILL_RATE, OT_BILL_TYPE, BILLABLE_FLAG, START_DT, END_DT, CLIENT_ID,
        PAY_TERM, INVOICE_EMAIL, INVOICE_FAX, INVOICE_PHONE
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        prjId, prjName, prsDesc, accntId, parseInt(orgId, 10), billRate, billType,
        otBillRate, otBillType, billableFlag === 'Yes' ? 1 : 0, startDt, endDt, clientId,
        payTerm, invoiceEmail, invoiceFax, invoicePhone,
      ]
    );

    console.log(`Project added with PRJ_ID: ${prjId}`);
    return { success: true }; // Indicate success
  } catch (error) {
    console.error('Error adding project:', error);
    return { error: `Failed to add project: ${error.message}` };
  }
}

export async function fetchAccountsByOrgId(orgId) {
  let connection;
  try {
    connection = await DBconnection();
    console.log('Fetching accounts for orgId:', orgId); // Debug log
    const [rows] = await connection.execute(
      'SELECT ACCNT_ID, ALIAS_NAME FROM C_ACCOUNT WHERE ORGID = ? AND ACTIVE_FLAG = 1',
      [orgId]
    );
    console.log('Fetched accounts:', rows); // Debug log
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
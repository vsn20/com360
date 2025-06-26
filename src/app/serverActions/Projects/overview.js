"use server";

import DBconnection from "@/app/utils/config/db";
import { cookies } from "next/headers";

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

export async function fetchprojectsbyorgid() {
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

    console.log(`Fetching projects for orgId: ${orgId}`);
    const pool = await DBconnection();
    console.log("MySQL connected");
    const [rows] = await pool.execute(
      `SELECT PRJ_ID, PRJ_NAME, PRS_DESC, ACCNT_ID FROM C_PROJECT WHERE ORG_ID = ?`,
      [orgId]
    );
    console.log('Fetched projects:', rows);
    return rows;
  } catch (error) {
    console.error('Error fetching projects:', error.message);
    throw new Error(`Failed to fetch projects: ${error.message}`);
  }
}

export async function fetchprojectbyid(PRJ_ID) {
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
    if (!PRJ_ID) {
      console.log('Project ID is missing');
      throw new Error('Project ID is required');
    }
    console.log(`Fetching project details with project ID: ${PRJ_ID} for orgId: ${orgId}`);
    const pool = await DBconnection();
    console.log("MySQL connected");
    const [rows] = await pool.execute(
      `SELECT PRJ_ID, PRJ_NAME, PRS_DESC, ACCNT_ID, ORG_ID, BILL_RATE, BILL_TYPE, OT_BILL_RATE, OT_BILL_TYPE,
              BILLABLE_FLAG, START_DT, END_DT, CLIENT_ID, PAY_TERM, INVOICE_EMAIL, INVOICE_FAX, INVOICE_PHONE 
       FROM C_PROJECT WHERE PRJ_ID = ? AND ORG_ID = ?`,
      [PRJ_ID, orgId]
    );
    if (rows.length === 0) {
      console.log('Project not found');
      throw new Error('Project not found.');
    }
    console.log('Fetched Project:', rows[0]);
    return rows[0];
  } catch (error) {
    console.error('Error fetching project:', error.message);
    throw new Error(`Failed to fetch project: ${error.message}`);
  }
}

export async function fetchaccountsbyorgid() {
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
    const pool = await DBconnection();
    console.log("MySQL connection pool acquired");
    const [rows] = await pool.execute(
      `SELECT ACCNT_ID, ACCT_TYPE_CD, EMAIL, ALIAS_NAME FROM C_ACCOUNT WHERE ORGID = ?`,
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

export async function updateproject(prevState, formData) {
  try {
    const prjId = formData.get('prjId');
    const prjName = formData.get('prjName');
    const prsDesc = formData.get('prsDesc') || null;
    const accntId = formData.get('accntId');
    const billRate = formData.get('billRate') || null;
    const billType = formData.get('billType') || null;
    const otBillRate = formData.get('otBillRate') || null;
    const otBillType = formData.get('otBillType') || null;
    const billableFlag = formData.get('billableFlag') === 'Yes' ? 1 : 0;
    const startDt = formData.get('startDt') || null;
    const endDt = formData.get('endDt') || null;
    const clientId = formData.get('clientId') || null;
    const payTerm = formData.get('payTerm') || null;
    const invoiceEmail = formData.get('invoiceEmail') || null;
    const invoiceFax = formData.get('invoiceFax') || null;
    const invoicePhone = formData.get('invoicePhone') || null;

    console.log("Form data received:", {
      prjId, prjName, prsDesc, accntId, billRate, billType, otBillRate, otBillType,
      billableFlag, startDt, endDt, clientId, payTerm, invoiceEmail, invoiceFax, invoicePhone
    });

    const cookieStore = cookies();
    const token = cookieStore.get('jwt_token')?.value;

    if (!token) {
      console.log('No token found');
      return { error: 'No token found. Please log in.' };
    }

    const decoded = decodeJwt(token);
    if (!decoded || !decoded.orgid) {
      console.log('Invalid token or orgid not found');
      return { error: 'Invalid token or orgid not found.' };
    }

    const orgId = decoded.orgid;
    if (!orgId) {
      console.log('orgId is undefined or invalid');
      return { error: 'Organization ID is missing or invalid.' };
    }

    const pool = await DBconnection();
    console.log("MySQL connection pool acquired");

    const [existing] = await pool.execute(
      'SELECT PRJ_ID FROM C_PROJECT WHERE PRJ_ID = ? AND ORG_ID = ?',
      [prjId, orgId]
    );
    if (existing.length === 0) {
      console.log('Project not found');
      return { error: 'Project not found.' };
    }

    await pool.query(
      `UPDATE C_PROJECT SET
        PRJ_NAME = ?, PRS_DESC = ?, ACCNT_ID = ?, BILL_RATE = ?, BILL_TYPE = ?,
        OT_BILL_RATE = ?, OT_BILL_TYPE = ?, BILLABLE_FLAG = ?, START_DT = ?, END_DT = ?, CLIENT_ID = ?,
        PAY_TERM = ?, INVOICE_EMAIL = ?, INVOICE_FAX = ?, INVOICE_PHONE = ?
       WHERE PRJ_ID = ? AND ORG_ID = ?`,
      [
        prjName, prsDesc, accntId, billRate, billType,
        otBillRate, otBillType, billableFlag, startDt, endDt, clientId,
        payTerm, invoiceEmail, invoiceFax, invoicePhone,
        prjId, orgId
      ]
    );
    console.log(`Project updated: PRJ_ID ${prjId}`);
    return { success: true };
  } catch (error) {
    console.error('Error updating project:', error.message);
    return { error: `Failed to update project: ${error.message}` };
  }
}
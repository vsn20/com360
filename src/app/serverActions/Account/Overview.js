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

export async function fetchAccountByOrgId() {
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

export async function fetchAccountByAccntId(accntId) {
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

    console.log(`Fetching account with ACCNT_ID: ${accntId} for orgId: ${orgId}`);

    const pool = await DBconnection();
    console.log("MySQL connection pool acquired");

    const [rows] = await pool.execute(
      `SELECT * FROM C_ACCOUNT WHERE ACCNT_ID = ? AND ORGID = ?`,
      [accntId, orgId]
    );

    if (rows.length === 0) {
      console.log('No account found for ACCNT_ID:', accntId);
      throw new Error('No account found for the given account ID.');
    }

    console.log('Fetched account:', rows[0]);
    return rows[0];
  } catch (error) {
    console.error('Error fetching account:', error.message);
    throw new Error(`Failed to fetch account: ${error.message}`);
  }
}

export async function updateAccount(formData) {
  try {
    const accntId = formData.get('ACCNT_ID');
    const activeFlag = formData.get('ACTIVE_FLAG') === '1' ? 1 : 0;
    const acctTypeCd = formData.get('ACCT_TYPE_CD');
    const email = formData.get('EMAIL');
    const aliasName = formData.get('ALIAS_NAME');
    const businessAddrLine1 = formData.get('BUSINESS_ADDR_LINE1') || null;
    const businessAddrLine2 = formData.get('BUSINESS_ADDR_LINE2') || null;
    const businessAddrLine3 = formData.get('BUSINESS_ADDR_LINE3') || null;
    const businessCity = formData.get('BUSINESS_CITY') || null;
    const businessStateId = formData.get('BUSINESS_STATE_ID') || null;
    const businessCountryId = formData.get('BUSINESS_COUNTRY_ID') || null;
    const businessPostalCode = formData.get('BUSINESS_POSTAL_CODE') || null;
    const mailingAddrLine1 = formData.get('MAILING_ADDR_LINE1') || null;
    const mailingAddrLine2 = formData.get('MAILING_ADDR_LINE2') || null;
    const mailingAddrLine3 = formData.get('MAILING_ADDR_LINE3') || null;
    const mailingCity = formData.get('MAILING_CITY') || null;
    const mailingStateId = formData.get('MAILING_STATE_ID') || null;
    const mailingCountryId = formData.get('MAILING_COUNTRY_ID') || null;
    const mailingPostalCode = formData.get('MAILING_POSTAL_CODE') || null;
    const failAttemptsCnt = parseInt(formData.get('FAIL_ATTEMPTS_CNT')) || 0;
    const lastLoginDate = formData.get('LAST_LOGIN_DATE') || null;
    const createdBy = formData.get('CREATED_BY') || null;
    const lastUpdatedBy = formData.get('LAST_UPDATED_BY') || null;
    const orgId = parseInt(formData.get('ORGID'));
    const branchType = formData.get('BRANCH_TYPE') || null;

    console.log("Form data received:", {
      accntId, activeFlag, acctTypeCd, email, aliasName, businessAddrLine1,
      businessAddrLine2, businessAddrLine3, businessCity, businessStateId,
      businessCountryId, businessPostalCode, mailingAddrLine1, mailingAddrLine2,
      mailingAddrLine3, mailingCity, mailingStateId, mailingCountryId,
      mailingPostalCode, failAttemptsCnt, lastLoginDate, createdBy,
      lastUpdatedBy, orgId, branchType
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

    const currentOrgId = decoded.orgid;
    if (!currentOrgId || currentOrgId !== orgId) {
      console.log('OrgID mismatch or invalid');
      return { error: 'Organization ID mismatch or invalid.' };
    }

    const pool = await DBconnection();
    console.log("MySQL connection pool acquired");

    const [existing] = await pool.execute(
      'SELECT ROW_ID FROM C_ACCOUNT WHERE ACCNT_ID = ? AND ORGID = ?',
      [accntId, orgId]
    );
    if (existing.length === 0) {
      console.log('Account not found');
      return { error: 'Account not found.' };
    }

    await pool.query(
      `UPDATE C_ACCOUNT 
       SET ACTIVE_FLAG = ?, ACCT_TYPE_CD = ?, EMAIL = ?, ALIAS_NAME = ?, 
           BUSINESS_ADDR_LINE1 = ?, BUSINESS_ADDR_LINE2 = ?, BUSINESS_ADDR_LINE3 = ?, 
           BUSINESS_CITY = ?, BUSINESS_STATE_ID = ?, BUSINESS_COUNTRY_ID = ?, 
           BUSINESS_POSTAL_CODE = ?, MAILING_ADDR_LINE1 = ?, MAILING_ADDR_LINE2 = ?, 
           MAILING_ADDR_LINE3 = ?, MAILING_CITY = ?, MAILING_STATE_ID = ?, 
           MAILING_COUNTRY_ID = ?, MAILING_POSTAL_CODE = ?, FAIL_ATTEMPTS_CNT = ?, 
           LAST_LOGIN_DATE = ?, CREATED_BY = ?, LAST_UPDATED_BY = ?, BRANCH_TYPE = ?
       WHERE ACCNT_ID = ? AND ORGID = ?`,
      [
        activeFlag, acctTypeCd, email, aliasName, businessAddrLine1, businessAddrLine2,
        businessAddrLine3, businessCity, businessStateId, businessCountryId,
        businessPostalCode, mailingAddrLine1, mailingAddrLine2, mailingAddrLine3,
        mailingCity, mailingStateId, mailingCountryId, mailingPostalCode,
        failAttemptsCnt, lastLoginDate, createdBy, lastUpdatedBy, branchType,
        accntId, orgId
      ]
    );

    console.log(`Account updated: ACCNT_ID ${accntId}`);
    return { success: true };
  } catch (error) {
    console.error('Error updating account:', error.message);
    return { error: `Failed to update account: ${error.message}` };
  }
}
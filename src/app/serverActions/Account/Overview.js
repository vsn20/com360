'use server';

import DBconnection from '@/app/utils/config/db';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret';

const decodeJwt = (token) => {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    console.error('Error decoding JWT:', error.message);
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
    console.log('MySQL connection pool acquired');

    const [rows] = await pool.execute(
      `SELECT ACCNT_ID, ACCT_TYPE_CD, EMAIL, ALIAS_NAME, ourorg, MAILING_COUNTRY_ID, MAILING_STATE_ID, MAILING_ADDR_LINE3 FROM C_ACCOUNT WHERE ORGID = ?`,
      [orgId]
    );

    console.log('Fetched accounts:', rows);
    return rows;
  } catch (error) {
    console.error('Error fetching accounts:', error.message);
    throw new Error(`Failed to fetch accounts: ${error.message}`);
  }
}

export async function fetchAccountById(accntId) {
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

    if (!accntId) {
      console.log('accntId is missing');
      throw new Error('Account ID is required.');
    }

    console.log(`Fetching account with ACCNT_ID: ${accntId} for orgId: ${orgId}`);

    const pool = await DBconnection();
    console.log('MySQL connection pool acquired');

    const [rows] = await pool.execute(
      `SELECT ACCNT_ID, ORGID, ACTIVE_FLAG, ACCT_TYPE_CD, EMAIL, ALIAS_NAME, 
              BUSINESS_ADDR_LINE1, BUSINESS_ADDR_LINE2, BUSINESS_ADDR_LINE3, BUSINESS_CITY, 
              BUSINESS_STATE_ID, BUSINESS_COUNTRY_ID, BUSINESS_POSTAL_CODE,
              MAILING_ADDR_LINE1, MAILING_ADDR_LINE2, MAILING_ADDR_LINE3, MAILING_CITY,
              MAILING_STATE_ID, MAILING_COUNTRY_ID, MAILING_POSTAL_CODE,
              LAST_LOGIN_DATE, CREATED_BY, LAST_UPDATED_BY, BRANCH_TYPE, LAST_UPDATED_DATE, suborgid, ourorg
       FROM C_ACCOUNT 
       WHERE ACCNT_ID = ? AND ORGID = ?`,
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
    const orgId = formData.get('ORGID');
    const section = formData.get('section');

    console.log('updateAccount FormData:', {
      accntId,
      orgId,
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

    const jwtOrgId = decoded.orgid;
    if (!orgId || String(orgId) !== String(jwtOrgId)) {
      console.log(`Invalid or mismatched orgid. FormData orgid: ${orgId}, JWT orgid: ${jwtOrgId}`);
      return { error: 'Organization ID is missing or invalid.' };
    }

    if (!accntId) {
      console.log('accntId is missing');
      return { error: 'Account ID is required.' };
    }

    const pool = await DBconnection();
    console.log('MySQL connection pool acquired');

    const [existing] = await pool.execute(
      'SELECT ACCNT_ID FROM C_ACCOUNT WHERE ACCNT_ID = ? AND ORGID = ?',
      [accntId, orgId]
    );
    if (existing.length === 0) {
      console.log('Account not found');
      return { error: 'Account not found.' };
    }

    const lastUpdatedBy = await getCurrentUserEmpIdName(pool, decoded.userId, orgId);
    let affectedRows = 0;

    if (section === 'basic') {
      const activeFlag = formData.get('ACTIVE_FLAG') === '1' ? 1 : 0;
      const acctTypeCd = formData.get('ACCT_TYPE_CD');
      const email = formData.get('EMAIL');
      const aliasName = formData.get('ALIAS_NAME') || null;
      const branchType = formData.get('BRANCH_TYPE') || null;
      const suborgid = formData.get('suborgid') || null;
      const ourorg = formData.get('ourorg') === '1' ? 1 : 0;

      if (!acctTypeCd) return { error: 'Account Type is required.' };
      if (!email) return { error: 'Email is required.' };

      const [emailCheck] = await pool.execute(
        'SELECT ACCNT_ID FROM C_ACCOUNT WHERE EMAIL = ? AND ORGID = ? AND ACCNT_ID != ?',
        [email, orgId, accntId]
      );
      if (emailCheck.length > 0) return { error: 'Email is already in use by another account.' };

      if (acctTypeCd) {
        const [typeCheck] = await pool.execute(
          'SELECT id FROM C_GENERIC_VALUES WHERE g_id = 5 AND id = ? AND orgid = ? AND isactive = 1',
          [acctTypeCd, orgId]
        );
        if (typeCheck.length === 0) return { error: 'Selected account type is invalid or inactive.' };
      }

      if (branchType) {
        const [branchCheck] = await pool.execute(
          'SELECT id FROM C_GENERIC_VALUES WHERE g_id = 6 AND id = ? AND orgid = ? AND isactive = 1',
          [branchType, orgId]
        );
        if (branchCheck.length === 0) return { error: 'Selected branch type is invalid or inactive.' };
      }

      if (suborgid) {
        const [suborgCheck] = await pool.execute(
          'SELECT suborgid FROM C_SUB_ORG WHERE suborgid = ? AND orgid = ? AND isstatus = 1',
          [suborgid, orgId]
        );
        if (suborgCheck.length === 0) return { error: 'Selected suborganization is invalid or inactive.' };
      }

      const [result] = await pool.query(
        `UPDATE C_ACCOUNT 
         SET ACTIVE_FLAG = ?, ACCT_TYPE_CD = ?, EMAIL = ?, ALIAS_NAME = ?, 
             BRANCH_TYPE = ?, suborgid = ?, ourorg = ?, 
             LAST_UPDATED_BY = ?, LAST_UPDATED_DATE = CURRENT_TIMESTAMP
         WHERE ACCNT_ID = ? AND ORGID = ?`,
        [activeFlag, acctTypeCd, email, aliasName, branchType, suborgid, ourorg, lastUpdatedBy, accntId, orgId]
      );
      affectedRows += result.affectedRows;

    } else if (section === 'businessAddress') {
      const businessAddrLine1 = formData.get('BUSINESS_ADDR_LINE1') || null;
      const businessAddrLine2 = formData.get('BUSINESS_ADDR_LINE2') || null;
      const businessCity = formData.get('BUSINESS_CITY') || null;
      const businessCountryId = formData.get('BUSINESS_COUNTRY_ID') || null;
      const businessPostalCode = formData.get('BUSINESS_POSTAL_CODE') || null;
      
      let businessStateId = formData.get('BUSINESS_STATE_ID') || null;
      let businessAddrLine3 = formData.get('BUSINESS_ADDR_LINE3') || null;

      // Logic: If country is NOT USA (185), set state_id to NULL to avoid foreign key error
      if (String(businessCountryId) !== '185') {
        businessStateId = null; // FORCE NULL
        // AddrLine3 already has the custom value from formData
      } else {
        // If Country IS USA, set AddrLine3 to null (clean up custom text)
        businessAddrLine3 = null; 
      }

      if (businessCountryId) {
        const [countryCheck] = await pool.execute('SELECT ID FROM C_COUNTRY WHERE ID = ? AND ACTIVE = 1', [businessCountryId]);
        if (countryCheck.length === 0) return { error: 'Selected country is invalid or inactive.' };
      }

      // ONLY validate state ID if country is USA
      if (businessStateId && String(businessCountryId) === '185') {
        const [stateCheck] = await pool.execute('SELECT ID FROM C_STATE WHERE ID = ? AND ACTIVE = 1', [businessStateId]);
        if (stateCheck.length === 0) return { error: 'Selected state is invalid or inactive.' };
      }

      const [result] = await pool.query(
        `UPDATE C_ACCOUNT 
         SET BUSINESS_ADDR_LINE1 = ?, BUSINESS_ADDR_LINE2 = ?, BUSINESS_ADDR_LINE3 = ?, 
             BUSINESS_CITY = ?, BUSINESS_STATE_ID = ?, 
             BUSINESS_COUNTRY_ID = ?, BUSINESS_POSTAL_CODE = ?, 
             LAST_UPDATED_BY = ?, LAST_UPDATED_DATE = CURRENT_TIMESTAMP
         WHERE ACCNT_ID = ? AND ORGID = ?`,
        [
          businessAddrLine1, businessAddrLine2, businessAddrLine3, businessCity,
          businessStateId, businessCountryId, businessPostalCode,
          lastUpdatedBy, accntId, orgId
        ]
      );
      affectedRows += result.affectedRows;

    } else if (section === 'mailingAddress') {
      const mailingAddrLine1 = formData.get('MAILING_ADDR_LINE1') || null;
      const mailingAddrLine2 = formData.get('MAILING_ADDR_LINE2') || null;
      const mailingCity = formData.get('MAILING_CITY') || null;
      const mailingCountryId = formData.get('MAILING_COUNTRY_ID') || null;
      const mailingPostalCode = formData.get('MAILING_POSTAL_CODE') || null;

      let mailingStateId = formData.get('MAILING_STATE_ID') || null;
      let mailingAddrLine3 = formData.get('MAILING_ADDR_LINE3') || null;

      // Logic: If country is NOT USA (185), set state_id to NULL
      if (String(mailingCountryId) !== '185') {
        mailingStateId = null; // FORCE NULL
      } else {
        mailingAddrLine3 = null; // FORCE NULL
      }

      if (mailingCountryId) {
        const [countryCheck] = await pool.execute('SELECT ID FROM C_COUNTRY WHERE ID = ? AND ACTIVE = 1', [mailingCountryId]);
        if (countryCheck.length === 0) return { error: 'Selected country is invalid or inactive.' };
      }

      // ONLY validate state ID if country is USA
      if (mailingStateId && String(mailingCountryId) === '185') {
        const [stateCheck] = await pool.execute('SELECT ID FROM C_STATE WHERE ID = ? AND ACTIVE = 1', [mailingStateId]);
        if (stateCheck.length === 0) return { error: 'Selected state is invalid or inactive.' };
      }

      const [result] = await pool.query(
        `UPDATE C_ACCOUNT 
         SET MAILING_ADDR_LINE1 = ?, MAILING_ADDR_LINE2 = ?, MAILING_ADDR_LINE3 = ?, 
             MAILING_CITY = ?, MAILING_STATE_ID = ?, 
             MAILING_COUNTRY_ID = ?, MAILING_POSTAL_CODE = ?, 
             LAST_UPDATED_BY = ?, LAST_UPDATED_DATE = CURRENT_TIMESTAMP
         WHERE ACCNT_ID = ? AND ORGID = ?`,
        [
          mailingAddrLine1, mailingAddrLine2, mailingAddrLine3, mailingCity,
          mailingStateId, mailingCountryId, mailingPostalCode,
          lastUpdatedBy, accntId, orgId
        ]
      );
      affectedRows += result.affectedRows;

    } else {
      return { error: 'Invalid section specified.' };
    }

    if (affectedRows === 0) return { error: 'No changes were applied.' };
    return { success: true };
  } catch (error) {
    console.error('Error updating account:', error.message);
    return { error: `Failed to update account: ${error.message}` };
  }
}
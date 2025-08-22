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

// File: addAccount server action
export async function addAccount(formData) {
  try {
    const orgId = formData.get('orgid');
    const accountName = formData.get('accountName');
    const acctTypeCd = formData.get('acctTypeCd'); // Now expects id
    const branchType = formData.get('branchType'); // Now expects id
    const email = formData.get('email');
    const aliasName = formData.get('aliasName') || null;
    const businessAddrLine1 = formData.get('businessAddrLine1') || null;
    const businessAddrLine2 = formData.get('businessAddrLine2') || null;
    const businessAddrLine3 = formData.get('businessAddrLine3') || null;
    const businessCity = formData.get('businessCity') || null;
    const businessStateId = formData.get('businessStateId') || null;
    const businessCountryId = formData.get('businessCountryId') || null;
    const businessPostalCode = formData.get('businessPostalCode') || null;
    const mailingAddrLine1 = formData.get('mailingAddrLine1') || null;
    const mailingAddrLine2 = formData.get('mailingAddrLine2') || null;
    const mailingAddrLine3 = formData.get('mailingAddrLine3') || null;
    const mailingCity = formData.get('mailingCity') || null;
    const mailingStateId = formData.get('mailingStateId') || null;
    const mailingCountryId = formData.get('mailingCountryId') || null;
    const mailingPostalCode = formData.get('mailingPostalCode') || null;

    console.log('addAccount FormData:', {
      orgId, accountName, acctTypeCd, branchType, email, aliasName,
      businessAddrLine1, businessAddrLine2, businessAddrLine3, businessCity,
      businessStateId, businessCountryId, businessPostalCode,
      mailingAddrLine1, mailingAddrLine2, mailingAddrLine3, mailingCity,
      mailingStateId, mailingCountryId, mailingPostalCode
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

    if (!accountName) {
      console.log('Account Name is missing');
      return { error: 'Account Name is required.' };
    }
    if (!acctTypeCd) {
      console.log('Account Type is missing');
      return { error: 'Account Type is required.' };
    }
    if (!branchType) {
      console.log('Branch Type is missing');
      return { error: 'Branch Type is required.' };
    }
    if (!email) {
      console.log('Email is missing');
      return { error: 'Email is required.' };
    }

    const pool = await DBconnection();
    console.log('MySQL connection pool acquired');

    const [emailCheck] = await pool.execute(
      'SELECT ACCNT_ID FROM C_ACCOUNT WHERE EMAIL = ? AND ORGID = ?',
      [email, orgId]
    );
    if (emailCheck.length > 0) {
      console.log('Email already in use');
      return { error: 'Email is already in use by another account.' };
    }

    if (acctTypeCd) {
      const [typeCheck] = await pool.execute(
        'SELECT id FROM C_GENERIC_VALUES WHERE g_id = 5 AND id = ? AND orgid = ? AND isactive = 1',
        [acctTypeCd, orgId]
      );
      if (typeCheck.length === 0) {
        console.log('Invalid account type selected');
        return { error: 'Selected account type is invalid or inactive.' };
      }
    }

    if (branchType) {
      const [branchCheck] = await pool.execute(
        'SELECT id FROM C_GENERIC_VALUES WHERE g_id = 6 AND id = ? AND orgid = ? AND isactive = 1',
        [branchType, orgId]
      );
      if (branchCheck.length === 0) {
        console.log('Invalid branch type selected');
        return { error: 'Selected branch type is invalid or inactive.' };
      }
    }

    if (businessCountryId) {
      const [countryCheck] = await pool.execute(
        'SELECT ID FROM C_COUNTRY WHERE ID = ? AND ACTIVE = 1',
        [businessCountryId]
      );
      if (countryCheck.length === 0) {
        console.log('Invalid business country selected');
        return { error: 'Selected business country is invalid or inactive.' };
      }
    }

    if (businessStateId) {
      const [stateCheck] = await pool.execute(
        'SELECT ID FROM C_STATE WHERE ID = ? AND ACTIVE = 1',
        [businessStateId]
      );
      if (stateCheck.length === 0) {
        console.log('Invalid business state selected');
        return { error: 'Selected business state is invalid or inactive.' };
      }
    }

    if (mailingCountryId) {
      const [countryCheck] = await pool.execute(
        'SELECT ID FROM C_COUNTRY WHERE ID = ? AND ACTIVE = 1',
        [mailingCountryId]
      );
      if (countryCheck.length === 0) {
        console.log('Invalid mailing country selected');
        return { error: 'Selected mailing country is invalid or inactive.' };
      }
    }

    if (mailingStateId) {
      const [stateCheck] = await pool.execute(
        'SELECT ID FROM C_STATE WHERE ID = ? AND ACTIVE = 1',
        [mailingStateId]
      );
      if (stateCheck.length === 0) {
        console.log('Invalid mailing state selected');
        return { error: 'Selected mailing state is invalid or inactive.' };
      }
    }

    const [countrows]=await pool.execute(
      'select count(*) as count from C_ACCOUNT where ORGID=?',
      [orgId]
    );

    const counting=countrows[0].count;

    const accntId = `${orgId}-${counting+1}`;
    const createdBy = await getCurrentUserEmpIdName(pool, decoded.userId, orgId);

    const [result] = await pool.query(
      `INSERT INTO C_ACCOUNT (
        ACCNT_ID, ORGID, ACTIVE_FLAG, ACCT_TYPE_CD, EMAIL, ALIAS_NAME, 
        BUSINESS_ADDR_LINE1, BUSINESS_ADDR_LINE2, BUSINESS_ADDR_LINE3, BUSINESS_CITY, 
        BUSINESS_STATE_ID, BUSINESS_COUNTRY_ID, BUSINESS_POSTAL_CODE,
        MAILING_ADDR_LINE1, MAILING_ADDR_LINE2, MAILING_ADDR_LINE3, MAILING_CITY,
        MAILING_STATE_ID, MAILING_COUNTRY_ID, MAILING_POSTAL_CODE,
        CREATED_BY, LAST_UPDATED_BY, BRANCH_TYPE
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        accntId, orgId, 1, acctTypeCd, email, accountName,
        businessAddrLine1, businessAddrLine2, businessAddrLine3, businessCity,
        businessStateId, businessCountryId, businessPostalCode,
        mailingAddrLine1, mailingAddrLine2, mailingAddrLine3, mailingCity,
        mailingStateId, mailingCountryId, mailingPostalCode,
        createdBy, createdBy, branchType
      ]
    );

    console.log(`Account created: ACCNT_ID ${accntId}, affectedRows: ${result.affectedRows}`);
    return { success: true, accntId };
  } catch (error) {
    console.error('Error adding account:', error.message);
    return { error: `Failed to add account: ${error.message}` };
  }
}
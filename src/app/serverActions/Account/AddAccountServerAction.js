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

// File: addAccount server action
export async function addAccount(formData) {
  try {
    const orgId = formData.get('orgid');
    const accountName = formData.get('accountName');
    const acctTypeCd = formData.get('acctTypeCd');
    const branchType = formData.get('branchType');
    const email = formData.get('email');
    const aliasName = formData.get('aliasName') || null;
    const businessAddrLine1 = formData.get('businessAddrLine1') || null;
    const businessAddrLine2 = formData.get('businessAddrLine2') || null;
    const businessCity = formData.get('businessCity') || null;
    const businessCountryId = formData.get('businessCountryId') || null;
    const businessPostalCode = formData.get('businessPostalCode') || null;
    const mailingAddrLine1 = formData.get('mailingAddrLine1') || null;
    const mailingAddrLine2 = formData.get('mailingAddrLine2') || null;
    const mailingCity = formData.get('mailingCity') || null;
    const mailingCountryId = formData.get('mailingCountryId') || null;
    const mailingPostalCode = formData.get('mailingPostalCode') || null;
    const suborgid = formData.get('suborgid') || null;
    const ourorg = formData.get('ourorg') === '1' ? 1 : 0;
    
    // Contact fields
    const phone = formData.get('phone') || null;
    const mobile = formData.get('mobile') || null;
    const website = formData.get('website') || null;
    const ein = formData.get('ein') || null;
    const dunsNumber = formData.get('dunsNumber') || null;
    const linkedin = formData.get('linkedin') || null;
    const youtube = formData.get('youtube') || null;
    const facebook = formData.get('facebook') || null;
    const twitter = formData.get('twitter') || null;
    const instagram = formData.get('instagram') || null;
    const companySize = formData.get('companySize') || null;
    const loyaltyStatus = formData.get('loyaltyStatus') || null;
    
    // Original values from form
    let businessStateId = formData.get('businessStateId') || null;
    let businessAddrLine3 = formData.get('businessAddrLine3') || null; // Custom State text comes here
    let mailingStateId = formData.get('mailingStateId') || null;
    let mailingAddrLine3 = formData.get('mailingAddrLine3') || null; // Custom State text comes here

    const cookieStore = cookies();
    const token = cookieStore.get('jwt_token')?.value;

    if (!token) return { error: 'No token found. Please log in.' };
    const decoded = decodeJwt(token);
    if (!decoded || !decoded.orgid || !decoded.userId) return { error: 'Invalid token or orgid/userId not found.' };

    const jwtOrgId = decoded.orgid;
    if (!orgId || String(orgId) !== String(jwtOrgId)) return { error: 'Organization ID is missing or invalid.' };
    if (!accountName) return { error: 'Account Name is required.' };
    if (!acctTypeCd) return { error: 'Account Type is required.' };
    if (!branchType) return { error: 'Branch Type is required.' };
    if (!email) return { error: 'Email is required.' };

    const pool = await DBconnection();
    console.log('MySQL connection pool acquired');

    // Email Check
    const [emailCheck] = await pool.execute('SELECT ACCNT_ID FROM C_ACCOUNT WHERE EMAIL = ? AND ORGID = ?', [email, orgId]);
    if (emailCheck.length > 0) return { error: 'Email is already in use by another account.' };

    // Validation Checks
    if (acctTypeCd) {
      const [typeCheck] = await pool.execute('SELECT id FROM C_GENERIC_VALUES WHERE g_id = 5 AND id = ? AND orgid = ? AND isactive = 1', [acctTypeCd, orgId]);
      if (typeCheck.length === 0) return { error: 'Selected account type is invalid or inactive.' };
    }

    if (branchType) {
      const [branchCheck] = await pool.execute('SELECT id FROM C_GENERIC_VALUES WHERE g_id = 6 AND id = ? AND orgid = ? AND isactive = 1', [branchType, orgId]);
      if (branchCheck.length === 0) return { error: 'Selected branch type is invalid or inactive.' };
    }

    if (suborgid) {
      const [suborgCheck] = await pool.execute('SELECT suborgid FROM C_SUB_ORG WHERE suborgid = ? AND orgid = ? AND isstatus = 1', [suborgid, orgId]);
      if (suborgCheck.length === 0) return { error: 'Selected suborganization is invalid or inactive.' };
    }

    // Business Address Logic
    if (businessCountryId) {
      const [countryCheck] = await pool.execute('SELECT ID FROM C_COUNTRY WHERE ID = ? AND ACTIVE = 1', [businessCountryId]);
      if (countryCheck.length === 0) return { error: 'Selected business country is invalid or inactive.' };
    }

    if (String(businessCountryId) !== '185') {
       // If NOT USA, set state_id to NULL to avoid Foreign Key error
       businessStateId = null; 
       // Custom state text is already in businessAddrLine3
    } else {
       // If USA, ensure AddrLine3 is null
       businessAddrLine3 = null; 
       // Verify State ID exists
       if (businessStateId) {
         const [stateCheck] = await pool.execute('SELECT ID FROM C_STATE WHERE ID = ? AND ACTIVE = 1', [businessStateId]);
         if (stateCheck.length === 0) return { error: 'Selected business state is invalid or inactive.' };
       }
    }

    // Mailing Address Logic
    if (mailingCountryId) {
      const [countryCheck] = await pool.execute('SELECT ID FROM C_COUNTRY WHERE ID = ? AND ACTIVE = 1', [mailingCountryId]);
      if (countryCheck.length === 0) return { error: 'Selected mailing country is invalid or inactive.' };
    }

    if (String(mailingCountryId) !== '185') {
       // If NOT USA, set state_id to NULL
       mailingStateId = null;
    } else {
       // If USA, ensure AddrLine3 is null
       mailingAddrLine3 = null;
       // Verify State ID
       if (mailingStateId) {
         const [stateCheck] = await pool.execute('SELECT ID FROM C_STATE WHERE ID = ? AND ACTIVE = 1', [mailingStateId]);
         if (stateCheck.length === 0) return { error: 'Selected mailing state is invalid or inactive.' };
       }
    }

    const [countrows] = await pool.execute('SELECT count(*) as count FROM C_ACCOUNT WHERE ORGID = ?', [orgId]);
    const counting = countrows[0].count;
    const accntId = `${orgId}-${counting + 1}`;
    const createdBy = await getCurrentUserEmpIdName(pool, decoded.userId, orgId);

    const [result] = await pool.query(
      `INSERT INTO C_ACCOUNT (
        ACCNT_ID, ORGID, ACTIVE_FLAG, ACCT_TYPE_CD, EMAIL, ALIAS_NAME, 
        BUSINESS_ADDR_LINE1, BUSINESS_ADDR_LINE2, BUSINESS_ADDR_LINE3, BUSINESS_CITY, 
        BUSINESS_STATE_ID, BUSINESS_COUNTRY_ID, BUSINESS_POSTAL_CODE,
        MAILING_ADDR_LINE1, MAILING_ADDR_LINE2, MAILING_ADDR_LINE3, MAILING_CITY,
        MAILING_STATE_ID, MAILING_COUNTRY_ID, MAILING_POSTAL_CODE,
        CREATED_BY, LAST_UPDATED_BY, BRANCH_TYPE, suborgid, ourorg,
        PHONE, MOBILE, WEBSITE, EIN, DUNS_NUMBER, LINKEDIN, YOUTUBE, FACEBOOK, TWITTER, INSTAGRAM,
        COMPANY_SIZE, LOYALTY_STATUS
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        accntId, orgId, 1, acctTypeCd, email, accountName,
        businessAddrLine1, businessAddrLine2, businessAddrLine3, businessCity,
        businessStateId, businessCountryId, businessPostalCode,
        mailingAddrLine1, mailingAddrLine2, mailingAddrLine3, mailingCity,
        mailingStateId, mailingCountryId, mailingPostalCode,
        createdBy, createdBy, branchType, suborgid, ourorg,
        phone, mobile, website, ein, dunsNumber, linkedin, youtube, facebook, twitter, instagram,
        companySize, loyaltyStatus
      ]
    );

    console.log(`Account created: ACCNT_ID ${accntId}, affectedRows: ${result.affectedRows}`);
    return { success: true, accntId };
  } catch (error) {
    console.error('Error adding account:', error.message);
    return { error: `Failed to add account: ${error.message}` };
  }
}
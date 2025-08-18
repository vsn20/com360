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
      `SELECT ACCNT_ID, ACCT_TYPE_CD, EMAIL, ALIAS_NAME FROM C_ACCOUNT WHERE ORGID = ?`,
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
              LAST_LOGIN_DATE, CREATED_BY, LAST_UPDATED_BY, BRANCH_TYPE, LAST_UPDATED_DATE
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

      console.log('Basic details:', {
        activeFlag, acctTypeCd, email, aliasName, branchType, lastUpdatedBy
      });

      if (!acctTypeCd) {
        console.log('Account Type is missing');
        return { error: 'Account Type is required.' };
      }
      if (!email) {
        console.log('Email is missing');
        return { error: 'Email is required.' };
      }

      const [emailCheck] = await pool.execute(
        'SELECT ACCNT_ID FROM C_ACCOUNT WHERE EMAIL = ? AND ORGID = ? AND ACCNT_ID != ?',
        [email, orgId, accntId]
      );
      if (emailCheck.length > 0) {
        console.log('Email already in use');
        return { error: 'Email is already in use by another account.' };
      }

      if (acctTypeCd) {
        const [typeCheck] = await pool.execute(
          'SELECT id FROM C_GENERIC_VALUES WHERE g_id = 5 AND Name = ? AND orgid = ? AND isactive = 1',
          [acctTypeCd, orgId]
        );
        if (typeCheck.length === 0) {
          console.log('Invalid account type selected');
          return { error: 'Selected account type is invalid or inactive.' };
        }
      }

      if (branchType) {
        const [branchCheck] = await pool.execute(
          'SELECT id FROM C_GENERIC_VALUES WHERE g_id = 6 AND Name = ? AND orgid = ? AND isactive = 1',
          [branchType, orgId]
        );
        if (branchCheck.length === 0) {
          console.log('Invalid branch type selected');
          return { error: 'Selected branch type is invalid or inactive.' };
        }
      }

      const [result] = await pool.query(
        `UPDATE C_ACCOUNT 
         SET ACTIVE_FLAG = ?, ACCT_TYPE_CD = ?, EMAIL = ?, ALIAS_NAME = ?, 
             BRANCH_TYPE = ?, LAST_UPDATED_BY = ?, LAST_UPDATED_DATE = CURRENT_TIMESTAMP
         WHERE ACCNT_ID = ? AND ORGID = ?`,
        [
          activeFlag, acctTypeCd, email, aliasName, branchType,
          lastUpdatedBy, accntId, orgId
        ]
      );

      affectedRows += result.affectedRows;
      console.log(`Basic details update result: ${result.affectedRows} rows affected for ACCNT_ID ${accntId}`);
    } else if (section === 'businessAddress') {
      const businessAddrLine1 = formData.get('BUSINESS_ADDR_LINE1') || null;
      const businessAddrLine2 = formData.get('BUSINESS_ADDR_LINE2') || null;
      const businessAddrLine3 = formData.get('BUSINESS_ADDR_LINE3') || null;
      const businessCity = formData.get('BUSINESS_CITY') || null;
      const businessStateId = formData.get('BUSINESS_STATE_ID') || null;
      const businessCountryId = formData.get('BUSINESS_COUNTRY_ID') || null;
      const businessPostalCode = formData.get('BUSINESS_POSTAL_CODE') || null;

      console.log('Business address details:', {
        businessAddrLine1, businessAddrLine2, businessAddrLine3, businessCity,
        businessStateId, businessCountryId, businessPostalCode, lastUpdatedBy
      });

      if (businessCountryId) {
        const [countryCheck] = await pool.execute(
          'SELECT ID FROM C_COUNTRY WHERE ID = ? AND ACTIVE = 1',
          [businessCountryId]
        );
        if (countryCheck.length === 0) {
          console.log('Invalid country selected');
          return { error: 'Selected country is invalid or inactive.' };
        }
      }

      if (businessStateId) {
        const [stateCheck] = await pool.execute(
          'SELECT ID FROM C_STATE WHERE ID = ? AND ACTIVE = 1',
          [businessStateId]
        );
        if (stateCheck.length === 0) {
          console.log('Invalid state selected');
          return { error: 'Selected state is invalid or inactive.' };
        }
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
      console.log(`Business address update result: ${result.affectedRows} rows affected for ACCNT_ID ${accntId}`);
    } else if (section === 'mailingAddress') {
      const mailingAddrLine1 = formData.get('MAILING_ADDR_LINE1') || null;
      const mailingAddrLine2 = formData.get('MAILING_ADDR_LINE2') || null;
      const mailingAddrLine3 = formData.get('MAILING_ADDR_LINE3') || null;
      const mailingCity = formData.get('MAILING_CITY') || null;
      const mailingStateId = formData.get('MAILING_STATE_ID') || null;
      const mailingCountryId = formData.get('MAILING_COUNTRY_ID') || null;
      const mailingPostalCode = formData.get('MAILING_POSTAL_CODE') || null;

      console.log('Mailing address details:', {
        mailingAddrLine1, mailingAddrLine2, mailingAddrLine3, mailingCity,
        mailingStateId, mailingCountryId, mailingPostalCode, lastUpdatedBy
      });

      if (mailingCountryId) {
        const [countryCheck] = await pool.execute(
          'SELECT ID FROM C_COUNTRY WHERE ID = ? AND ACTIVE = 1',
          [mailingCountryId]
        );
        if (countryCheck.length === 0) {
          console.log('Invalid country selected');
          return { error: 'Selected country is invalid or inactive.' };
        }
      }

      if (mailingStateId) {
        const [stateCheck] = await pool.execute(
          'SELECT ID FROM C_STATE WHERE ID = ? AND ACTIVE = 1',
          [mailingStateId]
        );
        if (stateCheck.length === 0) {
          console.log('Invalid state selected');
          return { error: 'Selected state is invalid or inactive.' };
        }
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
      console.log(`Mailing address update result: ${result.affectedRows} rows affected for ACCNT_ID ${accntId}`);
    } else {
      console.log('Invalid section:', section);
      return { error: 'Invalid section specified.' };
    }

    if (affectedRows === 0) {
      console.log('No rows updated for ACCNT_ID:', accntId);
      return { error: 'No changes were applied.' };
    }

    console.log(`Account updated: ACCNT_ID ${accntId}, section ${section}, affectedRows: ${affectedRows}`);
    return { success: true };
  } catch (error) {
    console.error('Error updating account:', error.message);
    return { error: `Failed to update account: ${error.message}` };
  }
}

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
        'SELECT id FROM C_GENERIC_VALUES WHERE g_id = 5 AND Name = ? AND orgid = ? AND isactive = 1',
        [acctTypeCd, orgId]
      );
      if (typeCheck.length === 0) {
        console.log('Invalid account type selected');
        return { error: 'Selected account type is invalid or inactive.' };
      }
    }

    if (branchType) {
      const [branchCheck] = await pool.execute(
        'SELECT id FROM C_GENERIC_VALUES WHERE g_id = 6 AND Name = ? AND orgid = ? AND isactive = 1',
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

    const accntId = `ACC${Date.now()}${Math.floor(Math.random() * 1000)}`;
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
        accntId, orgId, 1, acctTypeCd, email, aliasName,
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
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

export async function addAccount(formData) {
  // Extract form data
  const accountName = formData.get("accountName")?.trim();
  const acctTypeCd = formData.get("acctTypeCd")?.trim();
  const branchType = formData.get("branchType")?.trim();
  const email = formData.get("email")?.trim();
  const aliasName = formData.get("aliasName")?.trim() || null;
  const businessAddrLine1 = formData.get("businessAddrLine1")?.trim() || null;
  const businessAddrLine2 = formData.get("businessAddrLine2")?.trim() || null;
  const businessAddrLine3 = formData.get("businessAddrLine3")?.trim() || null;
  const businessCity = formData.get("businessCity")?.trim() || null;
  const businessStateId = formData.get("businessStateId") ? parseInt(formData.get("businessStateId"), 10) : null;
  const businessCountryId = formData.get("businessCountryId") ? parseInt(formData.get("businessCountryId"), 10) : null;
  const businessPostalCode = formData.get("businessPostalCode")?.trim() || null;
  const mailingAddrLine1 = formData.get("mailingAddrLine1")?.trim() || null;
  const mailingAddrLine2 = formData.get("mailingAddrLine2")?.trim() || null;
  const mailingAddrLine3 = formData.get("mailingAddrLine3")?.trim() || null;
  const mailingCity = formData.get("mailingCity")?.trim() || null;
  const mailingStateId = formData.get("mailingStateId") ? parseInt(formData.get("mailingStateId"), 10) : null;
  const mailingCountryId = formData.get("mailingCountryId") ? parseInt(formData.get("mailingCountryId"), 10) : null;
  const mailingPostalCode = formData.get("mailingPostalCode")?.trim() || null;

  // Log form data for debugging
  console.log("Form data received:", {
    accountName,
    acctTypeCd,
    branchType,
    email,
    aliasName,
    orgId: "from JWT",
    businessAddrLine1,
    businessAddrLine2,
    businessAddrLine3,
    businessCity,
    businessStateId,
    businessCountryId,
    businessPostalCode,
    mailingAddrLine1,
    mailingAddrLine2,
    mailingAddrLine3,
    mailingCity,
    mailingStateId,
    mailingCountryId,
    mailingPostalCode,
  });

  // Get JWT token from cookies
  const cookieStore = cookies();
  const token = cookieStore.get("jwt_token")?.value;

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
  if (!accountName) {
    console.log('Redirecting: Account name is required');
    return { error: 'Account name is required.' };
  }
  if (!acctTypeCd) {
    console.log('Redirecting: Account type is required');
    return { error: 'Account type is required.' };
  }
  if (!branchType) {
    console.log('Redirecting: Branch type is required');
    return { error: 'Branch type is required.' };
  }
  if (!email) {
    console.log('Redirecting: Email is required');
    return { error: 'Email is required.' };
  }

  let pool;
  let retryCount = 0;
  const maxRetries = 2;
  let redirectPath = `/userscreens/account/overview`;

  while (retryCount <= maxRetries) {
    try {
      console.log(`Attempting to connect to MySQL (attempt ${retryCount + 1})...`);
      pool = await DBconnection();
      console.log("MySQL connection pool acquired");

      // Check if email already exists
      const [existingEmail] = await pool.query(
        "SELECT ACCNT_ID FROM C_ACCOUNT WHERE EMAIL = ? AND ORGID = ?",
        [email, orgId]
      );
      if (existingEmail.length > 0) {
        console.log('Redirecting: Email already exists');
        return { error: 'Email already exists.' };
      }

      // Validate account type
      const [validAcctType] = await pool.query(
        'SELECT id FROM generic_values WHERE g_id = ? AND Name = ? AND orgid = ? AND isactive = 1',
        [5, acctTypeCd, orgId]
      );
      if (validAcctType.length === 0) {
        console.log('Redirecting: Invalid account type');
        return { error: 'Invalid account type.' };
      }

      // Validate branch type
      const [validBranchType] = await pool.query(
        'SELECT id FROM generic_values WHERE g_id = ? AND Name = ? AND orgid = ? AND isactive = 1',
        [6, branchType, orgId]
      );
      if (validBranchType.length === 0) {
        console.log('Redirecting: Invalid branch type');
        return { error: 'Invalid branch type.' };
      }

      // Generate ACCNT_ID
      const [countResult] = await pool.query(
        "SELECT COUNT(*) AS count FROM C_ACCOUNT WHERE ORGID = ?",
        [orgId]
      );
      const accCount = countResult[0].count;
      const accntId = `${orgId}-${accCount + 1}`;
      console.log("Generated ACCNT_ID:", accntId);

      // Get current user's empid-name
      const createdBy = await getCurrentUserEmpIdName(pool, userId, orgId);

      // Define insert columns (all 28 columns from C_ACCOUNT schema)
      const insertColumns = [
        'ACCNT_ID', 'ACTIVE_FLAG', 'ACCT_TYPE_CD', 'BRANCH_TYPE', 'EMAIL', 'ALIAS_NAME', 'ORGID',
        'BUSINESS_ADDR_LINE1', 'BUSINESS_ADDR_LINE2', 'BUSINESS_ADDR_LINE3', 'BUSINESS_CITY',
        'BUSINESS_STATE_ID', 'BUSINESS_COUNTRY_ID', 'BUSINESS_POSTAL_CODE',
        'MAILING_ADDR_LINE1', 'MAILING_ADDR_LINE2', 'MAILING_ADDR_LINE3', 'MAILING_CITY',
        'MAILING_STATE_ID', 'MAILING_COUNTRY_ID', 'MAILING_POSTAL_CODE',
        'FAIL_ATTEMPTS_CNT', 'LAST_LOGIN_DATE', 'CREATED_BY', 
        'CREATED_DATE', 'ROW_ID'
      ];

      // Define values (matching all 28 columns)
      const values = [
        accntId,
        1, // ACTIVE_FLAG set to 1 by default
        acctTypeCd,
        branchType,
        email,
        aliasName,
        parseInt(orgId, 10),
        businessAddrLine1,
        businessAddrLine2,
        businessAddrLine3,
        businessCity,
        businessStateId,
        businessCountryId,
        businessPostalCode,
        mailingAddrLine1,
        mailingAddrLine2,
        mailingAddrLine3,
        mailingCity,
        mailingStateId,
        mailingCountryId,
        mailingPostalCode,
        0, // FAIL_ATTEMPTS_CNT
        null, // LAST_LOGIN_DATE
        createdBy, // CREATED_BY set to empid-name
        // createdBy, // LAST_UPDATED_BY set to null
        new Date(), // CREATED_DATE
        // new Date(), // LAST_UPDATED_DATE
        null // ROW_ID (auto-incremented by database)
      ];

      // Log column and value counts for debugging
      console.log("Inserting account with", values.length, "values");
      console.log("Column count:", insertColumns.length);

      // Ensure column and value counts match
      if (values.length !== insertColumns.length) {
        console.error("Mismatch: values length =", values.length, "columns length =", insertColumns.length);
        return { error: 'Internal error: column count mismatch' };
      }

      // Prepare query
      const placeholders = values.map(() => '?').join(', ');
      const query = `INSERT INTO C_ACCOUNT (${insertColumns.join(', ')}) VALUES (${placeholders})`;

      // Log query values for debugging
      console.log("Executing query with values:", values);

      // Execute query
      await pool.query(query, values);
      console.log(`Account added with ACCNT_ID: ${accntId}`);

      return { success: true };
    } catch (error) {
      console.error("Error adding account:", error.message);
      if (error.message.includes("Pool is closed") && retryCount < maxRetries) {
        console.log("Pool is closed, retrying connection...");
        retryCount++;
        continue;
      }
      redirectPath = `/userscreens/account/addaccount?error=Failed%20to%20add%20account:%20${encodeURIComponent(error.message)}`;
      return { error: `Failed to add account: ${error.message}` };
    }
  }

  redirectPath = `/userscreens/account/addaccount?error=Failed%20to%20add%20account%20after%20multiple%20retries:%20Pool%20is%20closed`;
  return { error: "Failed to add account after multiple retries: Pool is closed" };
}
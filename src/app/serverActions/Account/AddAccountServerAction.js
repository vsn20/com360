"use server";

import DBconnection from "@/app/utils/config/db";
import { redirect } from "next/navigation";
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

export async function addAccount(formData) {
  // Extract form data
  const accountName = formData.get("accountName");
  const activeFlag = formData.get("activeFlag") === "true";
  const acctTypeCd = formData.get("acctTypeCd");
  const branchType = formData.get("branchType");
  const email = formData.get("email");
  const aliasName = formData.get("aliasName") || null;
 
  const businessAddrLine1 = formData.get("businessAddrLine1") || null;
  const businessAddrLine2 = formData.get("businessAddrLine2") || null;
  const businessAddrLine3 = formData.get("businessAddrLine3") || null;
  const businessCity = formData.get("businessCity") || null;
  const businessStateId = formData.get("businessStateId") || null;
  const businessCountryId = formData.get("businessCountryId") ? parseInt(formData.get("businessCountryId"), 10) : null;
  const businessPostalCode = formData.get("businessPostalCode") || null;
  const mailingAddrLine1 = formData.get("mailingAddrLine1") || null;
  const mailingAddrLine2 = formData.get("mailingAddrLine2") || null;
  const mailingAddrLine3 = formData.get("mailingAddrLine3") || null;
  const mailingCity = formData.get("mailingCity") || null;
  const mailingStateId = formData.get("mailingStateId") || null;
  const mailingCountryId = formData.get("mailingCountryId") ? parseInt(formData.get("mailingCountryId"), 10) : null;
  const mailingPostalCode = formData.get("mailingPostalCode") || null;

  // Log form data for debugging
  console.log("Form data received:", {
    accountName,
    activeFlag,
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

  // Decode the token to get the orgid
  const decoded = decodeJwt(token);
  if (!decoded || !decoded.orgid) {
    console.log('Redirecting: Invalid token or orgid not found');
    return { error: 'Invalid token or orgid not found.' };
  }

  const orgId = decoded.orgid;

  // Validation for required fields
  if (!accountName || accountName.trim() === "") {
    console.log('Redirecting: Account name is required');
    return { error: 'Account name is required.' };
  }
  if (!acctTypeCd || !["CHECKING", "SAVING", "CREDIT"].includes(acctTypeCd)) {
    console.log('Redirecting: Invalid account type');
    return { error: 'Valid account type is required (Checking, Saving, Credit).' };
  }
  if (!branchType || !["SUB", "MAIN"].includes(branchType)) {
    console.log('Redirecting: Invalid branch type');
    return { error: 'Valid branch type is required (Sub, Main).' };
  }
  if (!email || email.trim() === "") {
    console.log('Redirecting: Email is required');
    return { error: 'Email is required.' };
  }
  let pool;
  let retryCount = 0;
  const maxRetries = 2;
  let redirectPath = `/userscreens/account/addaccount`;

  while (retryCount <= maxRetries) {
    try {
      console.log(`Attempting to connect to MySQL (attempt ${retryCount + 1})...`);
      pool = await DBconnection();
      console.log("MySQL connection pool acquired");

      // Check if email already exists
      const [existingEmail] = await pool.query("SELECT ACCNT_ID FROM C_ACCOUNT WHERE EMAIL = ?", [email]);
      if (existingEmail.length > 0) {
        console.log('Redirecting: Email already exists');
        return { error: 'Email already exists.' };
      }

      // Generate accntId
      const [countResult] = await pool.query("SELECT COUNT(*) AS count FROM C_ACCOUNT");
      const accCount = countResult[0].count;
      const accntId = `${accountName}_${accCount + 1}`;
      console.log("Generated ACCNT_ID:", accntId);

      // Prepare query and values
      const query = `
        INSERT INTO C_ACCOUNT (
          ACCNT_ID, ACTIVE_FLAG, ACCT_TYPE_CD, BRANCH_TYPE, EMAIL, ALIAS_NAME, ORGID,
          BUSINESS_ADDR_LINE1, BUSINESS_ADDR_LINE2, BUSINESS_ADDR_LINE3, BUSINESS_CITY,
          BUSINESS_STATE_ID, BUSINESS_COUNTRY_ID, BUSINESS_POSTAL_CODE,
          MAILING_ADDR_LINE1, MAILING_ADDR_LINE2, MAILING_ADDR_LINE3, MAILING_CITY,
          MAILING_STATE_ID, MAILING_COUNTRY_ID, MAILING_POSTAL_CODE,
          CREATED_BY, LAST_UPDATED_BY
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      const values = [
        accntId,
        activeFlag ? 1 : 0,
        acctTypeCd,
        branchType,
        email,
        aliasName,

        parseInt(orgId, 10),
        businessAddrLine1,
        businessAddrLine2,
        businessAddrLine3,
        businessCity,
        businessStateId ? parseInt(businessStateId, 10) : null,
        businessCountryId,
        businessPostalCode,
        mailingAddrLine1,
        mailingAddrLine2,
        mailingAddrLine3,
        mailingCity,
        mailingStateId ? parseInt(mailingStateId, 10) : null,
        mailingCountryId,
        mailingPostalCode,
        'system',
        'system'
      ];

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
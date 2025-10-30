'use server';

import DBconnection from '@/app/utils/config/db';
import { cookies } from 'next/headers';

// --- JWT and User Helpers ---

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
    if (userRows.length === 0) return 'unknown';
    const empid = userRows[0].empid;

    const [empRows] = await pool.execute(
      'SELECT EMP_FST_NAME, EMP_LAST_NAME FROM C_EMP WHERE empid = ? AND orgid = ?',
      [empid, orgId]
    );
    if (empRows.length === 0) return `${empid}-unknown`;

    const { EMP_FST_NAME, EMP_LAST_NAME } = empRows[0];
    // Use a consistent format, perhaps just empid if names are missing
    const namePart = (EMP_FST_NAME || EMP_LAST_NAME) ? `${EMP_FST_NAME || ''} ${EMP_LAST_NAME || ''}`.trim() : 'unknown';
    return `${empid}-${namePart}`;
  } catch (error) {
    console.error('Error fetching empid-name:', error.message);
    return 'system'; // Default to 'system' on error
  }
};

// --- Data Fetching Actions ---

// Helper to get OrgID safely
async function getOrgIdFromToken() {
  const cookieStore = cookies();
  const token = cookieStore.get('jwt_token')?.value;
  if (!token) throw new Error('Authentication token is missing.');

  const decoded = decodeJwt(token);
  if (!decoded || !decoded.orgid) throw new Error('Invalid authentication token.');

  return decoded.orgid;
}

// Helper Function to get all contacts, with account/suborg names
async function fetchAllContacts(pool, orgid) {
  const [contactsRows] = await pool.execute(
      `SELECT
         c.ROW_ID, c.ORGID, c.ACCOUNT_ID, c.SUBORGID, c.CONTACT_TYPE_CD,
         c.EMAIL, c.PHONE, c.MOBILE, c.FAX,
         a.ALIAS_NAME as accountName, s.suborgname as suborgName
       FROM C_CONTACTS c
       LEFT JOIN C_ACCOUNT a ON c.ACCOUNT_ID = a.ACCNT_ID AND c.ORGID = a.ORGID
       LEFT JOIN C_SUB_ORG s ON c.SUBORGID = s.suborgid AND c.ORGID = s.orgid
       WHERE c.ORGID = ?`,
      [orgid]
  );

  // Determine the primary contact value after fetching
  return contactsRows.map(contact => ({
    ...contact,
    accountName: contact.accountName || 'N/A', // Handle null account names
    suborgName: contact.suborgName || 'N/A',   // Handle null suborg names
    // Determine contactValue based on CONTACT_TYPE_CD
    contactValue: contact.CONTACT_TYPE_CD?.toUpperCase() === 'EMAIL' ? contact.EMAIL :
                  contact.CONTACT_TYPE_CD?.toUpperCase() === 'PHONE' ? contact.PHONE :
                  contact.CONTACT_TYPE_CD?.toUpperCase() === 'MOBILE' ? contact.MOBILE :
                  contact.CONTACT_TYPE_CD?.toUpperCase() === 'FAX' ? contact.FAX :
                  // Fallback if type doesn't match or is null
                  contact.EMAIL || contact.PHONE || contact.MOBILE || contact.FAX || 'N/A'
  }));
}

// Fetches initial data needed for the overview page (list + dropdowns)
export async function getContactsInitialData() {
  const orgid = await getOrgIdFromToken();
  let pool;
  try {
    pool = await DBconnection();

    // Fetch all necessary data in parallel for efficiency
    const [contacts, accounts, suborgs, countries, states] = await Promise.all([
      fetchAllContacts(pool, orgid), // Use the helper function
      pool.execute('SELECT ACCNT_ID, ALIAS_NAME, suborgid FROM C_ACCOUNT WHERE ORGID = ? AND ACTIVE_FLAG = 1', [orgid]).then(([rows]) => rows),
      pool.execute('SELECT suborgid, suborgname FROM C_SUB_ORG WHERE orgid = ? AND isstatus = 1', [orgid]).then(([rows]) => rows),
      pool.execute('SELECT ID, VALUE FROM C_COUNTRY WHERE ACTIVE = 1 ORDER BY VALUE ASC', []).then(([rows]) => rows), // Added ORDER BY
      pool.execute('SELECT ID, VALUE FROM C_STATE WHERE ACTIVE = 1 ORDER BY VALUE ASC', []).then(([rows]) => rows) // Added ORDER BY
    ]);

     // Ensure Account IDs are strings for consistency
     const formattedAccounts = accounts.map(acc => ({...acc, ACCNT_ID: String(acc.ACCNT_ID)}));

    return { contacts, accounts: formattedAccounts, suborgs, countries, states, orgid };
  } catch (error) {
    console.error('Error fetching contacts initial data:', error);
    throw new Error(`Failed to load initial contact data: ${error.message}`);
  } finally {
     // Release connection if pool was acquired (basic example)
     // if (pool && pool.end) await pool.end();
  }
}

// Fetches just the updated list of contacts (used after add/edit)
export async function getRefreshedContacts() {
  const orgid = await getOrgIdFromToken();
  let pool;
  try {
    pool = await DBconnection();
    const contacts = await fetchAllContacts(pool, orgid); // Use the helper function
    return contacts;
  } catch (error) {
    console.error('Error refreshing contacts:', error);
    throw new Error(`Failed to refresh contacts: ${error.message}`);
  } finally {
      // if (pool && pool.end) await pool.end();
  }
}

// Fetches details for a single contact by its ROW_ID
export async function fetchContactById(rowId) {
  const orgid = await getOrgIdFromToken();
  if (!rowId) throw new Error("Contact ROW_ID is required.");
  let pool;
  try {
    pool = await DBconnection();
    const [rows] = await pool.execute(
      // Select all columns needed for the edit form
      `SELECT
         ROW_ID, ORGID, ACCOUNT_ID, SUBORGID, CONTACT_TYPE_CD,
         EMAIL, PHONE, MOBILE, FAX, ALT_EMAIL,
         HOME_ADDR_LINE1, HOME_ADDR_LINE2, HOME_ADDR_LINE3, HOME_CITY,
         HOME_COUNTRY_ID, HOME_STATE_ID, HOME_POSTAL_CODE, HOME_CUSTOM_STATE,
         MAILING_ADDR_LINE1, MAILING_ADDR_LINE2, MAILING_ADDR_LINE3, MAILING_CITY,
         MAILING_COUNTRY_ID, MAILING_STATE_ID, MAILING_POSTAL_CODE, MAILING_CUSTOM_STATE,
         STATUS, CREATED_DATE, LAST_UPDATED_DATE, CREATED_BY, LAST_UPDATED_BY
       FROM C_CONTACTS
       WHERE ROW_ID = ? AND ORGID = ?`,
      [rowId, orgid]
    );

    if (rows.length === 0) {
      throw new Error('Contact not found or you do not have permission to view it.');
    }
    // Ensure IDs that might be numbers are returned as strings if needed by frontend dropdowns
    const contact = rows[0];
    return {
        ...contact,
        ACCOUNT_ID: contact.ACCOUNT_ID ? String(contact.ACCOUNT_ID) : '',
        HOME_COUNTRY_ID: contact.HOME_COUNTRY_ID ? String(contact.HOME_COUNTRY_ID) : null,
        HOME_STATE_ID: contact.HOME_STATE_ID ? String(contact.HOME_STATE_ID) : null,
        MAILING_COUNTRY_ID: contact.MAILING_COUNTRY_ID ? String(contact.MAILING_COUNTRY_ID) : null,
        MAILING_STATE_ID: contact.MAILING_STATE_ID ? String(contact.MAILING_STATE_ID) : null,
    };
  } catch (error) {
    console.error('Error fetching contact by ID:', error);
    throw new Error(`Failed to fetch contact details: ${error.message}`);
  } finally {
     // if (pool && pool.end) await pool.end();
  }
}

// --- Form Actions (Add / Update) ---

// Adds a new contact record
export async function addContact(prevState, formData) {
  let orgid;
  let userId;
  let pool; // Define pool outside try block for potential finally cleanup
  try {
      // Authentication and User Info
      const cookieStore = cookies();
      const token = cookieStore.get('jwt_token')?.value;
      if (!token) return { error: 'Authentication token is missing. Please log in.' };

      const decoded = decodeJwt(token);
      if (!decoded || !decoded.orgid || !decoded.userId) {
          return { error: 'Invalid authentication token.' };
      }
      orgid = decoded.orgid;
      userId = decoded.userId;

      // --- Extract and Validate Core Data ---
      const accountId = formData.get('ACCOUNT_ID');
      const contactType = formData.get('CONTACT_TYPE_CD');

      if (!accountId) return { error: 'Account is required.' };
      if (!contactType) return { error: 'Contact Type is required.' };
      // Validate the specific contact field based on type
      const contactValueField = contactType.toUpperCase();
      if (!formData.get(contactValueField)?.trim()) {
          return { error: `${contactType} value is required.` };
      }

      // --- Prepare Data for Insertion ---
      pool = await DBconnection();
      const createdBy = await getCurrentUserEmpIdName(pool, userId, orgid);

      const columns = [
          'ORGID', 'ACCOUNT_ID', 'SUBORGID', 'CONTACT_TYPE_CD',
          'EMAIL', 'PHONE', 'MOBILE', 'FAX', // Include all potential contact fields
          'HOME_ADDR_LINE1', 'HOME_ADDR_LINE2', 'HOME_ADDR_LINE3', 'HOME_CITY',
          'HOME_COUNTRY_ID', 'HOME_STATE_ID', 'HOME_POSTAL_CODE', 'HOME_CUSTOM_STATE',
          'MAILING_ADDR_LINE1', 'MAILING_ADDR_LINE2', 'MAILING_ADDR_LINE3', 'MAILING_CITY',
          'MAILING_COUNTRY_ID', 'MAILING_STATE_ID', 'MAILING_POSTAL_CODE', 'MAILING_CUSTOM_STATE',
          'CREATED_BY', 'LAST_UPDATED_BY', 'STATUS'
      ];

      // Helper function to get form value or null
      const getFormValue = (key) => formData.get(key)?.trim() || null;

      // Address handling
      const homeCountryId = getFormValue('HOME_COUNTRY_ID');
      const isHomeUS = String(homeCountryId) === '185';
      const mailingCountryId = getFormValue('MAILING_COUNTRY_ID');
      const isMailingUS = String(mailingCountryId) === '185';

      const values = [
          orgid, accountId, getFormValue('SUBORGID'), contactType,
          getFormValue('EMAIL'), getFormValue('PHONE'), getFormValue('MOBILE'), getFormValue('FAX'),
          getFormValue('HOME_ADDR_LINE1'), getFormValue('HOME_ADDR_LINE2'), getFormValue('HOME_ADDR_LINE3'), getFormValue('HOME_CITY'),
          homeCountryId, isHomeUS ? getFormValue('HOME_STATE_ID') : null, getFormValue('HOME_POSTAL_CODE'), !isHomeUS ? getFormValue('HOME_CUSTOM_STATE') : null,
          getFormValue('MAILING_ADDR_LINE1'), getFormValue('MAILING_ADDR_LINE2'), getFormValue('MAILING_ADDR_LINE3'), getFormValue('MAILING_CITY'),
          mailingCountryId, isMailingUS ? getFormValue('MAILING_STATE_ID') : null, getFormValue('MAILING_POSTAL_CODE'), !isMailingUS ? getFormValue('MAILING_CUSTOM_STATE') : null,
          createdBy, createdBy, 'ACTIVE' // Default status
      ];

      // --- Execute Query ---
      const placeholders = values.map(() => '?').join(', ');
      const query = `INSERT INTO C_CONTACTS (${columns.join(', ')}) VALUES (${placeholders})`;

      await pool.execute(query, values);
      console.log(`Contact added successfully for Account ID: ${accountId}`);
      return { success: true };

  } catch (error) {
      console.error('Error adding contact:', error);
      // More specific error messages
      if (error.code === 'ER_DUP_ENTRY') {
          return { error: 'Failed to add contact: This contact might already exist.' };
      }
      if (error.code === 'ER_NO_REFERENCED_ROW_2' && error.message.includes('FOREIGN KEY (`ACCOUNT_ID`)')) {
           return { error: 'Failed to add contact: The selected Account ID is invalid or does not exist.' };
      }
       if (error.code === 'ER_NO_REFERENCED_ROW_2' && error.message.includes('FOREIGN KEY (`SUBORGID`)')) {
           return { error: 'Failed to add contact: The selected Suborganization ID is invalid or does not exist.' };
      }
      return { error: `Failed to add contact: ${error.message}` };
  } finally {
      // if (pool && pool.end) await pool.end();
  }
}


// Updates an existing contact record based on the provided section
export async function updateContact(prevState, formData) {
  let orgid;
  let userId;
  const section = formData.get('section'); // Get the section being updated
  const rowId = formData.get('ROW_ID');
  let pool; // Define pool outside try block

  try {
    // --- Authentication and User Info ---
    const cookieStore = cookies();
    const token = cookieStore.get('jwt_token')?.value;
    if (!token) return { error: 'Authentication token is missing. Please log in.' };

    const decoded = decodeJwt(token);
    if (!decoded || !decoded.orgid || !decoded.userId) {
      return { error: 'Invalid authentication token.' };
    }
    orgid = decoded.orgid;
    userId = decoded.userId;

    // --- Basic Validation ---
    if (!rowId) return { error: 'Contact ID (ROW_ID) is missing.' };
    if (!section) return { error: 'Update section identifier is missing.' };

    // --- Prepare Update ---
    pool = await DBconnection();
    const lastUpdatedBy = await getCurrentUserEmpIdName(pool, userId, orgid);

    let setClauses = []; // Array to hold "COLUMN = ?" parts
    let values = []; // Array to hold corresponding values

    // Helper function to get form value or null, ensuring empty strings become null
    const getFormValue = (key) => {
        const val = formData.get(key)?.trim();
        return val === '' ? null : val;
    };


    // --- Build Query Based on Section ---
    if (section === 'core') {
      const accountId = getFormValue('ACCOUNT_ID');
      const contactType = getFormValue('CONTACT_TYPE_CD');
      if (!accountId) return { error: 'Account is required.' };
      if (!contactType) return { error: 'Contact Type is required.' };
      const contactValueField = contactType.toUpperCase();
      // Use getFormValue which handles trimming and null conversion
      if (!getFormValue(contactValueField)) return { error: `${contactType} value is required.` };


      setClauses = [
        'ACCOUNT_ID = ?', 'SUBORGID = ?', 'CONTACT_TYPE_CD = ?',
        'EMAIL = ?', 'PHONE = ?', 'MOBILE = ?', 'FAX = ?'
      ];
      values.push(
        accountId,
        getFormValue('SUBORGID'), // SUBORGID is derived in frontend, sent in form
        contactType,
        getFormValue('EMAIL'),
        getFormValue('PHONE'),
        getFormValue('MOBILE'),
        getFormValue('FAX')
      );
    } else if (section === 'home') {
      setClauses = [
        'HOME_ADDR_LINE1 = ?', 'HOME_ADDR_LINE2 = ?', 'HOME_ADDR_LINE3 = ?',
        'HOME_CITY = ?', 'HOME_COUNTRY_ID = ?', 'HOME_STATE_ID = ?',
        'HOME_POSTAL_CODE = ?', 'HOME_CUSTOM_STATE = ?'
      ];
      const countryId = getFormValue('HOME_COUNTRY_ID');
      const isUS = String(countryId) === '185';
      values.push(
        getFormValue('HOME_ADDR_LINE1'),
        getFormValue('HOME_ADDR_LINE2'),
        getFormValue('HOME_ADDR_LINE3'),
        getFormValue('HOME_CITY'),
        countryId,
        isUS ? getFormValue('HOME_STATE_ID') : null, // Store null if not US
        getFormValue('HOME_POSTAL_CODE'),
        !isUS ? getFormValue('HOME_CUSTOM_STATE') : null // Store null if US
      );
    } else if (section === 'mailing') {
       setClauses = [
        'MAILING_ADDR_LINE1 = ?', 'MAILING_ADDR_LINE2 = ?', 'MAILING_ADDR_LINE3 = ?',
        'MAILING_CITY = ?', 'MAILING_COUNTRY_ID = ?', 'MAILING_STATE_ID = ?',
        'MAILING_POSTAL_CODE = ?', 'MAILING_CUSTOM_STATE = ?'
      ];
      const countryId = getFormValue('MAILING_COUNTRY_ID');
      const isUS = String(countryId) === '185';
      values.push(
        getFormValue('MAILING_ADDR_LINE1'),
        getFormValue('MAILING_ADDR_LINE2'),
        getFormValue('MAILING_ADDR_LINE3'),
        getFormValue('MAILING_CITY'),
        countryId,
        isUS ? getFormValue('MAILING_STATE_ID') : null, // Store null if not US
        getFormValue('MAILING_POSTAL_CODE'),
        !isUS ? getFormValue('MAILING_CUSTOM_STATE') : null // Store null if US
      );
    } else {
      return { error: `Invalid update section specified: ${section}` };
    }

    // --- Add Audit Fields and WHERE Clause ---
    if (setClauses.length > 0) { // Only proceed if there are fields to update
        setClauses.push('LAST_UPDATED_BY = ?', 'LAST_UPDATED_DATE = CURRENT_TIMESTAMP');
        values.push(lastUpdatedBy);

        // Add WHERE clause parameters LAST
        values.push(rowId, orgid);

        // --- Construct and Execute Query ---
        const query = `
          UPDATE C_CONTACTS SET
            ${setClauses.join(', ')}
          WHERE ROW_ID = ? AND ORGID = ?
        `;

        console.log(`Executing Update Query for section ${section}:`, pool.format(query, values)); // Log formatted query

        const [result] = await pool.execute(query, values);

        if (result.affectedRows === 0) {
           // Check if the record exists to differentiate between "not found" and "no change"
           const [check] = await pool.execute("SELECT ROW_ID FROM C_CONTACTS WHERE ROW_ID = ? AND ORGID = ?", [rowId, orgid]);
           if (check.length === 0) {
               console.error(`Update failed for ROW_ID ${rowId}: Record not found.`);
               return { error: 'Update failed: Contact record not found.' };
           } else {
                console.warn(`Update executed for ROW_ID ${rowId}, section ${section}, but no rows changed (data might be identical).`);
               // Return success even if no rows changed, as the attempt was valid and record exists
               return { success: true, message: "No changes detected." };
           }
        }

        console.log(`Contact ROW_ID ${rowId} updated successfully for section ${section}.`);
        return { success: true };
    } else {
         // Should not happen if section logic is correct, but handles edge case
         console.warn(`No fields to update for section ${section}.`);
         return { success: true, message: "No fields specified for update in this section." };
    }

  } catch (error) {
    console.error(`Error updating contact section ${section} for ROW_ID ${rowId}:`, error);
    // Provide more specific database errors if available
    if (error.code === 'ER_DUP_ENTRY') {
         return { error: 'Update failed: A similar record already exists (duplicate entry).' };
    }
     if (error.code === 'ER_NO_REFERENCED_ROW_2' && error.message.includes('FOREIGN KEY (`ACCOUNT_ID`)')) {
           return { error: 'Update failed: The selected Account ID is invalid or does not exist.' };
      }
       if (error.code === 'ER_NO_REFERENCED_ROW_2' && error.message.includes('FOREIGN KEY (`SUBORGID`)')) {
           return { error: 'Update failed: The selected Suborganization ID is invalid or does not exist.' };
      }
    return { error: `Failed to update contact section ${section}: ${error.message}` };
  } finally {
      // if (pool && pool.end) await pool.end(); // Release connection if appropriate for your setup
  }
}

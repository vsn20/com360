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
    const namePart = (EMP_FST_NAME || EMP_LAST_NAME) ? `${EMP_FST_NAME || ''} ${EMP_LAST_NAME || ''}`.trim() : 'unknown';
    return `${empid}-${namePart}`;
  } catch (error) {
    console.error('Error fetching empid-name:', error.message);
    return 'system';
  }
};

// --- Data Fetching Actions ---

async function getOrgIdFromToken() {
  const cookieStore = cookies();
  const token = cookieStore.get('jwt_token')?.value;
  if (!token) throw new Error('Authentication token is missing.');

  const decoded = decodeJwt(token);
  if (!decoded || !decoded.orgid) throw new Error('Invalid authentication token.');

  return decoded.orgid;
}

// Helper Function to get all contacts
async function fetchAllContacts(pool, orgid) {
  const [contactsRows] = await pool.execute(
      `SELECT
         c.ROW_ID, c.ORGID, c.ACCOUNT_ID, c.SUBORGID, c.CONTACT_TYPE_CD,
         c.FIRST_NAME, c.LAST_NAME, c.JOB_TITLE, c.DEPARTMENT, c.IS_PRIMARY,
         c.EMAIL, c.ALT_EMAIL, c.PHONE, c.MOBILE, c.FAX,
         a.ALIAS_NAME as accountName, s.suborgname as suborgName
       FROM C_CONTACTS c
       LEFT JOIN C_ACCOUNT a ON c.ACCOUNT_ID = a.ACCNT_ID AND c.ORGID = a.ORGID
       LEFT JOIN C_SUB_ORG s ON c.SUBORGID = s.suborgid AND c.ORGID = s.orgid
       WHERE c.ORGID = ?`,
      [orgid]
  );

  return contactsRows.map(contact => ({
    ...contact,
    accountName: contact.accountName || 'N/A',
    suborgName: contact.suborgName || 'N/A',
    displayName: `${contact.FIRST_NAME || ''} ${contact.LAST_NAME || ''}`.trim() || 'N/A',
    // Prioritize Email, then Mobile, then Phone for display if needed, or send all
    primaryContact: contact.EMAIL || contact.MOBILE || contact.PHONE || 'N/A'
  }));
}

export async function getContactsInitialData() {
  const cookieStore = cookies();
  const token = cookieStore.get('jwt_token')?.value;
  if (!token) throw new Error('Authentication token is missing.');

  const decoded = decodeJwt(token);
  if (!decoded || !decoded.orgid) throw new Error('Invalid authentication token.');

  const orgid = decoded.orgid;
  const userId = decoded.userId;
  
  let pool;
  try {
    pool = await DBconnection();

    // Fetch user's suborgid
    let userSuborgId = null;
    const [userRows] = await pool.execute(
      'SELECT empid FROM C_USER WHERE username = ? AND orgid = ?',
      [userId, orgid]
    );
    if (userRows.length > 0) {
      const empid = userRows[0].empid;
      const [empRows] = await pool.execute(
        'SELECT suborgid FROM C_EMP WHERE empid = ? AND orgid = ?',
        [empid, orgid]
      );
      if (empRows.length > 0 && empRows[0].suborgid) {
        userSuborgId = empRows[0].suborgid;
      }
    }

    const [contacts, accounts, suborgs, countries, states, contactTypes] = await Promise.all([
      fetchAllContacts(pool, orgid),
      pool.execute('SELECT ACCNT_ID, ALIAS_NAME, suborgid FROM C_ACCOUNT WHERE ORGID = ? AND ACTIVE_FLAG = 1', [orgid]).then(([rows]) => rows),
      pool.execute('SELECT suborgid, suborgname FROM C_SUB_ORG WHERE orgid = ? AND isstatus = 1', [orgid]).then(([rows]) => rows),
      pool.execute('SELECT ID, VALUE FROM C_COUNTRY WHERE ACTIVE = 1 ORDER BY VALUE ASC', []).then(([rows]) => rows),
      pool.execute('SELECT ID, VALUE FROM C_STATE WHERE ACTIVE = 1 ORDER BY VALUE ASC', []).then(([rows]) => rows),
      pool.execute('SELECT id AS ID, Name AS VALUE FROM C_GENERIC_VALUES WHERE g_id = 43 AND orgid = ? AND isactive = 1 ORDER BY display_order', [orgid]).then(([rows]) => rows)
    ]);

     const formattedAccounts = accounts.map(acc => ({...acc, ACCNT_ID: String(acc.ACCNT_ID)}));

    return { contacts, accounts: formattedAccounts, suborgs, countries, states, orgid, contactTypes, userSuborgId };
  } catch (error) {
    console.error('Error fetching contacts initial data:', error);
    throw new Error(`Failed to load initial contact data: ${error.message}`);
  }
}

export async function getRefreshedContacts() {
  const orgid = await getOrgIdFromToken();
  let pool;
  try {
    pool = await DBconnection();
    const contacts = await fetchAllContacts(pool, orgid);
    return contacts;
  } catch (error) {
    console.error('Error refreshing contacts:', error);
    throw new Error(`Failed to refresh contacts: ${error.message}`);
  }
}

export async function fetchContactById(rowId) {
  const orgid = await getOrgIdFromToken();
  if (!rowId) throw new Error("Contact ROW_ID is required.");
  let pool;
  try {
    pool = await DBconnection();
    const [rows] = await pool.execute(
      `SELECT
         ROW_ID, ORGID, ACCOUNT_ID, SUBORGID, CONTACT_TYPE_CD,
         FIRST_NAME, LAST_NAME, JOB_TITLE, DEPARTMENT, IS_PRIMARY,
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
    const contact = rows[0];
    return {
        ...contact,
        ACCOUNT_ID: contact.ACCOUNT_ID ? String(contact.ACCOUNT_ID) : '',
        HOME_COUNTRY_ID: contact.HOME_COUNTRY_ID ? String(contact.HOME_COUNTRY_ID) : null,
        HOME_STATE_ID: contact.HOME_STATE_ID ? String(contact.HOME_STATE_ID) : null,
        MAILING_COUNTRY_ID: contact.MAILING_COUNTRY_ID ? String(contact.MAILING_COUNTRY_ID) : null,
        MAILING_STATE_ID: contact.MAILING_STATE_ID ? String(contact.MAILING_STATE_ID) : null,
        IS_PRIMARY: contact.IS_PRIMARY ? 1 : 0,
    };
  } catch (error) {
    console.error('Error fetching contact by ID:', error);
    throw new Error(`Failed to fetch contact details: ${error.message}`);
  }
}

// --- Form Actions (Add / Update) ---

export async function addContact(prevState, formData) {
  let orgid;
  let userId;
  let pool;
  try {
      const cookieStore = cookies();
      const token = cookieStore.get('jwt_token')?.value;
      if (!token) return { error: 'Authentication token is missing. Please log in.' };

      const decoded = decodeJwt(token);
      if (!decoded || !decoded.orgid || !decoded.userId) {
          return { error: 'Invalid authentication token.' };
      }
      orgid = decoded.orgid;
      userId = decoded.userId;

      const firstName = formData.get('FIRST_NAME')?.trim();
      const lastName = formData.get('LAST_NAME')?.trim();
      const accountId = formData.get('ACCOUNT_ID')?.trim() || null;
      const suborgId = formData.get('SUBORGID')?.trim() || null;
      const contactTypeCd = formData.get('CONTACT_TYPE_CD')?.trim() || 'Primary';
      
      // Validation: First Name and Last Name are required
      if (!firstName) return { error: 'First Name is required.' };
      if (!lastName) return { error: 'Last Name is required.' };
      
      // If no account selected, suborgid is required (should be user's suborg by default)
      if (!accountId && !suborgId) {
          return { error: 'Organization is required when no Account is selected.' };
      }

      pool = await DBconnection();
      const createdBy = await getCurrentUserEmpIdName(pool, userId, orgid);

      const columns = [
          'ORGID', 'ACCOUNT_ID', 'SUBORGID', 'CONTACT_TYPE_CD',
          'FIRST_NAME', 'LAST_NAME', 'JOB_TITLE', 'DEPARTMENT', 'IS_PRIMARY',
          'EMAIL', 'ALT_EMAIL', 'PHONE', 'MOBILE', 'FAX',
          'HOME_ADDR_LINE1', 'HOME_ADDR_LINE2', 'HOME_ADDR_LINE3', 'HOME_CITY',
          'HOME_COUNTRY_ID', 'HOME_STATE_ID', 'HOME_POSTAL_CODE', 'HOME_CUSTOM_STATE',
          'MAILING_ADDR_LINE1', 'MAILING_ADDR_LINE2', 'MAILING_ADDR_LINE3', 'MAILING_CITY',
          'MAILING_COUNTRY_ID', 'MAILING_STATE_ID', 'MAILING_POSTAL_CODE', 'MAILING_CUSTOM_STATE',
          'CREATED_BY', 'LAST_UPDATED_BY', 'STATUS'
      ];

      const getFormValue = (key) => formData.get(key)?.trim() || null;

      const homeCountryId = getFormValue('HOME_COUNTRY_ID');
      const isHomeUS = String(homeCountryId) === '185';
      const mailingCountryId = getFormValue('MAILING_COUNTRY_ID');
      const isMailingUS = String(mailingCountryId) === '185';
      const isPrimary = formData.get('IS_PRIMARY') === '1' ? 1 : 0;

      const values = [
          orgid, accountId, suborgId, contactTypeCd,
          firstName, lastName, getFormValue('JOB_TITLE'), getFormValue('DEPARTMENT'), isPrimary,
          getFormValue('EMAIL'), getFormValue('ALT_EMAIL'), getFormValue('PHONE'), getFormValue('MOBILE'), getFormValue('FAX'),
          getFormValue('HOME_ADDR_LINE1'), getFormValue('HOME_ADDR_LINE2'), getFormValue('HOME_ADDR_LINE3'), getFormValue('HOME_CITY'),
          homeCountryId, isHomeUS ? getFormValue('HOME_STATE_ID') : null, getFormValue('HOME_POSTAL_CODE'), !isHomeUS ? getFormValue('HOME_CUSTOM_STATE') : null,
          getFormValue('MAILING_ADDR_LINE1'), getFormValue('MAILING_ADDR_LINE2'), getFormValue('MAILING_ADDR_LINE3'), getFormValue('MAILING_CITY'),
          mailingCountryId, isMailingUS ? getFormValue('MAILING_STATE_ID') : null, getFormValue('MAILING_POSTAL_CODE'), !isMailingUS ? getFormValue('MAILING_CUSTOM_STATE') : null,
          createdBy, createdBy, 'ACTIVE'
      ];

      const placeholders = values.map(() => '?').join(', ');
      const query = `INSERT INTO C_CONTACTS (${columns.join(', ')}) VALUES (${placeholders})`;

      await pool.execute(query, values);
      console.log(`Contact added successfully: ${firstName} ${lastName}`);
      return { success: true };

  } catch (error) {
      console.error('Error adding contact:', error);
      if (error.code === 'ER_DUP_ENTRY') {
          return { error: 'Failed to add contact: This contact might already exist.' };
      }
      return { error: `Failed to add contact: ${error.message}` };
  }
}

export async function updateContact(prevState, formData) {
  let orgid;
  let userId;
  const section = formData.get('section');
  const rowId = formData.get('ROW_ID');
  let pool;

  try {
    const cookieStore = cookies();
    const token = cookieStore.get('jwt_token')?.value;
    if (!token) return { error: 'Authentication token is missing. Please log in.' };

    const decoded = decodeJwt(token);
    if (!decoded || !decoded.orgid || !decoded.userId) {
      return { error: 'Invalid authentication token.' };
    }
    orgid = decoded.orgid;
    userId = decoded.userId;

    if (!rowId) return { error: 'Contact ID (ROW_ID) is missing.' };
    if (!section) return { error: 'Update section identifier is missing.' };

    pool = await DBconnection();
    const lastUpdatedBy = await getCurrentUserEmpIdName(pool, userId, orgid);

    let setClauses = [];
    let values = [];

    const getFormValue = (key) => {
        const val = formData.get(key)?.trim();
        return val === '' ? null : val;
    };

    if (section === 'core') {
      const firstName = getFormValue('FIRST_NAME');
      const lastName = getFormValue('LAST_NAME');
      const accountId = getFormValue('ACCOUNT_ID');
      const suborgId = getFormValue('SUBORGID');
      
      if (!firstName) return { error: 'First Name is required.' };
      if (!lastName) return { error: 'Last Name is required.' };
      if (!accountId && !suborgId) return { error: 'Organization is required when no Account is selected.' };

      setClauses = [
        'ACCOUNT_ID = ?', 'SUBORGID = ?', 'CONTACT_TYPE_CD = ?',
        'FIRST_NAME = ?', 'LAST_NAME = ?', 'JOB_TITLE = ?', 'DEPARTMENT = ?', 'IS_PRIMARY = ?',
        'EMAIL = ?', 'ALT_EMAIL = ?', 'PHONE = ?', 'MOBILE = ?', 'FAX = ?'
      ];
      const isPrimary = formData.get('IS_PRIMARY') === '1' ? 1 : 0;
      values.push(
        accountId,
        suborgId,
        getFormValue('CONTACT_TYPE_CD') || 'Primary',
        firstName,
        lastName,
        getFormValue('JOB_TITLE'),
        getFormValue('DEPARTMENT'),
        isPrimary,
        getFormValue('EMAIL'),
        getFormValue('ALT_EMAIL'),
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
        isUS ? getFormValue('HOME_STATE_ID') : null,
        getFormValue('HOME_POSTAL_CODE'),
        !isUS ? getFormValue('HOME_CUSTOM_STATE') : null
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
        isUS ? getFormValue('MAILING_STATE_ID') : null,
        getFormValue('MAILING_POSTAL_CODE'),
        !isUS ? getFormValue('MAILING_CUSTOM_STATE') : null
      );
    } else {
      return { error: `Invalid update section specified: ${section}` };
    }

    if (setClauses.length > 0) {
        setClauses.push('LAST_UPDATED_BY = ?', 'LAST_UPDATED_DATE = CURRENT_TIMESTAMP');
        values.push(lastUpdatedBy);
        values.push(rowId, orgid);

        const query = `
          UPDATE C_CONTACTS SET
            ${setClauses.join(', ')}
          WHERE ROW_ID = ? AND ORGID = ?
        `;

        await pool.execute(query, values);
        console.log(`Contact ROW_ID ${rowId} updated successfully for section ${section}.`);
        return { success: true };
    } else {
         return { success: true, message: "No fields specified for update in this section." };
    }

  } catch (error) {
    console.error(`Error updating contact section ${section} for ROW_ID ${rowId}:`, error);
    if (error.code === 'ER_DUP_ENTRY') {
         return { error: 'Update failed: A similar record already exists (duplicate entry).' };
    }
    return { error: `Failed to update contact section ${section}: ${error.message}` };
  }
}
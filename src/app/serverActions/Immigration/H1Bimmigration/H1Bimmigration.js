'use server';

import DBconnection from '@/app/utils/config/db';
import { cookies } from 'next/headers';

// Helper: Decode JWT
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

const getUserContext = async () => {
  const cookieStore = await cookies();
  const token = cookieStore.get('jwt_token')?.value;
  if (!token) throw new Error('Unauthorized');
  const decoded = decodeJwt(token);
  if (!decoded || !decoded.orgid) throw new Error('Invalid Token');
  return { orgid: decoded.orgid };
};

// Format Date to MM/DD/YYYY string format (US Standard) - for CSV
const formatDateToString = (date) => {
  if (!date || isNaN(new Date(date))) return '';
  const d = new Date(date);
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${month}/${day}/${d.getFullYear()}`;
};

// Format Date to YYYY-MM-DD for HTML date inputs
const formatDateForInput = (date) => {
  if (!date || isNaN(new Date(date))) return '';
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// 1. Fetch Countries
export async function fetchCountries() {
  const pool = await DBconnection();
  const [rows] = await pool.query(
    'SELECT ID, VALUE FROM C_COUNTRY WHERE ACTIVE = 1 ORDER BY VALUE ASC'
  );
  return rows;
}

export async function fetchH1BSuborgs() {
  const { orgid } = await getUserContext();
  const pool = await DBconnection();
  const [rows] = await pool.query(
    'SELECT suborgid, suborgname FROM C_SUB_ORG WHERE orgid = ? AND isstatus = 1', 
    [orgid]
  );
  return rows;
}

export async function fetchH1BRegistrations({ year, suborgid } = {}) {
  const { orgid } = await getUserContext();
  const pool = await DBconnection();

  let query = `
    SELECT 
      id, orgid, suborgid, year,
      first_name, middle_name, last_name,
      gender, 
      dob, 
      country_of_birth, country_of_citizenship,
      passport_number, 
      passport_expiry,
      passport_issuing_country, has_valid_passport,
      us_masters_cap, email, status, created_at
    FROM C_H1B_IMMIGRATION 
    WHERE orgid = ?
  `;
  
  const params = [orgid];

  if (year && year !== 'all') {
    query += ` AND year = ?`;
    params.push(year);
  }

  if (suborgid && suborgid !== 'all') {
    query += ` AND suborgid = ?`;
    params.push(suborgid);
  }

  query += ` ORDER BY created_at DESC`;

  // OPTIMIZED: pool.query automatically handles connection release
  const [rows] = await pool.query(query, params);

  // Format dates: YYYY-MM-DD for form inputs, MM/DD/YYYY for display
  return rows.map(row => ({
    ...row,
    dob: row.dob ? formatDateForInput(row.dob) : '',
    dob_display: row.dob ? formatDateToString(row.dob) : '',
    passport_expiry: row.passport_expiry ? formatDateForInput(row.passport_expiry) : '',
    passport_expiry_display: row.passport_expiry ? formatDateToString(row.passport_expiry) : '',
    created_at: row.created_at ? formatDateToString(row.created_at) : null
  }));
}

export async function addH1BRegistration(data) {
  try {
    const { orgid } = await getUserContext();
    const pool = await DBconnection();

    const dob = data.dob ? data.dob : null;
    const passport_expiry = data.passport_expiry ? data.passport_expiry : null;

    await pool.query(`
      INSERT INTO C_H1B_IMMIGRATION (
        orgid, suborgid, year,
        first_name, middle_name, last_name,
        gender, dob, email,
        country_of_birth, country_of_citizenship,
        passport_number, passport_expiry, passport_issuing_country,
        has_valid_passport, us_masters_cap
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      orgid, data.suborgid, data.year,
      data.first_name, data.middle_name || null, data.last_name,
      data.gender, dob, data.email,
      data.country_of_birth, data.country_of_citizenship,
      data.passport_number, passport_expiry, data.passport_issuing_country,
      data.has_valid_passport, data.us_masters_cap
    ]);

    return { success: true };
  } catch (error) {
    console.error('Error adding H1B record:', error);
    return { error: error.message };
  }
}

export async function updateH1BRegistration(data) {
  try {
    const { orgid } = await getUserContext();
    const pool = await DBconnection();

    const dob = data.dob ? data.dob : null;
    const passport_expiry = data.passport_expiry ? data.passport_expiry : null;

    await pool.query(`
      UPDATE C_H1B_IMMIGRATION SET
        suborgid = ?, year = ?,
        first_name = ?, middle_name = ?, last_name = ?,
        gender = ?, dob = ?, email = ?,
        country_of_birth = ?, country_of_citizenship = ?,
        passport_number = ?, passport_expiry = ?, passport_issuing_country = ?,
        has_valid_passport = ?, us_masters_cap = ?
      WHERE id = ? AND orgid = ?
    `, [
      data.suborgid, data.year,
      data.first_name, data.middle_name || null, data.last_name,
      data.gender, dob, data.email,
      data.country_of_birth, data.country_of_citizenship,
      data.passport_number, passport_expiry, data.passport_issuing_country,
      data.has_valid_passport, data.us_masters_cap,
      data.id, orgid
    ]);

    return { success: true };
  } catch (error) {
    console.error('Error updating H1B record:', error);
    return { error: error.message };
  }
}

// CSV Fetcher with MM/DD/YYYY date format
export async function fetchH1BDataForCSV({ year, suborgid }) {
  const { orgid } = await getUserContext();
  const pool = await DBconnection();

  const query = `
    SELECT 
      last_name,
      first_name,
      middle_name,
      gender,
      dob, 
      country_of_birth,
      country_of_citizenship,
      passport_number,
      passport_expiry, 
      passport_issuing_country,
      has_valid_passport,
      us_masters_cap,
      email
    FROM C_H1B_IMMIGRATION
    WHERE orgid = ? AND year = ? AND suborgid = ?
  `;

  const [rows] = await pool.query(query, [orgid, year, suborgid]);

  // Map to CSV structure with MM/DD/YYYY formatted dates
  return rows.map(row => ({
    "Last Name": row.last_name || '',
    "First Name": row.first_name || '',
    "Middle Name": row.middle_name || '',
    "Gender": row.gender || '',
    "Date of Birth": formatDateToString(row.dob),
    "Country of Birth": row.country_of_birth || '',
    "Country of Citizenship": row.country_of_citizenship || '',
    "Passport Number": row.passport_number || '',
    "Passport Expiration Date": formatDateToString(row.passport_expiry),
    "Passport Issuing Country": row.passport_issuing_country || '',
    "Has Valid Passport": row.has_valid_passport || '',
    "Eligible for U.S. Advanced Degree Exemption": row.us_masters_cap || '',
    "Email Address": row.email || ''
  }));
}
"use server";

import DBconnection from "../utils/config/db";
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

export async function addemployee(formData) {
  const empFstName = formData.get('empFstName');
  const empMidName = formData.get('empMidName') || null;
  const empLastName = formData.get('empLastName');
  const roleid = formData.get('roleid');
  const currentRole = formData.get('currentRole');
  const empPrefName = formData.get('empPrefName') || null;
  const email = formData.get('email');
  const gender = formData.get('gender') || null;
  const mobileNumber = formData.get('mobileNumber') || null;
  const dob = formData.get('dob') || null;
  const hireDate = formData.get('hireDate');

  // Get the JWT token from cookies
  const cookieStore = cookies();
  const token = cookieStore.get('jwt_token')?.value;

  if (!token) {
    console.log('Redirecting: No token found');
    return { error: 'No token found. Please log in.' };
  }

  // Decode the token to get the orgid (no admin restriction since permissions are in middleware)
  const decoded = decodeJwt(token);
  if (!decoded || !decoded.orgid) {
    console.log('Redirecting: Invalid token or orgid not found');
    return { error: 'Invalid token or orgid not found.' };
  }

  const orgid = decoded.orgid;

  // Validation for required fields
  if (!empFstName || empFstName.trim() === '') {
    console.log('Redirecting: First name is required');
    return { error: 'First name is required.' };
  }
  if (!empLastName || empLastName.trim() === '') {
    console.log('Redirecting: Last name is required');
    return { error: 'Last name is required.' };
  }
  if (!email || email.trim() === '') {
    console.log('Redirecting: Email is required');
    return { error: 'Email is required.' };
  }
  if (!roleid) {
    console.log('Redirecting: Role is required');
    return { error: 'Role is required.' };
  }
  if (!hireDate) {
    console.log('Redirecting: Hire date is required');
    return { error: 'Hire date is required.' };
  }

  let redirectPath = `/userscreens/employee/addemployee`;
  try {
    const pool = await DBconnection();

    // Check if email already exists (email is UNIQUE in C_EMP)
    const [existingEmail] = await pool.query(
      'SELECT empid FROM C_EMP WHERE email = ?',
      [email]
    );
    if (existingEmail.length > 0) {
      console.log('Redirecting: Email already exists');
      return { error: 'Email already exists.' };
    }

    // Get the current number of records in C_EMP and add 1 for empid
    const [countResult] = await pool.query('SELECT COUNT(*) AS count FROM C_EMP');
    const empCount = countResult[0].count;
    const empid = `emp_${empCount + 1}`; // Generate empid as varchar(255) with prefix

    // Insert into C_EMP table
    await pool.query(
      `INSERT INTO C_EMP (
        empid, orgid, EMP_FST_NAME, EMP_MID_NAME, EMP_LAST_NAME, EMP_PREF_NAME, email,
        roleid, GENDER, MOBILE_NUMBER, DOB, HIRE, LAST_WORK_DATE, TERMINATED_DATE,
        REJOIN_DATE, CREATED_BY, LAST_UPDATED_BY
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        empid, orgid, empFstName, empMidName, empLastName, empPrefName, email,
        roleid, gender, mobileNumber, dob, hireDate, null, null, null, 'system', 'system'
      ]
    );

    console.log(`Employee added with empid: ${empid}`);
  } catch (error) {
    console.error('Error adding employee:', error);
    redirectPath = `/userscreens/employee/addemployee?error=Failed%20to%20add%20employee:%20${encodeURIComponent(error.message)}`;
    return { error: `Failed to add employee: ${error.message}` };
  }

  // Redirect to the employee list page on success
  return redirect(redirectPath);
}
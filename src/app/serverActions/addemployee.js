'use server';

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
  const phoneNumber = formData.get('phoneNumber') || null;
  const mobileNumber = formData.get('mobileNumber') || null;
  const dob = formData.get('dob') || null;
  const hireDate = formData.get('hireDate');

  // Get the JWT token from cookies
  const cookieStore = cookies();
  const token = cookieStore.get('jwt_token')?.value;

  if (!token) {
    console.log('Redirecting: No token found');
    return redirect(`/homepage/${currentRole}/employee/addemployee?error=No%20token%20found.%20Please%20log%20in.`);
  }

  // Decode the token to get the admin's roleid and orgid
  const decoded = decodeJwt(token);
  if (!decoded || !decoded.roleid) {
    console.log('Redirecting: Invalid token or roleid not found');
    return redirect(`/homepage/${currentRole}/employee/addemployee?error=Invalid%20token%20or%20roleid%20not%20found.`);
  }

  const adminRoleId = decoded.roleid;

  // Fetch the orgid from org_role_table using the admin's roleid
  let orgid;
  try {
    const pool = await DBconnection();
    const [roleRows] = await pool.query(
      'SELECT orgid FROM org_role_table WHERE roleid = ? AND isadmin = 1 LIMIT 1',
      [adminRoleId]
    );

    if (!roleRows || roleRows.length === 0) {
      console.log('Redirecting: Admin role not found or not an admin');
      return redirect(`/homepage/${currentRole}/employee/addemployee?error=Admin%20role%20not%20found%20or%20not%20an%20admin.`);
    }

    orgid = roleRows[0].orgid;
  } catch (error) {
    console.error('Error fetching orgid:', error);
    return redirect(`/homepage/${currentRole}/employee/addemployee?error=Failed%20to%20fetch%20organization%20ID:%20${encodeURIComponent(error.message)}`);
  }

  // Validation for required fields
  if (!empFstName || empFstName.trim() === '') {
    console.log('Redirecting: First name is required');
    return redirect(`/homepage/${currentRole}/employee/addemployee?error=First%20name%20is%20required.`);
  }
  if (!empLastName || empLastName.trim() === '') {
    console.log('Redirecting: Last name is required');
    return redirect(`/homepage/${currentRole}/employee/addemployee?error=Last%20name%20is%20required.`);
  }
  if (!email || email.trim() === '') {
    console.log('Redirecting: Email is required');
    return redirect(`/homepage/${currentRole}/employee/addemployee?error=Email%20is%20required.`);
  }
  if (!roleid) {
    console.log('Redirecting: Role is required');
    return redirect(`/homepage/${currentRole}/employee/addemployee?error=Role%20is%20required.`);
  }
  if (!hireDate) {
    console.log('Redirecting: Hire date is required');
    return redirect(`/homepage/${currentRole}/employee/addemployee?error=Hire%20date%20is%20required.`);
  }

  let redirectPath = `/homepage/${currentRole}/employee`;
  try {
    const pool = await DBconnection();

    // Check if email already exists (email is UNIQUE in C_EMP)
    const [existingEmail] = await pool.query(
      'SELECT empid FROM C_EMP WHERE email = ?',
      [email]
    );
    if (existingEmail.length > 0) {
      console.log('Redirecting: Email already exists');
      return redirect(`/homepage/${currentRole}/employee/addemployee?error=Email%20already%20exists.`);
    }

    // Get the current number of records in C_EMP and add 1 for empid
    const [countResult] = await pool.query('SELECT COUNT(*) AS count FROM C_EMP');
    const empCount = countResult[0].count;
    const empnid="emp_"
    const empid = empnid+String(empCount + 1); // Convert to string since empid is varchar(255)

    // Insert into C_EMP table
    await pool.query(
      `INSERT INTO C_EMP (
        empid, orgid, EMP_FST_NAME, EMP_MID_NAME, EMP_LAST_NAME, EMP_PREF_NAME, email, 
        roleid, GENDER, PHONE_NUMBER, MOBILE_NUMBER, DOB, HIRE, CREATED_BY, 
        LAST_UPDATED_BY, MODIFICATION_NUM
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        empid, orgid, empFstName, empMidName, empLastName, empPrefName, email,
        roleid, gender, phoneNumber, mobileNumber, dob, hireDate, 'system',
        'system', 1
      ]
    );

  } catch (error) {
    console.error('Error adding employee:', error);
    redirectPath = `/homepage/${currentRole}/employee/addemployee?error=Failed%20to%20add%20employee:%20${encodeURIComponent(error.message)}`;
  }

  console.log(`Redirecting to: ${redirectPath}`);
  redirect(redirectPath);
}
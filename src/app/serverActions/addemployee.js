"use server";

import DBconnection from "../utils/config/db";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { assignLeaves } from '@/app/serverActions/Employee/overview';

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
  const superior = formData.get('superior') || null;

  const cookieStore = cookies();
  const token = cookieStore.get('jwt_token')?.value;

  if (!token) {
    console.log('Redirecting: No token found');
    return { error: 'No token found. Please log in.' };
  }

  const decoded = decodeJwt(token);
  if (!decoded || !decoded.orgid) {
    console.log('Redirecting: Invalid token or orgid not found');
    return { error: 'Invalid token or orgid not found.' };
  }

  const orgid = decoded.orgid;

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

    const [existingEmail] = await pool.query(
      'SELECT empid FROM C_EMP WHERE email = ?',
      [email]
    );
    if (existingEmail.length > 0) {
      console.log('Redirecting: Email already exists');
      return { error: 'Email already exists.' };
    }

    if (superior) {
      const [existingSuperior] = await pool.query(
        'SELECT empid FROM C_EMP WHERE empid = ? AND orgid = ?',
        [superior, orgid]
      );
      if (existingSuperior.length === 0) {
        return { error: 'Selected superior does not exist in this organization.' };
      }
    }

    const [countResult] = await pool.query('SELECT COUNT(*) AS count FROM C_EMP WHERE orgid = ?', [orgid]);
    const empCount = countResult[0].count;
    const empid = `emp_${orgid}_${empCount + 1}`;

    await pool.query(
      `INSERT INTO C_EMP (
        empid, orgid, EMP_FST_NAME, EMP_MID_NAME, EMP_LAST_NAME, EMP_PREF_NAME, email,
        roleid, GENDER, MOBILE_NUMBER, DOB, HIRE, LAST_WORK_DATE, TERMINATED_DATE,
        REJOIN_DATE, CREATED_BY, LAST_UPDATED_BY, superior
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        empid, orgid, empFstName, empMidName, empLastName, empPrefName, email,
        roleid, gender, mobileNumber, dob, hireDate, null, null, null, 'system', 'system', superior
      ]
    );

    const leaves = {};
    for (let [key, value] of formData.entries()) {
      if (key.startsWith('leaves[') && key.endsWith(']')) {
        const leaveid = key.match(/\[(.*?)\]/)[1];
        leaves[leaveid] = parseFloat(value) || 0;
      }
    }

    const [validLeaveTypes] = await pool.execute(
      'SELECT id FROM generic_values WHERE g_id = ? AND orgid = ? AND isactive = 1',
      [1, orgid]
    );
    const validLeaveIds = validLeaveTypes.map(leave => leave.id.toString());

    for (const [leaveid, noofleaves] of Object.entries(leaves)) {
      if (noofleaves >= 0 && validLeaveIds.includes(leaveid)) {
        await assignLeaves(empid, leaveid, noofleaves, orgid);
      }
    }

    console.log(`Employee added with empid: ${empid}`);
    redirectPath = `/userscreens/employee?success=Employee%20added%20successfully`;
  } catch (error) {
    console.error('Error adding employee:', error);
    redirectPath = `/userscreens/employee/addemployee?error=Failed%20to%20add%20employee:%20${encodeURIComponent(error.message)}`;
    return { error: `Failed to add employee: ${error.message}` };
  }

  return redirect(redirectPath);
}
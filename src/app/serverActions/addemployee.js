"use server";

import DBconnection from "../utils/config/db";
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
  const empFstName = formData.get('empFstName') || '';
  const empMidName = formData.get('empMidName') || null;
  const empLastName = formData.get('empLastName') || '';
  const empPrefName = formData.get('empPrefName') || null;
  const email = formData.get('email') || '';
  const roleids = [...new Set(formData.getAll('roleids'))]; // Deduplicate roleids
  const gender = formData.get('gender') || null;
  const mobileNumber = formData.get('mobileNumber') || null;
  const phoneNumber = formData.get('phoneNumber') || null;
  const dob = formData.get('dob') || null;
  const hireDate = formData.get('hireDate') || null;
  const ssn = formData.get('ssn') || null;
  const linkedinUrl = formData.get('linkedinUrl') || null;
  const status = formData.get('status') || 'ACTIVE';
  const jobTitle = formData.get('jobTitle') || null;
  const payFrequency = formData.get('payFrequency') || null;
  const deptId = formData.get('deptId') || null;
  const workCompClass = formData.get('workCompClass') || null;
  const superior = formData.get('superior') || null;
  const workAddrLine1 = formData.get('workAddrLine1') || '';
  const workAddrLine2 = formData.get('workAddrLine2') || null;
  const workAddrLine3 = formData.get('workAddrLine3') || null;
  const workCity = formData.get('workCity') || '';
  const workStateId = formData.get('workStateId') || null;
  const workStateNameCustom = formData.get('workStateNameCustom') || null;
  const workCountryId = formData.get('workCountryId') || 185;
  const workPostalCode = formData.get('workPostalCode') || '';
  const homeAddrLine1 = formData.get('homeAddrLine1') || '';
  const homeAddrLine2 = formData.get('homeAddrLine2') || null;
  const homeAddrLine3 = formData.get('homeAddrLine3') || null;
  const homeCity = formData.get('homeCity') || '';
  const homeStateId = formData.get('homeStateId') || null;
  const homeStateNameCustom = formData.get('homeStateNameCustom') || null;
  const homeCountryId = formData.get('homeCountryId') || 185;
  const homePostalCode = formData.get('homePostalCode') || '';
  const emergCnctName = formData.get('emergCnctName') || null;
  const emergCnctPhoneNumber = formData.get('emergCnctPhoneNumber') || null;
  const emergCnctEmail = formData.get('emergCnctEmail') || null;
  const emergCnctAddrLine1 = formData.get('emergCnctAddrLine1') || null;
  const emergCnctAddrLine2 = formData.get('emergCnctAddrLine2') || null;
  const emergCnctAddrLine3 = formData.get('emergCnctAddrLine3') || null;
  const emergCnctCity = formData.get('emergCnctCity') || null;
  const emergCnctStateId = formData.get('emergCnctStateId') || null;
  const emergCnctStateNameCustom = formData.get('emergCnctStateNameCustom') || null;
  const emergCnctCountryId = formData.get('emergCnctCountryId') || null;
  const emergCnctPostalCode = formData.get('emergCnctPostalCode') || null;
  const adminEmpFlag = formData.get('adminEmpFlag') ? 1 : 0;
  const superUserFlag = formData.get('superUserFlag') ? 1 : 0;

  const cookieStore = await cookies();
  const token = cookieStore.get('jwt_token')?.value;

  if (!token) return { error: 'No token found. Please log in.' };
  const decoded = decodeJwt(token);
  if (!decoded || !decoded.orgid) return { error: 'Invalid token or orgid not found.' };

  const orgid = decoded.orgid;

  // Validation
  if (!empFstName.trim()) return { error: 'First name is required.' };
  if (!empLastName.trim()) return { error: 'Last name is required.' };
  if (!email.trim()) return { error: 'Email is required.' };
  if (roleids.length === 0) return { error: 'At least one role is required.' };
  if (!hireDate) return { error: 'Hire date is required.' };
  if (!status) return { error: 'Status is required.' };

  let empid = null;

  try {
    const pool = await DBconnection();

    // Check if email already exists
    const [existingEmail] = await pool.query(
      'SELECT empid FROM C_EMP WHERE email = ? AND orgid = ?',
      [email, orgid]
    );
    if (existingEmail.length > 0) {
      return { error: 'Email already exists.' };
    }

    // Validate superior if provided
    if (superior) {
      const [existingSuperior] = await pool.query(
        'SELECT empid FROM C_EMP WHERE empid = ? AND orgid = ?',
        [superior, orgid]
      );
      if (existingSuperior.length === 0) {
        return { error: 'Selected superior does not exist in this organization.' };
      }
    }

    // Validate roles
    for (const roleid of roleids) {
      const [existingRole] = await pool.query(
        'SELECT roleid FROM org_role_table WHERE roleid = ? AND orgid = ?',
        [roleid, orgid]
      );
      if (existingRole.length === 0) {
        return { error: `Invalid role ID: ${roleid}` };
      }
    }

    // Get department name if department ID is provided
    let deptName = null;
    if (deptId) {
      const [deptResult] = await pool.query(
        'SELECT name FROM org_departments WHERE id = ? AND orgid = ? AND isactive = 1',
        [deptId, orgid]
      );
      if (deptResult.length > 0) {
        deptName = deptResult[0].name;
      } else {
        return { error: 'Invalid department ID.' };
      }
    }

    // Generate employee ID
    const [countResult] = await pool.query('SELECT COUNT(*) AS count FROM C_EMP WHERE orgid = ?', [orgid]);
    const empCount = countResult[0].count;
    empid = `${orgid}_${empCount + 1}`;

    // Define insert columns and values for C_EMP
    const insertColumns = [
      'empid', 'orgid', 'EMP_FST_NAME', 'EMP_MID_NAME', 'EMP_LAST_NAME', 'EMP_PREF_NAME', 'email',
      'GENDER', 'MOBILE_NUMBER', 'DOB', 'HIRE', 'LAST_WORK_DATE',
      'TERMINATED_DATE', 'REJOIN_DATE', 'CREATED_BY', 'LAST_UPDATED_BY', 'superior', 
      'SSN', 'STATUS', 'PHONE_NUMBER', 'LINKEDIN_URL', 'ADMIN_EMP_FLAG',
      'SUPER_USER_FLAG', 'JOB_TITLE', 'PAY_FREQUENCY', 'WORK_ADDR_LINE1', 'WORK_ADDR_LINE2',
      'WORK_ADDR_LINE3', 'WORK_CITY', 'WORK_STATE_ID', 'WORK_STATE_NAME_CUSTOM',
      'WORK_COUNTRY_ID', 'WORK_POSTAL_CODE', 'HOME_ADDR_LINE1', 'HOME_ADDR_LINE2',
      'HOME_ADDR_LINE3', 'HOME_CITY', 'HOME_STATE_ID', 'HOME_STATE_NAME_CUSTOM',
      'HOME_COUNTRY_ID', 'HOME_POSTAL_CODE', 'DEPT_ID', 'DEPT_NAME', 'WORK_COMP_CLASS',
      'EMERG_CNCT_NAME', 'EMERG_CNCT_PHONE_NUMBER', 'EMERG_CNCT_EMAIL',
      'EMERG_CNCT_ADDR_LINE1', 'EMERG_CNCT_ADDR_LINE2', 'EMERG_CNCT_ADDR_LINE3',
      'EMERG_CNCT_CITY', 'EMERG_CNCT_STATE_ID', 'EMERG_CNCT_STATE_NAME_CUSTOM',
      'EMERG_CNCT_COUNTRY_ID', 'EMERG_CNCT_POSTAL_CODE', 'MODIFICATION_NUM'
    ];

    const values = [
      empid, orgid, empFstName, empMidName, empLastName, empPrefName, email,
      gender, mobileNumber, dob, hireDate, null, null, null, 
      'system', 'system', superior, ssn, status, phoneNumber, linkedinUrl, 
      adminEmpFlag, superUserFlag, jobTitle, payFrequency, workAddrLine1, 
      workAddrLine2, workAddrLine3, workCity, workStateId, workStateNameCustom, 
      workCountryId, workPostalCode, homeAddrLine1, homeAddrLine2, homeAddrLine3, 
      homeCity, homeStateId, homeStateNameCustom, homeCountryId, homePostalCode, 
      deptId, deptName, workCompClass, emergCnctName, emergCnctPhoneNumber, 
      emergCnctEmail, emergCnctAddrLine1, emergCnctAddrLine2, emergCnctAddrLine3, 
      emergCnctCity, emergCnctStateId, emergCnctStateNameCustom, emergCnctCountryId, 
      emergCnctPostalCode, 1
    ];

    if (values.length !== insertColumns.length) {
      console.error("Mismatch: values length =", values.length, "columns length =", insertColumns.length);
      return { error: 'Internal error: column count mismatch' };
    }

    const placeholders = values.map(() => '?').join(', ');
    
    // Insert employee into C_EMP
    await pool.query(
      `INSERT INTO C_EMP (${insertColumns.join(', ')}) VALUES (${placeholders})`,
      values
    );

    console.log(`Employee ${empid} inserted successfully`);

    // Insert roles into emp_role_assign with ON DUPLICATE KEY UPDATE
    for (const roleid of roleids) {
      await pool.query(
        `INSERT INTO emp_role_assign (empid, orgid, roleid) 
         VALUES (?, ?, ?) 
         ON DUPLICATE KEY UPDATE roleid = roleid`,
        [empid, orgid, roleid]
      );
      console.log(`Assigned role ${roleid} to employee ${empid}`);
    }

    // Process leaves
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

    const leaveAssignmentPromises = [];
    for (const [leaveid, noofleaves] of Object.entries(leaves)) {
      if (noofleaves >= 0 && validLeaveIds.includes(leaveid)) {
        leaveAssignmentPromises.push(
          assignLeaves(empid, leaveid, noofleaves, orgid)
        );
      }
    }

    if (leaveAssignmentPromises.length > 0) {
      await Promise.all(leaveAssignmentPromises);
      console.log('All leave assignments completed successfully');
    }

    // Success
    return { success: true };
    
  } catch (error) {
    console.error('Error adding employee, roles, or assigning leaves:', error);
    
    if (empid) {
      try {
        const pool = await DBconnection();
        const [empExists] = await pool.query(
          'SELECT empid FROM C_EMP WHERE empid = ? AND orgid = ?',
          [empid, orgid]
        );
        
        if (empExists.length > 0) {
          return { error: `Employee added but some roles or leaves failed to assign: ${error.message}` };
        } else {
          return { error: `Failed to add employee: ${error.message}` };
        }
      } catch (checkError) {
        return { error: `Failed to add employee: ${error.message}` };
      }
    } else {
      return { error: `Failed to add employee: ${error.message}` };
    }
  }
}
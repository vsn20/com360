'use server';

import DBconnection from '@/app/utils/config/db'; // 🔹 Imported MetaDBconnection
import { cookies } from 'next/headers';
import fs from 'fs/promises';
import path from 'path';
import { MetaDBconnection } from '@/app/utils/config/db';

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

const formatDate = (date) => {
    if (!date || isNaN(new Date(date))) return '';
    const d = new Date(date);
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${month}/${day}/${d.getFullYear()}`;
  };

const formatDateToInput = (date) => {
  if (!date || isNaN(new Date(date))) return '';
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// 🔹 HELPER: Sync Employee to Meta Database
// 🔹 HELPER: Sync Employee to Meta Database
// 🔹 HELPER: Sync Employee to Meta Database
async function syncEmployeeToMeta(empid, orgid, tenantPool, currentUsername) {
  let metaConnection;
  try {
    console.log(`\n--- 🚀 STARTING META SYNC ---`);
    console.log(`Target EmpID: ${empid}, OrgID: ${orgid}`);
    console.log(`Executed By: ${currentUsername}`);

    // Get Meta Pool from db.js export
    const metaPool = MetaDBconnection(); 
    metaConnection = await metaPool.getConnection();
    console.log(`✅ STEP 1: Connected to Meta DB`);

    // 1. Get Current User's Plan Number and OrgID from Meta DB
    console.log(`🔍 STEP 2: Looking up admin '${currentUsername}' in Meta DB...`);
    
    const [currentUserRows] = await metaConnection.query(
      `SELECT plan_number, org_id FROM C_EMP WHERE username = ? OR email = ?`,
      [currentUsername, currentUsername]
    );

    console.log(`📄 STEP 2 Result: Found ${currentUserRows.length} rows`);

    if (currentUserRows.length === 0) {
      console.error(`❌ FAILURE: Admin user '${currentUsername}' not found in Meta DB.`);
      return; 
    }

    const { plan_number, org_id: metaOrgId } = currentUserRows[0];
    console.log(`✅ Admin Details Found -> OrgID: ${metaOrgId}, Plan: ${plan_number}`);

    // 2. Get Target Employee Data from Tenant DB
    console.log(`🔍 STEP 3: Fetching new employee data from Tenant DB...`);
    
    const [empRows] = await tenantPool.query(
      `SELECT EMP_FST_NAME, EMP_MID_NAME, EMP_LAST_NAME, email, STATUS 
       FROM C_EMP WHERE empid = ? AND orgid = ?`,
      [empid, orgid]
    );

    if (empRows.length === 0) {
      console.error('❌ FAILURE: Target employee not found in Tenant DB.');
      return;
    }

    const targetEmp = empRows[0];
    console.log(`✅ Employee Found: ${targetEmp.EMP_FST_NAME} (${targetEmp.email})`);
    
    // 3. Resolve Status ID to 'Y' or 'N'
    let isActive = 'Y';
    // if (targetEmp.STATUS) {
    //  if (targetEmp.STATUS=="ACTIVE"||targetEmp.STATUS=="Active"||targetEmp.STATUS=="active") {
    //     isActive = 'Y';
    //  }
    // }
    console.log(`✅ Status Resolved: ${isActive}`);

    // 4. Upsert into Meta C_EMP
    console.log(`🚀 STEP 4: Attempting INSERT into Meta C_EMP...`);
    console.log(`Payload:`, {
        first: targetEmp.EMP_FST_NAME,
        email: targetEmp.email,
        username: targetEmp.email, // Using email as username
        org: metaOrgId,
        plan: plan_number
    });

    // 🔴 CRITICAL FIX: The INSERT statement now includes 'username'
    await metaConnection.query(
      `INSERT INTO C_EMP 
        (emp_first_name, emp_middle_name, org_id, plan_number, email, active, username)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE 
        emp_first_name = VALUES(emp_first_name),
        emp_middle_name = VALUES(emp_middle_name),
        org_id = VALUES(org_id),
        plan_number = VALUES(plan_number),
        active = VALUES(active),
        username = VALUES(username)`, 
      [
        targetEmp.EMP_FST_NAME,
        targetEmp.EMP_MID_NAME || null,
        metaOrgId,   
        plan_number, 
        targetEmp.email,
        isActive,
        targetEmp.email // 👈 THIS IS REQUIRED because username cannot be NULL
      ]
    );

    console.log(`✅ SUCCESS: Meta Sync Completed for ${targetEmp.email}`);
    console.log(`--- 🏁 END META SYNC ---\n`);

  } catch (error) {
    console.error('❌ CRITICAL ERROR in Meta Sync:', error);
    if (error.sqlMessage) console.error('SQL Error:', error.sqlMessage);
  } finally {
    if (metaConnection) metaConnection.release();
  }
}
export async function updateEmployee(prevState, formData) {
  try {
    const empid = formData.get('empid');
    let orgid = formData.get('orgid');
    const section = formData.get('section');

    console.log('updateEmployee FormData:', {
      empid,
      orgid,
      orgidType: typeof orgid,
      section,
      formData: Object.fromEntries(formData),
    });

    const cookieStore = await cookies();
    const token = cookieStore.get('jwt_token')?.value;

    if (!token) {
      console.log('No token found');
      return { error: 'No token found. Please log in.' };
    }

    const decoded = decodeJwt(token);
    if (!decoded || !decoded.orgid) {
      console.log('Invalid token or orgid not found in JWT');
      return { error: 'Invalid token or orgid not found.' };
    }

    const jwtOrgId = decoded.orgid;
    const currentUsername = decoded.username; // 🔹 Needed for Meta Sync

    console.log(`JWT orgid: ${jwtOrgId}, type: ${typeof jwtOrgId}`);

    const pool = await DBconnection();
    console.log('MySQL connection pool acquired');

    // Fetch orgid from C_EMP if missing
    if (!orgid || orgid === '') {
      console.log('orgid missing or empty in FormData, fetching from C_EMP for empid:', empid);
      const [employee] = await pool.execute('SELECT orgid FROM C_EMP WHERE empid = ?', [empid]);
      if (employee.length === 0) {
        console.log('Employee not found');
        return { error: 'Employee not found.' };
      }
      orgid = String(employee[0].orgid);
      console.log(`Fetched orgid from C_EMP: ${orgid}, type: ${typeof orgid}`);
    }

    // Validate orgid
    if (!orgid || orgid === '' || String(orgid) !== String(jwtOrgId)) {
      console.log(`Invalid or mismatched orgid. FormData orgid: ${orgid} (${typeof orgid}), JWT orgid: ${jwtOrgId} (${typeof jwtOrgId})`);
      return { error: 'Organization ID is missing or invalid.' };
    }

    // Validate empid
    if (!empid) {
      console.log('empid is missing');
      return { error: 'Employee ID is required.' };
    }

    const [existing] = await pool.execute('SELECT empid FROM C_EMP WHERE empid = ? AND orgid = ?', [empid, orgid]);
    if (existing.length === 0) {
      console.log('Employee not found');
      return { error: 'Employee not found.' };
    }

    let affectedRows = 0;

    if (section === 'personal') {
      const empFstName = formData.get('empFstName')?.trim();
      const empMidName = formData.get('empMidName')?.trim() || null;
      const empLastName = formData.get('empLastName')?.trim();
      const empPrefName = formData.get('empPrefName')?.trim() || null;
      const email = formData.get('email')?.trim();
      const gender = formData.get('gender') || null;
      const mobileNumber = formData.get('mobileNumber')?.trim() || null;
      const phoneNumber = formData.get('phoneNumber')?.trim() || null;
      const dob = formData.get('dob') || null;
      const ssn = formData.get('ssn')?.trim() || null;
      const linkedinUrl = formData.get('linkedinUrl')?.trim() || null;
      const employee_number = formData.get('employee_number')?.trim() || null;

      console.log('Personal details:', {
        empFstName, empMidName, empLastName, empPrefName, email, gender,
        mobileNumber, phoneNumber, dob, ssn, linkedinUrl,
      });

      if (!empFstName) {
        console.log('First name is missing');
        return { error: 'First name is required.' };
      }
      if (!empLastName) {
        console.log('Last name is missing');
        return { error: 'Last name is required.' };
      }
      if (!email) {
        console.log('Email is missing');
        return { error: 'Email is required.' };
      }

      // Validate and format employee_number
      let formattedEmployeeNumber = null;
      if (employee_number) {
        if (!/^\d{1,5}$/.test(employee_number)) {
          console.log('Invalid employee number format');
          return { error: 'Employee number must be 1-5 digits.' };
        }
        formattedEmployeeNumber = employee_number.padStart(5, '0');
        // Check uniqueness within orgid
        const [empNumCheck] = await pool.execute(
          'SELECT empid FROM C_EMP WHERE employee_number = ? AND orgid = ? AND empid != ?',
          [formattedEmployeeNumber, orgid, empid]
        );
        if (empNumCheck.length > 0) {
          console.log('Employee number already in use');
          return { error: 'Employee number is already in use by another employee in this organization.' };
        }
      }

      // Check for email uniqueness (excluding current employee)
      const [emailCheck] = await pool.execute(
        'SELECT empid FROM C_EMP WHERE email = ? AND orgid = ? AND empid != ?',
        [email, orgid, empid]
      );
      if (emailCheck.length > 0) {
        console.log('Email already in use');
        return { error: 'Email is already in use by another employee.' };
      }

      const [result] = await pool.query(
        `UPDATE C_EMP 
         SET 
           EMP_FST_NAME = ?, 
           EMP_MID_NAME = ?, 
           EMP_LAST_NAME = ?, 
           EMP_PREF_NAME = ?, 
           email = ?, 
           GENDER = ?, 
           MOBILE_NUMBER = ?, 
           PHONE_NUMBER = ?, 
           DOB = ?, 
           SSN = ?, 
           LINKEDIN_URL = ?, 
           employee_number = ?, 
           LAST_UPDATED_DATE = CURRENT_TIMESTAMP, 
           LAST_UPDATED_BY = ? 
         WHERE empid = ? AND orgid = ?`,
        [
          empFstName, empMidName, empLastName, empPrefName, email,
          gender, mobileNumber, phoneNumber, dob, ssn, linkedinUrl,
          formattedEmployeeNumber,
          'system', empid, orgid,
        ]
      );
      
      const [updat_email_in_cusers] = await pool.query(
        `update C_USER SET email=? where empid=?`, [email, empid]
      );

      affectedRows += result.affectedRows;
      console.log(`Personal details update result: ${result.affectedRows} rows affected for empid ${empid}`);

      // 🔹 TRIGGER META SYNC (Personal Details change)
      if (affectedRows > 0) {
        await syncEmployeeToMeta(empid, orgid, pool, currentUsername);
      }

    } else if (section === 'employment') {
      // Handle both single roleid and multiple roleids
      const roleids = formData.getAll('roleids').length > 0 
        ? [...new Set(formData.getAll('roleids'))] // Deduplicate if multiple
        : [formData.get('roleid')].filter(Boolean); // Use single roleid if provided
      const hireDate = formData.get('hireDate') || null;
      const lastWorkDate = formData.get('lastWorkDate') || null;
      const terminatedDate = formData.get('terminatedDate') || null;
      const rejoinDate = formData.get('rejoinDate') || null;
      const superior = formData.get('superior') || null;
      const status = formData.get('status') || null;
      const jobTitle = formData.get('jobTitle') || null;
      const payFrequency = formData.get('payFrequency') || null;
      const deptId = formData.get('deptId') || null;
      const deptName = formData.get('deptName')?.trim() || null;
      const workCompClass = formData.get('workCompClass') || null;
      const suborgid = formData.get('suborgid') || null;
      const employment_type = formData.get('employment_type') || null;

      console.log('Employment details:', {
        roleids, hireDate, lastWorkDate, terminatedDate, rejoinDate, superior,
        status, jobTitle, payFrequency, deptId, deptName, workCompClass,
      });

      if (roleids.length === 0) {
        console.log('No roles provided');
        return { error: 'At least one role is required.' };
      }
      if (!hireDate) {
        console.log('Hire date is missing');
        return { error: 'Hire date is required.' };
      }
      if (!status) {
        console.log('Status is missing');
        return { error: 'Status is required.' };
      }

      // Validate roles
      for (const roleid of roleids) {
        const [role] = await pool.execute(
          'SELECT roleid FROM C_ORG_ROLE_TABLE WHERE roleid = ? AND orgid = ? AND is_active = 1',
          [roleid, orgid]
        );
        if (role.length === 0) {
          console.log(`Invalid or inactive role selected: ${roleid}`);
          return { error: `Selected role ID ${roleid} is invalid or inactive.` };
        }
      }

      // Validate superior
      if (superior) {
        const [existingSuperior] = await pool.execute(
          'SELECT empid FROM C_EMP WHERE empid = ? AND orgid = ? AND LAST_WORK_DATE IS NULL AND TERMINATED_DATE IS NULL',
          [superior, orgid]
        );
        if (existingSuperior.length === 0) {
          console.log('Invalid superior selected');
          return { error: 'Selected superior is invalid or not active.' };
        }
        if (empid === superior) {
          console.log('Self-assignment as superior');
          return { error: 'Employee cannot be their own superior.' };
        }
      }

      // Validate status
      if (status) {
        const [statusCheck] = await pool.execute(
          'SELECT id FROM C_GENERIC_VALUES WHERE g_id = 3 AND Name = ? AND orgid = ? AND isactive = 1',
          [status, orgid]
        );
        if (statusCheck.length === 0) {
          console.log('Invalid status selected');
          return { error: 'Selected status is invalid or inactive.' };
        }
      }

      // Validate job title
      if (jobTitle) {
        const [jobTitleCheck] = await pool.execute(
          'SELECT job_title FROM C_ORG_JOBTITLES WHERE job_title_id = ? AND orgid = ? AND is_active = 1',
          [jobTitle, orgid]
        );
        if (jobTitleCheck.length === 0) {
          console.log('Invalid job title selected');
          return { error: 'Selected job title is invalid or inactive.' };
        }
      }

      // Validate pay frequency
      if (payFrequency) {
        const [payFrequencyCheck] = await pool.execute(
          'SELECT id FROM C_GENERIC_VALUES WHERE g_id = 4 AND Name = ? AND orgid = ? AND isactive = 1',
          [payFrequency, orgid]
        );
        if (payFrequencyCheck.length === 0) {
          console.log('Invalid pay frequency selected');
          return { error: 'Selected pay frequency is invalid or inactive.' };
        }
      }

      // Validate department and fetch DEPT_NAME if deptId is provided
      let finalDeptName = deptName;
      if (deptId) {
        const [deptCheck] = await pool.execute(
          'SELECT id, name FROM C_ORG_DEPARTMENTS WHERE id = ? AND orgid = ? AND isactive = 1',
          [deptId, orgid]
        );
        if (deptCheck.length === 0) {
          console.log('Invalid department selected:', deptId);
          return { error: 'Selected department is invalid or inactive.' };
        }
        finalDeptName = deptCheck[0].name; // Override with name from C_ORG_DEPARTMENTS
      } else {
        finalDeptName = null; // Clear DEPT_NAME if deptId is not provided
      }
    if(suborgid) 
    {
         const [suborgCheck] = await pool.execute(
         'SELECT suborgid FROM C_SUB_ORG WHERE suborgid = ? AND orgid = ? AND isstatus = 1',
        [suborgid, orgid]
      );
      if(suborgCheck.length === 0) 
      {
        console.log('Invalid suborganization selected');
        return { error: 'Selected suborganization is invalid or inactive.' };
      }
   }
      if (employment_type) {
        const [empTypeCheck] = await pool.execute(
          'SELECT id FROM C_GENERIC_VALUES WHERE id = ? AND g_id = 27 AND orgid = ? AND isactive = 1',
          [employment_type, orgid]
        );
        if (empTypeCheck.length === 0) {
          console.log('Invalid employment type selected');
          return { error: 'Selected employment type is invalid or inactive.' };
        }
      }

      // Update C_EMP with the first roleid (for backward compatibility with existing schema)
      const primaryRoleId = roleids[0] || null;
      const [result] = await pool.query(
        `UPDATE C_EMP SET         
           HIRE = ?, 
           LAST_WORK_DATE = ?, 
           TERMINATED_DATE = ?, 
           REJOIN_DATE = ?, 
           superior = ?, 
           STATUS = ?, 
           JOB_TITLE = ?, 
           PAY_FREQUENCY = ?, 
           DEPT_ID = ?, 
           DEPT_NAME = ?, 
           WORK_COMP_CLASS = ?,
           suborgid = ?, 
           employment_type = ?, 
           LAST_UPDATED_DATE = CURRENT_TIMESTAMP, 
           LAST_UPDATED_BY = ? 
         WHERE empid = ? AND orgid = ?`,
        [
           hireDate, lastWorkDate, terminatedDate, rejoinDate, superior,
          status, jobTitle, payFrequency, deptId, finalDeptName, workCompClass,suborgid,
          employment_type,
          'system', empid, orgid,
        ]
      );

      affectedRows += result.affectedRows;
      console.log(`Employment details update result: ${result.affectedRows} rows affected for empid ${empid}, deptId: ${deptId}, deptName: ${finalDeptName}`);

      // Update role assignments in C_EMP_ROLE_ASSIGN
      // First, remove existing role assignments
      const [deleteResult] = await pool.query(
        'DELETE FROM C_EMP_ROLE_ASSIGN WHERE empid = ? AND orgid = ?',
        [empid, orgid]
      );
      console.log(`Removed ${deleteResult.affectedRows} existing role assignments for empid ${empid}`);

      // Insert new role assignments
      for (const roleid of roleids) {
        const [roleAssignResult] = await pool.query(
          `INSERT INTO C_EMP_ROLE_ASSIGN (empid, orgid, roleid) 
           VALUES (?, ?, ?) 
           ON DUPLICATE KEY UPDATE roleid = roleid`,
          [empid, orgid, roleid]
        );
        affectedRows += roleAssignResult.affectedRows;
        console.log(`Assigned role ${roleid} to employee ${empid}, affectedRows: ${roleAssignResult.affectedRows}`);
      }

      // 🔹 TRIGGER META SYNC (Employment details/Status change)
      if (affectedRows > 0) {
        await syncEmployeeToMeta(empid, orgid, pool, currentUsername);
      }

    } else if (section === 'leaves') {
      const leaves = {};
      for (let [key, value] of formData.entries()) {
        if (key.startsWith('leaves[') && key.endsWith(']')) {
          const leaveid = key.match(/\[(.*?)\]/)[1];
          leaves[leaveid] = parseFloat(value) || 0;
        }
      }

      console.log('Leave assignments:', leaves);

      if (Object.keys(leaves).length === 0) {
        console.log('No leaves provided');
        return { error: 'No leave assignments provided.' };
      }

      const [validLeaveTypes] = await pool.execute(
        'SELECT id FROM C_GENERIC_VALUES WHERE g_id = 1 AND orgid = ? AND isactive = 1',
        [orgid]
      );
      const validLeaveIds = validLeaveTypes.map(leave => String(leave.id));

      for (const [leaveid, noofleaves] of Object.entries(leaves)) {
        if (noofleaves < 0) {
          console.log(`Negative leaves for leaveid ${leaveid}`);
          return { error: `Number of leaves cannot be negative for leave type ${leaveid}.` };
        }
        if (!validLeaveIds.includes(leaveid)) {
          console.log(`Invalid leaveid ${leaveid}`);
          return { error: `Selected leave type ${leaveid} is invalid or inactive.` };
        }
        const result = await assignLeaves(empid, leaveid, noofleaves, orgid);
        if (result.error) {
          console.log(`Failed to assign leave ${leaveid}: ${result.error || 'Unknown error'}`);
          return { error: `Failed to assign leave ${leaveid}: ${result.error || 'Unknown error'}` };
        }
        affectedRows += result.affectedRows || 1;
      }
    } else if (section === 'workAddress') {
      const workAddrLine1 = formData.get('workAddrLine1')?.trim() || null;
      const workAddrLine2 = formData.get('workAddrLine2')?.trim() || null;
      const workAddrLine3 = formData.get('workAddrLine3')?.trim() || null;
      const workCity = formData.get('workCity')?.trim() || null;
      const workStateId = formData.get('workStateId') || null;
      const workStateNameCustom = formData.get('workStateNameCustom')?.trim() || null;
      const workCountryId = formData.get('workCountryId') || null;
      const workPostalCode = formData.get('workPostalCode')?.trim() || null;

      console.log('Work address details:', {
        workAddrLine1, workAddrLine2, workAddrLine3, workCity,
        workStateId, workStateNameCustom, workCountryId, workPostalCode,
      });

      // Validate country
      if (workCountryId) {
        const [countryCheck] = await pool.execute(
          'SELECT ID FROM C_COUNTRY WHERE ID = ? AND ACTIVE = 1',
          [workCountryId]
        );
        if (countryCheck.length === 0) {
          console.log('Invalid country selected');
          return { error: 'Selected country is invalid or inactive.' };
        }
      }

      // Validate state
      if (workStateId && workCountryId === '185') {
        const [stateCheck] = await pool.execute(
          'SELECT ID FROM C_STATE WHERE ID = ? AND ACTIVE = 1',
          [workStateId]
        );
        if (stateCheck.length === 0) {
          console.log('Invalid state selected');
          return { error: 'Selected state is invalid or inactive.' };
        }
      }

      const [result] = await pool.query(
        `UPDATE C_EMP 
         SET 
           WORK_ADDR_LINE1 = ?, 
           WORK_ADDR_LINE2 = ?, 
           WORK_ADDR_LINE3 = ?, 
           WORK_CITY = ?, 
           WORK_STATE_ID = ?, 
           WORK_STATE_NAME_CUSTOM = ?, 
           WORK_COUNTRY_ID = ?, 
           WORK_POSTAL_CODE = ?, 
           LAST_UPDATED_DATE = CURRENT_TIMESTAMP, 
           LAST_UPDATED_BY = ? 
         WHERE empid = ? AND orgid = ?`,
        [
          workAddrLine1, workAddrLine2, workAddrLine3, workCity,
          workStateId, workStateNameCustom, workCountryId, workPostalCode,
          'system', empid, orgid,
        ]
      );

      affectedRows += result.affectedRows;
      console.log(`Work address update result: ${result.affectedRows} rows affected for empid ${empid}`);
    } else if (section === 'homeAddress') {
      const homeAddrLine1 = formData.get('homeAddrLine1')?.trim() || null;
      const homeAddrLine2 = formData.get('homeAddrLine2')?.trim() || null;
      const homeAddrLine3 = formData.get('homeAddrLine3')?.trim() || null;
      const homeCity = formData.get('homeCity')?.trim() || null;
      const homeStateId = formData.get('homeStateId') || null;
      const homeStateNameCustom = formData.get('homeStateNameCustom')?.trim() || null;
      const homeCountryId = formData.get('homeCountryId') || null;
      const homePostalCode = formData.get('homePostalCode')?.trim() || null;

      console.log('Home address details:', {
        homeAddrLine1, homeAddrLine2, homeAddrLine3, homeCity,
        homeStateId, homeStateNameCustom, homeCountryId, homePostalCode,
      });

      // Validate country
      if (homeCountryId) {
        const [countryCheck] = await pool.execute(
          'SELECT ID FROM C_COUNTRY WHERE ID = ? AND ACTIVE = 1',
          [homeCountryId]
        );
        if (countryCheck.length === 0) {
          console.log('Invalid country selected');
          return { error: 'Selected country is invalid or inactive.' };
        }
      }

      // Validate state
      if (homeStateId && homeCountryId === '185') {
        const [stateCheck] = await pool.execute(
          'SELECT ID FROM C_STATE WHERE ID = ? AND ACTIVE = 1',
          [homeStateId]
        );
        if (stateCheck.length === 0) {
          console.log('Invalid state selected');
          return { error: 'Selected state is invalid or inactive.' };
        }
      }

      const [result] = await pool.query(
        `UPDATE C_EMP 
         SET 
           HOME_ADDR_LINE1 = ?, 
           HOME_ADDR_LINE2 = ?, 
           HOME_ADDR_LINE3 = ?, 
           HOME_CITY = ?, 
           HOME_STATE_ID = ?, 
           HOME_STATE_NAME_CUSTOM = ?, 
           HOME_COUNTRY_ID = ?, 
           HOME_POSTAL_CODE = ?, 
           LAST_UPDATED_DATE = CURRENT_TIMESTAMP, 
           LAST_UPDATED_BY = ? 
         WHERE empid = ? AND orgid = ?`,
        [
          homeAddrLine1, homeAddrLine2, homeAddrLine3, homeCity,
          homeStateId, homeStateNameCustom, homeCountryId, homePostalCode,
          'system', empid, orgid,
        ]
      );

      affectedRows += result.affectedRows;
      console.log(`Home address update result: ${result.affectedRows} rows affected for empid ${empid}`);
    } else if (section === 'emergencyContact') {
      const emergCnctName = formData.get('emergCnctName')?.trim() || null;
      const emergCnctPhoneNumber = formData.get('emergCnctPhoneNumber')?.trim() || null;
      const emergCnctEmail = formData.get('emergCnctEmail')?.trim() || null;
      const emergCnctAddrLine1 = formData.get('emergCnctAddrLine1')?.trim() || null;
      const emergCnctAddrLine2 = formData.get('emergCnctAddrLine2')?.trim() || null;
      const emergCnctAddrLine3 = formData.get('emergCnctAddrLine3')?.trim() || null;
      const emergCnctCity = formData.get('emergCnctCity')?.trim() || null;
      const emergCnctStateId = formData.get('emergCnctStateId') || null;
      const emergCnctStateNameCustom = formData.get('emergCnctStateNameCustom')?.trim() || null;
      const emergCnctCountryId = formData.get('emergCnctCountryId') || null;
      const emergCnctPostalCode = formData.get('emergCnctPostalCode')?.trim() || null;

      console.log('Emergency contact details:', {
        emergCnctName, emergCnctPhoneNumber, emergCnctEmail, emergCnctAddrLine1,
        emergCnctAddrLine2, emergCnctAddrLine3, emergCnctCity, emergCnctStateId,
        emergCnctStateNameCustom, emergCnctCountryId, emergCnctPostalCode,
      });

      // Validate country
      if (emergCnctCountryId) {
        const [countryCheck] = await pool.execute(
          'SELECT ID FROM C_COUNTRY WHERE ID = ? AND ACTIVE = 1',
          [emergCnctCountryId]
        );
        if (countryCheck.length === 0) {
          console.log('Invalid country selected');
          return { error: 'Selected country is invalid or inactive.' };
        }
      }

      // Validate state
      if (emergCnctStateId && emergCnctCountryId === '185') {
        const [stateCheck] = await pool.execute(
          'SELECT ID FROM C_STATE WHERE ID = ? AND ACTIVE = 1',
          [emergCnctStateId]
        );
        if (stateCheck.length === 0) {
          console.log('Invalid state selected');
          return { error: 'Selected state is invalid or inactive.' };
        }
      }

      const [result] = await pool.query(
        `UPDATE C_EMP 
         SET 
           EMERG_CNCT_NAME = ?, 
           EMERG_CNCT_PHONE_NUMBER = ?, 
           EMERG_CNCT_EMAIL = ?, 
           EMERG_CNCT_ADDR_LINE1 = ?, 
           EMERG_CNCT_ADDR_LINE2 = ?, 
           EMERG_CNCT_ADDR_LINE3 = ?, 
           EMERG_CNCT_CITY = ?, 
           EMERG_CNCT_STATE_ID = ?, 
           EMERG_CNCT_STATE_NAME_CUSTOM = ?, 
           EMERG_CNCT_COUNTRY_ID = ?, 
           EMERG_CNCT_POSTAL_CODE = ?, 
           LAST_UPDATED_DATE = CURRENT_TIMESTAMP, 
           LAST_UPDATED_BY = ? 
         WHERE empid = ? AND orgid = ?`,
        [
          emergCnctName, emergCnctPhoneNumber, emergCnctEmail, emergCnctAddrLine1,
          emergCnctAddrLine2, emergCnctAddrLine3, emergCnctCity, emergCnctStateId,
          emergCnctStateNameCustom, emergCnctCountryId, emergCnctPostalCode,
          'system', empid, orgid,
        ]
      );

      affectedRows += result.affectedRows;
      console.log(`Emergency contact update result: ${result.affectedRows} rows affected for empid ${empid}`);
    } else {
      console.log('Invalid section:', section);
      return { error: 'Invalid section specified.' };
    }

    if (affectedRows === 0) {
      console.log('No rows updated for empid:', empid);
      return { error: 'No changes were applied.' };
    }

    console.log(`Employee updated: empid ${empid}, section ${section}, affectedRows: ${affectedRows}`);
    return { success: true };
  } catch (error) {
    console.error('Error updating employee:', error.message);
    return { error: `Failed to update employee: ${error.message}` };
  }
}

export async function assignLeaves(empid, leaveid, noofleaves, orgid) {
  try {
    const cookieStore = cookies();
    const token = cookieStore.get('jwt_token')?.value;

    if (!token) {
      console.log('No token found');
      return { error: 'No token found. Please log in.' };
    }

    const decoded = decodeJwt(token);
    if (!decoded || !decoded.orgid) {
      console.log('Invalid token or orgid not found');
      return { error: 'Invalid token or orgid not found.' };
    }

    if (!orgid || String(orgid) !== String(decoded.orgid)) {
      console.log(`Invalid or mismatched orgid. Provided orgid: ${orgid} (${typeof orgid}), JWT orgid: ${decoded.orgid} (${typeof decoded.orgid})`);
      return { error: 'Organization ID is missing or invalid.' };
    }

    if (!empid) {
      console.log('empid is missing');
      return { error: 'Employee ID is required.' };
    }
    if (!leaveid) {
      console.log('leaveid is missing');
      return { error: 'Leave ID is required.' };
    }
    if (noofleaves < 0) {
      console.log('noofleaves is invalid');
      return { error: 'Number of leaves cannot be negative.' };
    }

    const pool = await DBconnection();
    console.log('MySQL connection pool acquired');

    const [leaveCheck] = await pool.execute(
      'SELECT id FROM C_GENERIC_VALUES WHERE id = ? AND g_id = 1 AND orgid = ? AND isactive = 1',
      [leaveid, orgid]
    );
    if (leaveCheck.length === 0) {
      console.log('Invalid or inactive leave type:', leaveid);
      return { error: 'Selected leave type is invalid or inactive.' };
    }

    const [existing] = await pool.execute(
      'SELECT id FROM C_EMPLOYEE_LEAVES_ASSIGN WHERE empid = ? AND leaveid = ? AND orgid = ? AND g_id = 1',
      [empid, leaveid, orgid]
    );
    let result;
    if (existing.length > 0) {
      [result] = await pool.query(
        'UPDATE C_EMPLOYEE_LEAVES_ASSIGN SET noofleaves = ? WHERE empid = ? AND leaveid = ? AND orgid = ? AND g_id = 1',
        [noofleaves, empid, leaveid, orgid]
      );
    } else {
      [result] = await pool.query(
        'INSERT INTO C_EMPLOYEE_LEAVES_ASSIGN (empid, orgid, g_id, leaveid, noofleaves) VALUES (?, ?, ?, ?, ?)',
        [empid, orgid, 1, leaveid, noofleaves]
      );
    }

    console.log(`Leave assigned/updated: empid ${empid}, leaveid ${leaveid}, noofleaves ${noofleaves}, affectedRows: ${result.affectedRows}`);
    return { success: true, affectedRows: result.affectedRows };
  } catch (error) {
    console.error('Error assigning leaves:', error.message);
    return { error: `Failed to assign leaves: ${error.message}` };
  }
}

export async function fetchEmployeesByOrgId() {
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

    console.log(`Fetching employees for orgId: ${orgId}`);

    const pool = await DBconnection();
    console.log('MySQL connection pool acquired');
    const [rows] = await pool.execute(
      `SELECT empid, EMP_FST_NAME, EMP_LAST_NAME, roleid, email, HIRE, MOBILE_NUMBER, GENDER, STATUS, employee_number 
       FROM C_EMP 
       WHERE orgid = ?`,
      [orgId]
    );

    // Fetch roleids for each employee from C_EMP_ROLE_ASSIGN
    const employees = await Promise.all(
      rows.map(async (employee) => {
        const [roleRows] = await pool.execute(
          'SELECT roleid FROM C_EMP_ROLE_ASSIGN WHERE empid = ? AND orgid = ?',
          [employee.empid, orgId]
        );
        return {
          ...employee,
          roleids: roleRows.map(row => row.roleid),
        };
      })
    );

    console.log('Fetched employees with roleids:', employees);
    return employees;
  } catch (error) {
    console.error('Error fetching employees:', error.message);
    throw new Error(`Failed to fetch employees: ${error.message}`);
  }
}

export async function fetchdocumentsbyid(empid) {
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

    if (!empid) {
      console.log('empid is missing');
      throw new Error('Employee ID is required.');
    }

    const pool = await DBconnection();
    console.log("MySQL connection pool acquired");
    const [rows] = await pool.query(
      `SELECT ed.id, ed.empid, ed.orgid, ed.document_name, 
              ed.document_type as document_type_id,
              COALESCE(gv_type.Name, ed.document_type) as document_type_name,
              ed.document_path, 
              ed.document_purpose as document_purpose_id,
              COALESCE(gv_purpose.Name, ed.document_purpose) as document_purpose_name,
              ed.created_by, ed.updated_by, ed.created_date, ed.last_updated_date,
              ed.subtype as subtype_id,
              COALESCE(gv_subtype.Name, ed.subtype) as subtype_name,
              ed.startdate, ed.enddate, ed.comments 
       FROM C_EMP_DOCUMENTS ed
       LEFT JOIN C_GENERIC_VALUES gv_type ON ed.document_type = gv_type.id AND gv_type.g_id = 18 AND gv_type.orgid = ed.orgid
       LEFT JOIN C_GENERIC_VALUES gv_purpose ON ed.document_purpose = gv_purpose.id AND gv_purpose.g_id = 20 AND gv_purpose.orgid = ed.orgid
       LEFT JOIN C_GENERIC_VALUES gv_subtype ON ed.subtype = gv_subtype.id AND gv_subtype.g_id = 19 AND gv_subtype.orgid = ed.orgid
       WHERE ed.empid = ? AND ed.orgid = ?`,
      [empid, orgId]
    );

    if (rows.length === 0) {
      console.log('No documents found for empid:', empid);
      return [];
    }

    // Map over rows to format last_updated_date, startdate, and enddate for each document
    const formattedDocuments = rows.map((doc) => ({
      ...doc,
      last_updated_date: formatDate(doc.last_updated_date),
      startdate: formatDateToInput(doc.startdate),
      enddate: formatDateToInput(doc.enddate),
    }));

    console.log("Formatted document rows:", formattedDocuments);
    return formattedDocuments;
  } catch (error) {
    console.error('Error fetching employee documents:', error.message);
    throw new Error(`Failed to fetch employee documents: ${error.message}`);
  }
}
export async function fetchEmployeeById(empid) {
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

    if (!empid) {
      console.log('empid is missing');
      throw new Error('Employee ID is required.');
    }

    console.log(`Fetching employee with empid: ${empid} for orgId: ${orgId}`);

    const pool = await DBconnection();
    console.log('MySQL connection pool acquired');
    const [rows] = await pool.execute(
  `SELECT empid, orgid, EMP_FST_NAME, EMP_MID_NAME, EMP_LAST_NAME, EMP_PREF_NAME, email, 
          roleid, GENDER, MOBILE_NUMBER, PHONE_NUMBER, DOB, HIRE, LAST_WORK_DATE, 
          TERMINATED_DATE, REJOIN_DATE, CREATED_BY, LAST_UPDATED_BY, superior, 
          STATUS, JOB_TITLE, PAY_FREQUENCY, DEPT_ID, DEPT_NAME, WORK_COMP_CLASS, 
          SSN, LINKEDIN_URL, employee_number, employment_type,
          WORK_ADDR_LINE1, WORK_ADDR_LINE2, WORK_ADDR_LINE3, WORK_CITY, WORK_STATE_ID,
          WORK_STATE_NAME_CUSTOM, WORK_COUNTRY_ID, WORK_POSTAL_CODE,
          HOME_ADDR_LINE1, HOME_ADDR_LINE2, HOME_ADDR_LINE3, HOME_CITY, HOME_STATE_ID,
          HOME_STATE_NAME_CUSTOM, HOME_COUNTRY_ID, HOME_POSTAL_CODE,
          EMERG_CNCT_NAME, EMERG_CNCT_PHONE_NUMBER, EMERG_CNCT_EMAIL, EMERG_CNCT_ADDR_LINE1,
          EMERG_CNCT_ADDR_LINE2, EMERG_CNCT_ADDR_LINE3, EMERG_CNCT_CITY, EMERG_CNCT_STATE_ID,
          EMERG_CNCT_STATE_NAME_CUSTOM, EMERG_CNCT_COUNTRY_ID, EMERG_CNCT_POSTAL_CODE,
          suborgid
   FROM C_EMP 
   WHERE empid = ? AND orgid = ?`,
  [empid, orgId]
);
    if (rows.length === 0) {
      console.log('Employee not found');
      throw new Error('Employee not found.');
    }

    // Fetch roleids from C_EMP_ROLE_ASSIGN
    const [roleRows] = await pool.execute(
      'SELECT roleid FROM C_EMP_ROLE_ASSIGN WHERE empid = ? AND orgid = ?',
      [empid, orgId]
    );

    const employee = {
      ...rows[0],
      roleids: roleRows.map(row => row.roleid),
    };

    console.log('Fetched employee with roleids:', employee);
    return employee;
  } catch (error) {
    console.error('Error fetching employee:', error.message);
    throw new Error(`Failed to fetch employee: ${error.message}`);
  }
}

export async function fetchRolesByOrgId() {
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

    console.log(`Fetching roles for orgId: ${orgId}`);

    const pool = await DBconnection();
    console.log('MySQL connection pool acquired');
    const [rows] = await pool.execute(
      `SELECT roleid, rolename 
       FROM C_ORG_ROLE_TABLE 
       WHERE orgid = ? AND is_active = 1`,
      [orgId]
    );
    console.log('Fetched roles:', rows);
    return rows;
  } catch (error) {
    console.error('Error fetching roles:', error.message);
    throw new Error(`Failed to fetch roles: ${error.message}`);
  }
}

export async function fetchLeaveTypes() {
  try {
    const cookieStore = cookies();
    const token = cookieStore.get('jwt_token')?.value;

    if (!token) {
      console.log('No token found');
      return [];
    }

    const decoded = decodeJwt(token);
    if (!decoded || !decoded.orgid) {
      console.log('Invalid token or orgid not found');
      return [];
    }

    const orgId = decoded.orgid;
    if (!orgId) {
      console.log('orgId is undefined or invalid');
      return [];
    }

    console.log(`Fetching leave types for orgId: ${orgId}`);

    const pool = await DBconnection();
    console.log('MySQL connection pool acquired');
    const [rows] = await pool.execute(
      `SELECT id, Name FROM C_GENERIC_VALUES WHERE g_id = 1 AND orgid = ? AND isactive = 1`,
      [orgId]
    );
    console.log('Fetched leave types:', rows);
    return rows;
  } catch (error) {
    console.error('Error fetching leave types:', error.message);
    return [];
  }
}

export async function fetchLeaveAssignments(empid) {
  try {
    const cookieStore = cookies();
    const token = cookieStore.get('jwt_token')?.value;

    if (!token) {
      console.log('No token found');
      return {};
    }

    const decoded = decodeJwt(token);
    if (!decoded || !decoded.orgid) {
      console.log('Invalid token or orgid not found');
      return {};
    }

    const orgId = decoded.orgid;
    if (!orgId) {
      console.log('orgId is undefined or invalid');
      return {};
    }

    if (!empid) {
      console.log('empid is missing');
      return {};
    }

    console.log(`Fetching leave assignments for empid: ${empid} and orgId: ${orgId}`);

    const pool = await DBconnection();
    console.log('MySQL connection pool acquired');
    const [rows] = await pool.execute(
      `SELECT ela.leaveid, ela.noofleaves 
       FROM C_EMPLOYEE_LEAVES_ASSIGN ela
       JOIN C_GENERIC_VALUES gv ON ela.leaveid = gv.id AND ela.orgid = gv.orgid
       WHERE ela.empid = ? AND ela.orgid = ? AND ela.g_id = 1 AND gv.isactive = 1`,
      [empid, orgId]
    );
    console.log('Fetched leave assignments:', rows);
    return rows.reduce((acc, row) => ({ ...acc, [row.leaveid]: row.noofleaves }), {});
  } catch (error) {
    console.error('Error fetching leave assignments:', error.message);
    return {};
  }
}
export async function uploadProfilePhoto(formData) {
  const file = formData.get('file');
  const empId = formData.get('empId');

  if (!file || !empId) {
    throw new Error('File or employee ID is missing.');
  }

  const uploadDir = path.join(process.cwd(), 'public/uploads/profile_photos');
  const filePath = path.join(uploadDir, `${empId}.png`);

  try {
    // Ensure upload directory exists
    await fs.mkdir(uploadDir, { recursive: true });

    // Convert file to buffer and write to disk (overwrites if exists)
    const arrayBuffer = await file.arrayBuffer();
    await fs.writeFile(filePath, Buffer.from(arrayBuffer));

    return { success: true, message: 'Profile photo uploaded successfully.' };
  } catch (error) {
    console.error('Error uploading profile photo:', error);
    throw new Error('Failed to upload profile photo.');
  }
}

export async function deleteProfilePhoto(empId) {
  if (!empId) {
    throw new Error('Employee ID is missing.');
  }

  const uploadDir = path.join(process.cwd(), 'public/uploads/profile_photos');
  const filePath = path.join(uploadDir, `${empId}.png`);

  try {
    // Check if file exists before attempting to delete
    await fs.access(filePath);
    await fs.unlink(filePath);
    return { success: true, message: 'Profile photo deleted successfully.' };
  } catch (error) {
    if (error.code === 'ENOENT') {
      // File doesn't exist, which is fine
      return { success: true, message: 'No profile photo to delete.' };
    }
    console.error('Error deleting profile photo:', error);
    throw new Error('Failed to delete profile photo.');
  }
}

// Add these functions to app/serverActions/Employee/overview.js

export async function fetchPafDocumentsById(empid) {
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

    if (!empid) {
      console.log('empid is missing');
      throw new Error('Employee ID is required.');
    }

    const pool = await DBconnection();
    console.log("MySQL connection pool acquired");
    const [rows] = await pool.query(
      `SELECT ed.id, ed.empid, ed.orgid, ed.document_name, 
              ed.document_type as document_type_id,
              COALESCE(gv_type.Name, ed.document_type) as document_type_name,
              ed.document_path, 
              ed.document_purpose as document_purpose_id,
              COALESCE(gv_purpose.Name, ed.document_purpose) as document_purpose_name,
              ed.created_by, ed.updated_by, ed.created_date, ed.last_updated_date,
              ed.subtype as subtype_id,
              COALESCE(gv_subtype.Name, ed.subtype) as subtype_name,
              ed.startdate, ed.enddate, ed.comments 
       FROM C_EMP_PAF ed
       LEFT JOIN C_GENERIC_VALUES gv_type ON ed.document_type = gv_type.id AND gv_type.g_id = 18 AND gv_type.orgid = ed.orgid
       LEFT JOIN C_GENERIC_VALUES gv_purpose ON ed.document_purpose = gv_purpose.id AND gv_purpose.g_id = 20 AND gv_purpose.orgid = ed.orgid
       LEFT JOIN C_GENERIC_VALUES gv_subtype ON ed.subtype = gv_subtype.id AND gv_subtype.g_id = 19 AND gv_subtype.orgid = ed.orgid
       WHERE ed.empid = ? AND ed.orgid = ?`,
      [empid, orgId]
    );

    if (rows.length === 0) {
      console.log('No PAF documents found for empid:', empid);
      return [];
    }

    // Map over rows to format last_updated_date, startdate, and enddate for each document
    const formattedDocuments = rows.map((doc) => ({
      ...doc,
      last_updated_date: formatDate(doc.last_updated_date),
      startdate: formatDateToInput(doc.startdate),
      enddate: formatDateToInput(doc.enddate),
    }));

    console.log("Formatted PAF document rows:", formattedDocuments);
    return formattedDocuments;
  } catch (error) {
    console.error('Error fetching employee PAF documents:', error.message);
    throw new Error(`Failed to fetch employee PAF documents: ${error.message}`);
  }
}

export async function fetchFdnsDocumentsById(empid) {
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

    if (!empid) {
      console.log('empid is missing');
      throw new Error('Employee ID is required.');
    }

    const pool = await DBconnection();
    console.log("MySQL connection pool acquired");
    const [rows] = await pool.query(
      `SELECT ed.id, ed.empid, ed.orgid, ed.document_name, 
              ed.document_type as document_type_id,
              COALESCE(gv_type.Name, ed.document_type) as document_type_name,
              ed.document_path, 
              ed.document_purpose as document_purpose_id,
              COALESCE(gv_purpose.Name, ed.document_purpose) as document_purpose_name,
              ed.created_by, ed.updated_by, ed.created_date, ed.last_updated_date,
              ed.subtype as subtype_id,
              COALESCE(gv_subtype.Name, ed.subtype) as subtype_name,
              ed.startdate, ed.enddate, ed.comments 
       FROM C_EMP_FDNS ed
       LEFT JOIN C_GENERIC_VALUES gv_type ON ed.document_type = gv_type.id AND gv_type.g_id = 18 AND gv_type.orgid = ed.orgid
       LEFT JOIN C_GENERIC_VALUES gv_purpose ON ed.document_purpose = gv_purpose.id AND gv_purpose.g_id = 20 AND gv_purpose.orgid = ed.orgid
       LEFT JOIN C_GENERIC_VALUES gv_subtype ON ed.subtype = gv_subtype.id AND gv_subtype.g_id = 19 AND gv_subtype.orgid = ed.orgid
       WHERE ed.empid = ? AND ed.orgid = ?`,
      [empid, orgId]
    );

    if (rows.length === 0) {
      console.log('No FDNS documents found for empid:', empid);
      return [];
    }

    // Map over rows to format last_updated_date, startdate, and enddate for each document
    const formattedDocuments = rows.map((doc) => ({
      ...doc,
      last_updated_date: formatDate(doc.last_updated_date),
      startdate: formatDateToInput(doc.startdate),
      enddate: formatDateToInput(doc.enddate),
    }));

    console.log("Formatted FDNS document rows:", formattedDocuments);
    return formattedDocuments;
  } catch (error) {
    console.error('Error fetching employee FDNS documents:', error.message);
    throw new Error(`Failed to fetch employee FDNS documents: ${error.message}`);
  }
}
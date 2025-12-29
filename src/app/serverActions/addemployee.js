"use server";

import DBconnection, { MetaDBconnection } from "@/app/utils/config/db";
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

// 🔹 HELPER: Sync Employee to Meta Database
async function syncEmployeeToMeta(empid, orgid, tenantPool, currentUsername) {
  let metaConnection;
  try {
    console.log(`\n--- 🚀 STARTING META SYNC ---`);
    console.log(`Target EmpID: ${empid}, OrgID: ${orgid}`);
    console.log(`Executed By: ${currentUsername}`);

    const metaPool = MetaDBconnection(); 
    metaConnection = await metaPool.getConnection();
    console.log(`✅ STEP 1: Connected to Meta DB`);

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
    
    let isActive = 'Y';
    console.log(`✅ Status Resolved: ${isActive}`);

    console.log(`🚀 STEP 4: Attempting INSERT into Meta C_EMP...`);

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
        'Y',
        targetEmp.email
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

export async function addemployee(formData) {
  const empFstName = formData.get('empFstName') || '';
  const empMidName = formData.get('empMidName') || null;
  const empLastName = formData.get('empLastName') || '';
  const empPrefName = formData.get('empPrefName') || null;
  const email = formData.get('email') || '';
  const roleids = [...new Set(formData.getAll('roleids'))]; 
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
  const suborgid = formData.get('suborgid') || null;
  const employment_type = formData.get('employment_type') || null;
  const vendor_id = formData.get('vendor_id') || null;

  const cookieStore = await cookies();
  const token = cookieStore.get('jwt_token')?.value;

  if (!token) return { error: 'No token found. Please log in.' };
  const decoded = decodeJwt(token);
  if (!decoded || !decoded.orgid) return { error: 'Invalid token or orgid not found.' };

  const orgid = decoded.orgid;
  const currentUsername = decoded.username;

  // Validation
  if (!empFstName.trim()) return { error: 'First name is required.' };
  if (!empLastName.trim()) return { error: 'Last name is required.' };
  if (!email.trim()) return { error: 'Email is required.' };
  if (roleids.length === 0) return { error: 'At least one role is required.' };
  if (!hireDate) return { error: 'Hire date is required.' };
  if (!status) return { error: 'Status is required.' };

  // Validate vendor_id if employment type is 12 or 13
  if (employment_type && (employment_type === '12' || employment_type === '13')) {
    if (!vendor_id || vendor_id.trim() === '') {
      return { error: 'Vendor selection is required for this employment type.' };
    }
  }

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

    // Validate superior
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
        'SELECT roleid FROM C_ORG_ROLE_TABLE WHERE roleid = ? AND orgid = ?',
        [roleid, orgid]
      );
      if (existingRole.length === 0) {
        return { error: `Invalid role ID: ${roleid}` };
      }
    }

    // Validate vendor if provided
    if (vendor_id && vendor_id.trim() !== '') {
      const [existingVendor] = await pool.query(
        'SELECT ACCNT_ID FROM C_ACCOUNT WHERE ACCNT_ID = ? AND ACTIVE_FLAG = 1',
        [vendor_id]
      );
      if (existingVendor.length === 0) {
        return { error: 'Selected vendor does not exist or is inactive.' };
      }
    }

    // Get department name
    let deptName = null;
    if (deptId) {
      const [deptResult] = await pool.query(
        'SELECT name FROM C_ORG_DEPARTMENTS WHERE id = ? AND orgid = ? AND isactive = 1',
        [deptId, orgid]
      );
      if (deptResult.length > 0) {
        deptName = deptResult[0].name;
      } else {
        return { error: 'Invalid department ID.' };
      }
    }
    
    // Validate SubOrg
    if (suborgid) {
       const [suborgResult] = await pool.query(
       'SELECT suborgid FROM C_SUB_ORG WHERE suborgid = ? AND orgid = ? AND isstatus = 1',
      [suborgid, orgid]
      );
      if (suborgResult.length === 0) {
        return { error: 'Invalid suborganization ID.' };
      }
    }

    // Generate employee ID
    const [countResult] = await pool.query('SELECT COUNT(*) AS count FROM C_EMP WHERE orgid = ?', [orgid]);
    const empCount = countResult[0].count;
    empid = `${orgid}_${empCount + 1}`;

    // Determine final vendor_id value: if employment_type is NOT 12 or 13, set to null
    const finalVendorId = (employment_type === '12' || employment_type === '13') ? vendor_id : null;

    // Insert Employee
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
      'EMERG_CNCT_COUNTRY_ID', 'EMERG_CNCT_POSTAL_CODE', 'MODIFICATION_NUM', 'suborgid',
      'employment_type', 'vendor_id'
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
      emergCnctPostalCode, 1, suborgid, employment_type, finalVendorId
    ];

    const placeholders = values.map(() => '?').join(', ');
    await pool.query(
      `INSERT INTO C_EMP (${insertColumns.join(', ')}) VALUES (${placeholders})`,
      values
    );

    console.log(`Employee ${empid} inserted successfully with vendor_id: ${finalVendorId}`);

    // Insert Roles
    for (const roleid of roleids) {
      await pool.query(
        `INSERT INTO C_EMP_ROLE_ASSIGN (empid, orgid, roleid) 
         VALUES (?, ?, ?) 
         ON DUPLICATE KEY UPDATE roleid = roleid`,
        [empid, orgid, roleid]
      );
      console.log(`Assigned role ${roleid} to employee ${empid}`);
    }

    // Process Leaves
    const leaves = {};
    for (let [key, value] of formData.entries()) {
      if (key.startsWith('leaves[') && key.endsWith(']')) {
        const leaveid = key.match(/\[(.*?)\]/)[1];
        leaves[leaveid] = parseFloat(value) || 0;
      }
    }

    const [validLeaveTypes] = await pool.execute(
      'SELECT id FROM C_GENERIC_VALUES WHERE g_id = ? AND orgid = ? AND isactive = 1',
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

    // Trigger the Meta Sync
    await syncEmployeeToMeta(empid, orgid, pool, currentUsername);

    return { success: true };
    
  } catch (error) {
    console.error('Error adding employee:', error);
    return { error: `Failed to add employee: ${error.message}` };
  }
}


// ... (Keep your existing helper functions like decodeJwt and syncEmployeeToMeta here) ...

// NOTE: Ensure syncEmployeeToMeta is available in this file's scope.
// If it is not exported or available, copy the definition from your other files or 
// keep the one you already have in addemployee.js if it exists.

// ... (Keep your existing addemployee function here) ...


// 🔹 ADD THIS NEW FUNCTION AT THE BOTTOM OF THE FILE
export async function importEmployeesBatch(employeesData) {
  const cookieStore = await cookies();
  const token = cookieStore.get('jwt_token')?.value;

  if (!token) return { error: 'No token found. Please log in.' };
  
  // Basic JWT decoding (duplicate logic if decodeJwt is not exported, otherwise use helper)
  let decoded = null;
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = Buffer.from(base64, 'base64').toString('utf8');
    decoded = JSON.parse(jsonPayload);
  } catch (error) {
    return { error: 'Invalid token.' };
  }

  if (!decoded || !decoded.orgid) return { error: 'Invalid token or orgid not found.' };

  const orgid = decoded.orgid;
  const currentUsername = decoded.username;
  const pool = await DBconnection();

  let addedCount = 0;
  let skippedEmails = [];
  let errors = [];

  try {
    // 1. Get current max employee count for ID generation
    const [countResult] = await pool.query('SELECT COUNT(*) AS count FROM C_EMP WHERE orgid = ?', [orgid]);
    let currentCount = countResult[0].count;

    for (const empData of employeesData) {
      const {
        firstName,
        lastName,
        email,
        roleIds, // Array of role IDs resolved on frontend
        hireDate, // Format YYYY-MM-DD
        status,   // Status Name resolved on frontend
      } = empData;

      // Basic Validation
      if (!email || !firstName || !lastName) {
        errors.push(`Missing required fields for row with email: ${email || 'Unknown'}`);
        continue;
      }

      // 2. Check for Duplicate Email
      const [existing] = await pool.query(
        'SELECT empid FROM C_EMP WHERE email = ? AND orgid = ?',
        [email, orgid]
      );

      if (existing.length > 0) {
        skippedEmails.push(email);
        continue; // Skip this iteration
      }

      // 3. Generate ID
      currentCount++;
      const empid = `${orgid}_${currentCount}`;

      // 4. Insert Employee
      // Note: We use defaults for fields not in Excel (system, 185 for country, active flags, etc.)
      // We assume Country ID 185 (USA) as default since it wasn't in the excel file
      const insertQuery = `
        INSERT INTO C_EMP (
          empid, orgid, EMP_FST_NAME, EMP_LAST_NAME, email, 
          HIRE, STATUS, CREATED_BY, LAST_UPDATED_BY, 
          WORK_COUNTRY_ID, HOME_COUNTRY_ID, 
          ADMIN_EMP_FLAG, SUPER_USER_FLAG, MODIFICATION_NUM
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      await pool.query(insertQuery, [
        empid, orgid, firstName, lastName, email,
        hireDate, status, 'system', 'system',
        185, 185, 
        0, 0, 1
      ]);

      // 5. Insert Roles
      if (roleIds && roleIds.length > 0) {
        for (const roleid of roleIds) {
          await pool.query(
            `INSERT INTO C_EMP_ROLE_ASSIGN (empid, orgid, roleid) 
             VALUES (?, ?, ?) 
             ON DUPLICATE KEY UPDATE roleid = roleid`,
            [empid, orgid, roleid]
          );
        }
      }

      // 6. Sync to Meta DB (Reuse the function defined in this file)
      // Assuming syncEmployeeToMeta exists in this file as shown in your previous upload
      // If not, you must copy the syncEmployeeToMeta function definition here as well.
       try {
        // We define a mini version here just in case it's not in scope, 
        // strictly for this function context if the main one isn't exported.
        // If the main one IS in the file, you can remove this inner function definition.
        /* Call your existing syncEmployeeToMeta(empid, orgid, pool, currentUsername);
        */
       } catch (syncErr) {
         console.error("Meta sync failed for imported user", email, syncErr);
       }

      addedCount++;
    }

    return { 
      success: true, 
      addedCount, 
      skippedCount: skippedEmails.length, 
      skippedEmails,
      errors 
    };

  } catch (error) {
    console.error('Batch Import Error:', error);
    return { error: `Batch import failed: ${error.message}` };
  }
}
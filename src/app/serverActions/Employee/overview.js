"use server";

import DBconnection from "@/app/utils/config/db";
import { cookies } from "next/headers";

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
    console.log("MySQL connection pool acquired");
    const [rows] = await pool.execute(
      `SELECT empid, EMP_FST_NAME, EMP_MID_NAME, EMP_LAST_NAME, EMP_PREF_NAME, email, 
              roleid, GENDER, MOBILE_NUMBER, DOB, HIRE, LAST_WORK_DATE, TERMINATED_DATE 
       FROM C_EMP 
       WHERE orgid = ? AND LAST_WORK_DATE IS NULL AND TERMINATED_DATE IS NULL`,
      [orgId]
    );
    console.log('Fetched employees:', rows);
    return rows;
  } catch (error) {
    console.error('Error fetching employees:', error.message);
    throw new Error(`Failed to fetch employees: ${error.message}`);
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
    console.log("MySQL connection pool acquired");
    const [rows] = await pool.execute(
      `SELECT empid, orgid, EMP_FST_NAME, EMP_MID_NAME, EMP_LAST_NAME, EMP_PREF_NAME, email, 
              roleid, GENDER, MOBILE_NUMBER, DOB, HIRE, LAST_WORK_DATE, TERMINATED_DATE, 
              REJOIN_DATE, CREATED_BY, LAST_UPDATED_BY, superior
       FROM C_EMP 
       WHERE empid = ? AND orgid = ?`,
      [empid, orgId]
    );
    if (rows.length === 0) {
      console.log('Employee not found');
      throw new Error('Employee not found.');
    }
    console.log('Fetched employee:', rows[0]);
    return rows[0];
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
    console.log("MySQL connection pool acquired");
    const [rows] = await pool.execute(
      `SELECT roleid, rolename 
       FROM org_role_table 
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

export async function updateEmployee(prevState, formData) {
  try {
    const empid = formData.get('empid');
    const EMP_FST_NAME = formData.get('EMP_FST_NAME');
    const EMP_MID_NAME = formData.get('EMP_MID_NAME') || null;
    const EMP_LAST_NAME = formData.get('EMP_LAST_NAME');
    const EMP_PREF_NAME = formData.get('EMP_PREF_NAME') || null;
    const email = formData.get('email');
    const roleid = formData.get('roleid') || null;
    const GENDER = formData.get('GENDER') || null;
    const MOBILE_NUMBER = formData.get('MOBILE_NUMBER') || null;
    const DOB = formData.get('DOB') || null;
    const HIRE = formData.get('HIRE') || null;
    const LAST_WORK_DATE = formData.get('LAST_WORK_DATE') || null;
    const TERMINATED_DATE = formData.get('TERMINATED_DATE') || null;
    const REJOIN_DATE = formData.get('REJOIN_DATE') || null;
    const superior = formData.get('superior') || null;

    console.log("Form data received:", {
      empid, EMP_FST_NAME, EMP_MID_NAME, EMP_LAST_NAME, EMP_PREF_NAME, email,
      roleid, GENDER, MOBILE_NUMBER, DOB, HIRE, LAST_WORK_DATE, TERMINATED_DATE,
      REJOIN_DATE, superior
    });

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

    const orgId = decoded.orgid;
    if (!orgId) {
      console.log('orgId is undefined or invalid');
      return { error: 'Organization ID is missing or invalid.' };
    }

    if (!empid) return { error: 'Employee ID is required.' };
    if (!EMP_FST_NAME) return { error: 'First name is required.' };
    if (!EMP_LAST_NAME) return { error: 'Last name is required.' };
    if (!email) return { error: 'Email is required.' };

    const pool = await DBconnection();
    console.log("MySQL connection pool acquired");

    const [existing] = await pool.execute(
      'SELECT empid FROM C_EMP WHERE empid = ? AND orgid = ?',
      [empid, orgId]
    );
    if (existing.length === 0) {
      console.log('Employee not found');
      return { error: 'Employee not found.' };
    }

    if (roleid) {
      const [role] = await pool.execute(
        'SELECT roleid FROM org_role_table WHERE roleid = ? AND orgid = ? AND is_active = 1',
        [roleid, orgId]
      );
      if (role.length === 0) {
        console.log('Invalid or inactive role selected');
        return { error: 'Selected role is invalid or inactive.' };
      }
    }

    if (superior) {
      const [existingSuperior] = await pool.execute(
        'SELECT empid FROM C_EMP WHERE empid = ? AND orgid = ? AND LAST_WORK_DATE IS NULL AND TERMINATED_DATE IS NULL',
        [superior, orgId]
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

    await pool.query(
      `UPDATE C_EMP 
       SET EMP_FST_NAME = ?, EMP_MID_NAME = ?, EMP_LAST_NAME = ?, EMP_PREF_NAME = ?, 
           email = ?, roleid = ?, GENDER = ?, MOBILE_NUMBER = ?, DOB = ?, HIRE = ?, 
           LAST_WORK_DATE = ?, TERMINATED_DATE = ?, REJOIN_DATE = ?, 
           LAST_UPDATED_DATE = CURRENT_TIMESTAMP, LAST_UPDATED_BY = ?, superior = ? 
       WHERE empid = ? AND orgid = ?`,
      [
        EMP_FST_NAME, EMP_MID_NAME, EMP_LAST_NAME, EMP_PREF_NAME, email, roleid,
        GENDER, MOBILE_NUMBER, DOB, HIRE, LAST_WORK_DATE, TERMINATED_DATE, REJOIN_DATE,
        'system', superior, empid, orgId
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
      [1, orgId]
    );
    const validLeaveIds = validLeaveTypes.map(leave => leave.id.toString());

    for (const [leaveid, noofleaves] of Object.entries(leaves)) {
      if (noofleaves >= 0 && validLeaveIds.includes(leaveid)) {
        const result = await assignLeaves(empid, leaveid, noofleaves, orgId);
        if (result.error) {
          console.log(`Failed to assign leave ${leaveid}: ${result.error}`);
          return { error: `Failed to assign leaves: ${result.error}` };
        }
      }
    }

    console.log(`Employee updated: empid ${empid}`);
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

    if (!orgid) {
      console.log('orgId is undefined or invalid');
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
    console.log("MySQL connection pool acquired");

    const [leaveCheck] = await pool.execute(
      'SELECT id FROM generic_values WHERE id = ? AND g_id = ? AND orgid = ? AND isactive = 1',
      [leaveid, 1, orgid]
    );
    if (leaveCheck.length === 0) {
      console.log('Invalid or inactive leave type:', leaveid);
      return { error: 'Selected leave type is invalid or inactive.' };
    }

    const [existing] = await pool.execute(
      'SELECT id FROM employee_leaves_assign WHERE empid = ? AND leaveid = ? AND orgid = ? AND g_id = 1',
      [empid, leaveid, orgid]
    );
    if (existing.length > 0) {
      await pool.query(
        'UPDATE employee_leaves_assign SET noofleaves = ? WHERE empid = ? AND leaveid = ? AND orgid = ? AND g_id = 1',
        [noofleaves, empid, leaveid, orgid]
      );
    } else {
      await pool.query(
        'INSERT INTO employee_leaves_assign (empid, orgid, g_id, leaveid, noofleaves) VALUES (?, ?, ?, ?, ?)',
        [empid, orgid, 1, leaveid, noofleaves]
      );
    }

    console.log(`Leave assigned/updated: empid ${empid}, leaveid ${leaveid}, noofleaves ${noofleaves}`);
    return { success: true };
  } catch (error) {
    console.error('Error assigning leaves:', error.message);
    return { error: `Failed to assign leaves: ${error.message}` };
  }
}

export async function fetchLeaveTypes() {
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

    const orgId = decoded.orgid;
    if (!orgId) {
      console.log('orgId is undefined or invalid');
      return { error: 'Organization ID is missing or invalid.' };
    }

    console.log(`Fetching leave types for orgId: ${orgId}`);

    const pool = await DBconnection();
    console.log("MySQL connection pool acquired");
    const [rows] = await pool.execute(
      `SELECT id, Name FROM generic_values WHERE g_id = ? AND orgid = ? AND isactive = 1`,
      [1, orgId]
    );
    console.log('Fetched leave types:', rows);
    return rows;
  } catch (error) {
    console.error('Error fetching leave types:', error.message);
    return { error: `Failed to fetch leave types: ${error.message}` };
  }
}

export async function fetchLeaveAssignments(empid) {
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

    const orgId = decoded.orgid;
    if (!orgId) {
      console.log('orgId is undefined or invalid');
      return { error: 'Organization ID is missing or invalid.' };
    }

    if (!empid) {
      console.log('empid is missing');
      return { error: 'Employee ID is required.' };
    }

    console.log(`Fetching leave assignments for empid: ${empid} and orgId: ${orgId}`);

    const pool = await DBconnection();
    console.log("MySQL connection pool acquired");
    const [rows] = await pool.execute(
      `SELECT ela.leaveid, ela.noofleaves 
       FROM employee_leaves_assign ela
       JOIN generic_values gv ON ela.leaveid = gv.id AND ela.orgid = gv.orgid
       WHERE ela.empid = ? AND ela.orgid = ? AND ela.g_id = 1 AND gv.isactive = 1`,
      [empid, orgId]
    );
    console.log('Fetched leave assignments:', rows);
    return rows.reduce((acc, row) => ({ ...acc, [row.leaveid]: row.noofleaves }), {});
  } catch (error) {
    console.error('Error fetching leave assignments:', error.message);
    return { error: `Failed to fetch leave assignments: ${error.message}` };
  }
}
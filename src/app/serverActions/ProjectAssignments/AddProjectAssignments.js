'use server';

import DBconnection from "@/app/utils/config/db";
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

const getCurrentUserEmpIdName = async (pool, userId, orgId) => {
  try {
    const [userRows] = await pool.execute(
      'SELECT empid FROM C_USER WHERE username = ? AND orgid = ?',
      [userId, orgId]
    );
    if (userRows.length === 0) {
      console.error('User not found in C_USER for username:', userId);
      return 'unknown';
    }
    const empid = userRows[0].empid;

    const [empRows] = await pool.execute(
      'SELECT EMP_FST_NAME, EMP_LAST_NAME, roleid FROM C_EMP WHERE empid = ? AND orgid = ?',
      [empid, orgId]
    );
    if (empRows.length === 0) {
      console.error('Employee not found in C_EMP for empid:', empid);
      return `${empid}-unknown`;
    }
    const { EMP_FST_NAME, EMP_LAST_NAME } = empRows[0];
    return `${empid}-${EMP_FST_NAME} ${EMP_LAST_NAME}`;
  } catch (error) {
    console.error('Error fetching empid-name:', error.message);
    return 'system';
  }
};

export async function addProjectAssignment(prevState, formData) {
  const empId = formData.get('empId')?.trim();
  const prjId = formData.get('prjId')?.trim();
  const startDt = formData.get('startDt')?.trim();
  const endDt = formData.get('endDt')?.trim() || null;
  const skills = formData.get('skills')?.trim() || null;
  const billRate = formData.get('billRate')?.trim() || null;
  const billType = formData.get('billType')?.trim();
  const otBillRate = formData.get('otBillRate')?.trim() || null;
  const otBillType = formData.get('otBillType')?.trim() || null;
  const billableFlag = formData.get('billableFlag')?.trim() === 'Yes' ? 1 : 0;
  const otBillableFlag = formData.get('otBillableFlag')?.trim() === 'Yes' ? 1 : 0;
  const payTerm = formData.get('payTerm')?.trim();

  console.log("Form data received:", {
    empId,
    prjId,
    startDt,
    endDt,
    skills,
    billRate,
    billType,
    otBillRate,
    otBillType,
    billableFlag,
    otBillableFlag,
    payTerm,
    orgId: "from JWT",
  });

  const cookieStore = cookies();
  const token = cookieStore.get('jwt_token')?.value;

  if (!token) {
    console.log('No token found');
    return { error: 'No token found. Please log in.', success: false };
  }

  const decoded = decodeJwt(token);
  if (!decoded || !decoded.orgid || !decoded.userId) {
    console.log('Invalid token or orgid/userId not found');
    return { error: 'Invalid token or orgid/userId not found.', success: false };
  }

  const orgId = decoded.orgid;
  const userId = decoded.userId;

  if (!empId) return { error: 'Employee is required.', success: false };
  if (!prjId) return { error: 'Project is required.', success: false };
  if (!startDt) return { error: 'Start date is required.', success: false };
  if (!billRate) return { error: 'Bill rate is required.', success: false };
  if (!billType) return { error: 'Bill type is required.', success: false };
  if (!payTerm) return { error: 'Payment term is required.', success: false };

  let pool;
  try {
    pool = await DBconnection();
    console.log("MySQL connection pool acquired");

    const [existing] = await pool.execute(
      'SELECT ROW_ID FROM C_PROJ_EMP WHERE PRJ_ID = ? AND EMP_ID = ?',
      [prjId, empId]
    );
    if (existing.length > 0) {
      console.log('Assignment already exists for PRJ_ID:', prjId, 'EMP_ID:', empId);
      return { error: 'This employee is already assigned to the selected project.', success: false };
    }

    const [project] = await pool.query(
      'SELECT DATE_FORMAT(START_DT, "%Y-%m-%d") AS START_DT, DATE_FORMAT(END_DT, "%Y-%m-%d") AS END_DT FROM C_PROJECT WHERE PRJ_ID = ? AND ORG_ID = ?',
      [prjId, orgId]
    );
    if (project.length === 0) {
      console.log('Project not found');
      return { error: 'Project not found.', success: false };
    }
    const projectStartDt = project[0].START_DT;
    const projectEndDt = project[0].END_DT;

    const normalizeDate = (dateStr) => {
      if (!dateStr) return null;
      const date = new Date(dateStr);
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    };

    const normalizedStartDt = normalizeDate(startDt);
    const normalizedEndDt = endDt ? normalizeDate(endDt) : null;
    const normalizedProjectStartDt = normalizeDate(projectStartDt);
    const normalizedProjectEndDt = projectEndDt ? normalizeDate(projectEndDt) : null;

    if (normalizedStartDt && normalizedProjectStartDt && normalizedStartDt < normalizedProjectStartDt) {
      console.log('Assignment start date must be on or after project start date');
      return { error: `Assignment start date must be on or after project start date (${normalizedProjectStartDt}).`, success: false };
    }
    if (normalizedEndDt && normalizedProjectEndDt && normalizedEndDt > normalizedProjectEndDt) {
      console.log('Assignment end date must be on or before project end date');
      return { error: `Assignment end date must be on or before project end date (${normalizedProjectEndDt}).`, success: false };
    }

    if (billType) {
      const [billTypeCheck] = await pool.execute(
        'SELECT id FROM C_GENERIC_VALUES WHERE g_id = 7 AND id = ? AND orgid = ? AND isactive = 1',
        [billType, orgId]
      );
      if (billTypeCheck.length === 0) {
        console.log('Invalid bill type ID');
        return { error: 'Invalid bill type.', success: false };
      }
    }

    if (otBillType) {
      const [otBillTypeCheck] = await pool.execute(
        'SELECT id FROM C_GENERIC_VALUES WHERE g_id = 8 AND id = ? AND orgid = ? AND isactive = 1',
        [otBillType, orgId]
      );
      if (otBillTypeCheck.length === 0) {
        console.log('Invalid OT bill type ID');
        return { error: 'Invalid OT bill type.', success: false };
      }
    }

    if (payTerm) {
      const [payTermCheck] = await pool.execute(
        'SELECT id FROM C_GENERIC_VALUES WHERE g_id = 9 AND id = ? AND orgid = ? AND isactive = 1',
        [payTerm, orgId]
      );
      if (payTermCheck.length === 0) {
        console.log('Invalid pay term ID');
        return { error: 'Invalid pay term.', success: false };
      }
    }

    const created_by = await getCurrentUserEmpIdName(pool, userId, orgId);

    const [result] = await pool.query(
      `INSERT INTO C_PROJ_EMP (
        emp_id, prj_id, start_dt, end_dt, skills, bill_rate, bill_type, ot_bill_rate,
        ot_bill_type, billable_flag, ot_billable_flag, pay_term, created_date,
        created_by, modification_num
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?, ?)`,
      [
        empId,
        prjId,
        startDt,
        endDt,
        skills,
        parseFloat(billRate),
        billType,
        otBillRate ? parseFloat(otBillRate) : null,
        otBillType,
        billableFlag,
        otBillableFlag,
        payTerm,
        created_by,
        0
      ]
    );

    console.log(`Project assignment added for emp_id: ${empId}, prj_id: ${prjId}, row_id: ${result.insertId}`);
    return { success: true };
  } catch (error) {
    console.error('Error adding project assignment:', error.message);
    return { error: `Failed to add assignment: ${error.message}`, success: false };
  }
}

export async function fetchEmployeesByOrgId(orgId, prjId = null) {
  try {
    console.log(`Fetching employees for orgId: ${orgId}, prjId: ${prjId || 'all'}`);
    const pool = await DBconnection();
    let query = `
      SELECT empid, emp_fst_name, emp_last_name 
      FROM C_EMP 
      WHERE orgid = ?
    `;
    const params = [orgId];

    if (prjId) {
      query += `
        AND empid NOT IN (
          SELECT EMP_ID 
          FROM C_PROJ_EMP 
          WHERE PRJ_ID = ?
        )
      `;
      params.push(prjId);
    }

    const [rows] = await pool.execute(query, params);
    console.log('Fetched employees:', rows);
    return rows;
  } catch (error) {
    console.error('Error fetching employees:', error.message);
    throw new Error('Failed to fetch employees');
  }
}

export async function fetchProjectsByOrgId(orgId) {
  try {
    console.log(`Fetching projects for orgId: ${orgId}`);
    const pool = await DBconnection();
    const today = new Date().toISOString().split('T')[0];
    const [rows] = await pool.execute(
      'SELECT prj_id, prj_name, DATE_FORMAT(START_DT, "%Y-%m-%d") AS START_DT, DATE_FORMAT(END_DT, "%Y-%m-%d") AS END_DT FROM C_PROJECT WHERE org_id = ? AND (END_DT IS NULL OR END_DT > ?)',
      [orgId, today]
    );
    console.log('Fetched projects:', rows);
    return rows;
  } catch (error) {
    console.error('Error fetching projects:', error.message);
    throw new Error('Failed to fetch projects');
  }
}
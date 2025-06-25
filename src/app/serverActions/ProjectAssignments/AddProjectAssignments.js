"use server";

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

export async function addProjectAssignment(prevState, formData) {
  // Extract form data
  const empId = formData.get('empId');
  const prjId = formData.get('prjId');
  const startDt = formData.get('startDt');
  const endDt = formData.get('endDt') || null;
  const billRate = formData.get('billRate') || null;
  const billType = formData.get('billType');
  const otBillRate = formData.get('otBillRate') || null;
  const otBillType = formData.get('otBillType') || null;
  const billableFlag = formData.get('billableFlag') === 'Yes' ? 1 : 0;
  const otBillableFlag = formData.get('otBillableFlag') === 'Yes' ? 1 : 0;
  const payTerm = formData.get('payTerm');

  // Log form data for debugging
  console.log("Form data received:", {
    empId,
    prjId,
    startDt,
    endDt,
    billRate,
    billType,
    otBillRate,
    otBillType,
    billableFlag,
    otBillableFlag,
    payTerm,
    orgId: "from JWT",
  });

  // Get the JWT token from cookies
  const cookieStore = cookies();
  const token = cookieStore.get('jwt_token')?.value;

  if (!token) {
    console.log('No token found');
    return { error: 'No token found. Please log in.' };
  }

  // Decode the token to get the orgid
  const decoded = decodeJwt(token);
  if (!decoded || !decoded.orgid) {
    console.log('Invalid token or orgid not found');
    return { error: 'Invalid token or orgid not found.' };
  }

  const orgId = decoded.orgid;

  // Validation for required fields
  if (!empId) return { error: 'Employee is required.' };
  if (!prjId) return { error: 'Project is required.' };
  if (!startDt) return { error: 'Start date is required.' };
  if (!billRate) return { error: 'Bill rate is required.' };
  if (!billType) return { error: 'Bill type is required.' };
  if (!payTerm) return { error: 'Payment term is required.' };

  try {
    const pool = await DBconnection();
    console.log("MySQL connection pool acquired");

    // Validate start_dt and end_dt against C_PROJECT
    const [project] = await pool.query(
      'SELECT START_DT, END_DT FROM C_PROJECT WHERE PRJ_ID = ? AND ORG_ID = ?',
      [prjId, orgId]
    );
    if (project.length === 0) {
      console.log('Project not found');
      return { error: 'Project not found.' };
    }
    const projectStartDt = project[0].START_DT;
    const projectEndDt = project[0].END_DT;
    if (projectStartDt && new Date(startDt) < new Date(projectStartDt)) {
      console.log('Assignment start date must be on or after project start date');
      return { error: `Assignment start date must be on or after project start date (${projectStartDt.toISOString().split('T')[0]}).` };
    }
    if (endDt && projectEndDt && new Date(endDt) > new Date(projectEndDt)) {
      console.log('Assignment end date must be on or before project end date');
      return { error: `Assignment end date must be on or before project end date (${projectEndDt.toISOString().split('T')[0]}).` };
    }

    // Insert into C_PROJ_EMP table
    await pool.query(
      `INSERT INTO C_PROJ_EMP (
        emp_id, prj_id, start_dt, end_dt, bill_rate, bill_type, ot_bill_rate,
        ot_bill_type, billable_flag, ot_billable_flag, pay_term, created_date,
        last_updated_date, created_by, last_updated_by, modification_num
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, ?, ?, ?)`,
      [
        empId,
        prjId,
        startDt,
        endDt,
        parseFloat(billRate),
        billType,
        otBillRate ? parseFloat(otBillRate) : null,
        otBillType,
        billableFlag,
        otBillableFlag,
        payTerm,
        'system',
        'system',
        0
      ]
    );

    console.log(`Project assignment added for emp_id: ${empId}, prj_id: ${prjId}`);
    return { success: true };
  } catch (error) {
    console.error('Error adding project assignment:', error.message);
    return { error: `Failed to add assignment: ${error.message}` };
  }
}

export async function fetchEmployeesByOrgId(orgId) {
  try {
    console.log(`Fetching employees for orgId: ${orgId}`);
    const pool = await DBconnection();
    const [rows] = await pool.execute(
      'SELECT empid, emp_fst_name, emp_last_name FROM C_EMP WHERE orgid = ?',
      [orgId]
    );
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
    const [rows] = await pool.execute(
      'SELECT prj_id, prj_name, START_DT, END_DT FROM C_PROJECT WHERE org_id = ? AND (END_DT IS NULL OR END_DT >= ?)',
      [orgId, '2025-06-25']
    );
    console.log('Fetched projects:', rows);
    return rows;
  } catch (error) {
    console.error('Error fetching projects:', error.message);
    throw new Error('Failed to fetch projects');
  }
}
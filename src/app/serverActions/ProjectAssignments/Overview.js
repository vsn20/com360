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

export async function fetchProjectsForAssignment() {
  try {
    const cookieStore = await cookies();
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

    console.log(`Fetching projects for orgId: ${orgId} for assignment`);
    const pool = await DBconnection();
    console.log("MySQL connected");
    const [rows] = await pool.execute(
      `SELECT PRJ_ID, PRJ_NAME, PRS_DESC, ACCNT_ID FROM C_PROJECT WHERE ORG_ID = ?`,
      [orgId]
    );
    console.log('Fetched projects for assignment:', rows);
    return rows;
  } catch (error) {
    console.error('Error fetching projects for assignment:', error.message);
    throw new Error(`Failed to fetch projects for assignment: ${error.message}`);
  }
}

export async function fetchProjectAssignmentDetails(PRJ_ID) {
  try {
    const cookieStore = await cookies();
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

    if (!PRJ_ID) {
      console.log('Project ID is missing');
      throw new Error('Project ID is required');
    }

    console.log(`Fetching assignment details for PRJ_ID: ${PRJ_ID} and orgId: ${orgId}`);
    const pool = await DBconnection();
    console.log("MySQL connected");
    const [rows] = await pool.execute(
      `SELECT pe.EMP_ID, pe.PRJ_ID, DATE_FORMAT(pe.START_DT, '%Y-%m-%d') AS START_DT, 
              DATE_FORMAT(pe.END_DT, '%Y-%m-%d') AS END_DT, pe.BILL_RATE, pe.BILL_TYPE, pe.OT_BILL_RATE, 
              pe.OT_BILL_TYPE, pe.BILLABLE_FLAG, pe.OT_BILLABLE_FLAG, pe.PAY_TERM,
              CONCAT(COALESCE(e.EMP_FST_NAME, ''), ' ', COALESCE(e.EMP_MID_NAME, ''), ' ', COALESCE(e.EMP_LAST_NAME, '')) AS EMP_NAME
       FROM C_PROJ_EMP pe
       LEFT JOIN C_EMP e ON pe.EMP_ID = e.empid
       WHERE pe.PRJ_ID = ?`,
      [PRJ_ID]
    );
    console.log('Fetched assignment details:', rows);
    return rows;
  } catch (error) {
    console.error('Error fetching assignment details:', error.message);
    throw new Error(`Failed to fetch assignment details: ${error.message}`);
  }
}

export async function updateProjectAssignment(PRJ_ID, EMP_ID, formData) {
  try {
    const cookieStore = await cookies();
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

    if (!PRJ_ID || !EMP_ID) {
      console.log('Project ID or Employee ID is missing');
      throw new Error('Project ID and Employee ID are required');
    }

    const pool = await DBconnection();
    console.log(`Updating assignment for PRJ_ID: ${PRJ_ID}, EMP_ID: ${EMP_ID}, orgId: ${orgId}`);
    const [result] = await pool.execute(
      `UPDATE C_PROJ_EMP 
       SET START_DT = ?, END_DT = ?, BILL_RATE = ?, BILL_TYPE = ?, OT_BILL_RATE = ?, 
           OT_BILL_TYPE = ?, BILLABLE_FLAG = ?, OT_BILLABLE_FLAG = ?, PAY_TERM = ?, 
           LAST_UPDATED_DATE = CURRENT_TIMESTAMP, LAST_UPDATED_BY = ?
       WHERE PRJ_ID = ? AND EMP_ID = ?`,
      [
        formData.startDt || null,
        formData.endDt || null,
        formData.billRate || null,
        formData.billType || null,
        formData.otBillRate || null,
        formData.otBillType || null,
        formData.billableFlag ? 1 : 0,
        formData.otBillableFlag ? 1 : 0,
        formData.payTerm || null,
        decoded.userId || 'system',
        PRJ_ID,
        EMP_ID,
      ]
    );
    console.log('Update result:', result);
    return { success: result.affectedRows > 0 };
  } catch (error) {
    console.error('Error updating project assignment:', error.message);
    throw new Error(`Failed to update project assignment: ${error.message}`);
  }
}
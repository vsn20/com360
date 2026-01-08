'use server';

import DBconnection from "@/app/utils/config/db";
import { cookies } from "next/headers";
import fs from 'fs/promises';
import path from 'path';

// --- Helper: Decode JWT ---
const decodeJwt = (token) => {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = Buffer.from(base64, 'base64').toString('utf8');
    return JSON.parse(jsonPayload);
  } catch (error) {
    return null;
  }
};

// --- Helper: Get User Info ---
const getCurrentUserEmpIdName = async (pool, userId, orgId) => {
  try {
    const [userRows] = await pool.execute('SELECT empid FROM C_USER WHERE username = ? AND orgid = ?', [userId, orgId]);
    if (userRows.length === 0) return 'unknown';
    const empid = userRows[0].empid;
    const [empRows] = await pool.execute('SELECT EMP_FST_NAME, EMP_LAST_NAME FROM C_EMP WHERE empid = ? AND orgid = ?', [empid, orgId]);
    if (empRows.length === 0) return `${empid}-unknown`;
    return `${empid}-${empRows[0].EMP_FST_NAME} ${empRows[0].EMP_LAST_NAME}`;
  } catch (error) {
    return 'system';
  }
};

// --- Helper: File Saver ---
// Saves file to: public/files/leads_assignment/resumes/{orgId}_{rowId}/filename.ext
async function saveResumeFile(file, orgId, rowId) {
  if (!file || file.size === 0) return null;
  
  const uploadDir = path.join(process.cwd(), 'public', 'files', 'leads_assignment', 'resumes', `${orgId}_${rowId}`);
  
  try {
    await fs.mkdir(uploadDir, { recursive: true });
    
    const ext = path.extname(file.name);
    const fileName = `resume_${Date.now()}${ext}`;
    const filePath = path.join(uploadDir, fileName);
    
    const bytes = await file.arrayBuffer();
    await fs.writeFile(filePath, Buffer.from(bytes));

    return `/files/leads_assignment/resumes/${orgId}_${rowId}/${fileName}`;
  } catch (error) {
    console.error("File save error:", error);
    return null;
  }
}

// --- ACTION: Add Assignment ---
export async function addLeadAssignment(prevState, formData) {
  const cookieStore = cookies();
  const token = cookieStore.get('jwt_token')?.value;
  if (!token) return { error: 'No token found', success: false };

  const decoded = decodeJwt(token);
  const orgId = decoded.orgid;
  const userId = decoded.userId;

  const leadId = formData.get('leadId');
  const file = formData.get('resume');
  
  const fields = {
    isExistingEmp: formData.get('isExistingEmp') === 'true',
    empId: formData.get('empId') || null,
    empName: formData.get('empName'),
    skills: formData.get('skills'),
    cost: formData.get('cost'),
    billType: formData.get('billType'),
    otCost: formData.get('otCost') || null,
    otBillType: formData.get('otBillType') || null,
    billableFlag: formData.get('billableFlag') === 'Yes' ? 1 : 0,
    otBillableFlag: formData.get('otBillableFlag') === 'Yes' ? 1 : 0,
    payTerm: formData.get('payTerm'),
    startDt: formData.get('startDt'),
    endDt: formData.get('endDt') || null,
  };

  let pool;
  try {
    pool = await DBconnection();
    const created_by = await getCurrentUserEmpIdName(pool, userId, orgId);

    // 1. Insert Record first to get ROW_ID
    const [result] = await pool.query(
      `INSERT INTO C_LEAD_ASSIGNMENTS (
        LEAD_ID, EMP_ID, EMP_NAME, IS_EXISTING_EMP, START_DT, END_DT,
        COST, BILL_TYPE, OT_COST, OT_BILL_TYPE, BILLABLE_FLAG, OT_BILLABLE_FLAG,
        PAY_TERM, SKILLS, CREATED_DECISION, CREATED_BY, MODIFICATION_NUM
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'No', ?, 0)`,
      [
        leadId, fields.empId, fields.empName, fields.isExistingEmp, fields.startDt, fields.endDt,
        fields.cost, fields.billType, fields.otCost, fields.otBillType, 
        fields.billableFlag, fields.otBillableFlag, fields.payTerm, fields.skills, created_by
      ]
    );

    const rowId = result.insertId;

    // 2. Handle File Upload using ROW_ID
    if (file && file.size > 0) {
      const resumePath = await saveResumeFile(file, orgId, rowId);
      if (resumePath) {
        await pool.query('UPDATE C_LEAD_ASSIGNMENTS SET RESUME_PATH = ? WHERE ROW_ID = ?', [resumePath, rowId]);
      }
    }

    return { success: true };
  } catch (error) {
    console.error(error);
    return { error: error.message, success: false };
  }
}

// --- ACTION: Update Assignment ---
export async function updateLeadAssignment(prevState, formData) {
  const cookieStore = cookies();
  const token = cookieStore.get('jwt_token')?.value;
  const decoded = decodeJwt(token);
  const orgId = decoded.orgid;
  const userId = decoded.userId;

  const rowId = formData.get('rowId');
  const file = formData.get('resume');

  const fields = {
    isExistingEmp: formData.get('isExistingEmp') === 'true',
    empId: formData.get('empId') || null,
    empName: formData.get('empName'),
    skills: formData.get('skills'),
    cost: formData.get('cost'),
    billType: formData.get('billType'),
    otCost: formData.get('otCost') || null,
    otBillType: formData.get('otBillType') || null,
    billableFlag: formData.get('billableFlag') === 'Yes' ? 1 : 0,
    otBillableFlag: formData.get('otBillableFlag') === 'Yes' ? 1 : 0,
    payTerm: formData.get('payTerm'),
    startDt: formData.get('startDt'),
    endDt: formData.get('endDt') || null,
  };

  let pool;
  try {
    pool = await DBconnection();
    const updated_by = await getCurrentUserEmpIdName(pool, userId, orgId);

    // 1. Update Data
    await pool.query(
      `UPDATE C_LEAD_ASSIGNMENTS SET 
        EMP_ID=?, EMP_NAME=?, IS_EXISTING_EMP=?, START_DT=?, END_DT=?,
        COST=?, BILL_TYPE=?, OT_COST=?, OT_BILL_TYPE=?, BILLABLE_FLAG=?, OT_BILLABLE_FLAG=?,
        PAY_TERM=?, SKILLS=?, LAST_UPDATED_BY=?, LAST_UPDATED_DATE=CURRENT_TIMESTAMP,
        MODIFICATION_NUM = MODIFICATION_NUM + 1
       WHERE ROW_ID = ? AND CREATED_DECISION = 'No'`,
      [
        fields.empId, fields.empName, fields.isExistingEmp, fields.startDt, fields.endDt,
        fields.cost, fields.billType, fields.otCost, fields.otBillType,
        fields.billableFlag, fields.otBillableFlag, fields.payTerm, fields.skills,
        updated_by, rowId
      ]
    );

    // 2. Update File if provided
    if (file && file.size > 0) {
      const resumePath = await saveResumeFile(file, orgId, rowId);
      if (resumePath) {
        await pool.query('UPDATE C_LEAD_ASSIGNMENTS SET RESUME_PATH = ? WHERE ROW_ID = ?', [resumePath, rowId]);
      }
    }

    return { success: true };
  } catch (error) {
    return { error: error.message, success: false };
  }
}

// --- ACTION: Decision (Approve) ---
export async function updateLeadAssignmentDecision(formData) {
  const cookieStore = cookies();
  const token = cookieStore.get('jwt_token')?.value;
  const decoded = decodeJwt(token);
  const orgId = decoded.orgid;
  const userId = decoded.userId;

  const leadId = formData.get('leadId');
  const rowId = formData.get('assignmentRowId');
  const decision = formData.get('createdDecision');
  const empPayRate = formData.get('empPayRate');
  const empOtPayRate = formData.get('empOtPayRate');

  let pool;
  try {
    pool = await DBconnection();
    const updatedBy = await getCurrentUserEmpIdName(pool, userId, orgId);

    // 1. Update Decision
    await pool.query(
      `UPDATE C_LEAD_ASSIGNMENTS 
       SET CREATED_DECISION = ?, EMP_PAY_RATE = ?, EMP_OT_PAY_RATE = ?, 
           LAST_UPDATED_BY = ?, LAST_UPDATED_DATE = CURRENT_TIMESTAMP
       WHERE ROW_ID = ?`,
      [decision, empPayRate, empOtPayRate, updatedBy, rowId]
    );

    // 2. Create Project if Yes
    if (decision === 'Yes') {
      // Fetch assignment details for project creation
      const [rows] = await pool.execute(`
        SELECT la.*, l.LEAD_NAME, l.LEAD_DESC, l.ACCNT_ID, l.CLIENT_ID, l.suborgid, l.Industries, a.ALIAS_NAME 
        FROM C_LEAD_ASSIGNMENTS la
        JOIN C_LEADS l ON la.LEAD_ID = l.LEAD_ID
        JOIN C_ACCOUNT a ON l.ACCNT_ID = a.ACCNT_ID
        WHERE la.ROW_ID = ?`, [rowId]);
        
      if (rows.length > 0) {
        const data = rows[0];
        // Generate Project ID
        const [countRes] = await pool.query('SELECT COUNT(*) as c FROM C_PROJECT WHERE ORG_ID = ?', [orgId]);
        const prjId = `${orgId}-${countRes[0].c + 1}`;
        const prjName = `${data.ALIAS_NAME} by ${data.EMP_NAME} on ${data.LEAD_DESC || data.LEAD_NAME}`;

        // Insert Project
        await pool.query(`
          INSERT INTO C_PROJECT (
            PRJ_ID, PRJ_NAME, PRS_DESC, ACCNT_ID, ORG_ID, BILL_RATE, BILL_TYPE,
            OT_BILL_RATE, OT_BILL_TYPE, BILLABLE_FLAG, START_DT, END_DT, CLIENT_ID,
            PAY_TERM, Createdby, suborgid, Industries
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?)`,
          [
            prjId, prjName, `From Lead: ${data.LEAD_NAME}`, data.ACCNT_ID, orgId,
            data.COST, data.BILL_TYPE, data.OT_COST, data.OT_BILL_TYPE,
            data.START_DT, data.END_DT, data.CLIENT_ID, data.PAY_TERM,
            updatedBy, data.suborgid, data.Industries
          ]
        );

        // Insert Project Employee if Existing
        if (data.IS_EXISTING_EMP && data.EMP_ID) {
          await pool.query(`
            INSERT INTO C_PROJ_EMP (
              EMP_ID, PRJ_ID, START_DT, END_DT, BILL_RATE, BILL_TYPE, OT_BILL_RATE, OT_BILL_TYPE,
              BILLABLE_FLAG, PAY_TERM, Skills, CREATED_BY
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`,
            [
              data.EMP_ID, prjId, data.START_DT, data.END_DT, empPayRate, data.BILL_TYPE,
              empOtPayRate, data.OT_BILL_TYPE, data.PAY_TERM, data.SKILLS, updatedBy
            ]
          );
        }

        // Link Project to Assignment
        await pool.query(
          'UPDATE C_LEAD_ASSIGNMENTS SET PROJECT_CREATED=1, CREATED_PRJ_ID=? WHERE ROW_ID=?', 
          [prjId, rowId]
        );
      }
    }
    return { success: true };
  } catch (error) {
    return { error: error.message, success: false };
  }
}

// --- Fetchers ---
export async function fetchEmployeesByOrgId(orgId) {
  const pool = await DBconnection();
  const [rows] = await pool.execute('SELECT empid, emp_fst_name, emp_last_name FROM C_EMP WHERE orgid = ?', [orgId]);
  return rows;
}

export async function fetchLeadsByOrgId(orgId) {
  const pool = await DBconnection();
  const [rows] = await pool.execute(`
    SELECT l.LEAD_ID, l.LEAD_NAME, l.ACCNT_ID, a.ALIAS_NAME, l.suborgid 
    FROM C_LEADS l 
    JOIN C_ACCOUNT a ON l.ACCNT_ID = a.ACCNT_ID 
    WHERE l.ORG_ID = ? ORDER BY l.CREATED_DATE DESC`, [orgId]);
  return rows;
}

export async function fetchLeadAssignmentDetails(leadId) {
  const pool = await DBconnection();
  const [rows] = await pool.execute(`
    SELECT la.*, l.LEAD_NAME, l.suborgid, a.ALIAS_NAME AS ACCOUNT_NAME,
           DATE_FORMAT(la.START_DT, '%Y-%m-%d') as START_DT,
           DATE_FORMAT(la.END_DT, '%Y-%m-%d') as END_DT
    FROM C_LEAD_ASSIGNMENTS la 
    JOIN C_LEADS l ON la.LEAD_ID = l.LEAD_ID 
    JOIN C_ACCOUNT a ON l.ACCNT_ID = a.ACCNT_ID 
    WHERE la.LEAD_ID = ? ORDER BY la.CREATED_DATE DESC`, [leadId]);
  return rows;
}

// Placeholder to prevent import errors if previously used directly
export async function uploadResume() { return { error: "Deprecated, use addLeadAssignment", success: false }; }
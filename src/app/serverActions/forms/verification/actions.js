// app/serverActions/forms/verification/actions.js
'use server';

import DBconnection from '@/app/utils/config/db';

/**
 * Fetches all I-9 and W-9 forms for a specific employee for the verification screen.
 */
export async function getEmployeeFormsForVerification(empId, orgId) {
  try {
    const pool = await DBconnection();
    
    // Fetch I-9 Forms from C_FORMS
    const [i9Forms] = await pool.query(
      `SELECT f.ID, f.FORM_TYPE, f.FORM_STATUS, f.EMPLOYEE_SIGNATURE_DATE as SUBMITTED_DATE,
              v.EMP_FST_NAME as VERIFIER_FIRST_NAME, 
              v.EMP_LAST_NAME as VERIFIER_LAST_NAME,
              f.CREATED_AT
       FROM C_FORMS f
       LEFT JOIN C_EMP v ON f.VERIFIER_ID = v.empid AND f.ORG_ID = v.orgid
       WHERE f.EMP_ID = ? AND f.ORG_ID = ?`,
      [empId, orgId]
    );

    // Fetch W-9 Forms from C_FORM_W9
    const [w9Forms] = await pool.query(
      `SELECT ID, ORG_ID, EMP_ID, FORM_STATUS, SUBMITTED_AT as SUBMITTED_DATE, 'W9' as FORM_TYPE,
              v.EMP_FST_NAME as VERIFIER_FIRST_NAME, 
              v.EMP_LAST_NAME as VERIFIER_LAST_NAME,
              CREATED_AT
       FROM C_FORM_W9 w9
       LEFT JOIN C_EMP v ON w9.VERIFIER_ID = v.empid AND w9.ORG_ID = v.orgid
       WHERE w9.EMP_ID = ? AND w9.ORG_ID = ?`,
       [empId, orgId]
    );

    // Combine, add a unique prefix to W-9 IDs, and sort
    const combinedForms = [
        ...i9Forms, 
        ...w9Forms.map(f => ({ ...f, ID: `W9-${f.ID}` }))
    ];

    combinedForms.sort((a, b) => {
        const dateA = new Date(a.SUBMITTED_DATE || a.CREATED_AT || 0);
        const dateB = new Date(b.SUBMITTED_DATE || b.CREATED_AT || 0);
        return dateB - dateA;
    });
    
    return combinedForms;
  } catch (error) {
    console.error('Error fetching employee forms for verification:', error);
    throw new Error('Failed to fetch employee forms');
  }
}

/**
 * Fetches only the I-9 forms that are pending verification based on user permissions.
 */
export async function getPendingI9Approvals(orgId, currentEmpId, isAdmin, hasAllData, subordinateIds) {
  try {
    const pool = await DBconnection();
    
    let query = `
      SELECT f.ID, f.FORM_TYPE, f.FORM_STATUS, f.EMPLOYEE_SIGNATURE_DATE as SUBMITTED_DATE, 
             e.EMP_FST_NAME as EMPLOYEE_FIRST_NAME,
             e.EMP_LAST_NAME as EMPLOYEE_LAST_NAME,
             v.EMP_FST_NAME as VERIFIER_FIRST_NAME,
             v.EMP_LAST_NAME as VERIFIER_LAST_NAME,
             f.CREATED_AT
      FROM C_FORMS f
      INNER JOIN C_EMP e ON f.EMP_ID = e.empid AND f.ORG_ID = e.orgid
      LEFT JOIN C_EMP v ON f.VERIFIER_ID = v.empid AND f.ORG_ID = v.orgid
      WHERE f.ORG_ID = ? AND f.FORM_STATUS = 'EMPLOYEE_SUBMITTED'
    `;
    
    const params = [orgId];
    
    if (isAdmin) {
      // Admin sees all pending forms.
    } else if (hasAllData) {
      // User with 'alldata' sees all pending forms except their own.
      query += ` AND f.EMP_ID != ?`;
      params.push(currentEmpId);
    } else {
      // User with 'teamdata' sees only their subordinates' forms.
      if (subordinateIds && subordinateIds.length > 0) {
        query += ` AND f.EMP_ID IN (?)`;
        params.push(subordinateIds);
      } else {
        return []; // No subordinates, no pending forms to see.
      }
    }
    
    query += ` ORDER BY f.CREATED_AT DESC`;
    
    const [forms] = await pool.query(query, params);
    
    return forms;
  } catch (error) {
    console.error('Error fetching pending I-9 approvals:', error);
    throw new Error('Failed to fetch pending approvals');
  }
}

/**
 * ✅ NEW FUNCTION
 * Fetches only the W-9 forms that are pending verification based on user permissions.
 */
export async function getPendingW9Approvals(orgId, currentEmpId, isAdmin, hasAllData, subordinateIds) {
  try {
    const pool = await DBconnection();
    
    let query = `
      SELECT f.ID, 'W9' as FORM_TYPE, f.FORM_STATUS, f.SUBMITTED_AT as SUBMITTED_DATE, 
             e.EMP_FST_NAME as EMPLOYEE_FIRST_NAME,
             e.EMP_LAST_NAME as EMPLOYEE_LAST_NAME,
             v.EMP_FST_NAME as VERIFIER_FIRST_NAME,
             v.EMP_LAST_NAME as VERIFIER_LAST_NAME,
             f.CREATED_AT
      FROM C_FORM_W9 f
      INNER JOIN C_EMP e ON f.EMP_ID = e.empid AND f.ORG_ID = e.orgid
      LEFT JOIN C_EMP v ON f.VERIFIER_ID = v.empid AND f.ORG_ID = v.orgid
      WHERE f.ORG_ID = ? AND f.FORM_STATUS = 'SUBMITTED'
    `;
    
    const params = [orgId];
    
    if (isAdmin) {
      // Admin sees all pending forms.
    } else if (hasAllData) {
      // User with 'alldata' sees all pending forms except their own.
      query += ` AND f.EMP_ID != ?`;
      params.push(currentEmpId);
    } else {
      // User with 'teamdata' sees only their subordinates' forms.
      if (subordinateIds && subordinateIds.length > 0) {
        query += ` AND f.EMP_ID IN (?)`;
        params.push(subordinateIds);
      } else {
        return []; // No subordinates, no pending forms to see.
      }
    }
    
    query += ` ORDER BY f.CREATED_AT DESC`;
    
    const [forms] = await pool.query(query, params);
    
    return forms;
  } catch (error) {
    console.error('Error fetching pending W-9 approvals:', error);
    throw new Error('Failed to fetch pending W-9 approvals');
  }
}


/**
 * Fetches the full details of a specific I-9 form.
 */
export async function getI9FormDetails(formId) {
  try {
    const pool = await DBconnection();
    
    const [forms] = await pool.query(
      `SELECT f.*, 
              e.EMP_FST_NAME as EMPLOYEE_FIRST_NAME,
              e.EMP_LAST_NAME as EMPLOYEE_LAST_NAME,
              v.EMP_FST_NAME as VERIFIER_FIRST_NAME,
              v.EMP_LAST_NAME as VERIFIER_LAST_NAME,
              v.JOB_TITLE as VERIFIER_TITLE
       FROM C_FORMS f
       INNER JOIN C_EMP e ON f.EMP_ID = e.empid AND f.ORG_ID = e.orgid
       LEFT JOIN C_EMP v ON f.VERIFIER_ID = v.empid AND f.ORG_ID = v.orgid
       WHERE f.ID = ?`,
      [formId]
    );
    
    if (forms.length === 0) {
      throw new Error('I-9 Form not found');
    }
    
    return forms[0];
  } catch (error) {
    console.error('Error fetching I-9 form details:', error);
    throw new Error('Failed to fetch I-9 form details');
  }
}

/**
 * Fetches the full details of a specific W-9 form.
 */
export async function getW9FormDetails(formId) {
  try {
    const pool = await DBconnection();
    
    // ✅ FIX: Also join verifier info
    const [rows] = await pool.query(
      `SELECT w9.*, 
              e.EMP_FST_NAME, e.EMP_LAST_NAME,
              v.EMP_FST_NAME as VERIFIER_FIRST_NAME,
              v.EMP_LAST_NAME as VERIFIER_LAST_NAME,
              v.JOB_TITLE as VERIFIER_TITLE
       FROM C_FORM_W9 w9
       JOIN C_EMP e ON w9.EMP_ID = e.empid AND w9.ORG_ID = e.orgid
       LEFT JOIN C_EMP v ON w9.VERIFIER_ID = v.empid AND w9.ORG_ID = v.orgid
       WHERE w9.ID = ?`,
      [formId]
    );

    if (rows.length === 0) {
      throw new Error('W-9 Form not found');
    }
    return rows[0];
  } catch (error) {
    console.error('Error fetching W-9 form details:', error);
    throw new Error('Failed to fetch W-9 form details');
  }
}
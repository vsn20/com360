// app/serverActions/forms/verification/actions.js
'use server';

import DBconnection from '@/app/utils/config/db';
// Import necessary fetch functions for details
import { getI983FormDetails as fetchI983Details } from '@/app/serverActions/forms/i983/actions'; // Import I-983 details fetcher

/**
 * Fetches all I-9, W-9, W-4, and I-983 forms for a specific employee for the verification screen.
 */
export async function getEmployeeFormsForVerification(empId, orgId) {
  try {
    const pool = await DBconnection();
    console.log(`Verification: Fetching all forms for EmpID: ${empId}, OrgID: ${orgId}`);

    // Fetch I-9 Forms from C_FORMS
    console.log("Fetching I-9 forms...");
    const [i9Forms] = await pool.query(
      `SELECT f.ID, f.FORM_TYPE, f.FORM_STATUS, f.EMPLOYEE_SIGNATURE_DATE as SUBMITTED_DATE,
             v.EMP_FST_NAME as VERIFIER_FIRST_NAME,
             v.EMP_LAST_NAME as VERIFIER_LAST_NAME,
             f.CREATED_AT, f.UPDATED_AT,
             -- Use EMPLOYEE_SIGNATURE_DATE or CREATED_AT for sorting I-9
             COALESCE(f.EMPLOYEE_SIGNATURE_DATE, f.CREATED_AT) as SORT_DATE
       FROM C_FORMS f
       LEFT JOIN C_EMP v ON f.VERIFIER_ID = v.empid AND f.ORG_ID = v.orgid
       WHERE f.EMP_ID = ? AND f.ORG_ID = ?`,
      [empId, orgId]
    );
     console.log(`Found ${i9Forms.length} I-9 forms.`);

    // Fetch W-9 Forms from C_FORM_W9
    console.log("Fetching W-9 forms...");
    const [w9Forms] = await pool.query(
      `SELECT ID, ORG_ID, EMP_ID, FORM_STATUS, SUBMITTED_AT as SUBMITTED_DATE, 'W9' as FORM_TYPE,
             NULL as VERIFIER_FIRST_NAME,
             NULL as VERIFIER_LAST_NAME,
             CREATED_AT, UPDATED_AT,
             -- Use SUBMITTED_AT or CREATED_AT for sorting W-9
             COALESCE(SUBMITTED_AT, CREATED_AT) as SORT_DATE
       FROM C_FORM_W9 w9
       WHERE w9.EMP_ID = ? AND w9.ORG_ID = ?`,
      [empId, orgId]
    );
     console.log(`Found ${w9Forms.length} W-9 forms.`);

    // Fetch W-4 Forms from C_FORM_W4
    console.log("Fetching W-4 forms...");
    const [w4Forms] = await pool.query(
      `SELECT ID, ORG_ID, EMP_ID, FORM_STATUS, SUBMITTED_AT as SUBMITTED_DATE, 'W4' as FORM_TYPE,
             v.EMP_FST_NAME as VERIFIER_FIRST_NAME,
             v.EMP_LAST_NAME as VERIFIER_LAST_NAME,
             CREATED_AT, UPDATED_AT,
              -- Use SUBMITTED_AT or CREATED_AT for sorting W-4
             COALESCE(SUBMITTED_AT, CREATED_AT) as SORT_DATE
       FROM C_FORM_W4 w4
       LEFT JOIN C_EMP v ON w4.VERIFIER_ID = v.empid AND w4.ORG_ID = v.orgid
       WHERE w4.EMP_ID = ? AND w4.ORG_ID = ?`,
      [empId, orgId]
    );
     console.log(`Found ${w4Forms.length} W-4 forms.`);

    // Fetch I-983 Forms from C_FORM_I983
    console.log("Fetching I-983 forms...");
    // --- Removed comment after SUBMITTED_DATE ---
    const [i983Forms] = await pool.query(
      `SELECT f.ID, f.ORG_ID, f.EMP_ID, f.FORM_STATUS, 'I983' as FORM_TYPE,
             NULL as VERIFIER_FIRST_NAME,
             NULL as VERIFIER_LAST_NAME,
             f.UPDATED_AT, f.CREATED_AT,
             -- Use UPDATED_AT as the primary date for display/sorting I-983
             f.UPDATED_AT as SUBMITTED_DATE,
             f.UPDATED_AT as SORT_DATE
       FROM C_FORM_I983 f
       WHERE f.EMP_ID = ? AND f.ORG_ID = ?`,
      [empId, orgId]
    );
     console.log(`Found ${i983Forms.length} I-983 forms.`);


    // Combine, add unique prefixes, and sort
    const combinedForms = [
        ...i9Forms, // Already has FORM_TYPE, ID, SORT_DATE
        ...w9Forms.map(f => ({ ...f, ID: `W9-${f.ID}` })), // Already has FORM_TYPE, SORT_DATE, ID needs prefix
        ...w4Forms.map(f => ({ ...f, ID: `W4-${f.ID}` })), // Already has FORM_TYPE, SORT_DATE, ID needs prefix
        ...i983Forms.map(f => ({ ...f, ID: `I983-${f.ID}` })) // Already has FORM_TYPE, SORT_DATE, ID needs prefix
    ];

    // Sort by SORT_DATE, most recent first
    combinedForms.sort((a, b) => {
        const dateA = new Date(a.SORT_DATE || a.CREATED_AT || 0); // Fallback to CREATED_AT if SORT_DATE is null
        const dateB = new Date(b.SORT_DATE || b.CREATED_AT || 0); // Fallback to CREATED_AT if SORT_DATE is null
        return dateB - dateA;
    });

    console.log(`Total combined forms fetched: ${combinedForms.length}`);
    return combinedForms;

  } catch (error) {
    console.error('Error fetching employee forms for verification:', error);
    // Rethrow or handle as needed, ensuring error propagation
    throw new Error('Failed to fetch employee forms');
  }
}

/**
 * Fetches only the I-9 forms that are pending verification based on user permissions.
 */
export async function getPendingI9Approvals(orgId, currentEmpId, isAdmin, hasAllData, subordinateIds) {
  try {
    const pool = await DBconnection();
    console.log(`Verification: Fetching PENDING I-9 for OrgID: ${orgId}, User: ${currentEmpId}, isAdmin: ${isAdmin}, hasAll: ${hasAllData}`);

    let query = `
      SELECT f.ID, f.FORM_TYPE, f.FORM_STATUS, f.EMPLOYEE_SIGNATURE_DATE as SUBMITTED_DATE,
             e.EMP_FST_NAME as EMPLOYEE_FIRST_NAME,
             e.EMP_LAST_NAME as EMPLOYEE_LAST_NAME,
             v.EMP_FST_NAME as VERIFIER_FIRST_NAME,
             v.EMP_LAST_NAME as VERIFIER_LAST_NAME,
             f.CREATED_AT, f.UPDATED_AT,
             COALESCE(f.EMPLOYEE_SIGNATURE_DATE, f.CREATED_AT) as SORT_DATE
      FROM C_FORMS f
      INNER JOIN C_EMP e ON f.EMP_ID = e.empid AND f.ORG_ID = e.orgid
      LEFT JOIN C_EMP v ON f.VERIFIER_ID = v.empid AND f.ORG_ID = v.orgid
      WHERE f.ORG_ID = ? AND f.FORM_STATUS = 'EMPLOYEE_SUBMITTED'
    `;

    const params = [orgId];

    if (!isAdmin) {
      if (hasAllData) {
        // User with 'alldata' sees all pending forms except their own.
        query += ` AND f.EMP_ID != ?`;
        params.push(currentEmpId);
      } else if (hasTeamData) {
        // User with 'teamdata' sees only their subordinates' forms.
        if (subordinateIds && subordinateIds.length > 0) {
          // Ensure subordinates are formatted correctly for IN clause if needed
          const placeholders = subordinateIds.map(() => '?').join(',');
          query += ` AND f.EMP_ID IN (${placeholders})`;
          params.push(...subordinateIds);
        } else {
          console.log("No subordinates found, returning empty for team data.");
          return []; // No subordinates, no pending forms to see.
        }
      } else {
         console.log("User has neither admin, alldata, nor teamdata permission for pending I-9s.");
         return []; // No relevant permissions
      }
    } else {
       console.log("Admin fetching all pending I-9s.");
    }

    query += ` ORDER BY SORT_DATE DESC`;

    const [forms] = await pool.query(query, params);
     console.log(`Found ${forms.length} pending I-9 forms.`);
    return forms;
  } catch (error) {
    console.error('Error fetching pending I-9 approvals:', error);
    throw new Error('Failed to fetch pending I-9 approvals');
  }
}

/**
 * W-9 forms are no longer verified in this workflow.
 * Returns an empty array.
 */
export async function getPendingW9Approvals(orgId, currentEmpId, isAdmin, hasAllData, subordinateIds) {
    console.log("Verification: getPendingW9Approvals called (returns empty array).");
    return [];
}

/**
 * Fetches only the W-4 forms that are pending verification based on user permissions.
 */
export async function getPendingW4Approvals(orgId, currentEmpId, isAdmin, hasAllData, subordinateIds) {
  try {
    const pool = await DBconnection();
     console.log(`Verification: Fetching PENDING W-4 for OrgID: ${orgId}, User: ${currentEmpId}, isAdmin: ${isAdmin}, hasAll: ${hasAllData}`);

    let query = `
      SELECT f.ID, 'W4' as FORM_TYPE, f.FORM_STATUS, f.SUBMITTED_AT as SUBMITTED_DATE,
             e.EMP_FST_NAME as EMPLOYEE_FIRST_NAME,
             e.EMP_LAST_NAME as EMPLOYEE_LAST_NAME,
             v.EMP_FST_NAME as VERIFIER_FIRST_NAME,
             v.EMP_LAST_NAME as VERIFIER_LAST_NAME,
             f.CREATED_AT, f.UPDATED_AT,
             COALESCE(f.SUBMITTED_AT, f.CREATED_AT) as SORT_DATE
      FROM C_FORM_W4 f
      INNER JOIN C_EMP e ON f.EMP_ID = e.empid AND f.ORG_ID = e.orgid
      LEFT JOIN C_EMP v ON f.VERIFIER_ID = v.empid AND f.ORG_ID = v.orgid
      WHERE f.ORG_ID = ? AND f.FORM_STATUS = 'SUBMITTED'
    `;

    const params = [orgId];

     if (!isAdmin) {
      if (hasAllData) {
        query += ` AND f.EMP_ID != ?`;
        params.push(currentEmpId);
      } else if (hasTeamData) {
        if (subordinateIds && subordinateIds.length > 0) {
          const placeholders = subordinateIds.map(() => '?').join(',');
          query += ` AND f.EMP_ID IN (${placeholders})`;
          params.push(...subordinateIds);
        } else {
          console.log("No subordinates found, returning empty for team data.");
          return [];
        }
      } else {
         console.log("User has neither admin, alldata, nor teamdata permission for pending W-4s.");
         return [];
      }
    } else {
       console.log("Admin fetching all pending W-4s.");
    }


    query += ` ORDER BY SORT_DATE DESC`;

    const [forms] = await pool.query(query, params);
     console.log(`Found ${forms.length} pending W-4 forms.`);
    return forms;
  } catch (error) {
    console.error('Error fetching pending W-4 approvals:', error);
    throw new Error('Failed to fetch pending W-4 approvals');
  }
}

/**
 * Fetches I-983 forms pending employer action based on user permissions.
 * UPDATED: "Pending" now means 'DRAFT' as all other steps are removed.
 */
export async function getPendingI983Approvals(orgId, currentEmpId, isAdmin, hasAllData, subordinateIds) {
  try {
    const pool = await DBconnection();
     console.log(`Verification: Fetching PENDING I-983 for OrgID: ${orgId}, User: ${currentEmpId}, isAdmin: ${isAdmin}, hasAll: ${hasAllData}`);

    // Define statuses where employer action is needed
    // In the new workflow, only 'DRAFT' is a pending state.
    const employerActionStatuses = [
        'DRAFT'
    ];

    let query = `
      SELECT f.ID, 'I983' as FORM_TYPE, f.FORM_STATUS, f.UPDATED_AT as SUBMITTED_DATE,
             e.EMP_FST_NAME as EMPLOYEE_FIRST_NAME,
             e.EMP_LAST_NAME as EMPLOYEE_LAST_NAME,
             NULL as VERIFIER_FIRST_NAME, -- No single verifier for I-983 workflow stages
             NULL as VERIFIER_LAST_NAME,
             f.CREATED_AT, f.UPDATED_AT,
             f.UPDATED_AT as SORT_DATE
      FROM C_FORM_I983 f
      INNER JOIN C_EMP e ON f.EMP_ID = e.empid AND f.ORG_ID = e.orgid
      WHERE f.ORG_ID = ? AND f.FORM_STATUS IN (?)
    `;

    const params = [orgId, employerActionStatuses];

     if (!isAdmin) {
      if (hasAllData) {
        query += ` AND f.EMP_ID != ?`;
        params.push(currentEmpId);
      } else if (hasTeamData) {
        if (subordinateIds && subordinateIds.length > 0) {
          const placeholders = subordinateIds.map(() => '?').join(',');
          query += ` AND f.EMP_ID IN (${placeholders})`;
          params.push(...subordinateIds);
        } else {
           console.log("No subordinates found, returning empty for team data.");
          return [];
        }
      } else {
         console.log("User has neither admin, alldata, nor teamdata permission for pending I-983s.");
         return [];
      }
    } else {
       console.log("Admin fetching all pending I-983s.");
    }

    query += ` ORDER BY SORT_DATE DESC`;

    const [forms] = await pool.query(query, params);
     console.log(`Found ${forms.length} pending I-983 forms (DRAFT).`);
    return forms;
  } catch (error) {
    console.error('Error fetching pending I-983 approvals:', error);
    throw new Error('Failed to fetch pending I-983 approvals');
  }
}


/**
 * Fetches the full details of a specific I-9 form.
 */
export async function getI9FormDetails(formId) {
  try {
    const pool = await DBconnection();
    console.log(`Verification: Fetching details for I-9 form ID: ${formId}`);

     const numericFormId = parseInt(formId);
     if (isNaN(numericFormId) || numericFormId <= 0) throw new Error("Invalid I-9 Form ID.");

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
      [numericFormId]
    );

    if (forms.length === 0) {
      throw new Error(`I-9 Form ${numericFormId} not found`);
    }

    console.log(`✅ Details fetched for I-9 form ID: ${numericFormId}`);
    return forms[0]; // Already includes FORM_TYPE from DB
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
     console.log(`Verification: Fetching details for W-9 form ID: ${formId}`);

     const numericFormId = parseInt(formId);
     if (isNaN(numericFormId) || numericFormId <= 0) throw new Error("Invalid W-9 Form ID.");

    // W-9 doesn't have a verifier concept in the same way, so no join needed
    const [rows] = await pool.query(
      `SELECT w9.*,
             e.EMP_FST_NAME, e.EMP_LAST_NAME,
             NULL as VERIFIER_FIRST_NAME,
             NULL as VERIFIER_LAST_NAME,
             NULL as VERIFIER_TITLE
       FROM C_FORM_W9 w9
       JOIN C_EMP e ON w9.EMP_ID = e.empid AND w9.ORG_ID = e.orgid
       WHERE w9.ID = ?`,
      [numericFormId]
    );

    if (rows.length === 0) {
      throw new Error(`W-9 Form ${numericFormId} not found`);
    }

    console.log(`✅ Details fetched for W-9 form ID: ${numericFormId}`);
    return rows[0]; // Add FORM_TYPE manually if needed, DB doesn't have it
  } catch (error) {
    console.error('Error fetching W-9 form details:', error);
    throw new Error('Failed to fetch W-9 form details');
  }
}

/**
 * Fetches the full details of a specific W-4 form.
 */
export async function getW4FormDetails(formId) {
  try {
    const pool = await DBconnection();
     console.log(`Verification: Fetching details for W-4 form ID: ${formId}`);

     const numericFormId = parseInt(formId);
     if (isNaN(numericFormId) || numericFormId <= 0) throw new Error("Invalid W-4 Form ID.");

    const [rows] = await pool.query(
      `SELECT w4.*,
             e.EMP_FST_NAME, e.EMP_LAST_NAME,
             v.EMP_FST_NAME as VERIFIER_FIRST_NAME,
             v.EMP_LAST_NAME as VERIFIER_LAST_NAME,
             v.JOB_TITLE as VERIFIER_TITLE
       FROM C_FORM_W4 w4
       JOIN C_EMP e ON w4.EMP_ID = e.empid AND w4.ORG_ID = e.orgid
       LEFT JOIN C_EMP v ON w4.VERIFIER_ID = v.empid AND w4.ORG_ID = v.orgid
       WHERE w4.ID = ?`,
      [numericFormId]
    );

    if (rows.length === 0) {
      throw new Error(`W-4 Form ${numericFormId} not found`);
    }

     console.log(`✅ Details fetched for W-4 form ID: ${numericFormId}`);
    return rows[0]; // Add FORM_TYPE manually if needed
  } catch (error) {
    console.error('Error fetching W-4 form details:', error);
    throw new Error('Failed to fetch W-4 form details');
  }
}

/**
 * Fetches the full details of a specific I-983 form.
 * This function delegates to the main I-983 action file for consistency.
 */
export async function getI983FormDetails(formId) {
     console.log(`Verification: Delegating fetch details for I-983 form ID: ${formId}`);
     // formId here might still have the prefix 'I983-'
     const numericFormId = parseInt(String(formId).replace('I983-', ''));
     if (isNaN(numericFormId) || numericFormId <= 0) throw new Error("Invalid I-983 Form ID.");
     // Call the actual function using the numeric ID
     return fetchI983Details(numericFormId);
}
// src/app/serverActions/forms/i983/actions.js
// @ts-nocheck
'use server';

import DBconnection from '@/app/utils/config/db';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
// Ensure all necessary pdf-lib components are imported
import { PDFDocument, StandardFonts, rgb, PDFRadioGroup } from 'pdf-lib';
import { cookies } from 'next/headers';
import { fetchEmployeeById } from '@/app/serverActions/Employee/overview'; // Assuming path is correct

// --- Utility Functions ---

const formatDate = (date) => {
    // Format YYYY-MM-DD for database
    if (!date || isNaN(new Date(date))) return null;
    try {
        const d = new Date(date);
        const year = d.getUTCFullYear();
        const month = String(d.getUTCMonth() + 1).padStart(2, '0');
        const day = String(d.getUTCDate()).padStart(2, '0');
        if (year < 1900 || year > 2100) return null; // Basic year validation
        return `${year}-${month}-${day}`;
    } catch (e) {
        console.warn("Error formatting date for DB:", e);
        return null;
    }
};

const formatPdfDate = (date) => {
    // Format MM/DD/YYYY for PDF display
    if (!date) return '';
    try {
        const d = new Date(date);
        const adjustedDate = new Date(d.getTime() + d.getTimezoneOffset() * 60000);
        const month = String(adjustedDate.getUTCMonth() + 1).padStart(2, '0');
        const day = String(adjustedDate.getUTCDate()).padStart(2, '0');
        const year = adjustedDate.getUTCFullYear();
        return year > 1900 && year < 2100 ? `${month}/${day}/${year}` : '';
    } catch (e) {
        console.warn("Error formatting PDF date:", e);
        return '';
    }
};

// Decode JWT to get user ID
const decodeJwt = (token) => {
    try {
        if (!token) return null;
        const base64Url = token.split('.')[1];
        if (!base64Url) return null;
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = Buffer.from(base64, 'base64').toString('utf8');
        const decoded = JSON.parse(jsonPayload);
        // Look for common user ID claims, adjust as needed
        return decoded.userId || decoded.empid || decoded.sub || null;
    } catch (error) {
        console.error('Error decoding JWT:', error);
        return null;
    }
};

// Upload signature with specific naming convention for I-983
async function uploadI983Signature(base64Data, formId, signatureIdentifier) {
    try {
        console.log(`📝 Uploading I-983 signature for form ID: ${formId}, Type: ${signatureIdentifier}`);
        if (!formId || isNaN(parseInt(formId)) || parseInt(formId) <= 0 || !signatureIdentifier) {
            console.error(`❌ ERROR in uploadI983Signature: Invalid formId (${formId}) or signatureIdentifier (${signatureIdentifier}).`);
            throw new Error('Form ID and Signature Identifier are required.');
        }
        if (!base64Data) {
            throw new Error(`Signature data missing for ${signatureIdentifier}.`);
        }
        const base64Image = base64Data.replace(/^data:image\/\w+;base64,/, '');
        const buffer = Buffer.from(base64Image, 'base64');
        if (buffer.length === 0) throw new Error("Empty signature data received.");
        if (buffer.length > 5 * 1024 * 1024) throw new Error('Signature file too large (max 5MB)');
        const publicDir = path.join(process.cwd(), 'public', 'signatures');
        await fs.mkdir(publicDir, { recursive: true });
        const filename = `form_i983_${formId}_${signatureIdentifier}.png`;
        const filePath = path.join(publicDir, filename);
        await fs.writeFile(filePath, buffer);
        console.log('✅ I-983 Signature saved:', filename);
        return { success: true, path: `/signatures/${filename}` };
    } catch (error) {
        console.error(`❌ Error uploading I-983 signature (${signatureIdentifier}):`, error);
        return { success: false, error: error.message };
    }
}

// Delete I-983 signature file(s)
async function deleteI983Signatures(formId) {
    try {
        if (!formId) return { success: true, message: "No form ID, skipping delete." };
        console.log(`🗑️ Deleting signatures for I-983 form ID: ${formId}`);
        const publicDir = path.join(process.cwd(), 'public', 'signatures');
        const prefix = `form_i983_${formId}_`;
        let deletedCount = 0;
        let files;
        try {
            files = await fs.readdir(publicDir);
        } catch (readErr) {
            if (readErr.code === 'ENOENT') {
                console.log('ℹ️ Signatures directory not found, nothing to delete.');
                return { success: true, message: 'Directory not found.' };
            }
            throw readErr; // Re-throw other errors
        }
        for (const file of files) {
            if (file.startsWith(prefix) && file.endsWith('.png')) {
                const filePath = path.join(publicDir, file);
                try {
                    await fs.unlink(filePath);
                    console.log('  ✅ Deleted:', file);
                    deletedCount++;
                } catch (err) {
                    if (err.code !== 'ENOENT') {
                       console.warn('  ⚠️ Could not delete file:', file, err.message);
                    }
                }
            }
        }
        console.log(`✅ Finished deleting signatures. ${deletedCount} file(s) removed.`);
        return { success: true };
    } catch (error) {
        console.error('❌ Error deleting I-983 signatures:', error);
        return { success: false, error: error.message };
    }
}

// --- Public-Facing Server Actions ---

// Fetch ALL I-983 forms for an employee (basic info for list)
export async function fetchI983FormsByEmpId(empId, orgId) {
    const pool = await DBconnection();
    try {
        console.log(`Fetching I-983 forms for EmpID: ${empId}, OrgID: ${orgId}`);
        const [rows] = await pool.query(
            `SELECT ID, ORG_ID, EMP_ID, FORM_STATUS, UPDATED_AT, CREATED_AT
             FROM C_FORM_I983
             WHERE EMP_ID = ? AND ORG_ID = ? ORDER BY CREATED_AT DESC`,
            [empId, orgId]
        );
        console.log(`Found ${rows.length} I-983 forms.`);
        return rows.map(row => ({ ...row, FORM_TYPE: 'I983' }));
    } catch (error) {
        console.error('❌ Error fetching I-983 forms:', error);
        throw new Error('Failed to fetch I-983 forms');
    }
}

// Fetch a SINGLE I-983 form by its ID (detailed info)
export async function getI983FormDetails(formId) {
    const pool = await DBconnection();
    try {
        const numericFormIdStr = String(formId).replace('I983-', ''); // Handle potential prefix
        const numericFormId = parseInt(numericFormIdStr);

        if (isNaN(numericFormId) || numericFormId <= 0) throw new Error("Invalid I-983 Form ID format.");
        console.log(`Fetching details for I-983 form ID: ${numericFormId}`);

        const query = `
            SELECT i983.*,
                   e.EMP_FST_NAME as EMPLOYEE_FIRST_NAME, e.EMP_LAST_NAME as EMPLOYEE_LAST_NAME
            FROM C_FORM_I983 i983
            JOIN C_EMP e ON i983.EMP_ID = e.empid AND i983.ORG_ID = e.orgid
            WHERE i983.ID = ?
        `;
        const [rows] = await pool.query(query, [numericFormId]);
        if (rows.length === 0) {
            throw new Error(`I-983 form with ID ${numericFormId} not found.`);
        }
        console.log(`✅ Details fetched successfully for I-983 form ID: ${numericFormId}`);
        return { ...rows[0], FORM_TYPE: 'I983' };
    } catch (error) {
        console.error(`❌ Error fetching I-983 form details for ID ${formId}:`, error);
        throw new Error(`Failed to fetch I-983 form details: ${error.message}`);
    }
}


// Check if an I-983 form is in DRAFT status (basic edit permission)
export async function canEditI983Form(formId) { // Removed unused userId, isAdmin
    try {
        const pool = await DBconnection();
        const numericFormIdStr = String(formId).replace('I983-','');
        const numericFormId = parseInt(numericFormIdStr);
        if (isNaN(numericFormId) || numericFormId <= 0) return { canEdit: false, reason: 'Invalid Form ID' };

        const [rows] = await pool.query('SELECT FORM_STATUS FROM C_FORM_I983 WHERE ID = ?', [numericFormId]);
        if (rows.length === 0) {
            return { canEdit: false, reason: 'Form not found' };
        }
        const form = rows[0];
        if (form.FORM_STATUS !== 'DRAFT') {
            return { canEdit: false, reason: 'Only draft forms can be fully edited.' };
        }
        return { canEdit: true };
    } catch (error) {
        console.error(`❌ Error checking I-983 edit permission for ID ${formId}:`, error)
        return { canEdit: false, reason: 'Error checking permissions.' };
    }
}

// *** UPDATED Status Transition Logic ***
const determineNextStatus = (currentStatus, action) => {
    if (action === 'save') return 'DRAFT'; // Saving always results in DRAFT

    switch (currentStatus) {
        // Step-by-step transitions based on user request
        case 'DRAFT': return 'PAGE1_COMPLETE'; // Student submits Sec 1&2
        case 'PAGE1_COMPLETE': return 'PAGE2_COMPLETE'; // Verifier submits Sec 3&4
        case 'PAGE2_COMPLETE': return 'PAGE3_SEC5_NAMES_COMPLETE'; // Student submits names
        case 'PAGE3_SEC5_NAMES_COMPLETE': return 'PAGE3_SEC5_SITE_COMPLETE'; // Verifier submits site info
        case 'PAGE3_SEC5_SITE_COMPLETE': return 'PAGE3_SEC5_TRAINING_COMPLETE'; // Student submits role/goals
        case 'PAGE3_SEC5_TRAINING_COMPLETE': return 'PAGE3_SEC5_OVERSIGHT_COMPLETE'; // Verifier submits oversight/measures/remarks
        case 'PAGE3_SEC5_OVERSIGHT_COMPLETE': return 'PAGE4_SEC6_COMPLETE'; // Verifier signs Sec 6

        // Evaluation Workflow
        case 'PAGE4_SEC6_COMPLETE': return 'EVAL1_PENDING_STUDENT_SIGNATURE'; // Verifier initiates Eval 1 (submits dates/text)
        case 'EVAL1_PENDING_STUDENT_SIGNATURE': return 'EVAL1_PENDING_EMPLOYER_SIGNATURE'; // Student signs Eval 1
        case 'EVAL1_PENDING_EMPLOYER_SIGNATURE': return 'EVAL1_COMPLETE'; // Verifier signs Eval 1
        case 'EVAL1_COMPLETE': return 'EVAL2_PENDING_STUDENT_SIGNATURE'; // Verifier initiates Eval 2 (submits dates/text)
        case 'EVAL2_PENDING_STUDENT_SIGNATURE': return 'EVAL2_PENDING_EMPLOYER_SIGNATURE'; // Student signs Eval 2
        case 'EVAL2_PENDING_EMPLOYER_SIGNATURE': return 'FORM_COMPLETED'; // Verifier signs Eval 2

        // Handle old statuses encountered during transition (map them if needed)
        case 'STUDENT_SEC1_2_COMPLETE': return 'PAGE2_COMPLETE';
        case 'EMPLOYER_SEC3_4_COMPLETE': return 'PAGE3_SEC5_NAMES_COMPLETE';
        case 'STUDENT_SEC5_NAMES_COMPLETE': return 'PAGE3_SEC5_SITE_COMPLETE';
        case 'EMPLOYER_SEC5_SITE_COMPLETE': return 'PAGE3_SEC5_TRAINING_COMPLETE';
        case 'STUDENT_SEC5_TRAINING_COMPLETE': return 'PAGE3_SEC5_OVERSIGHT_COMPLETE';
        case 'EMPLOYER_SEC5_EVAL_COMPLETE': return 'PAGE4_SEC6_COMPLETE';
        case 'EMPLOYER_SEC6_COMPLETE': return 'EVAL1_PENDING_STUDENT_SIGNATURE';

        default:
            console.warn(`Unexpected current status in determineNextStatus: ${currentStatus}`);
            return currentStatus; // Stay in the same state if unknown or already completed
    }
};

// *** CORRECTED Main Save/Update Function ***
export async function saveOrUpdateI983Form(payload, formId = null) {
    const pool = await DBconnection();
    let connection;
    // Extract action and signature_data, keeping the rest in formData
    const { action, signature_data, ...formData } = payload;
    let currentFormId = formId ? parseInt(String(formId).replace('I983-', '')) : null;
    if (currentFormId && isNaN(currentFormId)) currentFormId = null; // Ensure null if parsing failed

    // --- FIX: Initialize isNewRecord based on initial formId check ---
    let isNewRecord = !currentFormId;

    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();
        console.log(`Starting ${action} for I983 Form ID: ${currentFormId || 'NEW'}`);

        // --- 1. Get User ID ---
        const cookieStore = cookies();
        const token = cookieStore.get('jwt_token')?.value;
        const userId = decodeJwt(token); // Use helper
        if (!userId) throw new Error('Authentication failed. Unable to identify user.');

        // --- 2. Determine Current Status ---
        let currentStatus = 'DRAFT';
        if (currentFormId) { // Only query if we started with a potentially valid ID
            const [statusRows] = await connection.query('SELECT FORM_STATUS FROM C_FORM_I983 WHERE ID = ? FOR UPDATE', [currentFormId]);
            if (statusRows.length > 0) {
                currentStatus = statusRows[0].FORM_STATUS;
                isNewRecord = false; // Record found, definitely not new
            } else if (action === 'save') {
                // ID provided but not found, treat as new draft insert
                console.warn(`Form ID ${currentFormId} provided but not found. Treating as new draft.`);
                currentFormId = null; // Nullify ID for insert logic below
                currentStatus = 'DRAFT';
                isNewRecord = true; // Mark as new record
            } else {
                // ID provided for submit but not found
                throw new Error(`Form with ID ${formId} not found during update.`);
            }
        }
        // If no currentFormId initially, isNewRecord is true and currentStatus is DRAFT

        // --- Determine Next Status ---
        const isSubmitAction = action === 'submit';
        const nextStatus = determineNextStatus(currentStatus, action);
        console.log(`Current Status: ${currentStatus}, Action: ${action}, Next Status: ${nextStatus}`);

        if (isSubmitAction && nextStatus === currentStatus && currentStatus !== 'FORM_COMPLETED') {
             if (currentStatus === 'FORM_COMPLETED') throw new Error("Form is already completed.");
             console.warn(`Submit action resulted in no status change from ${currentStatus}.`);
        }

        // --- 3. Prepare Data for DB ---
        const dbData = {};
        const allowedColumns = [ /* Full list from schema */
            'ORG_ID', 'EMP_ID', 'FORM_STATUS', 'STUDENT_NAME', 'STUDENT_EMAIL', 'SCHOOL_RECOMMENDING', 'SCHOOL_DEGREE_EARNED', 'SCHOOL_CODE_RECOMMENDING', 'DSO_NAME_CONTACT', 'STUDENT_SEVIS_ID', 'STEM_OPT_START_DATE', 'STEM_OPT_END_DATE', 'QUALIFYING_MAJOR_CIP', 'QUALIFYING_DEGREE_LEVEL', 'QUALIFYING_DEGREE_DATE', 'BASED_ON_PRIOR_DEGREE', 'EMPLOYMENT_AUTH_NUMBER', 'STUDENT_SIGNATURE_URL', 'STUDENT_SIGNATURE_DATE', 'STUDENT_PRINTED_NAME', 'EMPLOYER_NAME', 'EMPLOYER_WEBSITE', 'EMPLOYER_EIN', 'EMPLOYER_STREET_ADDRESS', 'EMPLOYER_SUITE', 'EMPLOYER_CITY', 'EMPLOYER_STATE', 'EMPLOYER_ZIP', 'EMPLOYER_NUM_FT_EMPLOYEES', 'EMPLOYER_NAICS_CODE', 'OPT_HOURS_PER_WEEK', 'START_DATE_OF_EMPLOYMENT', 'SALARY_AMOUNT', 'SALARY_FREQUENCY', 'OTHER_COMPENSATION_1', 'OTHER_COMPENSATION_2', 'OTHER_COMPENSATION_3', 'OTHER_COMPENSATION_4', 'EMPLOYER_OFFICIAL_SIGNATURE_URL', 'EMPLOYER_OFFICIAL_PRINTED_NAME_TITLE', 'EMPLOYER_OFFICIAL_SIGNATURE_DATE', 'EMPLOYER_PRINTED_NAME_ORG', 'EMPLOYER_VERIFIER_ID', 'SEC5_STUDENT_NAME', 'SEC5_EMPLOYER_NAME', 'SEC5_SITE_NAME', 'SEC5_SITE_ADDRESS', 'SEC5_OFFICIAL_NAME', 'SEC5_OFFICIAL_TITLE', 'SEC5_OFFICIAL_EMAIL', 'SEC5_OFFICIAL_PHONE', 'SEC5_STUDENT_ROLE', 'SEC5_GOALS_OBJECTIVES', 'SEC5_EMPLOYER_OVERSIGHT', 'SEC5_MEASURES_ASSESSMENTS', 'SEC5_ADDITIONAL_REMARKS', 'EMPLOYER_OFFICIAL_SEC6_SIGNATURE_URL', 'EMPLOYER_OFFICIAL_SEC6_PRINTED_NAME_TITLE', 'EMPLOYER_OFFICIAL_SEC6_SIGNATURE_DATE', 'EMPLOYER_VERIFIER_ID_SEC6', 'EVAL1_FROM_DATE', 'EVAL1_TO_DATE', 'EVAL1_STUDENT_EVALUATION', 'EVAL1_STUDENT_SIGNATURE_URL', 'EVAL1_STUDENT_SIGNATURE_DATE', 'EVAL1_EMPLOYER_SIGNATURE_URL', 'EVAL1_EMPLOYER_SIGNATURE_DATE', 'EVAL1_EMPLOYER_VERIFIER_ID', 'EVAL2_FROM_DATE', 'EVAL2_TO_DATE', 'EVAL2_STUDENT_EVALUATION', 'EVAL2_STUDENT_SIGNATURE_URL', 'EVAL2_STUDENT_SIGNATURE_DATE', 'EVAL2_EMPLOYER_SIGNATURE_URL', 'EVAL2_EMPLOYER_SIGNATURE_DATE', 'EVAL2_EMPLOYER_VERIFIER_ID', 'CREATED_BY', 'UPDATED_BY'
        ];

        for (const key in formData) { // Iterate over the data passed in the payload
            const dbKey = key.toUpperCase();
            if (allowedColumns.includes(dbKey)) {
                let value = formData[key];
                if (dbKey.endsWith('_DATE') && value) { dbData[dbKey] = formatDate(value); }
                else if (dbKey === 'BASED_ON_PRIOR_DEGREE') { dbData[dbKey] = value ? 1 : 0; }
                else if (key === 'salary_amount' && (value === '' || value === null || isNaN(parseFloat(value)))) { dbData[dbKey] = null; }
                else if (['employer_num_ft_employees', 'opt_hours_per_week'].includes(key.toLowerCase()) && (value === '' || value === null || isNaN(parseInt(value)))) { dbData[dbKey] = null; }
                else { dbData[dbKey] = (value === '' && !['ID', 'ORG_ID', 'EMP_ID'].includes(dbKey)) ? null : value; } // Store other empty strings as NULL
            }
        }
        dbData.FORM_STATUS = nextStatus;
        dbData.UPDATED_BY = userId;

        // --- 4. Database Insert / Update ---
        let dbResult;
        let finalFormId = currentFormId; // Use a separate variable for the ID after insert/update

        if (!isNewRecord) { // UPDATE
            const updateFields = Object.keys(dbData).filter(k => !['ORG_ID', 'EMP_ID', 'CREATED_BY', 'CREATED_AT'].includes(k));
            if (updateFields.length > 0) {
                const setClause = updateFields.map(key => `${key} = ?`).join(', ');
                const updateValues = updateFields.map(key => dbData[key]);
                const updateQuery = `UPDATE C_FORM_I983 SET ${setClause}, UPDATED_AT = NOW() WHERE ID = ?`;
                [dbResult] = await connection.query(updateQuery, [...updateValues, finalFormId]);
                if (dbResult.affectedRows === 0 && isSubmitAction) throw new Error(`Form ID ${finalFormId} not found or no changes during submit.`);
                console.log(`✅ I-983 Form ${finalFormId} updated. Status: ${currentStatus} -> ${nextStatus}`);
            } else { console.log("No data fields to update."); }
        } else { // INSERT
            dbData.ORG_ID = formData.orgid; dbData.EMP_ID = formData.emp_id; dbData.CREATED_BY = userId;
            const insertDataFiltered = {}; allowedColumns.forEach(col => { if (dbData.hasOwnProperty(col)) insertDataFiltered[col] = dbData[col]; });
            // Ensure essential FKs are present even if not in formData explicitly for insert
            if (!insertDataFiltered.ORG_ID) insertDataFiltered.ORG_ID = formData.orgid;
            if (!insertDataFiltered.EMP_ID) insertDataFiltered.EMP_ID = formData.emp_id;
            if (!insertDataFiltered.CREATED_BY) insertDataFiltered.CREATED_BY = userId;
            if (!insertDataFiltered.FORM_STATUS) insertDataFiltered.FORM_STATUS = nextStatus; // Ensure status is set

            const insertFields = Object.keys(insertDataFiltered); const placeholders = insertFields.map(() => '?').join(', ');
            const insertValues = insertFields.map(key => insertDataFiltered[key]);
            const insertQuery = `INSERT INTO C_FORM_I983 (${insertFields.join(', ')}, CREATED_AT) VALUES (${placeholders}, NOW())`;
            [dbResult] = await connection.query(insertQuery, insertValues);
            if (!dbResult || !dbResult.insertId) throw new Error("DB error: Failed to insert new form.");
            finalFormId = dbResult.insertId; // Get the new ID
            console.log(`✅ New I-983 Form ${finalFormId} created. Status: ${dbData.FORM_STATUS}`);
        }

        if (!finalFormId || isNaN(finalFormId) || finalFormId <= 0) { throw new Error("Failed to get a valid Form ID."); }

        // --- 6. Handle Signature Upload ---
        let signatureIdentifier = null; let signatureUrlField = null; let signatureDateField = null;
        let signatureDateValue = null; let verifierIdColumn = null; let signatureResult = null;

        switch (nextStatus) {
            case 'PAGE1_COMPLETE': signatureIdentifier = 'student_sec2'; signatureUrlField = 'STUDENT_SIGNATURE_URL'; signatureDateField = 'STUDENT_SIGNATURE_DATE'; signatureDateValue = dbData.STUDENT_SIGNATURE_DATE; break;
            case 'PAGE2_COMPLETE': signatureIdentifier = 'employer_sec4'; signatureUrlField = 'EMPLOYER_OFFICIAL_SIGNATURE_URL'; signatureDateField = 'EMPLOYER_OFFICIAL_SIGNATURE_DATE'; signatureDateValue = dbData.EMPLOYER_OFFICIAL_SIGNATURE_DATE; verifierIdColumn = 'EMPLOYER_VERIFIER_ID'; break;
            case 'PAGE4_SEC6_COMPLETE': signatureIdentifier = 'employer_sec6'; signatureUrlField = 'EMPLOYER_OFFICIAL_SEC6_SIGNATURE_URL'; signatureDateField = 'EMPLOYER_OFFICIAL_SEC6_SIGNATURE_DATE'; signatureDateValue = dbData.EMPLOYER_OFFICIAL_SEC6_SIGNATURE_DATE; verifierIdColumn = 'EMPLOYER_VERIFIER_ID_SEC6'; break;
            case 'EVAL1_PENDING_STUDENT_SIGNATURE': break; // No sig saved on Verifier initiation
            case 'EVAL1_PENDING_EMPLOYER_SIGNATURE': signatureIdentifier = 'student_eval1'; signatureUrlField = 'EVAL1_STUDENT_SIGNATURE_URL'; signatureDateField = 'EVAL1_STUDENT_SIGNATURE_DATE'; signatureDateValue = dbData.EVAL1_STUDENT_SIGNATURE_DATE; break;
            case 'EVAL1_COMPLETE': signatureIdentifier = 'employer_eval1'; signatureUrlField = 'EVAL1_EMPLOYER_SIGNATURE_URL'; signatureDateField = 'EVAL1_EMPLOYER_SIGNATURE_DATE'; signatureDateValue = dbData.EVAL1_EMPLOYER_SIGNATURE_DATE; verifierIdColumn = 'EVAL1_EMPLOYER_VERIFIER_ID'; break;
            case 'EVAL2_PENDING_STUDENT_SIGNATURE': break; // No sig saved on Verifier initiation
            case 'EVAL2_PENDING_EMPLOYER_SIGNATURE': signatureIdentifier = 'student_eval2'; signatureUrlField = 'EVAL2_STUDENT_SIGNATURE_URL'; signatureDateField = 'EVAL2_STUDENT_SIGNATURE_DATE'; signatureDateValue = dbData.EVAL2_STUDENT_SIGNATURE_DATE; break;
            case 'FORM_COMPLETED': signatureIdentifier = 'employer_eval2'; signatureUrlField = 'EVAL2_EMPLOYER_SIGNATURE_URL'; signatureDateField = 'EVAL2_EMPLOYER_SIGNATURE_DATE'; signatureDateValue = dbData.EVAL2_EMPLOYER_SIGNATURE_DATE; verifierIdColumn = 'EVAL2_EMPLOYER_VERIFIER_ID'; break;
        }

        if (signatureIdentifier && signature_data) {
            console.log(`Uploading ${signatureIdentifier} sig for form ${finalFormId}...`);
            signatureResult = await uploadI983Signature(signature_data, finalFormId, signatureIdentifier);
            if (signatureResult.success && signatureUrlField && signatureDateField) {
                let updateSigQuery = `UPDATE C_FORM_I983 SET ${signatureUrlField} = ?, ${signatureDateField} = ?`;
                const updateSigValues = [signatureResult.path, signatureDateValue];
                if (verifierIdColumn) { updateSigQuery += `, ${verifierIdColumn} = ?`; updateSigValues.push(userId); }
                updateSigQuery += ` WHERE ID = ?`; updateSigValues.push(finalFormId);
                await connection.query(updateSigQuery, updateSigValues);
                console.log(`✅ ${signatureIdentifier} sig details updated.`);
            } else { throw new Error(`Sig upload failed: ${signatureResult?.error}. Rolling back.`); }
        } else if (signatureIdentifier && !signature_data && isSubmitAction) {
            // Check if sig was required based on who is likely acting
            let sigWasRequired = (
                // Student actions
                (nextStatus === 'PAGE1_COMPLETE' || nextStatus === 'EVAL1_PENDING_EMPLOYER_SIGNATURE' || nextStatus === 'EVAL2_PENDING_EMPLOYER_SIGNATURE') ||
                // Verifier actions
                (nextStatus === 'PAGE2_COMPLETE' || nextStatus === 'PAGE4_SEC6_COMPLETE' || nextStatus === 'EVAL1_COMPLETE' || nextStatus === 'FORM_COMPLETED')
            );
            // This is a simplified check. A more robust way would be to pass the user's role (student/verifier) in the payload.
            // For now, if a signature *could* have been required for this transition, and it's missing, throw error.
            if (sigWasRequired) { throw new Error(`Signature required for ${signatureIdentifier}. Rolling back.`); }
        }

        // --- 7. Generate PDF on EVERY Submit Step ---
        let pdfBytesForUpload = null;
        let pdfFormData = null;
        if (isSubmitAction) {
            console.log(`Generating PDF for status: ${nextStatus} (Form ID: ${finalFormId})...`);
            // Fetch current data *within* transaction
            const [currentDataRows] = await connection.query('SELECT * FROM C_FORM_I983 WHERE ID = ?', [finalFormId]);
            if (currentDataRows.length === 0) throw new Error("Could not retrieve data for PDF.");
            pdfFormData = { ...currentDataRows[0] };
            // Add just-uploaded signature path if applicable, as it's not yet in the fetched data
            if (signatureResult?.success && signatureUrlField) { pdfFormData[signatureUrlField] = signatureResult.path; }

            const pdfResult = await generateI983PDF(pdfFormData); // Pass the most complete data
            if (!pdfResult.success) { throw new Error(`PDF generation failed: ${pdfResult.error}. Rolling back.`); }
            pdfBytesForUpload = pdfResult.pdfBytes;
        }

        // --- 8. Commit Transaction ---
        await connection.commit();
        console.log(`✅ Transaction committed for I-983 Form ID: ${finalFormId}. New Status: ${nextStatus}`);

        // --- 9. Upload/Update PDF AFTER Commit ---
         if (isSubmitAction && pdfBytesForUpload && pdfFormData) {
             console.log(`Uploading/Updating PDF document for Form ID: ${finalFormId}, Status: ${nextStatus}`);
             // Pass 'nextStatus' to the upload function
             const uploadResult = await uploadI983PDFToDocuments(
                 pdfBytesForUpload, pdfFormData.EMP_ID, pdfFormData.ORG_ID, finalFormId, userId, nextStatus
             );
             if (!uploadResult.success) { console.error(`⚠️ CRITICAL: PDF upload/update failed for Form ${finalFormId} (Status: ${nextStatus}) after commit: ${uploadResult.error}`); }
             else { console.log(`✅ PDF for status ${nextStatus} uploaded/updated for Form ID: ${finalFormId}`); }
         } else if (isSubmitAction && (!pdfBytesForUpload || !pdfFormData)) {
              console.error(`⚠️ CRITICAL: Form ${finalFormId} submitted to ${nextStatus}, but PDF not generated/data missing.`);
         }

        return { success: true, id: finalFormId, newStatus: nextStatus, message: isSubmitAction ? 'Progress submitted successfully!' : 'Draft saved successfully!' };

    } catch (error) {
        if (connection) { await connection.rollback(); console.error(`❌ Transaction rolled back for I-983 ${action} due to error.`); }
        console.error(`❌ Error during I-983 ${action}:`, error);
        return { success: false, error: `Failed to ${action} I-983 form: ${error.message}` };
    } finally {
        if (connection) { try { await connection.release(); console.log("DB connection released."); } catch (releaseError) { console.error("Error releasing connection:", releaseError); } }
    }
}


// --- Delete Form ---
export async function deleteI983Form(formId) {
    const pool = await DBconnection();
    let connection;
    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();
        const numericFormIdStr = String(formId).replace('I983-', '');
        const numericFormId = parseInt(numericFormIdStr);
        if (isNaN(numericFormId) || numericFormId <= 0) throw new Error('Invalid form ID format.');
        const [formRows] = await connection.query('SELECT FORM_STATUS FROM C_FORM_I983 WHERE ID = ? FOR UPDATE', [numericFormId]);
        if (formRows.length === 0) throw new Error('Form not found');
        if (formRows[0].FORM_STATUS !== 'DRAFT') throw new Error('Only draft forms can be deleted.');
        
        // Delete signatures
        const deleteSigResult = await deleteI983Signatures(numericFormId);
        if (!deleteSigResult.success) console.warn(`Could not delete all signatures for form ${numericFormId}: ${deleteSigResult.error}`);
        
        // Delete associated document record
        const subtype = 70; // I-983 Subtype
        await connection.query(`DELETE FROM C_EMP_DOCUMENTS WHERE empid = ? AND orgid = ? AND subtype = ? AND comments LIKE ?`, [formRows[0].EMP_ID, formRows[0].ORG_ID, subtype, `%Form ID: ${numericFormId}%`]);
        console.log(`✅ Deleted associated document records for Form ID: ${numericFormId}`);

        // Delete the form record itself
        const [deleteResult] = await connection.query('DELETE FROM C_FORM_I983 WHERE ID = ?', [numericFormId]);
        if (!deleteResult || deleteResult.affectedRows === 0) throw new Error('Form record not found during delete or already deleted.');
        
        await connection.commit();
        console.log(`✅ Deleted I-983 form record: ${numericFormId}`);
        return { success: true };
    } catch (error) {
         if (connection) await connection.rollback();
        console.error('❌ Error deleting I-983 form:', error);
        return { success: false, error: `Failed to delete I-983 form: ${error.message}` };
    } finally {
        if (connection) { try { await connection.release(); console.log("DB connection released after delete."); } catch (releaseError) { console.error("Error releasing connection after delete:", releaseError); } }
    }
}

// *** UPDATED PDF Generation Function (Conditional Filling) ***
// *** UPDATED PDF Generation Function (Handles Multiline Text) ***
async function generateI983PDF(formData) {
    try {
      console.log("\n--- Starting I-983 PDF Generation ---");
      if (!formData) throw new Error("Form data is missing.");
      const templatePath = path.join(process.cwd(), "public", "templates", "i983.pdf");
      const existingPdfBytes = await fs.readFile(templatePath);
      const pdfDoc = await PDFDocument.load(existingPdfBytes);
      const form = pdfDoc.getForm();
      const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const pages = pdfDoc.getPages();

      // --- Define Status Levels (same as before) ---
      const STATUS_LEVELS = {
        'DRAFT': 0,
        'PAGE1_COMPLETE': 10, // Student Sec 1&2
        'PAGE2_COMPLETE': 20, // Employer Sec 3&4
        'PAGE3_SEC5_NAMES_COMPLETE': 30, // Student Names
        'PAGE3_SEC5_SITE_COMPLETE': 40, // Employer Site
        'PAGE3_SEC5_TRAINING_COMPLETE': 50, // Student Training
        'PAGE3_SEC5_OVERSIGHT_COMPLETE': 60, // Employer Oversight
        'PAGE4_SEC6_COMPLETE': 70, // Employer Sec 6
        'EVAL1_PENDING_STUDENT_SIGNATURE': 80, // Verifier Initiated Eval 1
        'EVAL1_PENDING_EMPLOYER_SIGNATURE': 90, // Student Signed Eval 1
        'EVAL1_COMPLETE': 100, // Verifier Signed Eval 1
        'EVAL2_PENDING_STUDENT_SIGNATURE': 110, // Verifier Initiated Eval 2
        'EVAL2_PENDING_EMPLOYER_SIGNATURE': 120, // Student Signed Eval 2
        'FORM_COMPLETED': 130, // Verifier Signed Eval 2
        // Old Statuses
        'STUDENT_SEC1_2_COMPLETE': 10, 'EMPLOYER_SEC3_4_COMPLETE': 20, 'STUDENT_SEC5_NAMES_COMPLETE': 30,
        'EMPLOYER_SEC5_SITE_COMPLETE': 40, 'STUDENT_SEC5_TRAINING_COMPLETE': 50, 'EMPLOYER_SEC5_EVAL_COMPLETE': 60,
        'EMPLOYER_SEC6_COMPLETE': 70,
      };

      const currentStatus = formData.FORM_STATUS;
      const currentLevel = STATUS_LEVELS[currentStatus] || 0;
      console.log(`Generating PDF for status: ${currentStatus} (Level: ${currentLevel})`);


      // --- Helper Functions ---
      const setSafeText = (fieldName, value) => { try { form.getTextField(fieldName).setText(String(value || '')); } catch { console.warn(`PDF Field Missing: ${fieldName}`) } };
      
      // --- NEW HELPER FOR MULTILINE TEXT ---
      const setSafeMultilineText = (fieldName, value, options = {}) => {
          try {
              const { fontSize = 9 } = options; // Use 9pt font size as requested
              const field = form.getTextField(fieldName);
              
              // Enable multiline and wrapping
              field.enableMultiline();
              
              // Set font size
              field.setFontSize(fontSize);
              
              // Set text
              field.setText(String(value || ''));
              
              console.log(`  ✓ Set Multiline ${fieldName} (Font: ${fontSize}pt)`);
          } catch (err) {
              console.warn(`  ⚠️ PDF Multiline Field Missing: ${fieldName} (${err.message})`);
          }
      };
      // --- END NEW HELPER ---

      const checkSafeRadio = (groupName, dbValue) => {
          try {
              const pdfValue = dbValue === 1 ? 'Yes' : (dbValue === 0 ? 'No' : null);
              if (pdfValue) form.getRadioGroup(groupName).select(pdfValue);
              else if (dbValue !== null && dbValue !== undefined) console.warn(`Invalid value ${dbValue} for radio group ${groupName}`);
          } catch { console.warn(`PDF Radio Missing: ${groupName}`) }
      };
      const embedSafeSignature = async (page, sigUrl, x, y, w, h) => {
          if (!sigUrl) return;
          try {
              const sigPath = path.join(process.cwd(), "public", sigUrl); await fs.access(sigPath);
              const sigBytes = await fs.readFile(sigPath); const sigImage = await pdfDoc.embedPng(sigBytes);
              page.drawImage(sigImage, { x, y, width: w, height: h });
              console.log(`  ✅ Sig embedded: ${sigUrl}`);
          } catch (err) { console.warn(`  ⚠️ Sig embed failed: ${sigUrl} - ${err.message}`); }
      };

      console.log("Filling PDF fields...");
      
      // --- Section 1 (Always Fill) ---
      console.log("Filling Section 1...");
      setSafeText('Student Name SurnamePrimary Name Given Name', formData.STUDENT_NAME);
      setSafeText('Student Email Address', formData.STUDENT_EMAIL);
      setSafeText('Name of School Recommending STEM OPT', formData.SCHOOL_RECOMMENDING);
      setSafeText('Name of School Where STEM Degree Was Earned', formData.SCHOOL_DEGREE_EARNED);
      setSafeText('SEVIS School Code of School Recommending STEM OPT including 3 digit suffix', formData.SCHOOL_CODE_RECOMMENDING);
      setSafeText('Designated School Official DSO Name and Contact Information', formData.DSO_NAME_CONTACT);
      setSafeText('Student SEVIS ID No', formData.STUDENT_SEVIS_ID);
      setSafeText('From', formatPdfDate(formData.STEM_OPT_START_DATE));
      setSafeText('To', formatPdfDate(formData.STEM_OPT_END_DATE));
      setSafeText('Qualifying Major and Classification of Instructional Programs CIP Code', formData.QUALIFYING_MAJOR_CIP);
      setSafeText('LevelType of Qualifying Degree', formData.QUALIFYING_DEGREE_LEVEL);
      setSafeText('Date Awarded mmddyyyy', formatPdfDate(formData.QUALIFYING_DEGREE_DATE));
      checkSafeRadio('Based on Prior Degree', formData.BASED_ON_PRIOR_DEGREE);
      setSafeText('Employment Authorization Number', formData.EMPLOYMENT_AUTH_NUMBER);
      
      // --- Section 2 (Fill if >= PAGE1_COMPLETE) ---
      if (currentLevel >= STATUS_LEVELS['PAGE1_COMPLETE']) {
          console.log("Filling Section 2...");
          setSafeText('Printed Name of Student', formData.STUDENT_PRINTED_NAME);
          setSafeText('Date mmddyyyy', formatPdfDate(formData.STUDENT_SIGNATURE_DATE));
          await embedSafeSignature(pages[0], formData.STUDENT_SIGNATURE_URL, 130, 195, 150,30);
      }
      
      // --- Section 3 & 4 (Fill if >= PAGE2_COMPLETE) ---
      if (currentLevel >= STATUS_LEVELS['PAGE2_COMPLETE']) {
          console.log("Filling Section 3...");
          setSafeText('Employer Name', formData.EMPLOYER_NAME);
          setSafeText('Employer Website URL', formData.EMPLOYER_WEBSITE);
          setSafeText('Employer ID Number EIN', formData.EMPLOYER_EIN);
          setSafeText('Street Address', formData.EMPLOYER_STREET_ADDRESS);
          setSafeText('Suite', formData.EMPLOYER_SUITE);
          setSafeText('City', formData.EMPLOYER_CITY);
          setSafeText('State', formData.EMPLOYER_STATE);
          setSafeText('ZIP Code', formData.EMPLOYER_ZIP);
          setSafeText('Number of FullTime Employees in US', formData.EMPLOYER_NUM_FT_EMPLOYEES);
          setSafeText('North American Industry Classification System NAICS Code', formData.EMPLOYER_NAICS_CODE);
          setSafeText('OPT Hours Per Week must be at least 20 hoursweek', formData.OPT_HOURS_PER_WEEK);
          setSafeText('Start Date of Employment mmddyyyy', formatPdfDate(formData.START_DATE_OF_EMPLOYMENT));
          setSafeText('A Salary Amount and Frequency', `${formData.SALARY_AMOUNT || ''} ${formData.SALARY_FREQUENCY || ''}`.trim());
          setSafeText('1 1', formData.OTHER_COMPENSATION_1); setSafeText('1 2', formData.OTHER_COMPENSATION_2);
          setSafeText('3', formData.OTHER_COMPENSATION_3); setSafeText('4', formData.OTHER_COMPENSATION_4);
          
          console.log("Filling Section 4...");
          setSafeText('Printed Name and Title of Employer Official with Signatory Authority', formData.EMPLOYER_OFFICIAL_PRINTED_NAME_TITLE);
          setSafeText('Printed Name of Employing Organization', formData.EMPLOYER_PRINTED_NAME_ORG);
          setSafeText('Date mmddyyyy_2', formatPdfDate(formData.EMPLOYER_OFFICIAL_SIGNATURE_DATE));
          await embedSafeSignature(pages[1], formData.EMPLOYER_OFFICIAL_SIGNATURE_URL, 300,115,150,30);
      }

      // --- Section 5 (Fill parts conditionally) ---
      const multilineOptions = { fontSize: 9 }; // Use 9pt font for text areas

      if (currentLevel >= STATUS_LEVELS['PAGE3_SEC5_NAMES_COMPLETE']) {
          console.log("Filling Section 5 (Names)...");
          setSafeText('Student Name SurnamePrimary Name Given Name_2', formData.SEC5_STUDENT_NAME);
          setSafeText('Employer Name_2', formData.SEC5_EMPLOYER_NAME);
      }
      if (currentLevel >= STATUS_LEVELS['PAGE3_SEC5_SITE_COMPLETE']) {
          console.log("Filling Section 5 (Site Info)...");
          setSafeText('Site Name', formData.SEC5_SITE_NAME);
          setSafeText('Site Address Street City State ZIP', formData.SEC5_SITE_ADDRESS);
          setSafeText('Name of Official', formData.SEC5_OFFICIAL_NAME);
          setSafeText('Official s Title', formData.SEC5_OFFICIAL_TITLE);
          setSafeText('Official s Email', formData.SEC5_OFFICIAL_EMAIL);
          setSafeText('Official s Phone Number', formData.SEC5_OFFICIAL_PHONE);
      }
      if (currentLevel >= STATUS_LEVELS['PAGE3_SEC5_TRAINING_COMPLETE']) {
          console.log("Filling Section 5 (Student Training)...");
          // --- APPLYING MULTILINE FIX ---
          setSafeMultilineText('Student Role Describe the students role with the employer and how that role is directly related to enhancing the student s knowledge obtained through his or her qualifying STEM degree', formData.SEC5_STUDENT_ROLE, multilineOptions);
          setSafeMultilineText('Goals and Objectives Describe how the assignments with the employer will help the student achieve his or her specific objectives for workbased learning related to his or her STEM degree The description must both specify the students goals regarding specific knowledge skills or techniques as well as the means by which they will be achieved', formData.SEC5_GOALS_OBJECTIVES, multilineOptions);
      }
      if (currentLevel >= STATUS_LEVELS['PAGE3_SEC5_OVERSIGHT_COMPLETE']) {
          console.log("Filling Section 5 (Employer Oversight)...");
          // --- APPLYING MULTILINE FIX ---
          setSafeMultilineText('Employer Oversight Explain how the employer provides oversight and supervision of individuals filling positions such as that being filled by the named F1 student If the employer has a training program or related policy in place that controls such oversight and supervision please describe', formData.SEC5_EMPLOYER_OVERSIGHT, multilineOptions);
          setSafeMultilineText('Measures and Assessments Explain how the employer measures and confirms whether individuals filling positions such as that being filled by the named F1 student are acquiring new knowledge and skills If the employer has a training program or related policy in place that controls such measures and assessments please describe', formData.SEC5_MEASURES_ASSESSMENTS, multilineOptions);
          // Remarks are on Page 4 but filled at the same step
          setSafeMultilineText('Additional Remarks optional Provide additional information pertinent to the Plan', formData.SEC5_ADDITIONAL_REMARKS, multilineOptions);
      }

      // --- Section 6 (Fill if >= PAGE4_SEC6_COMPLETE) ---
      if (currentLevel >= STATUS_LEVELS['PAGE4_SEC6_COMPLETE']) {
          console.log("Filling Section 6...");
          setSafeText('Printed Name and Title of Employer Official with Signatory Authority_2', formData.EMPLOYER_OFFICIAL_SEC6_PRINTED_NAME_TITLE);
          setSafeText('Date mmddyyyy_3', formatPdfDate(formData.EMPLOYER_OFFICIAL_SEC6_SIGNATURE_DATE));
          await embedSafeSignature(pages[3], formData.EMPLOYER_OFFICIAL_SEC6_SIGNATURE_URL, 260, 460, 150, 30);
      }

      // --- Evaluation 1 (Fill parts conditionally) ---
      if (currentLevel >= STATUS_LEVELS['EVAL1_PENDING_STUDENT_SIGNATURE']) {
          console.log("Filling Evaluation 1 (Dates/Text)...");
          setSafeText('undefined_3', formatPdfDate(formData.EVAL1_FROM_DATE)); // 'Range of Evaluation Dates: From'
          setSafeText('undefined_4', formatPdfDate(formData.EVAL1_TO_DATE));   // 'Range of Evaluation Dates: To'
          
          // --- APPLYING MULTILINE FIX (DRAWTEXT) ---
          const eval1Text = formData.EVAL1_STUDENT_EVALUATION || '';
          if (eval1Text) {
              console.log("Drawing Eval 1 Text...");
              pages[4].drawText(eval1Text, { 
                  x: 50, y: 670, // Approx Coords for Eval 1 text (top box)
                  size: 9, // Smaller font size
                  font: helveticaFont, 
                  color: rgb(0, 0, 0), 
                  maxWidth: 500, // Max width before wrapping
                  lineHeight: 11 // Line height for wrapped text
              });
          }
      }
      if (currentLevel >= STATUS_LEVELS['EVAL1_PENDING_EMPLOYER_SIGNATURE']) {
          console.log("Filling Evaluation 1 (Student Sig)...");
          setSafeText('Printed Name of Student_2', formData.STUDENT_PRINTED_NAME);
          setSafeText('Date mmddyyyy_4', formatPdfDate(formData.EVAL1_STUDENT_SIGNATURE_DATE));
          await embedSafeSignature(pages[4], formData.EVAL1_STUDENT_SIGNATURE_URL, 150, 480, 150, 30);
      }
      if (currentLevel >= STATUS_LEVELS['EVAL1_COMPLETE']) {
          console.log("Filling Evaluation 1 (Employer Sig)...");
          setSafeText('Printed Name of Employer Official with Signatory Authority', formData.EMPLOYER_OFFICIAL_PRINTED_NAME_TITLE); // Reused field?
          setSafeText('Date mmddyyyy_5', formatPdfDate(formData.EVAL1_EMPLOYER_SIGNATURE_DATE));
          await embedSafeSignature(pages[4], formData.EVAL1_EMPLOYER_SIGNATURE_URL, 300, 430, 150, 30);
      }

      // --- Evaluation 2 (Fill parts conditionally) ---
      if (currentLevel >= STATUS_LEVELS['EVAL2_PENDING_STUDENT_SIGNATURE']) {
          console.log("Filling Evaluation 2 (Dates/Text)...");
          setSafeText('undefined_5', formatPdfDate(formData.EVAL2_FROM_DATE)); // 'Range of Evaluation Dates: From_2'
          setSafeText('undefined_6', formatPdfDate(formData.EVAL2_TO_DATE));   // 'Range of Evaluation Dates: To_2'
          
          // --- APPLYING MULTILINE FIX (DRAWTEXT) ---
          const eval2Text = formData.EVAL2_STUDENT_EVALUATION || '';
          if (eval2Text) {
              console.log("Drawing Eval 2 Text...");
              pages[4].drawText(eval2Text, { 
                  x: 50, y: 325, // Approx Coords for Eval 2 text (bottom box)
                  size: 9, // Smaller font size
                  font: helveticaFont, 
                  color: rgb(0, 0, 0), 
                  maxWidth: 500, // Max width before wrapping
                  lineHeight: 11 // Line height for wrapped text
              });
          }
      }
      if (currentLevel >= STATUS_LEVELS['EVAL2_PENDING_EMPLOYER_SIGNATURE']) {
          console.log("Filling Evaluation 2 (Student Sig)...");
          setSafeText('Printed Name of Student_3', formData.STUDENT_PRINTED_NAME);
          setSafeText('Date mmddyyyy_6', formatPdfDate(formData.EVAL2_STUDENT_SIGNATURE_DATE));
          await embedSafeSignature(pages[4], formData.EVAL2_STUDENT_SIGNATURE_URL, 120, 140, 150, 30);
      }
      if (currentLevel >= STATUS_LEVELS['FORM_COMPLETED']) {
          console.log("Filling Evaluation 2 (Employer Sig)...");
          setSafeText('ty', formData.EMPLOYER_OFFICIAL_PRINTED_NAME_TITLE); // Verify 'ty' field name
          setSafeText('Date mmddyyyy_7', formatPdfDate(formData.EVAL2_EMPLOYER_SIGNATURE_DATE));
          await embedSafeSignature(pages[4], formData.EVAL2_EMPLOYER_SIGNATURE_URL, 370, 95, 150, 30);
      }

      // --- Finalize PDF ---
      console.log("Finalizing PDF...");
      try {
          // Update appearances before flattening
          form.updateFieldAppearances(helveticaFont);
          form.flatten();
          console.log("✅ PDF Flattened.");
      } catch (flattenError) {
          console.error(`❌ ERROR Flattening: ${flattenError.message}. Proceeding without flattening (fields may be editable).`);
      }
      const finalBytes = await pdfDoc.save();
      console.log("\n--- ✅ I-983 PDF Generation Complete ---");
      return { success: true, pdfBytes: finalBytes };
    } catch (error) {
      console.error("\n--- ❌ FATAL ERROR during I-983 PDF generation ---", error);
      return { success: false, error: `I-983 PDF Generation Failed: ${error.message}` };
    }
}
// *** UPDATED PDF Upload Function (Updates existing record) ***
async function uploadI983PDFToDocuments(pdfBytes, empId, orgId, formId, userId, statusName) {
    try {
        const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'documents'); await fs.mkdir(uploadDir, { recursive: true });
        // Use statusName in the filename
        const filename = `I983_Form_${statusName}_${empId}_${formId}_${Date.now()}.pdf`;
        const filePath = path.join(uploadDir, filename);
        await fs.writeFile(filePath, pdfBytes); console.log(`I-983 PDF (${statusName}) saved: ${filePath}`);
        const documentPath = `/uploads/documents/${filename}`; const pool = await DBconnection();
        const subtype = 70; // Unique subtype for I-983

        // --- Find existing document record based on formId in comments ---
        const [existingDocs] = await pool.query(
            `SELECT id FROM C_EMP_DOCUMENTS WHERE empid = ? AND orgid = ? AND subtype = ? AND comments LIKE ? ORDER BY created_date DESC LIMIT 1`,
             [empId, orgId, subtype, `%Form ID: ${formId}%`]
        );

        const docName = `Form I-983 (${statusName})`; // Use status in doc name
        const comments = `Generated I-983 Form PDF at status ${statusName}. Form ID: ${formId}`;
        const document_type = 66; // Tax/Compliance Forms category ID
        const document_purpose = 63; // Compliance Purpose ID

        if (existingDocs.length > 0) {
            // --- UPDATE the existing document record ---
            const docIdToUpdate = existingDocs[0].id;
            const [updateResult] = await pool.query(
                `UPDATE C_EMP_DOCUMENTS SET
                 document_name = ?, document_path = ?, comments = ?,
                 updated_by = ?, last_updated_date = NOW()
                 WHERE id = ?`,
                [docName, documentPath, comments, userId, docIdToUpdate]
            );
            if (updateResult?.affectedRows > 0) {
                console.log(`✅ Updated I-983 document record ${docIdToUpdate} for status ${statusName}`);
            } else {
                console.warn(`⚠️ Attempted to update I-983 document record ${docIdToUpdate}, but no rows affected.`);
            }
        } else {
            // --- INSERT new document record if none exists for this formId ---
            const [insertResult] = await pool.query(
                `INSERT INTO C_EMP_DOCUMENTS (
                    empid, orgid, document_name, document_type, subtype,
                    document_path, document_purpose, comments, startdate,
                    created_by, updated_by, created_date, last_updated_date
                 ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, ?, NOW(), NOW())`,
                [empId, orgId, docName, document_type, subtype, documentPath, document_purpose, comments, userId, userId]
            );
            if (!insertResult?.insertId) throw new Error("Failed to insert I-983 document record.");
            console.log(`✅ Created new I-983 document record ${insertResult.insertId} for status ${statusName}`);
        }
        return { success: true, path: documentPath };
    } catch (error) {
        console.error(`Error uploading/updating I-983 PDF (${statusName}) to documents:`, error);
        return { success: false, error: `Failed to upload/update PDF (${statusName}): ${error.message}` };
    }
}
// @ts-nocheck
'use server';

import DBconnection from '@/app/utils/config/db';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
// Ensure all necessary pdf-lib components are imported
import { PDFDocument, StandardFonts, rgb, PDFTextField, PDFCheckBox, ParseSpeeds } from 'pdf-lib';
import { cookies } from 'next/headers';
import { fetchEmployeeById } from '@/app/serverActions/Employee/overview';

// --- Utility Functions ---

const formatDate = (date) => {
  if (!date || isNaN(new Date(date))) return null;
  const d = new Date(date);
  // Format YYYY-MM-DD for database
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
};

const formatPdfDate = (date) => {
    // Format MM/DD/YYYY for PDF display
    if (!date) return '';
    try {
        const d = new Date(date);
        // Adjust for timezone offset when reading date from DB or JS Date object
        const adjustedDate = new Date(d.getTime() + d.getTimezoneOffset() * 60000);
        const month = String(adjustedDate.getUTCMonth() + 1).padStart(2, '0');
        const day = String(adjustedDate.getUTCDate()).padStart(2, '0');
        const year = adjustedDate.getUTCFullYear();
        // Basic validation for sensible year
        return year > 1900 && year < 2100 ? `${month}/${day}/${year}` : '';
    } catch (e) {
        console.warn("Error formatting PDF date:", e);
        return ''; // Return empty string if date is invalid
    }
}


const generateSignatureHash = (base64Data) => {
  if (!base64Data) return null;
  // Ensure the prefix is removed before hashing
  const base64Image = base64Data.replace(/^data:image\/\w+;base64,/, '');
  return crypto.createHash('sha256').update(base64Image).digest('hex');
};

async function uploadW4Signature(base64Data, formId) {
  // Uploads W4 employee signature
  try {
    if (!base64Data) throw new Error("Signature data is missing.");
    const base64Image = base64Data.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Image, 'base64');

    if (buffer.length === 0) throw new Error("Empty signature data received.");
    if (buffer.length > 5 * 1024 * 1024) throw new Error('Signature file too large (max 5MB)');

    const publicDir = path.join(process.cwd(), 'public', 'signatures');
    await fs.mkdir(publicDir, { recursive: true });

    // Use specific filename format for W4 employee
    const filename = `form_w4_${formId}_employee.png`;
    const filePath = path.join(publicDir, filename);

    await fs.writeFile(filePath, buffer);
    const hash = generateSignatureHash(base64Image); // Use the base64Image without prefix

    console.log(`✅ W4 Employee Signature saved: ${filePath}`);
    return { success: true, path: `/signatures/${filename}`, hash };
  } catch (error) {
    console.error('❌ Error uploading W-4 employee signature:', error);
    return { success: false, error: error.message };
  }
}

// --- Public-Facing Server Actions ---

export async function fetchW4FormsByEmpId(empId, orgId) {
  // Fetches basic W4 form info for listing
  const pool = await DBconnection();
  try {
    const [rows] = await pool.query(
      `SELECT ID, ORG_ID, EMP_ID, FORM_STATUS, EMPLOYEE_SIGNATURE_DATE, SUBMITTED_AT, CREATED_AT
       FROM C_FORM_W4
       WHERE EMP_ID = ? AND ORG_ID = ? ORDER BY CREATED_AT DESC`,
      [empId, orgId]
    );
    // Add FORM_TYPE for frontend differentiation
    return rows.map(row => ({ ...row, FORM_TYPE: 'W4' }));
  } catch (error) {
    console.error('❌ Error fetching W-4 forms:', error);
    throw new Error('Failed to fetch W-4 forms');
  }
}

export async function getW4FormDetails(formId) {
    // Fetches detailed W4 form data including related employee hire date
    const pool = await DBconnection();
    try {
        const numericFormId = parseInt(formId);
        if (isNaN(numericFormId) || numericFormId <= 0) throw new Error("Invalid W-4 Form ID.");

        const query = `
            SELECT w4.*,
                   e.HIRE -- Include HIRE_DATE needed for employer section prefill/verification
            FROM C_FORM_W4 w4
            JOIN C_EMP e ON w4.EMP_ID = e.empid AND w4.ORG_ID = e.orgid
            WHERE w4.ID = ?
        `;
        const [rows] = await pool.query(query, [numericFormId]);
        if (rows.length === 0) {
            throw new Error(`W-4 form with ID ${numericFormId} not found.`);
        }
        // Add FORM_TYPE for frontend consistency
        return { ...rows[0], FORM_TYPE: 'W4' };
    } catch (error) {
        console.error(`❌ Error fetching W-4 form details for ID ${formId}:`, error);
        throw new Error(`Failed to fetch W-4 form details: ${error.message}`);
    }
}

export async function canEditW4Form(formId) {
  // Checks if a W4 form can be edited (not yet verified)
  try {
    const pool = await DBconnection();
    const numericFormId = parseInt(formId);
    if (isNaN(numericFormId) || numericFormId <= 0) return { canEdit: false, reason: 'Invalid Form ID' };

    const [rows] = await pool.query(
      'SELECT FORM_STATUS FROM C_FORM_W4 WHERE ID = ?',
      [numericFormId]
    );
    if (rows.length === 0) {
      return { canEdit: false, reason: 'Form not found' };
    }
    const form = rows[0];
    // Allow editing unless VERIFIED
    if (form.FORM_STATUS === 'VERIFIED') {
      return { canEdit: false, reason: 'This form has been verified and cannot be edited.' };
    }
    return { canEdit: true };
  } catch (error) {
    console.error(`❌ Error checking W4 edit permission for ID ${formId}:`, error)
    return { canEdit: false, reason: 'Error checking permissions.' };
  }
}

export async function saveW4Form(formData, formId = null) {
  // Saves a W4 form as DRAFT
  const pool = await DBconnection();
  // Destructure all expected fields, including counts from frontend
  const {
      orgid, emp_id, signature_data,
      qualifying_children_count, other_dependents_count, other_credits_amount, // Use amounts from form
      first_name, last_name, ssn, address_street, address_city_state_zip, filing_status,
      multiple_jobs_checked, other_income, deductions, extra_withholding, signature_date
   } = formData;
  let currentFormId = formId ? parseInt(String(formId).replace('W4-','')) : null;

  try {
     // Basic validation
     if (!first_name || !last_name || !ssn || !address_street || !address_city_state_zip || !filing_status) {
         throw new Error("Missing required fields in Step 1.");
     }
     if (!orgid || !emp_id) {
         throw new Error("Organization ID and Employee ID are required.");
     }

    const formattedSignatureDate = formatDate(signature_date);

    // Calculate amounts correctly
    const childrenAmount = parseFloat((Number(qualifying_children_count || 0) * 2000).toFixed(2));
    const otherAmount = parseFloat((Number(other_dependents_count || 0) * 500).toFixed(2));
    // Ensure other_credits_amount is treated as a number
    const otherCreditsNum = parseFloat(Number(other_credits_amount || 0).toFixed(2));
    const totalCreditsRecalculated = parseFloat((childrenAmount + otherAmount + otherCreditsNum).toFixed(2));

    // Ensure numeric fields are correctly parsed or defaulted
    const otherIncomeNum = other_income ? parseFloat(Number(other_income).toFixed(2)) : 0.00;
    const deductionsNum = deductions ? parseFloat(Number(deductions).toFixed(2)) : 0.00;
    const extraWithholdingNum = extra_withholding ? parseFloat(Number(extra_withholding).toFixed(2)) : 0.00;

    // Data array for query binding
    const data = [
        first_name, last_name, ssn, address_street, address_city_state_zip,
        filing_status, multiple_jobs_checked ? 1 : 0,
        childrenAmount, otherAmount, otherCreditsNum, totalCreditsRecalculated, // Use numeric amounts
        otherIncomeNum, deductionsNum, extraWithholdingNum, // Use numeric amounts
        formattedSignatureDate, 'DRAFT' // Always save as DRAFT
    ];

    if (currentFormId && !isNaN(currentFormId)) {
      // Update existing draft
      console.log(`Attempting to update W4 draft ID: ${currentFormId}`);
      const editCheck = await canEditW4Form(currentFormId);
      if (!editCheck.canEdit) throw new Error(editCheck.reason);

      const query = `
        UPDATE C_FORM_W4 SET
          FIRST_NAME = ?, LAST_NAME = ?, SSN = ?, ADDRESS_STREET = ?, ADDRESS_CITY_STATE_ZIP = ?,
          FILING_STATUS = ?, MULTIPLE_JOBS_CHECKED = ?,
          QUALIFYING_CHILDREN_AMOUNT = ?, OTHER_DEPENDENTS_AMOUNT = ?, OTHER_CREDITS_AMOUNT = ?, TOTAL_CREDITS = ?,
          OTHER_INCOME = ?, DEDUCTIONS = ?, EXTRA_WITHHOLDING = ?,
          EMPLOYEE_SIGNATURE_DATE = ?, FORM_STATUS = ?,
          UPDATED_AT = NOW()
        WHERE ID = ?
      `;
      const [updateResult] = await pool.query(query, [...data, currentFormId]);
       // Check affectedRows properly for mysql2/promise
       if (!updateResult || updateResult.affectedRows === 0) {
           console.warn(`W4 Form ${currentFormId} draft update affected 0 rows. Might be deleted or ID incorrect.`);
       } else {
            console.log(`✅ W4 Form ${currentFormId} draft updated successfully.`);
       }
    } else {
      // Insert new draft
      console.log(`Attempting to insert new W4 draft for employee: ${emp_id}`);
      const query = `
        INSERT INTO C_FORM_W4 (
          FIRST_NAME, LAST_NAME, SSN, ADDRESS_STREET, ADDRESS_CITY_STATE_ZIP,
          FILING_STATUS, MULTIPLE_JOBS_CHECKED,
          QUALIFYING_CHILDREN_AMOUNT, OTHER_DEPENDENTS_AMOUNT, OTHER_CREDITS_AMOUNT, TOTAL_CREDITS,
          OTHER_INCOME, DEDUCTIONS, EXTRA_WITHHOLDING,
          EMPLOYEE_SIGNATURE_DATE, FORM_STATUS,
          ORG_ID, EMP_ID, CREATED_AT
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
      `;
      const [result] = await pool.query(query, [...data, orgid, emp_id]);
       if (!result || !result.insertId) {
           throw new Error("Database error: Failed to insert new W4 draft.");
       }
      currentFormId = result.insertId;
      console.log(`✅ W4 Form ${currentFormId} draft created successfully.`);
    }

    // Handle signature upload/update
    if (signature_data) {
        console.log(`Uploading signature for W4 Form ID: ${currentFormId}`);
        const signatureResult = await uploadW4Signature(signature_data, currentFormId);
        if (signatureResult.success) {
            await pool.query(
                'UPDATE C_FORM_W4 SET EMPLOYEE_SIGNATURE_URL = ?, EMPLOYEE_SIGNATURE_HASH = ? WHERE ID = ?',
                [signatureResult.path, signatureResult.hash, currentFormId]
            );
             console.log(`✅ Signature URL and hash updated for W4 Form ID: ${currentFormId}`);
        } else {
            console.error(`⚠️ Failed to upload signature for draft W4 ${currentFormId}: ${signatureResult.error}`);
            // Consider if this should throw an error or just be a warning for draft saves
        }
    } else if (currentFormId) {
         // No new signature provided, keep existing one if present
         console.log(`ℹ️ No new signature provided for W4 draft ${currentFormId}.`);
    }

    return { success: true, id: currentFormId, message: 'W-4 Draft saved successfully!' };

  } catch (error) {
    console.error('❌ Error saving W-4 draft:', error);
    // Return specific error message
    return { success: false, error: `Failed to save W-4 draft: ${error.message}` };
  }
}

export async function submitW4Form(formData, formId) {
  // Submits the W4 form, updating status to SUBMITTED and generating PDF
  const pool = await DBconnection();
  const {
      orgid, emp_id, signature_data,
      qualifying_children_count, other_dependents_count, other_credits_amount,
      first_name, last_name, ssn, address_street, address_city_state_zip, filing_status,
      multiple_jobs_checked, other_income, deductions, extra_withholding, signature_date
   } = formData;
  let currentFormId = formId ? parseInt(String(formId).replace('W4-','')) : null;
 let pool1;
let connection;

try {
  pool1 = await DBconnection();            // Get the pool
  connection = await pool1.getConnection(); // Get a real connection from the pool
  await connection.beginTransaction();    
    const cookieStore = cookies();
    const token = cookieStore.get('jwt_token')?.value;
    if (!token) throw new Error('Authentication token is missing.');
    const decoded = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
    // Ensure userId is present in token, adjust property name if needed
    const userId = decoded.userId || decoded.empid;
    if (!userId) throw new Error('Could not identify user from token.');


    // --- Validation ---
    if (!signature_data) throw new Error('Signature is required to submit the form.');
    if (!first_name || !last_name || !ssn || !address_street || !address_city_state_zip || !filing_status) {
         throw new Error("Missing required fields in Step 1.");
    }
     if (!orgid || !emp_id) {
         throw new Error("Organization ID and Employee ID are required.");
     }

    // --- Data Preparation ---
    const formattedSignatureDate = formatDate(signature_date);
    const childrenAmount = parseFloat((Number(qualifying_children_count || 0) * 2000).toFixed(2));
    const otherAmount = parseFloat((Number(other_dependents_count || 0) * 500).toFixed(2));
    const otherCreditsNum = parseFloat(Number(other_credits_amount || 0).toFixed(2));
    const totalCreditsRecalculated = parseFloat((childrenAmount + otherAmount + otherCreditsNum).toFixed(2));
    const submittedAt = new Date(); // Use JS Date object for DB DATETIME field
    const otherIncomeNum = other_income ? parseFloat(Number(other_income).toFixed(2)) : 0.00;
    const deductionsNum = deductions ? parseFloat(Number(deductions).toFixed(2)) : 0.00;
    const extraWithholdingNum = extra_withholding ? parseFloat(Number(extra_withholding).toFixed(2)) : 0.00;

    const data = [
        first_name, last_name, ssn, address_street, address_city_state_zip,
        filing_status, multiple_jobs_checked ? 1 : 0,
        childrenAmount, otherAmount, otherCreditsNum, totalCreditsRecalculated,
        otherIncomeNum, deductionsNum, extraWithholdingNum,
        formattedSignatureDate, 'SUBMITTED', submittedAt // Set status to SUBMITTED
    ];

    // --- Database Operation (Insert or Update) ---
    if (currentFormId && !isNaN(currentFormId)) {
        // Update existing form
        console.log(`Attempting to update and submit W4 ID: ${currentFormId}`);
        const editCheck = await canEditW4Form(currentFormId); // Use connection? Maybe not needed for check.
        if (!editCheck.canEdit) throw new Error(editCheck.reason);

        const query = `
            UPDATE C_FORM_W4 SET
              FIRST_NAME = ?, LAST_NAME = ?, SSN = ?, ADDRESS_STREET = ?, ADDRESS_CITY_STATE_ZIP = ?,
              FILING_STATUS = ?, MULTIPLE_JOBS_CHECKED = ?,
              QUALIFYING_CHILDREN_AMOUNT = ?, OTHER_DEPENDENTS_AMOUNT = ?, OTHER_CREDITS_AMOUNT = ?, TOTAL_CREDITS = ?,
              OTHER_INCOME = ?, DEDUCTIONS = ?, EXTRA_WITHHOLDING = ?,
              EMPLOYEE_SIGNATURE_DATE = ?, FORM_STATUS = ?, SUBMITTED_AT = ?,
              UPDATED_AT = NOW()
            WHERE ID = ?
        `;
        // Execute update within the transaction
        const [updateResult] = await connection.query(query, [...data, currentFormId]);
        if (!updateResult || updateResult.affectedRows === 0) {
            throw new Error(`Failed to update W4 form ID ${currentFormId} for submission. Form may not exist.`);
        }
        console.log(`✅ W4 Form ${currentFormId} updated and status set to SUBMITTED.`);
    } else {
        // Insert new form
         console.log(`Attempting to insert and submit new W4 for employee: ${emp_id}`);
        const query = `
            INSERT INTO C_FORM_W4 (
              FIRST_NAME, LAST_NAME, SSN, ADDRESS_STREET, ADDRESS_CITY_STATE_ZIP,
              FILING_STATUS, MULTIPLE_JOBS_CHECKED,
              QUALIFYING_CHILDREN_AMOUNT, OTHER_DEPENDENTS_AMOUNT, OTHER_CREDITS_AMOUNT, TOTAL_CREDITS,
              OTHER_INCOME, DEDUCTIONS, EXTRA_WITHHOLDING,
              EMPLOYEE_SIGNATURE_DATE, FORM_STATUS, SUBMITTED_AT,
              ORG_ID, EMP_ID, CREATED_AT
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
        `;
        // Execute insert within the transaction
        const [result] = await connection.query(query, [...data, orgid, emp_id]);
        if (!result || !result.insertId) {
            throw new Error("Database error: Failed to insert new W4 form for submission.");
        }
        currentFormId = result.insertId;
        console.log(`✅ W4 Form ${currentFormId} created with status SUBMITTED.`);
    }

    // --- Signature Upload ---
    console.log(`Uploading signature for submitted W4 Form ID: ${currentFormId}`);
    const signatureResult = await uploadW4Signature(signature_data, currentFormId);
    if (!signatureResult.success) {
        // Critical failure if signature upload fails after DB commit intent
        throw new Error(`Failed to upload signature: ${signatureResult.error}. Submission aborted.`);
    }
    // Update signature details within the transaction
    await connection.query(
      'UPDATE C_FORM_W4 SET EMPLOYEE_SIGNATURE_URL = ?, EMPLOYEE_SIGNATURE_HASH = ? WHERE ID = ?',
      [signatureResult.path, signatureResult.hash, currentFormId]
    );
     console.log(`✅ Signature details updated for W4 Form ID: ${currentFormId}`);

    // --- PDF Generation & Upload ---
    // Fetch the final submitted data *within the transaction* if needed, or assume data object is sufficient
    // Note: Re-fetching might cause deadlocks if not careful. Using current data is often safer.
    // Let's use the data we have, adding the ID and URL
    // Let's use the data we have, adding the ID and URL
// Normalize formData keys to match DB/PDF expectations
const formDataForPdf = {
  FIRST_NAME: formData.first_name || '',
  LAST_NAME: formData.last_name || '',
  SSN: formData.ssn || '',
  ADDRESS_STREET: formData.address_street || '',
  CITY: formData.city || '',
  STATE: formData.state || '',
  ZIP_CODE: formData.zip_code || '',
  FILING_STATUS: formData.filing_status || '',
  MULTIPLE_JOBS_CHECKED: formData.multiple_jobs_checked ? 1 : 0,
  QUALIFYING_CHILDREN_AMOUNT: childrenAmount,
  OTHER_DEPENDENTS_AMOUNT: otherAmount,
  OTHER_CREDITS_AMOUNT: otherCreditsNum,
  TOTAL_CREDITS: totalCreditsRecalculated,
  OTHER_INCOME: otherIncomeNum,
  DEDUCTIONS: deductionsNum,
  EXTRA_WITHHOLDING: extraWithholdingNum,
  EMPLOYEE_SIGNATURE_DATE: formattedSignatureDate,
  EMPLOYEE_SIGNATURE_URL: signatureResult.path,
  FORM_STATUS: 'SUBMITTED',
  ORG_ID: orgid,
  EMP_ID: emp_id,
  ID: currentFormId,
  SUBMITTED_AT: submittedAt
};

    console.log(`Generating 'Submitted' PDF for W4 Form ID: ${currentFormId}`);
    const pdfResult = await generateW4PDF(formDataForPdf); // Generate PDF with current data
    if (!pdfResult.success) {
        // Log error but allow transaction commit? Or rollback? Decide policy.
        // Let's rollback for now to ensure atomicity.
        throw new Error(`Failed to generate PDF for submitted W4 ${currentFormId}: ${pdfResult.error}`);
    }

    // Upload the "Submitted" PDF - this happens *outside* the DB transaction typically
    // If upload fails, the DB changes are already committed.
    // Consider adding compensating logic if upload is critical.
    console.log(`Uploading 'Submitted' PDF document for W4 Form ID: ${currentFormId}`);
    const uploadResult = await uploadPDFToDocuments(pdfResult.pdfBytes, emp_id, orgid, currentFormId, userId, 'Submitted');
    if (!uploadResult.success) {
        // Log error, but DB changes are already done.
        console.error(`⚠️ Failed to upload 'Submitted' PDF document for W4 ${currentFormId} after submission: ${uploadResult.error}`);
        // Potentially notify admin or retry mechanism?
    } else {
        console.log(`✅ 'Submitted' PDF uploaded successfully for W4 Form ID: ${currentFormId}`);
    }

    // If all steps succeeded, commit the transaction
    await connection.commit();
    console.log(`✅ Transaction committed for W4 Form ID: ${currentFormId} submission.`);

    return { success: true, message: 'W-4 form submitted successfully!' };

  } catch (error) {
    // Rollback transaction if any error occurred
    if (connection) {
        console.error(`Rolling back transaction for W4 submission due to error: ${error.message}`);
        await connection.rollback();
    }
    console.error('❌ Error submitting W-4 form:', error);
    // Return specific error message
    return { success: false, error: `Failed to submit W-4 form: ${error.message}` };
  } finally {
       if (connection) {
            // Release connection if necessary for your library
            // await connection.release();
            console.log("DB connection released (if applicable).");
       }
  }
}


export async function deleteW4Form(formId) {
    // Deletes a DRAFT W4 form and its signature
    const pool = await DBconnection();
    let connection;
    try {
        connection = await DBconnection();
        await connection.beginTransaction();

        const numericFormId = parseInt(String(formId).replace('W4-',''));
        if (isNaN(numericFormId) || numericFormId <= 0) throw new Error('Invalid form ID format.');

        // Get status and signature URL, lock the row
        const [formRows] = await connection.query(
            'SELECT FORM_STATUS, EMPLOYEE_SIGNATURE_URL FROM C_FORM_W4 WHERE ID = ? FOR UPDATE',
            [numericFormId]
        );
        if (formRows.length === 0) throw new Error('Form not found');
        const form = formRows[0];

        if (form.FORM_STATUS !== 'DRAFT') throw new Error('Only draft forms can be deleted.');

        // Delete signature file first (outside transaction ideally, but simpler here)
        if (form.EMPLOYEE_SIGNATURE_URL) {
            const sigPath = path.join(process.cwd(), 'public', form.EMPLOYEE_SIGNATURE_URL);
            try {
                await fs.access(sigPath);
                await fs.unlink(sigPath);
                console.log(`✅ Deleted signature file: ${sigPath}`);
            } catch (err) {
                if (err.code !== 'ENOENT') { // Log only if error is not 'file not found'
                   console.warn(`⚠️ Could not delete signature file: ${sigPath}`, err.code);
                } else {
                    console.log(`ℹ️ Signature file not found for deletion: ${sigPath}`);
                }
            }
        }

        // Delete the database record
        const [deleteResult] = await connection.query('DELETE FROM C_FORM_W4 WHERE ID = ?', [numericFormId]);

        // Check affectedRows properly for mysql2/promise
        if (!deleteResult || deleteResult.affectedRows === 0) {
             throw new Error('Form record not found during delete or already deleted.');
        }

        await connection.commit(); // Commit transaction
        console.log(`✅ Deleted W4 form record: ${numericFormId}`);
        return { success: true };

    } catch (error) {
         if (connection) {
             await connection.rollback(); // Rollback on error
         }
        console.error('❌ Error deleting W-4 form:', error);
        return { success: false, error: `Failed to delete W-4 form: ${error.message}` };
    } finally {
        if (connection) {
            // Release connection if necessary
             // await connection.release();
        }
    }
}
// --- PDF Generation & Upload ---

// generateW4PDF function using the correct UNDERSCORE field names based on user confirmation
// --- PDF Generation Function (Updated with Safe Setters and Exact Field Names) ---
export async function generateW4PDF(w4Data) {
  try {
    console.log("\n--- Starting W-4 PDF Generation ---");
    console.log("W-4 Data Summary:", {
      FIRST_NAME: w4Data.FIRST_NAME,
      LAST_NAME: w4Data.LAST_NAME,
      SSN: w4Data.SSN ? `***-**-${w4Data.SSN.slice(-4)}` : '',
      FILING_STATUS: w4Data.FILING_STATUS,
      MULTIPLE_JOBS_CHECKED: w4Data.MULTIPLE_JOBS_CHECKED,
      QUALIFYING_CHILDREN_AMOUNT: w4Data.QUALIFYING_CHILDREN_AMOUNT,
      OTHER_DEPENDENTS_AMOUNT: w4Data.OTHER_DEPENDENTS_AMOUNT,
      TOTAL_CREDITS: w4Data.TOTAL_CREDITS,
      OTHER_INCOME: w4Data.OTHER_INCOME,
      DEDUCTIONS: w4Data.DEDUCTIONS,
      EXTRA_WITHHOLDING: w4Data.EXTRA_WITHHOLDING,
      EMPLOYEE_SIGNATURE_DATE: w4Data.EMPLOYEE_SIGNATURE_DATE,
      EMPLOYEE_SIGNATURE_URL: w4Data.EMPLOYEE_SIGNATURE_URL,
      FORM_STATUS: w4Data.FORM_STATUS,
      EMPLOYER_NAME_ADDRESS: w4Data.EMPLOYER_NAME_ADDRESS,
      FIRST_DATE_OF_EMPLOYMENT: w4Data.FIRST_DATE_OF_EMPLOYMENT,
      EMPLOYER_EIN: w4Data.EMPLOYER_EIN
    });

    // Load the blank W-4 PDF template (ensure this path points to your 2025 fillable W-4 PDF)
    const templatePath = path.join(process.cwd(), 'public', 'templates', 'fw4.pdf'); // Adjust path as needed
    const existingPdfBytes = await fs.readFile(templatePath);
    const pdfDoc = await PDFDocument.load(existingPdfBytes);
    const form = pdfDoc.getForm();
    const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const firstPage = pdfDoc.getPage(0);

    // Safe setters to avoid crashes on missing fields
    const setSafeText = (fieldName, value, pdfDoc, form) => {
      try {
        if (typeof value === 'number') value = String(Math.round(value)); // IRS fields expect integers
        else if (typeof value === 'string') value = value.trim();
        else value = String(value || '');
        const field = form?.getTextField(fieldName);
        if (field) {
          field.setText(value);
          console.log(`✅ Set text field ${fieldName}: ${value}`);
        } else {
          console.warn(`⚠️ PDF field not found (skipping): ${fieldName}`);
        }
      } catch (err) {
        console.error(`❌ Error setting text field ${fieldName}: ${err.message}`);
      }
    };

    const checkSafeBox = (fieldName, pdfDoc, form) => {
      try {
        const field = form?.getCheckBox(fieldName);
        if (field) {
          field.check();
          console.log(`✅ Checked box ${fieldName}`);
        } else {
          console.warn(`⚠️ PDF checkbox not found (skipping): ${fieldName}`);
        }
      } catch (err) {
        console.error(`❌ Error checking box ${fieldName}: ${err.message}`);
      }
    };

    // --- Step 1: Personal Information ---
    console.log("\n--- Filling Step 1 ---");
    const pdfSSN = w4Data.SSN ? `***-**-${w4Data.SSN.slice(-4)}` : ''; // Mask SSN for PDF (adjust as needed)
   // Step 1 — Personal Info
// Step 1 — Personal Information (FINAL FIXED VERSION)
const fullCityStateZip = [w4Data.CITY, w4Data.STATE, w4Data.ZIP_CODE]
  .filter(Boolean)
  .join(', ');

setSafeText('topmostSubform[0].Page1[0].Step1a[0].f1_01[0]', w4Data.FIRST_NAME || '', pdfDoc, form);
setSafeText('topmostSubform[0].Page1[0].Step1a[0].f1_02[0]', w4Data.LAST_NAME || '', pdfDoc, form);
setSafeText('topmostSubform[0].Page1[0].Step1a[0].f1_03[0]', w4Data.ADDRESS_STREET || '', pdfDoc, form);
setSafeText('topmostSubform[0].Page1[0].Step1a[0].f1_04[0]', fullCityStateZip || '', pdfDoc, form);
setSafeText('topmostSubform[0].Page1[0].f1_05[0]', pdfSSN, pdfDoc, form);



    // Filing Status Checkboxes
    console.log("Setting Filing Status:", w4Data.FILING_STATUS);
    if (w4Data.FILING_STATUS === 'SINGLE') checkSafeBox('topmostSubform[0].Page1[0].c1_1[0]', pdfDoc, form);
    else if (w4Data.FILING_STATUS === 'MARRIED_JOINTLY') checkSafeBox('topmostSubform[0].Page1[0].c1_1[1]', pdfDoc, form);
    else if (w4Data.FILING_STATUS === 'HEAD_OF_HOUSEHOLD') checkSafeBox('topmostSubform[0].Page1[0].c1_1[2]', pdfDoc, form);

    // --- Step 2: Multiple Jobs ---
    console.log("\n--- Filling Step 2 ---");
    if (w4Data.MULTIPLE_JOBS_CHECKED) checkSafeBox('topmostSubform[0].Page1[0].c1_2[0]', pdfDoc, form);

    // --- Step 3: Dependents ---
    console.log("\n--- Filling Step 3 ---");
    setSafeText('topmostSubform[0].Page1[0].Step3_ReadOrder[0].f1_06[0]', w4Data.QUALIFYING_CHILDREN_AMOUNT || 0, pdfDoc, form);
    setSafeText('topmostSubform[0].Page1[0].Step3_ReadOrder[0].f1_07[0]', w4Data.OTHER_DEPENDENTS_AMOUNT || 0, pdfDoc, form);
    setSafeText('topmostSubform[0].Page1[0].f1_09[0]', w4Data.TOTAL_CREDITS || 0, pdfDoc, form);

    // --- Step 4: Other Adjustments ---
    console.log("\n--- Filling Step 4 ---");
    setSafeText('topmostSubform[0].Page1[0].f1_10[0]', w4Data.OTHER_INCOME || 0, pdfDoc, form);
    setSafeText('topmostSubform[0].Page1[0].f1_11[0]', w4Data.DEDUCTIONS || 0, pdfDoc, form);
    setSafeText('topmostSubform[0].Page1[0].f1_12[0]', w4Data.EXTRA_WITHHOLDING || 0, pdfDoc, form);

    // --- Step 5: Employee Signature Date ---
    // console.log("\n--- Processing Step 5 (Signature) ---");
    // setSafeText('topmostSubform[0].Page1[0].f1_13[0]', formatPdfDate(w4Data.EMPLOYEE_SIGNATURE_DATE), pdfDoc, form);
    
    // Embed Signature Image
    // Embed Signature Image
if (w4Data.EMPLOYEE_SIGNATURE_URL) {
  try {
    const sigPath = path.join(process.cwd(), "public", w4Data.EMPLOYEE_SIGNATURE_URL);
    await fs.access(sigPath);
    const sigBytes = await fs.readFile(sigPath);
    const sigImage = await pdfDoc.embedPng(sigBytes);
    const { width, height } = sigImage.scale(0.25); // Adjust scale if needed

    // Draw signature
    const sigX = 130; // X coordinate for signature
    const sigY = 95; // Y coordinate for signature
    firstPage.drawImage(sigImage, { x: sigX, y: sigY, width: width, height: height });
    console.log(`✅ Employee signature embedded`);

    // Draw date beside signature
    const dateText = formatPdfDate(w4Data.EMPLOYEE_SIGNATURE_DATE) || '';
    firstPage.drawText(dateText, {
      x: sigX + width + 150, // a little space to the right of signature
      y: sigY + (height / 2) - 10, // vertically align with middle of signature
      size: 10, // font size
      font: helveticaFont,
      color: rgb(0, 0, 0),
    });
    console.log(`✅ Employee signature date drawn beside signature: ${dateText}`);

  } catch (err) {
    console.error(`❌ ERROR embedding employee signature: ${err.message}`);
  }
} else {
  console.log("ℹ️ No employee signature URL found.");
}

    // --- "Employers Only" Section ---
    console.log("\n--- Processing Employer Section (if VERIFIED) --- Status:", w4Data.FORM_STATUS);
    if (w4Data.FORM_STATUS === 'VERIFIED') {
      setSafeText('topmostSubform[0].Page1[0].f1_13[0]', w4Data.EMPLOYER_NAME_ADDRESS || '', pdfDoc, form);
      setSafeText('topmostSubform[0].Page1[0].f1_14[0]',formatPdfDate(w4Data.FIRST_DATE_OF_EMPLOYMENT), pdfDoc, form);
      setSafeText('topmostSubform[0].Page1[0].f1_15[0]', w4Data.EMPLOYER_EIN || '', pdfDoc, form);

      // EIN: Use Page 3 field if available (better than manual draw); fallback to draw if needed
    //   setSafeText('topmostSubform[0].Page3[0].f3_01[0]', w4Data.EMPLOYER_EIN || '', pdfDoc, form);
      if (!w4Data.EMPLOYER_EIN) {
        console.log("   INFO: No Employer EIN provided.");
      } else {
        console.log(`   ✅ SUCCESS: Employer EIN set: ${w4Data.EMPLOYER_EIN}`);
      }
      console.log("   ✅ Employer section processed.");
    } else {
      console.log("   INFO: Employer section skipped (Form not VERIFIED).");
    }

    // Skip Page 3 worksheet fields (f3_02 to f3_11)
    console.log("\n--- Skipping remaining Page 3 worksheet fields ---");

    // --- Flatten Form ---
    try {
      console.log("\n--- Attempting to Flatten PDF ---");
      // Update appearances *before* flattening is crucial
      form.updateFieldAppearances(helveticaFont);
      form.flatten();
      console.log("   ✅ SUCCESS: PDF Form flattened.");
    } catch (flattenError) {
      console.error(`   ❌ ERROR: Could not flatten PDF form. Error: ${flattenError.message}`);
      // Decide if falling back to non-flattened PDF is acceptable
      console.warn("   ⚠️ WARNING: Continuing without flattening. Fields will remain editable.");
    }

    const finalBytes = await pdfDoc.save();
    console.log("\n--- ✅ PDF Generation Complete ---");
    return { success: true, pdfBytes: finalBytes };

  } catch (error) {
    console.error("\n--- ❌ FATAL ERROR during W-4 PDF generation ---", error);
    return { success: false, error: `PDF Generation Failed: ${error.message}` };
  }
}// uploadPDFToDocuments function remains the same
export async function uploadPDFToDocuments(pdfBytes, empId, orgId, formId, userId, status = 'Submitted') {
    try {
        const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'documents');
        await fs.mkdir(uploadDir, { recursive: true });

        const statusName = status === 'Verified' ? 'Verified' : 'Submitted';
        const filename = `W4_Form_${statusName}_${empId}_${formId}_${Date.now()}.pdf`;
        const filePath = path.join(uploadDir, filename);
        await fs.writeFile(filePath, pdfBytes);
        console.log(`PDF saved to: ${filePath}`);

        const documentPath = `/uploads/documents/${filename}`;
        const pool = await DBconnection();

        const subtype = 68; // W-4 Subtype ID
        const [existingDocs] = await pool.query(
            `SELECT id FROM C_EMP_DOCUMENTS WHERE empid = ? AND orgid = ? AND subtype = ? AND comments LIKE ?`,
            [empId, orgId, subtype, `%Form ID: ${formId}%`]
        );

        const docName = `Form W-4 (${statusName})`;
        const comments = `${statusName} W-4 Form. Form ID: ${formId}`;
        const document_type = 66; // 'Tax Forms'
        const document_purpose = 63; // 'Compliance'

        if (existingDocs.length > 0) {
            const [updateResult] = await pool.query(
                `UPDATE C_EMP_DOCUMENTS SET
                 document_name = ?, document_path = ?, comments = ?,
                 updated_by = ?, last_updated_date = NOW()
                 WHERE id = ?`,
                [docName, documentPath, comments, userId, existingDocs[0].id]
            );
             if (updateResult && updateResult.affectedRows > 0) {
                 console.log(`Updated W4 document record ${existingDocs[0].id} for Form ID ${formId}`);
             } else {
                 console.warn(`Attempted to update W4 document record ${existingDocs[0].id}, but no rows were affected.`);
             }
        } else {
            const [insertResult] = await pool.query(
                `INSERT INTO C_EMP_DOCUMENTS (
                    empid, orgid, document_name, document_type, subtype,
                    document_path, document_purpose, comments, startdate,
                    created_by, updated_by, created_date, last_updated_date
                 ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, ?, NOW(), NOW())`,
                [
                    empId, orgId, docName, document_type, subtype,
                    documentPath, document_purpose, comments,
                    userId, userId
                ]
            );
             if (!insertResult || !insertResult.insertId) throw new Error("Failed to insert document record.");
            console.log(`Created new W4 document record ${insertResult.insertId} for Form ID ${formId}`);
        }
        return { success: true, path: documentPath };
    } catch (error) {
        console.error('Error uploading W-4 PDF to documents:', error);
        return { success: false, error: `Failed to upload PDF: ${error.message}` };
    }
}


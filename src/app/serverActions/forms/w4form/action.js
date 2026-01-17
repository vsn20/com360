// @ts-nocheck
'use server';

import DBconnection from '@/app/utils/config/db';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { cookies } from 'next/headers';

// --- Utility Functions (MATCHING I-983 LOGIC) ---

// ✅ FIXED: Date formatting utility to prevent day-before issue (String logic only)
const formatDate = (date) => {
    if (!date) return null;

    // If it's already a YYYY-MM-DD string, trust it and return it
    if (typeof date === 'string' && date.match(/^\d{4}-\d{2}-\d{2}$/)) {
        return date;
    }

    // If it's a full ISO string (e.g. 2026-02-20T...), split it
    if (typeof date === 'string' && date.includes('T')) {
        return date.split('T')[0];
    }
    
    // Fallback for Date objects (use local time components)
    try {
        const d = new Date(date);
        if (isNaN(d.getTime())) return null;
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        if (year < 1900 || year > 2100) return null;
        return `${year}-${month}-${day}`;
    } catch (e) {
        console.warn("Error formatting date for DB:", e);
        return null;
    }
};

// ✅ FIXED: Display format MM/DD/YYYY for PDF (String logic only)
const formatPdfDate = (dateStr) => {
    if (!dateStr) return '';

    try {
        let year, month, day;
        
        // Handle YYYY-MM-DD or YYYY-MM-DDTHH...
        if (typeof dateStr === 'string') {
            const cleanDate = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
            const parts = cleanDate.split('-');
            if (parts.length === 3) {
                year = parts[0];
                month = parts[1];
                day = parts[2];
                return `${month}/${day}/${year}`;
            }
        }
        
        // Fallback for Date objects
        const d = new Date(dateStr);
        year = d.getFullYear();
        month = String(d.getMonth() + 1).padStart(2, '0');
        day = String(d.getDate()).padStart(2, '0');
        
        if (year < 1900 || year > 2100) return '';
        return `${month}/${day}/${year}`;
    } catch (e) {
        console.warn("Error formatting PDF date:", e);
        return '';
    }
};

const generateSignatureHash = (base64Data) => {
  if (!base64Data) return null;
  const base64Image = base64Data.replace(/^data:image\/\w+;base64,/, '');
  return crypto.createHash('sha256').update(base64Image).digest('hex');
};

// ✅ UPDATED: Upload signature for W-4 (Images Only, 2MB Limit - Matching I-983)
async function uploadW4Signature(base64Data, formId) {
  try {
    console.log(`📤 Uploading W-4 signature for form ID: ${formId}`);
    if (!formId || isNaN(parseInt(formId)) || parseInt(formId) <= 0) {
      throw new Error('Valid Form ID is required.');
    }
    
    // Validate base64 image format
    if (!base64Data.startsWith('data:image/')) {
      throw new Error('Invalid image format. Only PNG, JPG, or JPEG images are allowed.');
    }

    const base64Image = base64Data.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Image, 'base64');

    if (buffer.length === 0) throw new Error("Empty signature data received.");
    if (buffer.length > 2 * 1024 * 1024) throw new Error('Signature file too large (max 2MB)');

    const publicDir = path.join(process.cwd(), 'public', 'uploads', 'forms_signatures');
    await fs.mkdir(publicDir, { recursive: true });

    const filename = `form_w4_${formId}_employee_${Date.now()}.png`;
    const filePath = path.join(publicDir, filename);

    await fs.writeFile(filePath, buffer);
    const hash = generateSignatureHash(base64Image);

    console.log('✅ W-4 Employee Signature saved:', filename);
    return { success: true, path: `/uploads/forms_signatures/${filename}`, hash };
  } catch (error) {
    console.error('❌ Error uploading W-4 employee signature:', error);
    return { success: false, error: error.message };
  }
}

// --- Public-Facing Server Actions ---

export async function fetchW4FormsByEmpId(empId, orgId) {
  const pool = await DBconnection();
  try {
    const [rows] = await pool.query(
      `SELECT ID, ORG_ID, EMP_ID, FORM_STATUS, EMPLOYEE_SIGNATURE_DATE, SUBMITTED_AT, CREATED_AT
       FROM C_FORM_W4
       WHERE EMP_ID = ? AND ORG_ID = ? ORDER BY CREATED_AT DESC`,
      [empId, orgId]
    );
    return rows.map(row => ({ ...row, FORM_TYPE: 'W4' }));
  } catch (error) {
    console.error('❌ Error fetching W-4 forms:', error);
    throw new Error('Failed to fetch W-4 forms');
  }
}

export async function getW4FormDetails(formId) {
  const pool = await DBconnection();
  try {
    const numericFormId = parseInt(formId);
    if (isNaN(numericFormId) || numericFormId <= 0) throw new Error("Invalid W-4 Form ID.");

    const query = `
      SELECT w4.*,
             e.HIRE
      FROM C_FORM_W4 w4
      JOIN C_EMP e ON w4.EMP_ID = e.empid AND w4.ORG_ID = e.orgid
      WHERE w4.ID = ?
    `;
    const [rows] = await pool.query(query, [numericFormId]);
    if (rows.length === 0) {
      throw new Error(`W-4 form with ID ${numericFormId} not found.`);
    }
    return { ...rows[0], FORM_TYPE: 'W4' };
  } catch (error) {
    console.error(`❌ Error fetching W-4 form details for ID ${formId}:`, error);
    throw new Error(`Failed to fetch W-4 form details: ${error.message}`);
  }
}

export async function canEditW4Form(formId) {
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
    if (form.FORM_STATUS === 'VERIFIED') {
      return { canEdit: false, reason: 'This form has been verified and cannot be edited.' };
    }
    return { canEdit: true };
  } catch (error) {
    console.error(`❌ Error checking W4 edit permission for ID ${formId}:`, error);
    return { canEdit: false, reason: 'Error checking permissions.' };
  }
}

export async function saveW4Form(formData, formId = null) {
  const pool = await DBconnection();
  const {
    orgid, emp_id, signature_data,
    qualifying_children_count, other_dependents_count, other_credits_amount,
    first_name, last_name, ssn, address_street, address_city_state_zip, filing_status,
    multiple_jobs_checked, other_income, deductions, extra_withholding, signature_date
  } = formData;
  let currentFormId = formId ? parseInt(String(formId).replace('W4-','')) : null;

  try {
    if (!first_name || !last_name || !ssn || !address_street || !address_city_state_zip || !filing_status) {
      throw new Error("Missing required fields in Step 1.");
    }
    if (!orgid || !emp_id) {
      throw new Error("Organization ID and Employee ID are required.");
    }

    const formattedSignatureDate = formatDate(signature_date);

    const childrenAmount = parseFloat((Number(qualifying_children_count || 0) * 2000).toFixed(2));
    const otherAmount = parseFloat((Number(other_dependents_count || 0) * 500).toFixed(2));
    const otherCreditsNum = parseFloat(Number(other_credits_amount || 0).toFixed(2));
    const totalCreditsRecalculated = parseFloat((childrenAmount + otherAmount + otherCreditsNum).toFixed(2));

    const otherIncomeNum = other_income ? parseFloat(Number(other_income).toFixed(2)) : 0.00;
    const deductionsNum = deductions ? parseFloat(Number(deductions).toFixed(2)) : 0.00;
    const extraWithholdingNum = extra_withholding ? parseFloat(Number(extra_withholding).toFixed(2)) : 0.00;

    const data = [
      first_name, last_name, ssn, address_street, address_city_state_zip,
      filing_status, multiple_jobs_checked ? 1 : 0,
      childrenAmount, otherAmount, otherCreditsNum, totalCreditsRecalculated,
      otherIncomeNum, deductionsNum, extraWithholdingNum,
      formattedSignatureDate, 'DRAFT'
    ];

    if (currentFormId && !isNaN(currentFormId)) {
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
      if (!updateResult || updateResult.affectedRows === 0) {
        console.warn(`W4 Form ${currentFormId} draft update affected 0 rows.`);
      } else {
        console.log(`✅ W4 Form ${currentFormId} draft updated successfully.`);
      }
    } else {
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
      }
    } else if (currentFormId) {
      console.log(`ℹ️ No new signature provided for W4 draft ${currentFormId}.`);
    }

    return { success: true, id: currentFormId, message: 'W-4 Draft saved successfully!' };

  } catch (error) {
    console.error('❌ Error saving W-4 draft:', error);
    return { success: false, error: `Failed to save W-4 draft: ${error.message}` };
  }
}

export async function submitW4Form(formData, formId) {
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
    pool1 = await DBconnection();
    connection = await pool1.getConnection();
    await connection.beginTransaction();
    
    const cookieStore = cookies();
    const token = cookieStore.get('jwt_token')?.value;
    if (!token) throw new Error('Authentication token is missing.');
    const decoded = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
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
    const submittedAt = new Date();
    const otherIncomeNum = other_income ? parseFloat(Number(other_income).toFixed(2)) : 0.00;
    const deductionsNum = deductions ? parseFloat(Number(deductions).toFixed(2)) : 0.00;
    const extraWithholdingNum = extra_withholding ? parseFloat(Number(extra_withholding).toFixed(2)) : 0.00;

    const data = [
      first_name, last_name, ssn, address_street, address_city_state_zip,
      filing_status, multiple_jobs_checked ? 1 : 0,
      childrenAmount, otherAmount, otherCreditsNum, totalCreditsRecalculated,
      otherIncomeNum, deductionsNum, extraWithholdingNum,
      formattedSignatureDate, 'SUBMITTED', submittedAt
    ];

    // --- Database Operation (Insert or Update) ---
    if (currentFormId && !isNaN(currentFormId)) {
      console.log(`Attempting to update and submit W4 ID: ${currentFormId}`);
      const editCheck = await canEditW4Form(currentFormId);
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
      const [updateResult] = await connection.query(query, [...data, currentFormId]);
      if (!updateResult || updateResult.affectedRows === 0) {
        throw new Error(`Failed to update W4 form ID ${currentFormId} for submission.`);
      }
      console.log(`✅ W4 Form ${currentFormId} updated and status set to SUBMITTED.`);
    } else {
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
      throw new Error(`Failed to upload signature: ${signatureResult.error}`);
    }
    await connection.query(
      'UPDATE C_FORM_W4 SET EMPLOYEE_SIGNATURE_URL = ?, EMPLOYEE_SIGNATURE_HASH = ? WHERE ID = ?',
      [signatureResult.path, signatureResult.hash, currentFormId]
    );
    console.log(`✅ Signature details updated for W4 Form ID: ${currentFormId}`);

    // --- PDF Generation & Upload ---
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
    const pdfResult = await generateW4PDF(formDataForPdf);
    if (!pdfResult.success) {
      throw new Error(`Failed to generate PDF: ${pdfResult.error}`);
    }

    console.log(`Uploading 'Submitted' PDF document for W4 Form ID: ${currentFormId}`);
    const uploadResult = await uploadPDFToDocuments(pdfResult.pdfBytes, emp_id, orgid, currentFormId, userId, 'Submitted');
    if (!uploadResult.success) {
      console.error(`⚠️ Failed to upload 'Submitted' PDF: ${uploadResult.error}`);
    } else {
      console.log(`✅ 'Submitted' PDF uploaded successfully for W4 Form ID: ${currentFormId}`);
    }

    await connection.commit();
    console.log(`✅ Transaction committed for W4 Form ID: ${currentFormId} submission.`);

    return { success: true, message: 'W-4 form submitted successfully!' };

  } catch (error) {
    if (connection) {
      console.error(`Rolling back transaction: ${error.message}`);
      await connection.rollback();
    }
    console.error('❌ Error submitting W-4 form:', error);
    return { success: false, error: `Failed to submit W-4 form: ${error.message}` };
  } finally {
    if (connection) {
      console.log("DB connection released.");
    }
  }
}

export async function deleteW4Form(formId) {
  const pool = await DBconnection();
  let connection;
  try {
    connection = await DBconnection();
    await connection.beginTransaction();

    const numericFormId = parseInt(String(formId).replace('W4-',''));
    if (isNaN(numericFormId) || numericFormId <= 0) throw new Error('Invalid form ID format.');

    const [formRows] = await connection.query(
      'SELECT FORM_STATUS, EMPLOYEE_SIGNATURE_URL FROM C_FORM_W4 WHERE ID = ? FOR UPDATE',
      [numericFormId]
    );
    if (formRows.length === 0) throw new Error('Form not found');
    const form = formRows[0];

    if (form.FORM_STATUS !== 'DRAFT') throw new Error('Only draft forms can be deleted.');

    // Delete signature file
    if (form.EMPLOYEE_SIGNATURE_URL) {
      const sigPath = path.join(process.cwd(), 'public', form.EMPLOYEE_SIGNATURE_URL);
      try {
        await fs.access(sigPath);
        await fs.unlink(sigPath);
        console.log(`✅ Deleted signature file: ${sigPath}`);
      } catch (err) {
        if (err.code !== 'ENOENT') {
          console.warn(`⚠️ Could not delete signature file: ${sigPath}`, err.code);
        } else {
          console.log(`ℹ️ Signature file not found: ${sigPath}`);
        }
      }
    }

    const [deleteResult] = await connection.query('DELETE FROM C_FORM_W4 WHERE ID = ?', [numericFormId]);

    if (!deleteResult || deleteResult.affectedRows === 0) {
      throw new Error('Form record not found during delete.');
    }

    await connection.commit();
    console.log(`✅ Deleted W4 form record: ${numericFormId}`);
    return { success: true };

  } catch (error) {
    if (connection) {
      await connection.rollback();
    }
    console.error('❌ Error deleting W-4 form:', error);
    return { success: false, error: `Failed to delete W-4 form: ${error.message}` };
  } finally {
    if (connection) {
      // Release connection if necessary
    }
  }
}

// --- PDF Generation & Upload ---

export async function generateW4PDF(w4Data) {
  try {
    console.log("\n--- Starting W-4 PDF Generation ---");
    
    const templatePath = path.join(process.cwd(), 'public', 'templates', 'fw4.pdf');
    const existingPdfBytes = await fs.readFile(templatePath);
    const pdfDoc = await PDFDocument.load(existingPdfBytes);
    const form = pdfDoc.getForm();
    const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const firstPage = pdfDoc.getPage(0);

    // Safe setters
    const setSafeText = (fieldName, value) => {
      try {
        if (typeof value === 'number') value = String(Math.round(value));
        else if (typeof value === 'string') value = value.trim();
        else value = String(value || '');
        const field = form?.getTextField(fieldName);
        if (field) {
          field.setText(value);
          console.log(`✅ Set text field ${fieldName}: ${value}`);
        } else {
          console.warn(`⚠️ PDF field not found: ${fieldName}`);
        }
      } catch (err) {
        console.error(`❌ Error setting field ${fieldName}: ${err.message}`);
      }
    };

    const checkSafeBox = (fieldName) => {
      try {
        const field = form?.getCheckBox(fieldName);
        if (field) {
          field.check();
          console.log(`✅ Checked box ${fieldName}`);
        } else {
          console.warn(`⚠️ PDF checkbox not found: ${fieldName}`);
        }
      } catch (err) {
        console.error(`❌ Error checking box ${fieldName}: ${err.message}`);
      }
    };

    // --- Step 1: Personal Information ---
    console.log("\n--- Filling Step 1 ---");
    const pdfSSN = w4Data.SSN ? `***-**-${w4Data.SSN.slice(-4)}` : '';
    const fullCityStateZip = [w4Data.CITY, w4Data.STATE, w4Data.ZIP_CODE]
      .filter(Boolean)
      .join(', ');

    setSafeText('topmostSubform[0].Page1[0].Step1a[0].f1_01[0]', w4Data.FIRST_NAME || '');
    setSafeText('topmostSubform[0].Page1[0].Step1a[0].f1_02[0]', w4Data.LAST_NAME || '');
    setSafeText('topmostSubform[0].Page1[0].Step1a[0].f1_03[0]', w4Data.ADDRESS_STREET || '');
    setSafeText('topmostSubform[0].Page1[0].Step1a[0].f1_04[0]', fullCityStateZip || '');
    setSafeText('topmostSubform[0].Page1[0].f1_05[0]', pdfSSN);

    // Filing Status
    console.log("Setting Filing Status:", w4Data.FILING_STATUS);
    if (w4Data.FILING_STATUS === 'SINGLE') checkSafeBox('topmostSubform[0].Page1[0].c1_1[0]');
    else if (w4Data.FILING_STATUS === 'MARRIED_JOINTLY') checkSafeBox('topmostSubform[0].Page1[0].c1_1[1]');
    else if (w4Data.FILING_STATUS === 'HEAD_OF_HOUSEHOLD') checkSafeBox('topmostSubform[0].Page1[0].c1_1[2]');

    // --- Step 2: Multiple Jobs ---
    console.log("\n--- Filling Step 2 ---");
    if (w4Data.MULTIPLE_JOBS_CHECKED) checkSafeBox('topmostSubform[0].Page1[0].c1_2[0]');

    // --- Step 3: Dependents ---
    console.log("\n--- Filling Step 3 ---");
    setSafeText('topmostSubform[0].Page1[0].Step3_ReadOrder[0].f1_06[0]', w4Data.QUALIFYING_CHILDREN_AMOUNT || 0);
    setSafeText('topmostSubform[0].Page1[0].Step3_ReadOrder[0].f1_07[0]', w4Data.OTHER_DEPENDENTS_AMOUNT || 0);
    setSafeText('topmostSubform[0].Page1[0].f1_09[0]', w4Data.TOTAL_CREDITS || 0);

    // --- Step 4: Other Adjustments ---
    console.log("\n--- Filling Step 4 ---");
    setSafeText('topmostSubform[0].Page1[0].f1_10[0]', w4Data.OTHER_INCOME || 0);
    setSafeText('topmostSubform[0].Page1[0].f1_11[0]', w4Data.DEDUCTIONS || 0);
    setSafeText('topmostSubform[0].Page1[0].f1_12[0]', w4Data.EXTRA_WITHHOLDING || 0);

    // --- Step 5: Embed Signature Image ---
    if (w4Data.EMPLOYEE_SIGNATURE_URL) {
      try {
        const sigPath = path.join(process.cwd(), "public", w4Data.EMPLOYEE_SIGNATURE_URL);
        await fs.access(sigPath);
        const sigBytes = await fs.readFile(sigPath);
        const sigImage = await pdfDoc.embedPng(sigBytes);
        
        // Use fixed dimensions (matching I-983 style)
        const sigWidth = 200;
        const sigHeight = 30;

        // Draw signature
        const sigX = 130;
        const sigY = 105;
        firstPage.drawImage(sigImage, { x: sigX, y: sigY, width: sigWidth, height: sigHeight });
        console.log(`✅ Employee signature embedded`);

        // Draw date beside signature
        const dateText = formatPdfDate(w4Data.EMPLOYEE_SIGNATURE_DATE) || '';
        firstPage.drawText(dateText, {
          x: sigX + sigWidth + 130,
          y: sigY + (sigHeight / 2) - 5,
          size: 10,
          font: helveticaFont,
          color: rgb(0, 0, 0),
        });
        console.log(`✅ Employee signature date drawn: ${dateText}`);

      } catch (err) {
        console.error(`❌ ERROR embedding employee signature: ${err.message}`);
      }
    } else {
      console.log(" No employee signature URL found.");
    }

    // --- "Employers Only" Section ---
    console.log("\n--- Processing Employer Section (if VERIFIED) --- Status:", w4Data.FORM_STATUS);
    if (w4Data.FORM_STATUS === 'VERIFIED') {
      setSafeText('topmostSubform[0].Page1[0].f1_13[0]', w4Data.EMPLOYER_NAME_ADDRESS || '');
      setSafeText('topmostSubform[0].Page1[0].f1_14[0]', formatPdfDate(w4Data.FIRST_DATE_OF_EMPLOYMENT));
      setSafeText('topmostSubform[0].Page1[0].f1_15[0]', w4Data.EMPLOYER_EIN || '');

      if (!w4Data.EMPLOYER_EIN) {
        console.log("   ℹ️ No Employer EIN provided.");
      } else {
        console.log(`   ✅ Employer EIN set: ${w4Data.EMPLOYER_EIN}`);
      }
      console.log("   ✅ Employer section processed.");
    } else {
      console.log("   ℹ️ Employer section skipped (Form not VERIFIED).");
    }

    // --- Flatten Form ---
    try {
      console.log("\n--- Attempting to Flatten PDF ---");
      form.updateFieldAppearances(helveticaFont);
      form.flatten();
      console.log("   ✅ PDF Form flattened.");
    } catch (flattenError) {
      console.error(`   ❌ Could not flatten PDF form: ${flattenError.message}`);
      console.warn("   ⚠️ Continuing without flattening.");
    }

    const finalBytes = await pdfDoc.save();
    console.log("\n--- ✅ PDF Generation Complete ---");
    return { success: true, pdfBytes: finalBytes };

  } catch (error) {
    console.error("\n--- ❌ FATAL ERROR during W-4 PDF generation ---", error);
    return { success: false, error: `PDF Generation Failed: ${error.message}` };
  }
}

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

    const subtype = 4; // W-4 Subtype ID
    const docName = `W-4 Form (${statusName} ${new Date().toLocaleDateString()})`;
    const comments = `${statusName} W-4 Form. Form ID: ${formId}`;
    const document_type = 2; // 'Tax Forms'
    const document_purpose = 5; // 'Compliance'
    const dateNow = new Date().toLocaleDateString();
    // Check if a document for this form already exists
    const [existingDocs] = await pool.query(
      `SELECT id FROM C_EMP_DOCUMENTS WHERE empid = ? AND orgid = ? AND subtype = ? AND comments LIKE ?`,
      [empId, orgId, subtype, `%Form ID: ${formId}%`]
    );
    
    if (existingDocs.length > 0) {
      // ✅ FIX APPLIED HERE: Added document_type to the UPDATE statement
      const [updateResult] = await pool.query(
        `UPDATE C_EMP_DOCUMENTS SET
          document_name = ?, 
          document_type = ?, 
          document_path = ?, 
          comments = ?, 
          subtype = ?,
          updated_by = ?, 
          last_updated_date =?
          WHERE id = ?`,
        [
            docName, 
            document_type, // Explicitly updating type to 2
            documentPath, 
            comments, 
            subtype, 
            userId, 
            dateNow,
            existingDocs[0].id
        ]
      );

      if (updateResult && updateResult.affectedRows > 0) {
        console.log(`Updated W4 document record ${existingDocs[0].id}`);
      } else {
        console.warn(`Attempted to update W4 document record ${existingDocs[0].id}, but no rows affected.`);
      }
    } else {
      // Insert new record (This part was already correct, but included for completeness)
      const [insertResult] = await pool.query(
        `INSERT INTO C_EMP_DOCUMENTS (
            empid, orgid, document_name, document_type, subtype,
            document_path, document_purpose, comments, startdate,
            created_by, updated_by, created_date, last_updated_date
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          empId, orgId, docName, document_type, subtype,
          documentPath, document_purpose, comments,dateNow,
          userId, userId, dateNow,dateNow
        ]
      );
      if (!insertResult || !insertResult.insertId) throw new Error("Failed to insert document record.");
      console.log(`Created new W4 document record ${insertResult.insertId}`);
    }
    return { success: true, path: documentPath };
  } catch (error) {
    console.error('Error uploading W-4 PDF to documents:', error);
    return { success: false, error: `Failed to upload PDF: ${error.message}` };
  }
}
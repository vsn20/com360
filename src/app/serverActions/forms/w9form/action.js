'use server';

import DBconnection from '@/app/utils/config/db';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { PDFDocument } from 'pdf-lib';
import { cookies } from 'next/headers';

// Utility function to format dates
const formatDate = (date) => {
  if (!date || isNaN(new Date(date))) return null;
  const d = new Date(date);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
};

// Generate SHA256 hash
const generateSignatureHash = (base64Data) => {
  return crypto.createHash('sha256').update(base64Data).digest('hex');
};

// Upload W-9 employee signature
async function uploadW9Signature(base64Data, formId) {
  try {
    const base64Image = base64Data.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Image, 'base64');
    
    if (buffer.length > 5 * 1024 * 1024) throw new Error('Signature file too large (max 5MB)');
    
    const publicDir = path.join(process.cwd(), 'public', 'signatures');
    await fs.mkdir(publicDir, { recursive: true });
    
    const filename = `form_w9_${formId}_employee.png`;
    const filePath = path.join(publicDir, filename);
    
    await fs.writeFile(filePath, buffer);
    const hash = generateSignatureHash(base64Image);
    
    return { success: true, path: `/signatures/${filename}`, hash };
  } catch (error) {
    console.error('Error uploading W-9 signature:', error);
    return { success: false, error: error.message };
  }
}

// Fetch ALL W-9 forms for an employee (plural)
export async function fetchW9FormsByEmpId(empId, orgId) {
  const pool = await DBconnection();
  try {
    const [rows] = await pool.query(
      'SELECT * FROM C_FORM_W9 WHERE EMP_ID = ? AND ORG_ID = ? ORDER BY CREATED_AT DESC',
      [empId, orgId]
    );
    return rows;
  } catch (error) {
    console.error('Error fetching W-9 forms:', error);
    throw new Error('Failed to fetch W-9 forms');
  }
}

// Fetch a SINGLE W-9 form by its ID
export async function getW9FormDetails(formId) {
    const pool = await DBconnection();
    try {
        const [rows] = await pool.query('SELECT * FROM C_FORM_W9 WHERE ID = ?', [formId]);
        if (rows.length === 0) {
            throw new Error('W-9 form not found');
        }
        return rows[0];
    } catch (error) {
        console.error('Error fetching W-9 form details:', error);
        throw new Error('Failed to fetch W-9 form details');
    }
}

// Check if a W-9 form can be edited
export async function canEditW9Form(formId) {
  try {
    const pool = await DBconnection();
    const [rows] = await pool.query(
      'SELECT FORM_STATUS FROM C_FORM_W9 WHERE ID = ?',
      [formId]
    );
    if (rows.length === 0) {
      return { canEdit: false, reason: 'Form not found' };
    }
    const form = rows[0];
    
    // ✅ Change: Cannot edit if SUBMITTED (since 'VERIFIED' is removed)
    if (form.FORM_STATUS === 'SUBMITTED') {
      return { canEdit: false, reason: 'This form has been submitted and cannot be edited' };
    }
    return { canEdit: true };
  } catch (error) {
    return { canEdit: false, reason: 'Error checking permissions' };
  }
}

// Save a W-9 form as a DRAFT (either new or existing)
export async function saveW9Form(formData, formId = null) {
  const pool = await DBconnection();
  const { orgid, emp_id, signature_data, ...w9Data } = formData;
  
  try {
    const formattedSignatureDate = formatDate(w9Data.signature_date);
    let currentFormId = formId;
    
    const data = [
        w9Data.name, w9Data.business_name, w9Data.tax_classification, w9Data.llc_classification_code,
        w9Data.exempt_payee_code, w9Data.exemption_from_fatca_code, w9Data.address_street,
        w9Data.address_city_state_zip, w9Data.taxpayer_identification_number, formattedSignatureDate,
        'DRAFT'
    ];

    if (currentFormId) {
      // Check edit permissions
      const editCheck = await canEditW9Form(currentFormId);
      if (!editCheck.canEdit) throw new Error(editCheck.reason);

      const query = `
        UPDATE C_FORM_W9 SET
          NAME = ?, BUSINESS_NAME = ?, TAX_CLASSIFICATION = ?, LLC_CLASSIFICATION_CODE = ?,
          EXEMPT_PAYEE_CODE = ?, EXEMPTION_FROM_FATCA_CODE = ?, ADDRESS_STREET = ?,
          ADDRESS_CITY_STATE_ZIP = ?, TAXPAYER_IDENTIFICATION_NUMBER = ?, SIGNATURE_DATE = ?,
          FORM_STATUS = ?
        WHERE ID = ?
      `;
      await pool.query(query, [...data, currentFormId]);
    } else {
      const query = `
        INSERT INTO C_FORM_W9 (
          NAME, BUSINESS_NAME, TAX_CLASSIFICATION, LLC_CLASSIFICATION_CODE,
          EXEMPT_PAYEE_CODE, EXEMPTION_FROM_FATCA_CODE, ADDRESS_STREET, ADDRESS_CITY_STATE_ZIP,
          TAXPAYER_IDENTIFICATION_NUMBER, SIGNATURE_DATE, FORM_STATUS,
          ORG_ID, EMP_ID, CREATED_AT
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
      `;
      const [result] = await pool.query(query, [...data, orgid, emp_id]);
      currentFormId = result.insertId;
    }

    if (signature_data) {
      const signatureResult = await uploadW9Signature(signature_data, currentFormId);
      if (signatureResult.success) {
        await pool.query(
          'UPDATE C_FORM_W9 SET SIGNATURE_URL = ?, SIGNATURE_HASH = ? WHERE ID = ?',
          [signatureResult.path, signatureResult.hash, currentFormId]
        );
      } else {
        throw new Error('Failed to upload signature.');
      }
    }
    
    return { success: true, id: currentFormId, message: 'Draft saved successfully!' };

  } catch (error) {
    console.error('Error saving W-9 draft:', error);
    return { success: false, error: error.message };
  }
}

// Submit a W-9 form (sets status to SUBMITTED and generates PDF)
export async function submitW9Form(formData, formId) {
  const pool = await DBconnection();
  const { orgid, emp_id, signature_data, ...w9Data } = formData;
  let currentFormId = formId;

  try {
    const cookieStore = cookies();
    const token = cookieStore.get('jwt_token')?.value;
    if (!token) throw new Error('Authentication token is missing.');
    const decoded = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
    const userId = decoded.userId;

    if (!signature_data) {
        throw new Error('Signature is required to submit the form.');
    }

    const formattedSignatureDate = formatDate(w9Data.signature_date);
    const data = [
        w9Data.name, w9Data.business_name, w9Data.tax_classification, w9Data.llc_classification_code,
        w9Data.exempt_payee_code, w9Data.exemption_from_fatca_code, w9Data.address_street,
        w9Data.address_city_state_zip, w9Data.taxpayer_identification_number, formattedSignatureDate,
        'SUBMITTED', new Date()
    ];

    if (currentFormId) {
        // Check edit permissions
        const editCheck = await canEditW9Form(currentFormId);
        if (!editCheck.canEdit) throw new Error(editCheck.reason);

        const query = `
            UPDATE C_FORM_W9 SET
            NAME = ?, BUSINESS_NAME = ?, TAX_CLASSIFICATION = ?, LLC_CLASSIFICATION_CODE = ?,
            EXEMPT_PAYEE_CODE = ?, EXEMPTION_FROM_FATCA_CODE = ?, ADDRESS_STREET = ?,
            ADDRESS_CITY_STATE_ZIP = ?, TAXPAYER_IDENTIFICATION_NUMBER = ?, SIGNATURE_DATE = ?,
            FORM_STATUS = ?, SUBMITTED_AT = ?
            WHERE ID = ?
        `;
        await pool.query(query, [...data, currentFormId]);
    } else {
        const query = `
            INSERT INTO C_FORM_W9 (
            NAME, BUSINESS_NAME, TAX_CLASSIFICATION, LLC_CLASSIFICATION_CODE,
            EXEMPT_PAYEE_CODE, EXEMPTION_FROM_FATCA_CODE, ADDRESS_STREET, ADDRESS_CITY_STATE_ZIP,
            TAXPAYER_IDENTIFICATION_NUMBER, SIGNATURE_DATE, FORM_STATUS, SUBMITTED_AT,
            ORG_ID, EMP_ID, CREATED_AT
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
        `;
        const [result] = await pool.query(query, [...data, orgid, emp_id]);
        currentFormId = result.insertId;
    }

    const signatureResult = await uploadW9Signature(signature_data, currentFormId);
    if (!signatureResult.success) {
        throw new Error('Failed to upload signature.');
    }
    await pool.query(
      'UPDATE C_FORM_W9 SET SIGNATURE_URL = ?, SIGNATURE_HASH = ? WHERE ID = ?',
      [signatureResult.path, signatureResult.hash, currentFormId]
    );

    const savedForm = await getW9FormDetails(currentFormId);
    
    // ✅ Change: Call generateW9PDF without verifier data
    const pdfResult = await generateW9PDF(savedForm);
    if (!pdfResult.success) throw new Error('Failed to generate PDF.');

    const uploadResult = await uploadPDFToDocuments(pdfResult.pdfBytes, emp_id, orgid, currentFormId, userId);
    if (!uploadResult.success) throw new Error('Failed to upload final document.');
    
    return { success: true, message: 'W-9 form submitted successfully!' };

  } catch (error) {
    console.error('Error submitting W-9 form:', error);
    return { success: false, error: error.message };
  }
}

// Delete a W-9 form (only if DRAFT)
export async function deleteW9Form(formId) {
    const pool = await DBconnection();
    try {
        const [form] = await pool.query('SELECT FORM_STATUS, SIGNATURE_URL FROM C_FORM_W9 WHERE ID = ?', [formId]);
        if (form.length === 0) throw new Error('Form not found');
        if (form[0].FORM_STATUS !== 'DRAFT') throw new Error('Only draft forms can be deleted');

        if (form[0].SIGNATURE_URL) {
            const sigPath = path.join(process.cwd(), 'public', form[0].SIGNATURE_URL);
            try { await fs.unlink(sigPath); } catch (err) { console.warn(`Could not delete signature file: ${sigPath}`); }
        }
        
        await pool.query('DELETE FROM C_FORM_W9 WHERE ID = ?', [formId]);
        
        return { success: true };
    } catch (error) {
        console.error('Error deleting W-9 form:', error);
        return { success: false, error: error.message };
    }
}

// ✅ Change: Generates the filled W-9 PDF (Employee version, NO verifier)
// ✅ Change: Generates the filled W-9 PDF (Employee version, NO verifier)
export async function generateW9PDF(w9Data) {
  try {
    const templatePath = path.join(process.cwd(), "public", "templates", "fw9.pdf");
    const existingPdfBytes = await fs.readFile(templatePath);
    const pdfDoc = await PDFDocument.load(existingPdfBytes, { updateMetadata: false });
    const form = pdfDoc.getForm();
    const page = pdfDoc.getPages()[0];

    // 🧾 Basic text fields
    const setSafeText = (fieldName, value) => {
      try {
        const field = form.getTextField(fieldName);
        field.setText(value || "");
      } catch {
        console.warn(`⚠️ Field not found: ${fieldName}`);
      }
    };

    const checkSafeBox = (fieldName) => {
      try {
        const field = form.getCheckBox(fieldName);
        field.check();
      } catch {
        console.warn(`⚠️ Checkbox not found: ${fieldName}`);
      }
    };

    // --- Fill primary W9 fields ---
    setSafeText("topmostSubform[0].Page1[0].f1_01[0]", w9Data.NAME || "");
    setSafeText("topmostSubform[0].Page1[0].f1_02[0]", w9Data.BUSINESS_NAME || "");
    setSafeText(
      "topmostSubform[0].Page1[0].Address_ReadOrder[0].f1_07[0]",
      w9Data.ADDRESS_STREET || ""
    );
    setSafeText(
      "topmostSubform[0].Page1[0].Address_ReadOrder[0].f1_08[0]",
      w9Data.ADDRESS_CITY_STATE_ZIP || ""
    );
    setSafeText("topmostSubform[0].Page1[0].f1_05[0]", w9Data.EXEMPT_PAYEE_CODE || "");
    setSafeText("topmostSubform[0].Page1[0].f1_06[0]", w9Data.EXEMPTION_FROM_FATCA_CODE || "");

    // --- Handle Tax Classification checkboxes ---
    const taxClassMap = {
      INDIVIDUAL: "topmostSubform[0].Page1[0].Boxes3a-b_ReadOrder[0].c1_1[0]",
      C_CORPORATION: "topmostSubform[0].Page1[0].Boxes3a-b_ReadOrder[0].c1_1[1]",
      S_CORPORATION: "topmostSubform[0].Page1[0].Boxes3a-b_ReadOrder[0].c1_1[2]",
      PARTNERSHIP: "topmostSubform[0].Page1[0].Boxes3a-b_ReadOrder[0].c1_1[3]",
      TRUST_ESTATE: "topmostSubform[0].Page1[0].Boxes3a-b_ReadOrder[0].c1_1[4]",
      LLC: "topmostSubform[0].Page1[0].Boxes3a-b_ReadOrder[0].c1_1[5]",
      OTHER: "topmostSubform[0].Page1[0].Boxes3a-b_ReadOrder[0].c1_1[6]",
    };

    const taxClassField = taxClassMap[w9Data.TAX_CLASSIFICATION];
    if (taxClassField) checkSafeBox(taxClassField);

    if (w9Data.TAX_CLASSIFICATION === "LLC") {
      setSafeText(
        "topmostSubform[0].Page1[0].Boxes3a-b_ReadOrder[0].f1_03[0]",
        w9Data.LLC_CLASSIFICATION_CODE || ""
      );
    }

    // --- ✅ Corrected TIN Field Mapping for Rev. March 2024 ---
    const tin = (w9Data.TAXPAYER_IDENTIFICATION_NUMBER || "").replace(/-/g, "");
    if (tin.length === 9) {
      if (w9Data.TAX_CLASSIFICATION === "INDIVIDUAL") {
        // SSN fields - These seem correct based on your field list
        setSafeText("topmostSubform[0].Page1[0].f1_11[0]", tin.substring(0, 3));
        setSafeText("topmostSubform[0].Page1[0].f1_12[0]", tin.substring(3, 5));
        setSafeText("topmostSubform[0].Page1[0].f1_13[0]", tin.substring(5, 9));
      } else {
        // ✅ *** FIX START ***
        // EIN fields — Use field names directly from your list
        setSafeText(
          "topmostSubform[0].Page1[0].f1_14[0]", // Removed "SSN_EIN[0]."
          tin.substring(0, 2)
        );
        setSafeText(
          "topmostSubform[0].Page1[0].f1_15[0]", // Removed "SSN_EIN[0]."
          tin.substring(2, 9)
        );
        // ✅ *** FIX END ***
      }
    } else {
      console.warn(`⚠️ Invalid or missing TIN: ${tin}`);
    }

    // --- 🖋️ Embed Employee Signature + Date ---
    if (w9Data.SIGNATURE_URL) {
      try {
        const sigPath = path.join(process.cwd(), "public", w9Data.SIGNATURE_URL);
        const sigBytes = await fs.readFile(sigPath);
        const sigImage = await pdfDoc.embedPng(sigBytes);
        
        // Embed font once, outside of drawText()
        const helveticaFont = await pdfDoc.embedFont('Helvetica'); // Use standard font name

       const sigX = 200;
        const sigY = 185;

        // Draw employee signature
        page.drawImage(sigImage, { x: sigX, y: sigY, width: 200, height: 40 });

        // Compute and draw date near signature
        const dateText = w9Data.SIGNATURE_DATE
          ? new Date(w9Data.SIGNATURE_DATE).toLocaleDateString('en-US') // Use locale for formatting
          : new Date().toLocaleDateString('en-US'); // Use locale for formatting
         
          page.drawText(dateText, {
           x: 450,   // horizontally inside the Date field
          y: sigY + 10,
          size: 11,
          font: helveticaFont,
        });

      } catch (err) {
        console.warn(`⚠️ Failed to embed employee signature/date: ${err.message}`);
      }
    }

    // --- Finalize PDF ---
    form.flatten();
    const finalBytes = await pdfDoc.save();
    return { success: true, pdfBytes: finalBytes };

  } catch (error) {
    console.error("❌ Error generating W-9 PDF:", error);
    return { success: false, error: error.message };
  }
}// Upload PDF to employee documents
// Upload PDF to sub-organization documents
async function uploadPDFToDocuments(pdfBytes, empId, orgId, formId, userId) {
    let pool; // Define pool outside the try block
    try {
        pool = await DBconnection(); // Assign pool connection

        // --- Step 1: Get the suborgid for the employee ---
        const [empRows] = await pool.query(
            `SELECT suborgid FROM C_EMP WHERE empid = ? AND orgid = ?`,
            [empId, orgId]
        );

        if (empRows.length === 0 || !empRows[0].suborgid) {
            throw new Error(`Employee ${empId} not found or does not have a suborgid assigned.`);
        }
        const subOrgId = empRows[0].suborgid;
        // --- End Step 1 ---


        // --- Step 2: Save the PDF file ---
        const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'documents');
        await fs.mkdir(uploadDir, { recursive: true });

        // Keep filename descriptive, it's okay
        const filename = `W9_Form_Submitted_${empId}_${formId}_${Date.now()}.pdf`;
        const filePath = path.join(uploadDir, filename);
        await fs.writeFile(filePath, pdfBytes);
        const documentPath = `/uploads/documents/${filename}`;
        // --- End Step 2 ---


        // --- Step 3: Check for existing document in C_SUB_ORG_DOCUMENTS ---
        // Let's use suborgid, orgid, and document_purpose to identify if it exists
        // Assuming 'W9-Form' is a suitable purpose identifier
        const documentPurpose = 'Compliance';
        const documentName = `Form W-9 (Submitted ${new Date().toLocaleDateString()})`; // Add date for uniqueness if needed

        const [existingDocs] = await pool.query(
            `SELECT id FROM C_SUB_ORG_DOCUMENTS
             WHERE suborgid = ? AND orgid = ? AND document_purpose = ?`,
            [subOrgId, orgId, documentPurpose]
        );
        // --- End Step 3 ---


        // --- Step 4: Insert or Update the record in C_SUB_ORG_DOCUMENTS ---
        if (existingDocs.length > 0) {
            // Update existing record
            await pool.query(
                `UPDATE C_SUB_ORG_DOCUMENTS SET
                   document_name = ?,
                   document_path = ?,
                   updated_by = ?,
                   last_updated_date = NOW()
                 WHERE id = ?`,
                [
                    documentName,
                    documentPath,
                    userId,
                    existingDocs[0].id
                ]
            );
            console.log(`Updated W-9 document record ${existingDocs[0].id} for suborgid ${subOrgId}`);
        } else {
            // Insert new record
            await pool.query(
                `INSERT INTO C_SUB_ORG_DOCUMENTS
                   (suborgid, orgid, document_name, document_type, document_path, document_purpose, created_by, updated_by, created_date, last_updated_date)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
                [
                    subOrgId,
                    orgId,
                    documentName,
                    'W-9', // Example document type, adjust as needed
                    documentPath,
                    documentPurpose,
                    userId,
                    userId
                ]
            );
            console.log(`Inserted new W-9 document record for suborgid ${subOrgId}`);
        }
        // --- End Step 4 ---

        return { success: true, path: documentPath }; // Return path for consistency

    } catch (error) {
        console.error('Error uploading W-9 PDF to sub-org documents:', error);
        return { success: false, error: error.message };
    }
    // No finally block needed here as pool connection management might be handled elsewhere
    // If not, add pool.end() or pool.release() in a finally block if necessary.
}
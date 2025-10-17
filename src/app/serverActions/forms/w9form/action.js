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
    if (form.FORM_STATUS === 'VERIFIED') {
      return { canEdit: false, reason: 'This form has been verified and cannot be edited' };
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
      await canEditW9Form(currentFormId);
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
        await canEditW9Form(currentFormId);
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
    const pdfResult = await generateW9PDF(savedForm, savedForm.SIGNATURE_URL);
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

// Generates the filled W-9 PDF (Employee version)
export async function generateW9PDF(w9Data, verifierData = null) {
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

    // --- ✅ Correct TIN Field Mapping for Rev. March 2024 ---
    const tin = (w9Data.TAXPAYER_IDENTIFICATION_NUMBER || "").replace(/-/g, "");
    if (tin.length === 9) {
      if (w9Data.TAX_CLASSIFICATION === "INDIVIDUAL") {
        // SSN fields
        setSafeText("topmostSubform[0].Page1[0].f1_11[0]", tin.substring(0, 3));
        setSafeText("topmostSubform[0].Page1[0].f1_12[0]", tin.substring(3, 5));
        setSafeText("topmostSubform[0].Page1[0].f1_13[0]", tin.substring(5, 9));
      } else {
        // EIN fields — corrected structure (inside SSN_EIN[0])
        setSafeText(
          "topmostSubform[0].Page1[0].SSN_EIN[0].f1_14[0]",
          tin.substring(0, 2)
        );
        setSafeText(
          "topmostSubform[0].Page1[0].SSN_EIN[0].f1_15[0]",
          tin.substring(2, 9)
        );
      }
    } else {
      console.warn(`⚠️ Invalid or missing TIN: ${tin}`);
    }

    // --- 🖋️ Embed Employee Signature ---
// --- 🖋️ Embed Employee Signature + Date ---
if (w9Data.SIGNATURE_URL) {
  try {
    const sigPath = path.join(process.cwd(), "public", w9Data.SIGNATURE_URL);
    const sigBytes = await fs.readFile(sigPath);
    const sigImage = await pdfDoc.embedPng(sigBytes);

    // Embed font once, outside of drawText()
    const helveticaFont = await pdfDoc.embedFont(PDFDocument.PDFName ? 'Helvetica' : 'Helvetica');

    const sigX = 100;
    const sigY = 125;

    // Draw employee signature
    page.drawImage(sigImage, { x: sigX, y: sigY, width: 200, height: 40 });

    // Compute and draw date near signature
    const dateText = w9Data.SIGNATURE_DATE
      ? new Date(w9Data.SIGNATURE_DATE).toLocaleDateString()
      : new Date().toLocaleDateString();
     
      page.drawText(dateText, {
      x: 330,   // horizontally inside the Date field
      y: sigY + 10,
      size: 11,
      font: helveticaFont,
    });

  } catch (err) {
    console.warn(`⚠️ Failed to embed employee signature/date: ${err.message}`);
  }
}


    // --- 🖋️ Embed Verifier Signature (if provided) ---
    if (verifierData && verifierData.signatureUrl) {
      try {
        const verSigPath = path.join(process.cwd(), "public", verifierData.signatureUrl);
        const verSigBytes = await fs.readFile(verSigPath);
        const verSigImage = await pdfDoc.embedPng(verSigBytes);
        page.drawImage(verSigImage, { x: 350, y: 55, width: 150, height: 35 });
      } catch (err) {
        console.warn(`⚠️ Failed to embed verifier signature: ${err.message}`);
      }
    }

    // --- 🧾 Add verifier info text ---
    if (verifierData) {
      const verifierText = `Verified by: ${verifierData.name} (${verifierData.empId})\nDate: ${verifierData.date}`;
      page.drawText(verifierText, { x: 50, y: 40, size: 8 });
    }

    // --- Finalize PDF ---
    form.flatten();
    const finalBytes = await pdfDoc.save();
    return { success: true, pdfBytes: finalBytes };

  } catch (error) {
    console.error("❌ Error generating W-9 PDF:", error);
    return { success: false, error: error.message };
  }
}
// Upload PDF to employee documents
async function uploadPDFToDocuments(pdfBytes, empId, orgId, formId, userId) {
    try {
        const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'documents');
        await fs.mkdir(uploadDir, { recursive: true });

        const filename = `W9_Form_Submitted_${empId}_${formId}_${Date.now()}.pdf`;
        const filePath = path.join(uploadDir, filename);
        await fs.writeFile(filePath, pdfBytes);

        const documentPath = `/uploads/documents/${filename}`;
        const pool = await DBconnection();
        
        const [existingDocs] = await pool.query(
            `SELECT id FROM C_EMP_DOCUMENTS WHERE empid = ? AND orgid = ? AND subtype = 69 AND comments LIKE ?`,
            [empId, orgId, `%Form ID: ${formId}%`]
        );
        
        if (existingDocs.length > 0) {
            await pool.query(
                `UPDATE C_EMP_DOCUMENTS SET document_name = ?, document_path = ?, comments = ?, updated_by = ?, last_updated_date = NOW() WHERE id = ?`,
                ['Form W-9 (Submitted)', documentPath, `Submitted W-9 Form. Form ID: ${formId}`, userId, existingDocs[0].id]
            );
        } else {
            await pool.query(
                `INSERT INTO C_EMP_DOCUMENTS (empid, orgid, document_name, document_type, subtype, document_path, document_purpose, comments, startdate, created_by, updated_by)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, ?)`,
                [empId, orgId, 'Form W-9 (Submitted)', 65, 69, documentPath, 63, `Submitted W-9 Form. Form ID: ${formId}`, userId, userId]
            );
        }
        return { success: true };
    } catch (error) {
        console.error('Error uploading W-9 PDF to documents:', error);
        return { success: false, error: error.message };
    }
}

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

// Upload W-9 signature for sub-org
async function uploadW9SignatureSubOrg(base64Data, suborgid, timestamp) {
  try {
    // Both canvas and PDF signatures come as PNG data URLs now
    const base64Image = base64Data.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Image, 'base64');
    
    if (buffer.length > 5 * 1024 * 1024) throw new Error('Signature file too large (max 5MB)');
    
    const publicDir = path.join(process.cwd(), 'public', 'uploads', 'forms_signatures');
    await fs.mkdir(publicDir, { recursive: true });
    
    const filename = `w9_suborg_${suborgid}_${timestamp}.png`;
    const filePath = path.join(publicDir, filename);
    
    await fs.writeFile(filePath, buffer);
    const hash = generateSignatureHash(base64Image);
    
    return { success: true, path: `/uploads/forms_signatures/${filename}`, hash };
  } catch (error) {
    console.error('Error uploading W-9 signature:', error);
    return { success: false, error: error.message };
  }
}

// Generate W-9 PDF
async function generateW9PDF(w9Data) {
  try {
    const templatePath = path.join(process.cwd(), "public", "templates", "fw9.pdf");
    const existingPdfBytes = await fs.readFile(templatePath);
    const pdfDoc = await PDFDocument.load(existingPdfBytes, { updateMetadata: false });
    const form = pdfDoc.getForm();
    const page = pdfDoc.getPages()[0];

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

    // Fill primary W9 fields
    setSafeText("topmostSubform[0].Page1[0].f1_01[0]", w9Data.name || "");
    setSafeText("topmostSubform[0].Page1[0].f1_02[0]", w9Data.business_name || "");
    setSafeText(
      "topmostSubform[0].Page1[0].Address_ReadOrder[0].f1_07[0]",
      w9Data.address_street || ""
    );
    setSafeText(
      "topmostSubform[0].Page1[0].Address_ReadOrder[0].f1_08[0]",
      w9Data.address_city_state_zip || ""
    );
    setSafeText("topmostSubform[0].Page1[0].f1_05[0]", w9Data.exempt_payee_code || "");
    setSafeText("topmostSubform[0].Page1[0].f1_06[0]", w9Data.exemption_from_fatca_code || "");

    // Handle Tax Classification checkboxes
    const taxClassMap = {
      INDIVIDUAL: "topmostSubform[0].Page1[0].Boxes3a-b_ReadOrder[0].c1_1[0]",
      C_CORPORATION: "topmostSubform[0].Page1[0].Boxes3a-b_ReadOrder[0].c1_1[1]",
      S_CORPORATION: "topmostSubform[0].Page1[0].Boxes3a-b_ReadOrder[0].c1_1[2]",
      PARTNERSHIP: "topmostSubform[0].Page1[0].Boxes3a-b_ReadOrder[0].c1_1[3]",
      TRUST_ESTATE: "topmostSubform[0].Page1[0].Boxes3a-b_ReadOrder[0].c1_1[4]",
      LLC: "topmostSubform[0].Page1[0].Boxes3a-b_ReadOrder[0].c1_1[5]",
      OTHER: "topmostSubform[0].Page1[0].Boxes3a-b_ReadOrder[0].c1_1[6]",
    };

    const taxClassField = taxClassMap[w9Data.tax_classification];
    if (taxClassField) checkSafeBox(taxClassField);

    if (w9Data.tax_classification === "LLC") {
      setSafeText(
        "topmostSubform[0].Page1[0].Boxes3a-b_ReadOrder[0].f1_03[0]",
        w9Data.llc_classification_code || ""
      );
    }

    // TIN Field Mapping
    const tin = (w9Data.taxpayer_identification_number || "").replace(/-/g, "");
    if (tin.length === 9) {
      if (w9Data.tax_classification === "INDIVIDUAL") {
        setSafeText("topmostSubform[0].Page1[0].f1_11[0]", tin.substring(0, 3));
        setSafeText("topmostSubform[0].Page1[0].f1_12[0]", tin.substring(3, 5));
        setSafeText("topmostSubform[0].Page1[0].f1_13[0]", tin.substring(5, 9));
      } else {
        setSafeText("topmostSubform[0].Page1[0].f1_14[0]", tin.substring(0, 2));
        setSafeText("topmostSubform[0].Page1[0].f1_15[0]", tin.substring(2, 9));
      }
    }

    // Embed Signature + Date
    if (w9Data.signature_url) {
      try {
        const sigPath = path.join(process.cwd(), "public", w9Data.signature_url);
        const sigBytes = await fs.readFile(sigPath);
        const sigImage = await pdfDoc.embedPng(sigBytes);
        
        const helveticaFont = await pdfDoc.embedFont('Helvetica');

        const sigX = 200;
        const sigY = 185;

        // Draw signature image
        page.drawImage(sigImage, { x: sigX, y: sigY, width: 200, height: 40 });

        // Draw date
        const dateText = w9Data.signature_date
          ? new Date(w9Data.signature_date).toLocaleDateString('en-US')
          : new Date().toLocaleDateString('en-US');
         
        page.drawText(dateText, {
          x: 450,
          y: sigY + 10,
          size: 11,
          font: helveticaFont,
        });

      } catch (err) {
        console.warn(`⚠️ Failed to embed signature/date: ${err.message}`);
      }
    }

    form.flatten();
    const finalBytes = await pdfDoc.save();
    return { success: true, pdfBytes: finalBytes };

  } catch (error) {
    console.error("❌ Error generating W-9 PDF:", error);
    return { success: false, error: error.message };
  }
}

// Upload PDF to sub-organization documents
async function uploadPDFToSubOrgDocuments(pdfBytes, suborgid, orgid, userId) {
    try {
        const pool = await DBconnection();

        // Save the PDF file
        const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'documents');
        await fs.mkdir(uploadDir, { recursive: true });

        const filename = `W9_Form_SubOrg_${suborgid}_${Date.now()}.pdf`;
        const filePath = path.join(uploadDir, filename);
        await fs.writeFile(filePath, pdfBytes);
        const documentPath = `/uploads/documents/${filename}`;

        const documentPurpose = 'Auto Generated';
        const documentType = 6; // W-9 type ID
        const documentName = `W-9 Form (Submitted ${new Date().toLocaleDateString()})`;

        // Check for existing W-9 document
        const [existingDocs] = await pool.query(
            `SELECT id FROM C_SUB_ORG_DOCUMENTS
             WHERE suborgid = ? AND orgid = ? AND document_type = ?`,
            [suborgid, orgid, documentType]
        );

        if (existingDocs.length > 0) {
            // Update existing record
            await pool.query(
                `UPDATE C_SUB_ORG_DOCUMENTS SET
                   document_name = ?,
                   document_path = ?,
                   updated_by = ?,
                   last_updated_date = NOW()
                 WHERE id = ?`,
                [documentName, documentPath, userId, existingDocs[0].id]
            );
            console.log(`✅ Updated W-9 document for suborgid ${suborgid}`);
        } else {
            // Insert new record
            await pool.query(
                `INSERT INTO C_SUB_ORG_DOCUMENTS
                   (suborgid, orgid, document_name, document_type, document_path, document_purpose, created_by, updated_by, created_date, last_updated_date)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
                [suborgid, orgid, documentName, documentType, documentPath, documentPurpose, userId, userId]
            );
            console.log(`✅ Inserted new W-9 document for suborgid ${suborgid}`);
        }

        return { success: true, path: documentPath };

    } catch (error) {
        console.error('❌ Error uploading W-9 PDF to sub-org documents:', error);
        return { success: false, error: error.message };
    }
}

// Save W-9 form as draft (for sub-org)
export async function saveW9FormForSubOrg(formData) {
  try {
    // For sub-org W-9, we don't need to save to database
    // Just return success - data will only be saved when submitted
    return { success: true, message: 'Draft saved locally' };
  } catch (error) {
    console.error('Error saving W-9 draft:', error);
    return { success: false, error: error.message };
  }
}

// Submit W-9 form (for sub-org) - generates PDF and saves to documents
export async function submitW9FormForSubOrg(formData) {
  try {
    const { suborgid, orgid, signature_data, ...w9Data } = formData;

    if (!signature_data) {
      throw new Error('Signature is required to submit the form.');
    }

    // Get user ID from JWT
    const cookieStore = cookies();
    const token = cookieStore.get('jwt_token')?.value;
    if (!token) throw new Error('Authentication token is missing.');
    const decoded = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
    const userId = decoded.userId;

    const timestamp = Date.now();

    // Upload signature (both canvas and PDF-extracted are PNG now)
    const signatureResult = await uploadW9SignatureSubOrg(signature_data, suborgid, timestamp);
    
    if (!signatureResult.success) {
      throw new Error('Failed to upload signature.');
    }

    // Prepare data for PDF generation
    const pdfData = {
      name: w9Data.name,
      business_name: w9Data.business_name,
      tax_classification: w9Data.tax_classification,
      llc_classification_code: w9Data.llc_classification_code,
      exempt_payee_code: w9Data.exempt_payee_code,
      exemption_from_fatca_code: w9Data.exemption_from_fatca_code,
      address_street: w9Data.address_street,
      address_city_state_zip: `${w9Data.city}, ${w9Data.state} ${w9Data.zip_code}`,
      taxpayer_identification_number: w9Data.taxpayer_identification_number,
      signature_date: w9Data.signature_date,
      signature_url: signatureResult.path
    };

    // Generate PDF
    const pdfResult = await generateW9PDF(pdfData);
    if (!pdfResult.success) {
      throw new Error('Failed to generate PDF.');
    }

    // Upload to documents
    const uploadResult = await uploadPDFToSubOrgDocuments(
      pdfResult.pdfBytes,
      suborgid,
      orgid,
      userId
    );

    if (!uploadResult.success) {
      throw new Error('Failed to save document.');
    }

    return { success: true, message: 'W-9 form submitted successfully!' };

  } catch (error) {
    console.error('❌ Error submitting W-9 form:', error);
    return { success: false, error: error.message };
  }
}
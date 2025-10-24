'use server';

import DBconnection from '@/app/utils/config/db';
import { cookies } from 'next/headers';
import fs from 'fs/promises';
import path from 'path';
import { PDFDocument, rgb } from 'pdf-lib';

// Helper to decode JWT
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

// Uploads the verifier's signature for a W-9 form
async function uploadW9VerifierSignature(base64Data, formId) {
  try {
    const base64Image = base64Data.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Image, 'base64');
    
    const publicDir = path.join(process.cwd(), 'public', 'signatures');
    await fs.mkdir(publicDir, { recursive: true });
    
    const filename = `form_w9_${formId}_verifier.png`;
    const filePath = path.join(publicDir, filename);
    
    await fs.writeFile(filePath, buffer);
    
    return { success: true, path: `/signatures/${filename}` };
  } catch (error) {
    console.error('Error uploading W-9 verifier signature:', error);
    return { success: false, error: error.message };
  }
}

// Generates the final, verified W-9 PDF
async function generateW9PDF(w9Data, verifierData) {
  try {
    const templatePath = path.join(process.cwd(), 'public', 'templates', 'fw9.pdf');
    const pdfBytes = await fs.readFile(templatePath);
    const pdfDoc = await PDFDocument.load(pdfBytes, { updateMetadata: false });
    const form = pdfDoc.getForm();
    const page = pdfDoc.getPages()[0];

    form.getTextField('topmostSubform[0].Page1[0].f1_01[0]').setText(w9Data.NAME || '');
    form.getTextField('topmostSubform[0].Page1[0].f1_02[0]').setText(w9Data.BUSINESS_NAME || '');
    form.getTextField('topmostSubform[0].Page1[0].Address_ReadOrder[0].f1_07[0]').setText(w9Data.ADDRESS_STREET || '');
    form.getTextField('topmostSubform[0].Page1[0].Address_ReadOrder[0].f1_08[0]').setText(w9Data.ADDRESS_CITY_STATE_ZIP || '');
    form.getTextField('topmostSubform[0].Page1[0].f1_05[0]').setText(w9Data.EXEMPT_PAYEE_CODE || '');
    form.getTextField('topmostSubform[0].Page1[0].f1_06[0]').setText(w9Data.EXEMPTION_FROM_FATCA_CODE || '');

    const tin = (w9Data.TAXPAYER_IDENTIFICATION_NUMBER || '').replace(/-/g, '');
    if (tin.length === 9) {
        if (w9Data.TAX_CLASSIFICATION === 'INDIVIDUAL') {
            form.getTextField('topmostSubform[0].Page1[0].f1_11[0]').setText(tin.substring(0, 3));
            form.getTextField('topmostSubform[0].Page1[0].f1_12[0]').setText(tin.substring(3, 5));
            form.getTextField('topmostSubform[0].Page1[0].f1_13[0]').setText(tin.substring(5, 9));
        } else {
            form.getTextField('topmostSubform[0].Page1[0].f1_14[0]').setText(tin.substring(0, 2));
            form.getTextField('topmostSubform[0].Page1[0].f1_15[0]').setText(tin.substring(2, 9));
        }
    }

    const taxClassMap = {
        'INDIVIDUAL': 'topmostSubform[0].Page1[0].Boxes3a-b_ReadOrder[0].c1_1[0]',
        'C_CORPORATION': 'topmostSubform[0].Page1[0].Boxes3a-b_ReadOrder[0].c1_1[1]',
        'S_CORPORATION': 'topmostSubform[0].Page1[0].Boxes3a-b_ReadOrder[0].c1_1[2]',
        'PARTNERSHIP': 'topmostSubform[0].Page1[0].Boxes3a-b_ReadOrder[0].c1_1[3]',
        'TRUST_ESTATE': 'topmostSubform[0].Page1[0].Boxes3a-b_ReadOrder[0].c1_1[4]',
        'LLC': 'topmostSubform[0].Page1[0].Boxes3a-b_ReadOrder[0].c1_1[5]',
    };
    if (taxClassMap[w9Data.TAX_CLASSIFICATION]) {
        form.getCheckBox(taxClassMap[w9Data.TAX_CLASSIFICATION]).check();
    }
    if (w9Data.TAX_CLASSIFICATION === 'LLC') {
        form.getTextField('topmostSubform[0].Page1[0].Boxes3a-b_ReadOrder[0].f1_03[0]').setText(w9Data.LLC_CLASSIFICATION_CODE || '');
    }

    if (w9Data.SIGNATURE_URL) {
        try {
            const empSigPath = path.join(process.cwd(), 'public', w9Data.SIGNATURE_URL);
            const empSigBytes = await fs.readFile(empSigPath);
            const empSigImage = await pdfDoc.embedPng(empSigBytes);
            page.drawImage(empSigImage, { x: 90, y: 155, width: 200, height: 40 });
        } catch (err) {
            console.warn(`Could not embed employee signature: ${err.message}`);
        }
    }
    
    // ✅ ✅ ✅ START OF FIX ✅ ✅ ✅
    // Add signature date to the form, same as in the other file
    if (w9Data.SIGNATURE_DATE) {
        const date = new Date(w9Data.SIGNATURE_DATE);
        // Ensure to use UTC date parts to avoid timezone issues
        const formattedPdfDate = `${date.getUTCMonth() + 1}/${date.getUTCDate()}/${date.getUTCFullYear()}`;
        page.drawText(formattedPdfDate, { x: 475, y: 162, size: 10, color: rgb(0, 0, 0) });
    }
    // ✅ ✅ ✅ END OF FIX ✅ ✅ ✅

    if (verifierData.signatureUrl) {
        try {
            const verSigPath = path.join(process.cwd(), 'public', verifierData.signatureUrl);
            const verSigBytes = await fs.readFile(verSigPath);
            const verSigImage = await pdfDoc.embedPng(verSigBytes);
            page.drawImage(verSigImage, { x: 350, y: 55, width: 150, height: 35 }); 
        } catch (err) {
            console.warn(`Could not embed verifier signature: ${err.message}`);
        }
    }
    
    const verifierText = `Verified by: ${verifierData.name} (${verifierData.empId})\nDate: ${verifierData.date}`;
    page.drawText(verifierText, { x: 50, y: 40, size: 8 });
    
    form.flatten();
    const finalPdfBytes = await pdfDoc.save();
    return { success: true, pdfBytes: finalPdfBytes };

  } catch (error) {
    console.error('Error generating W-9 PDF:', error);
    return { success: false, error: error.message };
  }
}

async function uploadW9PDFToDocuments(pdfBytes, empId, orgId, formId, userId) {
    try {
        const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'documents');
        await fs.mkdir(uploadDir, { recursive: true });

        const filename = `W9_Form_Verified_${empId}_${formId}_${Date.now()}.pdf`;
        const filePath = path.join(uploadDir, filename);
        await fs.writeFile(filePath, pdfBytes);

        const documentPath = `/uploads/documents/${filename}`;
        const pool = await DBconnection();
        
        const [existingDocs] = await pool.query(
            `SELECT id FROM C_EMP_DOCUMENTS 
             WHERE empid = ? AND orgid = ? AND subtype = 69 AND comments LIKE ?`,
            [empId, orgId, `%Form ID: ${formId}%`]
        );

        if (existingDocs.length > 0) {
            await pool.query(
                `UPDATE C_EMP_DOCUMENTS SET 
                 document_name = ?, document_path = ?, comments = ?, 
                 updated_by = ?, last_updated_date = NOW() 
                 WHERE id = ?`,
                [
                    `W-9 Form (Verified)`, documentPath, 
                    `W-9 verified and uploaded. Form ID: ${formId}`, 
                    userId, existingDocs[0].id
                ]
            );
        } else {
            await pool.query(
                `INSERT INTO C_EMP_DOCUMENTS 
                 (empid, orgid, document_name, document_type, subtype, document_path, document_purpose, 
                  comments, startdate, created_by, updated_by)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, ?)`,
                [
                    empId, orgId, `W-9 Form (Verified)`, 65, 69, documentPath, 63, 
                    `W-9 verified and uploaded. Form ID: ${formId}`, userId, userId
                ]
            );
        }
        return { success: true, path: documentPath };
    } catch (error) {
        console.error('Error uploading W-9 PDF to documents:', error);
        return { success: false, error: error.message };
    }
}

export async function verifyW9Form({ formId: prefixedFormId, verifierId, orgId, signatureData }) {
  try {
    const formId = parseInt(String(prefixedFormId).replace('W9-', ''));
    if (isNaN(formId)) {
        throw new Error('Invalid Form ID format.');
    }

    const pool = await DBconnection();
    const cookieStore = cookies();
    const token = cookieStore.get('jwt_token')?.value;
    const decoded = decodeJwt(token);
    if (!decoded || !decoded.userId) throw new Error('Authentication failed.');

    const sigUploadResult = await uploadW9VerifierSignature(signatureData, formId);
    if (!sigUploadResult.success) throw new Error('Failed to upload verifier signature.');

    const verificationDate = new Date();
    const formattedDate = verificationDate.toISOString().split('T')[0];
    
    await pool.query(
      `UPDATE C_FORM_W9 SET 
         FORM_STATUS = 'VERIFIED',
         VERIFIER_ID = ?,
         VERIFIER_SIGNATURE_URL = ?,
         VERIFIER_SIGNATURE_DATE = ?,
         VERIFIED_AT = NOW()
       WHERE ID = ?`,
      [verifierId, sigUploadResult.path, formattedDate, formId]
    );

    const [w9Rows] = await pool.query('SELECT * FROM C_FORM_W9 WHERE ID = ?', [formId]);
    if (w9Rows.length === 0) throw new Error('W-9 form not found after update.');
    const w9Data = w9Rows[0];

    const [verifierRows] = await pool.query('SELECT EMP_FST_NAME, EMP_LAST_NAME FROM C_EMP WHERE empid = ? AND orgid = ?', [verifierId, orgId]);
    if (verifierRows.length === 0) {
      console.error(`CRITICAL: Verifier lookup failed for empid: "${verifierId}" and orgid: "${orgId}".`);
      throw new Error(`Verifier not found. Your user ID (${verifierId}) could not be found.`);
    }
    const verifierInfo = verifierRows[0];

    const pdfResult = await generateW9PDF(w9Data, {
        name: `${verifierInfo.EMP_FST_NAME} ${verifierInfo.EMP_LAST_NAME}`,
        empId: verifierId,
        date: verificationDate.toLocaleDateString(),
        signatureUrl: sigUploadResult.path
    });

    if (!pdfResult.success) {
        throw new Error(pdfResult.error);
    }
    
    const uploadResult = await uploadW9PDFToDocuments(pdfResult.pdfBytes, w9Data.EMP_ID, orgId, formId, decoded.userId);
    if (!uploadResult.success) {
        throw new Error(uploadResult.error);
    }

    return { success: true, message: 'W-9 Form successfully verified and document saved.' };
  } catch (error) {
    console.error('Error in verifyW9Form action:', error);
    return { success: false, error: error.message };
  }
}


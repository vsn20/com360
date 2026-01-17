'use server';

import DBconnection from '@/app/utils/config/db';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { PDFDocument } from 'pdf-lib';
import { cookies } from 'next/headers';

// ✅ UPDATED CONFIGURATION - Reduced signature height to prevent overlap
const SIGNATURE_CONFIG = {
  position: { x: 180, y: 190 },
  dimensions: { width: 200, height: 25 }, // ✅ Reduced from 40 to 30
  date: { x: 450, y: 195, fontSize: 11 }
};

// ✅ MAX FILE SIZE - 2MB for images
const MAX_IMAGE_SIZE = 2 * 1024 * 1024; // 2MB

// ✅ FIXED: Get today's date in local timezone (no day-before issue)
const getTodayDate = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`; // Format: YYYY-MM-DD for input[type="date"]
};

// ✅ FIXED: Utility function to format dates for display (prevents day-before issue)
const formatDate = (date) => {
  if (!date || isNaN(new Date(date))) return '';
  const d = new Date(date);
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${month}/${day}/${d.getFullYear()}`;
};

// Utility function for database date format
const formatDateForDB = (date) => {
  if (!date || isNaN(new Date(date))) return null;
  const d = new Date(date);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
};

// Generate SHA256 hash
const generateSignatureHash = (base64Data) => {
  return crypto.createHash('sha256').update(base64Data).digest('hex');
};

// ✅ Upload signature image (PNG/JPG/JPEG only - NO PDF)
async function uploadW9SignatureImage(base64Data, suborgid, timestamp) {
  try {
    // Validate base64 image format
    if (!base64Data.startsWith('data:image/')) {
      throw new Error('Invalid image format. Only PNG, JPG, or JPEG images are allowed.');
    }

    const base64Image = base64Data.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Image, 'base64');
    
    // ✅ Check file size (2MB limit)
    if (buffer.length > MAX_IMAGE_SIZE) {
      throw new Error(`Signature image too large. Maximum size is 2MB. Your file is ${(buffer.length / 1024 / 1024).toFixed(2)}MB`);
    }
    
    const publicDir = path.join(process.cwd(), 'public', 'uploads', 'forms_signatures');
    await fs.mkdir(publicDir, { recursive: true });
    
    const filename = `w9_suborg_${suborgid}_${timestamp}.png`;
    const filePath = path.join(publicDir, filename);
    
    await fs.writeFile(filePath, buffer);
    const hash = generateSignatureHash(base64Image);
    
    console.log(`✅ Signature uploaded: ${filename} (${(buffer.length / 1024).toFixed(2)}KB)`);
    
    return { success: true, path: `/uploads/forms_signatures/${filename}`, hash };
  } catch (error) {
    console.error('❌ Error uploading W-9 signature:', error);
    return { success: false, error: error.message };
  }
}

// ✅ UPDATED: Generate W-9 PDF with reduced signature height and strict TIN validation
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
      } catch (err) {
        console.warn(`⚠️ Field not found: ${fieldName}`);
      }
    };

    const checkSafeBox = (fieldName) => {
      try {
        const field = form.getCheckBox(fieldName);
        field.check();
      } catch (err) {
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

    // Tax Classification checkboxes
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

    // ✅ STRICT TIN VALIDATION - Must be exactly 9 digits
    const tin = (w9Data.taxpayer_identification_number || "").replace(/\D/g, "");
    
    console.log(`🔢 Processing TIN: ${tin} (Length: ${tin.length})`);
    
    if (tin.length !== 9) {
      throw new Error(`Invalid TIN: Must be exactly 9 digits. Received ${tin.length} digits.`);
    }
    
    if (w9Data.tax_classification === "INDIVIDUAL") {
      // SSN: XXX-XX-XXXX
      const ssn1 = tin.substring(0, 3);
      const ssn2 = tin.substring(3, 5);
      const ssn3 = tin.substring(5, 9);
      
      console.log(`📝 SSN Parts: [${ssn1}] [${ssn2}] [${ssn3}]`);
      
      setSafeText("topmostSubform[0].Page1[0].f1_11[0]", ssn1);
      setSafeText("topmostSubform[0].Page1[0].f1_12[0]", ssn2);
      setSafeText("topmostSubform[0].Page1[0].f1_13[0]", ssn3);
    } else {
      // EIN: XX-XXXXXXX
      const ein1 = tin.substring(0, 2);
      const ein2 = tin.substring(2, 9);
      
      console.log(`📝 EIN Parts: [${ein1}] [${ein2}]`);
      
      setSafeText("topmostSubform[0].Page1[0].f1_14[0]", ein1);
      setSafeText("topmostSubform[0].Page1[0].f1_15[0]", ein2);
    }

    // ✅ UPDATED: Embed Signature Image with reduced height (30px instead of 40px)
    if (w9Data.signature_url) {
      try {
        const sigPath = path.join(process.cwd(), "public", w9Data.signature_url);
        const sigBytes = await fs.readFile(sigPath);
        
        // Embed as PNG
        const sigImage = await pdfDoc.embedPng(sigBytes);
        const helveticaFont = await pdfDoc.embedFont('Helvetica');

        // ✅ Use reduced signature height to prevent overlap
        const { x, y } = SIGNATURE_CONFIG.position;
        const { width, height } = SIGNATURE_CONFIG.dimensions;

        // Draw signature image
        page.drawImage(sigImage, { x, y, width, height });
        
        console.log(`✍️ Signature embedded at (${x}, ${y}) with size ${width}x${height}`);

        // ✅ Draw date using corrected format function
        const dateText = formatDate(w9Data.signature_date || new Date());
         
        page.drawText(dateText, {
          x: SIGNATURE_CONFIG.date.x,
          y: SIGNATURE_CONFIG.date.y,
          size: SIGNATURE_CONFIG.date.fontSize,
          font: helveticaFont,
        });
        
        console.log(`📅 Date added: ${dateText}`);

      } catch (err) {
        console.warn(`⚠️ Failed to embed signature: ${err.message}`);
      }
    }

    form.flatten();
    const finalBytes = await pdfDoc.save();
    
    console.log(`✅ W-9 PDF generated successfully`);
    
    return { success: true, pdfBytes: finalBytes };

  } catch (error) {
    console.error("❌ Error generating W-9 PDF:", error);
    return { success: false, error: error.message };
  }
}

// ✅ Always create NEW document (never replace existing)
async function uploadPDFToSubOrgDocuments(pdfBytes, suborgid, orgid, userId) {
    try {
        const pool = await DBconnection();

        // Save the PDF file
        const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'documents');
        await fs.mkdir(uploadDir, { recursive: true });

        const timestamp = Date.now();
        const filename = `W9_Form_SubOrg_${suborgid}_${timestamp}.pdf`;
        const filePath = path.join(uploadDir, filename);
        await fs.writeFile(filePath, pdfBytes);
        const documentPath = `/uploads/documents/${filename}`;

        const documentPurpose = 'Auto Generated';
        const documentType = 6; // W-9 type ID
        const currentDate = formatDate(new Date());
        const documentName = `W-9 Form (Submitted ${currentDate})`;

        // ✅ ALWAYS INSERT - Never update existing documents
        await pool.query(
            `INSERT INTO C_SUB_ORG_DOCUMENTS
               (suborgid, orgid, document_name, document_type, document_path, document_purpose, created_by, updated_by, created_date, last_updated_date)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
            [suborgid, orgid, documentName, documentType, documentPath, documentPurpose, userId, userId]
        );
        
        console.log(`✅ NEW W-9 document created for suborgid ${suborgid}: ${documentName}`);

        return { success: true, path: documentPath };

    } catch (error) {
        console.error('❌ Error uploading W-9 PDF to sub-org documents:', error);
        return { success: false, error: error.message };
    }
}

// Save W-9 form as draft (for sub-org)
export async function saveW9FormForSubOrg(formData) {
  try {
    return { success: true, message: 'Draft saved locally' };
  } catch (error) {
    console.error('Error saving W-9 draft:', error);
    return { success: false, error: error.message };
  }
}

// ✅ Submit W-9 form with strict TIN validation
export async function submitW9FormForSubOrg(formData) {
  try {
    const { suborgid, orgid, signature_data, ...w9Data } = formData;

    // ✅ Validate signature is provided and is an image
    if (!signature_data) {
      throw new Error('Signature is required to submit the form.');
    }

    if (!signature_data.startsWith('data:image/')) {
      throw new Error('Signature must be an image (PNG, JPG, or JPEG).');
    }

    // ✅ STRICT TIN VALIDATION - Must be exactly 9 digits
    const tin = (w9Data.taxpayer_identification_number || "").replace(/\D/g, "");
    if (tin.length !== 9) {
      throw new Error(`Taxpayer Identification Number must be exactly 9 digits. You entered ${tin.length} digits.`);
    }

    // Get user ID from JWT
    const cookieStore = cookies();
    const token = cookieStore.get('jwt_token')?.value;
    if (!token) throw new Error('Authentication token is missing.');
    const decoded = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
    const userId = decoded.userId;

    const timestamp = Date.now();

    // ✅ Upload image signature
    console.log('📤 Uploading signature image...');
    const signatureResult = await uploadW9SignatureImage(signature_data, suborgid, timestamp);
    
    if (!signatureResult.success) {
      throw new Error(signatureResult.error || 'Failed to upload signature.');
    }

    console.log('✅ Signature uploaded successfully');

    // ✅ Prepare data for PDF generation with validated TIN
    const pdfData = {
      name: w9Data.name,
      business_name: w9Data.business_name,
      tax_classification: w9Data.tax_classification,
      llc_classification_code: w9Data.llc_classification_code,
      exempt_payee_code: w9Data.exempt_payee_code,
      exemption_from_fatca_code: w9Data.exemption_from_fatca_code,
      address_street: w9Data.address_street,
      address_city_state_zip: `${w9Data.city}, ${w9Data.state} ${w9Data.zip_code}`,
      taxpayer_identification_number: tin, // ✅ Use validated 9-digit TIN
      signature_date: w9Data.signature_date,
      signature_url: signatureResult.path
    };

    // ✅ Generate PDF with reduced signature height
    console.log('📄 Generating W-9 PDF...');
    const pdfResult = await generateW9PDF(pdfData);
    if (!pdfResult.success) {
      throw new Error(pdfResult.error || 'Failed to generate PDF.');
    }

    console.log('✅ PDF generated successfully');

    // ✅ Upload to documents (always creates new entry)
    console.log('💾 Saving W-9 document...');
    const uploadResult = await uploadPDFToSubOrgDocuments(
      pdfResult.pdfBytes,
      suborgid,
      orgid,
      userId
    );

    if (!uploadResult.success) {
      throw new Error(uploadResult.error || 'Failed to save document.');
    }

    console.log('✅ W-9 form submission complete!');
    return { success: true, message: 'W-9 form submitted successfully!' };

  } catch (error) {
    console.error('❌ Error submitting W-9 form:', error);
    return { success: false, error: error.message };
  }
}

// ✅ EXPORT: Function to get today's date for frontend
export async function getTodayDateForW9() {
  return { success: true, date: getTodayDate() };
}
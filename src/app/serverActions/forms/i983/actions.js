// src/app/serverActions/forms/i983/actions.js
// @ts-nocheck
'use server';

import DBconnection from '@/app/utils/config/db';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { PDFDocument, StandardFonts, rgb, PDFRadioGroup } from 'pdf-lib';
import { cookies } from 'next/headers';
import { fetchEmployeeById } from '@/app/serverActions/Employee/overview';

// --- Utility Functions ---

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

// Decode JWT to get user ID
const decodeJwt = (token) => {
    try {
        if (!token) return null;
        const base64Url = token.split('.')[1];
        if (!base64Url) return null;
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = Buffer.from(base64, 'base64').toString('utf8');
        const decoded = JSON.parse(jsonPayload);
        return decoded.userId || decoded.empid || decoded.sub || null;
    } catch (error) {
        console.error('Error decoding JWT:', error);
        return null;
    }
};

// ✅ UPDATED: Upload signature for I-983 (Images Only, 2MB Limit)
async function uploadI983Signature(base64Data, formId, signatureIdentifier) {
    try {
        console.log(`📝 Uploading I-983 signature for form ID: ${formId}, Type: ${signatureIdentifier}`);
        if (!formId || isNaN(parseInt(formId)) || parseInt(formId) <= 0 || !signatureIdentifier) {
            throw new Error('Form ID and Signature Identifier are required.');
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
        
        const filename = `form_i983_${formId}_${signatureIdentifier}_${Date.now()}.png`;
        const filePath = path.join(publicDir, filename);
        
        await fs.writeFile(filePath, buffer);
        console.log('✅ I-983 Signature saved:', filename);
        return { success: true, path: `/uploads/forms_signatures/${filename}` };
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
        const publicDir = path.join(process.cwd(), 'public', 'uploads', 'forms_signatures');
        const prefix = `form_i983_${formId}_`;
        let deletedCount = 0;
        let files;
        try {
            files = await fs.readdir(publicDir);
        } catch (readErr) {
            if (readErr.code === 'ENOENT') {
                return { success: true, message: 'Directory not found.' };
            }
            throw readErr;
        }
        for (const file of files) {
            if (file.startsWith(prefix) && file.endsWith('.png')) {
                const filePath = path.join(publicDir, file);
                try {
                    await fs.unlink(filePath);
                    deletedCount++;
                } catch (err) {
                    if (err.code !== 'ENOENT') console.warn('  ⚠️ Could not delete file:', file);
                }
            }
        }
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// --- Public-Facing Server Actions ---

export async function fetchI983FormsByEmpId(empId, orgId) {
    const pool = await DBconnection();
    try {
        const [rows] = await pool.query(
            `SELECT ID, ORG_ID, EMP_ID, FORM_STATUS, UPDATED_AT, CREATED_AT
             FROM C_FORM_I983
             WHERE EMP_ID = ? AND ORG_ID = ? ORDER BY CREATED_AT DESC`,
            [empId, orgId]
        );
        return rows.map(row => ({ ...row, FORM_TYPE: 'I983' }));
    } catch (error) {
        throw new Error('Failed to fetch I-983 forms');
    }
}

export async function getI983FormDetails(formId) {
    const pool = await DBconnection();
    try {
        const numericFormIdStr = String(formId).replace('I983-', '');
        const numericFormId = parseInt(numericFormIdStr);

        if (isNaN(numericFormId) || numericFormId <= 0) throw new Error("Invalid I-983 Form ID format.");

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
        return { ...rows[0], FORM_TYPE: 'I983' };
    } catch (error) {
        throw new Error(`Failed to fetch I-983 form details: ${error.message}`);
    }
}

export async function saveOrUpdateI983Form(payload, formId = null) {
    const pool = await DBconnection();
    let connection;
    
    // Extract signature fields and action from payload
    const {
        action,
        signature_data_sec2,
        signature_data_sec4,
        signature_data_sec6,
        signature_data_eval1_student,
        signature_data_eval1_employer,
        signature_data_eval2_student,
        signature_data_eval2_employer,
        ...formData
    } = payload;

    let currentFormId = formId ? parseInt(String(formId).replace('I983-', '')) : null;
    if (currentFormId && isNaN(currentFormId)) currentFormId = null;

    let isNewRecord = !currentFormId;

    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();

        const cookieStore = cookies();
        const token = cookieStore.get('jwt_token')?.value;
        const userId = decodeJwt(token);
        if (!userId) throw new Error('Authentication failed.');

        if (currentFormId) {
            const [statusRows] = await connection.query('SELECT ID FROM C_FORM_I983 WHERE ID = ? FOR UPDATE', [currentFormId]);
            if (statusRows.length > 0) {
                isNewRecord = false;
            } else {
                currentFormId = null;
                isNewRecord = true;
            }
        }

        const dbData = {};
        const allowedColumns = [
            'ORG_ID', 'EMP_ID', 'FORM_STATUS', 'STUDENT_NAME', 'STUDENT_EMAIL', 'SCHOOL_RECOMMENDING', 'SCHOOL_DEGREE_EARNED', 'SCHOOL_CODE_RECOMMENDING', 'DSO_NAME_CONTACT', 'STUDENT_SEVIS_ID', 'STEM_OPT_START_DATE', 'STEM_OPT_END_DATE', 'QUALIFYING_MAJOR_CIP', 'QUALIFYING_DEGREE_LEVEL', 'QUALIFYING_DEGREE_DATE', 'BASED_ON_PRIOR_DEGREE', 'EMPLOYMENT_AUTH_NUMBER', 'STUDENT_SIGNATURE_URL', 'STUDENT_SIGNATURE_DATE', 'STUDENT_PRINTED_NAME', 'EMPLOYER_NAME', 'EMPLOYER_WEBSITE', 'EMPLOYER_EIN', 'EMPLOYER_STREET_ADDRESS', 'EMPLOYER_SUITE', 'EMPLOYER_CITY', 'EMPLOYER_STATE', 'EMPLOYER_ZIP', 'EMPLOYER_NUM_FT_EMPLOYEES', 'EMPLOYER_NAICS_CODE', 'OPT_HOURS_PER_WEEK', 'START_DATE_OF_EMPLOYMENT', 'SALARY_AMOUNT', 'SALARY_FREQUENCY', 'OTHER_COMPENSATION_1', 'OTHER_COMPENSATION_2', 'OTHER_COMPENSATION_3', 'OTHER_COMPENSATION_4', 'EMPLOYER_OFFICIAL_SIGNATURE_URL', 'EMPLOYER_OFFICIAL_PRINTED_NAME_TITLE', 'EMPLOYER_OFFICIAL_SIGNATURE_DATE', 'EMPLOYER_PRINTED_NAME_ORG', 'EMPLOYER_VERIFIER_ID', 'SEC5_STUDENT_NAME', 'SEC5_EMPLOYER_NAME', 'SEC5_SITE_NAME', 'SEC5_SITE_ADDRESS', 'SEC5_OFFICIAL_NAME', 'SEC5_OFFICIAL_TITLE', 'SEC5_OFFICIAL_EMAIL', 'SEC5_OFFICIAL_PHONE', 'SEC5_STUDENT_ROLE', 'SEC5_GOALS_OBJECTIVES', 'SEC5_EMPLOYER_OVERSIGHT', 'SEC5_MEASURES_ASSESSMENTS', 'SEC5_ADDITIONAL_REMARKS', 'EMPLOYER_OFFICIAL_SEC6_SIGNATURE_URL', 'EMPLOYER_OFFICIAL_SEC6_PRINTED_NAME_TITLE', 'EMPLOYER_OFFICIAL_SEC6_SIGNATURE_DATE', 'EMPLOYER_VERIFIER_ID_SEC6', 'EVAL1_FROM_DATE', 'EVAL1_TO_DATE', 'EVAL1_STUDENT_EVALUATION', 'EVAL1_STUDENT_SIGNATURE_URL', 'EVAL1_STUDENT_SIGNATURE_DATE', 'EVAL1_EMPLOYER_SIGNATURE_URL', 'EVAL1_EMPLOYER_SIGNATURE_DATE', 'EVAL1_EMPLOYER_VERIFIER_ID', 'EVAL2_FROM_DATE', 'EVAL2_TO_DATE', 'EVAL2_STUDENT_EVALUATION', 'EVAL2_STUDENT_SIGNATURE_URL', 'EVAL2_STUDENT_SIGNATURE_DATE', 'EVAL2_EMPLOYER_SIGNATURE_URL', 'EVAL2_EMPLOYER_SIGNATURE_DATE', 'EVAL2_EMPLOYER_VERIFIER_ID', 'CREATED_BY', 'UPDATED_BY'
        ];

        for (const key in formData) {
            const dbKey = key.toUpperCase();
            if (allowedColumns.includes(dbKey)) {
                let value = formData[key];
                if (dbKey.endsWith('_DATE') && value) { dbData[dbKey] = formatDate(value); }
                else if (dbKey === 'BASED_ON_PRIOR_DEGREE') { dbData[dbKey] = value ? 1 : 0; }
                else if (key === 'salary_amount' && (value === '' || value === null || isNaN(parseFloat(value)))) { dbData[dbKey] = null; }
                else if (['employer_num_ft_employees', 'opt_hours_per_week'].includes(key.toLowerCase()) && (value === '' || value === null || isNaN(parseInt(value)))) { dbData[dbKey] = null; }
                else { dbData[dbKey] = (value === '' && !['ID', 'ORG_ID', 'EMP_ID'].includes(dbKey)) ? null : value; }
            }
        }
        
        if (isNewRecord) {
            dbData.FORM_STATUS = 'DRAFT';
        }
        dbData.UPDATED_BY = userId;

        let dbResult;
        let finalFormId = currentFormId;

        if (!isNewRecord) { // UPDATE
            const updateFields = Object.keys(dbData).filter(k => !['ORG_ID', 'EMP_ID', 'CREATED_BY', 'CREATED_AT', 'FORM_STATUS'].includes(k));
            if (updateFields.length > 0) {
                const setClause = updateFields.map(key => `${key} = ?`).join(', ');
                const updateValues = updateFields.map(key => dbData[key]);
                const updateQuery = `UPDATE C_FORM_I983 SET ${setClause}, UPDATED_AT = NOW() WHERE ID = ?`;
                [dbResult] = await connection.query(updateQuery, [...updateValues, finalFormId]);
            }
        } else { // INSERT
            dbData.ORG_ID = formData.orgid; dbData.EMP_ID = formData.emp_id; dbData.CREATED_BY = userId;
            const insertDataFiltered = {}; allowedColumns.forEach(col => { if (dbData.hasOwnProperty(col)) insertDataFiltered[col] = dbData[col]; });
            if (!insertDataFiltered.ORG_ID) insertDataFiltered.ORG_ID = formData.orgid;
            if (!insertDataFiltered.EMP_ID) insertDataFiltered.EMP_ID = formData.emp_id;
            if (!insertDataFiltered.CREATED_BY) insertDataFiltered.CREATED_BY = userId;
            if (!insertDataFiltered.FORM_STATUS) insertDataFiltered.FORM_STATUS = 'DRAFT';

            const insertFields = Object.keys(insertDataFiltered); const placeholders = insertFields.map(() => '?').join(', ');
            const insertValues = insertFields.map(key => insertDataFiltered[key]);
            const insertQuery = `INSERT INTO C_FORM_I983 (${insertFields.join(', ')}, CREATED_AT) VALUES (${placeholders}, NOW())`;
            [dbResult] = await connection.query(insertQuery, insertValues);
            finalFormId = dbResult.insertId;
        }

        if (!finalFormId) { throw new Error("Failed to get a valid Form ID."); }

        // --- Handle Signature Uploads ---
        const signatureMap = {
            signature_data_sec2: { id: 'student_sec2', urlCol: 'STUDENT_SIGNATURE_URL', dateCol: 'STUDENT_SIGNATURE_DATE' },
            signature_data_sec4: { id: 'employer_sec4', urlCol: 'EMPLOYER_OFFICIAL_SIGNATURE_URL', dateCol: 'EMPLOYER_OFFICIAL_SIGNATURE_DATE', verCol: 'EMPLOYER_VERIFIER_ID' },
            signature_data_sec6: { id: 'employer_sec6', urlCol: 'EMPLOYER_OFFICIAL_SEC6_SIGNATURE_URL', dateCol: 'EMPLOYER_OFFICIAL_SEC6_SIGNATURE_DATE', verCol: 'EMPLOYER_VERIFIER_ID_SEC6' },
            signature_data_eval1_student: { id: 'student_eval1', urlCol: 'EVAL1_STUDENT_SIGNATURE_URL', dateCol: 'EVAL1_STUDENT_SIGNATURE_DATE' },
            signature_data_eval1_employer: { id: 'employer_eval1', urlCol: 'EVAL1_EMPLOYER_SIGNATURE_URL', dateCol: 'EVAL1_EMPLOYER_SIGNATURE_DATE', verCol: 'EVAL1_EMPLOYER_VERIFIER_ID' },
            signature_data_eval2_student: { id: 'student_eval2', urlCol: 'EVAL2_STUDENT_SIGNATURE_URL', dateCol: 'EVAL2_STUDENT_SIGNATURE_DATE' },
            signature_data_eval2_employer: { id: 'employer_eval2', urlCol: 'EVAL2_EMPLOYER_SIGNATURE_URL', dateCol: 'EVAL2_EMPLOYER_SIGNATURE_DATE', verCol: 'EVAL2_EMPLOYER_VERIFIER_ID' },
        };

        for (const payloadKey in signatureMap) {
            if (payload[payloadKey]) {
                const config = signatureMap[payloadKey];
                const signatureData = payload[payloadKey];
                const signatureDateValue = dbData[config.dateCol]; 
                
                const signatureResult = await uploadI983Signature(signatureData, finalFormId, config.id);

                if (signatureResult.success) {
                    let updateSigQuery = `UPDATE C_FORM_I983 SET ${config.urlCol} = ?, ${config.dateCol} = ?`;
                    const updateSigValues = [signatureResult.path, signatureDateValue];
                    
                    if (config.verCol) {
                        updateSigQuery += `, ${config.verCol} = ?`;
                        updateSigValues.push(userId);
                    }
                    updateSigQuery += ` WHERE ID = ?`;
                    updateSigValues.push(finalFormId);
                    
                    await connection.query(updateSigQuery, updateSigValues);
                } else {
                    throw new Error(`Sig upload failed for ${config.id}: ${signatureResult?.error}. Rolling back.`);
                }
            }
        }

        await connection.commit();
        return { success: true, id: finalFormId, newStatus: dbData.FORM_STATUS || null, message: 'Form saved successfully!' };

    } catch (error) {
        if (connection) { await connection.rollback(); }
        console.error(`❌ Error during I-983 save:`, error);
        return { success: false, error: `Failed to save I-983 form: ${error.message}` };
    } finally {
        if (connection) { try { await connection.release(); } catch (e) { console.error(e); } }
    }
}

// ✅ NEW: Delete I-983 Form function (was missing)
export async function deleteI983Form(formId) {
    const pool = await DBconnection();
    try {
        const cookieStore = cookies();
        const token = cookieStore.get('jwt_token')?.value;
        const userId = decodeJwt(token);
        if (!userId) throw new Error('Authentication failed.');

        const numericFormId = parseInt(String(formId).replace('I983-', ''));
        if (isNaN(numericFormId) || numericFormId <= 0) throw new Error("Invalid Form ID.");

        // Delete signature files
        await deleteI983Signatures(numericFormId);

        // Delete from DB
        const [result] = await pool.query('DELETE FROM C_FORM_I983 WHERE ID = ?', [numericFormId]);
        
        if (result.affectedRows === 0) {
            return { success: false, error: 'Form not found or already deleted.' };
        }

        return { success: true, message: 'I-983 Form deleted successfully.' };
    } catch (error) {
        console.error("Delete Error:", error);
        return { success: false, error: error.message };
    }
}

export async function generateI983Pdf(formId, userId) {
    const pool = await DBconnection();
    let connection;
    const numericFormId = parseInt(String(formId).replace('I983-', ''));
    if (isNaN(numericFormId) || numericFormId <= 0) return { success: false, error: "Invalid Form ID." };

    try {
        connection = await pool.getConnection();
        const [currentDataRows] = await connection.query('SELECT * FROM C_FORM_I983 WHERE ID = ?', [numericFormId]);
        if (currentDataRows.length === 0) throw new Error(`Form ID ${numericFormId} not found.`);
        const pdfFormData = { ...currentDataRows[0] };
        
        const pdfResult = await generateI983PDF(pdfFormData);
        if (!pdfResult.success) throw new Error(`PDF generation failed: ${pdfResult.error}.`);
        
        const statusName = 'Generated';
        const uploadResult = await uploadI983PDFToDocuments(
            pdfResult.pdfBytes, pdfFormData.EMP_ID, pdfFormData.ORG_ID, numericFormId, userId, statusName
        );
        
        if (uploadResult.success) {
            await connection.query(
                `UPDATE C_FORM_I983 SET FORM_STATUS = ?, UPDATED_BY = ?, UPDATED_AT = NOW() WHERE ID = ?`,
                ['GENERATED', userId, numericFormId]
            );
        }

        return { success: true, message: 'PDF Generated and form status updated successfully.' };

    } catch (error) {
        return { success: false, error: `Failed to generate PDF: ${error.message}` };
    } finally {
        if (connection) { try { await connection.release(); } catch (e) {} }
    }
}

async function generateI983PDF(formData) {
    try {
      const templatePath = path.join(process.cwd(), "public", "templates", "i983.pdf");
      const existingPdfBytes = await fs.readFile(templatePath);
      const pdfDoc = await PDFDocument.load(existingPdfBytes);
      const form = pdfDoc.getForm();
      const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const pages = pdfDoc.getPages();

      // --- Helper Functions ---
      const setSafeText = (fieldName, value) => { 
          try { 
              form.getTextField(fieldName).setText(String(value || '')); 
          } catch { 
              console.warn(`PDF Field Missing: ${fieldName}`) 
          } 
      };
      
      // ✅ UPDATED: Multiline text handling for 500 word support (smaller font)
      const setSafeMultilineText = (fieldName, value, options = {}) => {
          try {
              const { fontSize = 7, lineHeight = 9 } = options; // Smaller font for large text
              const field = form.getTextField(fieldName);
              
              field.enableMultiline();
              field.setFontSize(fontSize);
              
              const text = String(value || '')
                  .replace(/\n\s*\n/g, '\n\n')
                  .replace(/  +/g, ' ')
                  .trim();
              
              field.setText(text);
          } catch (err) {
              console.warn(`PDF Multiline Field Missing: ${fieldName}`);
          }
      };

      const checkSafeRadio = (groupName, dbValue) => {
          try {
              const pdfValue = dbValue === 1 ? 'Yes' : (dbValue === 0 ? 'No' : null);
              if (pdfValue) form.getRadioGroup(groupName).select(pdfValue);
          } catch { console.warn(`PDF Radio Missing: ${groupName}`) }
      };

      const embedSafeSignature = async (page, sigUrl, x, y, w, h) => {
          if (!sigUrl) return;
          try {
              const sigPath = path.join(process.cwd(), "public", sigUrl); 
              await fs.access(sigPath);
              const sigBytes = await fs.readFile(sigPath); 
              const sigImage = await pdfDoc.embedPng(sigBytes);
              // ✅ Updated Dimensions: 200x25 to match W-9 style resizing
              page.drawImage(sigImage, { x, y, width: 200, height: 25 });
          } catch (err) { 
              console.warn(`Sig embed failed: ${sigUrl}`); 
          }
      };

      // ✅ NEW: Draw multiline text at specific coordinates (for evaluation fields)
      // ✅ FIXED: Draw multiline text at specific coordinates (for evaluation fields)
// ✅ FIXED: Draw multiline text at specific coordinates with paragraph support
const drawMultilineText = (page, text, x, y, maxWidth, fontSize = 7, lineHeight = 9) => {
    if (!text) return;
    
    // ✅ Preserve paragraphs: split by double newlines first
    const paragraphs = String(text)
        .replace(/\r\n/g, '\n')     // Normalize Windows newlines
        .replace(/\r/g, '\n')       // Normalize old Mac newlines
        .split(/\n\n+/);            // Split by double newlines (paragraphs)
    
    let currentY = y;
    
    for (let p = 0; p < paragraphs.length; p++) {
        const paragraph = paragraphs[p].trim();
        if (!paragraph) continue;
        
        // Clean single newlines within paragraph (convert to spaces)
        const cleanParagraph = paragraph
            .replace(/\n/g, ' ')    // Convert single newlines to spaces
            .replace(/\s+/g, ' ')   // Collapse multiple spaces
            .trim();
        
        if (!cleanParagraph) continue;
        
        // Word wrap algorithm for this paragraph
        const lines = [];
        const words = cleanParagraph.split(' ');
        let currentLine = '';
        
        for (const word of words) {
            const testLine = currentLine ? `${currentLine} ${word}` : word;
            const testWidth = helveticaFont.widthOfTextAtSize(testLine, fontSize);
            
            if (testWidth > maxWidth && currentLine) {
                lines.push(currentLine);
                currentLine = word;
            } else {
                currentLine = testLine;
            }
        }
        if (currentLine) lines.push(currentLine);
        
        // Draw each line of this paragraph
        for (const line of lines) {
            page.drawText(line, {
                x,
                y: currentY,
                size: fontSize,
                font: helveticaFont,
                color: rgb(0, 0, 0),
            });
            currentY -= lineHeight;
        }
        
        // Add extra space between paragraphs (skip one line)
        if (p < paragraphs.length - 1) {
            currentY -= lineHeight * 1.5; // Extra spacing between paragraphs
        }
    }
};

      const multilineOptions = { fontSize: 7, lineHeight: 9 }; // Small font specifically for 500 words

      // --- Section 1 ---
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
      
      // --- Section 2 ---
      setSafeText('Printed Name of Student', formData.STUDENT_PRINTED_NAME);
      setSafeText('Date mmddyyyy', formatPdfDate(formData.STUDENT_SIGNATURE_DATE));
      await embedSafeSignature(pages[0], formData.STUDENT_SIGNATURE_URL, 130, 195, 200, 25);
      
      // --- Section 3 & 4 ---
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
      setSafeText('1 1', formData.OTHER_COMPENSATION_1); 
      setSafeText('1 2', formData.OTHER_COMPENSATION_2);
      setSafeText('3', formData.OTHER_COMPENSATION_3); 
      setSafeText('4', formData.OTHER_COMPENSATION_4);
      
      setSafeText('Printed Name and Title of Employer Official with Signatory Authority', formData.EMPLOYER_OFFICIAL_PRINTED_NAME_TITLE);
      setSafeText('Printed Name of Employing Organization', formData.EMPLOYER_PRINTED_NAME_ORG);
      setSafeText('Date mmddyyyy_2', formatPdfDate(formData.EMPLOYER_OFFICIAL_SIGNATURE_DATE));
      await embedSafeSignature(pages[1], formData.EMPLOYER_OFFICIAL_SIGNATURE_URL, 300, 115, 200, 25);
      
      // --- Section 5 ---
      setSafeText('Student Name SurnamePrimary Name Given Name_2', formData.SEC5_STUDENT_NAME);
      setSafeText('Employer Name_2', formData.SEC5_EMPLOYER_NAME);
      setSafeText('Site Name', formData.SEC5_SITE_NAME);
      setSafeText('Site Address Street City State ZIP', formData.SEC5_SITE_ADDRESS);
      setSafeText('Name of Official', formData.SEC5_OFFICIAL_NAME);
      setSafeText('Official s Title', formData.SEC5_OFFICIAL_TITLE);
      setSafeText('Official s Email', formData.SEC5_OFFICIAL_EMAIL);
      setSafeText('Official s Phone Number', formData.SEC5_OFFICIAL_PHONE);
      
      // ✅ UPDATED: Using multiline support for 500 word fields with 7pt font
      setSafeMultilineText(
          'Student Role Describe the students role with the employer and how that role is directly related to enhancing the student s knowledge obtained through his or her qualifying STEM degree', 
          formData.SEC5_STUDENT_ROLE, 
          multilineOptions
      );
      setSafeMultilineText(
          'Goals and Objectives Describe how the assignments with the employer will help the student achieve his or her specific objectives for workbased learning related to his or her STEM degree The description must both specify the students goals regarding specific knowledge skills or techniques as well as the means by which they will be achieved', 
          formData.SEC5_GOALS_OBJECTIVES, 
          multilineOptions
      );
      setSafeMultilineText(
          'Employer Oversight Explain how the employer provides oversight and supervision of individuals filling positions such as that being filled by the named F1 student If the employer has a training program or related policy in place that controls such oversight and supervision please describe', 
          formData.SEC5_EMPLOYER_OVERSIGHT, 
          multilineOptions
      );
      setSafeMultilineText(
          'Measures and Assessments Explain how the employer measures and confirms whether individuals filling positions such as that being filled by the named F1 student are acquiring new knowledge and skills If the employer has a training program or related policy in place that controls such measures and assessments please describe', 
          formData.SEC5_MEASURES_ASSESSMENTS, 
          multilineOptions
      );
      setSafeMultilineText(
          'Additional Remarks optional Provide additional information pertinent to the Plan', 
          formData.SEC5_ADDITIONAL_REMARKS, 
          multilineOptions
      );

      // --- Section 6 ---
      setSafeText('Printed Name and Title of Employer Official with Signatory Authority_2', formData.EMPLOYER_OFFICIAL_SEC6_PRINTED_NAME_TITLE);
      setSafeText('Date mmddyyyy_3', formatPdfDate(formData.EMPLOYER_OFFICIAL_SEC6_SIGNATURE_DATE));
      await embedSafeSignature(pages[3], formData.EMPLOYER_OFFICIAL_SEC6_SIGNATURE_URL, 260, 460, 200, 25);

      // --- Evaluations ---
      // Evaluation 1 - Date fields
      setSafeText('undefined_3', formatPdfDate(formData.EVAL1_FROM_DATE));
      setSafeText('undefined_4', formatPdfDate(formData.EVAL1_TO_DATE));
      
      // ✅ FIXED: Draw Eval 1 text manually between dates and signatures
      drawMultilineText(
          pages[4], 
          formData.EVAL1_STUDENT_EVALUATION, 
          38,    // x coordinate (left margin)
          670,   // y coordinate (below the dates, above signatures)
          550,   // max width
          7,     // font size
          9      // line height
      );

      // Evaluation 1 - Student signature
      setSafeText('Printed Name of Student_2', formData.STUDENT_PRINTED_NAME);
      setSafeText('Date mmddyyyy_4', formatPdfDate(formData.EVAL1_STUDENT_SIGNATURE_DATE));
      await embedSafeSignature(pages[4], formData.EVAL1_STUDENT_SIGNATURE_URL, 150, 480, 200, 25);

      // Evaluation 1 - Employer signature
      setSafeText('Printed Name of Employer Official with Signatory Authority', formData.EMPLOYER_OFFICIAL_PRINTED_NAME_TITLE);
      setSafeText('Date mmddyyyy_5', formatPdfDate(formData.EVAL1_EMPLOYER_SIGNATURE_DATE));
      await embedSafeSignature(pages[4], formData.EVAL1_EMPLOYER_SIGNATURE_URL, 300, 430, 200, 25);

      // Evaluation 2 - Date fields
      setSafeText('undefined_5', formatPdfDate(formData.EVAL2_FROM_DATE));
      setSafeText('undefined_6', formatPdfDate(formData.EVAL2_TO_DATE));

      // ✅ FIXED: Draw Eval 2 text manually between dates and signatures
      drawMultilineText(
          pages[4], 
          formData.EVAL2_STUDENT_EVALUATION, 
          38,    // x coordinate (left margin)
          320,   // y coordinate (below the dates, above signatures)
          550,   // max width
          7,     // font size
          9      // line height
      );

      // Evaluation 2 - Student signature
      setSafeText('Printed Name of Student_3', formData.STUDENT_PRINTED_NAME);
      setSafeText('Date mmddyyyy_6', formatPdfDate(formData.EVAL2_STUDENT_SIGNATURE_DATE));
      await embedSafeSignature(pages[4], formData.EVAL2_STUDENT_SIGNATURE_URL, 120, 140, 200, 25);

      // Evaluation 2 - Employer signature
      setSafeText('ty', formData.EMPLOYER_OFFICIAL_PRINTED_NAME_TITLE);
      setSafeText('Date mmddyyyy_7', formatPdfDate(formData.EVAL2_EMPLOYER_SIGNATURE_DATE));
      await embedSafeSignature(pages[4], formData.EVAL2_EMPLOYER_SIGNATURE_URL, 370, 95, 200, 25);

      try {
          form.flatten();
      } catch (flattenError) {
          console.error(`Flattening skipped due to error: ${flattenError.message}`);
      }
      
      const finalBytes = await pdfDoc.save();
      return { success: true, pdfBytes: finalBytes };
      
    } catch (error) {
      console.error("PDF Gen Error:", error);
      return { success: false, error: `I-983 PDF Generation Failed: ${error.message}` };
    }
}

async function uploadI983PDFToDocuments(pdfBytes, empId, orgId, formId, userId, statusName) {
    try {
        const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'documents');
        await fs.mkdir(uploadDir, { recursive: true });
        
        const cleanStatusName = statusName.replace(/[^a-z0-9]/gi, '_');
        const filename = `I983_Form_${cleanStatusName}_${empId}_${formId}_${Date.now()}.pdf`;
        const filePath = path.join(uploadDir, filename);
        await fs.writeFile(filePath, pdfBytes);
        
        const documentPath = `/uploads/documents/${filename}`;
        const pool = await DBconnection();
        const subtype = 4; // I-983 Subtype

        const [existingDocs] = await pool.query(
            `SELECT id FROM C_EMP_DOCUMENTS WHERE empid = ? AND orgid = ? AND subtype = ? AND comments LIKE ? ORDER BY created_date DESC LIMIT 1`,
             [empId, orgId, subtype, `%Form ID: ${formId}%`]
        );

        const docName = `I-983 Form (${statusName} ${new Date().toLocaleDateString()})`;
        const comments = `Generated I-983 Form PDF (Status: ${statusName}). Form ID: ${formId}`;
        const document_type = 3;
        const document_purpose = 5;

        if (existingDocs.length > 0) {
            await pool.query(
                `UPDATE C_EMP_DOCUMENTS SET
                 document_name = ?, document_path = ?, comments = ?,
                 updated_by = ?, last_updated_date = NOW()
                 WHERE id = ?`,
                [docName, documentPath, comments, userId, existingDocs[0].id]
            );
        } else {
            await pool.query(
                `INSERT INTO C_EMP_DOCUMENTS (
                    empid, orgid, document_name, document_type, subtype,
                    document_path, document_purpose, comments, startdate,
                    created_by, updated_by, created_date, last_updated_date
                 ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, ?, NOW(), NOW())`,
                [empId, orgId, docName, document_type, subtype, documentPath, document_purpose, comments, userId, userId]
            );
        }
        return { success: true, path: documentPath };
    } catch (error) {
        return { success: false, error: `Failed to upload/update PDF (${statusName}): ${error.message}` };
    }
}
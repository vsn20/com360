// serverActions/Employee/documentverification.js
'use server';

import DBconnection from '@/app/utils/config/db';
import { cookies } from 'next/headers';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'; // KEEP THIS

const safeValue = (value, defaultValue = '') => {
  return value ?? defaultValue;
};

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

const generateSignatureHash = (base64Data) => {
  return crypto.createHash('sha256').update(base64Data).digest('hex');
};

// Upload employer signature
async function uploadEmployerSignature(base64Data, formId) {
  try {
    const base64Image = base64Data.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Image, 'base64');
    
    if (buffer.length > 5 * 1024 * 1024) {
      throw new Error('Signature file too large (max 5MB)');
    }
    
    const publicDir = path.join(process.cwd(), 'public', 'signatures');
    await fs.mkdir(publicDir, { recursive: true });
    
    const filename = `form_${formId}_employer.png`;
    const filePath = path.join(publicDir, filename);
    
    await fs.writeFile(filePath, buffer);
    
    const hash = generateSignatureHash(base64Image);
    
    return { 
      success: true, 
      path: `/signatures/${filename}`,
      hash: hash
    };
  } catch (error) {
    console.error('Error uploading employer signature:', error);
    return { success: false, error: error.message };
  }
}

// Generate I-9 PDF with filled data
// Replace ONLY the generateI9PDF function in documentverification.js
// DO NOT add new imports - use existing ones at top of file

async function generateI9PDF(formData, employeeData, verifierData, orgData) {
  try {
    console.log('📄 Starting PDF generation...');
    
    // Read the template PDF
    const templatePath = path.join(process.cwd(), 'public', 'templates', '1760217680073_i-9.pdf');
    const existingPdfBytes = await fs.readFile(templatePath);
    
    // Load PDF
    const pdfDoc = await PDFDocument.load(existingPdfBytes);
    const form = pdfDoc.getForm();
    
    console.log(`✅ PDF loaded with ${form.getFields().length} form fields`);
    
    // Helper function to safely set text field
    const safeSetField = (form, fieldName, value) => {
      if (!value) return;
      try {
        const field = form.getTextField(fieldName);
        field.setText(String(value));
        console.log(`  ✓ ${fieldName}: ${String(value).substring(0, 50)}`);
      } catch (err) {
        console.warn(`  ⚠️  Field not found: ${fieldName}`);
      }
    };
    
    // Helper function to safely set dropdown
    const safeSetDropdown = (form, fieldName, value) => {
      if (!value) return;
      try {
        const field = form.getDropdown(fieldName);
        field.select(String(value));
        console.log(`  ✓ ${fieldName}: ${value}`);
      } catch (err) {
        try {
          const textField = form.getTextField(fieldName);
          textField.setText(String(value));
          console.log(`  ✓ ${fieldName} (as text): ${value}`);
        } catch (err2) {
          console.warn(`  ⚠️  Dropdown not found: ${fieldName}`);
        }
      }
    };
    
    // Helper function to safely check checkbox
    const safeCheckBox = (form, fieldName) => {
      try {
        const field = form.getCheckBox(fieldName);
        field.check();
        console.log(`  ✓ Checked: ${fieldName}`);
      } catch (err) {
        console.warn(`  ⚠️  Checkbox not found: ${fieldName}`);
      }
    };
    
    // ============= SECTION 1: EMPLOYEE INFORMATION =============
    console.log('\n📝 Filling Section 1: Employee Information...');
    
    // Name fields
    safeSetField(form, 'Last Name (Family Name)', employeeData.EMPLOYEE_LAST_NAME);
    safeSetField(form, 'First Name Given Name', employeeData.EMPLOYEE_FIRST_NAME);
    safeSetField(form, 'Employee Middle Initial (if any)', employeeData.EMPLOYEE_MIDDLE_INITIAL);
    safeSetField(form, 'Employee Other Last Names Used (if any)', employeeData.EMPLOYEE_OTHER_LAST_NAMES);
    
    // Address fields
    safeSetField(form, 'Address Street Number and Name', employeeData.EMPLOYEE_STREET_ADDRESS);
    safeSetField(form, 'Apt Number (if any)', employeeData.EMPLOYEE_APT_NUMBER);
    safeSetField(form, 'City or Town', employeeData.EMPLOYEE_CITY);
    safeSetDropdown(form, 'State', employeeData.EMPLOYEE_STATE);
    safeSetField(form, 'ZIP Code', employeeData.EMPLOYEE_ZIP_CODE);
    
    // Date of Birth
    if (employeeData.EMPLOYEE_DOB) {
      const dob = new Date(employeeData.EMPLOYEE_DOB);
      const dobStr = `${String(dob.getMonth() + 1).padStart(2, '0')}/${String(dob.getDate()).padStart(2, '0')}/${dob.getFullYear()}`;
      safeSetField(form, 'Date of Birth mmddyyyy', dobStr);
    }
    
    // SSN, Email, Phone
    safeSetField(form, 'US Social Security Number', employeeData.EMPLOYEE_SSN);
    safeSetField(form, 'Employees E-mail Address', employeeData.EMPLOYEE_EMAIL);
    safeSetField(form, 'Telephone Number', employeeData.EMPLOYEE_PHONE);
    
    // Citizenship status checkboxes (CB_1, CB_2, CB_3, CB_4)
    if (employeeData.CITIZENSHIP_STATUS) {
      switch(employeeData.CITIZENSHIP_STATUS) {
        case 1:
          safeCheckBox(form, 'CB_1'); // A citizen of the United States
          break;
        case 2:
          safeCheckBox(form, 'CB_2'); // A noncitizen national of the United States
          break;
        case 3:
          safeCheckBox(form, 'CB_3'); // A lawful permanent resident
          safeSetField(form, '3 A lawful permanent resident Enter USCIS or ANumber', employeeData.USCIS_A_NUMBER);
          break;
        case 4:
          safeCheckBox(form, 'CB_4'); // An alien authorized to work
          if (employeeData.WORK_AUTHORIZATION_EXPIRY) {
            const expiry = new Date(employeeData.WORK_AUTHORIZATION_EXPIRY);
            const expiryStr = `${String(expiry.getMonth() + 1).padStart(2, '0')}/${String(expiry.getDate()).padStart(2, '0')}/${expiry.getFullYear()}`;
            safeSetField(form, 'Exp Date mmddyyyy', expiryStr);
          }
          safeSetField(form, 'USCIS ANumber', employeeData.USCIS_A_NUMBER);
          safeSetField(form, 'Form I94 Admission Number', employeeData.I94_ADMISSION_NUMBER);
          
          // Foreign Passport Number and Country
          if (employeeData.FOREIGN_PASSPORT_NUMBER && employeeData.COUNTRY_OF_ISSUANCE) {
            safeSetField(form, 'Foreign Passport Number and Country of IssuanceRow1', 
              `${employeeData.FOREIGN_PASSPORT_NUMBER} / ${employeeData.COUNTRY_OF_ISSUANCE}`);
          }
          break;
      }
    }
    
    // Employee signature date
    if (employeeData.EMPLOYEE_SIGNATURE_DATE) {
      const sigDate = new Date(employeeData.EMPLOYEE_SIGNATURE_DATE);
      const sigDateStr = `${String(sigDate.getMonth() + 1).padStart(2, '0')}/${String(sigDate.getDate()).padStart(2, '0')}/${sigDate.getFullYear()}`;
      safeSetField(form, "Today's Date mmddyyy", sigDateStr);
    }
    
    // ============= SECTION 2: EMPLOYER REVIEW AND VERIFICATION =============
    console.log('\n👔 Filling Section 2: Employer Verification...');
    
    // First day of employment
    if (formData.employer_first_day) {
      const firstDay = new Date(formData.employer_first_day);
      const firstDayStr = `${String(firstDay.getMonth() + 1).padStart(2, '0')}/${String(firstDay.getDate()).padStart(2, '0')}/${firstDay.getFullYear()}`;
      safeSetField(form, 'FirstDayEmployed mmddyyyy', firstDayStr);
    }
    
    // Document verification based on List A or List B & C
    if (formData.employer_list_type === 'LIST_A') {
      // List A documents (identity + employment authorization combined)
      console.log('  📋 Filling List A documents...');
      
      // Document 1
      safeSetField(form, 'Document Title 1', formData.doc1_title);
      safeSetField(form, 'Issuing Authority 1', formData.doc1_issuing_authority);
      safeSetField(form, 'Document Number 0 (if any)', formData.doc1_number);
      
      if (formData.doc1_expiry) {
        const doc1Exp = new Date(formData.doc1_expiry);
        const doc1ExpStr = `${String(doc1Exp.getMonth() + 1).padStart(2, '0')}/${String(doc1Exp.getDate()).padStart(2, '0')}/${doc1Exp.getFullYear()}`;
        safeSetField(form, 'Expiration Date if any', doc1ExpStr);
      }
      
      // Document 2 (optional)
      if (formData.doc2_title) {
        safeSetField(form, 'Document Title 2 If any', formData.doc2_title);
        safeSetField(form, 'Issuing Authority_2', formData.doc2_issuing_authority);
        safeSetField(form, 'Document Number If any_2', formData.doc2_number);
        
        if (formData.doc2_expiry) {
          const doc2Exp = new Date(formData.doc2_expiry);
          const doc2ExpStr = `${String(doc2Exp.getMonth() + 1).padStart(2, '0')}/${String(doc2Exp.getDate()).padStart(2, '0')}/${doc2Exp.getFullYear()}`;
          safeSetField(form, 'List A.  Document 2. Expiration Date (if any)', doc2ExpStr);
        }
      }
      
      // Document 3 (optional)
      if (formData.doc3_title) {
        safeSetField(form, 'List A.   Document Title 3.  If any', formData.doc3_title);
        safeSetField(form, 'List A. Document 3.  Enter Issuing Authority', formData.doc3_issuing_authority);
        safeSetField(form, 'List A.  Document 3 Number.  If any', formData.doc3_number);
        
        if (formData.doc3_expiry) {
          const doc3Exp = new Date(formData.doc3_expiry);
          const doc3ExpStr = `${String(doc3Exp.getMonth() + 1).padStart(2, '0')}/${String(doc3Exp.getDate()).padStart(2, '0')}/${doc3Exp.getFullYear()}`;
          safeSetField(form, 'Document Number if any_3', doc3ExpStr);
        }
      }
      
    } else {
      // List B & C documents (identity separate from employment authorization)
      console.log('  📋 Filling List B & C documents...');
      
      // List B (Identity) - Document 1
      safeSetField(form, 'List B Document 1 Title', formData.doc1_title);
      safeSetField(form, 'List B Issuing Authority 1', formData.doc1_issuing_authority);
      safeSetField(form, 'List B Document Number 1', formData.doc1_number);
      
      if (formData.doc1_expiry) {
        const doc1Exp = new Date(formData.doc1_expiry);
        const doc1ExpStr = `${String(doc1Exp.getMonth() + 1).padStart(2, '0')}/${String(doc1Exp.getDate()).padStart(2, '0')}/${doc1Exp.getFullYear()}`;
        safeSetField(form, 'List B Expiration Date 1', doc1ExpStr);
      }
      
      // List C (Employment Authorization) - Document 2
      safeSetField(form, 'List C Document Title 1', formData.doc2_title);
      safeSetField(form, 'List C Issuing Authority 1', formData.doc2_issuing_authority);
      safeSetField(form, 'List C Document Number 1', formData.doc2_number);
      
      if (formData.doc2_expiry) {
        const doc2Exp = new Date(formData.doc2_expiry);
        const doc2ExpStr = `${String(doc2Exp.getMonth() + 1).padStart(2, '0')}/${String(doc2Exp.getDate()).padStart(2, '0')}/${doc2Exp.getFullYear()}`;
        safeSetField(form, 'List C Expiration Date 1', doc2ExpStr);
      }
    }
    
    // Additional Information
    if (formData.additional_info) {
      safeSetField(form, 'Additional Information', formData.additional_info.substring(0, 500));
    }
    
    // Alternative procedure checkbox
    if (formData.alternative_procedure_used) {
      safeCheckBox(form, 'CB_Alt');
    }
    
    // ============= CERTIFICATION SECTION =============
    console.log('\n✍️  Filling Certification...');
    
    // Employer/Verifier name and title
    safeSetField(form, 'Last Name First Name and Title of Employer or Authorized Representative', 
      formData.employer_name);
    
    // Signature date
    if (formData.employer_signature_date) {
      const empSigDate = new Date(formData.employer_signature_date);
      const empSigDateStr = `${String(empSigDate.getMonth() + 1).padStart(2, '0')}/${String(empSigDate.getDate()).padStart(2, '0')}/${empSigDate.getFullYear()}`;
      safeSetField(form, 'S2 Todays Date mmddyyyy', empSigDateStr);
    }
    
    // Business information
    safeSetField(form, 'Employers Business or Org Name', 
      formData.employer_business_name || orgData.orgname || '');
    safeSetField(form, 'Employers Business or Org Address', formData.employer_address || '');
    
    // ============= EMBED SIGNATURES AS IMAGES =============
    console.log('\n🖊️  Embedding signatures...');
    
    const pages = pdfDoc.getPages();
    const firstPage = pages[0];
    const { height } = firstPage.getSize();
    
    // Employee signature (Section 1)
    if (employeeData.EMPLOYEE_SIGNATURE_URL) {
      try {
        const empSigPath = path.join(process.cwd(), 'public', employeeData.EMPLOYEE_SIGNATURE_URL);
        const empSigBytes = await fs.readFile(empSigPath);
        const empSigImage = await pdfDoc.embedPng(empSigBytes);
        
        // Position for Section 1 signature field
        firstPage.drawImage(empSigImage, {
          x: 95,
          y: height - 380,
          width: 180,
          height: 40,
        });
        console.log('  ✅ Employee signature embedded');
      } catch (err) {
        console.warn('  ⚠️  Could not embed employee signature:', err.message);
      }
    }
    
    // Employer/Verifier signature (Section 2)
    if (formData.employer_signature_url) {
      try {
        const verSigPath = path.join(process.cwd(), 'public', formData.employer_signature_url);
        const verSigBytes = await fs.readFile(verSigPath);
        const verSigImage = await pdfDoc.embedPng(verSigBytes);
        
        // Position for Section 2 signature field
        firstPage.drawImage(verSigImage, {
          x: 330,
          y: height - 725,
          width: 180,
          height: 40,
        });
        console.log('  ✅ Employer signature embedded');
      } catch (err) {
        console.error('  ❌ Could not embed employer signature:', err.message);
      }
    }
    
    // Flatten the form to make it non-editable
    console.log('\n🔒 Flattening form...');
    form.flatten();
    
    // Save PDF
    const pdfBytes = await pdfDoc.save();
    
    console.log('✅ PDF generated successfully!\n');
    
    return { success: true, pdfBytes };
  } catch (error) {
    console.error('❌ Error generating I-9 PDF:', error);
    console.error('Stack trace:', error.stack);
    return { success: false, error: error.message };
  }
}
// Upload PDF to documents
async function uploadPDFToDocuments(pdfBytes, empId, orgId, formId, userId) {
  try {
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'documents');
    await fs.mkdir(uploadDir, { recursive: true });
    
    const timestamp = Date.now();
    const filename = `I9_Form_${empId}_${formId}_${timestamp}.pdf`;
    const filePath = path.join(uploadDir, filename);
    
    await fs.writeFile(filePath, pdfBytes);
    
    const documentPath = `/uploads/documents/${filename}`;
    
    // Insert into C_EMP_DOCUMENTS
    const pool = await DBconnection();
    const [result] = await pool.query(
      `INSERT INTO C_EMP_DOCUMENTS 
       (empid, orgid, document_name, document_type, subtype, document_path, document_purpose, 
        comments, startdate, enddate, created_by, updated_by, created_date, last_updated_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NULL, ?, ?, NOW(), NOW())`,
      [
        empId, 
        orgId, 
        `I-9 Form (Verified ${new Date().toLocaleDateString()})`,
        1, // document_type
        4, // subtype
        documentPath,
        5, // document_purpose
        `Automatically uploaded after form verification. Form ID: ${formId}`,
        userId,
        userId
      ]
    );
    
    return { success: true, documentId: result.insertId, path: documentPath };
  } catch (error) {
    console.error('Error uploading PDF to documents:', error);
    return { success: false, error: error.message };
  }
}

// Get employee forms
export async function getEmployeeForms(empId, orgId) {
  try {
    const pool = await DBconnection();
    
    const [forms] = await pool.query(
      `SELECT f.*, 
              v.EMP_FST_NAME as VERIFIER_FIRST_NAME, 
              v.EMP_LAST_NAME as VERIFIER_LAST_NAME
       FROM C_FORMS f
       LEFT JOIN C_EMP v ON f.VERIFIER_ID = v.empid AND f.ORG_ID = v.orgid
       WHERE f.EMP_ID = ? AND f.ORG_ID = ?
       ORDER BY f.CREATED_AT DESC`,
      [empId, orgId]
    );
    
    return forms;
  } catch (error) {
    console.error('Error fetching employee forms:', error);
    throw new Error('Failed to fetch employee forms');
  }
}

// Get pending approvals
export async function getPendingApprovals(orgId, currentEmpId, isAdmin, hasAllData, subordinateIds) {
  try {
    const pool = await DBconnection();
    
    let query = `
      SELECT f.*, 
             e.EMP_FST_NAME as EMPLOYEE_FIRST_NAME,
             e.EMP_LAST_NAME as EMPLOYEE_LAST_NAME,
             v.EMP_FST_NAME as VERIFIER_FIRST_NAME,
             v.EMP_LAST_NAME as VERIFIER_LAST_NAME
      FROM C_FORMS f
      INNER JOIN C_EMP e ON f.EMP_ID = e.empid AND f.ORG_ID = e.orgid
      LEFT JOIN C_EMP v ON f.VERIFIER_ID = v.empid AND f.ORG_ID = v.orgid
      WHERE f.ORG_ID = ? AND f.FORM_STATUS = 'EMPLOYEE_SUBMITTED'
    `;
    
    const params = [orgId];
    
    if (isAdmin) {
      // Admin: see ALL pending forms in organization (including their own)
      // No additional filter needed
    } else if (hasAllData) {
      // Non-admin with all data: see ALL pending forms EXCEPT their own
      query += ` AND f.EMP_ID != ?`;
      params.push(currentEmpId);
    } else {
      // Team data: see forms of subordinates only
      if (subordinateIds && subordinateIds.length > 0) {
        query += ` AND f.EMP_ID IN (?)`;
        params.push(subordinateIds);
      } else {
        // No subordinates, return empty
        return [];
      }
    }
    
    query += ` ORDER BY f.CREATED_AT DESC`;
    
    const [forms] = await pool.query(query, params);
    
    return forms;
  } catch (error) {
    console.error('Error fetching pending approvals:', error);
    throw new Error('Failed to fetch pending approvals');
  }
}

// Get form details
export async function getFormDetails(formId) {
  try {
    const pool = await DBconnection();
    
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
      [formId]
    );
    
    if (forms.length === 0) {
      throw new Error('Form not found');
    }
    
    return forms[0];
  } catch (error) {
    console.error('Error fetching form details:', error);
    throw new Error('Failed to fetch form details');
  }
}

// Verify form
export async function verifyForm(formData) {
  const pool = await DBconnection();
  
  try {
    const cookieStore = cookies();
    const token = cookieStore.get('jwt_token')?.value;
    
    if (!token) {
      throw new Error('No token found. Please log in.');
    }
    
    const decoded = decodeJwt(token);
    if (!decoded || !decoded.userId) {
      throw new Error('Invalid token');
    }
    
    const userId = decoded.userId;
    
    const {
      form_id,
      emp_id,
      org_id,
      verifier_id,
      employer_first_day,
      employer_list_type,
      doc1_title,
      doc1_issuing_authority,
      doc1_number,
      doc1_expiry,
      doc2_title,
      doc2_issuing_authority,
      doc2_number,
      doc2_expiry,
      doc3_title,
      doc3_issuing_authority,
      doc3_number,
      doc3_expiry,
      employer_signature_date,
      employer_name,
      employer_title,
      employer_business_name,
      employer_address,
      alternative_procedure_used,
      additional_info,
      signature_data
    } = formData;

    // Format dates
    const formatDate = (date) => {
      if (!date || isNaN(new Date(date))) return null;
      const d = new Date(date);
      const year = d.getUTCFullYear();
      const month = String(d.getUTCMonth() + 1).padStart(2, '0');
      const day = String(d.getUTCDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    const formattedFirstDay = formatDate(employer_first_day);
    const formattedSignatureDate = formatDate(employer_signature_date);
    const formattedDoc1Expiry = formatDate(doc1_expiry);
    const formattedDoc2Expiry = formatDate(doc2_expiry);
    const formattedDoc3Expiry = formatDate(doc3_expiry);

    // Upload employer signature
    const sigUploadResult = await uploadEmployerSignature(signature_data, form_id);
    
    if (!sigUploadResult.success) {
      throw new Error('Failed to upload signature: ' + sigUploadResult.error);
    }

    // Get verifier details
    const [verifierRows] = await pool.query(
      'SELECT EMP_FST_NAME, EMP_LAST_NAME, JOB_TITLE FROM C_EMP WHERE empid = ? AND orgid = ?',
      [verifier_id, org_id]
    );
    
    if (verifierRows.length === 0) {
      throw new Error('Verifier not found');
    }
    
    const verifier = verifierRows[0];

    // Update form with Section 2 data
    const updateQuery = `
      UPDATE C_FORMS 
      SET VERIFIER_ID = ?,
          VERIFIER_SIGNATURE_URL = ?,
          VERIFIER_SIGNATURE_DATE = ?,
          EMPLOYER_VERIFIED_UPLOADED_FLAG = 1,
          FORM_STATUS = 'EMPLOYER_VERIFIED',
          EMPLOYER_FIRST_DAY = ?,
          EMPLOYER_LIST_TYPE = ?,
          DOC1_TITLE = ?,
          DOC1_ISSUING_AUTHORITY = ?,
          DOC1_NUMBER = ?,
          DOC1_EXPIRY = ?,
          DOC2_TITLE = ?,
          DOC2_ISSUING_AUTHORITY = ?,
          DOC2_NUMBER = ?,
          DOC2_EXPIRY = ?,
          DOC3_TITLE = ?,
          DOC3_ISSUING_AUTHORITY = ?,
          DOC3_NUMBER = ?,
          DOC3_EXPIRY = ?,
          EMPLOYER_SIGNATURE_DATE = ?,
          EMPLOYER_NAME = ?,
          EMPLOYER_TITLE = ?,
          EMPLOYER_BUSINESS_NAME = ?,
          EMPLOYER_ADDRESS = ?,
          ALTERNATIVE_PROCEDURE_USED = ?,
          ADDITIONAL_INFO = ?,
          UPDATED_AT = NOW(),
          UPDATED_BY = ?
      WHERE ID = ?
    `;

    const updateValues = [
      verifier_id,
      sigUploadResult.path,
      formattedSignatureDate,
      formattedFirstDay,
      employer_list_type,
      doc1_title,
      doc1_issuing_authority,
      doc1_number,
      formattedDoc1Expiry,
      doc2_title,
      doc2_issuing_authority,
      doc2_number,
      formattedDoc2Expiry,
      doc3_title,
      doc3_issuing_authority,
      doc3_number,
      formattedDoc3Expiry,
      formattedSignatureDate,
      employer_name,
      employer_title,
      employer_business_name,
      employer_address,
      alternative_procedure_used ? 1 : 0,
      additional_info,
      userId,
      form_id
    ];

    await pool.query(updateQuery, updateValues);

    // Get complete form data for PDF generation
    const [formRows] = await pool.query('SELECT * FROM C_FORMS WHERE ID = ?', [form_id]);
    const completeFormData = formRows[0];

    // Get org data
    const [orgRows] = await pool.query('SELECT orgname FROM C_ORG WHERE orgid = ?', [org_id]);
    const orgData = orgRows.length > 0 ? orgRows[0] : { NAME: employer_business_name };

    // Generate PDF
    const pdfResult = await generateI9PDF(
      {
        ...formData,
        employer_signature_url: sigUploadResult.path
      },
      completeFormData,
      verifier,
      orgData
    );

    if (!pdfResult.success) {
      console.error('PDF generation failed:', pdfResult.error);
      throw new Error('Failed to generate PDF: ' + pdfResult.error);
    }

    // Upload PDF to documents
    const uploadResult = await uploadPDFToDocuments(
      pdfResult.pdfBytes,
      emp_id,
      org_id,
      form_id,
      userId
    );

    if (!uploadResult.success) {
      console.error('Document upload failed:', uploadResult.error);
      throw new Error('Failed to upload document: ' + uploadResult.error);
    }

    console.log('✅ Form verified and document uploaded successfully');
    
    return { success: true, documentId: uploadResult.documentId };
  } catch (error) {
    console.error('❌ Error verifying form:', error);
    throw new Error(error.message || 'Failed to verify form');
  }
}
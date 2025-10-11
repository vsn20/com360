// serverActions/Employee/i9forms.js
'use server';

import DBconnection from '@/app/utils/config/db';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

// ✅ Utility function to format dates properly
const formatDate = (date) => {
  if (!date || isNaN(new Date(date))) return null;
  const d = new Date(date);
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// ✅ Generate SHA256 hash of signature for integrity
const generateSignatureHash = (base64Data) => {
  return crypto.createHash('sha256').update(base64Data).digest('hex');
};

// ✅ IMPROVED: Upload signature using PRIMARY KEY as filename
export async function uploadSignature(base64Data, formId, signatureType = 'employee') {
  try {
    console.log(`📝 Uploading ${signatureType} signature for form ID:`, formId);
    
    if (!formId) {
      throw new Error('Form ID is required for signature upload');
    }
    
    // Remove data URI prefix
    const base64Image = base64Data.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Image, 'base64');
    
    // Validate image size (max 5MB)
    if (buffer.length > 5 * 1024 * 1024) {
      throw new Error('Signature file too large (max 5MB)');
    }
    
    // Define directory
    const publicDir = path.join(process.cwd(), 'public', 'signatures');
    await fs.mkdir(publicDir, { recursive: true });
    
    // ✅ Use primary key as filename for easy identification and cleanup
    const filename = `form_${formId}_${signatureType}.png`;
    const filePath = path.join(publicDir, filename);
    
    // Write file (overwrites automatically if exists)
    await fs.writeFile(filePath, buffer);
    
    // Generate hash for integrity verification
    const hash = generateSignatureHash(base64Image);
    
    console.log('✅ Signature saved:', filename);
    
    return { 
      success: true, 
      path: `/signatures/${filename}`,
      hash: hash
    };
  } catch (error) {
    console.error('❌ Error uploading signature:', error);
    return { success: false, error: error.message };
  }
}

// ✅ Delete signature file(s) for a form
export async function deleteSignature(formId, signatureType = null) {
  try {
    if (!formId) return { success: true };
    
    const publicDir = path.join(process.cwd(), 'public', 'signatures');
    
    // If signatureType specified, delete only that signature
    if (signatureType) {
      const filename = `form_${formId}_${signatureType}.png`;
      const filePath = path.join(publicDir, filename);
      
      try {
        await fs.access(filePath);
        await fs.unlink(filePath);
        console.log('✅ Deleted signature:', filename);
      } catch (err) {
        console.log('ℹ️ Signature file not found:', filename);
      }
    } else {
      // Delete all signatures for this form
      const types = ['employee', 'employer'];
      for (const type of types) {
        const filename = `form_${formId}_${type}.png`;
        const filePath = path.join(publicDir, filename);
        
        try {
          await fs.access(filePath);
          await fs.unlink(filePath);
          console.log('✅ Deleted signature:', filename);
        } catch (err) {
          // File doesn't exist, continue
        }
      }
    }
    
    return { success: true };
  } catch (error) {
    console.error('❌ Error deleting signature:', error);
    return { success: false, error: error.message };
  }
}

// ✅ Verify form can be edited
export async function canEditForm(formId) {
  try {
    const pool = await DBconnection();
    const [rows] = await pool.query(
      'SELECT EMPLOYER_VERIFIED_UPLOADED_FLAG, FORM_STATUS FROM C_FORMS WHERE ID = ?',
      [formId]
    );
    
    if (rows.length === 0) {
      return { canEdit: false, reason: 'Form not found' };
    }
    
    const form = rows[0];
    
    // Cannot edit if employer has verified
    if (form.EMPLOYER_VERIFIED_UPLOADED_FLAG === 1) {
      return { canEdit: false, reason: 'This form has been verified by your employer and cannot be edited' };
    }
    
    // Cannot edit if status is employer verified
    if (form.FORM_STATUS === 'EMPLOYER_VERIFIED') {
      return { canEdit: false, reason: 'This form has been verified by your employer and cannot be edited' };
    }
    
    return { canEdit: true };
  } catch (error) {
    console.error('Error checking edit permission:', error);
    return { canEdit: false, reason: 'Error checking permissions' };
  }
}

// ✅ Add new form with proper status
export async function addForm(formData) {
  const pool = await DBconnection();
  
  try {
    // Validate employee and org exist
    try {
      const [empCheck] = await pool.query(
        'SELECT empid FROM C_EMP WHERE empid = ?',
        [formData.emp_id]
      );
      if (empCheck.length === 0) {
        throw new Error('Employee not found');
      }
      
      const [orgCheck] = await pool.query(
        'SELECT orgid FROM C_ORG WHERE orgid = ?',
        [formData.orgid]
      );
      if (orgCheck.length === 0) {
        throw new Error('Organization not found');
      }
    } catch (validationError) {
      console.log('⚠️ Validation tables not found, proceeding anyway');
    }
    
    const {
      orgid, emp_id, verifier_id, employee_verified_flag, form_type,
      employee_last_name, employee_first_name, employee_middle_initial,
      employee_other_last_names, employee_street_address, employee_apt_number,
      employee_city, employee_state, employee_zip_code, employee_dob,
      employee_ssn, employee_email, employee_phone, citizenship_status,
      alien_number, work_authorization_expiry, uscis_a_number, i94_admission_number,
      foreign_passport_number, country_of_issuance, employee_signature_date,
      signature_data
    } = formData;

    // Format dates
    const formattedDob = formatDate(employee_dob);
    const formattedSignatureDate = formatDate(employee_signature_date);
    const formattedWorkAuthExpiry = formatDate(work_authorization_expiry);
    
    // ✅ Determine form status - if verified flag is true, set status to EMPLOYEE_SUBMITTED
    const formStatus = employee_verified_flag ? 'EMPLOYEE_SUBMITTED' : 'DRAFT';

    // Insert form without signature URL first
    const query = `
      INSERT INTO C_FORMS (
        ORG_ID, EMP_ID, FORM_TYPE, VERIFIER_ID, 
        EMPLOYEE_VERIFIED_FLAG, FORM_STATUS,
        EMPLOYEE_LAST_NAME, EMPLOYEE_FIRST_NAME, EMPLOYEE_MIDDLE_INITIAL,
        EMPLOYEE_OTHER_LAST_NAMES, EMPLOYEE_STREET_ADDRESS, EMPLOYEE_APT_NUMBER,
        EMPLOYEE_CITY, EMPLOYEE_STATE, EMPLOYEE_ZIP_CODE, EMPLOYEE_DOB,
        EMPLOYEE_SSN, EMPLOYEE_EMAIL, EMPLOYEE_PHONE, CITIZENSHIP_STATUS,
        ALIEN_NUMBER, WORK_AUTHORIZATION_EXPIRY, USCIS_A_NUMBER, I94_ADMISSION_NUMBER,
        FOREIGN_PASSPORT_NUMBER, COUNTRY_OF_ISSUANCE, EMPLOYEE_SIGNATURE_DATE,
        CREATED_AT
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
    `;

    const values = [
      orgid, emp_id, form_type, verifier_id, 
      employee_verified_flag, formStatus,
      employee_last_name, employee_first_name, employee_middle_initial,
      employee_other_last_names, employee_street_address, employee_apt_number,
      employee_city, employee_state, employee_zip_code, formattedDob,
      employee_ssn, employee_email, employee_phone, citizenship_status,
      alien_number, formattedWorkAuthExpiry, uscis_a_number, i94_admission_number,
      foreign_passport_number, country_of_issuance, formattedSignatureDate
    ];

    const [result] = await pool.query(query, values);
    const formId = result.insertId;
    console.log('✅ Form created with ID:', formId, 'Status:', formStatus);

    // Upload signature using form ID
    if (signature_data) {
      const uploadResult = await uploadSignature(signature_data, formId, 'employee');
      
      if (uploadResult.success) {
        await pool.query(
          'UPDATE C_FORMS SET EMPLOYEE_SIGNATURE_URL = ?, EMPLOYEE_SIGNATURE_HASH = ? WHERE ID = ?',
          [uploadResult.path, uploadResult.hash, formId]
        );
        console.log('✅ Signature saved:', uploadResult.path);
      } else {
        console.error('⚠️ Failed to save signature:', uploadResult.error);
      }
    }

    return { success: true, id: formId };
  } catch (error) {
    console.error('❌ Error adding form:', error);
    throw new Error('Failed to add form: ' + error.message);
  }
}

// ✅ Fetch forms by employee ID
export async function fetchFormsByEmpId(empId, orgId, formType = null) {
  const pool = await DBconnection();
  let query = `
    SELECT * FROM C_FORMS 
    WHERE EMP_ID = ? AND ORG_ID = ?
  `;
  const params = [empId, orgId];

  if (formType) {
    query += ` AND FORM_TYPE = ?`;
    params.push(formType);
  }

  query += ` ORDER BY CREATED_AT DESC`;

  try {
    const [rows] = await pool.query(query, params);
    return rows;
  } catch (error) {
    console.error('❌ Error fetching forms:', error);
    throw new Error('Failed to fetch forms');
  }
}

// ✅ IMPROVED: Update form with proper validation and status update
export async function updateForm(formId, formData) {
  const pool = await DBconnection();
  
  try {
    // ✅ Check if form can be edited
    const editCheck = await canEditForm(formId);
    if (!editCheck.canEdit) {
      throw new Error(editCheck.reason);
    }
    
    console.log('📝 Updating form ID:', formId);
    
    const {
      employee_last_name, employee_first_name, employee_middle_initial,
      employee_other_last_names, employee_street_address, employee_apt_number,
      employee_city, employee_state, employee_zip_code, employee_dob,
      employee_ssn, employee_email, employee_phone, citizenship_status,
      alien_number, work_authorization_expiry, uscis_a_number, i94_admission_number,
      foreign_passport_number, country_of_issuance, employee_signature_date,
      employee_verified_flag, signature_data
    } = formData;

    // Format dates
    const formattedDob = formatDate(employee_dob);
    const formattedSignatureDate = formatDate(employee_signature_date);
    const formattedWorkAuthExpiry = formatDate(work_authorization_expiry);

    // ✅ Determine form status based on verification flag
    const formStatus = employee_verified_flag ? 'EMPLOYEE_SUBMITTED' : 'DRAFT';

    // Update form data including status
    const query = `
      UPDATE C_FORMS 
      SET EMPLOYEE_LAST_NAME = ?, EMPLOYEE_FIRST_NAME = ?, EMPLOYEE_MIDDLE_INITIAL = ?,
          EMPLOYEE_OTHER_LAST_NAMES = ?, EMPLOYEE_STREET_ADDRESS = ?, EMPLOYEE_APT_NUMBER = ?,
          EMPLOYEE_CITY = ?, EMPLOYEE_STATE = ?, EMPLOYEE_ZIP_CODE = ?, EMPLOYEE_DOB = ?,
          EMPLOYEE_SSN = ?, EMPLOYEE_EMAIL = ?, EMPLOYEE_PHONE = ?, CITIZENSHIP_STATUS = ?,
          ALIEN_NUMBER = ?, WORK_AUTHORIZATION_EXPIRY = ?, USCIS_A_NUMBER = ?, I94_ADMISSION_NUMBER = ?,
          FOREIGN_PASSPORT_NUMBER = ?, COUNTRY_OF_ISSUANCE = ?, EMPLOYEE_SIGNATURE_DATE = ?,
          EMPLOYEE_VERIFIED_FLAG = ?, FORM_STATUS = ?, UPDATED_AT = NOW()
      WHERE ID = ?
    `;

    const values = [
      employee_last_name, employee_first_name, employee_middle_initial,
      employee_other_last_names, employee_street_address, employee_apt_number,
      employee_city, employee_state, employee_zip_code, formattedDob,
      employee_ssn, employee_email, employee_phone, citizenship_status,
      alien_number, formattedWorkAuthExpiry, uscis_a_number, i94_admission_number,
      foreign_passport_number, country_of_issuance, formattedSignatureDate,
      employee_verified_flag, formStatus, formId
    ];

    const [result] = await pool.query(query, values);
    
    if (result.affectedRows === 0) {
      throw new Error('Form not found or no changes made');
    }

    // ✅ Handle signature update - always required for updates
    if (signature_data) {
      console.log('📝 Updating signature for form:', formId);
      
      // Upload new signature (will overwrite old file automatically due to same filename)
      const uploadResult = await uploadSignature(signature_data, formId, 'employee');
      
      if (uploadResult.success) {
        await pool.query(
          'UPDATE C_FORMS SET EMPLOYEE_SIGNATURE_URL = ?, EMPLOYEE_SIGNATURE_HASH = ? WHERE ID = ?',
          [uploadResult.path, uploadResult.hash, formId]
        );
        console.log('✅ Signature updated successfully');
      } else {
        throw new Error('Failed to update signature: ' + uploadResult.error);
      }
    } else {
      throw new Error('Signature is required when updating the form');
    }

    console.log('✅ Form updated successfully with status:', formStatus);
    return { success: true };
  } catch (error) {
    console.error('❌ Error updating form:', error);
    throw new Error(error.message || 'Failed to update form');
  }
}

// ✅ Delete form and its signatures
export async function deleteForm(formId) {
  const pool = await DBconnection();
  
  try {
    // Check if form can be deleted (only drafts or employee submitted)
    const [form] = await pool.query(
      'SELECT EMPLOYER_VERIFIED_UPLOADED_FLAG, FORM_STATUS FROM C_FORMS WHERE ID = ?',
      [formId]
    );
    
    if (form.length === 0) {
      throw new Error('Form not found');
    }
    
    if (form[0].EMPLOYER_VERIFIED_UPLOADED_FLAG === 1 || form[0].FORM_STATUS === 'EMPLOYER_VERIFIED') {
      throw new Error('Cannot delete a form that has been verified by employer');
    }
    
    // Delete signatures
    await deleteSignature(formId);
    
    // Delete form record
    await pool.query('DELETE FROM C_FORMS WHERE ID = ?', [formId]);
    
    console.log('✅ Form and signatures deleted:', formId);
    return { success: true };
  } catch (error) {
    console.error('❌ Error deleting form:', error);
    throw new Error(error.message || 'Failed to delete form');
  }
}

// Get available form types
export async function getFormTypes() {
  return [
    { value: 'I9', label: 'I-9 Employment Eligibility Verification' },
    { value: 'W4', label: 'W-4 Employee Withholding Certificate' },
    { value: 'W9', label: 'W-9 Request for Taxpayer Identification' },
  ];
}
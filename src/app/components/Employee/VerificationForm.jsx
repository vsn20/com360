// src/app/components/Employee/VerificationForm.jsx
'use client';

import React, { useState, useRef, useEffect } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { verifyForm } from '@/app/serverActions/Employee/documentverification';
import styles from './Verification.module.css';

// Helper function to safely handle null/undefined values
const safeValue = (value, defaultValue = '') => {
  return value ?? defaultValue;
};

const VerificationForm = ({ 
  form, 
  verifierEmpId, 
  orgId, 
  orgName,
  onBack, 
  onSuccess,
  isAdmin 
}) => {
  const [formData, setFormData] = useState({
    employer_first_day: '',
    employer_list_type: 'LIST_A',
    doc1_title: '',
    doc1_issuing_authority: '',
    doc1_number: '',
    doc1_expiry: '',
    doc2_title: '',
    doc2_issuing_authority: '',
    doc2_number: '',
    doc2_expiry: '',
    doc3_title: '',
    doc3_issuing_authority: '',
    doc3_number: '',
    doc3_expiry: '',
    employer_signature_date: new Date().toISOString().split('T')[0],
    employer_name: '',
    employer_title: '',
    employer_business_name: orgName || '',
    employer_address: '',
    alternative_procedure_used: false,
    additional_info: ''
  });

  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const sigCanvas = useRef(null);

  const isVerified = form.FORM_STATUS === 'EMPLOYER_VERIFIED';
  // Allow editing if the form is pending, or if the user is an admin (even if already verified).
  const canEdit = form.FORM_STATUS === 'EMPLOYEE_SUBMITTED' || (isAdmin && isVerified);

  useEffect(() => {
    // Pre-fill form if Section 2 data exists
    if (form.EMPLOYER_FIRST_DAY) {
      setFormData(prev => ({
        ...prev,
        employer_first_day: form.EMPLOYER_FIRST_DAY ? new Date(form.EMPLOYER_FIRST_DAY).toISOString().split('T')[0] : '',
        employer_list_type: form.EMPLOYER_LIST_TYPE || 'LIST_A',
        doc1_title: form.DOC1_TITLE || '',
        doc1_issuing_authority: form.DOC1_ISSUING_AUTHORITY || '',
        doc1_number: form.DOC1_NUMBER || '',
        doc1_expiry: form.DOC1_EXPIRY ? new Date(form.DOC1_EXPIRY).toISOString().split('T')[0] : '',
        doc2_title: form.DOC2_TITLE || '',
        doc2_issuing_authority: form.DOC2_ISSUING_AUTHORITY || '',
        doc2_number: form.DOC2_NUMBER || '',
        doc2_expiry: form.DOC2_EXPIRY ? new Date(form.DOC2_EXPIRY).toISOString().split('T')[0] : '',
        doc3_title: form.DOC3_TITLE || '',
        doc3_issuing_authority: form.DOC3_ISSUING_AUTHORITY || '',
        doc3_number: form.DOC3_NUMBER || '',
        doc3_expiry: form.DOC3_EXPIRY ? new Date(form.DOC3_EXPIRY).toISOString().split('T')[0] : '',
        employer_signature_date: form.EMPLOYER_SIGNATURE_DATE ? new Date(form.EMPLOYER_SIGNATURE_DATE).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
        employer_name: form.EMPLOYER_NAME || '',
        employer_title: form.EMPLOYER_TITLE || '',
        employer_business_name: form.EMPLOYER_BUSINESS_NAME || orgName || '',
        employer_address: form.EMPLOYER_ADDRESS || '',
        alternative_procedure_used: !!form.ALTERNATIVE_PROCEDURE_USED,
        additional_info: form.ADDITIONAL_INFO || ''
      }));
    }
  }, [form, orgName]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const clearSignature = () => {
    if (sigCanvas.current) {
      sigCanvas.current.clear();
    }
  };

  const validateForm = () => {
    if (!formData.employer_first_day) {
      throw new Error('First day of employment is required');
    }

    if (formData.employer_list_type === 'LIST_A') {
      if (!formData.doc1_title) {
        throw new Error('Document 1 title is required for List A');
      }
    } else {
      if (!formData.doc1_title || !formData.doc2_title) {
        throw new Error('Both List B and List C documents are required');
      }
    }

    if (!formData.employer_name) {
      throw new Error('Employer/Verifier name is required');
    }

    if (!formData.employer_title) {
      throw new Error('Employer/Verifier title is required');
    }
    
    // Signature is not required if just viewing a verified form without editing
    if (!isVerified || isEditing) {
        if (!sigCanvas.current || sigCanvas.current.isEmpty()) {
            throw new Error('Signature is required to verify or re-verify the form');
        }
    }

    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setIsSaving(true);

    try {
      validateForm();

      const canvas = sigCanvas.current.getCanvas();
      const sigImage = canvas.toDataURL('image/png');

      const dataToSubmit = {
        ...formData,
        form_id: form.ID,
        emp_id: form.EMP_ID,
        org_id: orgId,
        verifier_id: verifierEmpId,
        signature_data: sigImage
      };

      const result = await verifyForm(dataToSubmit);

      if (result.success) {
        onSuccess('Form verified and uploaded to documents successfully!');
      } else {
        throw new Error(result.error || 'Failed to verify form');
      }
    } catch (err) {
      setError(err.message || 'Failed to verify form');
      console.error('Verification error:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    // No need to reset form data, as useEffect will handle it based on `isEditing` state.
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    const date = new Date(dateStr);
    return new Date(date.getTime() + date.getTimezoneOffset() * 60000).toLocaleDateString();
  };

  const getCitizenshipLabel = (status) => {
    const labels = {
      1: '1. A citizen of the United States',
      2: '2. A noncitizen national of the United States',
      3: '3. A lawful permanent resident',
      4: '4. An alien authorized to work'
    };
    return labels[status] || 'N/A';
  };
  
  const isFormDisabled = isVerified && !isEditing;

  return (
    <div className={styles.verificationFormContainer}>
      {error && (
        <div className={styles.errorMessage}>
          <strong>Error:</strong> {error}
        </div>
      )}

      <div className={styles.headerSection}>
        <h2 className={styles.title}>
          {isVerified && !isEditing ? 'View Verified I-9 Form' : 'Verify I-9 Form'}
        </h2>
        <div className={styles.headerButtons}>
          {isVerified && !isEditing && canEdit && (
            <button 
              className={`${styles.button} ${styles.editButton}`}
              onClick={() => setIsEditing(true)}
            >
              Re-verify Form
            </button>
          )}
          <button className={`${styles.button} ${styles.backButton}`} onClick={onBack}>
            Back to List
          </button>
        </div>
      </div>

      <div className={styles.formSections}>
        {/* Section 1: Employee Information (Read-only) */}
        <div className={styles.formSection}>
          <h3>Section 1: Employee Information (Submitted by Employee)</h3>
          
          <div className={styles.infoGrid}>
            <div className={styles.infoItem}>
              <label>Employee Name:</label>
              <span>{form.EMPLOYEE_FIRST_NAME} {form.EMPLOYEE_MIDDLE_INITIAL} {form.EMPLOYEE_LAST_NAME}</span>
            </div>
            
            {form.EMPLOYEE_OTHER_LAST_NAMES && (
              <div className={styles.infoItem}>
                <label>Other Last Names:</label>
                <span>{form.EMPLOYEE_OTHER_LAST_NAMES}</span>
              </div>
            )}
            
            <div className={styles.infoItem}>
              <label>Address:</label>
              <span>
                {form.EMPLOYEE_STREET_ADDRESS}
                {form.EMPLOYEE_APT_NUMBER && `, Apt ${form.EMPLOYEE_APT_NUMBER}`}
                <br />
                {form.EMPLOYEE_CITY}, {form.EMPLOYEE_STATE} {form.EMPLOYEE_ZIP_CODE}
              </span>
            </div>
            
            <div className={styles.infoItem}>
              <label>Date of Birth:</label>
              <span>{formatDate(form.EMPLOYEE_DOB)}</span>
            </div>
            
            <div className={styles.infoItem}>
              <label>SSN:</label>
              <span>{form.EMPLOYEE_SSN || 'N/A'}</span>
            </div>
            
            <div className={styles.infoItem}>
              <label>Email:</label>
              <span>{form.EMPLOYEE_EMAIL || 'N/A'}</span>
            </div>
            
            <div className={styles.infoItem}>
              <label>Phone:</label>
              <span>{form.EMPLOYEE_PHONE || 'N/A'}</span>
            </div>
            
            <div className={styles.infoItem}>
              <label>Citizenship Status:</label>
              <span>{getCitizenshipLabel(form.CITIZENSHIP_STATUS)}</span>
            </div>
            
            {form.USCIS_A_NUMBER && (
              <div className={styles.infoItem}>
                <label>USCIS A-Number:</label>
                <span>{form.USCIS_A_NUMBER}</span>
              </div>
            )}
            
            {form.WORK_AUTHORIZATION_EXPIRY && (
              <div className={styles.infoItem}>
                <label>Work Authorization Expiry:</label>
                <span>{formatDate(form.WORK_AUTHORIZATION_EXPIRY)}</span>
              </div>
            )}
            
            <div className={styles.infoItem}>
              <label>Employee Signature Date:</label>
              <span>{formatDate(form.EMPLOYEE_SIGNATURE_DATE)}</span>
            </div>
            
            {form.EMPLOYEE_SIGNATURE_URL && (
              <div className={`${styles.infoItem} ${styles.infoItemFullWidth}`}>
                <label>Employee Signature:</label>
                <div className={styles.signatureDisplay}>
                  <img 
                    src={form.EMPLOYEE_SIGNATURE_URL} 
                    alt="Employee Signature"
                    style={{ maxWidth: '300px', border: '1px solid #ccc' }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Section 2: Employer Verification */}
        <form onSubmit={handleSubmit}>
          <div className={styles.formSection}>
            <h3>Section 2: Employer Review and Verification</h3>
            
            <div className={styles.formRow}>
              <div className={styles.formGroup}>
                <label>First Day of Employment*</label>
                <input
                  type="date"
                  name="employer_first_day"
                  value={safeValue(formData.employer_first_day)}
                  onChange={handleChange}
                  required
                  disabled={isFormDisabled}
                />
              </div>
              
              <div className={styles.formGroup}>
                <label>Document List Type*</label>
                <select
                  name="employer_list_type"
                  value={safeValue(formData.employer_list_type, 'LIST_A')}
                  onChange={handleChange}
                  disabled={isFormDisabled}
                >
                  <option value="LIST_A">List A (Identity & Employment Authorization)</option>
                  <option value="LIST_B_C">List B & C (Identity + Employment Authorization)</option>
                </select>
              </div>
            </div>

            {/* Document 1 */}
            <h4>{formData.employer_list_type === 'LIST_A' ? 'List A Document' : 'List B Document (Identity)'}</h4>
            <div className={styles.formRow}>
              <div className={styles.formGroup}>
                <label>Document Title*</label>
                <input
                  type="text"
                  name="doc1_title"
                  value={safeValue(formData.doc1_title)}
                  onChange={handleChange}
                  required
                  disabled={isFormDisabled}
                />
              </div>
              
              <div className={styles.formGroup}>
                <label>Issuing Authority</label>
                <input
                  type="text"
                  name="doc1_issuing_authority"
                  value={safeValue(formData.doc1_issuing_authority)}
                  onChange={handleChange}
                  disabled={isFormDisabled}
                />
              </div>
            </div>

            <div className={styles.formRow}>
              <div className={styles.formGroup}>
                <label>Document Number</label>
                <input
                  type="text"
                  name="doc1_number"
                  value={safeValue(formData.doc1_number)}
                  onChange={handleChange}
                  disabled={isFormDisabled}
                />
              </div>
              
              <div className={styles.formGroup}>
                <label>Expiration Date</label>
                <input
                  type="date"
                  name="doc1_expiry"
                  value={safeValue(formData.doc1_expiry)}
                  onChange={handleChange}
                  disabled={isFormDisabled}
                />
              </div>
            </div>

            {formData.employer_list_type === 'LIST_B_C' && (
              <>
                <h4>List C Document (Employment Authorization)</h4>
                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label>Document Title*</label>
                    <input
                      type="text"
                      name="doc2_title"
                      value={safeValue(formData.doc2_title)}
                      onChange={handleChange}
                      required
                      disabled={isFormDisabled}
                    />
                  </div>
                  
                  <div className={styles.formGroup}>
                    <label>Issuing Authority</label>
                    <input
                      type="text"
                      name="doc2_issuing_authority"
                      value={safeValue(formData.doc2_issuing_authority)}
                      onChange={handleChange}
                      disabled={isFormDisabled}
                    />
                  </div>
                </div>

                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label>Document Number</label>
                    <input
                      type="text"
                      name="doc2_number"
                      value={safeValue(formData.doc2_number)}
                      onChange={handleChange}
                      disabled={isFormDisabled}
                    />
                  </div>
                  
                  <div className={styles.formGroup}>
                    <label>Expiration Date</label>
                    <input
                      type="date"
                      name="doc2_expiry"
                      value={safeValue(formData.doc2_expiry)}
                      onChange={handleChange}
                      disabled={isFormDisabled}
                    />
                  </div>
                </div>
              </>
            )}

            {/* Document 3 (Optional) */}
            <h4>Additional Document (Optional)</h4>
            <div className={styles.formRow}>
              <div className={styles.formGroup}>
                <label>Document Title</label>
                <input
                  type="text"
                  name="doc3_title"
                  value={safeValue(formData.doc3_title)}
                  onChange={handleChange}
                  disabled={isFormDisabled}
                />
              </div>
              
              <div className={styles.formGroup}>
                <label>Issuing Authority</label>
                <input
                  type="text"
                  name="doc3_issuing_authority"
                  value={safeValue(formData.doc3_issuing_authority)}
                  onChange={handleChange}
                  disabled={isFormDisabled}
                />
              </div>
            </div>

            <div className={styles.formRow}>
              <div className={styles.formGroup}>
                <label>Document Number</label>
                <input
                  type="text"
                  name="doc3_number"
                  value={safeValue(formData.doc3_number)}
                  onChange={handleChange}
                  disabled={isFormDisabled}
                />
              </div>
              
              <div className={styles.formGroup}>
                <label>Expiration Date</label>
                <input
                  type="date"
                  name="doc3_expiry"
                  value={safeValue(formData.doc3_expiry)}
                  onChange={handleChange}
                  disabled={isFormDisabled}
                />
              </div>
            </div>

            {/* Employer/Verifier Information */}
            <h4>Certification</h4>
            <div className={styles.formRow}>
              <div className={styles.formGroup}>
                <label>Last Name, First Name of Verifier*</label>
                <input
                  type="text"
                  name="employer_name"
                  value={safeValue(formData.employer_name)}
                  onChange={handleChange}
                  required
                  disabled={isFormDisabled}
                  placeholder="Last, First Name"
                />
              </div>
              
              <div className={styles.formGroup}>
                <label>Title/Position of Verifier*</label>
                <input
                  type="text"
                  name="employer_title"
                  value={safeValue(formData.employer_title)}
                  onChange={handleChange}
                  required
                  disabled={isFormDisabled}
                />
              </div>
            </div>

            <div className={styles.formRow}>
              <div className={styles.formGroup}>
                <label>Employer's Business Name</label>
                <input
                  type="text"
                  name="employer_business_name"
                  value={safeValue(formData.employer_business_name)}
                  onChange={handleChange}
                  disabled={isFormDisabled}
                />
              </div>
              
              <div className={styles.formGroup}>
                <label>Signature Date*</label>
                <input
                  type="date"
                  name="employer_signature_date"
                  value={safeValue(formData.employer_signature_date)}
                  onChange={handleChange}
                  required
                  disabled={isFormDisabled}
                />
              </div>
            </div>

            <div className={styles.formGroup}>
              <label>Business Address (City, State, ZIP)</label>
              <input
                type="text"
                name="employer_address"
                value={safeValue(formData.employer_address)}
                onChange={handleChange}
                disabled={isFormDisabled}
                placeholder="City, State, ZIP Code"
              />
            </div>

            <div className={styles.formGroup}>
              <label>
                <input
                  type="checkbox"
                  name="alternative_procedure_used"
                  checked={!!formData.alternative_procedure_used}
                  onChange={handleChange}
                  disabled={isFormDisabled}
                />
                {' '}Alternative procedure authorized by DHS was used to examine documents
              </label>
            </div>

            <div className={styles.formGroup}>
              <label>Additional Information</label>
              <textarea
                name="additional_info"
                value={safeValue(formData.additional_info)}
                onChange={handleChange}
                rows="3"
                disabled={isFormDisabled}
                placeholder="Any additional notes or information"
              />
            </div>

            {/* Signature Section */}
            {isFormDisabled ? (
              form.VERIFIER_SIGNATURE_URL && (
                <div className={styles.formGroup}>
                  <label>Employer/Verifier Signature</label>
                  <div className={styles.signatureDisplay}>
                    <img 
                      src={form.VERIFIER_SIGNATURE_URL} 
                      alt="Employer Signature"
                      style={{ maxWidth: '300px', border: '1px solid #ccc' }}
                    />
                  </div>
                </div>
              )
            ) : (
              <div className={styles.formGroup}>
                <label>Signature of Employer or Authorized Representative*</label>
                <p style={{ fontSize: '14px', color: '#666', marginBottom: '10px' }}>
                  {isEditing 
                    ? 'Draw a new signature below. This will replace the existing signature and re-verify the form.' 
                    : 'Please sign below using your mouse or touchscreen.'
                  }
                </p>
                {isEditing && form.VERIFIER_SIGNATURE_URL && (
                  <div style={{ marginBottom: '10px', padding: '10px', backgroundColor: '#f8f9fa', borderRadius: '4px' }}>
                    <p style={{ margin: '0 0 10px 0', fontSize: '13px', fontWeight: 'bold' }}>
                      Current signature (will be replaced):
                    </p>
                    <img 
                      src={form.VERIFIER_SIGNATURE_URL}
                      alt="Current Signature" 
                      style={{ maxWidth: '300px', border: '1px solid #ccc', borderRadius: '4px' }}
                    />
                  </div>
                )}
                <div className={styles.signatureCanvasWrapper}>
                  <SignatureCanvas 
                    ref={sigCanvas}
                    canvasProps={{ 
                      width: 600, 
                      height: 200, 
                      className: styles.signatureCanvas
                    }} 
                  />
                </div>
                <button 
                  type="button" 
                  onClick={clearSignature}
                  className={`${styles.button} ${styles.clearButton}`}
                  style={{ marginTop: '10px' }}
                >
                  Clear Signature
                </button>
              </div>
            )}
          </div>

          {!isFormDisabled && (
            <div className={styles.formButtons}>
              <button 
                type="submit" 
                className={`${styles.button} ${styles.saveButton}`}
                disabled={isSaving}
              >
                {isSaving ? 'Verifying...' : (isEditing ? 'Re-verify and Update' : 'Verify and Submit')}
              </button>
              <button 
                type="button" 
                className={`${styles.button} ${styles.cancelButton}`}
                onClick={isEditing ? handleCancelEdit : onBack}
                disabled={isSaving}
              >
                Cancel
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
};

export default VerificationForm;

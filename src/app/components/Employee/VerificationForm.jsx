// src/app/components/Employee/VerificationForm.jsx
'use client';

import React, { useState, useRef, useEffect } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { verifyForm } from '@/app/serverActions/Employee/documentverification';
import styles from './Verification.module.css';

// --- DATE UTILITIES (MATCHING I-983 LOGIC) ---

// Get today's date in local timezone YYYY-MM-DD (Prevents day-before issue)
const getLocalTodayDate = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Format date for input[type="date"] ensuring local time is respected
const formatDateForInput = (dateStr) => {
  if (!dateStr) return '';
  try {
    // Handle YYYY-MM-DD or YYYY-MM-DDTHH...
    if (typeof dateStr === 'string') {
      const cleanDate = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
      const parts = cleanDate.split('-');
      if (parts.length === 3) {
        const year = parts[0];
        const month = parts[1];
        const day = parts[2];
        if (year < 1900 || year > 2100) return '';
        return `${year}-${month}-${day}`;
      }
    }
    
    // Fallback for Date objects
    const date = new Date(dateStr);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    if (year < 1900 || year > 2100) return '';
    return `${year}-${month}-${day}`;
  } catch (e) { return ''; }
};

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
    employer_signature_date: getLocalTodayDate(),
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
  const [timestamp] = useState(Date.now()); // Used for cache-busting images
  
  // ✅ NEW: Image signature support (matching I-983)
  const [signatureType, setSignatureType] = useState('canvas');
  const imageFileInputRef = useRef(null);
  const [imageSignatureFile, setImageSignatureFile] = useState(null);
  const [imageSignaturePreview, setImageSignaturePreview] = useState(null);

  const isVerified = form.FORM_STATUS === 'EMPLOYER_VERIFIED';
  // Allow editing if the form is pending, or if the user is an admin (even if already verified).
  const canEdit = form.FORM_STATUS === 'EMPLOYEE_SUBMITTED' || (isAdmin && isVerified);

  useEffect(() => {
    // Pre-fill form if Section 2 data exists
    if (form.EMPLOYER_FIRST_DAY) {
      setFormData(prev => ({
        ...prev,
        employer_first_day: formatDateForInput(form.EMPLOYER_FIRST_DAY),
        employer_list_type: form.EMPLOYER_LIST_TYPE || 'LIST_A',
        doc1_title: form.DOC1_TITLE || '',
        doc1_issuing_authority: form.DOC1_ISSUING_AUTHORITY || '',
        doc1_number: form.DOC1_NUMBER || '',
        doc1_expiry: formatDateForInput(form.DOC1_EXPIRY),
        doc2_title: form.DOC2_TITLE || '',
        doc2_issuing_authority: form.DOC2_ISSUING_AUTHORITY || '',
        doc2_number: form.DOC2_NUMBER || '',
        doc2_expiry: formatDateForInput(form.DOC2_EXPIRY),
        doc3_title: form.DOC3_TITLE || '',
        doc3_issuing_authority: form.DOC3_ISSUING_AUTHORITY || '',
        doc3_number: form.DOC3_NUMBER || '',
        doc3_expiry: formatDateForInput(form.DOC3_EXPIRY),
        employer_signature_date: formatDateForInput(form.EMPLOYER_SIGNATURE_DATE) || getLocalTodayDate(),
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

  // ✅ NEW: Clear canvas signature
  const clearCanvasSignature = () => {
    if (sigCanvas.current) {
      sigCanvas.current.clear();
    }
  };

  // ✅ NEW: Handle image signature file selection
  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = ['image/png', 'image/jpeg', 'image/jpg'];
    if (!validTypes.includes(file.type)) {
      setError('Please upload a PNG or JPEG image.');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('Image file is too large. Maximum size is 5MB.');
      return;
    }

    setImageSignatureFile(file);

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setImageSignaturePreview(reader.result);
    };
    reader.readAsDataURL(file);
  };

  // ✅ NEW: Clear image signature
  const clearImageSignature = () => {
    setImageSignatureFile(null);
    setImageSignaturePreview(null);
    if (imageFileInputRef.current) {
      imageFileInputRef.current.value = '';
    }
  };

  // ✅ UPDATED: Handle signature type change
  const handleSignatureTypeChange = (e) => {
    const newType = e.target.value;
    setSignatureType(newType);
    // Clear the other signature type
    if (newType === 'canvas') {
      clearImageSignature();
    } else {
      clearCanvasSignature();
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
      if (signatureType === 'canvas') {
        if (!sigCanvas.current || sigCanvas.current.isEmpty()) {
          throw new Error('Signature is required to verify or re-verify the form. Please draw your signature.');
        }
      } else if (signatureType === 'image') {
        if (!imageSignaturePreview) {
          throw new Error('Signature is required to verify or re-verify the form. Please upload a signature image.');
        }
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

      // ✅ Get signature data based on signature type
      let signatureData = null;
      
      if (signatureType === 'canvas') {
        if (sigCanvas.current && !sigCanvas.current.isEmpty()) {
          signatureData = sigCanvas.current.toDataURL('image/png');
        }
      } else if (signatureType === 'image') {
        if (imageSignaturePreview) {
          signatureData = imageSignaturePreview;
        }
      }

      const payload = {
        formId: form.ID,
        verifierEmpId,
        orgId,
        ...formData,
        signature_data: signatureData,
      };

      const result = await verifyForm(payload);

      if (result.success) {
        onSuccess('Form verified successfully!');
      } else {
        throw new Error(result.error || 'Failed to verify form');
      }
    } catch (err) {
      setError(err.message);
      console.error('Verification error:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditToggle = () => {
    setIsEditing(!isEditing);
    setError(null);
    
    // Reset signature states when toggling edit mode
    setSignatureType('canvas');
    setImageSignatureFile(null);
    setImageSignaturePreview(null);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setError(null);
    
    // Reset signature states
    setSignatureType('canvas');
    setImageSignatureFile(null);
    setImageSignaturePreview(null);
  };

  const isFormDisabled = !canEdit || (isVerified && !isEditing);

  return (
    <div className={styles.verificationContainer}>
      <div className={styles.formHeader}>
        <h2>I-9 Form - Section 2: Employer Review and Verification</h2>
        <div className={styles.headerButtons}>
          {isVerified && isAdmin && !isEditing && (
            <button
              type="button"
              className={`${styles.button} ${styles.editButton}`}
              onClick={handleEditToggle}
            >
              Edit Verification
            </button>
          )}
          <button
            type="button"
            className={`${styles.button} ${styles.backButton}`}
            onClick={onBack}
            disabled={isSaving}
          >
            Back to List
          </button>
        </div>
      </div>

      {error && (
        <div className={styles.errorMessage}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {isVerified && !isEditing && (
        <div className={styles.infoMessage}>
          This form has been verified. {isAdmin ? 'You can edit it if needed.' : 'Contact an administrator if changes are needed.'}
        </div>
      )}

      <div className={styles.formContent}>
        <form onSubmit={handleSubmit}>
          {/* Employee Information Section (Read-only) */}
          <div className={styles.formSection}>
            <h3>Section 1: Employee Information (Completed by Employee)</h3>
            
            <div className={styles.formRow}>
              <div className={styles.formGroup}>
                <label>Last Name</label>
                <input
                  type="text"
                  value={safeValue(form.EMPLOYEE_LAST_NAME)}
                  disabled
                  className={styles.readOnlyInput}
                />
              </div>
              <div className={styles.formGroup}>
                <label>First Name</label>
                <input
                  type="text"
                  value={safeValue(form.EMPLOYEE_FIRST_NAME)}
                  disabled
                  className={styles.readOnlyInput}
                />
              </div>
              <div className={styles.formGroup}>
                <label>Middle Initial</label>
                <input
                  type="text"
                  value={safeValue(form.EMPLOYEE_MIDDLE_INITIAL)}
                  disabled
                  className={styles.readOnlyInput}
                />
              </div>
            </div>

            <div className={styles.formRow}>
              <div className={styles.formGroup}>
                <label>Address</label>
                <input
                  type="text"
                  value={`${safeValue(form.EMPLOYEE_STREET_ADDRESS)} ${safeValue(form.EMPLOYEE_APT_NUMBER)}`}
                  disabled
                  className={styles.readOnlyInput}
                />
              </div>
            </div>

            <div className={styles.formRow}>
              <div className={styles.formGroup}>
                <label>City</label>
                <input
                  type="text"
                  value={safeValue(form.EMPLOYEE_CITY)}
                  disabled
                  className={styles.readOnlyInput}
                />
              </div>
              <div className={styles.formGroup}>
                <label>State</label>
                <input
                  type="text"
                  value={safeValue(form.EMPLOYEE_STATE)}
                  disabled
                  className={styles.readOnlyInput}
                />
              </div>
              <div className={styles.formGroup}>
                <label>ZIP Code</label>
                <input
                  type="text"
                  value={safeValue(form.EMPLOYEE_ZIP_CODE)}
                  disabled
                  className={styles.readOnlyInput}
                />
              </div>
            </div>

            {form.EMPLOYEE_SIGNATURE_URL && (
              <div className={styles.formGroup}>
                <label>Employee Signature</label>
                <div className={styles.signatureDisplay}>
                  <img 
                    src={`${form.EMPLOYEE_SIGNATURE_URL}?t=${timestamp}`}
                    alt="Employee Signature"
                    style={{ maxWidth: '300px', border: '1px solid #ccc', borderRadius: '4px' }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Section 2: Employer Verification */}
          <div className={styles.formSection}>
            <h3>Section 2: Employer Review and Verification</h3>

            <div className={styles.formGroup}>
              <label>Employee's First Day of Employment*</label>
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
                value={safeValue(formData.employer_list_type)}
                onChange={handleChange}
                required
                disabled={isFormDisabled}
              >
                <option value="LIST_A">List A - Documents that Establish Both Identity and Employment Authorization</option>
                <option value="LIST_B_AND_C">List B (Identity) and List C (Employment Authorization)</option>
              </select>
            </div>

            {/* Document 1 */}
            <div className={styles.documentSection}>
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
                    placeholder="e.g., U.S. Passport, Driver's License"
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
                    placeholder="e.g., U.S. Department of State"
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
                  <label>Expiration Date (if any)</label>
                  <input
                    type="date"
                    name="doc1_expiry"
                    value={safeValue(formData.doc1_expiry)}
                    onChange={handleChange}
                    disabled={isFormDisabled}
                  />
                </div>
              </div>
            </div>

            {/* Document 2 - Only for List B&C */}
            {formData.employer_list_type === 'LIST_B_AND_C' && (
              <div className={styles.documentSection}>
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
                      placeholder="e.g., Social Security Card"
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
                      placeholder="e.g., Social Security Administration"
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
                    <label>Expiration Date (if any)</label>
                    <input
                      type="date"
                      name="doc2_expiry"
                      value={safeValue(formData.doc2_expiry)}
                      onChange={handleChange}
                      disabled={isFormDisabled}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Document 3 - Optional additional document */}
            <div className={styles.documentSection}>
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
                  <label>Expiration Date (if any)</label>
                  <input
                    type="date"
                    name="doc3_expiry"
                    value={safeValue(formData.doc3_expiry)}
                    onChange={handleChange}
                    disabled={isFormDisabled}
                  />
                </div>
              </div>
            </div>

            {/* Employer/Verifier Information */}
            <div className={styles.formRow}>
              <div className={styles.formGroup}>
                <label>Name of Employer or Authorized Representative*</label>
                <input
                  type="text"
                  name="employer_name"
                  value={safeValue(formData.employer_name)}
                  onChange={handleChange}
                  required
                  disabled={isFormDisabled}
                />
              </div>
              <div className={styles.formGroup}>
                <label>Title*</label>
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
                <label>Employer Business Name</label>
                <input
                  type="text"
                  name="employer_business_name"
                  value={safeValue(formData.employer_business_name)}
                  onChange={handleChange}
                  disabled={isFormDisabled}
                />
              </div>
              <div className={styles.formGroup}>
                <label>Employer Address</label>
                <input
                  type="text"
                  name="employer_address"
                  value={safeValue(formData.employer_address)}
                  onChange={handleChange}
                  disabled={isFormDisabled}
                />
              </div>
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

            <div className={styles.formGroup}>
              <label style={{ display: 'flex', alignItems: 'center' }}>
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
                      src={`${form.VERIFIER_SIGNATURE_URL}?t=${timestamp}`} 
                      alt="Employer Signature"
                      style={{ maxWidth: '300px', border: '1px solid #ccc', borderRadius: '4px' }}
                    />
                  </div>
                </div>
              )
            ) : (
              <div className={styles.formGroup}>
                <label>Signature of Employer or Authorized Representative*</label>
                
                {/* Existing signature display (if editing) */}
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

                {/* Signature Type Selection */}
                <div style={{ marginBottom: '15px', padding: '10px', backgroundColor: '#f8f9fa', borderRadius: '4px' }}>
                  <p style={{ margin: '0 0 10px 0', fontSize: '14px', fontWeight: '500' }}>
                    {isEditing 
                      ? 'Choose how to provide a new signature (will replace existing):' 
                      : 'Choose signature method:'}
                  </p>
                  <div style={{ display: 'flex', gap: '20px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                      <input
                        type="radio"
                        name="verifierSignatureType"
                        value="canvas"
                        checked={signatureType === 'canvas'}
                        onChange={handleSignatureTypeChange}
                        style={{ marginRight: '8px' }}
                      />
                      Draw Signature
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                      <input
                        type="radio"
                        name="verifierSignatureType"
                        value="image"
                        checked={signatureType === 'image'}
                        onChange={handleSignatureTypeChange}
                        style={{ marginRight: '8px' }}
                      />
                      Upload Signature Image
                    </label>
                  </div>
                </div>

                {/* Canvas Signature Option */}
                {signatureType === 'canvas' && (
                  <>
                    <p style={{ fontSize: '14px', color: '#666', marginBottom: '10px' }}>
                      Please sign below using your mouse or touchscreen.
                    </p>
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
                      onClick={clearCanvasSignature}
                      className={`${styles.button} ${styles.clearButton}`}
                      style={{ marginTop: '10px' }}
                    >
                      Clear Signature
                    </button>
                  </>
                )}

                {/* Image Upload Option */}
                {signatureType === 'image' && (
                  <>
                    <p style={{ margin: '0 0 10px 0', fontSize: '13px', color: '#666' }}>
                      Upload a PNG, JPG, or JPEG image of your signature.
                    </p>
                    <div style={{ marginBottom: '10px' }}>
                      <input
                        type="file"
                        ref={imageFileInputRef}
                        accept="image/png,image/jpeg,image/jpg"
                        onChange={handleImageChange}
                        style={{ 
                          padding: '10px', 
                          border: '2px dashed #007bff', 
                          borderRadius: '4px', 
                          width: '100%', 
                          maxWidth: '400px',
                          backgroundColor: '#fff'
                        }}
                      />
                    </div>
                    
                    {imageSignaturePreview && (
                      <div style={{ marginTop: '10px', padding: '10px', backgroundColor: '#f8f9fa', borderRadius: '4px' }}>
                        <p style={{ margin: '0 0 10px 0', fontSize: '13px', fontWeight: 'bold', color: '#28a745' }}>
                          ✓ Signature preview:
                        </p>
                        <img 
                          src={imageSignaturePreview} 
                          alt="Signature Preview" 
                          style={{ 
                            maxWidth: '300px', 
                            maxHeight: '100px', 
                            border: '1px solid #ccc', 
                            borderRadius: '4px',
                            backgroundColor: '#fff'
                          }} 
                        />
                        <div style={{ marginTop: '10px' }}>
                          <button 
                            type="button" 
                            onClick={clearImageSignature}
                            className={`${styles.button} ${styles.clearButton}`}
                          >
                            Remove & Upload Different Image
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}
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
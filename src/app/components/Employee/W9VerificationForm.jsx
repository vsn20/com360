// src/app/components/Employee/W9VerificationForm.jsx
'use client';

import React, { useState, useRef } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { verifyW9Form } from '@/app/serverActions/forms/w9VerificationActions';
import styles from './Verification.module.css';

const W9VerificationForm = ({ form, verifierEmpId, orgId, onBack, onSuccess, isAdmin }) => {
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const sigCanvas = useRef(null);

  const isVerified = form.FORM_STATUS === 'VERIFIED';
  // Allow editing if the form is submitted (pending), or if the user is an admin (even if already verified).
  const canEdit = form.FORM_STATUS === 'SUBMITTED' || (isAdmin && isVerified);

  const handleVerify = async () => {
    setError(null);
    if (!isVerified || isEditing) {
      if (!sigCanvas.current || sigCanvas.current.isEmpty()) {
        setError('A verifier signature is required to proceed.');
        return;
      }
    }
    
    setIsSaving(true);
    try {
      const signatureData = sigCanvas.current.getCanvas().toDataURL('image/png');
      
      // ✅ FIX: Pass the original numeric form.ID, not the prefixed one
      // The `form` object from `getW9FormDetails` has the non-prefixed ID
      const result = await verifyW9Form({
        formId: form.ID, 
        verifierId: verifierEmpId,
        orgId: orgId,
        signatureData: signatureData,
      });

      if (result.success) {
        onSuccess(result.message || 'W-9 Form successfully verified.');
      } else {
        throw new Error(result.error);
      }
    } catch (err) {
      setError(err.message || 'An unexpected error occurred during verification.');
    } finally {
      setIsSaving(false);
    }
  };

  const clearSignature = () => {
    if (sigCanvas.current) {
      sigCanvas.current.clear();
    }
  };
  
  const handleCancelEdit = () => {
    setIsEditing(false);
    setError(null);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
        return 'Invalid Date';
    }
    return new Date(date.getTime() + date.getTimezoneOffset() * 60000).toLocaleDateString();
  };

  const getTaxClassificationLabel = (status) => {
    const labels = {
      'INDIVIDUAL': 'Individual/sole proprietor',
      'C_CORPORATION': 'C Corporation',
      'S_CORPORATION': 'S Corporation',
      'PARTNERSHIP': 'Partnership',
      'TRUST_ESTATE': 'Trust/estate',
      'LLC': 'Limited liability company',
      'OTHER': 'Other',
    };
    return labels[status] || 'N/A';
  };
  
  const isFormDisabled = isVerified && !isEditing;

  return (
    <div className={styles.verificationFormContainer}>
      {error && <div className={styles.errorMessage}><strong>Error:</strong> {error}</div>}
      
      <div className={styles.headerSection}>
        <h2 className={styles.title}>{isVerified && !isEditing ? 'View Verified W-9' : 'Verify W-9 Form'}</h2>
        <div className={styles.headerButtons}>
            {isVerified && !isEditing && canEdit && (
                <button 
                    className={`${styles.button} ${styles.editButton}`}
                    onClick={() => setIsEditing(true)}
                >
                    Re-verify Form
                </button>
            )}
            <button className={`${styles.button} ${styles.backButton}`} onClick={onBack}>Back to List</button>
        </div>
      </div>

      {/* Section 1: Read-only submitted data */}
      <div className={styles.formSection}>
        <h3>W-9: Submitted by Employee</h3>
        <div className={styles.infoGrid}>
          <div className={styles.infoItem}><label>Name:</label><span>{form.NAME}</span></div>
          {form.BUSINESS_NAME && <div className={styles.infoItem}><label>Business Name:</label><span>{form.BUSINESS_NAME}</span></div>}
          <div className={styles.infoItem}><label>Tax Classification:</label><span>{getTaxClassificationLabel(form.TAX_CLASSIFICATION)} {form.LLC_CLASSIFICATION_CODE ? `(${form.LLC_CLASSIFICATION_CODE})` : ''}</span></div>
          <div className={styles.infoItem}><label>Address:</label><span>{form.ADDRESS_STREET}</span></div>
          <div className={styles.infoItem}><label>City, State, ZIP:</label><span>{form.ADDRESS_CITY_STATE_ZIP}</span></div>
          <div className={styles.infoItem}><label>TIN:</label><span>{form.TAXPAYER_IDENTIFICATION_NUMBER}</span></div>
          {form.EXEMPT_PAYEE_CODE && <div className={styles.infoItem}><label>Exempt Payee Code:</label><span>{form.EXEMPT_PAYEE_CODE}</span></div>}
          {form.EXEMPTION_FROM_FATCA_CODE && <div className={styles.infoItem}><label>FATCA Exemption:</label><span>{form.EXEMPTION_FROM_FATCA_CODE}</span></div>}
          <div className={styles.infoItem}><label>Submitted Date:</label><span>{formatDate(form.SUBMITTED_AT)}</span></div>
        </div>
        {form.SIGNATURE_URL && (
            <div className={`${styles.infoItem} ${styles.infoItemFullWidth}`}>
                <label>Employee Signature:</label>
                <div className={styles.signatureDisplay}>
                    <img src={form.SIGNATURE_URL} alt="Employee Signature" style={{ maxWidth: '300px', border: '1px solid #ccc' }}/>
                </div>
            </div>
        )}
      </div>
      
      {/* Section 2: Verification Action */}
      <div className={styles.formSection}>
        <h3>Verifier Confirmation</h3>
        {isFormDisabled ? (
          <div>
            <div className={styles.infoGrid}>
                <div className={styles.infoItem}><label>Verifier ID:</label><span>{form.VERIFIER_ID || 'N/A'}</span></div>
                <div className={styles.infoItem}><label>Verification Date:</label><span>{formatDate(form.VERIFIED_AT)}</span></div>
            </div>
            {form.VERIFIER_SIGNATURE_URL && (
                <div className={`${styles.infoItem} ${styles.infoItemFullWidth}`}>
                    <label>Verifier Signature:</label>
                    <div className={styles.signatureDisplay}>
                        <img src={form.VERIFIER_SIGNATURE_URL} alt="Verifier Signature" style={{ maxWidth: '300px', border: '1px solid #ccc' }}/>
                    </div>
                </div>
            )}
          </div>
        ) : (
          <div>
            <p>By signing below, you attest that you have reviewed the information provided on this Form W-9.</p>
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
            <div className={styles.formGroup}>
              <label>Your Signature*</label>
              <div className={styles.signatureCanvasWrapper}>
                <SignatureCanvas 
                  ref={sigCanvas}
                  canvasProps={{ width: 600, height: 200, className: styles.signatureCanvas }} 
                />
              </div>
              <button type="button" onClick={clearSignature} className={`${styles.button} ${styles.clearButton}`} style={{ marginTop: '10px' }}>
                Clear Signature
              </button>
            </div>
            <div className={styles.formButtons}>
              <button onClick={handleVerify} className={`${styles.button} ${styles.saveButton}`} disabled={isSaving}>
                {isSaving ? 'Verifying...' : (isEditing ? 'Re-verify and Submit' : 'Verify and Submit')}
              </button>
              <button onClick={isEditing ? handleCancelEdit : onBack} className={`${styles.button} ${styles.cancelButton}`} disabled={isSaving}>
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default W9VerificationForm;
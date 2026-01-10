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
  const [timestamp] = useState(Date.now()); // Used for cache-busting images
  
  // Signature type state (canvas or pdf)
  const pdfFileInputRef = useRef(null);
  const [signatureType, setSignatureType] = useState('canvas');
  const [pdfSignatureFile, setPdfSignatureFile] = useState(null);
  const [pdfSignaturePreview, setPdfSignaturePreview] = useState(null);
  const [isExtractingSignature, setIsExtractingSignature] = useState(false);

  const isVerified = form.FORM_STATUS === 'VERIFIED';
  // Allow editing if the form is submitted (pending), or if the user is an admin (even if already verified).
  const canEdit = form.FORM_STATUS === 'SUBMITTED' || (isAdmin && isVerified);

  // Handle signature type change (canvas or pdf)
  const handleSignatureTypeChange = (e) => {
    const newType = e.target.value;
    setSignatureType(newType);
    if (newType === 'canvas') {
      setPdfSignatureFile(null);
      setPdfSignaturePreview(null);
      if (pdfFileInputRef.current) pdfFileInputRef.current.value = '';
    } else {
      if (sigCanvas.current) sigCanvas.current.clear();
    }
  };

  // Handle PDF file selection and extract signature
  const handlePdfFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) {
      setPdfSignatureFile(null);
      setPdfSignaturePreview(null);
      return;
    }
    if (file.type !== 'application/pdf') {
      setError('Please upload a valid PDF file.');
      e.target.value = '';
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('PDF file size must be less than 5MB.');
      e.target.value = '';
      return;
    }
    setError(null);
    setPdfSignatureFile(file);
    setIsExtractingSignature(true);
    
    try {
      // FIX: Use explicit min.mjs path to avoid "Object.defineProperty" Webpack error
      const pdfjsModule = await import('pdfjs-dist/build/pdf.min.mjs');
      const pdfjsLib = pdfjsModule.default || pdfjsModule;
      
      // Set worker source
      if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
          pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
      }

      const arrayBuffer = await file.arrayBuffer();
      const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
      const pdfDoc = await loadingTask.promise;
      const page = await pdfDoc.getPage(1);
      const scale = 2;
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      await page.render({ canvasContext: context, viewport: viewport }).promise;
      const signatureDataUrl = canvas.toDataURL('image/png');
      setPdfSignaturePreview(signatureDataUrl);
      setError(null);
    } catch (err) {
      console.error('PDF extraction error:', err);
      setError('Failed to process PDF file: ' + (err.message || 'Unknown error'));
      setPdfSignatureFile(null);
      setPdfSignaturePreview(null);
      if (pdfFileInputRef.current) pdfFileInputRef.current.value = '';
    } finally {
      setIsExtractingSignature(false);
    }
  };

  // Clear PDF signature
  const clearPdfSignature = () => {
    setPdfSignatureFile(null);
    setPdfSignaturePreview(null);
    if (pdfFileInputRef.current) pdfFileInputRef.current.value = '';
  };

  // Get signature data based on type
  const getSignatureData = () => {
    if (signatureType === 'canvas') {
      return sigCanvas.current?.isEmpty() ? null : sigCanvas.current.toDataURL('image/png');
    } else if (signatureType === 'pdf') {
      return pdfSignaturePreview;
    }
    return null;
  };

  const handleVerify = async () => {
    setError(null);
    if (!isVerified || isEditing) {
      // Validate signature based on type
      if (signatureType === 'canvas') {
        if (!sigCanvas.current || sigCanvas.current.isEmpty()) {
          setError('A verifier signature is required. Please draw your signature.');
          return;
        }
      } else if (signatureType === 'pdf') {
        if (!pdfSignaturePreview) {
          setError('A verifier signature is required. Please upload a PDF with your signature.');
          return;
        }
      }
    }
    
    setIsSaving(true);
    try {
      const signatureData = getSignatureData();
      
      // Pass the original numeric form.ID
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
    const adjustedDate = new Date(date.getTime() + date.getTimezoneOffset() * 60000);
    const month = String(adjustedDate.getMonth() + 1).padStart(2, '0');
    const day = String(adjustedDate.getDate()).padStart(2, '0');
    return `${month}/${day}/${adjustedDate.getFullYear()}`;
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
                    <img 
                      src={`${form.SIGNATURE_URL}?t=${timestamp}`} 
                      alt="Employee Signature" 
                      style={{ maxWidth: '300px', border: '1px solid #ccc', borderRadius: '4px' }}
                    />
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
                        <img 
                          src={`${form.VERIFIER_SIGNATURE_URL}?t=${timestamp}`} 
                          alt="Verifier Signature" 
                          style={{ maxWidth: '300px', border: '1px solid #ccc', borderRadius: '4px' }}
                        />
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
                        src={`${form.VERIFIER_SIGNATURE_URL}?t=${timestamp}`}
                        alt="Current Signature" 
                        style={{ maxWidth: '300px', border: '1px solid #ccc', borderRadius: '4px' }}
                    />
                </div>
            )}
            <div className={styles.formGroup}>
              <label>Your Signature*</label>
              
              {/* Signature Type Selection */}
              <div style={{ marginBottom: '15px', padding: '10px', backgroundColor: '#f8f9fa', borderRadius: '4px' }}>
                <p style={{ margin: '0 0 10px 0', fontSize: '14px', fontWeight: '500' }}>
                  Choose signature method:
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
                      value="pdf"
                      checked={signatureType === 'pdf'}
                      onChange={handleSignatureTypeChange}
                      style={{ marginRight: '8px' }}
                    />
                    Upload Signature PDF
                  </label>
                </div>
              </div>

              {/* Canvas Signature Option */}
              {signatureType === 'canvas' && (
                <>
                  <p style={{ margin: '0 0 10px 0', fontSize: '13px', color: '#666' }}>
                    Please sign below using your mouse or touchscreen.
                  </p>
                  <div className={styles.signatureCanvasWrapper}>
                    <SignatureCanvas 
                      ref={sigCanvas}
                      canvasProps={{ width: 600, height: 200, className: styles.signatureCanvas }} 
                    />
                  </div>
                  <button type="button" onClick={clearSignature} className={`${styles.button} ${styles.clearButton}`} style={{ marginTop: '10px' }}>
                    Clear Signature
                  </button>
                </>
              )}

              {/* PDF Upload Option */}
              {signatureType === 'pdf' && (
                <>
                  <p style={{ margin: '0 0 10px 0', fontSize: '13px', color: '#666' }}>
                    Upload a PDF file containing your signature. The signature will be extracted automatically.
                  </p>
                  <div style={{ marginBottom: '10px' }}>
                    <input
                      type="file"
                      ref={pdfFileInputRef}
                      accept="application/pdf"
                      onChange={handlePdfFileChange}
                      disabled={isExtractingSignature}
                      style={{ 
                        padding: '10px', 
                        border: '2px dashed #007bff', 
                        borderRadius: '4px', 
                        width: '100%', 
                        maxWidth: '600px',
                        backgroundColor: '#fff',
                        cursor: 'pointer'
                      }}
                    />
                  </div>
                  
                  {isExtractingSignature && (
                    <p style={{ color: '#007bff', fontSize: '14px' }}>
                      Extracting signature from PDF...
                    </p>
                  )}

                  {/* PDF Signature Preview */}
                  {pdfSignaturePreview && !isExtractingSignature && (
                    <div style={{ marginTop: '10px', padding: '10px', backgroundColor: '#f8f9fa', borderRadius: '4px' }}>
                      <p style={{ margin: '0 0 10px 0', fontSize: '13px', fontWeight: 'bold', color: '#28a745' }}>
                        ✓ Signature extracted successfully:
                      </p>
                      <img
                        src={pdfSignaturePreview}
                        alt="Extracted Signature"
                        style={{ maxWidth: '300px', maxHeight: '100px', border: '1px solid #ccc', borderRadius: '4px', backgroundColor: '#fff' }}
                      />
                      <div style={{ marginTop: '10px' }}>
                        <button type="button" onClick={clearPdfSignature} className={`${styles.button} ${styles.clearButton}`}>
                          Remove & Upload Different PDF
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
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
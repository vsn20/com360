'use client';

import React, { useState, useEffect, useRef } from 'react';
import { fetchEmployeeById } from '@/app/serverActions/Employee/overview';
import {
  getW4FormDetails,
  saveW4Form,
  submitW4Form,
} from '@/app/serverActions/forms/w4form/action';
import SignatureCanvas from 'react-signature-canvas';
import styles from '../W9Form/W9Forms.module.css'; // Reusing W9Form styles

const formatDate = (date) => {
  if (!date || isNaN(new Date(date))) return 'N/A';
  const d = new Date(date);
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${month}/${day}/${d.getFullYear()}`;
};

const W4Form = ({ empid, orgid, onBack, states, isAdding, selectedFormId, onError, onSuccess }) => {
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    ssn: '',
    address_street: '',
    city: '',
    state: '',
    zip_code: '',
    filing_status: 'SINGLE',
    multiple_jobs_checked: false,
    qualifying_children_count: 0,
    other_dependents_count: 0,
    other_credits_amount: 0,
    other_income: 0,
    deductions: 0,
    extra_withholding: 0,
    signature_date: new Date().toISOString().split('T')[0],
  });

  const [totalCredits, setTotalCredits] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [existingForm, setExistingForm] = useState(null);
  const [currentFormId, setCurrentFormId] = useState(null);
  const [formattedSsn, setFormattedSsn] = useState('');
  const sigCanvas = useRef(null);
  const [timestamp, setTimestamp] = useState(Date.now()); // Used for cache-busting images
  
  // Signature type state (canvas or pdf)
  const pdfFileInputRef = useRef(null);
  const [signatureType, setSignatureType] = useState('canvas');
  const [pdfSignatureFile, setPdfSignatureFile] = useState(null);
  const [pdfSignaturePreview, setPdfSignaturePreview] = useState(null);
  const [isExtractingSignature, setIsExtractingSignature] = useState(false);

  // --- Data Loading Effect ---
  useEffect(() => {
    const loadData = async () => {
      onError(null);
      try {
        const employee = await fetchEmployeeById(empid);

        if (isAdding) {
          // --- ADDING NEW FORM ---
          setExistingForm(null);
          setCurrentFormId(null);
          const ssn = employee.SSN ? formatSsn(employee.SSN) : '';

          const foundStateValue = Array.isArray(states)
            ? states.find(s => String(s.ID) === String(employee.HOME_STATE_ID))?.VALUE
            : undefined;

          const stateToSet = foundStateValue || employee.HOME_STATE_NAME_CUSTOM || '';

          setFormData({
            first_name: employee.EMP_FST_NAME || '',
            last_name: employee.EMP_LAST_NAME || '',
            ssn: employee.SSN || '',
            address_street: `${employee.HOME_ADDR_LINE1 || ''}${employee.HOME_ADDR_LINE2 ? ' ' + employee.HOME_ADDR_LINE2 : ''}`.trim(),
            city: employee.HOME_CITY || '',
            state: stateToSet, 
            zip_code: employee.HOME_POSTAL_CODE || '',
            filing_status: 'SINGLE',
            multiple_jobs_checked: false,
            qualifying_children_count: 0,
            other_dependents_count: 0,
            other_credits_amount: 0,
            other_income: 0,
            deductions: 0,
            extra_withholding: 0,
            signature_date: new Date().toISOString().split('T')[0],
          });
          setFormattedSsn(ssn);

        } else if (selectedFormId) {
          // --- EDITING/VIEWING EXISTING FORM ---
          const formId = selectedFormId.replace('W4-', '');
          const w4Form = await getW4FormDetails(formId);
          setExistingForm(w4Form);
          setCurrentFormId(w4Form.ID);

          const streetAddress = `${w4Form.ADDRESS_STREET || ''}${w4Form.ADDRESS_STREET_2 ? ' ' + w4Form.ADDRESS_STREET_2 : ''}`.trim();
          const addressParts = w4Form.ADDRESS_CITY_STATE_ZIP
            ? w4Form.ADDRESS_CITY_STATE_ZIP.match(/(.*),\s*(\w{2})\s*(\d{5})?$/)
            : null;
          const stateFromAddress = addressParts ? addressParts[2] : '';

          const qualifying_children_count = (w4Form.QUALIFYING_CHILDREN_AMOUNT || 0) / 2000;
          const other_dependents_count = (w4Form.OTHER_DEPENDENTS_AMOUNT || 0) / 500;

          setFormData({
            first_name: w4Form.FIRST_NAME || '',
            last_name: w4Form.LAST_NAME || '',
            ssn: w4Form.SSN || '',
            address_street: streetAddress,
            city: addressParts ? addressParts[1] : '',
            state: stateFromAddress,
            zip_code: addressParts ? addressParts[3] : '',
            filing_status: w4Form.FILING_STATUS || 'SINGLE',
            multiple_jobs_checked: !!w4Form.MULTIPLE_JOBS_CHECKED,
            qualifying_children_count: qualifying_children_count,
            other_dependents_count: other_dependents_count,
            other_credits_amount: w4Form.OTHER_CREDITS_AMOUNT || 0,
            other_income: w4Form.OTHER_INCOME || 0,
            deductions: w4Form.DEDUCTIONS || 0,
            extra_withholding: w4Form.EXTRA_WITHHOLDING || 0,
            signature_date: w4Form.EMPLOYEE_SIGNATURE_DATE
              ? new Date(w4Form.EMPLOYEE_SIGNATURE_DATE).toISOString().split('T')[0]
              : new Date().toISOString().split('T')[0],
          });
          setFormattedSsn(formatSsn(w4Form.SSN));
        }
      } catch (err) {
        onError('Failed to load W-4 form data: ' + err.message);
        console.error(err);
      }
    };
    loadData();
  }, [empid, orgid, isAdding, selectedFormId, states, onError]);

  // --- Total Credits Calculation Effect ---
  useEffect(() => {
    const childrenAmount = Number(formData.qualifying_children_count || 0) * 2000;
    const otherAmount = Number(formData.other_dependents_count || 0) * 500;
    const creditsAmount = Number(formData.other_credits_amount || 0);
    setTotalCredits(childrenAmount + otherAmount + creditsAmount);
  }, [formData.qualifying_children_count, formData.other_dependents_count, formData.other_credits_amount]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;

    if (
      ['qualifying_children_count', 'other_dependents_count', 'other_credits_amount', 'other_income', 'deductions', 'extra_withholding'].includes(name)
    ) {
      const numValue = value === '' ? '' : parseFloat(value);
      setFormData((prev) => ({ ...prev, [name]: (typeof numValue === 'number' && numValue < 0) ? 0 : numValue }));
    } else {
      setFormData((prev) => ({
        ...prev,
        [name]: type === 'checkbox' ? checked : value,
      }));
    }
  };


  const formatSsn = (value) => {
    if (!value) return '';
    const digits = value.replace(/\D/g, '');
    if (digits.length <= 3) return digits;
    if (digits.length <= 5) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
    return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5, 9)}`;
  };

  const handleSsnChange = (e) => {
    const formatted = formatSsn(e.target.value);
    setFormattedSsn(formatted);
    setFormData((prev) => ({ ...prev, ssn: e.target.value.replace(/\D/g, '').slice(0, 9) }));
  };

  const clearSignature = () => sigCanvas.current?.clear();

  // Handle signature type change (canvas or pdf)
  const handleSignatureTypeChange = (e) => {
    const newType = e.target.value;
    setSignatureType(newType);
    if (newType === 'canvas') {
      setPdfSignatureFile(null);
      setPdfSignaturePreview(null);
      if (pdfFileInputRef.current) {
        pdfFileInputRef.current.value = '';
      }
    } else {
      if (sigCanvas.current) {
        sigCanvas.current.clear();
      }
    }
  };

  // Handle PDF file selection and extract signature using client-side rendering
  const handlePdfFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) {
      setPdfSignatureFile(null);
      setPdfSignaturePreview(null);
      return;
    }

    if (file.type !== 'application/pdf') {
      onError('Please upload a valid PDF file.');
      e.target.value = '';
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      onError('PDF file size must be less than 5MB.');
      e.target.value = '';
      return;
    }

    onError(null);
    setPdfSignatureFile(file);
    setIsExtractingSignature(true);

    try {
      // FIX: Use explicit min.mjs path to avoid "Object.defineProperty" Webpack error
      const pdfjsModule = await import('pdfjs-dist/build/pdf.min.mjs');
      const pdfjsLib = pdfjsModule.default || pdfjsModule;

      if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
          pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
      }

      const arrayBuffer = await file.arrayBuffer();
      const header = new Uint8Array(arrayBuffer.slice(0, 5));
      const headerStr = String.fromCharCode(...header);
      
      if (headerStr !== '%PDF-') {
        throw new Error('File does not have valid PDF header.');
      }
      
      const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
      const pdfDoc = await loadingTask.promise;
      const page = await pdfDoc.getPage(1);
      
      const scale = 2;
      const viewport = page.getViewport({ scale });
      
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      
      await page.render({
        canvasContext: context,
        viewport: viewport,
      }).promise;
      
      const signatureDataUrl = canvas.toDataURL('image/png');
      setPdfSignaturePreview(signatureDataUrl);
      onError(null);
      
    } catch (err) {
      console.error('PDF extraction error:', err);
      onError('Failed to process PDF file: ' + (err.message || 'Unknown error'));
      setPdfSignatureFile(null);
      setPdfSignaturePreview(null);
      if (pdfFileInputRef.current) {
        pdfFileInputRef.current.value = '';
      }
    } finally {
      setIsExtractingSignature(false);
    }
  };

  // Clear PDF signature
  const clearPdfSignature = () => {
    setPdfSignatureFile(null);
    setPdfSignaturePreview(null);
    if (pdfFileInputRef.current) {
      pdfFileInputRef.current.value = '';
    }
  };

  const sanitizeNumericFields = (data) => {
      const numericFields = ['qualifying_children_count', 'other_dependents_count', 'other_credits_amount', 'other_income', 'deductions', 'extra_withholding'];
      const sanitizedData = { ...data };
      numericFields.forEach(field => {
          const value = parseFloat(sanitizedData[field]);
          sanitizedData[field] = isNaN(value) ? 0 : value;
      });
      return sanitizedData;
  };

  const getPayload = () => {
    const sanitizedFormData = sanitizeNumericFields(formData);

    let signatureData = null;
    if (signatureType === 'canvas') {
      signatureData = sigCanvas.current?.isEmpty() ? null : sigCanvas.current.toDataURL('image/png');
    } else if (signatureType === 'pdf') {
      signatureData = pdfSignaturePreview;
    }

    return {
      ...sanitizedFormData,
      address_city_state_zip: `${sanitizedFormData.city}, ${sanitizedFormData.state} ${sanitizedFormData.zip_code}`.trim(),
      total_credits: totalCredits,
      orgid,
      emp_id: empid,
      signature_data: signatureData,
    };
  };

  const handleSaveDraft = async () => {
    onError(null);
    onSuccess('');
    setIsSaving(true);

    try {
      const payload = getPayload();
      const result = await saveW4Form(payload, currentFormId);
      if (result.success) {
        onSuccess(result.message);
        if (!currentFormId) {
          setCurrentFormId(result.id);
        }
      } else {
        throw new Error(result.error);
      }
    } catch (err) {
      onError(err.message || 'Failed to save W-4 draft.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSubmit = async () => {
    onError(null);
    onSuccess('');
    setIsSaving(true);

    try {
      if (signatureType === 'canvas') {
        if (sigCanvas.current?.isEmpty()) {
          throw new Error('Signature is required to submit the form.');
        }
      } else if (signatureType === 'pdf') {
        if (!pdfSignaturePreview) {
          throw new Error('Please upload a PDF signature file.');
        }
      }

      const payload = getPayload();

      const result = await submitW4Form(payload, currentFormId);
      if (result.success) {
        onSuccess(result.message);
        setTimeout(onBack, 2000);
      } else {
        throw new Error(result.error);
      }
    } catch (err) {
      onError(err.message || 'Failed to submit W-4 form.');
    } finally {
      setIsSaving(false);
    }
  };

  const isSubmitted = existingForm?.FORM_STATUS === 'SUBMITTED' || existingForm?.FORM_STATUS === 'VERIFIED';

  const displayNumericValue = (value) => {
      const num = parseFloat(value);
      if (value === '' || value == null || isNaN(num) || num === 0) {
          return '';
      }
      return value;
  };

  return (
    <div className={styles.w9FormContainer}> {/* Reusing W9 styles */}
      <div className={styles.headerSection}>
        <h2 className={styles.title}>
          {isAdding ? 'Add W-4 Form' : isSubmitted ? 'View W-4 Form' : 'Edit W-4 Form'}
        </h2>
        <button className={`${styles.button} ${styles.buttonBack}`} onClick={onBack}>
          Back to Forms List
        </button>
      </div>

      {/* --- Step 1: Personal Information --- */}
      <div className={styles.formSection}>
        <h3>Step 1: Personal Information</h3>
        <div className={styles.formRow}>
          <div className={styles.formGroup}>
            <label>First Name*</label>
            <input name="first_name" value={formData.first_name ?? ''} onChange={handleChange} required disabled={isSubmitted} />
          </div>
          <div className={styles.formGroup}>
            <label>Last Name*</label>
            <input name="last_name" value={formData.last_name ?? ''} onChange={handleChange} required disabled={isSubmitted} />
          </div>
        </div>

        <div className={styles.formRow}>
          <div className={styles.formGroup}>
            <label>Address (Street)*</label>
            <input name="address_street" value={formData.address_street ?? ''} onChange={handleChange} required disabled={isSubmitted} />
          </div>
          <div className={styles.formGroup}>
            <label>Social Security Number*</label>
            <input name="ssn" value={formattedSsn} onChange={handleSsnChange} required disabled={isSubmitted} maxLength="11"/>
          </div>
        </div>

        <div className={styles.formRow}>
          <div className={styles.formGroup}>
            <label>City*</label>
            <input name="city" value={formData.city ?? ''} onChange={handleChange} required disabled={isSubmitted} />
          </div>
          <div className={styles.formGroup}>
            <label>State*</label>
            <select name="state" value={formData.state ?? ''} onChange={handleChange} required disabled={isSubmitted}>
              <option value="">Select State</option>
              {Array.isArray(states) && states.map((state) => (
                <option key={state.ID} value={state.VALUE}>{state.VALUE}</option>
              ))}
            </select>
          </div>
          <div className={styles.formGroup}>
            <label>ZIP Code*</label>
            <input name="zip_code" value={formData.zip_code ?? ''} onChange={handleChange} required disabled={isSubmitted} />
          </div>
        </div>

        <div className={styles.formRow}>
          <div className={styles.formGroup}>
            <label>Filing Status*</label>
            <select name="filing_status" value={formData.filing_status ?? 'SINGLE'} onChange={handleChange} required disabled={isSubmitted}>
              <option value="SINGLE">Single or Married filing separately</option>
              <option value="MARRIED_JOINTLY">Married filing jointly</option>
              <option value="HEAD_OF_HOUSEHOLD">Head of household</option>
            </select>
          </div>
        </div>
      </div>

      {/* --- Step 2: Multiple Jobs --- */}
      <div className={styles.formSection}>
        <h3>Step 2: Multiple Jobs or Spouse Works</h3>
        <div className={styles.formGroup}>
          <label>
            <input
              type="checkbox"
              name="multiple_jobs_checked"
              checked={!!formData.multiple_jobs_checked} 
              onChange={handleChange}
              disabled={isSubmitted}
              className={styles.formCheckbox}
            />
            Check this box if you hold more than one job at a time or are married filing jointly and your spouse also works. (Use estimator at www.irs.gov/W4App or Multiple Jobs Worksheet).
          </label>
        </div>
      </div>

      {/* --- Step 3: Claim Dependents --- */}
      <div className={styles.formSection}>
        <h3>Step 3: Claim Dependents</h3>
        <p>(If your total income will be \$200,000 or less (\$400,000 or less if married filing jointly))</p>
        <div className={styles.formRow}>
          <div className={styles.formGroup}>
            <label>Qualifying Children under age 17</label>
            <input type="number" name="qualifying_children_count" value={displayNumericValue(formData.qualifying_children_count)} onChange={handleChange} min="0" disabled={isSubmitted} placeholder="0"/>
            <span>Multiply by \$2,000 = \$ {(Number(formData.qualifying_children_count || 0) * 2000).toFixed(0)}</span>
          </div>
          <div className={styles.formGroup}>
            <label>Other Dependents</label>
            <input type="number" name="other_dependents_count" value={displayNumericValue(formData.other_dependents_count)} onChange={handleChange} min="0" disabled={isSubmitted} placeholder="0"/>
            <span>Multiply by \$500 = \$ {(Number(formData.other_dependents_count || 0) * 500).toFixed(0)}</span>
          </div>
        </div>
         <div className={styles.formRow}>
             <div className={styles.formGroup}>
                 <label>Other Credits (e.g., education)</label>
                 <input type="number" name="other_credits_amount" value={displayNumericValue(formData.other_credits_amount)} onChange={handleChange} min="0" step="0.01" disabled={isSubmitted} placeholder="0.00"/>
             </div>
            <div className={`${styles.formGroup} ${styles.totalCreditsGroup}`}>
                <label style={{ fontWeight: 'bold' }}>Total Credits (Add lines above)</label>
                <input value={`\$${totalCredits.toFixed(2)}`} readOnly disabled className={styles.totalField} />
            </div>
         </div>
      </div>

      {/* --- Step 4: Other Adjustments --- */}
      <div className={styles.formSection}>
        <h3>Step 4 (Optional): Other Adjustments</h3>
        <div className={styles.formRow}>
          <div className={styles.formGroup}>
            <label>(a) Other Income (not from jobs)</label>
            <input type="number" name="other_income" value={displayNumericValue(formData.other_income)} onChange={handleChange} min="0" step="0.01" disabled={isSubmitted} placeholder="0.00"/>
          </div>
          <div className={styles.formGroup}>
            <label>(b) Deductions</label>
            <input type="number" name="deductions" value={displayNumericValue(formData.deductions)} onChange={handleChange} min="0" step="0.01" disabled={isSubmitted} placeholder="0.00"/>
          </div>
          <div className={styles.formGroup}>
            <label>(c) Extra Withholding</label>
            <input type="number" name="extra_withholding" value={displayNumericValue(formData.extra_withholding)} onChange={handleChange} min="0" step="0.01" disabled={isSubmitted} placeholder="0.00"/>
          </div>
        </div>
      </div>

      {/* --- Step 5: Signature --- */}
      <div className={styles.formSection}>
        <h3>Step 5: Sign Here</h3>
        <p>Under penalties of perjury, I declare that this certificate, to the best of my knowledge and belief, is true, correct, and complete.</p>
        {isSubmitted ? (
          existingForm?.EMPLOYEE_SIGNATURE_URL && (
            <div className={styles.formGroup}>
              <label>Employee Signature</label>
              <div className={styles.signatureDisplay}>
                <img 
                  src={`${existingForm.EMPLOYEE_SIGNATURE_URL}?t=${timestamp}`} 
                  alt="Employee Signature" 
                  style={{ maxWidth: '300px', border: '1px solid #ccc', borderRadius: '4px' }}
                />
              </div>
              <p>Date Signed: {formatDate(existingForm.EMPLOYEE_SIGNATURE_DATE)}</p>
            </div>
          )
        ) : (
          <>
            <div className={styles.formRow}>
              <div className={styles.formGroup}>
                  <label>Signature Date</label>
                  <input type="date" name="signature_date" value={formData.signature_date} onChange={handleChange} disabled={isSubmitted} />
              </div>
            </div>
            
            {/* Signature Type Selection */}
            <div style={{ marginBottom: '15px', padding: '10px', backgroundColor: '#f8f9fa', borderRadius: '4px' }}>
              <p style={{ margin: '0 0 10px 0', fontSize: '14px', fontWeight: '500' }}>
                Choose signature method:
              </p>
              <div style={{ display: 'flex', gap: '20px' }}>
                <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="w4SignatureType"
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
                    name="w4SignatureType"
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
              <div className={styles.formGroup}>
                <label>Employee Signature*</label>
                <p style={{ fontSize: '13px', color: '#666', marginBottom: '10px' }}>
                  Please sign below using your mouse or touchscreen.
                </p>
                <div className={styles.signatureCanvasWrapper}>
                  <SignatureCanvas ref={sigCanvas} canvasProps={{ className: styles.signatureCanvas }} />
                </div>
                <button type="button" onClick={clearSignature} className={`${styles.button} ${styles.clearButton}`}>Clear Signature</button>
              </div>
            )}

            {/* PDF Upload Option */}
            {signatureType === 'pdf' && (
              <div className={styles.formGroup}>
                <label>Upload Signature PDF*</label>
                <p style={{ fontSize: '13px', color: '#666', marginBottom: '10px' }}>
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
              </div>
            )}
          </>
        )}
      </div>

      {!isSubmitted && (
        <div className={styles.formButtons}>
          <button onClick={handleSaveDraft} className={`${styles.button} ${styles.buttonSave}`} disabled={isSaving}>{isSaving ? 'Saving...' : 'Save Draft'}</button>
          <button onClick={handleSubmit} className={`${styles.button} ${styles.buttonSubmit}`} disabled={isSaving}>{isSaving ? 'Submitting...' : 'Sign and Submit'}</button>
        </div>
      )}
    </div>
  );
};

export default W4Form;
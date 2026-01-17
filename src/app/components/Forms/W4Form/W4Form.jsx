'use client';

import React, { useState, useEffect, useRef } from 'react';
import { fetchEmployeeById } from '@/app/serverActions/Employee/overview';
import {
  getW4FormDetails,
  saveW4Form,
  submitW4Form,
} from '@/app/serverActions/forms/w4form/action';
import SignatureCanvas from 'react-signature-canvas';
import styles from '../W9Form/W9Forms.module.css';

// --- DATE UTILITIES (MATCHING I-983 LOGIC) ---

// Get today's date in local timezone YYYY-MM-DD
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

// Helper function to format dates for display (MM/DD/YYYY)
const formatDateDisplay = (dateStr) => {
    if (!dateStr) return 'N/A';
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
                const yearNum = parseInt(year);
                if (yearNum < 1900 || yearNum > 2100) return 'Invalid Date';
                return `${String(month).padStart(2, '0')}/${String(day).padStart(2, '0')}/${year}`;
            }
        }
        
        // Fallback for Date objects
        const d = new Date(dateStr);
        year = d.getFullYear();
        month = String(d.getMonth() + 1).padStart(2, '0');
        day = String(d.getDate()).padStart(2, '0');
        
        if (year < 1900 || year > 2100) return 'Invalid Date';
        return `${month}/${day}/${year}`;
    } catch (e) { return 'Invalid Date'; }
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
    signature_date: getLocalTodayDate(),
  });

  const [totalCredits, setTotalCredits] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [existingForm, setExistingForm] = useState(null);
  const [currentFormId, setCurrentFormId] = useState(null);
  const [formattedSsn, setFormattedSsn] = useState('');
  const sigCanvas = useRef(null);
  const [timestamp, setTimestamp] = useState(Date.now());
  
  // Signature type state (canvas or image)
  const imageFileInputRef = useRef(null);
  const [signatureType, setSignatureType] = useState('canvas');
  const [imageSignatureFile, setImageSignatureFile] = useState(null);
  const [imageSignaturePreview, setImageSignaturePreview] = useState(null);

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
            signature_date: getLocalTodayDate(),
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
            signature_date: formatDateForInput(w4Form.EMPLOYEE_SIGNATURE_DATE) || getLocalTodayDate(),
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

  // Handle signature type change (canvas or image)
  const handleSignatureTypeChange = (e) => {
    const newType = e.target.value;
    setSignatureType(newType);
    if (newType === 'canvas') {
      setImageSignatureFile(null);
      setImageSignaturePreview(null);
      if (imageFileInputRef.current) {
        imageFileInputRef.current.value = '';
      }
    } else {
      if (sigCanvas.current) {
        sigCanvas.current.clear();
      }
    }
  };

  // --- Image Upload Handler (Matching I-983) ---
  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) {
      setImageSignatureFile(null);
      setImageSignaturePreview(null);
      return;
    }

    // Validate types
    const validTypes = ['image/png', 'image/jpeg', 'image/jpg'];
    if (!validTypes.includes(file.type)) {
      onError('Please upload a PNG, JPG, or JPEG image file.');
      if (imageFileInputRef.current) imageFileInputRef.current.value = '';
      return;
    }

    // Validate size (2MB)
    const maxSize = 2 * 1024 * 1024; // 2MB
    if (file.size > maxSize) {
      onError(`Image size must be less than 2MB. Your file is ${(file.size / 1024 / 1024).toFixed(2)}MB`);
      if (imageFileInputRef.current) imageFileInputRef.current.value = '';
      return;
    }

    setImageSignatureFile(file);
    const reader = new FileReader();
    reader.onload = (event) => {
      setImageSignaturePreview(event.target.result);
    };
    reader.readAsDataURL(file);
  };

  // Clear image signature
  const clearImageSignature = () => {
    setImageSignatureFile(null);
    setImageSignaturePreview(null);
    if (imageFileInputRef.current) {
      imageFileInputRef.current.value = '';
    }
  };

  // Get signature data based on type
  const getSignatureData = () => {
    if (signatureType === 'canvas') {
      if (sigCanvas.current && !sigCanvas.current.isEmpty()) {
        return sigCanvas.current.toDataURL('image/png');
      }
      return null;
    } else if (signatureType === 'image' && imageSignaturePreview) {
      if (imageSignaturePreview.startsWith('data:image/')) {
        return imageSignaturePreview;
      }
    }
    return null;
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
    const signatureData = getSignatureData();

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
        // Clear image preview on successful save
        if (signatureType === 'image' && imageSignaturePreview) {
          clearImageSignature();
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
      const signatureData = getSignatureData();
      if (!signatureData) {
        throw new Error('Signature is required to submit the form.');
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
    <div className={styles.w9FormContainer}>
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
            {' '}Check this box if you hold more than one job at a time or are married filing jointly and your spouse also works. (Use estimator at www.irs.gov/W4App or Multiple Jobs Worksheet).
          </label>
        </div>
      </div>

      {/* --- Step 3: Claim Dependents --- */}
      <div className={styles.formSection}>
        <h3>Step 3: Claim Dependents</h3>
        <p>(If your total income will be $200,000 or less ($400,000 or less if married filing jointly))</p>
        <div className={styles.formRow}>
          <div className={styles.formGroup}>
            <label>Qualifying Children under age 17</label>
            <input type="number" name="qualifying_children_count" value={displayNumericValue(formData.qualifying_children_count)} onChange={handleChange} min="0" disabled={isSubmitted} placeholder="0"/>
            <span>Multiply by $2,000 = $ {(Number(formData.qualifying_children_count || 0) * 2000).toFixed(0)}</span>
          </div>
          <div className={styles.formGroup}>
            <label>Other Dependents</label>
            <input type="number" name="other_dependents_count" value={displayNumericValue(formData.other_dependents_count)} onChange={handleChange} min="0" disabled={isSubmitted} placeholder="0"/>
            <span>Multiply by $500 = $ {(Number(formData.other_dependents_count || 0) * 500).toFixed(0)}</span>
          </div>
        </div>
        <div className={styles.formRow}>
          <div className={styles.formGroup}>
            <label>Other Credits (e.g., education)</label>
            <input type="number" name="other_credits_amount" value={displayNumericValue(formData.other_credits_amount)} onChange={handleChange} min="0" step="0.01" disabled={isSubmitted} placeholder="0.00"/>
          </div>
          <div className={`${styles.formGroup} ${styles.totalCreditsGroup}`}>
            <label style={{ fontWeight: 'bold' }}>Total Credits (Add lines above)</label>
            <input value={`$${totalCredits.toFixed(2)}`} readOnly disabled className={styles.totalField} />
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
              <p>Date Signed: {formatDateDisplay(existingForm.EMPLOYEE_SIGNATURE_DATE)}</p>
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

            {/* Image Upload Option */}
            {signatureType === 'image' && (
              <div className={styles.formGroup}>
                <label>Upload Signature Image*</label>
                <p style={{ fontSize: '13px', color: '#666', marginBottom: '10px' }}>
                  Upload a PNG, JPG, or JPEG image (Max 2MB).
                </p>
                <div style={{ marginBottom: '10px' }}>
                  <input
                    type="file"
                    ref={imageFileInputRef}
                    accept="image/png,image/jpeg,image/jpg"
                    onChange={handleImageUpload}
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

                {/* Image Signature Preview */}
                {imageSignaturePreview && (
                  <div style={{ marginTop: '10px', padding: '10px', backgroundColor: '#f8f9fa', borderRadius: '4px' }}>
                    <p style={{ margin: '0 0 10px 0', fontSize: '13px', fontWeight: 'bold', color: '#28a745' }}>
                      ✓ Signature preview:
                    </p>
                    <img
                      src={imageSignaturePreview}
                      alt="Signature Preview"
                      style={{ maxWidth: '300px', maxHeight: '100px', border: '1px solid #ccc', borderRadius: '4px', backgroundColor: '#fff' }}
                    />
                    <div style={{ marginTop: '10px' }}>
                      <button type="button" onClick={clearImageSignature} className={`${styles.button} ${styles.clearButton}`}>
                        Remove & Upload Different Image
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
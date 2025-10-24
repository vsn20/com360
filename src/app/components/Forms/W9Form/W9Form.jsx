'use client';

import React, { useState, useEffect, useRef } from 'react';
import { fetchEmployeeById } from '@/app/serverActions/Employee/overview';
import { 
    getW9FormDetails, 
    saveW9Form, 
    submitW9Form 
} from '@/app/serverActions/forms/w9form/action';
import SignatureCanvas from 'react-signature-canvas';
import styles from './W9Forms.module.css';

const W9Form = ({ empid, orgid, onBack, states, isAdding, selectedFormId, onError, onSuccess }) => {
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    business_name: '',
    tax_classification: 'INDIVIDUAL',
    llc_classification_code: '',
    exempt_payee_code: '',
    exemption_from_fatca_code: '',
    address_street: '',
    city: '',
    state: '',
    zip_code: '',
    taxpayer_identification_number: '',
    signature_date: new Date().toISOString().split('T')[0],
  });
  const [isSaving, setIsSaving] = useState(false);
  const [existingForm, setExistingForm] = useState(null);
  const [currentFormId, setCurrentFormId] = useState(null);
  const [formattedTin, setFormattedTin] = useState('');
  const sigCanvas = useRef(null);

  useEffect(() => {
    const loadData = async () => {
      onError(null);
      try {
        const employee = await fetchEmployeeById(empid);
        
        if (isAdding) {
          // --- ADDING NEW FORM ---
          setExistingForm(null);
          setCurrentFormId(null);
          const ssn = employee.SSN ? formatTin(employee.SSN, 'INDIVIDUAL') : '';
          setFormData({
            first_name: employee.EMP_FST_NAME || '',
            last_name: employee.EMP_LAST_NAME || '',
            business_name: '',
            tax_classification: 'INDIVIDUAL',
            llc_classification_code: '',
            exempt_payee_code: '',
            exemption_from_fatca_code: '',
            address_street: employee.HOME_ADDR_LINE1 || '',
            city: employee.HOME_CITY || '',
            state: states.find(s => String(s.ID) === String(employee.HOME_STATE_ID))?.VALUE || employee.HOME_STATE_NAME_CUSTOM || '',
            zip_code: employee.HOME_POSTAL_CODE || '',
            taxpayer_identification_number:'',
            signature_date: new Date().toISOString().split('T')[0],
          });
          setFormattedTin(ssn);

        } else if (selectedFormId) {
          // --- EDITING/VIEWING EXISTING FORM ---
          const formId = selectedFormId.replace('W9-', '');
          const w9Form = await getW9FormDetails(formId);
          setExistingForm(w9Form);
          setCurrentFormId(w9Form.ID);

          // Split name and address for the form fields
          const nameParts = w9Form.NAME ? w9Form.NAME.split(' ') : ['', ''];
          const first_name = nameParts.slice(0, -1).join(' ');
          const last_name = nameParts.length > 1 ? nameParts.slice(-1)[0] : w9Form.NAME;
          
          const addressParts = w9Form.ADDRESS_CITY_STATE_ZIP ? w9Form.ADDRESS_CITY_STATE_ZIP.match(/(.*),\s*(\w{2})\s*(\d{5})?$/) : null;

          setFormData({
              first_name: first_name,
              last_name: last_name,
              business_name: w9Form.BUSINESS_NAME || '',
              tax_classification: w9Form.TAX_CLASSIFICATION || 'INDIVIDUAL',
              llc_classification_code: w9Form.LLC_CLASSIFICATION_CODE || '',
              exempt_payee_code: w9Form.EXEMPT_PAYEE_CODE || '',
              exemption_from_fatca_code: w9Form.EXEMPTION_FROM_FATCA_CODE || '',
              address_street: w9Form.ADDRESS_STREET || '',
              city: addressParts ? addressParts[1] : '',
              state: addressParts ? addressParts[2] : '',
              zip_code: addressParts ? addressParts[3] : '',
              taxpayer_identification_number: w9Form.TAXPAYER_IDENTIFICATION_NUMBER || '',
              signature_date: w9Form.SIGNATURE_DATE ? new Date(w9Form.SIGNATURE_DATE).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
          });
          setFormattedTin(formatTin(w9Form.TAXPAYER_IDENTIFICATION_NUMBER, w9Form.TAX_CLASSIFICATION));
        }
      } catch (err) {
        onError('Failed to load form data: ' + err.message);
        console.error(err);
      }
    };
    loadData();
  }, [empid, orgid, isAdding, selectedFormId, states, onError]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const formatTin = (value, classification) => {
    if (!value) return '';
    const digits = value.replace(/\D/g, '');
    
    if (classification === 'INDIVIDUAL') {
      // SSN: XXX-XX-XXXX
      if (digits.length <= 3) return digits;
      if (digits.length <= 5) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
      return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5, 9)}`;
    } else {
      // EIN: XX-XXXXXXX
      if (digits.length <= 2) return digits;
      return `${digits.slice(0, 2)}-${digits.slice(2, 9)}`;
    }
  };

  const handleTinChange = (e) => {
    const formatted = formatTin(e.target.value, formData.tax_classification);
    setFormattedTin(formatted);
    setFormData(prev => ({ ...prev, taxpayer_identification_number: e.target.value.replace(/\D/g, '') }));
  };

  const clearSignature = () => sigCanvas.current?.clear();

  const handleSaveDraft = async () => {
    onError(null);
    onSuccess('');
    setIsSaving(true);

    try {
        // Combine fields for database
        const payload = {
            ...formData,
            name: `${formData.first_name} ${formData.last_name}`.trim(),
            address_city_state_zip: `${formData.city}, ${formData.state} ${formData.zip_code}`,
            orgid,
            emp_id: empid,
            signature_data: sigCanvas.current?.isEmpty() ? null : sigCanvas.current.toDataURL('image/png'),
        };

        const result = await saveW9Form(payload, currentFormId);
        if (result.success) {
            onSuccess(result.message);
            if (!currentFormId) {
                setCurrentFormId(result.id);
            }
        } else {
            throw new Error(result.error);
        }
    } catch (err) {
      onError(err.message || 'Failed to save draft.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSubmit = async () => {
    onError(null);
    onSuccess('');
    setIsSaving(true);

    try {
        if (sigCanvas.current?.isEmpty()) {
            throw new Error('Signature is required to submit the form.');
        }

        // Combine fields for database
        const payload = {
            ...formData,
            name: `${formData.first_name} ${formData.last_name}`.trim(),
            address_city_state_zip: `${formData.city}, ${formData.state} ${formData.zip_code}`,
            orgid,
            emp_id: empid,
            signature_data: sigCanvas.current.toDataURL('image/png'),
        };

        const result = await submitW9Form(payload, currentFormId);
        if (result.success) {
            onSuccess(result.message);
            setTimeout(onBack, 2000);
        } else {
            throw new Error(result.error);
        }
    } catch (err) {
      onError(err.message || 'Failed to submit form.');
    } finally {
      setIsSaving(false);
    }
  };

  // ✅ Change: 'VERIFIED' status is removed
  const isSubmitted = existingForm?.FORM_STATUS === 'SUBMITTED';

  return (
    <div className={styles.w9FormContainer}>
      <div className={styles.headerSection}>
        <h2 className={styles.title}>
            {isAdding ? 'Add W-9 Form' : (isSubmitted ? 'View W-9 Form' : 'Edit W-9 Form')}
        </h2>
        <button className={`${styles.button} ${styles.buttonBack}`} onClick={onBack}>
            Back to Forms List
        </button>
      </div>

      <div className={styles.formSection}>
        <div className={styles.formRow}>
            <div className={styles.formGroup}><label>1. First Name*</label><input name="first_name" value={formData.first_name ?? ''} onChange={handleChange} required disabled={isSubmitted} /></div>
            <div className={styles.formGroup}><label>Last Name*</label><input name="last_name" value={formData.last_name ?? ''} onChange={handleChange} required disabled={isSubmitted} /></div>
        </div>
        <div className={styles.formRow}>
            <div className={styles.formGroup}><label>2. Business name/disregarded entity name</label><input name="business_name" value={formData.business_name ?? ''} onChange={handleChange} disabled={isSubmitted} /></div>
        </div>
        <div className={styles.formRow}>
            <div className={styles.formGroup}><label>3. Federal tax classification*</label>
                <select name="tax_classification" value={formData.tax_classification ?? 'INDIVIDUAL'} onChange={handleChange} required disabled={isSubmitted}>
                    <option value="INDIVIDUAL">Individual/sole proprietor</option>
                    <option value="C_CORPORATION">C Corporation</option>
                    <option value="S_CORPORATION">S Corporation</option>
                    <option value="PARTNERSHIP">Partnership</option>
                    <option value="TRUST_ESTATE">Trust/estate</option>
                    <option value="LLC">Limited liability company (LLC)</option>
                </select>
            </div>
            {formData.tax_classification === 'LLC' && (
                <div className={styles.formGroup}><label>LLC Classification Code (C, S, or P)</label><input name="llc_classification_code" value={formData.llc_classification_code ?? ''} onChange={handleChange} maxLength="1" disabled={isSubmitted} /></div>
            )}
        </div>
         <div className={styles.formRow}>
            <div className={styles.formGroup}><label>Exempt payee code</label><input name="exempt_payee_code" value={formData.exempt_payee_code ?? ''} onChange={handleChange} disabled={isSubmitted} /></div>
            <div className={styles.formGroup}><label>Exemption from FATCA code</label><input name="exemption_from_fatca_code" value={formData.exemption_from_fatca_code ?? ''} onChange={handleChange} disabled={isSubmitted} /></div>
        </div>
        <div className={styles.formRow}>
            <div className={styles.formGroup}><label>5. Street Address*</label><input name="address_street" value={formData.address_street ?? ''} onChange={handleChange} required disabled={isSubmitted} /></div>
        </div>
        <div className={styles.formRow}>
            <div className={styles.formGroup}><label>6. City*</label><input name="city" value={formData.city ?? ''} onChange={handleChange} required disabled={isSubmitted} /></div>
            <div className={styles.formGroup}><label>State*</label>
                <select name="state" value={formData.state ?? ''} onChange={handleChange} required disabled={isSubmitted}>
                    <option value="">Select State</option>
                    {states.map((state) => (<option key={state.ID} value={state.VALUE}>{state.VALUE}</option>))}
                </select>
            </div>
            <div className={styles.formGroup}><label>ZIP Code*</label><input name="zip_code" value={formData.zip_code ?? ''} onChange={handleChange} required disabled={isSubmitted} /></div>
        </div>
      </div>

      <div className={styles.formSection}>
        <h3>Part I: Taxpayer Identification Number (TIN)</h3>
        <div className={styles.formRow}>
            <div className={styles.formGroup}><label>SSN or EIN*</label><input name="taxpayer_identification_number" value={formattedTin} onChange={handleTinChange} required disabled={isSubmitted} /></div>
        </div>
      </div>

      <div className={styles.formSection}>
        <h3>Part II: Certification</h3>
        {isSubmitted ? (
             existingForm?.SIGNATURE_URL && (
                <div className={styles.formGroup}>
                  <label>Signature</label>
                  <div className={styles.signatureDisplay}><img src={existingForm.SIGNATURE_URL} alt="Signature" /></div>
                </div>
            )
        ) : (
            <div className={styles.formGroup}>
                <label>Signature*</label>
                <div className={styles.signatureCanvasWrapper}>
                    <SignatureCanvas ref={sigCanvas} canvasProps={{ className: styles.signatureCanvas }} />
                </div>
                <button type="button" onClick={clearSignature} className={styles.button}>Clear Signature</button>
            </div>
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

export default W9Form;
// src/app/components/Employee/W4VerificationForm.jsx
'use client';

import React, { useState, useEffect } from 'react';
import { verifyW4Form } from '../../serverActions/forms/w4VerificationActions';
import { fetchEmployeeById } from '../../serverActions/Employee/overview';
import { getW4FormDetails } from '../../serverActions/forms/verification/actions';
import styles from './Verification.module.css';

// --- DATE UTILITIES (MATCHING I-983 LOGIC) ---

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

// Helper function to safely handle null/undefined values
const safeValue = (value, defaultValue = '') => {
  return value ?? defaultValue;
};

// Helper function to safely convert DB decimal (string) to number for calculations/formatting
const safeParseFloat = (value, defaultValue = 0) => {
    if (value === null || typeof value === 'undefined') return defaultValue;
    const num = parseFloat(value);
    return isNaN(num) ? defaultValue : num;
}

const W4VerificationForm = ({ form, verifierEmpId, orgId, orgName, onBack, onSuccess, isAdmin }) => {
  const [employerData, setEmployerData] = useState({
    employer_name_address: orgName || '',
    first_date_of_employment: '',
    employer_ein: '',
  });

  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [timestamp] = useState(Date.now());

  const isVerified = form.FORM_STATUS === 'VERIFIED';
  const canEdit = form.FORM_STATUS === 'SUBMITTED' || (isAdmin && isVerified);

  useEffect(() => {
    const loadEmployerData = async () => {
        try {
            const employee = await fetchEmployeeById(form.EMP_ID);
            const hireDate = formatDateForInput(employee.HIRE) || '';

            const initialEmployerData = {
                employer_name_address: form.EMPLOYER_NAME_ADDRESS || orgName || '',
                first_date_of_employment: formatDateForInput(form.FIRST_DATE_OF_EMPLOYMENT) || hireDate,
                employer_ein: form.EMPLOYER_EIN || '',
            };
            
            if (form.FORM_STATUS === 'SUBMITTED' && !isEditing) {
                initialEmployerData.employer_ein = '';
            }

            setEmployerData(initialEmployerData);

        } catch (err) {
            setError('Failed to load employee hire date: ' + err.message);
            setEmployerData(prev => ({
                ...prev,
                employer_name_address: form.EMPLOYER_NAME_ADDRESS || orgName || '',
                employer_ein: form.EMPLOYER_EIN || '',
                first_date_of_employment: formatDateForInput(form.FIRST_DATE_OF_EMPLOYMENT) || ''
            }));
        }
    };

    loadEmployerData();
  }, [form.ID, form.EMP_ID, form.FORM_STATUS, form.EMPLOYER_NAME_ADDRESS, form.FIRST_DATE_OF_EMPLOYMENT, form.EMPLOYER_EIN, orgName, isEditing, isVerified]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setEmployerData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleVerify = async () => {
    setError(null);
    if (!employerData.employer_name_address) {
        setError("Employer's name and address are required.");
        return;
    }
    if (!employerData.first_date_of_employment) {
        setError('First date of employment is required.');
        return;
    }
    if (!employerData.employer_ein) {
        setError('Employer Identification Number (EIN) is required.');
        return;
    }
    if (!/^\d{2}-?\d{7}$/.test(employerData.employer_ein)) {
         setError('EIN must be in the format XX-XXXXXXX.');
         return;
    }
    
    const formattedEIN = employerData.employer_ein.includes('-')
        ? employerData.employer_ein
        : `${employerData.employer_ein.slice(0, 2)}-${employerData.employer_ein.slice(2)}`;

    setIsSaving(true);
    try {
      const formIdToVerify = parseInt(String(form.ID).replace('W4-', ''));
      const result = await verifyW4Form({
        formId: formIdToVerify,
        verifierId: verifierEmpId,
        orgId: orgId,
        employerData: {
            ...employerData,
            employer_ein: formattedEIN
        },
      });

      if (result.success) {
        onSuccess(result.message || 'W-4 Form successfully verified.');
        setIsEditing(false);
      } else {
        throw new Error(result.error);
      }
    } catch (err) {
      setError(err.message || 'An unexpected error occurred during W-4 verification.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setError(null);
    const hireDate = formatDateForInput(form.HIRE_DATE) || '';
    setEmployerData({
        employer_name_address: form.EMPLOYER_NAME_ADDRESS || orgName || '',
        first_date_of_employment: formatDateForInput(form.FIRST_DATE_OF_EMPLOYMENT) || hireDate,
        employer_ein: form.EMPLOYER_EIN || '',
    });
  };

  const getFilingStatusLabel = (status) => {
    const labels = {
      'SINGLE': 'Single or Married filing separately',
      'MARRIED_JOINTLY': 'Married filing jointly',
      'HEAD_OF_HOUSEHOLD': 'Head of household',
    };
    return labels[status] || 'N/A';
  };

  const isFormDisabled = isVerified && !isEditing;

  return (
    <div className={styles.verificationFormContainer}>
      {error && <div className={styles.errorMessage}><strong>Error:</strong> {error}</div>}

      <div className={styles.headerSection}>
        <h2 className={styles.title}>{isFormDisabled ? 'View Verified W-4' : (isEditing ? 'Re-verify W-4 Form' : 'Verify W-4 Form')}</h2>
        <div className={styles.headerButtons}>
            {isVerified && !isEditing && canEdit && (
                <button
                    className={`${styles.button} ${styles.editButton}`}
                    onClick={() => setIsEditing(true)}
                    disabled={isSaving}
                >
                    Re-verify Form
                </button>
            )}
            <button className={`${styles.button} ${styles.backButton}`} onClick={onBack} disabled={isSaving}>Back to List</button>
        </div>
      </div>

      {/* Section 1: Read-only submitted data */}
      <div className={styles.formSection}>
        <h3>W-4: Submitted by Employee</h3>

        <h4>Step 1: Personal Information</h4>
        <div className={styles.infoGrid}>
          <div className={styles.infoItem}><label>Name:</label><span>{form.FIRST_NAME} {form.LAST_NAME}</span></div>
          <div className={styles.infoItem}><label>SSN:</label><span>{form.SSN ? `***-**-${form.SSN.slice(-4)}` : 'N/A'}</span></div>
          <div className={styles.infoItem}><label>Address:</label><span>{form.ADDRESS_STREET}</span></div>
          <div className={styles.infoItem}><label>City, State, ZIP:</label><span>{form.ADDRESS_CITY_STATE_ZIP}</span></div>
          <div className={styles.infoItem}><label>Filing Status:</label><span>{getFilingStatusLabel(form.FILING_STATUS)}</span></div>
        </div>

        <h4>Step 2-4: Withholding</h4>
         <div className={styles.infoGrid}>
            <div className={styles.infoItem}><label>Step 2 (Multiple Jobs):</label><span>{form.MULTIPLE_JOBS_CHECKED ? 'Checked' : 'Not Checked'}</span></div>
            <div className={styles.infoItem}><label>Step 3 (Total Credits):</label><span>${safeParseFloat(form.TOTAL_CREDITS).toFixed(2)}</span></div>
            <div className={styles.infoItem}><label>Step 4a (Other Income):</label><span>${safeParseFloat(form.OTHER_INCOME).toFixed(2)}</span></div>
            <div className={styles.infoItem}><label>Step 4b (Deductions):</label><span>${safeParseFloat(form.DEDUCTIONS).toFixed(2)}</span></div>
            <div className={styles.infoItem}><label>Step 4c (Extra Withholding):</label><span>${safeParseFloat(form.EXTRA_WITHHOLDING).toFixed(2)}</span></div>
         </div>

        <h4>Step 5: Signature</h4>
        <div className={styles.infoGrid}>
            <div className={styles.infoItem}><label>Submitted Date:</label><span>{formatDateDisplay(form.EMPLOYEE_SIGNATURE_DATE)}</span></div>
        </div>
        {form.EMPLOYEE_SIGNATURE_URL && (
            <div className={`${styles.infoItem} ${styles.infoItemFullWidth}`}>
                <label>Employee Signature:</label>
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

      {/* Section 2: "Employers Only" Section */}
      <div className={styles.formSection}>
        <h3>"Employers Only" Section</h3>

        <form onSubmit={(e) => {e.preventDefault(); handleVerify();}}>
            <div className={styles.formRow}>
              <div className={styles.formGroup}>
                <label>Employer's Name and Address*</label>
                <textarea
                  name="employer_name_address"
                  value={safeValue(employerData.employer_name_address)}
                  onChange={handleChange}
                  required
                  disabled={isFormDisabled}
                  rows="3"
                />
              </div>
            </div>
            <div className={styles.formRow}>
              <div className={styles.formGroup}>
                <label>First Date of Employment*</label>
                <input
                  type="date"
                  name="first_date_of_employment"
                  value={safeValue(employerData.first_date_of_employment)}
                  onChange={handleChange}
                  required
                  disabled={isFormDisabled}
                />
              </div>
              <div className={styles.formGroup}>
                <label>Employer Identification Number (EIN)*</label>
                <input
                  type="text"
                  name="employer_ein"
                  value={safeValue(employerData.employer_ein)}
                  onChange={handleChange}
                  required
                  disabled={isFormDisabled}
                  placeholder="XX-XXXXXXX"
                  pattern="\d{2}-?\d{7}"
                  title="EIN must be in XX-XXXXXXX format"
                  maxLength="10"
                />
              </div>
            </div>

            {!isFormDisabled && (
                <div className={styles.formButtons}>
                <button type="submit" className={`${styles.button} ${styles.saveButton}`} disabled={isSaving}>
                    {isSaving ? 'Verifying...' : (isEditing ? 'Re-verify and Submit' : 'Verify and Submit')}
                </button>
                <button type="button" onClick={isEditing ? handleCancelEdit : onBack} className={`${styles.button} ${styles.cancelButton}`} disabled={isSaving}>
                    {isEditing ? 'Cancel Edit' : 'Cancel'}
                </button>
                </div>
            )}
        </form>

         {isVerified && (
             <div className={styles.infoGrid} style={{marginTop: '20px', borderTop: '1px solid #eee', paddingTop: '20px'}}>
                 <div className={styles.infoItem}><label>Verified By:</label><span>{form.VERIFIER_FIRST_NAME || ''} {form.VERIFIER_LAST_NAME || ''} ({form.VERIFIER_ID || 'N/A'})</span></div>
                 <div className={styles.infoItem}><label>Verification Date:</label><span>{formatDateDisplay(form.VERIFIED_AT)}</span></div>
             </div>
         )}

      </div>
    </div>
  );
};

export default W4VerificationForm;
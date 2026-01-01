// src/app/components/Employee/W4VerificationForm.jsx
'use client';

import React, { useState, useEffect } from 'react';
// Corrected relative import path for server actions
import { verifyW4Form } from '../../serverActions/forms/w4VerificationActions';
// Corrected relative import path for server actions
import { fetchEmployeeById } from '../../serverActions/Employee/overview';
// Corrected relative import path for server actions
import { getW4FormDetails } from '../../serverActions/forms/verification/actions';
// Corrected relative import path for CSS module (assuming it's in the same directory)
import styles from './Verification.module.css';

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
  const [timestamp] = useState(Date.now()); // Used for cache-busting images

  const isVerified = form.FORM_STATUS === 'VERIFIED';
  // Allow editing if submitted or if admin
  const canEdit = form.FORM_STATUS === 'SUBMITTED' || (isAdmin && isVerified);

  useEffect(() => {
    const loadEmployerData = async () => {
        try {
            // Fetch employee details to get their hire date
            const employee = await fetchEmployeeById(form.EMP_ID);
            // Use HIRE_DATE, ensure it's formatted correctly for date input
            const hireDate = employee.HIRE ? new Date(employee.HIRE).toISOString().split('T')[0] : '';

            // Determine initial state based on form status and editing mode
             const initialEmployerData = {
                employer_name_address: form.EMPLOYER_NAME_ADDRESS || orgName || '',
                first_date_of_employment: form.FIRST_DATE_OF_EMPLOYMENT ? new Date(form.FIRST_DATE_OF_EMPLOYMENT).toISOString().split('T')[0] : hireDate,
                employer_ein: form.EMPLOYER_EIN || '',
             };
             // If form is submitted and not verified yet, ensure EIN starts empty unless editing
             if (form.FORM_STATUS === 'SUBMITTED' && !isEditing) {
                 initialEmployerData.employer_ein = ''; // Verifier needs to fill this
             }

             setEmployerData(initialEmployerData);

        } catch (err) {
            setError('Failed to load employee hire date: ' + err.message);
            // Fallback prefill even on error
            setEmployerData(prev => ({
                ...prev,
                employer_name_address: form.EMPLOYER_NAME_ADDRESS || orgName || '',
                employer_ein: form.EMPLOYER_EIN || '',
                first_date_of_employment: form.FIRST_DATE_OF_EMPLOYMENT ? new Date(form.FIRST_DATE_OF_EMPLOYMENT).toISOString().split('T')[0] : ''
            }));
        }
    };

    loadEmployerData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.ID, form.EMP_ID, form.FORM_STATUS, form.EMPLOYER_NAME_ADDRESS, form.FIRST_DATE_OF_EMPLOYMENT, form.EMPLOYER_EIN, orgName, isEditing, isVerified]); // Added form fields to deps


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
    // Basic EIN format check (XX-XXXXXXX)
    if (!/^\d{2}-?\d{7}$/.test(employerData.employer_ein)) { // Allow optional hyphen
         setError('EIN must be in the format XX-XXXXXXX.');
         return;
    }
     // Ensure hyphen is included before saving
     const formattedEIN = employerData.employer_ein.includes('-')
        ? employerData.employer_ein
        : `${employerData.employer_ein.slice(0, 2)}-${employerData.employer_ein.slice(2)}`;


    setIsSaving(true);
    try {
      // Pass the numeric ID
      const formIdToVerify = parseInt(String(form.ID).replace('W4-', ''));
      const result = await verifyW4Form({
        formId: formIdToVerify,
        verifierId: verifierEmpId,
        orgId: orgId,
        employerData: { // Pass data with formatted EIN
            ...employerData,
            employer_ein: formattedEIN
        },
      });

      if (result.success) {
        onSuccess(result.message || 'W-4 Form successfully verified.');
        setIsEditing(false); // Go back to view mode after success
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
    // Reload original *saved* data when canceling edit by re-triggering useEffect
     const hireDate = form.HIRE_DATE ? new Date(form.HIRE_DATE).toISOString().split('T')[0] : ''; // Get hire date from original form prop if needed
     setEmployerData({
        employer_name_address: form.EMPLOYER_NAME_ADDRESS || orgName || '',
        first_date_of_employment: form.FIRST_DATE_OF_EMPLOYMENT ? new Date(form.FIRST_DATE_OF_EMPLOYMENT).toISOString().split('T')[0] : hireDate,
        employer_ein: form.EMPLOYER_EIN || '',
    });
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
        return 'Invalid Date';
    }
    // Adjust for timezone offset to display the correct local date
    const adjustedDate = new Date(date.getTime() + date.getTimezoneOffset() * 60000);
    const month = String(adjustedDate.getMonth() + 1).padStart(2, '0');
    const day = String(adjustedDate.getDate()).padStart(2, '0');
    return `${month}/${day}/${adjustedDate.getFullYear()}`;
  };

  const getFilingStatusLabel = (status) => {
    const labels = {
      'SINGLE': 'Single or Married filing separately',
      'MARRIED_JOINTLY': 'Married filing jointly',
      'HEAD_OF_HOUSEHOLD': 'Head of household',
    };
    return labels[status] || 'N/A';
  };

  // Disable fields if the form is verified AND the user is not currently editing it
  const isFormDisabled = isVerified && !isEditing;

  return (
    <div className={styles.verificationFormContainer}>
      {error && <div className={styles.errorMessage}><strong>Error:</strong> {error}</div>}

      <div className={styles.headerSection}>
        <h2 className={styles.title}>{isFormDisabled ? 'View Verified W-4' : (isEditing ? 'Re-verify W-4 Form' : 'Verify W-4 Form')}</h2>
        <div className={styles.headerButtons}>
            {/* Show Re-verify button only if verified, not editing, and allowed to edit */}
            {isVerified && !isEditing && canEdit && (
                <button
                    className={`${styles.button} ${styles.editButton}`}
                    onClick={() => setIsEditing(true)}
                    disabled={isSaving} // Disable if saving
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
          {/* Mask SSN for display */}
          <div className={styles.infoItem}><label>SSN:</label><span>{form.SSN ? `***-**-${form.SSN.slice(-4)}` : 'N/A'}</span></div>
          <div className={styles.infoItem}><label>Address:</label><span>{form.ADDRESS_STREET}</span></div>
          <div className={styles.infoItem}><label>City, State, ZIP:</label><span>{form.ADDRESS_CITY_STATE_ZIP}</span></div>
          <div className={styles.infoItem}><label>Filing Status:</label><span>{getFilingStatusLabel(form.FILING_STATUS)}</span></div>
        </div>

        <h4>Step 2-4: Withholding</h4>
         <div className={styles.infoGrid}>
            <div className={styles.infoItem}><label>Step 2 (Multiple Jobs):</label><span>{form.MULTIPLE_JOBS_CHECKED ? 'Checked' : 'Not Checked'}</span></div>
            {/* FIX: Convert string decimals to numbers before using toFixed */}
            <div className={styles.infoItem}><label>Step 3 (Total Credits):</label><span>${safeParseFloat(form.TOTAL_CREDITS).toFixed(2)}</span></div>
            <div className={styles.infoItem}><label>Step 4a (Other Income):</label><span>${safeParseFloat(form.OTHER_INCOME).toFixed(2)}</span></div>
            <div className={styles.infoItem}><label>Step 4b (Deductions):</label><span>${safeParseFloat(form.DEDUCTIONS).toFixed(2)}</span></div>
            <div className={styles.infoItem}><label>Step 4c (Extra Withholding):</label><span>${safeParseFloat(form.EXTRA_WITHHOLDING).toFixed(2)}</span></div>
         </div>

        <h4>Step 5: Signature</h4>
        <div className={styles.infoGrid}>
            <div className={styles.infoItem}><label>Submitted Date:</label><span>{formatDate(form.EMPLOYEE_SIGNATURE_DATE)}</span></div>
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

        {/* Use a form only when in verification/editing mode */}
        <form onSubmit={(e) => {e.preventDefault(); handleVerify();}}>
            <div className={styles.formRow}>
              <div className={styles.formGroup}>
                <label>Employer's Name and Address*</label>
                <textarea
                  name="employer_name_address"
                  value={safeValue(employerData.employer_name_address)}
                  onChange={handleChange}
                  required
                  // Disable if verified and not editing
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
                  // Disable if verified and not editing
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
                  // Disable if verified and not editing
                  disabled={isFormDisabled}
                  placeholder="XX-XXXXXXX"
                  pattern="\d{2}-?\d{7}" // Allow optional hyphen during input
                  title="EIN must be in XX-XXXXXXX format"
                  maxLength="10" // Max length with hyphen
                />
              </div>
            </div>

            {/* Show buttons only if NOT (verified AND not editing) */}
            {!isFormDisabled && (
                <div className={styles.formButtons}>
                <button type="submit" className={`${styles.button} ${styles.saveButton}`} disabled={isSaving}>
                    {isSaving ? 'Verifying...' : (isEditing ? 'Re-verify and Submit' : 'Verify and Submit')}
                </button>
                {/* Cancel button action depends on whether editing or initial verification */}
                <button type="button" onClick={isEditing ? handleCancelEdit : onBack} className={`${styles.button} ${styles.cancelButton}`} disabled={isSaving}>
                    {isEditing ? 'Cancel Edit' : 'Cancel'}
                </button>
                </div>
            )}
        </form>

         {/* Display Verifier Info if Verified */}
         {isVerified && (
             <div className={styles.infoGrid} style={{marginTop: '20px', borderTop: '1px solid #eee', paddingTop: '20px'}}>
                 <div className={styles.infoItem}><label>Verified By:</label><span>{form.VERIFIER_FIRST_NAME || ''} {form.VERIFIER_LAST_NAME || ''} ({form.VERIFIER_ID || 'N/A'})</span></div>
                 <div className={styles.infoItem}><label>Verification Date:</label><span>{formatDate(form.VERIFIED_AT)}</span></div>
             </div>
         )}

      </div>
    </div>
  );
};

export default W4VerificationForm;


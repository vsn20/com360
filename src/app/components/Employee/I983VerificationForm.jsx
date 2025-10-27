// src/app/components/Employee/I983VerificationForm.jsx
// @ts-nocheck
'use client';

import React, { useState, useRef, useEffect } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { saveOrUpdateI983Form } from '@/app/serverActions/forms/i983/actions'; // Import server action
import styles from './Verification.module.css'; // Reuse existing verification styles

// Helper function to safely get values
const safeValue = (value, defaultValue = '') => value ?? defaultValue;

// Helper function to format dates for display (MM/DD/YYYY)
const formatDateDisplay = (dateStr) => {
    if (!dateStr) return 'N/A';
    try {
        const date = new Date(dateStr);
        // Use UTC date parts for consistency display
        const year = date.getUTCFullYear();
        const month = String(date.getUTCMonth() + 1).padStart(2, '0');
        const day = String(date.getUTCDate()).padStart(2, '0');
         if (year < 1900 || year > 2100) return 'Invalid Date'; // Basic validation
        return `${month}/${day}/${year}`; // MM/DD/YYYY format
    } catch (e) {
        return 'Invalid Date';
    }
};

// Helper function to format dates for input fields (YYYY-MM-DD)
const formatDateForInput = (dateStr) => {
    if (!dateStr) return '';
    try {
        const date = new Date(dateStr);
        // Use UTC date parts to avoid timezone issues when setting input value
        const year = date.getUTCFullYear();
        const month = String(date.getUTCMonth() + 1).padStart(2, '0');
        const day = String(date.getUTCDate()).padStart(2, '0');
        if (year < 1900 || year > 2100) return '';
        return `${year}-${month}-${day}`;
    } catch (e) {
        return '';
    }
};


const I983VerificationForm = ({
  form, // The full I-983 form data fetched from server
  verifierEmpId, // The ID of the currently logged-in employer/verifier
  orgId,
  orgName,
  onBack,
  onSuccess,
  onError, // Need onError prop
  isAdmin // Prop indicating if the user is an admin
}) => {
     // Log props on render (optional)
     // console.log('I983VerificationForm rendered. Props:', { form: !!form, verifierEmpId, orgId, orgName, isAdmin });

    // State for employer-editable sections
    const [employerData, setEmployerData] = useState({
        // Section 3
        EMPLOYER_NAME: '', EMPLOYER_WEBSITE: '', EMPLOYER_EIN: '',
        EMPLOYER_STREET_ADDRESS: '', EMPLOYER_SUITE: '', EMPLOYER_CITY: '',
        EMPLOYER_STATE: '', EMPLOYER_ZIP: '', EMPLOYER_NUM_FT_EMPLOYEES: '',
        EMPLOYER_NAICS_CODE: '', OPT_HOURS_PER_WEEK: '', START_DATE_OF_EMPLOYMENT: '',
        SALARY_AMOUNT: '', SALARY_FREQUENCY: '',
        OTHER_COMPENSATION_1: '', OTHER_COMPENSATION_2: '',
        OTHER_COMPENSATION_3: '', OTHER_COMPENSATION_4: '',
        // Section 4
        EMPLOYER_OFFICIAL_PRINTED_NAME_TITLE: '', EMPLOYER_PRINTED_NAME_ORG: '',
        EMPLOYER_OFFICIAL_SIGNATURE_DATE: new Date().toISOString().split('T')[0],
        // Section 5 (Employer Parts)
        SEC5_SITE_NAME: '', SEC5_SITE_ADDRESS: '', SEC5_OFFICIAL_NAME: '',
        SEC5_OFFICIAL_TITLE: '', SEC5_OFFICIAL_EMAIL: '', SEC5_OFFICIAL_PHONE: '',
        SEC5_EMPLOYER_OVERSIGHT: '', SEC5_MEASURES_ASSESSMENTS: '', SEC5_ADDITIONAL_REMARKS: '',
        // Section 6
        EMPLOYER_OFFICIAL_SEC6_PRINTED_NAME_TITLE: '',
        EMPLOYER_OFFICIAL_SEC6_SIGNATURE_DATE: new Date().toISOString().split('T')[0],
        // --- Evaluation State (Employer Parts) ---
        EVAL1_FROM_DATE: '', EVAL1_TO_DATE: '',
        EVAL1_STUDENT_EVALUATION: '', // Reuse for employer's eval text when initiating
        EVAL1_EMPLOYER_SIGNATURE_DATE: new Date().toISOString().split('T')[0],
        EVAL2_FROM_DATE: '', EVAL2_TO_DATE: '',
        EVAL2_STUDENT_EVALUATION: '', // Reuse for employer's eval text when initiating
        EVAL2_EMPLOYER_SIGNATURE_DATE: new Date().toISOString().split('T')[0],
    });

    const [isSaving, setIsSaving] = useState(false);

    // Signature Canvas Refs
    const sigCanvasSec4 = useRef(null);
    const sigCanvasSec6 = useRef(null);
    const sigCanvasEval1Employer = useRef(null);
    const sigCanvasEval2Employer = useRef(null);

    // Pre-fill employer data from the form prop
    useEffect(() => {
        if (form) {
             // console.log("I983VerificationForm - Pre-filling state from form:", form);
             setEmployerData(prev => ({
                ...prev, // Keep defaults like current date for signatures if not set in form
                // Section 3
                EMPLOYER_NAME: safeValue(form.EMPLOYER_NAME), EMPLOYER_WEBSITE: safeValue(form.EMPLOYER_WEBSITE), EMPLOYER_EIN: safeValue(form.EMPLOYER_EIN),
                EMPLOYER_STREET_ADDRESS: safeValue(form.EMPLOYER_STREET_ADDRESS), EMPLOYER_SUITE: safeValue(form.EMPLOYER_SUITE), EMPLOYER_CITY: safeValue(form.EMPLOYER_CITY),
                EMPLOYER_STATE: safeValue(form.EMPLOYER_STATE), EMPLOYER_ZIP: safeValue(form.EMPLOYER_ZIP), EMPLOYER_NUM_FT_EMPLOYEES: safeValue(form.EMPLOYER_NUM_FT_EMPLOYEES),
                EMPLOYER_NAICS_CODE: safeValue(form.EMPLOYER_NAICS_CODE), OPT_HOURS_PER_WEEK: safeValue(form.OPT_HOURS_PER_WEEK), START_DATE_OF_EMPLOYMENT: formatDateForInput(form.START_DATE_OF_EMPLOYMENT),
                SALARY_AMOUNT: safeValue(form.SALARY_AMOUNT), SALARY_FREQUENCY: safeValue(form.SALARY_FREQUENCY),
                OTHER_COMPENSATION_1: safeValue(form.OTHER_COMPENSATION_1), OTHER_COMPENSATION_2: safeValue(form.OTHER_COMPENSATION_2),
                OTHER_COMPENSATION_3: safeValue(form.OTHER_COMPENSATION_3), OTHER_COMPENSATION_4: safeValue(form.OTHER_COMPENSATION_4),
                // Section 4
                EMPLOYER_OFFICIAL_PRINTED_NAME_TITLE: safeValue(form.EMPLOYER_OFFICIAL_PRINTED_NAME_TITLE),
                EMPLOYER_PRINTED_NAME_ORG: safeValue(form.EMPLOYER_PRINTED_NAME_ORG, orgName), // Default to orgName if empty
                EMPLOYER_OFFICIAL_SIGNATURE_DATE: formatDateForInput(form.EMPLOYER_OFFICIAL_SIGNATURE_DATE) || new Date().toISOString().split('T')[0],
                // Section 5 (Employer Parts)
                SEC5_SITE_NAME: safeValue(form.SEC5_SITE_NAME), SEC5_SITE_ADDRESS: safeValue(form.SEC5_SITE_ADDRESS), SEC5_OFFICIAL_NAME: safeValue(form.SEC5_OFFICIAL_NAME),
                SEC5_OFFICIAL_TITLE: safeValue(form.SEC5_OFFICIAL_TITLE), SEC5_OFFICIAL_EMAIL: safeValue(form.SEC5_OFFICIAL_EMAIL), SEC5_OFFICIAL_PHONE: safeValue(form.SEC5_OFFICIAL_PHONE),
                SEC5_EMPLOYER_OVERSIGHT: safeValue(form.SEC5_EMPLOYER_OVERSIGHT), SEC5_MEASURES_ASSESSMENTS: safeValue(form.SEC5_MEASURES_ASSESSMENTS), SEC5_ADDITIONAL_REMARKS: safeValue(form.SEC5_ADDITIONAL_REMARKS),
                // Section 6
                EMPLOYER_OFFICIAL_SEC6_PRINTED_NAME_TITLE: safeValue(form.EMPLOYER_OFFICIAL_SEC6_PRINTED_NAME_TITLE),
                EMPLOYER_OFFICIAL_SEC6_SIGNATURE_DATE: formatDateForInput(form.EMPLOYER_OFFICIAL_SEC6_SIGNATURE_DATE) || new Date().toISOString().split('T')[0],
                // Evaluations (Employer Parts)
                EVAL1_FROM_DATE: formatDateForInput(form.EVAL1_FROM_DATE), EVAL1_TO_DATE: formatDateForInput(form.EVAL1_TO_DATE),
                EVAL1_STUDENT_EVALUATION: safeValue(form.EVAL1_STUDENT_EVALUATION), // Load existing text
                EVAL1_EMPLOYER_SIGNATURE_DATE: formatDateForInput(form.EVAL1_EMPLOYER_SIGNATURE_DATE) || new Date().toISOString().split('T')[0],
                EVAL2_FROM_DATE: formatDateForInput(form.EVAL2_FROM_DATE), EVAL2_TO_DATE: formatDateForInput(form.EVAL2_TO_DATE),
                EVAL2_STUDENT_EVALUATION: safeValue(form.EVAL2_STUDENT_EVALUATION), // Load existing text
                EVAL2_EMPLOYER_SIGNATURE_DATE: formatDateForInput(form.EVAL2_EMPLOYER_SIGNATURE_DATE) || new Date().toISOString().split('T')[0],
            }));
        }
    }, [form, orgName]); // Rerun if form data or orgName changes

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setEmployerData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const clearSignature = (sigRef) => {
        sigRef.current?.clear();
    };

    // Determine editability based on current form status and NEW statuses
    const status = form?.FORM_STATUS;
    const canEditSec3_4 = status === 'PAGE1_COMPLETE';
    const canEditSec5Site = status === 'PAGE3_SEC5_NAMES_COMPLETE';
    const canEditSec5Oversight = status === 'PAGE3_SEC5_TRAINING_COMPLETE'; // Verifier fills oversight/measures/remarks
    const canEditSec6 = status === 'PAGE3_SEC5_OVERSIGHT_COMPLETE';
    // --- UPDATED Evaluation Edit Flags ---
    const canEditEval1Initiate = status === 'PAGE4_SEC6_COMPLETE'; // Verifier initiates Eval 1 (dates/text)
    const canEditEval1Sign = status === 'EVAL1_PENDING_EMPLOYER_SIGNATURE'; // Verifier signs after student
    const canEditEval2Initiate = status === 'EVAL1_COMPLETE'; // Verifier initiates Eval 2 (dates/text)
    const canEditEval2Sign = status === 'EVAL2_PENDING_EMPLOYER_SIGNATURE'; // Verifier signs after student


    // Get signature from the currently active step's canvas
    const getActiveSignatureData = () => {
        if (canEditSec3_4 && sigCanvasSec4.current && !sigCanvasSec4.current.isEmpty()) return sigCanvasSec4.current.toDataURL('image/png');
        if (canEditSec6 && sigCanvasSec6.current && !sigCanvasSec6.current.isEmpty()) return sigCanvasSec6.current.toDataURL('image/png');
        if (canEditEval1Sign && sigCanvasEval1Employer.current && !sigCanvasEval1Employer.current.isEmpty()) return sigCanvasEval1Employer.current.toDataURL('image/png');
        if (canEditEval2Sign && sigCanvasEval2Employer.current && !sigCanvasEval2Employer.current.isEmpty()) return sigCanvasEval2Employer.current.toDataURL('image/png');
        return null; // No active signature canvas relevant to the current step
    };

    const handleSubmitStep = async () => {
        if (typeof onError !== 'function') {
             console.error("handleSubmitStep: onError prop is not a function!");
             alert("Internal error: Cannot submit form."); return;
        }
        onError(null); setIsSaving(true);

        try {
            const signatureData = getActiveSignatureData();
            let requiresSignature = false;

            // Determine if the *current active step* requires a signature
            if (canEditSec3_4 || canEditSec6 || canEditEval1Sign || canEditEval2Sign) requiresSignature = true;

            // --- Validation ---
            if (requiresSignature && !signatureData) {
                let sectionName = '';
                if (canEditSec3_4) sectionName = 'Section 4'; else if (canEditSec6) sectionName = 'Section 6';
                else if (canEditEval1Sign) sectionName = 'Evaluation 1 Employer'; else if (canEditEval2Sign) sectionName = 'Evaluation 2 Employer';
                throw new Error(`Signature is required to submit ${sectionName}.`);
            }
            // Add validation for required fields based on the current step
            if (canEditSec3_4) {
                 if (!employerData.EMPLOYER_NAME || !employerData.EMPLOYER_EIN /* ... other required sec 3 fields */) throw new Error("Please complete required fields in Section 3.");
                 if (!employerData.EMPLOYER_OFFICIAL_PRINTED_NAME_TITLE) throw new Error("Employer Official Name/Title (Sec 4) is required.");
            }
            if (canEditSec5Site && (!employerData.SEC5_SITE_NAME || !employerData.SEC5_SITE_ADDRESS /* ... */)) throw new Error("Please complete required Site Information fields (Sec 5).");
            if (canEditSec5Oversight && (!employerData.SEC5_EMPLOYER_OVERSIGHT || !employerData.SEC5_MEASURES_ASSESSMENTS)) throw new Error("Please complete Oversight and Measures/Assessments fields (Sec 5).");
            if (canEditSec6 && !employerData.EMPLOYER_OFFICIAL_SEC6_PRINTED_NAME_TITLE) throw new Error("Employer Official Name/Title (Sec 6) is required.");
            // Evaluation Initiation Validation
            if (canEditEval1Initiate) {
                if (!employerData.EVAL1_FROM_DATE || !employerData.EVAL1_TO_DATE) throw new Error("Evaluation 1 date range is required.");
                if (!employerData.EVAL1_STUDENT_EVALUATION) throw new Error("Employer Evaluation/Comments for Eval 1 are required."); // Check if reusing student field is intended
            }
             if (canEditEval2Initiate) {
                 if (!employerData.EVAL2_FROM_DATE || !employerData.EVAL2_TO_DATE) throw new Error("Evaluation 2 date range is required.");
                 if (!employerData.EVAL2_STUDENT_EVALUATION) throw new Error("Employer Evaluation/Comments for Eval 2 are required."); // Check if reusing student field is intended
             }

            // Prepare payload including ALL form data + current employer edits
            const payload = {
                ...form, // Start with existing form data (important!)
                ...employerData, // Overwrite with current state of employer fields
                orgid: orgId, // Pass necessary IDs
                emp_id: form.EMP_ID,
                // verifier_id is handled by backend using JWT
                action: 'submit', // Explicitly set action
                signature_data: signatureData, // Pass the relevant signature (or null)
            };

            console.log("Submitting I-983 step payload:", { ...payload, signature_data: signatureData ? 'Sig Present' : 'No Sig' });

            const numericFormId = parseInt(String(form.ID).replace('I983-', ''));
            const result = await saveOrUpdateI983Form(payload, numericFormId); // Use combined action

            if (result.success) {
                onSuccess(result.message || 'Form step submitted successfully!');
                // Parent component (VerificationContainer) handles refresh via onSuccess callback
            } else { throw new Error(result.error || 'Failed to submit form step.'); }
        } catch (err) {
            onError(err.message); console.error("Error submitting I-983 step:", err);
        } finally { setIsSaving(false); }
    };


    // --- Render Functions for Sections ---

    const renderReadOnlySection1_2 = () => (
        <div className={styles.formSection}>
            <h3>Section 1 & 2: Student Information (Read-Only)</h3>
            <div className={styles.infoGrid}>
                <div className={styles.infoItem}><label>Student Name:</label><span>{safeValue(form?.STUDENT_NAME)}</span></div>
                <div className={styles.infoItem}><label>Student Email:</label><span>{safeValue(form?.STUDENT_EMAIL)}</span></div>
                <div className={styles.infoItem}><label>School Recommending:</label><span>{safeValue(form?.SCHOOL_RECOMMENDING)}</span></div>
                <div className={styles.infoItem}><label>Degree School:</label><span>{safeValue(form?.SCHOOL_DEGREE_EARNED)}</span></div>
                <div className={styles.infoItem}><label>School Code:</label><span>{safeValue(form?.SCHOOL_CODE_RECOMMENDING)}</span></div>
                <div className={styles.infoItem}><label>SEVIS ID:</label><span>{safeValue(form?.STUDENT_SEVIS_ID)}</span></div>
                <div className={styles.infoItem}><label>STEM OPT Dates:</label><span>{formatDateDisplay(form?.STEM_OPT_START_DATE)} to {formatDateDisplay(form?.STEM_OPT_END_DATE)}</span></div>
                <div className={styles.infoItem}><label>Major/CIP:</label><span>{safeValue(form?.QUALIFYING_MAJOR_CIP)}</span></div>
                <div className={styles.infoItem}><label>Degree Level:</label><span>{safeValue(form?.QUALIFYING_DEGREE_LEVEL)}</span></div>
                <div className={styles.infoItem}><label>Date Awarded:</label><span>{formatDateDisplay(form?.QUALIFYING_DEGREE_DATE)}</span></div>
                <div className={styles.infoItem}><label>Based on Prior Degree:</label><span>{form?.BASED_ON_PRIOR_DEGREE ? 'Yes' : 'No'}</span></div>
                <div className={styles.infoItem}><label>Auth. Number:</label><span>{safeValue(form?.EMPLOYMENT_AUTH_NUMBER)}</span></div>
                <div className={`${styles.infoItem} ${styles.infoItemFullWidth}`}><label>DSO Info:</label><span>{safeValue(form?.DSO_NAME_CONTACT)}</span></div>
                 {/* Section 2 Display */}
                 <div className={styles.infoItem}><label>Student Printed Name (Sec 2):</label><span>{safeValue(form?.STUDENT_PRINTED_NAME)}</span></div>
                 <div className={styles.infoItem}><label>Student Signature Date (Sec 2):</label><span>{formatDateDisplay(form?.STUDENT_SIGNATURE_DATE)}</span></div>
                 {form?.STUDENT_SIGNATURE_URL && (
                    <div className={`${styles.infoItem} ${styles.infoItemFullWidth}`}>
                        <label>Student Signature (Sec 2):</label>
                        <div className={styles.signatureDisplay}>
                            <img src={form.STUDENT_SIGNATURE_URL} alt="Student Signature" style={{ maxHeight: '80px', border: '1px solid #ccc' }}/>
                        </div>
                    </div>
                 )}
            </div>
        </div>
    );

     const renderSection3_4 = () => {
        const disabled = !canEditSec3_4;
        if (status === 'DRAFT') return null; // Don't show if draft

        return (
            <div className={styles.formSection}>
                <h3>Section 3 & 4: Employer Information & Certification</h3>
                {canEditSec3_4 ? (
                    <>
                        {/* Section 3 Inputs */}
                        <h4>Section 3: Employer Information</h4>
                        <div className={styles.formRow}> <div className={styles.formGroup}><label>Employer Name*</label><input name="EMPLOYER_NAME" value={safeValue(employerData.EMPLOYER_NAME)} onChange={handleChange} disabled={disabled} required /></div> <div className={styles.formGroup}><label>Employer Website</label><input name="EMPLOYER_WEBSITE" value={safeValue(employerData.EMPLOYER_WEBSITE)} onChange={handleChange} disabled={disabled} /></div> <div className={styles.formGroup}><label>Employer EIN*</label><input name="EMPLOYER_EIN" value={safeValue(employerData.EMPLOYER_EIN)} onChange={handleChange} disabled={disabled} required placeholder="XX-XXXXXXX"/></div> </div>
                         <div className={styles.formRow}> <div className={styles.formGroup}><label>Street Address*</label><input name="EMPLOYER_STREET_ADDRESS" value={safeValue(employerData.EMPLOYER_STREET_ADDRESS)} onChange={handleChange} disabled={disabled} required/></div> <div className={styles.formGroup}><label>Suite</label><input name="EMPLOYER_SUITE" value={safeValue(employerData.EMPLOYER_SUITE)} onChange={handleChange} disabled={disabled} /></div> </div>
                         <div className={styles.formRow}> <div className={styles.formGroup}><label>City*</label><input name="EMPLOYER_CITY" value={safeValue(employerData.EMPLOYER_CITY)} onChange={handleChange} disabled={disabled} required/></div> <div className={styles.formGroup}><label>State*</label><input name="EMPLOYER_STATE" value={safeValue(employerData.EMPLOYER_STATE)} onChange={handleChange} disabled={disabled} required/></div> <div className={styles.formGroup}><label>ZIP Code*</label><input name="EMPLOYER_ZIP" value={safeValue(employerData.EMPLOYER_ZIP)} onChange={handleChange} disabled={disabled} required/></div> </div>
                         <div className={styles.formRow}> <div className={styles.formGroup}><label># Full-Time Employees (US)*</label><input type="number" name="EMPLOYER_NUM_FT_EMPLOYEES" value={safeValue(employerData.EMPLOYER_NUM_FT_EMPLOYEES)} onChange={handleChange} disabled={disabled} required min="0"/></div> <div className={styles.formGroup}><label>NAICS Code*</label><input name="EMPLOYER_NAICS_CODE" value={safeValue(employerData.EMPLOYER_NAICS_CODE)} onChange={handleChange} disabled={disabled} required/></div> <div className={styles.formGroup}><label>OPT Hours/Week* (min 20)</label><input type="number" name="OPT_HOURS_PER_WEEK" value={safeValue(employerData.OPT_HOURS_PER_WEEK)} onChange={handleChange} disabled={disabled} required min="20"/></div> </div>
                         <div className={styles.formRow}> <div className={styles.formGroup}><label>Start Date of Employment*</label><input type="date" name="START_DATE_OF_EMPLOYMENT" value={safeValue(employerData.START_DATE_OF_EMPLOYMENT)} onChange={handleChange} disabled={disabled} required/></div> <div className={styles.formGroup}><label>Salary Amount*</label><input type="number" step="0.01" name="SALARY_AMOUNT" value={safeValue(employerData.SALARY_AMOUNT)} onChange={handleChange} disabled={disabled} required min="0"/></div> <div className={styles.formGroup}><label>Salary Frequency*</label><input name="SALARY_FREQUENCY" value={safeValue(employerData.SALARY_FREQUENCY)} onChange={handleChange} disabled={disabled} required placeholder="e.g., Monthly"/></div> </div>
                         <h4>Other Compensation</h4>
                         <div className={styles.formRow}> <div className={styles.formGroup}><label>1.</label><input name="OTHER_COMPENSATION_1" value={safeValue(employerData.OTHER_COMPENSATION_1)} onChange={handleChange} disabled={disabled} /></div> <div className={styles.formGroup}><label>2.</label><input name="OTHER_COMPENSATION_2" value={safeValue(employerData.OTHER_COMPENSATION_2)} onChange={handleChange} disabled={disabled} /></div> <div className={styles.formGroup}><label>3.</label><input name="OTHER_COMPENSATION_3" value={safeValue(employerData.OTHER_COMPENSATION_3)} onChange={handleChange} disabled={disabled} /></div> <div className={styles.formGroup}><label>4.</label><input name="OTHER_COMPENSATION_4" value={safeValue(employerData.OTHER_COMPENSATION_4)} onChange={handleChange} disabled={disabled} /></div> </div>

                        {/* Section 4 Inputs */}
                        <h4 style={{marginTop: '20px'}}>Section 4: Employer Certification</h4>
                         <div className={styles.formRow}> <div className={styles.formGroup}> <label>Printed Name and Title of Employer Official*</label> <input name="EMPLOYER_OFFICIAL_PRINTED_NAME_TITLE" value={safeValue(employerData.EMPLOYER_OFFICIAL_PRINTED_NAME_TITLE)} onChange={handleChange} disabled={disabled} required/> </div> <div className={styles.formGroup}> <label>Printed Name of Employing Organization</label> <input name="EMPLOYER_PRINTED_NAME_ORG" value={safeValue(employerData.EMPLOYER_PRINTED_NAME_ORG)} onChange={handleChange} disabled={disabled} /> </div> </div>
                         <div className={styles.formRow}> <div className={styles.formGroup}> <label>Date*</label> <input type="date" name="EMPLOYER_OFFICIAL_SIGNATURE_DATE" value={safeValue(employerData.EMPLOYER_OFFICIAL_SIGNATURE_DATE)} onChange={handleChange} disabled={disabled} required/> </div> </div>
                         <div className={styles.formGroup}> <label>Signature of Employer Official*</label> <div className={styles.signatureCanvasWrapper}> <SignatureCanvas ref={sigCanvasSec4} canvasProps={{ className: styles.signatureCanvas }} /> </div> <button type="button" onClick={() => clearSignature(sigCanvasSec4)} className={`${styles.button} ${styles.clearButton}`}>Clear Signature</button> </div>
                         <div className={styles.formButtons}> <button onClick={handleSubmitStep} className={`${styles.button} ${styles.saveButton}`} disabled={isSaving}> {isSaving ? 'Submitting...' : 'Submit Section 3 & 4'} </button> <button type="button" onClick={onBack} className={`${styles.button} ${styles.cancelButton}`} disabled={isSaving}> Cancel </button> </div>
                    </>
                 ) : ( // Read-only view
                     <div className={styles.infoGrid}>
                         {/* Section 3 Read-only */}
                         <div className={styles.infoItem}><label>Employer Name:</label><span>{safeValue(form?.EMPLOYER_NAME)}</span></div> <div className={styles.infoItem}><label>EIN:</label><span>{safeValue(form?.EMPLOYER_EIN)}</span></div> <div className={`${styles.infoItem} ${styles.infoItemFullWidth}`}><label>Address:</label><span>{`${safeValue(form?.EMPLOYER_STREET_ADDRESS)} ${safeValue(form?.EMPLOYER_SUITE)}, ${safeValue(form?.EMPLOYER_CITY)}, ${safeValue(form?.EMPLOYER_STATE)} ${safeValue(form?.EMPLOYER_ZIP)}`}</span></div> <div className={styles.infoItem}><label>Start Date:</label><span>{formatDateDisplay(form?.START_DATE_OF_EMPLOYMENT)}</span></div> <div className={styles.infoItem}><label>Salary:</label><span>{`${safeValue(form?.SALARY_AMOUNT)} ${safeValue(form?.SALARY_FREQUENCY)}`}</span></div>
                         {/* ... other Sec 3 read-only fields ... */}
                         {/* Section 4 Read-only */}
                         <div className={styles.infoItem}><label>Official Name/Title:</label><span>{safeValue(form?.EMPLOYER_OFFICIAL_PRINTED_NAME_TITLE)}</span></div> <div className={styles.infoItem}><label>Organization Name:</label><span>{safeValue(form?.EMPLOYER_PRINTED_NAME_ORG)}</span></div> <div className={styles.infoItem}><label>Signature Date:</label><span>{formatDateDisplay(form?.EMPLOYER_OFFICIAL_SIGNATURE_DATE)}</span></div>
                         {form?.EMPLOYER_OFFICIAL_SIGNATURE_URL && ( <div className={`${styles.infoItem} ${styles.infoItemFullWidth}`}> <label>Official Signature:</label> <div className={styles.signatureDisplay}> <img src={form.EMPLOYER_OFFICIAL_SIGNATURE_URL} alt="Employer Signature" style={{ maxHeight: '80px', border: '1px solid #ccc' }}/> </div> </div> )}
                    </div>
                 )}
            </div>
        );
     };

     const renderReadOnlySection5Student = () => (
         // Show if status is past student submitting names/training
        (status === 'PAGE3_SEC5_SITE_COMPLETE' || status === 'PAGE3_SEC5_TRAINING_COMPLETE' || status === 'PAGE3_SEC5_OVERSIGHT_COMPLETE' || status === 'PAGE4_SEC6_COMPLETE' || status?.startsWith('EVAL') || status === 'FORM_COMPLETED') && (
             <div style={{marginTop: '20px', paddingTop:'15px', borderTop: '1px dashed #ccc'}}>
                 <h4>Section 5: Training Plan (Student Input - Read-Only)</h4>
                 <div className={styles.infoGrid}>
                    <div className={styles.infoItem}><label>Student Name (Sec 5):</label><span>{safeValue(form?.SEC5_STUDENT_NAME)}</span></div>
                    <div className={styles.infoItem}><label>Employer Name (Sec 5):</label><span>{safeValue(form?.SEC5_EMPLOYER_NAME)}</span></div>
                    <div className={`${styles.infoItem} ${styles.infoItemFullWidth}`}><label>Student Role:</label><span style={{whiteSpace: 'pre-wrap'}}>{safeValue(form?.SEC5_STUDENT_ROLE) || 'N/A'}</span></div>
                    <div className={`${styles.infoItem} ${styles.infoItemFullWidth}`}><label>Goals and Objectives:</label><span style={{whiteSpace: 'pre-wrap'}}>{safeValue(form?.SEC5_GOALS_OBJECTIVES) || 'N/A'}</span></div>
                 </div>
             </div>
        )
     );

     const renderSection5Employer = () => {
        const disabledSite = !canEditSec5Site;
        const disabledOversight = !canEditSec5Oversight;
         // Show section container if status >= PAGE3_SEC5_NAMES_COMPLETE
         if (status === 'DRAFT' || status === 'PAGE1_COMPLETE' || status === 'PAGE2_COMPLETE') return null;

         return (
             <div className={styles.formSection}>
                 <h3>Section 5: Employer Site & Training Info</h3>

                {/* Site Information - Editable at PAGE3_SEC5_NAMES_COMPLETE */}
                {(status === 'PAGE3_SEC5_NAMES_COMPLETE' || canEditSec5Site || status === 'PAGE3_SEC5_SITE_COMPLETE' || status === 'PAGE3_SEC5_TRAINING_COMPLETE' || status === 'PAGE3_SEC5_OVERSIGHT_COMPLETE' || status === 'PAGE4_SEC6_COMPLETE' || status?.startsWith('EVAL') || status === 'FORM_COMPLETED') && (
                 <>
                    <h4>Site Information</h4>
                    {canEditSec5Site ? (
                        <>
                            <div className={styles.formRow}> <div className={styles.formGroup}><label>Site Name*</label><input name="SEC5_SITE_NAME" value={safeValue(employerData.SEC5_SITE_NAME)} onChange={handleChange} disabled={disabledSite} required/></div> </div>
                            <div className={styles.formGroup}> <label>Site Address (Street, City, State, ZIP)*</label> <textarea name="SEC5_SITE_ADDRESS" value={safeValue(employerData.SEC5_SITE_ADDRESS)} onChange={handleChange} disabled={disabledSite} required rows="3"/> </div>
                            <div className={styles.formRow}> <div className={styles.formGroup}><label>Name of Official*</label><input name="SEC5_OFFICIAL_NAME" value={safeValue(employerData.SEC5_OFFICIAL_NAME)} onChange={handleChange} disabled={disabledSite} required/></div> <div className={styles.formGroup}><label>Official's Title*</label><input name="SEC5_OFFICIAL_TITLE" value={safeValue(employerData.SEC5_OFFICIAL_TITLE)} onChange={handleChange} disabled={disabledSite} required/></div> </div>
                            <div className={styles.formRow}> <div className={styles.formGroup}><label>Official's Email*</label><input type="email" name="SEC5_OFFICIAL_EMAIL" value={safeValue(employerData.SEC5_OFFICIAL_EMAIL)} onChange={handleChange} disabled={disabledSite} required/></div> <div className={styles.formGroup}><label>Official's Phone Number*</label><input type="tel" name="SEC5_OFFICIAL_PHONE" value={safeValue(employerData.SEC5_OFFICIAL_PHONE)} onChange={handleChange} disabled={disabledSite} required/></div> </div>
                            <div className={styles.formButtons}> <button onClick={handleSubmitStep} className={`${styles.button} ${styles.saveButton}`} disabled={isSaving}> {isSaving ? 'Submitting...' : 'Submit Section 5 Site Info'} </button> <button type="button" onClick={onBack} className={`${styles.button} ${styles.cancelButton}`} disabled={isSaving}> Cancel </button> </div>
                        </>
                    ) : ( // Read-only Site Info
                        <div className={styles.infoGrid}>
                            <div className={styles.infoItem}><label>Site Name:</label><span>{safeValue(form?.SEC5_SITE_NAME)}</span></div> <div className={`${styles.infoItem} ${styles.infoItemFullWidth}`}><label>Site Address:</label><span>{safeValue(form?.SEC5_SITE_ADDRESS)}</span></div> <div className={styles.infoItem}><label>Official Name:</label><span>{safeValue(form?.SEC5_OFFICIAL_NAME)}</span></div> <div className={styles.infoItem}><label>Official Title:</label><span>{safeValue(form?.SEC5_OFFICIAL_TITLE)}</span></div> <div className={styles.infoItem}><label>Official Email:</label><span>{safeValue(form?.SEC5_OFFICIAL_EMAIL)}</span></div> <div className={styles.infoItem}><label>Official Phone:</label><span>{safeValue(form?.SEC5_OFFICIAL_PHONE)}</span></div>
                        </div>
                    )}
                  </>
                 )}

                 {/* Render student read-only parts after site info */}
                 {renderReadOnlySection5Student()}

                 {/* Training Oversight & Measures - Editable at PAGE3_SEC5_TRAINING_COMPLETE */}
                  {(status === 'PAGE3_SEC5_TRAINING_COMPLETE' || canEditSec5Oversight || status === 'PAGE3_SEC5_OVERSIGHT_COMPLETE' || status === 'PAGE4_SEC6_COMPLETE' || status?.startsWith('EVAL') || status === 'FORM_COMPLETED') && (
                    <>
                        <h4 style={{marginTop: '30px'}}>Training Oversight, Measures, and Remarks</h4>
                        {canEditSec5Oversight ? (
                            <>
                                 <div className={styles.formGroup}> <label>Employer Oversight*</label> <textarea name="SEC5_EMPLOYER_OVERSIGHT" value={safeValue(employerData.SEC5_EMPLOYER_OVERSIGHT)} onChange={handleChange} disabled={disabledOversight} required rows="5" /> </div>
                                 <div className={styles.formGroup}> <label>Measures and Assessments*</label> <textarea name="SEC5_MEASURES_ASSESSMENTS" value={safeValue(employerData.SEC5_MEASURES_ASSESSMENTS)} onChange={handleChange} disabled={disabledOversight} required rows="5" /> </div>
                                 <div className={styles.formGroup}> <label>Additional Remarks (Optional)</label> <textarea name="SEC5_ADDITIONAL_REMARKS" value={safeValue(employerData.SEC5_ADDITIONAL_REMARKS)} onChange={handleChange} disabled={disabledOversight} rows="4" /> </div>

                                 <div className={styles.formButtons}> <button onClick={handleSubmitStep} className={`${styles.button} ${styles.saveButton}`} disabled={isSaving}> {isSaving ? 'Submitting...' : 'Submit Section 5 Oversight/Measures'} </button> <button type="button" onClick={onBack} className={`${styles.button} ${styles.cancelButton}`} disabled={isSaving}> Cancel </button> </div>
                            </>
                         ) : ( // Read-only Oversight/Measures/Remarks
                             <div className={styles.infoGrid}>
                                 <div className={`${styles.infoItem} ${styles.infoItemFullWidth}`}><label>Employer Oversight:</label><span style={{whiteSpace: 'pre-wrap'}}>{safeValue(form?.SEC5_EMPLOYER_OVERSIGHT) || 'N/A'}</span></div>
                                 <div className={`${styles.infoItem} ${styles.infoItemFullWidth}`}><label>Measures and Assessments:</label><span style={{whiteSpace: 'pre-wrap'}}>{safeValue(form?.SEC5_MEASURES_ASSESSMENTS) || 'N/A'}</span></div>
                                 <div className={`${styles.infoItem} ${styles.infoItemFullWidth}`}><label>Additional Remarks:</label><span style={{whiteSpace: 'pre-wrap'}}>{safeValue(form?.SEC5_ADDITIONAL_REMARKS) || 'N/A'}</span></div>
                             </div>
                         )}
                    </>
                )}
             </div>
        );
     };

     const renderSection6 = () => {
         const disabled = !canEditSec6;
         // Render if status >= PAGE3_SEC5_OVERSIGHT_COMPLETE
          if (status === 'DRAFT' || status === 'PAGE1_COMPLETE' || status === 'PAGE2_COMPLETE' || status === 'PAGE3_SEC5_NAMES_COMPLETE' || status === 'PAGE3_SEC5_SITE_COMPLETE' || status === 'PAGE3_SEC5_TRAINING_COMPLETE') return null;

         return (
            <div className={styles.formSection}>
                 <h3>Section 6: Employer Official Certification</h3>
                {canEditSec6 ? (
                    <>
                         {/* Additional remarks already covered in Sec 5 */}
                         <div className={styles.formRow}>
                            <div className={styles.formGroup}> <label>Printed Name and Title of Employer Official*</label> <input name="EMPLOYER_OFFICIAL_SEC6_PRINTED_NAME_TITLE" value={safeValue(employerData.EMPLOYER_OFFICIAL_SEC6_PRINTED_NAME_TITLE)} onChange={handleChange} disabled={disabled} required/> </div>
                             <div className={styles.formGroup}> <label>Date*</label> <input type="date" name="EMPLOYER_OFFICIAL_SEC6_SIGNATURE_DATE" value={safeValue(employerData.EMPLOYER_OFFICIAL_SEC6_SIGNATURE_DATE)} onChange={handleChange} disabled={disabled} required/> </div>
                         </div>
                         <div className={styles.formGroup}> <label>Signature of Employer Official*</label> <div className={styles.signatureCanvasWrapper}> <SignatureCanvas ref={sigCanvasSec6} canvasProps={{ className: styles.signatureCanvas }} /> </div> <button type="button" onClick={() => clearSignature(sigCanvasSec6)} className={`${styles.button} ${styles.clearButton}`}>Clear Signature</button> </div>
                         <div className={styles.formButtons}> <button onClick={handleSubmitStep} className={`${styles.button} ${styles.saveButton}`} disabled={isSaving}> {isSaving ? 'Submitting...' : 'Submit Section 6'} </button> <button type="button" onClick={onBack} className={`${styles.button} ${styles.cancelButton}`} disabled={isSaving}> Cancel </button> </div>
                    </>
                 ) : ( // Read-only Sec 6
                     <div className={styles.infoGrid}>
                         <div className={styles.infoItem}><label>Official Name/Title:</label><span>{safeValue(form?.EMPLOYER_OFFICIAL_SEC6_PRINTED_NAME_TITLE)}</span></div>
                         <div className={styles.infoItem}><label>Signature Date:</label><span>{formatDateDisplay(form?.EMPLOYER_OFFICIAL_SEC6_SIGNATURE_DATE)}</span></div>
                         {form?.EMPLOYER_OFFICIAL_SEC6_SIGNATURE_URL && ( <div className={`${styles.infoItem} ${styles.infoItemFullWidth}`}> <label>Official Signature (Sec 6):</label> <div className={styles.signatureDisplay}> <img src={form.EMPLOYER_OFFICIAL_SEC6_SIGNATURE_URL} alt="Section 6 Signature" style={{ maxHeight: '80px', border: '1px solid #ccc' }}/> </div> </div> )}
                     </div>
                 )}
            </div>
        );
     }

     // --- UPDATED Evaluation Rendering ---
     const renderEvaluations = () => {
         // Show Eval sections container if status is at or beyond the start of Eval 1
         const showEvalContainer = status === 'PAGE4_SEC6_COMPLETE' || status?.startsWith('EVAL') || status === 'FORM_COMPLETED';
         if (!showEvalContainer) return null;

         const renderSingleEvaluation = (evalNumber, canEditInitiate, canEditSign, sigRef) => {
             const fromDateKey = `EVAL${evalNumber}_FROM_DATE`;
             const toDateKey = `EVAL${evalNumber}_TO_DATE`;
             // Assuming EVALx_STUDENT_EVALUATION stores employer's comments during initiation, student's after they sign
             const evalTextKey = `EVAL${evalNumber}_STUDENT_EVALUATION`;
             const studentSigUrlKey = `EVAL${evalNumber}_STUDENT_SIGNATURE_URL`;
             const studentSigDateKey = `EVAL${evalNumber}_STUDENT_SIGNATURE_DATE`;
             const employerSigDateKey = `EVAL${evalNumber}_EMPLOYER_SIGNATURE_DATE`;
             const employerSigUrlKey = `EVAL${evalNumber}_EMPLOYER_SIGNATURE_URL`;
             // Attempt to reuse Sec 6 name/title, otherwise use Sec 4? Needs confirmation which official signs Evals. Assuming Sec 6 official for now.
             const employerPrintedNameKey = 'EMPLOYER_OFFICIAL_SEC6_PRINTED_NAME_TITLE';
             const title = evalNumber === 1 ? "First Evaluation" : "Final Evaluation";
             const studentStatusPending = `EVAL${evalNumber}_PENDING_STUDENT_SIGNATURE`;
             const employerStatusPending = `EVAL${evalNumber}_PENDING_EMPLOYER_SIGNATURE`;
             const completeStatus = evalNumber === 1 ? 'EVAL1_COMPLETE' : 'FORM_COMPLETED';

             // Determine visibility
             const showThisEval = (
                evalNumber === 1 && (status === 'PAGE4_SEC6_COMPLETE' || status.startsWith('EVAL1') || status.startsWith('EVAL2') || status === 'FORM_COMPLETED')
             ) || (
                evalNumber === 2 && (status === 'EVAL1_COMPLETE' || status.startsWith('EVAL2') || status === 'FORM_COMPLETED')
             );

             if (!showThisEval) return null;

             return (
                 <div style={{ border: '1px solid #eee', padding: '15px', borderRadius: '5px', marginBottom: '20px' }}>
                     <h4>{title}</h4>

                     {/* Verifier Inputs: Date Range & Text (Only editable when initiating) */}
                     {canEditInitiate ? (
                         <>
                             <div className={styles.formRow}>
                                 <div className={styles.formGroup}> <label>Evaluation Period From*</label> <input type="date" name={fromDateKey} value={safeValue(employerData[fromDateKey])} onChange={handleChange} required /> </div>
                                 <div className={styles.formGroup}> <label>Evaluation Period To*</label> <input type="date" name={toDateKey} value={safeValue(employerData[toDateKey])} onChange={handleChange} required /> </div>
                             </div>
                             <div className={styles.formGroup}>
                                <label>Employer Evaluation / Comments*</label>
                                <textarea name={evalTextKey} // Reusing field for employer comments
                                    value={safeValue(employerData[evalTextKey])}
                                    onChange={handleChange} required rows="5"
                                    placeholder="Enter evaluation comments regarding student progress for this period."
                                />
                             </div>
                              <div className={styles.formButtons}>
                                 <button onClick={handleSubmitStep} className={`${styles.button} ${styles.saveButton}`} disabled={isSaving}> {isSaving ? 'Submitting...' : `Initiate ${title} (Send to Student)`} </button>
                                  <button type="button" onClick={onBack} className={`${styles.button} ${styles.cancelButton}`} disabled={isSaving}>Cancel</button>
                              </div>
                         </>
                     ) : (
                         // Read-only Dates & Employer Text if already submitted/past this stage
                          (form?.[fromDateKey] || form?.[toDateKey] || form?.[evalTextKey]) && ( // Show if any data exists
                             <>
                                <div className={styles.infoGrid}>
                                    <div className={styles.infoItem}><label>Eval Period From:</label><span>{formatDateDisplay(form[fromDateKey])}</span></div>
                                    <div className={styles.infoItem}><label>Eval Period To:</label><span>{formatDateDisplay(form[toDateKey])}</span></div>
                                </div>
                                {/* Display Employer's initial comments read-only IF student hasn't signed yet */}
                                {/* If student HAS signed, their text might overwrite this field depending on backend logic */}
                                
                                    <div className={styles.formGroup} style={{marginTop: '15px'}}>
                                        <label>Employer Evaluation / Comments (Read-Only)</label>
                                        <textarea value={safeValue(form[evalTextKey])} disabled rows="5"/>
                                    </div>
                               
                            </>
                          )
                     )}

                     {/* Student Evaluation & Signature (Read-Only for Verifier) - Show if student has signed */}
                     {(status === employerStatusPending || status === completeStatus || (evalNumber === 1 && status.startsWith('EVAL2'))) && form?.[studentSigUrlKey] && (
                        <div style={{ marginTop:'15px', paddingTop: '15px', borderTop:'1px dashed #ccc' }}>
                             <label style={{fontWeight:'bold'}}>Student Signature (Read-Only)</label>
                             {/* Display student's eval text (assuming it's in the same field) */}
                             {/* <div className={styles.formGroup} style={{marginTop: '10px'}}>
                                 <textarea value={safeValue(form[evalTextKey])} disabled rows="5"/>
                             </div> */}
                             <div className={styles.infoGrid}>
                                <div className={styles.infoItem}><label>Date Signed by Student:</label><span>{formatDateDisplay(form[studentSigDateKey])}</span></div>
                             </div>
                            <div className={styles.formGroup} style={{marginTop: '10px'}}>
                                <label>Student Signature:</label>
                                <div className={styles.signatureDisplay}>
                                    <img src={form[studentSigUrlKey]} alt={`Eval ${evalNumber} Student Sig`} style={{maxHeight: '60px', border: '1px solid #ccc'}}/>
                                </div>
                            </div>
                        </div>
                     )}

                     {/* Employer Signature Area - Show when student has signed */}
                     {(status === employerStatusPending || canEditSign || status === completeStatus || (evalNumber === 1 && status.startsWith('EVAL2'))) && (
                          canEditSign ? ( // Verifier needs to sign
                            <div className={styles.formGroup} style={{marginTop: '15px', paddingTop: '15px', borderTop:'1px dashed #ccc'}}>
                                <label style={{fontWeight:'bold'}}>Employer Signature ({title})*</label>
                                <div className={styles.formRow}>
                                     <div className={styles.formGroup}>
                                         <label>Printed Name & Title</label>
                                         {/* Use data from state first, fallback to form data from previous steps */}
                                         <input value={safeValue(employerData[employerPrintedNameKey] || form?.[employerPrintedNameKey])} disabled/>
                                     </div>
                                     <div className={styles.formGroup}>
                                        <label>Date*</label>
                                        <input type="date" name={employerSigDateKey} value={safeValue(employerData[employerSigDateKey])} onChange={handleChange} required/>
                                     </div>
                                 </div>
                                 <div className={styles.signatureCanvasWrapper} style={{marginTop: '10px'}}>
                                     <SignatureCanvas ref={sigRef} canvasProps={{ className: styles.signatureCanvas }} />
                                 </div>
                                 <button type="button" onClick={() => clearSignature(sigRef)} className={`${styles.button} ${styles.clearButton}`}>Clear</button>
                                 <div className={styles.formButtons}>
                                     <button onClick={handleSubmitStep} className={`${styles.button} ${styles.saveButton}`} disabled={isSaving}> {isSaving ? 'Submitting...' : `Submit ${title} Signature`} </button>
                                     <button type="button" onClick={onBack} className={`${styles.button} ${styles.cancelButton}`} disabled={isSaving}>Cancel</button>
                                 </div>
                            </div>
                         ) : ( // Read-only Employer Signature
                            form?.[employerSigUrlKey] && (
                                <div className={styles.formGroup} style={{marginTop: '15px', borderTop:'1px dashed #ccc', paddingTop:'15px'}}>
                                    <label>Employer Signature ({title})</label>
                                    <div className={styles.infoGrid}>
                                        {/* Display the name/title used when signing */}
                                        <div className={styles.infoItem}><label>Printed Name & Title:</label><span>{safeValue(form[employerPrintedNameKey])}</span></div>
                                        <div className={styles.infoItem}><label>Date Signed:</label><span>{formatDateDisplay(form[employerSigDateKey])}</span></div>
                                    </div>
                                    <div className={styles.signatureDisplay} style={{marginTop:'10px'}}>
                                        <img src={form[employerSigUrlKey]} alt={`Eval ${evalNumber} Employer Sig`} style={{maxHeight: '80px', border: '1px solid #ccc'}}/>
                                    </div>
                                </div>
                            )
                         )
                     )}

                     {/* Message if waiting for student signature */}
                     {status === studentStatusPending && (
                         <p style={{fontStyle: 'italic', color: '#555', marginTop: '15px'}}>Waiting for student signature before proceeding.</p>
                     )}
                 </div>
             );
         };

         return (
             <div className={styles.formSection}>
                 <h3>Evaluations</h3>
                 {renderSingleEvaluation(1, canEditEval1Initiate, canEditEval1Sign, sigCanvasEval1Employer)}
                 {renderSingleEvaluation(2, canEditEval2Initiate, canEditEval2Sign, sigCanvasEval2Employer)}
             </div>
         );
     };


    // --- Main Return ---
    return (
        <div className={styles.verificationFormContainer}>
            {/* Display errors passed from parent using the onError prop */}
            {/* {error && <div className={styles.errorMessage}><strong>Error:</strong> {error}</div>} */}

            <div className={styles.headerSection}>
                <h2 className={styles.title}>Verify I-983 Form ({status || 'Loading...'})</h2>
                <button className={`${styles.button} ${styles.backButton}`} onClick={onBack} disabled={isSaving}>
                    Back to List
                </button>
            </div>

            <div className={styles.formSections}>
                {renderReadOnlySection1_2()}
                {renderSection3_4()}
                {renderSection5Employer()}
                {renderSection6()}
                {renderEvaluations()} {/* Render the evaluation section */}

                 {/* Fallback Message if waiting for student */}
                 {(status === 'PAGE2_COMPLETE' || status === 'PAGE3_SEC5_SITE_COMPLETE') && (
                    <div className={styles.formSection}>
                         <p style={{fontStyle: 'italic', color: '#555'}}>Waiting for student action before proceeding.</p>
                    </div>
                )}

                 {status === 'FORM_COMPLETED' && (
                     <div className={styles.formSection}>
                         <p style={{fontWeight: 'bold', color: 'green'}}>This form has been fully completed.</p>
                     </div>
                 )}
            </div>
        </div>
    );
};

export default I983VerificationForm;
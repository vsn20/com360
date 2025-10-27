// src/app/components/Forms/I983Form/I983Form.jsx
// @ts-nocheck
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { fetchEmployeeById } from '@/app/serverActions/Employee/overview';
import {
  getI983FormDetails,
  saveOrUpdateI983Form, // Use the combined save/update action
  // Add other necessary I-983 actions if needed (e.g., delete)
} from '@/app/serverActions/forms/i983/actions';
import SignatureCanvas from 'react-signature-canvas';
// Assuming I-983 uses similar styles to W-9 for now
import styles from '../W9Form/W9Forms.module.css'; // Reusing W9Form styles

// Helper function to safely get values, especially for controlled inputs
const safeValue = (value, defaultValue = '') => {
  // Return defaultValue if value is null or undefined, otherwise return value
  return value ?? defaultValue;
};

// Helper function to format dates for input type="date" (YYYY-MM-DD)
const formatDateForInput = (dateStr) => {
    if (!dateStr) return '';
    try {
        const date = new Date(dateStr);
        // Use UTC date parts to avoid timezone issues
        const year = date.getUTCFullYear();
        const month = String(date.getUTCMonth() + 1).padStart(2, '0');
        const day = String(date.getUTCDate()).padStart(2, '0');
         if (year < 1900 || year > 2100) return '';
        return `${year}-${month}-${day}`;
    } catch (e) {
        return ''; // Return empty string for invalid dates
    }
};

// Helper function to format dates for display (MM/DD/YYYY)
const formatDateDisplay = (dateStr) => {
    if (!dateStr) return 'N/A';
    try {
        const date = new Date(dateStr);
        const year = date.getUTCFullYear();
        const month = String(date.getUTCMonth() + 1).padStart(2, '0');
        const day = String(date.getUTCDate()).padStart(2, '0');
         if (year < 1900 || year > 2100) return 'Invalid Date';
        return `${month}/${day}/${year}`;
    } catch (e) {
        return 'Invalid Date';
    }
};


const I983Form = ({ empid, orgid, onBack, states, countries, isAdding, selectedFormId, onError, onSuccess }) => {
    const [formData, setFormData] = useState({
        // Section 1
        STUDENT_NAME: '', STUDENT_EMAIL: '', SCHOOL_RECOMMENDING: '',
        SCHOOL_DEGREE_EARNED: '', SCHOOL_CODE_RECOMMENDING: '', DSO_NAME_CONTACT: '',
        STUDENT_SEVIS_ID: '', STEM_OPT_START_DATE: '', STEM_OPT_END_DATE: '',
        QUALIFYING_MAJOR_CIP: '', QUALIFYING_DEGREE_LEVEL: '', QUALIFYING_DEGREE_DATE: '',
        BASED_ON_PRIOR_DEGREE: false, EMPLOYMENT_AUTH_NUMBER: '',
        // Section 2
        STUDENT_PRINTED_NAME: '',
        STUDENT_SIGNATURE_DATE: new Date().toISOString().split('T')[0],
        STUDENT_SIGNATURE_URL: '', // Store existing URL if viewing
        // Section 5 (Student Parts)
        SEC5_STUDENT_NAME: '', SEC5_EMPLOYER_NAME: '', SEC5_STUDENT_ROLE: '',
        SEC5_GOALS_OBJECTIVES: '',
        // --- Evaluation State (Student Parts) ---
        EVAL1_STUDENT_EVALUATION: '',
        EVAL1_STUDENT_SIGNATURE_DATE: new Date().toISOString().split('T')[0],
        EVAL1_STUDENT_SIGNATURE_URL: '',
        EVAL2_STUDENT_EVALUATION: '',
        EVAL2_STUDENT_SIGNATURE_DATE: new Date().toISOString().split('T')[0],
        EVAL2_STUDENT_SIGNATURE_URL: '',
        // Employer-filled fields (like dates, employer text) are stored in 'existingForm' for display
    });

    const [isSaving, setIsSaving] = useState(false);
    const [existingForm, setExistingForm] = useState(null); // Store fetched form data including employer fields
    const [currentFormId, setCurrentFormId] = useState(null); // Store numeric ID

    // Signature Canvases
    const sigCanvasSec2 = useRef(null);
    const sigCanvasEval1Student = useRef(null);
    const sigCanvasEval2Student = useRef(null);

    // --- Data Loading Effect ---
    useEffect(() => {
        const loadData = async () => {
            onError(null);
            setIsSaving(true);
            try {
                const employee = await fetchEmployeeById(empid); // Prefill basic info

                if (isAdding) {
                    // --- ADDING NEW FORM ---
                    setExistingForm(null); setCurrentFormId(null);
                    setFormData(prev => ({
                        // Reset all fields to default/prefill
                        STUDENT_NAME: `${employee.EMP_FST_NAME || ''} ${employee.EMP_LAST_NAME || ''}`.trim(),
                        STUDENT_EMAIL: employee.email || '', SCHOOL_RECOMMENDING: '', SCHOOL_DEGREE_EARNED: '',
                        SCHOOL_CODE_RECOMMENDING: '', DSO_NAME_CONTACT: '', STUDENT_SEVIS_ID: '',
                        STEM_OPT_START_DATE: '', STEM_OPT_END_DATE: '', QUALIFYING_MAJOR_CIP: '',
                        QUALIFYING_DEGREE_LEVEL: '', QUALIFYING_DEGREE_DATE: '', BASED_ON_PRIOR_DEGREE: false,
                        EMPLOYMENT_AUTH_NUMBER: '', STUDENT_PRINTED_NAME: `${employee.EMP_FST_NAME || ''} ${employee.EMP_LAST_NAME || ''}`.trim(),
                        STUDENT_SIGNATURE_DATE: new Date().toISOString().split('T')[0], STUDENT_SIGNATURE_URL: '',
                        SEC5_STUDENT_NAME: `${employee.EMP_FST_NAME || ''} ${employee.EMP_LAST_NAME || ''}`.trim(),
                        SEC5_EMPLOYER_NAME: '', SEC5_STUDENT_ROLE: '', SEC5_GOALS_OBJECTIVES: '',
                        EVAL1_STUDENT_EVALUATION: '', EVAL1_STUDENT_SIGNATURE_DATE: new Date().toISOString().split('T')[0], EVAL1_STUDENT_SIGNATURE_URL: '',
                        EVAL2_STUDENT_EVALUATION: '', EVAL2_STUDENT_SIGNATURE_DATE: new Date().toISOString().split('T')[0], EVAL2_STUDENT_SIGNATURE_URL: '',
                    }));
                } else if (selectedFormId) {
                    // --- EDITING/VIEWING EXISTING FORM ---
                    const formId = String(selectedFormId).replace('I983-', '');
                    const fetchedForm = await getI983FormDetails(formId);
                    setExistingForm(fetchedForm); // Store the full fetched data
                    setCurrentFormId(fetchedForm.ID);

                    // Map fetched data to state for student-editable fields
                    setFormData({
                        // Section 1
                        STUDENT_NAME: safeValue(fetchedForm.STUDENT_NAME), STUDENT_EMAIL: safeValue(fetchedForm.STUDENT_EMAIL), SCHOOL_RECOMMENDING: safeValue(fetchedForm.SCHOOL_RECOMMENDING),
                        SCHOOL_DEGREE_EARNED: safeValue(fetchedForm.SCHOOL_DEGREE_EARNED), SCHOOL_CODE_RECOMMENDING: safeValue(fetchedForm.SCHOOL_CODE_RECOMMENDING), DSO_NAME_CONTACT: safeValue(fetchedForm.DSO_NAME_CONTACT),
                        STUDENT_SEVIS_ID: safeValue(fetchedForm.STUDENT_SEVIS_ID), STEM_OPT_START_DATE: formatDateForInput(fetchedForm.STEM_OPT_START_DATE), STEM_OPT_END_DATE: formatDateForInput(fetchedForm.STEM_OPT_END_DATE),
                        QUALIFYING_MAJOR_CIP: safeValue(fetchedForm.QUALIFYING_MAJOR_CIP), QUALIFYING_DEGREE_LEVEL: safeValue(fetchedForm.QUALIFYING_DEGREE_LEVEL), QUALIFYING_DEGREE_DATE: formatDateForInput(fetchedForm.QUALIFYING_DEGREE_DATE),
                        BASED_ON_PRIOR_DEGREE: !!fetchedForm.BASED_ON_PRIOR_DEGREE, EMPLOYMENT_AUTH_NUMBER: safeValue(fetchedForm.EMPLOYMENT_AUTH_NUMBER),
                        // Section 2
                        STUDENT_PRINTED_NAME: safeValue(fetchedForm.STUDENT_PRINTED_NAME),
                        STUDENT_SIGNATURE_DATE: formatDateForInput(fetchedForm.STUDENT_SIGNATURE_DATE) || new Date().toISOString().split('T')[0],
                        STUDENT_SIGNATURE_URL: safeValue(fetchedForm.STUDENT_SIGNATURE_URL),
                        // Section 5 (Student Parts)
                        SEC5_STUDENT_NAME: safeValue(fetchedForm.SEC5_STUDENT_NAME),
                        SEC5_EMPLOYER_NAME: safeValue(fetchedForm.SEC5_EMPLOYER_NAME || fetchedForm.EMPLOYER_NAME), // Pre-fill employer name
                        SEC5_STUDENT_ROLE: safeValue(fetchedForm.SEC5_STUDENT_ROLE),
                        SEC5_GOALS_OBJECTIVES: safeValue(fetchedForm.SEC5_GOALS_OBJECTIVES),
                        // Evaluation State (Student Parts)
                        // Load student evaluation text IF the status indicates student has signed or later
                        EVAL1_STUDENT_EVALUATION: (fetchedForm.FORM_STATUS === 'EVAL1_PENDING_EMPLOYER_SIGNATURE' || fetchedForm.FORM_STATUS === 'EVAL1_COMPLETE' || fetchedForm.FORM_STATUS?.startsWith('EVAL2') || fetchedForm.FORM_STATUS === 'FORM_COMPLETED') ? safeValue(fetchedForm.EVAL1_STUDENT_EVALUATION) : '',
                        EVAL1_STUDENT_SIGNATURE_DATE: formatDateForInput(fetchedForm.EVAL1_STUDENT_SIGNATURE_DATE) || new Date().toISOString().split('T')[0],
                        EVAL1_STUDENT_SIGNATURE_URL: safeValue(fetchedForm.EVAL1_STUDENT_SIGNATURE_URL),
                        EVAL2_STUDENT_EVALUATION: (fetchedForm.FORM_STATUS === 'EVAL2_PENDING_EMPLOYER_SIGNATURE' || fetchedForm.FORM_STATUS === 'FORM_COMPLETED') ? safeValue(fetchedForm.EVAL2_STUDENT_EVALUATION) : '',
                        EVAL2_STUDENT_SIGNATURE_DATE: formatDateForInput(fetchedForm.EVAL2_STUDENT_SIGNATURE_DATE) || new Date().toISOString().split('T')[0],
                        EVAL2_STUDENT_SIGNATURE_URL: safeValue(fetchedForm.EVAL2_STUDENT_SIGNATURE_URL),
                    });
                }
            } catch (err) {
                onError('Failed to load I-983 form data: ' + err.message);
                console.error(err);
            } finally {
                 setIsSaving(false);
            }
        };
        loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [empid, orgid, isAdding, selectedFormId]); // Removed onError from deps

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    // --- Editability Logic based on Status ---
    const status = existingForm?.FORM_STATUS || 'DRAFT';

    const canEditSec1_2 = status === 'DRAFT';
    const canEditSec5Names = status === 'PAGE2_COMPLETE'; // After Verifier Sec 3&4
    const canEditSec5Training = status === 'PAGE3_SEC5_SITE_COMPLETE'; // After Verifier Site Info
    // --- Evaluation Edit Flags for Student ---
    const canEditEval1Student = status === 'EVAL1_PENDING_STUDENT_SIGNATURE';
    const canEditEval2Student = status === 'EVAL2_PENDING_STUDENT_SIGNATURE';


    // --- Signature Handling ---
    const clearSignature = (sigRef) => {
        sigRef.current?.clear();
    };

    const getActiveSignatureData = () => {
        if (canEditSec1_2 && sigCanvasSec2.current && !sigCanvasSec2.current.isEmpty()) return sigCanvasSec2.current.toDataURL('image/png');
        if (canEditEval1Student && sigCanvasEval1Student.current && !sigCanvasEval1Student.current.isEmpty()) return sigCanvasEval1Student.current.toDataURL('image/png');
        if (canEditEval2Student && sigCanvasEval2Student.current && !sigCanvasEval2Student.current.isEmpty()) return sigCanvasEval2Student.current.toDataURL('image/png');
        return null;
    };


    // --- Server Action Handler ---
    const handleServerAction = async (action) => {
        onError(null);
        onSuccess('');
        setIsSaving(true);

        try {
            // --- Validation ---
            if (action === 'submit') {
                if (canEditSec1_2 && (!sigCanvasSec2.current || sigCanvasSec2.current.isEmpty())) throw new Error('Section 2 Signature is required.');
                if (canEditSec5Names && !formData.SEC5_STUDENT_NAME) throw new Error('Student Name (Sec 5) is required.');
                if (canEditSec5Training && (!formData.SEC5_STUDENT_ROLE || !formData.SEC5_GOALS_OBJECTIVES)) throw new Error('Student Role and Goals/Objectives (Sec 5) are required.');
                if (canEditEval1Student && (!formData.EVAL1_STUDENT_EVALUATION || !sigCanvasEval1Student.current || sigCanvasEval1Student.current.isEmpty())) throw new Error('Evaluation 1 text and signature are required.');
                if (canEditEval2Student && ( !sigCanvasEval2Student.current || sigCanvasEval2Student.current.isEmpty())) throw new Error('Final Evaluation text and signature are required.');
            }

            const signatureData = getActiveSignatureData();
            // Include ALL formData fields, backend will filter based on allowedColumns
            const payload = {
                ...formData, // Send current student state
                // Include necessary IDs passed from parent or existingForm
                orgid: existingForm?.ORG_ID || orgid, // Use existing form's orgid if available
                emp_id: existingForm?.EMP_ID || empid, // Use existing form's empid if available
                action: action,
                signature_data: signatureData,
                 // Send employer fields from existingForm so backend has complete data for PDF
                 // Backend's saveOrUpdate will merge formData over existing data carefully
                 ...(existingForm && {
                     EMPLOYER_NAME: existingForm.EMPLOYER_NAME, EMPLOYER_WEBSITE: existingForm.EMPLOYER_WEBSITE, EMPLOYER_EIN: existingForm.EMPLOYER_EIN,
                     EMPLOYER_STREET_ADDRESS: existingForm.EMPLOYER_STREET_ADDRESS, EMPLOYER_SUITE: existingForm.EMPLOYER_SUITE, EMPLOYER_CITY: existingForm.EMPLOYER_CITY,
                     EMPLOYER_STATE: existingForm.EMPLOYER_STATE, EMPLOYER_ZIP: existingForm.EMPLOYER_ZIP, EMPLOYER_NUM_FT_EMPLOYEES: existingForm.EMPLOYER_NUM_FT_EMPLOYEES,
                     EMPLOYER_NAICS_CODE: existingForm.EMPLOYER_NAICS_CODE, OPT_HOURS_PER_WEEK: existingForm.OPT_HOURS_PER_WEEK, START_DATE_OF_EMPLOYMENT: existingForm.START_DATE_OF_EMPLOYMENT,
                     SALARY_AMOUNT: existingForm.SALARY_AMOUNT, SALARY_FREQUENCY: existingForm.SALARY_FREQUENCY, OTHER_COMPENSATION_1: existingForm.OTHER_COMPENSATION_1,
                     OTHER_COMPENSATION_2: existingForm.OTHER_COMPENSATION_2, OTHER_COMPENSATION_3: existingForm.OTHER_COMPENSATION_3, OTHER_COMPENSATION_4: existingForm.OTHER_COMPENSATION_4,
                     EMPLOYER_OFFICIAL_PRINTED_NAME_TITLE: existingForm.EMPLOYER_OFFICIAL_PRINTED_NAME_TITLE, EMPLOYER_PRINTED_NAME_ORG: existingForm.EMPLOYER_PRINTED_NAME_ORG,
                     EMPLOYER_OFFICIAL_SIGNATURE_DATE: existingForm.EMPLOYER_OFFICIAL_SIGNATURE_DATE, // Keep formatted date
                     EMPLOYER_OFFICIAL_SIGNATURE_URL: existingForm.EMPLOYER_OFFICIAL_SIGNATURE_URL, // Keep URL
                     SEC5_SITE_NAME: existingForm.SEC5_SITE_NAME, SEC5_SITE_ADDRESS: existingForm.SEC5_SITE_ADDRESS, SEC5_OFFICIAL_NAME: existingForm.SEC5_OFFICIAL_NAME,
                     SEC5_OFFICIAL_TITLE: existingForm.SEC5_OFFICIAL_TITLE, SEC5_OFFICIAL_EMAIL: existingForm.SEC5_OFFICIAL_EMAIL, SEC5_OFFICIAL_PHONE: existingForm.SEC5_OFFICIAL_PHONE,
                     SEC5_EMPLOYER_OVERSIGHT: existingForm.SEC5_EMPLOYER_OVERSIGHT, SEC5_MEASURES_ASSESSMENTS: existingForm.SEC5_MEASURES_ASSESSMENTS, SEC5_ADDITIONAL_REMARKS: existingForm.SEC5_ADDITIONAL_REMARKS,
                     EMPLOYER_OFFICIAL_SEC6_PRINTED_NAME_TITLE: existingForm.EMPLOYER_OFFICIAL_SEC6_PRINTED_NAME_TITLE, EMPLOYER_OFFICIAL_SEC6_SIGNATURE_DATE: existingForm.EMPLOYER_OFFICIAL_SEC6_SIGNATURE_DATE,
                     EMPLOYER_OFFICIAL_SEC6_SIGNATURE_URL: existingForm.EMPLOYER_OFFICIAL_SEC6_SIGNATURE_URL,
                     EVAL1_FROM_DATE: existingForm.EVAL1_FROM_DATE, EVAL1_TO_DATE: existingForm.EVAL1_TO_DATE,
                     // Make sure EVAL1_STUDENT_EVALUATION from *formData* overrides existingForm if student is editing it
                     EVAL1_STUDENT_EVALUATION:  existingForm.EVAL1_STUDENT_EVALUATION,
                     EVAL1_EMPLOYER_SIGNATURE_URL: existingForm.EVAL1_EMPLOYER_SIGNATURE_URL, EVAL1_EMPLOYER_SIGNATURE_DATE: existingForm.EVAL1_EMPLOYER_SIGNATURE_DATE,
                     EVAL2_FROM_DATE: existingForm.EVAL2_FROM_DATE, EVAL2_TO_DATE: existingForm.EVAL2_TO_DATE,
                     EVAL2_STUDENT_EVALUATION: existingForm.EVAL2_STUDENT_EVALUATION,
                     EVAL2_EMPLOYER_SIGNATURE_URL: existingForm.EVAL2_EMPLOYER_SIGNATURE_URL, EVAL2_EMPLOYER_SIGNATURE_DATE: existingForm.EVAL2_EMPLOYER_SIGNATURE_DATE,
                 }),
            };
            // Remove undefined values before sending
            Object.keys(payload).forEach(key => payload[key] === undefined && delete payload[key]);

            console.log("Calling saveOrUpdateI983Form payload:", { ...payload, signature_data: signatureData ? 'Sig Present' : 'No Sig' });

            const result = await saveOrUpdateI983Form(payload, currentFormId);

            if (result.success) {
                onSuccess(result.message);
                if (action === 'submit') {
                    // Update local state immediately with new status from result
                    if(result.newStatus && existingForm) {
                        setExistingForm(prev => ({ ...prev, FORM_STATUS: result.newStatus }));
                    } else if (result.id && result.newStatus) {
                        // It was an insert, fetch the newly created form to get all data
                         const newForm = await getI983FormDetails(result.id);
                         setExistingForm(newForm);
                         setCurrentFormId(newForm.ID);
                    }
                    // Consider removing setTimeout if onSuccess triggers list refresh anyway
                    // setTimeout(onBack, 2000); // Go back after success message
                     onBack(); // Go back immediately or let onSuccess handle refresh?
                } else if (result.id && !currentFormId) {
                    setCurrentFormId(result.id); // Update ID if saved draft first time
                     // Fetch the newly saved draft to update existingForm
                     const newForm = await getI983FormDetails(result.id);
                     setExistingForm(newForm);
                } else {
                     // Reload data after saving draft to reflect any changes/URLs
                     const updatedForm = await getI983FormDetails(currentFormId);
                     setExistingForm(updatedForm);
                }
            } else { throw new Error(result.error); }
        } catch (err) {
            onError(err.message || `Failed to ${action} I-983 form.`);
            console.error(`Error during ${action}:`, err);
        } finally { setIsSaving(false); }
    };


    // --- Render Logic ---
    const isLoading = isSaving && !existingForm && !isAdding;
    if (isLoading) { return <div className={styles.loading}>Loading form data...</div>; }

    // --- Render Function for Evaluation Sections (Student's Turn) ---
    const renderEvaluationSection = (evalNumber, canEdit, sigRef) => {
        const evalTextKey = `EVAL${evalNumber}_STUDENT_EVALUATION`;
        const sigDateKey = `EVAL${evalNumber}_STUDENT_SIGNATURE_DATE`;
        const sigUrlKey = `EVAL${evalNumber}_STUDENT_SIGNATURE_URL`;
        const employerEvalText = existingForm?.[`EVAL${evalNumber}_STUDENT_EVALUATION`]; // Employer's text (if reused field)
        const fromDate = existingForm?.[`EVAL${evalNumber}_FROM_DATE`];
        const toDate = existingForm?.[`EVAL${evalNumber}_TO_DATE`];
        const employerSigUrl = existingForm?.[`EVAL${evalNumber}_EMPLOYER_SIGNATURE_URL`];
        const employerSigDate = existingForm?.[`EVAL${evalNumber}_EMPLOYER_SIGNATURE_DATE`];
        const employerNameTitle = existingForm?.EMPLOYER_OFFICIAL_SEC6_PRINTED_NAME_TITLE; // Assuming same official
        const evalTitle = evalNumber === 1 ? "Evaluation on Student Progress" : "Final Evaluation on Student Progress";

        // Determine if section should be shown
        const showEval1 = status === 'EVAL1_PENDING_STUDENT_SIGNATURE' || status === 'EVAL1_PENDING_EMPLOYER_SIGNATURE' || status === 'EVAL1_COMPLETE' || status?.startsWith('EVAL2') || status === 'FORM_COMPLETED';
        const showEval2 = status === 'EVAL2_PENDING_STUDENT_SIGNATURE' || status === 'EVAL2_PENDING_EMPLOYER_SIGNATURE' || status === 'FORM_COMPLETED';
        let showSection = (evalNumber === 1 && showEval1) || (evalNumber === 2 && showEval2);

        if (!showSection) return null;

        return (
            <div className={styles.formSection}>
                <h3>{evalTitle}</h3>
                {/* Display Read-only Employer Dates & Comments */}
                 <div className={styles.infoGrid}>
                    <div className={styles.infoItem}><label>Evaluation Period From:</label><span>{formatDateDisplay(fromDate)}</span></div>
                    <div className={styles.infoItem}><label>Evaluation Period To:</label><span>{formatDateDisplay(toDate)}</span></div>
                    {/* Display employer's text only if student hasn't signed yet */}
                    {(status === `EVAL${evalNumber}_PENDING_STUDENT_SIGNATURE`) && (
                        <div className={`${styles.infoItem} ${styles.infoItemFullWidth}`}>
                           <label>Employer Evaluation / Comments (Read-Only):</label>
                           <span style={{ whiteSpace: 'pre-wrap' }}>{safeValue(employerEvalText) || 'N/A'}</span>
                        </div>
                    )}
                 </div>

                {canEdit ? ( // Student's turn to add text and sign
                    <>
                        {/* <div className={styles.formGroup} style={{marginTop:'15px'}}>
                            <label>Student Self-Evaluation*</label>
                            <textarea name={evalTextKey} value={safeValue(formData[evalTextKey])} onChange={handleChange} disabled={!canEdit} rows={6} required placeholder="Describe your progress, accomplishments, and challenges..." />
                        </div> */}
                        <div className={styles.formRow}>
                             <div className={styles.formGroup}><label>Printed Name</label><input value={safeValue(formData.STUDENT_PRINTED_NAME)} disabled={true} /></div>
                            <div className={styles.formGroup}><label>Date*</label><input type="date" name={sigDateKey} value={safeValue(formData[sigDateKey])} onChange={handleChange} required disabled={!canEdit} /></div>
                        </div>
                         <div className={styles.formGroup}>
                            <label>Signature*</label>
                             {formData[sigUrlKey] && ( <div className={styles.signatureDisplay} style={{ marginBottom: '10px' }}> <p>Current Signature:</p> <img src={formData[sigUrlKey]} alt={`Current Eval ${evalNumber} Sig`} style={{ maxHeight: '60px', border: '1px solid #ccc' }}/> </div> )}
                            <div className={styles.signatureCanvasWrapper}> <SignatureCanvas ref={sigRef} canvasProps={{ className: styles.signatureCanvas }} /> </div>
                            <button type="button" onClick={() => clearSignature(sigRef)} className={`${styles.button} ${styles.clearButton}`}>Clear Signature</button>
                        </div>
                        <div className={styles.formButtons}>
                            <button onClick={() => handleServerAction('submit')} className={`${styles.button} ${styles.buttonSubmit}`} disabled={isSaving}> {isSaving ? 'Submitting...' : `Submit ${evalTitle}`} </button>
                        </div>
                    </>
                ) : ( // Read-only view after student has submitted or form is completed
                    <>
                        {/* Show student text if available */}
                        {(status === `EVAL${evalNumber}_PENDING_EMPLOYER_SIGNATURE` || status === `EVAL${evalNumber === 1 ? 'EVAL1_COMPLETE' : 'FORM_COMPLETED'}` || (evalNumber===1 && status?.startsWith('EVAL2')) ) && (
                            <div className={styles.formGroup} style={{marginTop:'15px'}}>
                                <label>Employer Self-Evaluation (Read-Only)</label>
                                <textarea value={safeValue(formData[evalTextKey]) || 'N/A'} disabled rows={6} />
                            </div>
                        )}
                         <div className={styles.infoGrid} style={{marginTop:'15px'}}>
                            <div className={styles.infoItem}><label>Printed Name:</label><span>{safeValue(formData.STUDENT_PRINTED_NAME)}</span></div>
                            <div className={styles.infoItem}><label>Date Signed:</label><span>{formatDateDisplay(formData[sigDateKey])}</span></div>
                         </div>
                         {formData[sigUrlKey] && (
                            <div className={styles.formGroup} style={{marginTop:'10px'}}>
                                <label>Student Signature:</label>
                                <div className={styles.signatureDisplay}> <img src={formData[sigUrlKey]} alt={`Eval ${evalNumber} Sig`} style={{ maxHeight: '80px', border: '1px solid #ccc' }}/> </div>
                            </div>
                         )}

                         {/* Display Employer Signature if Available (read-only) */}
                          {(status === `EVAL${evalNumber === 1 ? 'EVAL1_COMPLETE' : 'FORM_COMPLETED'}` || (evalNumber===1 && status?.startsWith('EVAL2'))) && employerSigUrl && (
                            <div className={styles.formGroup} style={{marginTop: '15px', borderTop:'1px dashed #ccc', paddingTop:'15px'}}>
                                <label>Employer Signature</label>
                                <div className={styles.infoGrid}>
                                    <div className={styles.infoItem}><label>Printed Name & Title:</label><span>{safeValue(employerNameTitle)}</span></div>
                                    <div className={styles.infoItem}><label>Date Signed:</label><span>{formatDateDisplay(employerSigDate)}</span></div>
                                </div>
                                <div className={styles.signatureDisplay} style={{marginTop:'10px'}}>
                                    <img src={employerSigUrl} alt={`Eval ${evalNumber} Employer Sig`} style={{ maxHeight: '80px', border: '1px solid #ccc' }}/>
                                </div>
                            </div>
                         )}

                         {/* Message if waiting for employer */}
                         {status === `EVAL${evalNumber}_PENDING_EMPLOYER_SIGNATURE` && (
                             <p style={{fontStyle: 'italic', color: '#555', marginTop: '15px'}}>Waiting for employer signature.</p>
                         )}
                    </>
                )}
            </div>
        );
    };

    // --- Main Render ---
    return (
        <div className={styles.w9FormContainer}> {/* Reuse W9 styles */}
            <div className={styles.headerSection}>
                <h2 className={styles.title}>
                    I-983 Form ({status || 'DRAFT'})
                </h2>
                <button className={`${styles.button} ${styles.buttonBack}`} onClick={onBack} disabled={isSaving}>
                    Back to Forms List
                </button>
            </div>

            {/* --- Section 1: Student Information --- */}
             {(status === 'DRAFT' || !isAdding) && (
                <div className={styles.formSection} style={{ opacity: canEditSec1_2 ? 1 : 0.7 }}>
                    <h3>Section 1: Student Information</h3>
                    {/* ... Section 1 fields ... (Keep all fields as in previous version) */}
                    <div className={styles.formRow}> <div className={styles.formGroup}><label>Student Name</label><input name="STUDENT_NAME" value={safeValue(formData.STUDENT_NAME)} onChange={handleChange} disabled={!canEditSec1_2} /></div> <div className={styles.formGroup}><label>Student Email</label><input type="email" name="STUDENT_EMAIL" value={safeValue(formData.STUDENT_EMAIL)} onChange={handleChange} disabled={!canEditSec1_2} /></div> </div>
                    <div className={styles.formRow}> <div className={styles.formGroup}><label>School Recommending STEM OPT</label><input name="SCHOOL_RECOMMENDING" value={safeValue(formData.SCHOOL_RECOMMENDING)} onChange={handleChange} disabled={!canEditSec1_2} /></div> <div className={styles.formGroup}><label>School Where STEM Degree Was Earned</label><input name="SCHOOL_DEGREE_EARNED" value={safeValue(formData.SCHOOL_DEGREE_EARNED)} onChange={handleChange} disabled={!canEditSec1_2} /></div> </div>
                    <div className={styles.formRow}> <div className={styles.formGroup}><label>SEVIS School Code (Recommending)</label><input name="SCHOOL_CODE_RECOMMENDING" value={safeValue(formData.SCHOOL_CODE_RECOMMENDING)} onChange={handleChange} disabled={!canEditSec1_2} /></div> <div className={styles.formGroup}><label>Student SEVIS ID No.</label><input name="STUDENT_SEVIS_ID" value={safeValue(formData.STUDENT_SEVIS_ID)} onChange={handleChange} disabled={!canEditSec1_2} /></div> </div>
                    <div className={styles.formGroup}> <label>DSO Name and Contact Information</label> <textarea name="DSO_NAME_CONTACT" value={safeValue(formData.DSO_NAME_CONTACT)} onChange={handleChange} disabled={!canEditSec1_2} rows={3} /> </div>
                    <div className={styles.formRow}> <div className={styles.formGroup}><label>STEM OPT Period: From</label><input type="date" name="STEM_OPT_START_DATE" value={safeValue(formData.STEM_OPT_START_DATE)} onChange={handleChange} disabled={!canEditSec1_2} /></div> <div className={styles.formGroup}><label>STEM OPT Period: To</label><input type="date" name="STEM_OPT_END_DATE" value={safeValue(formData.STEM_OPT_END_DATE)} onChange={handleChange} disabled={!canEditSec1_2} /></div> </div>
                    <div className={styles.formGroup}> <label>Qualifying Major and CIP Code</label> <input name="QUALIFYING_MAJOR_CIP" value={safeValue(formData.QUALIFYING_MAJOR_CIP)} onChange={handleChange} disabled={!canEditSec1_2} /> </div>
                    <div className={styles.formRow}> <div className={styles.formGroup}> <label>Level/Type of Qualifying Degree</label> <input name="QUALIFYING_DEGREE_LEVEL" value={safeValue(formData.QUALIFYING_DEGREE_LEVEL)} onChange={handleChange} disabled={!canEditSec1_2} /> </div> <div className={styles.formGroup}> <label>Date Awarded</label> <input type="date" name="QUALIFYING_DEGREE_DATE" value={safeValue(formData.QUALIFYING_DEGREE_DATE)} onChange={handleChange} disabled={!canEditSec1_2} /> </div> </div>
                    <div className={styles.formRow}> <div className={styles.formGroup}> <label> <input type="checkbox" name="BASED_ON_PRIOR_DEGREE" checked={!!formData.BASED_ON_PRIOR_DEGREE} onChange={handleChange} disabled={!canEditSec1_2} className={styles.formCheckbox} /> Based on Prior Degree? </label> </div> <div className={styles.formGroup}> <label>Employment Authorization Number</label> <input name="EMPLOYMENT_AUTH_NUMBER" value={safeValue(formData.EMPLOYMENT_AUTH_NUMBER)} onChange={handleChange} disabled={!canEditSec1_2} /> </div> </div>
                </div>
            )}

            {/* --- Section 2: Student Certification --- */}
             {(status === 'DRAFT' || !isAdding) && (
                <div className={styles.formSection}>
                    <h3>Section 2: Student Certification</h3>
                    {canEditSec1_2 ? (
                        <>
                            <div className={styles.formRow}> <div className={styles.formGroup}> <label>Printed Name</label> <input name="STUDENT_PRINTED_NAME" value={safeValue(formData.STUDENT_PRINTED_NAME)} onChange={handleChange} disabled={!canEditSec1_2} /> </div> <div className={styles.formGroup}> <label>Date</label> <input type="date" name="STUDENT_SIGNATURE_DATE" value={safeValue(formData.STUDENT_SIGNATURE_DATE)} onChange={handleChange} required disabled={!canEditSec1_2} /> </div> </div>
                            <div className={styles.formGroup}> <label>Signature*</label> {formData.STUDENT_SIGNATURE_URL && !isAdding && ( <div className={styles.signatureDisplay} style={{ marginBottom: '10px' }}> <p>Current Signature:</p> <img src={formData.STUDENT_SIGNATURE_URL} alt="Current Sig" style={{ maxHeight: '60px', border: '1px solid #ccc' }}/> </div> )} <div className={styles.signatureCanvasWrapper}> <SignatureCanvas ref={sigCanvasSec2} canvasProps={{ className: styles.signatureCanvas }} /> </div> <button type="button" onClick={() => clearSignature(sigCanvasSec2)} className={`${styles.button} ${styles.clearButton}`}>Clear</button> </div>
                             <div className={styles.formButtons}> <button onClick={() => handleServerAction('save')} className={`${styles.button} ${styles.buttonSave}`} disabled={isSaving}> {isSaving ? 'Saving...' : 'Save Draft'} </button> <button onClick={() => handleServerAction('submit')} className={`${styles.button} ${styles.buttonSubmit}`} disabled={isSaving}> {isSaving ? 'Submitting...' : 'Submit Section 1 & 2'} </button> </div>
                        </>
                    ) : ( // Read-only Sec 2
                        <div className={styles.infoGrid}> <div className={styles.infoItem}><label>Printed Name:</label><span>{safeValue(formData.STUDENT_PRINTED_NAME)}</span></div> <div className={styles.infoItem}><label>Date Signed:</label><span>{formatDateDisplay(formData.STUDENT_SIGNATURE_DATE)}</span></div> {formData.STUDENT_SIGNATURE_URL && ( <div className={`${styles.infoItem} ${styles.infoItemFullWidth}`}> <label>Signature:</label> <div className={styles.signatureDisplay}> <img src={formData.STUDENT_SIGNATURE_URL} alt="Student Sig" style={{ maxHeight: '80px', border: '1px solid #ccc' }}/> </div> </div> )} </div>
                    )}
                </div>
            )}

             {/* --- Section 5: Training Plan (Student Input Parts) --- */}
             {(status === 'PAGE2_COMPLETE' || canEditSec5Names || status === 'PAGE3_SEC5_NAMES_COMPLETE' || status === 'PAGE3_SEC5_SITE_COMPLETE' || canEditSec5Training || status === 'PAGE3_SEC5_TRAINING_COMPLETE' || status === 'PAGE3_SEC5_OVERSIGHT_COMPLETE' || status === 'PAGE4_SEC6_COMPLETE' || status?.startsWith('EVAL') || status === 'FORM_COMPLETED') && (
                 <div className={styles.formSection}>
                    <h3>Section 5: Training Plan</h3>
                     {/* Sec 5 Names */}
                     <div className={styles.formRow}>
                        <div className={styles.formGroup}> <label>Student Name (Sec 5)</label> <input name="SEC5_STUDENT_NAME" value={safeValue(formData.SEC5_STUDENT_NAME)} onChange={handleChange} disabled={!canEditSec5Names} placeholder="Enter full name"/> </div>
                        <div className={styles.formGroup}> <label>Employer Name (Sec 5)</label> <input name="SEC5_EMPLOYER_NAME" value={safeValue(formData.SEC5_EMPLOYER_NAME)} disabled={true} placeholder="Employer name"/> </div>
                    </div>
                     {canEditSec5Names && ( <div className={styles.formButtons}> <button onClick={() => handleServerAction('submit')} className={`${styles.button} ${styles.buttonSubmit}`} disabled={isSaving}> {isSaving ? 'Submitting...' : 'Submit Names'} </button> </div> )}

                     {/* Sec 5 Training Details */}
                     {(status === 'PAGE3_SEC5_SITE_COMPLETE' || canEditSec5Training || status === 'PAGE3_SEC5_TRAINING_COMPLETE' || status === 'PAGE3_SEC5_OVERSIGHT_COMPLETE' || status === 'PAGE4_SEC6_COMPLETE' || status?.startsWith('EVAL') || status === 'FORM_COMPLETED') && (
                        <>
                             <div className={styles.formGroup} style={{marginTop:'15px'}}> <label>Student Role</label> <textarea name="SEC5_STUDENT_ROLE" value={safeValue(formData.SEC5_STUDENT_ROLE)} onChange={handleChange} disabled={!canEditSec5Training} rows={4} /> </div>
                             <div className={styles.formGroup}> <label>Goals and Objectives</label> <textarea name="SEC5_GOALS_OBJECTIVES" value={safeValue(formData.SEC5_GOALS_OBJECTIVES)} onChange={handleChange} disabled={!canEditSec5Training} rows={6} /> </div>
                             {canEditSec5Training && ( <div className={styles.formButtons}> <button onClick={() => handleServerAction('submit')} className={`${styles.button} ${styles.buttonSubmit}`} disabled={isSaving}> {isSaving ? 'Submitting...' : 'Submit Training Details'} </button> </div> )}
                        </>
                     )}

                     {/* Display messages if waiting */}
                     {status === 'PAGE1_COMPLETE' && <p style={{fontStyle:'italic', color:'#555'}}>Waiting for Employer to complete Section 3 & 4.</p>}
                     {status === 'PAGE3_SEC5_NAMES_COMPLETE' && <p style={{fontStyle:'italic', color:'#555'}}>Waiting for Employer to complete Section 5 Site Information.</p>}
                     {status === 'PAGE3_SEC5_TRAINING_COMPLETE' && <p style={{fontStyle:'italic', color:'#555'}}>Waiting for Employer to complete Section 5 Oversight/Measures.</p>}
                     {status === 'PAGE3_SEC5_OVERSIGHT_COMPLETE' && <p style={{fontStyle:'italic', color:'#555'}}>Waiting for Employer to complete Section 6 Certification.</p>}
                 </div>
            )}

            {/* --- Render Evaluation Sections (Student's Turn) --- */}
            {renderEvaluationSection(1, canEditEval1Student, sigCanvasEval1Student)}
            {renderEvaluationSection(2, canEditEval2Student, sigCanvasEval2Student)}

            {/* Message if form is completed or waiting on final employer action */}
            {status === 'EVAL1_PENDING_EMPLOYER_SIGNATURE' && <p style={{fontStyle:'italic', color:'#555', padding:'20px'}}>Evaluation 1 submitted. Waiting for Employer signature.</p>}
            {status === 'EVAL1_COMPLETE' && <p style={{fontStyle:'italic', color:'#555', padding:'20px'}}>Evaluation 1 complete. Waiting for Employer to initiate Final Evaluation.</p>}
            {status === 'EVAL2_PENDING_EMPLOYER_SIGNATURE' && <p style={{fontStyle:'italic', color:'#555', padding:'20px'}}>Final Evaluation submitted. Waiting for Employer signature.</p>}
            {status === 'FORM_COMPLETED' && <p style={{fontWeight:'bold', color:'green', padding:'20px'}}>This form has been fully completed.</p>}

            {/* Generic Save Draft Button (Only if DRAFT and not actively editing Sec 1/2) */}
            {status === 'DRAFT' && !canEditSec1_2 && (
                 <div className={styles.formButtons}> <button onClick={() => handleServerAction('save')} className={`${styles.button} ${styles.buttonSave}`} disabled={isSaving}> {isSaving ? 'Saving...' : 'Save Draft'} </button> </div>
            )}
        </div>
    );
};

export default I983Form;
// src/app/components/Employee/I983VerificationForm.jsx
// @ts-nocheck
'use client';

import React, { useState, useRef, useEffect } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import * as pdfjs from 'pdfjs-dist';
import {
  getI983FormDetails,
  saveOrUpdateI983Form,
  generateI983Pdf, // Import the new PDF generation action
} from '@/app/serverActions/forms/i983/actions'; // Import server action
// Import new CSS module
import i983_styles from '../Forms/I983Form/I983Form.module.css';

// Initialize PDF.js worker
if (typeof window !== 'undefined') {
    pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;
}

// Helper function to safely get values for controlled inputs
const safeValue = (value, defaultValue = '') => value ?? defaultValue;

// Helper function to format dates for input type="date" (YYYY-MM-DD)
const formatDateForInput = (dateStr) => {
    if (!dateStr) return '';
    try {
        const date = new Date(dateStr);
        const year = date.getUTCFullYear();
        const month = String(date.getUTCMonth() + 1).padStart(2, '0');
        const day = String(date.getUTCDate()).padStart(2, '0');
         if (year < 1900 || year > 2100) return '';
        return `${year}-${month}-${day}`;
    } catch (e) { return ''; }
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
    } catch (e) { return 'Invalid Date'; }
};

// Helper function to map fetched data to the formData state
const mapFetchedToState = (fetchedForm = {}) => {    
    return {
        // Section 1
        STUDENT_NAME: safeValue(fetchedForm.STUDENT_NAME),
        STUDENT_EMAIL: safeValue(fetchedForm.STUDENT_EMAIL),
        SCHOOL_RECOMMENDING: safeValue(fetchedForm.SCHOOL_RECOMMENDING),
        SCHOOL_DEGREE_EARNED: safeValue(fetchedForm.SCHOOL_DEGREE_EARNED),
        SCHOOL_CODE_RECOMMENDING: safeValue(fetchedForm.SCHOOL_CODE_RECOMMENDING),
        DSO_NAME_CONTACT: safeValue(fetchedForm.DSO_NAME_CONTACT),
        STUDENT_SEVIS_ID: safeValue(fetchedForm.STUDENT_SEVIS_ID),
        STEM_OPT_START_DATE: formatDateForInput(fetchedForm.STEM_OPT_START_DATE),
        STEM_OPT_END_DATE: formatDateForInput(fetchedForm.STEM_OPT_END_DATE),
        QUALIFYING_MAJOR_CIP: safeValue(fetchedForm.QUALIFYING_MAJOR_CIP),
        QUALIFYING_DEGREE_LEVEL: safeValue(fetchedForm.QUALIFYING_DEGREE_LEVEL),
        QUALIFYING_DEGREE_DATE: formatDateForInput(fetchedForm.QUALIFYING_DEGREE_DATE),
        BASED_ON_PRIOR_DEGREE: !!fetchedForm.BASED_ON_PRIOR_DEGREE,
        EMPLOYMENT_AUTH_NUMBER: safeValue(fetchedForm.EMPLOYMENT_AUTH_NUMBER),
        // Section 2
        STUDENT_PRINTED_NAME: safeValue(fetchedForm.STUDENT_PRINTED_NAME),
        STUDENT_SIGNATURE_DATE: formatDateForInput(fetchedForm.STUDENT_SIGNATURE_DATE),
        // Section 3
        EMPLOYER_NAME: safeValue(fetchedForm.EMPLOYER_NAME),
        EMPLOYER_WEBSITE: safeValue(fetchedForm.EMPLOYER_WEBSITE),
        EMPLOYER_EIN: safeValue(fetchedForm.EMPLOYER_EIN),
        EMPLOYER_STREET_ADDRESS: safeValue(fetchedForm.EMPLOYER_STREET_ADDRESS),
        EMPLOYER_SUITE: safeValue(fetchedForm.EMPLOYER_SUITE),
        EMPLOYER_CITY: safeValue(fetchedForm.EMPLOYER_CITY),
        EMPLOYER_STATE: safeValue(fetchedForm.EMPLOYER_STATE),
        EMPLOYER_ZIP: safeValue(fetchedForm.EMPLOYER_ZIP),
        EMPLOYER_NUM_FT_EMPLOYEES: safeValue(fetchedForm.EMPLOYER_NUM_FT_EMPLOYEES),
        EMPLOYER_NAICS_CODE: safeValue(fetchedForm.EMPLOYER_NAICS_CODE),
        OPT_HOURS_PER_WEEK: safeValue(fetchedForm.OPT_HOURS_PER_WEEK),
        START_DATE_OF_EMPLOYMENT: formatDateForInput(fetchedForm.START_DATE_OF_EMPLOYMENT),
        SALARY_AMOUNT: safeValue(fetchedForm.SALARY_AMOUNT),
        SALARY_FREQUENCY: safeValue(fetchedForm.SALARY_FREQUENCY),
        OTHER_COMPENSATION_1: safeValue(fetchedForm.OTHER_COMPENSATION_1),
        OTHER_COMPENSATION_2: safeValue(fetchedForm.OTHER_COMPENSATION_2),
        OTHER_COMPENSATION_3: safeValue(fetchedForm.OTHER_COMPENSATION_3),
        OTHER_COMPENSATION_4: safeValue(fetchedForm.OTHER_COMPENSATION_4),
        // Section 4
        EMPLOYER_OFFICIAL_PRINTED_NAME_TITLE: safeValue(fetchedForm.EMPLOYER_OFFICIAL_PRINTED_NAME_TITLE),
        EMPLOYER_PRINTED_NAME_ORG: safeValue(fetchedForm.EMPLOYER_PRINTED_NAME_ORG),
        EMPLOYER_OFFICIAL_SIGNATURE_DATE: formatDateForInput(fetchedForm.EMPLOYER_OFFICIAL_SIGNATURE_DATE) || new Date().toISOString().split('T')[0],
        // Section 5
        SEC5_STUDENT_NAME: safeValue(fetchedForm.SEC5_STUDENT_NAME),
        SEC5_EMPLOYER_NAME: safeValue(fetchedForm.SEC5_EMPLOYER_NAME, fetchedForm.EMPLOYER_NAME),
        SEC5_SITE_NAME: safeValue(fetchedForm.SEC5_SITE_NAME),
        SEC5_SITE_ADDRESS: safeValue(fetchedForm.SEC5_SITE_ADDRESS),
        SEC5_OFFICIAL_NAME: safeValue(fetchedForm.SEC5_OFFICIAL_NAME),
        SEC5_OFFICIAL_TITLE: safeValue(fetchedForm.SEC5_OFFICIAL_TITLE),
        SEC5_OFFICIAL_EMAIL: safeValue(fetchedForm.SEC5_OFFICIAL_EMAIL),
        SEC5_OFFICIAL_PHONE: safeValue(fetchedForm.SEC5_OFFICIAL_PHONE),
        SEC5_STUDENT_ROLE: safeValue(fetchedForm.SEC5_STUDENT_ROLE),
        SEC5_GOALS_OBJECTIVES: safeValue(fetchedForm.SEC5_GOALS_OBJECTIVES),
        SEC5_EMPLOYER_OVERSIGHT: safeValue(fetchedForm.SEC5_EMPLOYER_OVERSIGHT),
        SEC5_MEASURES_ASSESSMENTS: safeValue(fetchedForm.SEC5_MEASURES_ASSESSMENTS),
        SEC5_ADDITIONAL_REMARKS: safeValue(fetchedForm.SEC5_ADDITIONAL_REMARKS),
        // Section 6
        EMPLOYER_OFFICIAL_SEC6_PRINTED_NAME_TITLE: safeValue(fetchedForm.EMPLOYER_OFFICIAL_SEC6_PRINTED_NAME_TITLE),
        EMPLOYER_OFFICIAL_SEC6_SIGNATURE_DATE: formatDateForInput(fetchedForm.EMPLOYER_OFFICIAL_SEC6_SIGNATURE_DATE) || new Date().toISOString().split('T')[0],
        // Eval 1
        EVAL1_FROM_DATE: formatDateForInput(fetchedForm.EVAL1_FROM_DATE),
        EVAL1_TO_DATE: formatDateForInput(fetchedForm.EVAL1_TO_DATE),
        EVAL1_STUDENT_EVALUATION: safeValue(fetchedForm.EVAL1_STUDENT_EVALUATION),
        EVAL1_STUDENT_SIGNATURE_DATE: formatDateForInput(fetchedForm.EVAL1_STUDENT_SIGNATURE_DATE),
        EVAL1_EMPLOYER_SIGNATURE_DATE: formatDateForInput(fetchedForm.EVAL1_EMPLOYER_SIGNATURE_DATE) || new Date().toISOString().split('T')[0],
        // Eval 2
        EVAL2_FROM_DATE: formatDateForInput(fetchedForm.EVAL2_FROM_DATE),
        EVAL2_TO_DATE: formatDateForInput(fetchedForm.EVAL2_TO_DATE),
        EVAL2_STUDENT_EVALUATION: safeValue(fetchedForm.EVAL2_STUDENT_EVALUATION),
        EVAL2_STUDENT_SIGNATURE_DATE: formatDateForInput(fetchedForm.EVAL2_STUDENT_SIGNATURE_DATE),
        EVAL2_EMPLOYER_SIGNATURE_DATE: formatDateForInput(fetchedForm.EVAL2_EMPLOYER_SIGNATURE_DATE) || new Date().toISOString().split('T')[0],
    };
};


const I983VerificationForm = ({
  form, // The full I-983 form data fetched from server
  verifierEmpId,
  orgId,
  orgName,
  onBack,
  onSuccess,
  onError,
  isAdmin
}) => {
    
    // Full form data state
    const [formData, setFormData] = useState(mapFetchedToState());
    
    // Store the last fetched data to display read-only info
    const [existingForm, setExistingForm] = useState(null);
    const [isSaving, setIsSaving] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false); // New state for generate
    const [currentFormId, setCurrentFormId] = useState(null);
    const [currentPage, setCurrentPage] = useState(1); // Page 1-5

    // Signature Canvases for EMPLOYER
    const sigCanvasSec4 = useRef(null);
    const sigCanvasSec6 = useRef(null);
    const sigCanvasEval1Employer = useRef(null);
    const sigCanvasEval2Employer = useRef(null);

    // Signature Type States (canvas or pdf) for each signature
    const [signatureTypeSec4, setSignatureTypeSec4] = useState('canvas');
    const [signatureTypeSec6, setSignatureTypeSec6] = useState('canvas');
    const [signatureTypeEval1, setSignatureTypeEval1] = useState('canvas');
    const [signatureTypeEval2, setSignatureTypeEval2] = useState('canvas');

    // PDF signature states for each signature
    const [pdfSignaturePreviewSec4, setPdfSignaturePreviewSec4] = useState(null);
    const [pdfSignaturePreviewSec6, setPdfSignaturePreviewSec6] = useState(null);
    const [pdfSignaturePreviewEval1, setPdfSignaturePreviewEval1] = useState(null);
    const [pdfSignaturePreviewEval2, setPdfSignaturePreviewEval2] = useState(null);

    // PDF extraction loading states
    const [isExtractingSec4, setIsExtractingSec4] = useState(false);
    const [isExtractingSec6, setIsExtractingSec6] = useState(false);
    const [isExtractingEval1, setIsExtractingEval1] = useState(false);
    const [isExtractingEval2, setIsExtractingEval2] = useState(false);

    // PDF file input refs
    const pdfFileInputSec4 = useRef(null);
    const pdfFileInputSec6 = useRef(null);
    const pdfFileInputEval1 = useRef(null);
    const pdfFileInputEval2 = useRef(null);

    // --- Data Loading Effect ---
    useEffect(() => {
        if (form) {
            // When the 'form' prop (from VerificationContainer) is passed, use it
            setExistingForm(form);
            setCurrentFormId(form.ID); // This ID might have a prefix
            // Load state from the passed 'form' prop
            setFormData(mapFetchedToState(form));
        }
    }, [form]); // Depend on the 'form' prop

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const clearSignature = (sigRef) => {
        sigRef.current?.clear();
    };

    // PDF extraction function for signature
    const extractSignatureFromPdf = async (file) => {
        try {
            const arrayBuffer = await file.arrayBuffer();
            const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
            const page = await pdf.getPage(1);
            const scale = 2;
            const viewport = page.getViewport({ scale });
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.height = viewport.height;
            canvas.width = viewport.width;
            await page.render({ canvasContext: context, viewport: viewport }).promise;
            return canvas.toDataURL('image/png');
        } catch (error) {
            console.error('Error extracting signature from PDF:', error);
            throw new Error('Failed to extract signature from PDF');
        }
    };

    // Handle PDF file change for Section 4 Signature
    const handlePdfFileChangeSec4 = async (e) => {
        const file = e.target.files[0];
        if (!file || file.type !== 'application/pdf') {
            if (file) onError('Please upload a PDF file');
            return;
        }
        setIsExtractingSec4(true);
        try {
            const signatureDataUrl = await extractSignatureFromPdf(file);
            setPdfSignaturePreviewSec4(signatureDataUrl);
        } catch (error) {
            onError('Failed to extract signature from PDF.');
            setPdfSignaturePreviewSec4(null);
        } finally {
            setIsExtractingSec4(false);
        }
    };

    // Handle PDF file change for Section 6 Signature
    const handlePdfFileChangeSec6 = async (e) => {
        const file = e.target.files[0];
        if (!file || file.type !== 'application/pdf') {
            if (file) onError('Please upload a PDF file');
            return;
        }
        setIsExtractingSec6(true);
        try {
            const signatureDataUrl = await extractSignatureFromPdf(file);
            setPdfSignaturePreviewSec6(signatureDataUrl);
        } catch (error) {
            onError('Failed to extract signature from PDF.');
            setPdfSignaturePreviewSec6(null);
        } finally {
            setIsExtractingSec6(false);
        }
    };

    // Handle PDF file change for Eval 1 Signature
    const handlePdfFileChangeEval1 = async (e) => {
        const file = e.target.files[0];
        if (!file || file.type !== 'application/pdf') {
            if (file) onError('Please upload a PDF file');
            return;
        }
        setIsExtractingEval1(true);
        try {
            const signatureDataUrl = await extractSignatureFromPdf(file);
            setPdfSignaturePreviewEval1(signatureDataUrl);
        } catch (error) {
            onError('Failed to extract signature from PDF.');
            setPdfSignaturePreviewEval1(null);
        } finally {
            setIsExtractingEval1(false);
        }
    };

    // Handle PDF file change for Eval 2 Signature
    const handlePdfFileChangeEval2 = async (e) => {
        const file = e.target.files[0];
        if (!file || file.type !== 'application/pdf') {
            if (file) onError('Please upload a PDF file');
            return;
        }
        setIsExtractingEval2(true);
        try {
            const signatureDataUrl = await extractSignatureFromPdf(file);
            setPdfSignaturePreviewEval2(signatureDataUrl);
        } catch (error) {
            onError('Failed to extract signature from PDF.');
            setPdfSignaturePreviewEval2(null);
        } finally {
            setIsExtractingEval2(false);
        }
    };

    // Clear PDF signatures
    const clearPdfSignatureSec4 = () => { setPdfSignaturePreviewSec4(null); if (pdfFileInputSec4.current) pdfFileInputSec4.current.value = ''; };
    const clearPdfSignatureSec6 = () => { setPdfSignaturePreviewSec6(null); if (pdfFileInputSec6.current) pdfFileInputSec6.current.value = ''; };
    const clearPdfSignatureEval1 = () => { setPdfSignaturePreviewEval1(null); if (pdfFileInputEval1.current) pdfFileInputEval1.current.value = ''; };
    const clearPdfSignatureEval2 = () => { setPdfSignaturePreviewEval2(null); if (pdfFileInputEval2.current) pdfFileInputEval2.current.value = ''; };

    // Get signature data based on type
    const getSignatureData = (type, sigCanvas, pdfPreview) => {
        if (type === 'canvas') {
            if (sigCanvas?.current && !sigCanvas.current.isEmpty()) {
                const data = sigCanvas.current.toDataURL('image/png');
                sigCanvas.current.clear();
                return data;
            }
            return null;
        } else if (type === 'pdf' && pdfPreview) {
            return pdfPreview;
        }
        return null;
    };

    // --- Server Action Handlers ---

    const handleSave = async (showSuccess = true) => {
        onError(null); // Clear any existing errors
        // Do not call onSuccess('') as that is the prop that closes the form
        
        setIsSaving(true);
        let success = false;
        
        // Ensure currentFormId is the numeric ID
        const numericFormId = parseInt(String(currentFormId).replace('I983-', ''));
        if (isNaN(numericFormId)) {
            onError("Invalid Form ID.");
            setIsSaving(false);
            return { success: false, formId: null };
        }

        try {
            const payload = {
                ...formData,
                orgid: orgId, // Use orgId from props
                emp_id: form.EMP_ID, // Use emp_id from original form prop
                action: 'save',
            };

            // Get signature data based on selected type (canvas or pdf)
            const sec4SigData = getSignatureData(signatureTypeSec4, sigCanvasSec4, pdfSignaturePreviewSec4);
            const sec6SigData = getSignatureData(signatureTypeSec6, sigCanvasSec6, pdfSignaturePreviewSec6);
            const eval1SigData = getSignatureData(signatureTypeEval1, sigCanvasEval1Employer, pdfSignaturePreviewEval1);
            const eval2SigData = getSignatureData(signatureTypeEval2, sigCanvasEval2Employer, pdfSignaturePreviewEval2);

            // Conditionally add EMPLOYER signatures ONLY if they exist
            if (sec4SigData) payload.signature_data_sec4 = sec4SigData;
            if (sec6SigData) payload.signature_data_sec6 = sec6SigData;
            if (eval1SigData) payload.signature_data_eval1_employer = eval1SigData;
            if (eval2SigData) payload.signature_data_eval2_employer = eval2SigData;

            // Clear PDF previews after save
            if (signatureTypeSec4 === 'pdf' && pdfSignaturePreviewSec4) clearPdfSignatureSec4();
            if (signatureTypeSec6 === 'pdf' && pdfSignaturePreviewSec6) clearPdfSignatureSec6();
            if (signatureTypeEval1 === 'pdf' && pdfSignaturePreviewEval1) clearPdfSignatureEval1();
            if (signatureTypeEval2 === 'pdf' && pdfSignaturePreviewEval2) clearPdfSignatureEval2();

            console.log("Calling saveOrUpdateI983Form (Save)...");
            const result = await saveOrUpdateI983Form(payload, numericFormId);

            if (result.success) {
                if (showSuccess) {
                    // We can't call onSuccess, so we'll just clear the error
                    // to indicate success.
                    onError(null); 
                }
                
                // Re-fetch data to update 'existingForm' with new sig URLs
                const updatedForm = await getI983FormDetails(result.id);
                setExistingForm(updatedForm);
                // Re-set formData to match the fetched data
                setFormData(mapFetchedToState(updatedForm));
                success = true;
            } else {
                throw new Error(result.error);
            }
        } catch (err) {
            onError(err.message || 'Failed to save I-983 form.');
            console.error('Error during save:', err);
        } finally {
            setIsSaving(false);
            return { success, formId: numericFormId }; // Return success state and ID
        }
    };

    const handleGenerate = async () => {
        onError(null);
        onSuccess(''); // Clear any previous success message
        
        // 1. Save any pending changes first
        setIsGenerating(true);
        const { success: saveSuccess, formId: savedFormId } = await handleSave(false); // Save without success message
        
        if (!saveSuccess || !savedFormId) {
            onError("Failed to save changes. Cannot generate PDF.");
            setIsGenerating(false);
            return;
        }
        
        // 2. If save was successful, generate PDF
        console.log(`Generating PDF for Form ID: ${savedFormId}`);
        try {
            // FIX: Clear any non-blocking save errors
            onError(null);
            
            const result = await generateI983Pdf(savedFormId, verifierEmpId);
            
            if (result.success) {
                // This call IS supposed to close the form and refresh the list.
                onSuccess("PDF Generated successfully! Returning to list...");
                
                // No need for timeout, onSuccess handles the navigation.
                // onBack() is called by the parent's handleVerificationSuccess
            } else {
                throw new Error(result.error);
            }
        } catch (err) {
             onError(err.message || 'Failed to generate PDF.');
             console.error('Error during generate:', err);
             setIsGenerating(false); // Stop loading if generate fails
        }
        // Don't set isGenerating to false here if successful,
        // as the component is about to unmount.
    };


    // --- Render Read-Only Signature ---
    const renderReadOnlySignature = (label, sigUrl, date, name) => {
        if (!sigUrl) {
            return (
                <div className={i983_styles.i983_formGroup}>
                    <label>{label}</label>
                    <div className={i983_styles.i983_infoGrid}><span style={{ fontStyle: 'italic' }}>Not Signed</span></div>
                </div>
            );
        }
        return (
            <div className={i983_styles.i983_formGroup}>
                <label>{label}</label>
                <div className={i983_styles.i983_infoGrid}>
                    <div className={i983_styles.i983_infoItem}><label>Name:</label><span>{safeValue(name, 'N/A')}</span></div>
                    <div className={i983_styles.i983_infoItem}><label>Date Signed:</label><span>{formatDateDisplay(date)}</span></div>
                </div>
                <div className={i983_styles.i983_signatureDisplay} style={{ marginTop: '10px' }}>
                    <img src={sigUrl} alt={label} style={{ maxHeight: '80px', border: '1px solid #ccc', borderRadius: '4px' }}/>
                </div>
            </div>
        );
    };

    // --- Render Page Buttons ---
    const renderPageButtons = () => (
        <div className={i983_styles.i983_formButtons}>
            <button 
                type="button" 
                className={`${i983_styles.i983_button} ${i983_styles.i983_buttonSave}`} 
                onClick={() => handleSave(true)} 
                disabled={isSaving || isGenerating} // Disable if saving OR generating
            >
                {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
        </div>
    );

    // --- Page Render Functions ---
    const renderPage1 = () => (
        <>
            <div className={i983_styles.i983_formSection}>
                {/* --- Section 1: Student Information --- */}
                <h3>Section 1: Student Information</h3>
                <div className={i983_styles.i983_formRow}>
                    <div className={i983_styles.i983_formGroup}><label>Student Name</label><input name="STUDENT_NAME" value={safeValue(formData.STUDENT_NAME)} onChange={handleChange} disabled={isSaving || isGenerating} /></div>
                    <div className={i983_styles.i983_formGroup}><label>Student Email</label><input type="email" name="STUDENT_EMAIL" value={safeValue(formData.STUDENT_EMAIL)} onChange={handleChange} disabled={isSaving || isGenerating} /></div>
                </div>
                {/* ... (all other Section 1 fields) ... */}
                <div className={i983_styles.i983_formRow}>
                    <div className={i983_styles.i983_formGroup}><label>School Recommending STEM OPT</label><input name="SCHOOL_RECOMMENDING" value={safeValue(formData.SCHOOL_RECOMMENDING)} onChange={handleChange} disabled={isSaving || isGenerating} /></div>
                    <div className={i983_styles.i983_formGroup}><label>School Where STEM Degree Was Earned</label><input name="SCHOOL_DEGREE_EARNED" value={safeValue(formData.SCHOOL_DEGREE_EARNED)} onChange={handleChange} disabled={isSaving || isGenerating} /></div>
                </div>
                <div className={i983_styles.i983_formRow}>
                    <div className={i983_styles.i983_formGroup}><label>SEVIS School Code (Recommending)</label><input name="SCHOOL_CODE_RECOMMENDING" value={safeValue(formData.SCHOOL_CODE_RECOMMENDING)} onChange={handleChange} disabled={isSaving || isGenerating} /></div>
                    <div className={i983_styles.i983_formGroup}><label>Student SEVIS ID No.</label><input name="STUDENT_SEVIS_ID" value={safeValue(formData.STUDENT_SEVIS_ID)} onChange={handleChange} disabled={isSaving || isGenerating} /></div>
                </div>
                <div className={i983_styles.i983_formGroup}>
                    <label>DSO Name and Contact Information</label>
                    <textarea name="DSO_NAME_CONTACT" value={safeValue(formData.DSO_NAME_CONTACT)} onChange={handleChange} disabled={isSaving || isGenerating} rows={3} />
                </div>
                <div className={i983_styles.i983_formRow}>
                    <div className={i983_styles.i983_formGroup}><label>STEM OPT Period: From</label><input type="date" name="STEM_OPT_START_DATE" value={safeValue(formData.STEM_OPT_START_DATE)} onChange={handleChange} disabled={isSaving || isGenerating} /></div>
                    <div className={i983_styles.i983_formGroup}><label>STEM OPT Period: To</label><input type="date" name="STEM_OPT_END_DATE" value={safeValue(formData.STEM_OPT_END_DATE)} onChange={handleChange} disabled={isSaving || isGenerating} /></div>
                </div>
                <div className={i983_styles.i983_formGroup}>
                    <label>Qualifying Major and CIP Code</label>
                    <input name="QUALIFYING_MAJOR_CIP" value={safeValue(formData.QUALIFYING_MAJOR_CIP)} onChange={handleChange} disabled={isSaving || isGenerating} />
                </div>
                <div className={i983_styles.i983_formRow}>
                    <div className={i983_styles.i983_formGroup}><label>Level/Type of Qualifying Degree</label><input name="QUALIFYING_DEGREE_LEVEL" value={safeValue(formData.QUALIFYING_DEGREE_LEVEL)} onChange={handleChange} disabled={isSaving || isGenerating} /></div>
                    <div className={i983_styles.i983_formGroup}><label>Date Awarded</label><input type="date" name="QUALIFYING_DEGREE_DATE" value={safeValue(formData.QUALIFYING_DEGREE_DATE)} onChange={handleChange} disabled={isSaving || isGenerating} /></div>
                </div>
                <div className={i983_styles.i983_formRow}>
                    <div className={i983_styles.i983_formGroup}><label><input type="checkbox" name="BASED_ON_PRIOR_DEGREE" checked={!!formData.BASED_ON_PRIOR_DEGREE} onChange={handleChange} disabled={isSaving || isGenerating} className={i983_styles.i983_formCheckbox} /> Based on Prior Degree?</label></div>
                    <div className={i983_styles.i983_formGroup}><label>Employment Authorization Number</label><input name="EMPLOYMENT_AUTH_NUMBER" value={safeValue(formData.EMPLOYMENT_AUTH_NUMBER)} onChange={handleChange} disabled={isSaving || isGenerating} /></div>
                </div>
            </div>

            {/* --- Section 2: Student Certification (Read-Only) --- */}
            <div className={i983_styles.i983_formSection}>
                <h3>Section 2: Student Certification</h3>
                <div className={i983_styles.i983_formRow}>
                    <div className={i983_styles.i983_formGroup}><label>Printed Name</label><input name="STUDENT_PRINTED_NAME" value={safeValue(formData.STUDENT_PRINTED_NAME)} onChange={handleChange} disabled={isSaving || isGenerating} /></div>
                    <div className={i983_styles.i983_formGroup}><label>Date</label><input type="date" name="STUDENT_SIGNATURE_DATE" value={safeValue(formData.STUDENT_SIGNATURE_DATE)} onChange={handleChange} disabled={isSaving || isGenerating} /></div>
                </div>
                {renderReadOnlySignature(
                    "Student Signature (Read-Only)",
                    existingForm?.STUDENT_SIGNATURE_URL,
                    existingForm?.STUDENT_SIGNATURE_DATE,
                    existingForm?.STUDENT_PRINTED_NAME
                )}
            </div>
            {renderPageButtons()}
        </>
    );

    const renderPage2 = () => (
        <>
            {/* --- Section 3: Employer Information --- */}
            <div className={i983_styles.i983_formSection}>
                <h3>Section 3: Employer Information</h3>
                <div className={i983_styles.i983_formRow}>
                    <div className={i983_styles.i983_formGroup}><label>Employer Name</label><input name="EMPLOYER_NAME" value={safeValue(formData.EMPLOYER_NAME)} onChange={handleChange} disabled={isSaving || isGenerating} /></div>
                    <div className={i983_styles.i983_formGroup}><label>Employer Website</label><input name="EMPLOYER_WEBSITE" value={safeValue(formData.EMPLOYER_WEBSITE)} onChange={handleChange} disabled={isSaving || isGenerating} /></div>
                    <div className={i983_styles.i983_formGroup}><label>Employer EIN</label><input name="EMPLOYER_EIN" value={safeValue(formData.EMPLOYER_EIN)} onChange={handleChange} disabled={isSaving || isGenerating} /></div>
                </div>
                {/* ... (all other Section 3 fields) ... */}
                <div className={i983_styles.i983_formRow}>
                    <div className={i983_styles.i983_formGroup}><label>Street Address</label><input name="EMPLOYER_STREET_ADDRESS" value={safeValue(formData.EMPLOYER_STREET_ADDRESS)} onChange={handleChange} disabled={isSaving || isGenerating} /></div>
                    <div className={i983_styles.i983_formGroup}><label>Suite</label><input name="EMPLOYER_SUITE" value={safeValue(formData.EMPLOYER_SUITE)} onChange={handleChange} disabled={isSaving || isGenerating} /></div>
                </div>
                <div className={i983_styles.i983_formRow}>
                    <div className={i983_styles.i983_formGroup}><label>City</label><input name="EMPLOYER_CITY" value={safeValue(formData.EMPLOYER_CITY)} onChange={handleChange} disabled={isSaving || isGenerating} /></div>
                    <div className={i983_styles.i983_formGroup}><label>State</label><input name="EMPLOYER_STATE" value={safeValue(formData.EMPLOYER_STATE)} onChange={handleChange} disabled={isSaving || isGenerating} /></div>
                    <div className={i983_styles.i983_formGroup}><label>ZIP Code</label><input name="EMPLOYER_ZIP" value={safeValue(formData.EMPLOYER_ZIP)} onChange={handleChange} disabled={isSaving || isGenerating} /></div>
                </div>
                <div className={i983_styles.i983_formRow}>
                    <div className={i983_styles.i983_formGroup}><label># Full-Time Employees (US)</label><input type="number" name="EMPLOYER_NUM_FT_EMPLOYEES" value={safeValue(formData.EMPLOYER_NUM_FT_EMPLOYEES)} onChange={handleChange} disabled={isSaving || isGenerating} min="0"/></div>
                    <div className={i983_styles.i983_formGroup}><label>NAICS Code</label><input name="EMPLOYER_NAICS_CODE" value={safeValue(formData.EMPLOYER_NAICS_CODE)} onChange={handleChange} disabled={isSaving || isGenerating} /></div>
                    <div className={i983_styles.i983_formGroup}><label>OPT Hours/Week (min 20)</label><input type="number" name="OPT_HOURS_PER_WEEK" value={safeValue(formData.OPT_HOURS_PER_WEEK)} onChange={handleChange} disabled={isSaving || isGenerating} min="20"/></div>
                </div>
                <div className={i983_styles.i983_formRow}>
                    <div className={i983_styles.i983_formGroup}><label>Start Date of Employment</label><input type="date" name="START_DATE_OF_EMPLOYMENT" value={safeValue(formData.START_DATE_OF_EMPLOYMENT)} onChange={handleChange} disabled={isSaving || isGenerating} /></div>
                    <div className={i983_styles.i983_formGroup}><label>Salary Amount</label><input type="number" step="0.01" name="SALARY_AMOUNT" value={safeValue(formData.SALARY_AMOUNT)} onChange={handleChange} disabled={isSaving || isGenerating} min="0"/></div>
                    <div className={i983_styles.i983_formGroup}><label>Salary Frequency</label><input name="SALARY_FREQUENCY" value={safeValue(formData.SALARY_FREQUENCY)} onChange={handleChange} disabled={isSaving || isGenerating} /></div>
                </div>
                <h4>Other Compensation</h4>
                <div className={i983_styles.i983_formRow}>
                    <div className={i983_styles.i983_formGroup}><label>1.</label><input name="OTHER_COMPENSATION_1" value={safeValue(formData.OTHER_COMPENSATION_1)} onChange={handleChange} disabled={isSaving || isGenerating} /></div>
                    <div className={i983_styles.i983_formGroup}><label>2.</label><input name="OTHER_COMPENSATION_2" value={safeValue(formData.OTHER_COMPENSATION_2)} onChange={handleChange} disabled={isSaving || isGenerating} /></div>
                    <div className={i983_styles.i983_formGroup}><label>3.</label><input name="OTHER_COMPENSATION_3" value={safeValue(formData.OTHER_COMPENSATION_3)} onChange={handleChange} disabled={isSaving || isGenerating} /></div>
                    <div className={i983_styles.i983_formGroup}><label>4.</label><input name="OTHER_COMPENSATION_4" value={safeValue(formData.OTHER_COMPENSATION_4)} onChange={handleChange} disabled={isSaving || isGenerating} /></div>
                </div>
            </div>

            {/* --- Section 4: Employer Certification (Live) --- */}
            <div className={i983_styles.i983_formSection}>
                <h3>Section 4: Employer Certification</h3>
                <div className={i983_styles.i983_formRow}>
                    <div className={i983_styles.i983_formGroup}><label>Printed Name and Title of Employer Official</label><input name="EMPLOYER_OFFICIAL_PRINTED_NAME_TITLE" value={safeValue(formData.EMPLOYER_OFFICIAL_PRINTED_NAME_TITLE)} onChange={handleChange} disabled={isSaving || isGenerating} /></div>
                    <div className={i983_styles.i983_formGroup}><label>Printed Name of Employing Organization</label><input name="EMPLOYER_PRINTED_NAME_ORG" value={safeValue(formData.EMPLOYER_PRINTED_NAME_ORG, orgName)} onChange={handleChange} disabled={isSaving || isGenerating} /></div>
                </div>
                <div className={i983_styles.i983_formRow}>
                    <div className={i983_styles.i983_formGroup}><label>Date</label><input type="date" name="EMPLOYER_OFFICIAL_SIGNATURE_DATE" value={safeValue(formData.EMPLOYER_OFFICIAL_SIGNATURE_DATE)} onChange={handleChange} disabled={isSaving || isGenerating} /></div>
                </div>
                <div className={i983_styles.i983_formGroup}>
                    <label>Signature of Employer Official*</label>
                    {existingForm?.EMPLOYER_OFFICIAL_SIGNATURE_URL && (
                        <div className={i983_styles.i983_signatureDisplay} style={{ marginBottom: '10px' }}>
                            <p>Current Signature:</p>
                            <img src={existingForm.EMPLOYER_OFFICIAL_SIGNATURE_URL} alt="Current Sig" style={{ maxHeight: '60px', border: '1px solid #ccc' }}/>
                        </div>
                    )}
                    
                    {/* Signature Type Selection */}
                    <div style={{ marginBottom: '15px', padding: '10px', backgroundColor: '#f8f9fa', borderRadius: '4px' }}>
                        <p style={{ margin: '0 0 10px 0', fontSize: '14px', fontWeight: '500' }}>Choose signature method:</p>
                        <div style={{ display: 'flex', gap: '20px' }}>
                            <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                                <input type="radio" name="signatureTypeSec4" value="canvas" checked={signatureTypeSec4 === 'canvas'} onChange={(e) => setSignatureTypeSec4(e.target.value)} style={{ marginRight: '8px' }} />
                                Draw Signature
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                                <input type="radio" name="signatureTypeSec4" value="pdf" checked={signatureTypeSec4 === 'pdf'} onChange={(e) => setSignatureTypeSec4(e.target.value)} style={{ marginRight: '8px' }} />
                                Upload Signature PDF
                            </label>
                        </div>
                    </div>

                    {/* Canvas Signature Option */}
                    {signatureTypeSec4 === 'canvas' && (
                        <>
                            <div className={i983_styles.i983_signatureCanvasWrapper}><SignatureCanvas ref={sigCanvasSec4} canvasProps={{ className: i983_styles.i983_signatureCanvas }} /></div>
                            <button type="button" onClick={() => clearSignature(sigCanvasSec4)} className={`${i983_styles.i983_button} ${i983_styles.i983_clearButton}`}>Clear Signature</button>
                        </>
                    )}

                    {/* PDF Upload Option */}
                    {signatureTypeSec4 === 'pdf' && (
                        <>
                            <p style={{ margin: '0 0 10px 0', fontSize: '13px', color: '#666' }}>Upload a PDF file containing your signature.</p>
                            <div style={{ marginBottom: '10px' }}>
                                <input type="file" ref={pdfFileInputSec4} accept="application/pdf" onChange={handlePdfFileChangeSec4} disabled={isExtractingSec4} style={{ padding: '10px', border: '2px dashed #007bff', borderRadius: '4px', width: '100%', maxWidth: '400px', backgroundColor: '#fff' }} />
                            </div>
                            {isExtractingSec4 && <p style={{ color: '#007bff', fontSize: '14px' }}>Extracting signature from PDF...</p>}
                            {pdfSignaturePreviewSec4 && !isExtractingSec4 && (
                                <div style={{ marginTop: '10px', padding: '10px', backgroundColor: '#f8f9fa', borderRadius: '4px' }}>
                                    <p style={{ margin: '0 0 10px 0', fontSize: '13px', fontWeight: 'bold', color: '#28a745' }}>✓ Signature extracted successfully:</p>
                                    <img src={pdfSignaturePreviewSec4} alt="Extracted Signature" style={{ maxWidth: '300px', maxHeight: '100px', border: '1px solid #ccc', borderRadius: '4px', backgroundColor: '#fff' }} />
                                    <div style={{ marginTop: '10px' }}>
                                        <button type="button" onClick={clearPdfSignatureSec4} className={`${i983_styles.i983_button} ${i983_styles.i983_clearButton}`}>Remove & Upload Different PDF</button>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
            {renderPageButtons()}
        </>
    );
    
    const renderPage3 = () => (
        <>
            {/* --- Section 5: Training Plan --- */}
            <div className={i983_styles.i983_formSection}>
                <h3>Section 5: Training Plan</h3>
                <div className={i983_styles.i983_formRow}>
                    <div className={i983_styles.i983_formGroup}><label>Student Name (Sec 5)</label><input name="SEC5_STUDENT_NAME" value={safeValue(formData.SEC5_STUDENT_NAME)} onChange={handleChange} disabled={isSaving || isGenerating} /></div>
                    <div className={i983_styles.i983_formGroup}><label>Employer Name (Sec 5)</label><input name="SEC5_EMPLOYER_NAME" value={safeValue(formData.SEC5_EMPLOYER_NAME)} onChange={handleChange} disabled={isSaving || isGenerating} /></div>
                </div>
                <h4>Employer Site Information</h4>
                <div className={i983_styles.i983_formRow}>
                    <div className={i983_styles.i983_formGroup}><label>Site Name</label><input name="SEC5_SITE_NAME" value={safeValue(formData.SEC5_SITE_NAME)} onChange={handleChange} disabled={isSaving || isGenerating} /></div>
                </div>
                <div className={i983_styles.i983_formGroup}>
                    <label>Site Address (Street, City, State, ZIP)</label>
                    <textarea name="SEC5_SITE_ADDRESS" value={safeValue(formData.SEC5_SITE_ADDRESS)} onChange={handleChange} disabled={isSaving || isGenerating} rows={3}/>
                </div>
                <div className={i983_styles.i983_formRow}>
                    <div className={i983_styles.i983_formGroup}><label>Name of Official</label><input name="SEC5_OFFICIAL_NAME" value={safeValue(formData.SEC5_OFFICIAL_NAME)} onChange={handleChange} disabled={isSaving || isGenerating} /></div>
                    <div className={i983_styles.i983_formGroup}><label>Official's Title</label><input name="SEC5_OFFICIAL_TITLE" value={safeValue(formData.SEC5_OFFICIAL_TITLE)} onChange={handleChange} disabled={isSaving || isGenerating} /></div>
                </div>
                <div className={i983_styles.i983_formRow}>
                    <div className={i983_styles.i983_formGroup}><label>Official's Email</label><input type="email" name="SEC5_OFFICIAL_EMAIL" value={safeValue(formData.SEC5_OFFICIAL_EMAIL)} onChange={handleChange} disabled={isSaving || isGenerating} /></div>
                    <div className={i983_styles.i983_formGroup}><label>Official's Phone Number</label><input type="tel" name="SEC5_OFFICIAL_PHONE" value={safeValue(formData.SEC5_OFFICIAL_PHONE)} onChange={handleChange} disabled={isSaving || isGenerating} /></div>
                </div>
                
                <h4 style={{marginTop: '20px'}}>Training Details</h4>
                <div className={i983_styles.i983_formGroup}>
                    <label>Student Role</label>
                    <textarea name="SEC5_STUDENT_ROLE" value={safeValue(formData.SEC5_STUDENT_ROLE)} onChange={handleChange} disabled={isSaving || isGenerating} rows={4} />
                </div>
                <div className={i983_styles.i983_formGroup}>
                    <label>Goals and Objectives</label>
                    <textarea name="SEC5_GOALS_OBJECTIVES" value={safeValue(formData.SEC5_GOALS_OBJECTIVES)} onChange={handleChange} disabled={isSaving || isGenerating} rows={6} />
                </div>
                <div className={i983_styles.i983_formGroup}>
                    <label>Employer Oversight</label>
                    <textarea name="SEC5_EMPLOYER_OVERSIGHT" value={safeValue(formData.SEC5_EMPLOYER_OVERSIGHT)} onChange={handleChange} disabled={isSaving || isGenerating} rows={5} />
                </div>
                <div className={i983_styles.i983_formGroup}>
                    <label>Measures and Assessments</label>
                    <textarea name="SEC5_MEASURES_ASSESSMENTS" value={safeValue(formData.SEC5_MEASURES_ASSESSMENTS)} onChange={handleChange} disabled={isSaving || isGenerating} rows={5} />
                </div>
            </div>
            {renderPageButtons()}
        </>
    );

    const renderPage4 = () => (
        <>
            {/* --- Section 5 (cont.): Additional Remarks --- */}
            <div className={i983_styles.i983_formSection}>
                <h3>Section 5: Additional Remarks</h3>
                <div className={i983_styles.i983_formGroup}>
                    <label>Additional Remarks (Optional)</label>
                    <textarea name="SEC5_ADDITIONAL_REMARKS" value={safeValue(formData.SEC5_ADDITIONAL_REMARKS)} onChange={handleChange} disabled={isSaving || isGenerating} rows={4} />
                </div>
            </div>

            {/* --- Section 6: Employer Official Certification (Live) --- */}
            <div className={i983_styles.i983_formSection}>
                <h3>Section 6: Employer Official Certification</h3>
                <div className={i983_styles.i983_formRow}>
                    <div className={i983_styles.i983_formGroup}><label>Printed Name and Title of Employer Official</label><input name="EMPLOYER_OFFICIAL_SEC6_PRINTED_NAME_TITLE" value={safeValue(formData.EMPLOYER_OFFICIAL_SEC6_PRINTED_NAME_TITLE)} onChange={handleChange} disabled={isSaving || isGenerating} /></div>
                    <div className={i983_styles.i983_formGroup}><label>Date</label><input type="date" name="EMPLOYER_OFFICIAL_SEC6_SIGNATURE_DATE" value={safeValue(formData.EMPLOYER_OFFICIAL_SEC6_SIGNATURE_DATE)} onChange={handleChange} disabled={isSaving || isGenerating} /></div>
                </div>
                <div className={i983_styles.i983_formGroup}>
                    <label>Signature of Employer Official*</label>
                    {existingForm?.EMPLOYER_OFFICIAL_SEC6_SIGNATURE_URL && (
                        <div className={i983_styles.i983_signatureDisplay} style={{ marginBottom: '10px' }}>
                            <p>Current Signature:</p>
                            <img src={existingForm.EMPLOYER_OFFICIAL_SEC6_SIGNATURE_URL} alt="Current Sig" style={{ maxHeight: '60px', border: '1px solid #ccc' }}/>
                        </div>
                    )}
                    
                    {/* Signature Type Selection */}
                    <div style={{ marginBottom: '15px', padding: '10px', backgroundColor: '#f8f9fa', borderRadius: '4px' }}>
                        <p style={{ margin: '0 0 10px 0', fontSize: '14px', fontWeight: '500' }}>Choose signature method:</p>
                        <div style={{ display: 'flex', gap: '20px' }}>
                            <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                                <input type="radio" name="signatureTypeSec6" value="canvas" checked={signatureTypeSec6 === 'canvas'} onChange={(e) => setSignatureTypeSec6(e.target.value)} style={{ marginRight: '8px' }} />
                                Draw Signature
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                                <input type="radio" name="signatureTypeSec6" value="pdf" checked={signatureTypeSec6 === 'pdf'} onChange={(e) => setSignatureTypeSec6(e.target.value)} style={{ marginRight: '8px' }} />
                                Upload Signature PDF
                            </label>
                        </div>
                    </div>

                    {/* Canvas Signature Option */}
                    {signatureTypeSec6 === 'canvas' && (
                        <>
                            <div className={i983_styles.i983_signatureCanvasWrapper}><SignatureCanvas ref={sigCanvasSec6} canvasProps={{ className: i983_styles.i983_signatureCanvas }} /></div>
                            <button type="button" onClick={() => clearSignature(sigCanvasSec6)} className={`${i983_styles.i983_button} ${i983_styles.i983_clearButton}`}>Clear Signature</button>
                        </>
                    )}

                    {/* PDF Upload Option */}
                    {signatureTypeSec6 === 'pdf' && (
                        <>
                            <p style={{ margin: '0 0 10px 0', fontSize: '13px', color: '#666' }}>Upload a PDF file containing your signature.</p>
                            <div style={{ marginBottom: '10px' }}>
                                <input type="file" ref={pdfFileInputSec6} accept="application/pdf" onChange={handlePdfFileChangeSec6} disabled={isExtractingSec6} style={{ padding: '10px', border: '2px dashed #007bff', borderRadius: '4px', width: '100%', maxWidth: '400px', backgroundColor: '#fff' }} />
                            </div>
                            {isExtractingSec6 && <p style={{ color: '#007bff', fontSize: '14px' }}>Extracting signature from PDF...</p>}
                            {pdfSignaturePreviewSec6 && !isExtractingSec6 && (
                                <div style={{ marginTop: '10px', padding: '10px', backgroundColor: '#f8f9fa', borderRadius: '4px' }}>
                                    <p style={{ margin: '0 0 10px 0', fontSize: '13px', fontWeight: 'bold', color: '#28a745' }}>✓ Signature extracted successfully:</p>
                                    <img src={pdfSignaturePreviewSec6} alt="Extracted Signature" style={{ maxWidth: '300px', maxHeight: '100px', border: '1px solid #ccc', borderRadius: '4px', backgroundColor: '#fff' }} />
                                    <div style={{ marginTop: '10px' }}>
                                        <button type="button" onClick={clearPdfSignatureSec6} className={`${i983_styles.i983_button} ${i983_styles.i983_clearButton}`}>Remove & Upload Different PDF</button>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
            {renderPageButtons()}
        </>
    );

    const renderPage5 = () => (
        <>
            {/* --- Evaluation 1 --- */}
            <div className={i983_styles.i983_formSection}>
                <h3>Evaluation on Student Progress</h3>
                <div className={i983_styles.i983_formRow}>
                    <div className={i983_styles.i983_formGroup}><label>Evaluation Period From</label><input type="date" name="EVAL1_FROM_DATE" value={safeValue(formData.EVAL1_FROM_DATE)} onChange={handleChange} disabled={isSaving || isGenerating} /></div>
                    <div className={i983_styles.i983_formGroup}><label>Evaluation Period To</label><input type="date" name="EVAL1_TO_DATE" value={safeValue(formData.EVAL1_TO_DATE)} onChange={handleChange} disabled={isSaving || isGenerating} /></div>
                </div>
                <div className={i983_styles.i983_formGroup}>
                    <label>Evaluation Text (Student/Employer)</label>
                    <textarea name="EVAL1_STUDENT_EVALUATION" value={safeValue(formData.EVAL1_STUDENT_EVALUATION)} onChange={handleChange} disabled={isSaving || isGenerating} rows={6} />
                </div>
                
                {/* Student Signature (Read-Only) */}
                {renderReadOnlySignature(
                    "Student Signature (Eval 1) (Read-Only)",
                    existingForm?.EVAL1_STUDENT_SIGNATURE_URL,
                    existingForm?.EVAL1_STUDENT_SIGNATURE_DATE,
                    existingForm?.STUDENT_PRINTED_NAME
                )}

                {/* Employer Signature (Live) */}
                <div className={i983_styles.i983_formRow} style={{marginTop: '15px'}}>
                    <div className={i983_styles.i983_formGroup}><label>Printed Name (Employer)</label><input name="EMPLOYER_OFFICIAL_PRINTED_NAME_TITLE" value={safeValue(formData.EMPLOYER_OFFICIAL_PRINTED_NAME_TITLE)} onChange={handleChange} disabled={isSaving || isGenerating} /></div>
                    <div className={i983_styles.i983_formGroup}><label>Date (Employer)</label><input type="date" name="EVAL1_EMPLOYER_SIGNATURE_DATE" value={safeValue(formData.EVAL1_EMPLOYER_SIGNATURE_DATE)} onChange={handleChange} disabled={isSaving || isGenerating} /></div>
                </div>
                <div className={i983_styles.i983_formGroup}>
                    <label>Employer Signature (Eval 1)</label>
                    {existingForm?.EVAL1_EMPLOYER_SIGNATURE_URL && (
                        <div className={i983_styles.i983_signatureDisplay} style={{ marginBottom: '10px' }}><p>Current Signature:</p><img src={existingForm.EVAL1_EMPLOYER_SIGNATURE_URL} alt="Current Eval 1 Sig" style={{ maxHeight: '60px', border: '1px solid #ccc' }}/></div>
                    )}
                    
                    {/* Signature Type Selection */}
                    <div style={{ marginBottom: '15px', padding: '10px', backgroundColor: '#f8f9fa', borderRadius: '4px' }}>
                        <p style={{ margin: '0 0 10px 0', fontSize: '14px', fontWeight: '500' }}>Choose signature method:</p>
                        <div style={{ display: 'flex', gap: '20px' }}>
                            <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                                <input type="radio" name="signatureTypeEval1Employer" value="canvas" checked={signatureTypeEval1 === 'canvas'} onChange={(e) => setSignatureTypeEval1(e.target.value)} style={{ marginRight: '8px' }} />
                                Draw Signature
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                                <input type="radio" name="signatureTypeEval1Employer" value="pdf" checked={signatureTypeEval1 === 'pdf'} onChange={(e) => setSignatureTypeEval1(e.target.value)} style={{ marginRight: '8px' }} />
                                Upload Signature PDF
                            </label>
                        </div>
                    </div>

                    {/* Canvas Signature Option */}
                    {signatureTypeEval1 === 'canvas' && (
                        <>
                            <div className={i983_styles.i983_signatureCanvasWrapper}><SignatureCanvas ref={sigCanvasEval1Employer} canvasProps={{ className: i983_styles.i983_signatureCanvas }} /></div>
                            <button type="button" onClick={() => clearSignature(sigCanvasEval1Employer)} className={`${i983_styles.i983_button} ${i983_styles.i983_clearButton}`}>Clear</button>
                        </>
                    )}

                    {/* PDF Upload Option */}
                    {signatureTypeEval1 === 'pdf' && (
                        <>
                            <p style={{ margin: '0 0 10px 0', fontSize: '13px', color: '#666' }}>Upload a PDF file containing your signature.</p>
                            <div style={{ marginBottom: '10px' }}>
                                <input type="file" ref={pdfFileInputEval1} accept="application/pdf" onChange={handlePdfFileChangeEval1} disabled={isExtractingEval1} style={{ padding: '10px', border: '2px dashed #007bff', borderRadius: '4px', width: '100%', maxWidth: '400px', backgroundColor: '#fff' }} />
                            </div>
                            {isExtractingEval1 && <p style={{ color: '#007bff', fontSize: '14px' }}>Extracting signature from PDF...</p>}
                            {pdfSignaturePreviewEval1 && !isExtractingEval1 && (
                                <div style={{ marginTop: '10px', padding: '10px', backgroundColor: '#f8f9fa', borderRadius: '4px' }}>
                                    <p style={{ margin: '0 0 10px 0', fontSize: '13px', fontWeight: 'bold', color: '#28a745' }}>✓ Signature extracted successfully:</p>
                                    <img src={pdfSignaturePreviewEval1} alt="Extracted Signature" style={{ maxWidth: '300px', maxHeight: '100px', border: '1px solid #ccc', borderRadius: '4px', backgroundColor: '#fff' }} />
                                    <div style={{ marginTop: '10px' }}>
                                        <button type="button" onClick={clearPdfSignatureEval1} className={`${i983_styles.i983_button} ${i983_styles.i983_clearButton}`}>Remove & Upload Different PDF</button>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>

            {/* --- Evaluation 2 --- */}
            <div className={i983_styles.i983_formSection}>
                <h3>Final Evaluation on Student Progress</h3>
                <div className={i983_styles.i983_formRow}>
                    <div className={i983_styles.i983_formGroup}><label>Evaluation Period From</label><input type="date" name="EVAL2_FROM_DATE" value={safeValue(formData.EVAL2_FROM_DATE)} onChange={handleChange} disabled={isSaving || isGenerating} /></div>
                    <div className={i983_styles.i983_formGroup}><label>Evaluation Period To</label><input type="date" name="EVAL2_TO_DATE" value={safeValue(formData.EVAL2_TO_DATE)} onChange={handleChange} disabled={isSaving || isGenerating} /></div>
                </div>
                <div className={i983_styles.i983_formGroup}>
                    <label>Evaluation Text (Student/Employer)</label>
                    <textarea name="EVAL2_STUDENT_EVALUATION" value={safeValue(formData.EVAL2_STUDENT_EVALUATION)} onChange={handleChange} disabled={isSaving || isGenerating} rows={6} />
                </div>
                
                {/* Student Signature (Read-Only) */}
                {renderReadOnlySignature(
                    "Student Signature (Eval 2) (Read-Only)",
                    existingForm?.EVAL2_STUDENT_SIGNATURE_URL,
                    existingForm?.EVAL2_STUDENT_SIGNATURE_DATE,
                    existingForm?.STUDENT_PRINTED_NAME
                )}

                {/* Employer Signature (Live) */}
                <div className={i983_styles.i983_formRow} style={{marginTop: '15px'}}>
                    <div className={i983_styles.i983_formGroup}><label>Printed Name (Employer)</label><input name="EMPLOYER_OFFICIAL_PRINTED_NAME_TITLE" value={safeValue(formData.EMPLOYER_OFFICIAL_PRINTED_NAME_TITLE)} onChange={handleChange} disabled={isSaving || isGenerating} /></div>
                    <div className={i983_styles.i983_formGroup}><label>Date (Employer)</label><input type="date" name="EVAL2_EMPLOYER_SIGNATURE_DATE" value={safeValue(formData.EVAL2_EMPLOYER_SIGNATURE_DATE)} onChange={handleChange} disabled={isSaving || isGenerating} /></div>
                </div>
                <div className={i983_styles.i983_formGroup}>
                    <label>Employer Signature (Eval 2)</label>
                    {existingForm?.EVAL2_EMPLOYER_SIGNATURE_URL && (
                        <div className={i983_styles.i983_signatureDisplay} style={{ marginBottom: '10px' }}><p>Current Signature:</p><img src={existingForm.EVAL2_EMPLOYER_SIGNATURE_URL} alt="Current Eval 2 Sig" style={{ maxHeight: '60px', border: '1px solid #ccc' }}/></div>
                    )}
                    
                    {/* Signature Type Selection */}
                    <div style={{ marginBottom: '15px', padding: '10px', backgroundColor: '#f8f9fa', borderRadius: '4px' }}>
                        <p style={{ margin: '0 0 10px 0', fontSize: '14px', fontWeight: '500' }}>Choose signature method:</p>
                        <div style={{ display: 'flex', gap: '20px' }}>
                            <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                                <input type="radio" name="signatureTypeEval2Employer" value="canvas" checked={signatureTypeEval2 === 'canvas'} onChange={(e) => setSignatureTypeEval2(e.target.value)} style={{ marginRight: '8px' }} />
                                Draw Signature
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                                <input type="radio" name="signatureTypeEval2Employer" value="pdf" checked={signatureTypeEval2 === 'pdf'} onChange={(e) => setSignatureTypeEval2(e.target.value)} style={{ marginRight: '8px' }} />
                                Upload Signature PDF
                            </label>
                        </div>
                    </div>

                    {/* Canvas Signature Option */}
                    {signatureTypeEval2 === 'canvas' && (
                        <>
                            <div className={i983_styles.i983_signatureCanvasWrapper}><SignatureCanvas ref={sigCanvasEval2Employer} canvasProps={{ className: i983_styles.i983_signatureCanvas }} /></div>
                            <button type="button" onClick={() => clearSignature(sigCanvasEval2Employer)} className={`${i983_styles.i983_button} ${i983_styles.i983_clearButton}`}>Clear</button>
                        </>
                    )}

                    {/* PDF Upload Option */}
                    {signatureTypeEval2 === 'pdf' && (
                        <>
                            <p style={{ margin: '0 0 10px 0', fontSize: '13px', color: '#666' }}>Upload a PDF file containing your signature.</p>
                            <div style={{ marginBottom: '10px' }}>
                                <input type="file" ref={pdfFileInputEval2} accept="application/pdf" onChange={handlePdfFileChangeEval2} disabled={isExtractingEval2} style={{ padding: '10px', border: '2px dashed #007bff', borderRadius: '4px', width: '100%', maxWidth: '400px', backgroundColor: '#fff' }} />
                            </div>
                            {isExtractingEval2 && <p style={{ color: '#007bff', fontSize: '14px' }}>Extracting signature from PDF...</p>}
                            {pdfSignaturePreviewEval2 && !isExtractingEval2 && (
                                <div style={{ marginTop: '10px', padding: '10px', backgroundColor: '#f8f9fa', borderRadius: '4px' }}>
                                    <p style={{ margin: '0 0 10px 0', fontSize: '13px', fontWeight: 'bold', color: '#28a745' }}>✓ Signature extracted successfully:</p>
                                    <img src={pdfSignaturePreviewEval2} alt="Extracted Signature" style={{ maxWidth: '300px', maxHeight: '100px', border: '1px solid #ccc', borderRadius: '4px', backgroundColor: '#fff' }} />
                                    <div style={{ marginTop: '10px' }}>
                                        <button type="button" onClick={clearPdfSignatureEval2} className={`${i983_styles.i983_button} ${i983_styles.i983_clearButton}`}>Remove & Upload Different PDF</button>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
            {renderPageButtons()}
        </>
    );
    
    // --- Main Render ---
    if (!form) { 
        return <div className={i983_styles.i983_loading}>Loading form data...</div>;
    }

    const status = existingForm?.FORM_STATUS || 'DRAFT';

    return (
        <div className={i983_styles.i983_formContainer}>
            {/* REMOVED: Error and Success messages are now shown by the parent component (VerificationContainer.jsx)
              The parent component (VerificationContainer) already renders {error} and {successMessage}
            */}
            
            <div className={i983_styles.i983_headerSection}>
                <h2 className={i983_styles.i983_title}>
                    Verify I-983 Form ({status})
                </h2>
                <div>
                    {/* MOVED: Generate PDF button is here */}
                    <button
                        className={`${i983_styles.i983_button} ${i983_styles.i983_buttonGenerate}`}
                        onClick={handleGenerate}
                        disabled={isSaving || isGenerating} // Disable if saving or generating
                        style={{ marginLeft: '10px' }}
                    >
                        {isGenerating ? 'Generating...' : 'Generate PDF'}
                    </button>
                    <button className={`${i983_styles.i983_button} ${i983_styles.i983_buttonBack}`} onClick={onBack} disabled={isSaving || isGenerating} style={{ marginLeft: '10px' }}>
                        {/* Back button now has no text, only icon via CSS */}
                    </button>
                </div>
            </div>
            
            {/* Pagination Controls */}
            <div className={i983_styles.i983_submenu_bar}>
                <button onClick={() => setCurrentPage(1)} className={`${currentPage === 1 ? i983_styles.i983_submenu_button_active : i983_styles.i983_submenu_button}`} disabled={isSaving || isGenerating}>Page 1 (Sec 1-2)</button>
                <button onClick={() => setCurrentPage(2)} className={`${currentPage === 2 ? i983_styles.i983_submenu_button_active : i983_styles.i983_submenu_button}`} disabled={isSaving || isGenerating}>Page 2 (Sec 3-4)</button>
                <button onClick={() => setCurrentPage(3)} className={`${currentPage === 3 ? i983_styles.i983_submenu_button_active : i983_styles.i983_submenu_button}`} disabled={isSaving || isGenerating}>Page 3 (Sec 5)</button>
                <button onClick={() => setCurrentPage(4)} className={`${currentPage === 4 ? i983_styles.i983_submenu_button_active : i983_styles.i983_submenu_button}`} disabled={isSaving || isGenerating}>Page 4 (Sec 6)</button>
                <button onClick={() => setCurrentPage(5)} className={`${currentPage === 5 ? i983_styles.i983_submenu_button_active : i983_styles.i983_submenu_button}`} disabled={isSaving || isGenerating}>Page 5 (Evals)</button>
            </div>

            {/* Page Content */}
            <div className={i983_styles.i983_pageContent}>
                {currentPage === 1 && renderPage1()}
                {currentPage === 2 && renderPage2()}
                {currentPage === 3 && renderPage3()}
                {currentPage === 4 && renderPage4()}
                {currentPage === 5 && renderPage5()}
            </div>
        </div>
    );
};

export default I983VerificationForm;
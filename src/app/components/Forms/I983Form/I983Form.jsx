// src/app/components/Forms/I983Form/I983Form.jsx
// @ts-nocheck
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { fetchEmployeeById } from '@/app/serverActions/Employee/overview';
import {
  getI983FormDetails,
  saveOrUpdateI983Form,
  generateI983Pdf,
} from '@/app/serverActions/forms/i983/actions';
import SignatureCanvas from 'react-signature-canvas';
import i983_styles from './I983Form.module.css';

// --- DATE UTILITIES (MATCHING W-9 LOGIC) ---

// Get today's date in local timezone YYYY-MM-DD (Prevents day-before issue)
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

// ✅ Helper function to count words
// Helper function to count words (INCLUDING paragraph breaks as words)
// Count only paragraph breaks (double newlines), not every single line break
const countWords = (text) => {
    if (!text) return 0;
    
    // Count paragraph breaks (double newlines or more)
    const paragraphBreaks = (text.match(/\n\s*\n/g) || []).length;
    
    // Count actual words
    const wordCount = text.trim().split(/\s+/).filter(word => word.length > 0).length;
    
    // Total = words + paragraph breaks
    return wordCount + (paragraphBreaks * 20);
};
// Helper function to safely get values for controlled inputs
const safeValue = (value, defaultValue = '') => value ?? defaultValue;

const mapFetchedToState = (fetchedForm = {}, employee = {}) => {
    const studentName = `${employee.EMP_FST_NAME || ''} ${employee.EMP_LAST_NAME || ''}`.trim();
    
    return {
        STUDENT_NAME: safeValue(fetchedForm.STUDENT_NAME, studentName),
        STUDENT_EMAIL: safeValue(fetchedForm.STUDENT_EMAIL, employee.email || ''),
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
        STUDENT_PRINTED_NAME: safeValue(fetchedForm.STUDENT_PRINTED_NAME, studentName),
        STUDENT_SIGNATURE_DATE: formatDateForInput(fetchedForm.STUDENT_SIGNATURE_DATE) || getLocalTodayDate(),
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
        EMPLOYER_OFFICIAL_PRINTED_NAME_TITLE: safeValue(fetchedForm.EMPLOYER_OFFICIAL_PRINTED_NAME_TITLE),
        EMPLOYER_PRINTED_NAME_ORG: safeValue(fetchedForm.EMPLOYER_PRINTED_NAME_ORG),
        EMPLOYER_OFFICIAL_SIGNATURE_DATE: formatDateForInput(fetchedForm.EMPLOYER_OFFICIAL_SIGNATURE_DATE),
        SEC5_STUDENT_NAME: safeValue(fetchedForm.SEC5_STUDENT_NAME, studentName),
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
        EMPLOYER_OFFICIAL_SEC6_PRINTED_NAME_TITLE: safeValue(fetchedForm.EMPLOYER_OFFICIAL_SEC6_PRINTED_NAME_TITLE),
        EMPLOYER_OFFICIAL_SEC6_SIGNATURE_DATE: formatDateForInput(fetchedForm.EMPLOYER_OFFICIAL_SEC6_SIGNATURE_DATE),
        EVAL1_FROM_DATE: formatDateForInput(fetchedForm.EVAL1_FROM_DATE),
        EVAL1_TO_DATE: formatDateForInput(fetchedForm.EVAL1_TO_DATE),
        EVAL1_STUDENT_EVALUATION: safeValue(fetchedForm.EVAL1_STUDENT_EVALUATION),
        EVAL1_STUDENT_SIGNATURE_DATE: formatDateForInput(fetchedForm.EVAL1_STUDENT_SIGNATURE_DATE) || getLocalTodayDate(),
        EVAL1_EMPLOYER_SIGNATURE_DATE: formatDateForInput(fetchedForm.EVAL1_EMPLOYER_SIGNATURE_DATE),
        EVAL2_FROM_DATE: formatDateForInput(fetchedForm.EVAL2_FROM_DATE),
        EVAL2_TO_DATE: formatDateForInput(fetchedForm.EVAL2_TO_DATE),
        EVAL2_STUDENT_EVALUATION: safeValue(fetchedForm.EVAL2_STUDENT_EVALUATION),
        EVAL2_STUDENT_SIGNATURE_DATE: formatDateForInput(fetchedForm.EVAL2_STUDENT_SIGNATURE_DATE) || getLocalTodayDate(),
        EVAL2_EMPLOYER_SIGNATURE_DATE: formatDateForInput(fetchedForm.EVAL2_EMPLOYER_SIGNATURE_DATE),
    };
};

const I983Form = ({ empid, orgid, onBack, states, countries, isAdding, selectedFormId, onError, onSuccess }) => {
    
    const [formData, setFormData] = useState(mapFetchedToState());
    const [existingForm, setExistingForm] = useState(null);
    const [isSaving, setIsSaving] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [currentFormId, setCurrentFormId] = useState(null);
    const [currentPage, setCurrentPage] = useState(1);

    // Refs
    const sigCanvasSec2 = useRef(null);
    const sigCanvasEval1Student = useRef(null);
    const sigCanvasEval2Student = useRef(null);
    
    const imageFileInputSec2 = useRef(null);
    const imageFileInputEval1 = useRef(null);
    const imageFileInputEval2 = useRef(null);

    // States
    const [signatureTypeSec2, setSignatureTypeSec2] = useState('canvas');
    const [signatureTypeEval1, setSignatureTypeEval1] = useState('canvas');
    const [signatureTypeEval2, setSignatureTypeEval2] = useState('canvas');

    const [imageSignatureFileSec2, setImageSignatureFileSec2] = useState(null);
    const [imageSignaturePreviewSec2, setImageSignaturePreviewSec2] = useState(null);
    
    const [imageSignatureFileEval1, setImageSignatureFileEval1] = useState(null);
    const [imageSignaturePreviewEval1, setImageSignaturePreviewEval1] = useState(null);
    
    const [imageSignatureFileEval2, setImageSignatureFileEval2] = useState(null);
    const [imageSignaturePreviewEval2, setImageSignaturePreviewEval2] = useState(null);

    // --- Data Loading Effect ---
    useEffect(() => {
        const loadData = async () => {
            onError(null);
            setIsSaving(true);
            try {
                const employee = await fetchEmployeeById(empid);

                if (isAdding) {
                    setExistingForm(null);
                    setCurrentFormId(null);
                    setFormData(mapFetchedToState({}, employee));
                } else if (selectedFormId) {
                    const formId = String(selectedFormId).replace('I983-', '');
                    const fetchedForm = await getI983FormDetails(formId);
                    setExistingForm(fetchedForm);
                    setCurrentFormId(fetchedForm.ID);
                    setFormData(mapFetchedToState(fetchedForm, employee));
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
    }, [empid, orgid, isAdding, selectedFormId]);

    const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    
    // ✅ Validate word count for Section 5 paragraph fields (200 words max)
    const section5Fields = [
        'SEC5_STUDENT_ROLE',
        'SEC5_GOALS_OBJECTIVES', 
        'SEC5_EMPLOYER_OVERSIGHT',
        'SEC5_MEASURES_ASSESSMENTS',
        'SEC5_ADDITIONAL_REMARKS'  // ✅ ADDED - Additional Remarks now has 200 word limit
    ];
    
    // ✅ Validate word count for Evaluation fields (350 words max)
    const evalFields = [
        'EVAL1_STUDENT_EVALUATION',
        'EVAL2_STUDENT_EVALUATION'
    ];
    
    if (section5Fields.includes(name)) {
        const wordCount = countWords(value);
        if (wordCount > 200) {
            onError(`${name.replace('SEC5_', '').replace(/_/g, ' ')} cannot exceed 200 words. Current: ${wordCount} words.`);
            return; // Don't update state if validation fails
        } else {
            onError(null); // Clear error if valid
        }
    }
    
    if (evalFields.includes(name)) {
        const wordCount = countWords(value);
        if (wordCount > 350) {
            onError(`${name.replace('EVAL1_', '').replace('EVAL2_', '').replace(/_/g, ' ')} cannot exceed 350 words. Current: ${wordCount} words.`);
            return; // Don't update state if validation fails
        } else {
            onError(null); // Clear error if valid
        }
    }
    
    setFormData(prev => ({
        ...prev,
        [name]: type === 'checkbox' ? checked : value
    }));
};
    const clearSignature = (sigRef) => {
        sigRef.current?.clear();
    };

    // --- Image Upload Handler (Shared logic) ---
    const handleImageUpload = (e, setFile, setPreview, inputRef) => {
        const file = e.target.files[0];
        if (!file) {
            setFile(null);
            setPreview(null);
            return;
        }

        // Validate File Type
        const validTypes = ['image/png', 'image/jpeg', 'image/jpg'];
        if (!validTypes.includes(file.type)) {
            onError('Please upload a PNG, JPG, or JPEG image file.');
            if (inputRef.current) inputRef.current.value = '';
            return;
        }

        // Validate Size (2MB)
        const maxSize = 2 * 1024 * 1024; // 2MB
        if (file.size > maxSize) {
            onError(`Image size must be less than 2MB. Your file is ${(file.size / 1024 / 1024).toFixed(2)}MB`);
            if (inputRef.current) inputRef.current.value = '';
            return;
        }

        setFile(file);
        const reader = new FileReader();
        reader.onload = (event) => {
            setPreview(event.target.result);
        };
        reader.readAsDataURL(file);
    };

    // --- Specific Image Handlers ---
    const handleImageChangeSec2 = (e) => handleImageUpload(e, setImageSignatureFileSec2, setImageSignaturePreviewSec2, imageFileInputSec2);
    const handleImageChangeEval1 = (e) => handleImageUpload(e, setImageSignatureFileEval1, setImageSignaturePreviewEval1, imageFileInputEval1);
    const handleImageChangeEval2 = (e) => handleImageUpload(e, setImageSignatureFileEval2, setImageSignaturePreviewEval2, imageFileInputEval2);

    const clearImageSignatureSec2 = () => {
        setImageSignatureFileSec2(null);
        setImageSignaturePreviewSec2(null);
        if (imageFileInputSec2.current) imageFileInputSec2.current.value = '';
    };

    const clearImageSignatureEval1 = () => {
        setImageSignatureFileEval1(null);
        setImageSignaturePreviewEval1(null);
        if (imageFileInputEval1.current) imageFileInputEval1.current.value = '';
    };

    const clearImageSignatureEval2 = () => {
        setImageSignatureFileEval2(null);
        setImageSignaturePreviewEval2(null);
        if (imageFileInputEval2.current) imageFileInputEval2.current.value = '';
    };

    // Get signature data based on type
    const getSignatureData = (type, sigCanvas, imagePreview) => {
        if (type === 'canvas') {
            if (sigCanvas?.current && !sigCanvas.current.isEmpty()) {
                const data = sigCanvas.current.toDataURL('image/png');
                sigCanvas.current.clear();
                return data;
            }
            return null;
        } else if (type === 'image' && imagePreview) {
            // Ensure it's base64 image data
            if (imagePreview.startsWith('data:image/')) {
                return imagePreview;
            }
        }
        return null;
    };

    const handleSave = async (showSuccess = true) => {
        onError(null);
        if (showSuccess) onSuccess('');
        setIsSaving(true);
        let success = false;
        let newFormId = currentFormId;

        try {
            const payload = {
                ...formData,
                orgid: existingForm?.ORG_ID || orgid,
                emp_id: existingForm?.EMP_ID || empid,
                action: 'save',
            };

            const sec2SigData = getSignatureData(signatureTypeSec2, sigCanvasSec2, imageSignaturePreviewSec2);
            const eval1SigData = getSignatureData(signatureTypeEval1, sigCanvasEval1Student, imageSignaturePreviewEval1);
            const eval2SigData = getSignatureData(signatureTypeEval2, sigCanvasEval2Student, imageSignaturePreviewEval2);

            if (sec2SigData) payload.signature_data_sec2 = sec2SigData;
            if (eval1SigData) payload.signature_data_eval1_student = eval1SigData;
            if (eval2SigData) payload.signature_data_eval2_student = eval2SigData;

            const result = await saveOrUpdateI983Form(payload, currentFormId);

            if (result.success) {
                if (showSuccess) onSuccess('Form saved successfully!');
                newFormId = result.id;
                
                // Clear previews on success
                if (signatureTypeSec2 === 'image' && imageSignaturePreviewSec2) clearImageSignatureSec2();
                if (signatureTypeEval1 === 'image' && imageSignaturePreviewEval1) clearImageSignatureEval1();
                if (signatureTypeEval2 === 'image' && imageSignaturePreviewEval2) clearImageSignatureEval2();

                const updatedForm = await getI983FormDetails(result.id);
                setExistingForm(updatedForm);
                setCurrentFormId(updatedForm.ID);
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
            return { success, formId: newFormId };
        }
    };

    const handleGenerate = async () => {
        onError(null);
        onSuccess('');
        setIsGenerating(true);
        const { success: saveSuccess, formId: savedFormId } = await handleSave(false);
        
        if (!saveSuccess || !savedFormId) {
            onError("Failed to save changes. Cannot generate PDF.");
            setIsGenerating(false);
            return;
        }
        
        try {
            onError(null);
            const result = await generateI983Pdf(savedFormId);
            if (result.success) {
                onSuccess("PDF Generated successfully! Returning to list...");
                setTimeout(() => { onBack(); }, 1500);
            } else {
                throw new Error(result.error);
            }
        } catch (err) {
             onError(err.message || 'Failed to generate PDF.');
             console.error('Error during generate:', err);
             setIsGenerating(false);
        }
    };

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

    const renderPageButtons = () => (
        <div className={i983_styles.i983_formButtons}>
            <button 
                type="button" 
                className={`${i983_styles.i983_button} ${i983_styles.i983_buttonSave}`} 
                onClick={() => handleSave(true)} 
                disabled={isSaving || isGenerating}
            >
                {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
        </div>
    );

    const renderPage1 = () => (
        <>
            <div className={i983_styles.i983_formSection}>
                <h3>Section 1: Student Information</h3>
                <div className={i983_styles.i983_formRow}>
                    <div className={i983_styles.i983_formGroup}><label>Student Name</label><input name="STUDENT_NAME" value={safeValue(formData.STUDENT_NAME)} onChange={handleChange} disabled={isSaving || isGenerating} /></div>
                    <div className={i983_styles.i983_formGroup}><label>Student Email</label><input type="email" name="STUDENT_EMAIL" value={safeValue(formData.STUDENT_EMAIL)} onChange={handleChange} disabled={isSaving || isGenerating} /></div>
                </div>
                {/* ... (Rest of Section 1 fields remain same) ... */}
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

            <div className={i983_styles.i983_formSection}>
                <h3>Section 2: Student Certification</h3>
                <div className={i983_styles.i983_formRow}>
                    <div className={i983_styles.i983_formGroup}><label>Printed Name</label><input name="STUDENT_PRINTED_NAME" value={safeValue(formData.STUDENT_PRINTED_NAME)} onChange={handleChange} disabled={isSaving || isGenerating} /></div>
                    <div className={i983_styles.i983_formGroup}><label>Date</label><input type="date" name="STUDENT_SIGNATURE_DATE" value={safeValue(formData.STUDENT_SIGNATURE_DATE)} onChange={handleChange} required disabled={isSaving || isGenerating} /></div>
                </div>
                <div className={i983_styles.i983_formGroup}>
                    <label>Signature*</label>
                    {existingForm?.STUDENT_SIGNATURE_URL && (
                        <div className={i983_styles.i983_signatureDisplay} style={{ marginBottom: '10px' }}>
                            <p>Current Signature:</p>
                            <img src={existingForm.STUDENT_SIGNATURE_URL} alt="Current Sig" style={{ maxHeight: '60px', border: '1px solid #ccc' }}/>
                        </div>
                    )}
                    
                    <div style={{ marginBottom: '15px', padding: '10px', backgroundColor: '#f8f9fa', borderRadius: '4px' }}>
                        <p style={{ margin: '0 0 10px 0', fontSize: '14px', fontWeight: '500' }}>Choose signature method:</p>
                        <div style={{ display: 'flex', gap: '20px' }}>
                            <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                                <input type="radio" name="signatureTypeSec2" value="canvas" checked={signatureTypeSec2 === 'canvas'} onChange={(e) => setSignatureTypeSec2(e.target.value)} style={{ marginRight: '8px' }} />
                                Draw Signature
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                                <input type="radio" name="signatureTypeSec2" value="image" checked={signatureTypeSec2 === 'image'} onChange={(e) => setSignatureTypeSec2(e.target.value)} style={{ marginRight: '8px' }} />
                                Upload Signature Image
                            </label>
                        </div>
                    </div>

                    {signatureTypeSec2 === 'canvas' && (
                        <>
                            <div className={i983_styles.i983_signatureCanvasWrapper}><SignatureCanvas ref={sigCanvasSec2} canvasProps={{ className: i983_styles.i983_signatureCanvas }} /></div>
                            <button type="button" onClick={() => clearSignature(sigCanvasSec2)} className={`${i983_styles.i983_button} ${i983_styles.i983_clearButton}`}>Clear Signature</button>
                        </>
                    )}

                    {signatureTypeSec2 === 'image' && (
                        <>
                            <p style={{ margin: '0 0 10px 0', fontSize: '13px', color: '#666' }}>Upload a PNG, JPG, or JPEG image of your signature (Max 2MB).</p>
                            <div style={{ marginBottom: '10px' }}>
                                <input type="file" ref={imageFileInputSec2} accept="image/png,image/jpeg,image/jpg" onChange={handleImageChangeSec2} style={{ padding: '10px', border: '2px dashed #007bff', borderRadius: '4px', width: '100%', maxWidth: '400px', backgroundColor: '#fff' }} />
                            </div>
                            
                            {imageSignaturePreviewSec2 && (
                                <div style={{ marginTop: '10px', padding: '10px', backgroundColor: '#f8f9fa', borderRadius: '4px' }}>
                                    <p style={{ margin: '0 0 10px 0', fontSize: '13px', fontWeight: 'bold', color: '#28a745' }}>✓ Signature preview:</p>
                                    <img src={imageSignaturePreviewSec2} alt="Signature Preview" style={{ maxWidth: '300px', maxHeight: '100px', border: '1px solid #ccc', borderRadius: '4px', backgroundColor: '#fff' }} />
                                    <div style={{ marginTop: '10px' }}>
                                        <button type="button" onClick={clearImageSignatureSec2} className={`${i983_styles.i983_button} ${i983_styles.i983_clearButton}`}>Remove & Upload Different Image</button>
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

    const renderPage2 = () => (
        <>
            <div className={i983_styles.i983_formSection}>
                <h3>Section 3: Employer Information</h3>
                {/* ... (Section 3 fields unchanged, rely on safeValue/handleChange) ... */}
                 <div className={i983_styles.i983_formRow}>
                    <div className={i983_styles.i983_formGroup}><label>Employer Name</label><input name="EMPLOYER_NAME" value={safeValue(formData.EMPLOYER_NAME)} onChange={handleChange} disabled={isSaving || isGenerating} /></div>
                    <div className={i983_styles.i983_formGroup}><label>Employer Website</label><input name="EMPLOYER_WEBSITE" value={safeValue(formData.EMPLOYER_WEBSITE)} onChange={handleChange} disabled={isSaving || isGenerating} /></div>
                    <div className={i983_styles.i983_formGroup}><label>Employer EIN</label><input name="EMPLOYER_EIN" value={safeValue(formData.EMPLOYER_EIN)} onChange={handleChange} disabled={isSaving || isGenerating} /></div>
                </div>
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

            <div className={i983_styles.i983_formSection}>
                <h3>Section 4: Employer Certification</h3>
                <div className={i983_styles.i983_formRow}>
                    <div className={i983_styles.i983_formGroup}><label>Printed Name and Title of Employer Official</label><input name="EMPLOYER_OFFICIAL_PRINTED_NAME_TITLE" value={safeValue(formData.EMPLOYER_OFFICIAL_PRINTED_NAME_TITLE)} onChange={handleChange} disabled={isSaving || isGenerating} /></div>
                    <div className={i983_styles.i983_formGroup}><label>Printed Name of Employing Organization</label><input name="EMPLOYER_PRINTED_NAME_ORG" value={safeValue(formData.EMPLOYER_PRINTED_NAME_ORG)} onChange={handleChange} disabled={isSaving || isGenerating} /></div>
                </div>
                <div className={i983_styles.i983_formRow}>
                    <div className={i983_styles.i983_formGroup}><label>Date</label><input type="date" name="EMPLOYER_OFFICIAL_SIGNATURE_DATE" value={safeValue(formData.EMPLOYER_OFFICIAL_SIGNATURE_DATE)} onChange={handleChange} disabled={isSaving || isGenerating} /></div>
                </div>
                {renderReadOnlySignature(
                    "Employer Signature (Read-Only)",
                    existingForm?.EMPLOYER_OFFICIAL_SIGNATURE_URL,
                    existingForm?.EMPLOYER_OFFICIAL_SIGNATURE_DATE,
                    existingForm?.EMPLOYER_OFFICIAL_PRINTED_NAME_TITLE
                )}
            </div>
            {renderPageButtons()}
        </>
    );
    
    // For I983Form.jsx - Complete renderPage3 function

const renderPage3 = () => (
    <>
        <div className={i983_styles.i983_formSection}>
            <h3>Section 5: Training Plan</h3>
            <div className={i983_styles.i983_formRow}>
                <div className={i983_styles.i983_formGroup}>
                    <label>Student Name (Sec 5)</label>
                    <input name="SEC5_STUDENT_NAME" value={safeValue(formData.SEC5_STUDENT_NAME)} onChange={handleChange} disabled={isSaving || isGenerating} />
                </div>
                <div className={i983_styles.i983_formGroup}>
                    <label>Employer Name (Sec 5)</label>
                    <input name="SEC5_EMPLOYER_NAME" value={safeValue(formData.SEC5_EMPLOYER_NAME)} onChange={handleChange} disabled={isSaving || isGenerating} />
                </div>
            </div>
            
            <h4>Employer Site Information</h4>
            <div className={i983_styles.i983_formRow}>
                <div className={i983_styles.i983_formGroup}>
                    <label>Site Name</label>
                    <input name="SEC5_SITE_NAME" value={safeValue(formData.SEC5_SITE_NAME)} onChange={handleChange} disabled={isSaving || isGenerating} />
                </div>
            </div>
            <div className={i983_styles.i983_formGroup}>
                <label>Site Address (Street, City, State, ZIP)</label>
                <textarea name="SEC5_SITE_ADDRESS" value={safeValue(formData.SEC5_SITE_ADDRESS)} onChange={handleChange} disabled={isSaving || isGenerating} rows={3}/>
            </div>
            <div className={i983_styles.i983_formRow}>
                <div className={i983_styles.i983_formGroup}>
                    <label>Name of Official</label>
                    <input name="SEC5_OFFICIAL_NAME" value={safeValue(formData.SEC5_OFFICIAL_NAME)} onChange={handleChange} disabled={isSaving || isGenerating} />
                </div>
                <div className={i983_styles.i983_formGroup}>
                    <label>Official's Title</label>
                    <input name="SEC5_OFFICIAL_TITLE" value={safeValue(formData.SEC5_OFFICIAL_TITLE)} onChange={handleChange} disabled={isSaving || isGenerating} />
                </div>
            </div>
            <div className={i983_styles.i983_formRow}>
                <div className={i983_styles.i983_formGroup}>
                    <label>Official's Email</label>
                    <input type="email" name="SEC5_OFFICIAL_EMAIL" value={safeValue(formData.SEC5_OFFICIAL_EMAIL)} onChange={handleChange} disabled={isSaving || isGenerating} />
                </div>
                <div className={i983_styles.i983_formGroup}>
                    <label>Official's Phone Number</label>
                    <input type="tel" name="SEC5_OFFICIAL_PHONE" value={safeValue(formData.SEC5_OFFICIAL_PHONE)} onChange={handleChange} disabled={isSaving || isGenerating} />
                </div>
            </div>
            
            <h4 style={{marginTop: '20px'}}>Training Details</h4>
            <div className={i983_styles.i983_formGroup}>
                <label>Student Role (Max 200 words) - {countWords(formData.SEC5_STUDENT_ROLE)}/200</label>
                <textarea name="SEC5_STUDENT_ROLE" value={safeValue(formData.SEC5_STUDENT_ROLE)} onChange={handleChange} disabled={isSaving || isGenerating} rows={10} />
            </div>
            <div className={i983_styles.i983_formGroup}>
                <label>Goals and Objectives (Max 200 words) - {countWords(formData.SEC5_GOALS_OBJECTIVES)}/200</label>
                <textarea name="SEC5_GOALS_OBJECTIVES" value={safeValue(formData.SEC5_GOALS_OBJECTIVES)} onChange={handleChange} disabled={isSaving || isGenerating} rows={10} />
            </div>
            <div className={i983_styles.i983_formGroup}>
                <label>Employer Oversight (Max 200 words) - {countWords(formData.SEC5_EMPLOYER_OVERSIGHT)}/200</label>
                <textarea name="SEC5_EMPLOYER_OVERSIGHT" value={safeValue(formData.SEC5_EMPLOYER_OVERSIGHT)} onChange={handleChange} disabled={isSaving || isGenerating} rows={10} />
            </div>
            <div className={i983_styles.i983_formGroup}>
                <label>Measures and Assessments (Max 200 words) - {countWords(formData.SEC5_MEASURES_ASSESSMENTS)}/200</label>
                <textarea name="SEC5_MEASURES_ASSESSMENTS" value={safeValue(formData.SEC5_MEASURES_ASSESSMENTS)} onChange={handleChange} disabled={isSaving || isGenerating} rows={10} />
            </div>
        </div>
        {renderPageButtons()}
    </>
);

    const renderPage4 = () => (
        <>
           <div className={i983_styles.i983_formSection}>
    <h3>Section 5: Additional Remarks</h3>
    <div className={i983_styles.i983_formGroup}>
        <label>Additional Remarks (Optional, Max 200 words) - {countWords(formData.SEC5_ADDITIONAL_REMARKS)}/200</label>
        <textarea name="SEC5_ADDITIONAL_REMARKS" value={safeValue(formData.SEC5_ADDITIONAL_REMARKS)} onChange={handleChange} disabled={isSaving || isGenerating} rows={5} />
    </div>
</div>


            <div className={i983_styles.i983_formSection}>
                <h3>Section 6: Employer Official Certification</h3>
                <div className={i983_styles.i983_formRow}>
                    <div className={i983_styles.i983_formGroup}><label>Printed Name and Title of Employer Official</label><input name="EMPLOYER_OFFICIAL_SEC6_PRINTED_NAME_TITLE" value={safeValue(formData.EMPLOYER_OFFICIAL_SEC6_PRINTED_NAME_TITLE)} onChange={handleChange} disabled={isSaving || isGenerating} /></div>
                    <div className={i983_styles.i983_formGroup}><label>Date</label><input type="date" name="EMPLOYER_OFFICIAL_SEC6_SIGNATURE_DATE" value={safeValue(formData.EMPLOYER_OFFICIAL_SEC6_SIGNATURE_DATE)} onChange={handleChange} disabled={isSaving || isGenerating} /></div>
                </div>
                {renderReadOnlySignature(
                    "Employer Signature (Read-Only)",
                    existingForm?.EMPLOYER_OFFICIAL_SEC6_SIGNATURE_URL,
                    existingForm?.EMPLOYER_OFFICIAL_SEC6_SIGNATURE_DATE,
                    existingForm?.EMPLOYER_OFFICIAL_SEC6_PRINTED_NAME_TITLE
                )}
            </div>
            {renderPageButtons()}
        </>
    );

    const renderPage5 = () => (
        <>
            <div className={i983_styles.i983_formSection}>
                <h3>Evaluation on Student Progress</h3>
                <div className={i983_styles.i983_formRow}>
                    <div className={i983_styles.i983_formGroup}><label>Evaluation Period From</label><input type="date" name="EVAL1_FROM_DATE" value={safeValue(formData.EVAL1_FROM_DATE)} onChange={handleChange} disabled={isSaving || isGenerating} /></div>
                    <div className={i983_styles.i983_formGroup}><label>Evaluation Period To</label><input type="date" name="EVAL1_TO_DATE" value={safeValue(formData.EVAL1_TO_DATE)} onChange={handleChange} disabled={isSaving || isGenerating} /></div>
                </div>
                <div className={i983_styles.i983_formGroup}>
    <label>Evaluation Text (Student/Employer, Max 350 words) - {countWords(formData.EVAL1_STUDENT_EVALUATION)}/350</label>
    <textarea name="EVAL1_STUDENT_EVALUATION" value={safeValue(formData.EVAL1_STUDENT_EVALUATION)} onChange={handleChange} disabled={isSaving || isGenerating} rows={10} />
</div>
                
                <div className={i983_styles.i983_formRow}>
                    <div className={i983_styles.i983_formGroup}><label>Printed Name (Student)</label><input value={safeValue(formData.STUDENT_PRINTED_NAME)} disabled={true} /></div>
                    <div className={i983_styles.i983_formGroup}><label>Date (Student)</label><input type="date" name="EVAL1_STUDENT_SIGNATURE_DATE" value={safeValue(formData.EVAL1_STUDENT_SIGNATURE_DATE)} onChange={handleChange} disabled={isSaving || isGenerating} /></div>
                </div>
                <div className={i983_styles.i983_formGroup}>
                    <label>Student Signature</label>
                    {existingForm?.EVAL1_STUDENT_SIGNATURE_URL && (
                        <div className={i983_styles.i983_signatureDisplay} style={{ marginBottom: '10px' }}><p>Current Signature:</p><img src={existingForm.EVAL1_STUDENT_SIGNATURE_URL} alt="Current Eval 1 Sig" style={{ maxHeight: '60px', border: '1px solid #ccc' }}/></div>
                    )}
                    
                    <div style={{ marginBottom: '15px', padding: '10px', backgroundColor: '#f8f9fa', borderRadius: '4px' }}>
                        <p style={{ margin: '0 0 10px 0', fontSize: '14px', fontWeight: '500' }}>Choose signature method:</p>
                        <div style={{ display: 'flex', gap: '20px' }}>
                            <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                                <input type="radio" name="signatureTypeEval1" value="canvas" checked={signatureTypeEval1 === 'canvas'} onChange={(e) => setSignatureTypeEval1(e.target.value)} style={{ marginRight: '8px' }} />
                                Draw Signature
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                                <input type="radio" name="signatureTypeEval1" value="image" checked={signatureTypeEval1 === 'image'} onChange={(e) => setSignatureTypeEval1(e.target.value)} style={{ marginRight: '8px' }} />
                                Upload Signature Image
                            </label>
                        </div>
                    </div>

                    {signatureTypeEval1 === 'canvas' && (
                        <>
                            <div className={i983_styles.i983_signatureCanvasWrapper}><SignatureCanvas ref={sigCanvasEval1Student} canvasProps={{ className: i983_styles.i983_signatureCanvas }} /></div>
                            <button type="button" onClick={() => clearSignature(sigCanvasEval1Student)} className={`${i983_styles.i983_button} ${i983_styles.i983_clearButton}`}>Clear</button>
                        </>
                    )}

                    {signatureTypeEval1 === 'image' && (
                        <>
                            <p style={{ margin: '0 0 10px 0', fontSize: '13px', color: '#666' }}>Upload a PNG, JPG, or JPEG image of your signature.</p>
                            <div style={{ marginBottom: '10px' }}>
                                <input type="file" ref={imageFileInputEval1} accept="image/png,image/jpeg,image/jpg" onChange={handleImageChangeEval1} style={{ padding: '10px', border: '2px dashed #007bff', borderRadius: '4px', width: '100%', maxWidth: '400px', backgroundColor: '#fff' }} />
                            </div>
                            {imageSignaturePreviewEval1 && (
                                <div style={{ marginTop: '10px', padding: '10px', backgroundColor: '#f8f9fa', borderRadius: '4px' }}>
                                    <p style={{ margin: '0 0 10px 0', fontSize: '13px', fontWeight: 'bold', color: '#28a745' }}>✓ Signature preview:</p>
                                    <img src={imageSignaturePreviewEval1} alt="Signature Preview" style={{ maxWidth: '300px', maxHeight: '100px', border: '1px solid #ccc', borderRadius: '4px', backgroundColor: '#fff' }} />
                                    <div style={{ marginTop: '10px' }}>
                                        <button type="button" onClick={clearImageSignatureEval1} className={`${i983_styles.i983_button} ${i983_styles.i983_clearButton}`}>Remove & Upload Different Image</button>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>

                {renderReadOnlySignature(
                    "Employer Signature (Eval 1) (Read-Only)",
                    existingForm?.EVAL1_EMPLOYER_SIGNATURE_URL,
                    existingForm?.EVAL1_EMPLOYER_SIGNATURE_DATE,
                    existingForm?.EMPLOYER_OFFICIAL_PRINTED_NAME_TITLE
                )}
            </div>

            <div className={i983_styles.i983_formSection}>
                <h3>Final Evaluation on Student Progress</h3>
                <div className={i983_styles.i983_formRow}>
                    <div className={i983_styles.i983_formGroup}><label>Evaluation Period From</label><input type="date" name="EVAL2_FROM_DATE" value={safeValue(formData.EVAL2_FROM_DATE)} onChange={handleChange} disabled={isSaving || isGenerating} /></div>
                    <div className={i983_styles.i983_formGroup}><label>Evaluation Period To</label><input type="date" name="EVAL2_TO_DATE" value={safeValue(formData.EVAL2_TO_DATE)} onChange={handleChange} disabled={isSaving || isGenerating} /></div>
                </div>
               <div className={i983_styles.i983_formGroup}>
    <label>Evaluation Text (Student/Employer, Max 350 words) - {countWords(formData.EVAL2_STUDENT_EVALUATION)}/350</label>
    <textarea name="EVAL2_STUDENT_EVALUATION" value={safeValue(formData.EVAL2_STUDENT_EVALUATION)} onChange={handleChange} disabled={isSaving || isGenerating} rows={10} />
</div>
                
                <div className={i983_styles.i983_formRow}>
                    <div className={i983_styles.i983_formGroup}><label>Printed Name (Student)</label><input value={safeValue(formData.STUDENT_PRINTED_NAME)} disabled={true} /></div>
                    <div className={i983_styles.i983_formGroup}><label>Date (Student)</label><input type="date" name="EVAL2_STUDENT_SIGNATURE_DATE" value={safeValue(formData.EVAL2_STUDENT_SIGNATURE_DATE)} onChange={handleChange} disabled={isSaving || isGenerating} /></div>
                </div>
                <div className={i983_styles.i983_formGroup}>
                    <label>Student Signature</label>
                    {existingForm?.EVAL2_STUDENT_SIGNATURE_URL && (
                        <div className={i983_styles.i983_signatureDisplay} style={{ marginBottom: '10px' }}><p>Current Signature:</p><img src={existingForm.EVAL2_STUDENT_SIGNATURE_URL} alt="Current Eval 2 Sig" style={{ maxHeight: '60px', border: '1px solid #ccc' }}/></div>
                    )}
                    
                    <div style={{ marginBottom: '15px', padding: '10px', backgroundColor: '#f8f9fa', borderRadius: '4px' }}>
                        <p style={{ margin: '0 0 10px 0', fontSize: '14px', fontWeight: '500' }}>Choose signature method:</p>
                        <div style={{ display: 'flex', gap: '20px' }}>
                            <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                                <input type="radio" name="signatureTypeEval2" value="canvas" checked={signatureTypeEval2 === 'canvas'} onChange={(e) => setSignatureTypeEval2(e.target.value)} style={{ marginRight: '8px' }} />
                                Draw Signature
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                                <input type="radio" name="signatureTypeEval2" value="image" checked={signatureTypeEval2 === 'image'} onChange={(e) => setSignatureTypeEval2(e.target.value)} style={{ marginRight: '8px' }} />
                                Upload Signature Image
                            </label>
                        </div>
                    </div>

                    {signatureTypeEval2 === 'canvas' && (
                        <>
                            <div className={i983_styles.i983_signatureCanvasWrapper}><SignatureCanvas ref={sigCanvasEval2Student} canvasProps={{ className: i983_styles.i983_signatureCanvas }} /></div>
                            <button type="button" onClick={() => clearSignature(sigCanvasEval2Student)} className={`${i983_styles.i983_button} ${i983_styles.i983_clearButton}`}>Clear</button>
                        </>
                    )}

                    {signatureTypeEval2 === 'image' && (
                        <>
                            <p style={{ margin: '0 0 10px 0', fontSize: '13px', color: '#666' }}>Upload a PNG, JPG, or JPEG image of your signature.</p>
                            <div style={{ marginBottom: '10px' }}>
                                <input type="file" ref={imageFileInputEval2} accept="image/png,image/jpeg,image/jpg" onChange={handleImageChangeEval2} style={{ padding: '10px', border: '2px dashed #007bff', borderRadius: '4px', width: '100%', maxWidth: '400px', backgroundColor: '#fff' }} />
                            </div>
                            {imageSignaturePreviewEval2 && (
                                <div style={{ marginTop: '10px', padding: '10px', backgroundColor: '#f8f9fa', borderRadius: '4px' }}>
                                    <p style={{ margin: '0 0 10px 0', fontSize: '13px', fontWeight: 'bold', color: '#28a745' }}>✓ Signature preview:</p>
                                    <img src={imageSignaturePreviewEval2} alt="Signature Preview" style={{ maxWidth: '300px', maxHeight: '100px', border: '1px solid #ccc', borderRadius: '4px', backgroundColor: '#fff' }} />
                                    <div style={{ marginTop: '10px' }}>
                                        <button type="button" onClick={clearImageSignatureEval2} className={`${i983_styles.i983_button} ${i983_styles.i983_clearButton}`}>Remove & Upload Different Image</button>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>

                {renderReadOnlySignature(
                    "Employer Signature (Eval 2) (Read-Only)",
                    existingForm?.EVAL2_EMPLOYER_SIGNATURE_URL,
                    existingForm?.EVAL2_EMPLOYER_SIGNATURE_DATE,
                    existingForm?.EMPLOYER_OFFICIAL_PRINTED_NAME_TITLE
                )}
            </div>
            {renderPageButtons()}
        </>
    );
    
    // --- Main Render ---
    const isLoading = (isSaving || isGenerating) && !existingForm && !isAdding;
    if (isLoading) { return <div className={i983_styles.i983_loading}>Loading form data...</div>; }

    const status = existingForm?.FORM_STATUS || 'DRAFT';

    return (
        <div className={i983_styles.i983_formContainer}>
            <div className={i983_styles.i983_headerSection}>
                <h2 className={i983_styles.i983_title}>
                    I-983 Form ({status})
                </h2>
                <div>
                    <button
                        className={`${i983_styles.i983_button} ${i983_styles.i983_buttonGenerate}`}
                        onClick={handleGenerate}
                        disabled={isSaving || isGenerating}
                        style={{ marginLeft: '10px' }}
                    >
                        {isGenerating ? 'Generating...' : 'Generate PDF'}
                    </button>
                    <button className={`${i983_styles.i983_button} ${i983_styles.i983_buttonBack}`} onClick={onBack} disabled={isSaving || isGenerating} style={{ marginLeft: '10px' }}>
                        Back to List
                    </button>
                </div>
            </div>
            
            <div className={i983_styles.i983_submenu_bar}>
                <button onClick={() => setCurrentPage(1)} className={`${currentPage === 1 ? i983_styles.i983_submenu_button_active : i983_styles.i983_submenu_button}`} disabled={isSaving || isGenerating}>Page 1 (Sec 1-2)</button>
                <button onClick={() => setCurrentPage(2)} className={`${currentPage === 2 ? i983_styles.i983_submenu_button_active : i983_styles.i983_submenu_button}`} disabled={isSaving || isGenerating}>Page 2 (Sec 3-4)</button>
                <button onClick={() => setCurrentPage(3)} className={`${currentPage === 3 ? i983_styles.i983_submenu_button_active : i983_styles.i983_submenu_button}`} disabled={isSaving || isGenerating}>Page 3 (Sec 5)</button>
                <button onClick={() => setCurrentPage(4)} className={`${currentPage === 4 ? i983_styles.i983_submenu_button_active : i983_styles.i983_submenu_button}`} disabled={isSaving || isGenerating}>Page 4 (Sec 6)</button>
                <button onClick={() => setCurrentPage(5)} className={`${currentPage === 5 ? i983_styles.i983_submenu_button_active : i983_styles.i983_submenu_button}`} disabled={isSaving || isGenerating}>Page 5 (Evals)</button>
            </div>

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

export default I983Form;
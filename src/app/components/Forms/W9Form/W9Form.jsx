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
  const [timestamp] = useState(Date.now()); // Used for cache-busting images
  
  // Signature type state (canvas or pdf)
  const pdfFileInputRef = useRef(null);
  const [signatureType, setSignatureType] = useState('canvas');
  const [pdfSignatureFile, setPdfSignatureFile] = useState(null);
  const [pdfSignaturePreview, setPdfSignaturePreview] = useState(null);
  const [isExtractingSignature, setIsExtractingSignature] = useState(false);

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

  // Handle signature type change (canvas or pdf)
  const handleSignatureTypeChange = (e) => {
    const newType = e.target.value;
    setSignatureType(newType);
    // Clear the other type's data when switching
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
    console.log('📄 PDF Upload - File selected:', file ? file.name : 'none');
    
    if (!file) {
      setPdfSignatureFile(null);
      setPdfSignaturePreview(null);
      return;
    }

    // Validate file type
    console.log('📄 PDF Upload - File type:', file.type, 'Size:', file.size, 'bytes');
    if (file.type !== 'application/pdf') {
      onError('Please upload a valid PDF file.');
      e.target.value = '';
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      onError('PDF file size must be less than 5MB.');
      e.target.value = '';
      return;
    }

    onError(null);
    setPdfSignatureFile(file);
    setIsExtractingSignature(true);

    try {
      console.log('📄 PDF Upload - Loading pdfjs-dist library...');
      // FIXED: Import specific build file to avoid Object.defineProperty error
      const pdfjsModule = await import('pdfjs-dist/build/pdf.min.mjs');
      const pdfjsLib = pdfjsModule.default || pdfjsModule;

      console.log('📄 PDF Upload - pdfjs-dist version:', pdfjsLib.version);
      
      // Set worker source - use local file for EC2/production (no external CDN dependency)
      if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
        pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
      }
      console.log('📄 PDF Upload - Worker source set to:', pdfjsLib.GlobalWorkerOptions.workerSrc);

      // Read file as ArrayBuffer for PDF.js
      console.log('📄 PDF Upload - Reading file as ArrayBuffer...');
      const arrayBuffer = await file.arrayBuffer();
      console.log('📄 PDF Upload - ArrayBuffer size:', arrayBuffer.byteLength, 'bytes');
      
      // Check if file starts with PDF header
      const header = new Uint8Array(arrayBuffer.slice(0, 5));
      const headerStr = String.fromCharCode(...header);
      console.log('📄 PDF Upload - File header:', headerStr, '(should be %PDF-)');
      
      if (headerStr !== '%PDF-') {
        throw new Error('File does not have valid PDF header. Got: ' + headerStr);
      }
      
      // Load the PDF document
      console.log('📄 PDF Upload - Loading PDF document...');
      const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
      const pdfDoc = await loadingTask.promise;
      console.log('📄 PDF Upload - PDF loaded, pages:', pdfDoc.numPages);
      
      // Get the first page
      console.log('📄 PDF Upload - Getting page 1...');
      const page = await pdfDoc.getPage(1);
      console.log('📄 PDF Upload - Page 1 loaded');
      
      // Set up canvas for rendering
      const scale = 2; // Higher scale for better quality
      const viewport = page.getViewport({ scale });
      console.log('📄 PDF Upload - Viewport:', viewport.width, 'x', viewport.height);
      
      // Create an offscreen canvas
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      
      // Render PDF page to canvas
      console.log('📄 PDF Upload - Rendering page to canvas...');
      await page.render({
        canvasContext: context,
        viewport: viewport,
      }).promise;
      console.log('📄 PDF Upload - Render complete');
      
      // Convert canvas to PNG data URL
      const signatureDataUrl = canvas.toDataURL('image/png');
      console.log('📄 PDF Upload - PNG data URL length:', signatureDataUrl.length, 'chars');
      
      setPdfSignaturePreview(signatureDataUrl);
      onError(null);
      console.log('✅ PDF signature extracted successfully via client-side rendering');
      
    } catch (err) {
      console.error('❌ PDF extraction error:', err);
      console.error('❌ Error name:', err.name);
      console.error('❌ Error message:', err.message);
      console.error('❌ Error stack:', err.stack);
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

  // Get signature data based on type
  const getSignatureData = () => {
    if (signatureType === 'canvas') {
      return sigCanvas.current?.isEmpty() ? null : sigCanvas.current.toDataURL('image/png');
    } else if (signatureType === 'pdf') {
      return pdfSignaturePreview;
    }
    return null;
  };

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
            signature_data: getSignatureData(),
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
        // Validate signature based on type
        if (signatureType === 'canvas') {
            if (sigCanvas.current?.isEmpty()) {
                throw new Error('Signature is required to submit the form. Please draw your signature.');
            }
        } else if (signatureType === 'pdf') {
            if (!pdfSignaturePreview) {
                throw new Error('Signature is required to submit the form. Please upload a PDF with your signature.');
            }
        }

        // Combine fields for database
        const payload = {
            ...formData,
            name: `${formData.first_name} ${formData.last_name}`.trim(),
            address_city_state_zip: `${formData.city}, ${formData.state} ${formData.zip_code}`,
            orgid,
            emp_id: empid,
            signature_data: getSignatureData(),
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
                  <div className={styles.signatureDisplay}>
                    <img 
                      src={`${existingForm.SIGNATURE_URL}?t=${timestamp}`} 
                      alt="Employee Signature" 
                      style={{ maxWidth: '300px', border: '1px solid #ccc', borderRadius: '4px' }}
                    />
                  </div>
                </div>
            )
        ) : (
            <div className={styles.formGroup}>
                <label>Signature*</label>
                
                {/* Signature Type Selection */}
                <div style={{ marginBottom: '15px', padding: '10px', backgroundColor: '#f8f9fa', borderRadius: '4px' }}>
                    <p style={{ margin: '0 0 10px 0', fontSize: '14px', fontWeight: '500' }}>
                        Choose signature method:
                    </p>
                    <div style={{ display: 'flex', gap: '20px' }}>
                        <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                            <input
                                type="radio"
                                name="signatureType"
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
                                name="signatureType"
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
                            <SignatureCanvas ref={sigCanvas} canvasProps={{ width: 600, height: 200, className: styles.signatureCanvas }} />
                        </div>
                        <button type="button" onClick={clearSignature} className={styles.button}>Clear Signature</button>
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
                                    <button type="button" onClick={clearPdfSignature} className={styles.button}>
                                        Remove & Upload Different PDF
                                    </button>
                                </div>
                            </div>
                        )}
                    </>
                )}
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
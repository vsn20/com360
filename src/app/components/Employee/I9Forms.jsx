// src/app/components/Employee/I9Forms.jsx
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { fetchEmployeeById } from '@/app/serverActions/Employee/overview';
import {
  addForm as addI9Form,
  fetchFormsByEmpId as fetchI9FormsByEmpId,
  updateForm as updateI9Form,
  getFormTypes,
  canEditForm as canEditI9Form,
  deleteForm as deleteI9Form,
} from '@/app/serverActions/Employee/i9forms';
import { getI9FormDetails } from '@/app/serverActions/forms/verification/actions';
import * as w9Actions from '@/app/serverActions/forms/w9form/action';
import * as w4Actions from '@/app/serverActions/forms/w4form/action';
import * as i983Actions from '@/app/serverActions/forms/i983/actions';
import styles from './I9Forms.module.css';
import { useRouter } from 'next/navigation';
import SignatureCanvas from 'react-signature-canvas';
import W9Form from '../Forms/W9Form/W9Form';
import W4Form from '../Forms/W4Form/W4Form';
import I983Form from '../Forms/I983Form/I983Form';

const I9Forms = ({
  roles,
  empid,
  orgid,
  error: initialError,
  countries,
  states,
  timestamp,
}) => {
  const [forms, setForms] = useState([]);
  const [selectedFormId, setSelectedFormId] = useState(null);
  const [showFormTypeModal, setShowFormTypeModal] = useState(false);
  const [formTypes, setFormTypes] = useState([]);
  const [selectedFormType, setSelectedFormType] = useState('');
  const [activeView, setActiveView] = useState('list');
  
  // --- I-9 Specific State ---
  const [i9FormData, setI9FormData] = useState({
    form_type: '',
    employee_last_name: '',
    employee_first_name: '',
    employee_middle_initial: '',
    employee_other_last_names: '',
    employee_street_address: '',
    employee_apt_number: '',
    employee_city: '',
    employee_state: '',
    employee_zip_code: '',
    employee_dob: '',
    employee_ssn: '',
    employee_email: '',
    employee_phone: '',
    citizenship_status: '1',
    alien_number: '',
    work_authorization_expiry: '',
    uscis_a_number: '',
    i94_admission_number: '',
    foreign_passport_number: '',
    country_of_issuance: '',
    employee_signature_date: new Date().toISOString().split('T')[0],
    employee_signature_url: '',
    employee_verified_flag: false,
  });
  const i9SigCanvas = useRef(null);
  const pdfFileInputRef = useRef(null);
  const [signatureType, setSignatureType] = useState('canvas');
  const [pdfSignatureFile, setPdfSignatureFile] = useState(null);
  const [pdfSignaturePreview, setPdfSignaturePreview] = useState(null);
  const [isExtractingSignature, setIsExtractingSignature] = useState(false);
  // --- End I-9 Specific State ---

  const [isAdding, setIsAdding] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState(initialError);
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [employeeSuborgId, setEmployeeSuborgId] = useState(null);

  const router = useRouter();

  useEffect(() => {
    loadAllForms();
    loadFormTypes();
    loadEmployeeInfo();
  }, [orgid, empid]);

  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(''), 5000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  const loadFormTypes = async () => {
    try {
      const types = await getFormTypes();
      setFormTypes(types);
    } catch (err) {
      console.error('Failed to load form types:', err);
      setError('Failed to load form types.');
    }
  };

  const loadEmployeeInfo = async () => {
    try {
      const employee = await fetchEmployeeById(empid);
      setEmployeeSuborgId(employee?.suborgid || null);
    } catch (err) {
      console.error('Failed to load employee info:', err);
    }
  };

  const loadAllForms = async () => {
    setError(null);
    setIsSaving(true);
    try {
      const [i9FormsData, w9FormsData, w4FormsData, i983FormsData] = await Promise.all([
          fetchI9FormsByEmpId(empid, orgid),
          w9Actions.fetchW9FormsByEmpId(empid, orgid),
          w4Actions.fetchW4FormsByEmpId(empid, orgid),
          i983Actions.fetchI983FormsByEmpId(empid, orgid),
      ]);

      const combinedForms = [
          ...i9FormsData.map(f => ({ ...f, FORM_TYPE: 'I9', SORT_DATE: f.EMPLOYEE_SIGNATURE_DATE || f.CREATED_AT })),
          ...w9FormsData.map(w9Form => ({
              ID: `W9-${w9Form.ID}`,
              FORM_TYPE: 'W9',
              SORT_DATE: w9Form.SUBMITTED_AT || w9Form.SIGNATURE_DATE || w9Form.CREATED_AT,
              FORM_STATUS: w9Form.FORM_STATUS,
          })),
          ...w4FormsData.map(w4Form => ({
              ID: `W4-${w4Form.ID}`,
              FORM_TYPE: 'W4',
              SORT_DATE: w4Form.SUBMITTED_AT || w4Form.EMPLOYEE_SIGNATURE_DATE || w4Form.CREATED_AT,
              FORM_STATUS: w4Form.FORM_STATUS,
          })),
           ...i983FormsData.map(i983Form => ({
              ID: `I983-${i983Form.ID}`,
              FORM_TYPE: 'I983',
              SORT_DATE: i983Form.UPDATED_AT || i983Form.CREATED_AT,
              FORM_STATUS: i983Form.FORM_STATUS,
          })),
      ];

      combinedForms.sort((a, b) => new Date(b.SORT_DATE || 0) - new Date(a.SORT_DATE || 0));
      setForms(combinedForms);
    } catch (err) {
      setError('Failed to load forms.');
      console.error(err);
    } finally {
        setIsSaving(false);
    }
  };

  const handleRowClick = async (form) => {
    if (isSaving) return;
    setError(null);
    setSuccessMessage('');
    setIsAdding(false);
    setSelectedFormId(form.ID);

    try {
        const numericIdMatch = String(form.ID).match(/-(\d+)$/);
        const numericId = numericIdMatch ? parseInt(numericIdMatch[1]) : parseInt(String(form.ID));
        if (isNaN(numericId)) throw new Error("Invalid Form ID.");

        if (form.FORM_TYPE === 'W9') {
            const editCheck = await w9Actions.canEditW9Form(numericId);
            if (!editCheck.canEdit) setError(editCheck.reason);
            setActiveView('w9form');
            setIsEditing(false);
        }
        else if (form.FORM_TYPE === 'W4') {
            const editCheck = await w4Actions.canEditW4Form(numericId);
            if (!editCheck.canEdit) setError(editCheck.reason);
            setActiveView('w4form');
            setIsEditing(false);
        }
        else if (form.FORM_TYPE === 'I983') {
            await i983Actions.getI983FormDetails(numericId);
            setActiveView('i983form');
            setIsEditing(true); 
        }
        else if (form.FORM_TYPE === 'I9') {
            const editCheck = await canEditI9Form(numericId);
            if (!editCheck.canEdit) {
                setError(editCheck.reason);
            } 
            setActiveView('i9form');
            setIsEditing(editCheck.canEdit);

            const selectedI9Form = await getI9FormDetails(numericId);
            setI9FormData({
                form_type: 'I9',
                employee_last_name: selectedI9Form.EMPLOYEE_LAST_NAME || '',
                employee_first_name: selectedI9Form.EMPLOYEE_FIRST_NAME || '',
                employee_middle_initial: selectedI9Form.EMPLOYEE_MIDDLE_INITIAL || '',
                employee_other_last_names: selectedI9Form.EMPLOYEE_OTHER_LAST_NAMES || '',
                employee_street_address: selectedI9Form.EMPLOYEE_STREET_ADDRESS || '',
                employee_apt_number: selectedI9Form.EMPLOYEE_APT_NUMBER || '',
                employee_city: selectedI9Form.EMPLOYEE_CITY || '',
                employee_state: selectedI9Form.EMPLOYEE_STATE || '',
                employee_zip_code: selectedI9Form.EMPLOYEE_ZIP_CODE || '',
                employee_dob: selectedI9Form.EMPLOYEE_DOB ? new Date(selectedI9Form.EMPLOYEE_DOB).toISOString().split('T')[0] : '',
                employee_ssn: selectedI9Form.EMPLOYEE_SSN || '',
                employee_email: selectedI9Form.EMPLOYEE_EMAIL || '',
                employee_phone: selectedI9Form.EMPLOYEE_PHONE || '',
                citizenship_status: selectedI9Form.CITIZENSHIP_STATUS?.toString() || '1',
                alien_number: selectedI9Form.ALIEN_NUMBER || '',
                work_authorization_expiry: selectedI9Form.WORK_AUTHORIZATION_EXPIRY ? new Date(selectedI9Form.WORK_AUTHORIZATION_EXPIRY).toISOString().split('T')[0] : '',
                uscis_a_number: selectedI9Form.USCIS_A_NUMBER || '',
                i94_admission_number: selectedI9Form.I94_ADMISSION_NUMBER || '',
                foreign_passport_number: selectedI9Form.FOREIGN_PASSPORT_NUMBER || '',
                country_of_issuance: selectedI9Form.COUNTRY_OF_ISSUANCE || '',
                employee_signature_date: selectedI9Form.EMPLOYEE_SIGNATURE_DATE ? new Date(selectedI9Form.EMPLOYEE_SIGNATURE_DATE).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
                employee_signature_url: selectedI9Form.EMPLOYEE_SIGNATURE_URL || '',
                employee_verified_flag: selectedI9Form.EMPLOYEE_VERIFIED_FLAG || false,
            });

            setSignatureType('canvas');
            setPdfSignatureFile(null);
            setPdfSignaturePreview(null);
            if (pdfFileInputRef.current) {
                pdfFileInputRef.current.value = '';
            }

            const employee = await fetchEmployeeById(empid);
            setI9FormData(prev => ({
                ...prev,
                employee_last_name: prev.employee_last_name || employee.EMP_LAST_NAME || '',
                employee_first_name: prev.employee_first_name || employee.EMP_FST_NAME || '',
                employee_middle_initial: prev.employee_middle_initial || employee.EMP_MID_NAME || '',
                employee_street_address: prev.employee_street_address || employee.HOME_ADDR_LINE1 || '',
                employee_apt_number: prev.employee_apt_number || employee.HOME_ADDR_LINE2 || '',
                employee_city: prev.employee_city || employee.HOME_CITY || '',
                employee_state: prev.employee_state || (employee.HOME_STATE_ID ? states.find(s => String(s.ID) === String(employee.HOME_STATE_ID))?.VALUE : employee.HOME_STATE_NAME_CUSTOM || ''),
                employee_zip_code: prev.employee_zip_code || employee.HOME_POSTAL_CODE || '',
                employee_dob: prev.employee_dob || (employee.DOB ? new Date(employee.DOB).toISOString().split('T')[0] : ''),
                employee_ssn: prev.employee_ssn || employee.SSN || '',
                employee_email: prev.employee_email || employee.email || '',
                employee_phone: prev.employee_phone || employee.PHONE_NUMBER || employee.MOBILE_NUMBER || '',
            }));
        }
        else {
            setError(`Cannot open form type: ${form.FORM_TYPE}`);
        }

    } catch (err) {
      setError('Failed to load form details: ' + err.message);
      console.error(err);
      setActiveView('list');
      setSelectedFormId(null);
    }
  };

  const handleAddForm = () => {
    setShowFormTypeModal(true);
    setSelectedFormType('I9');
    setError(null);
    setSuccessMessage('');
  };

  const handleFormTypeSelect = async () => {
    if (!selectedFormType) {
      setError('Please select a form type');
      return;
    }

    if (selectedFormType === 'W9' && !employeeSuborgId) {
      setError('Cannot create W-9 form: Employee must be assigned to a Sub-Organization first. Please update the employee\'s Employment Details.');
      return;
    }

    setShowFormTypeModal(false);
    setError(null);
    setSuccessMessage('');
    setIsEditing(true);
    setIsAdding(true);
    setSelectedFormId(null);

    if (selectedFormType === 'W9') {
        setActiveView('w9form');
    }
    else if (selectedFormType === 'W4') {
        setActiveView('w4form');
    }
    else if (selectedFormType === 'I983') {
        setActiveView('i983form');
    }
    else if (selectedFormType === 'I9') {
        setActiveView('i9form');
        setI9FormData({
          form_type: 'I9',
          employee_last_name: '',
          employee_first_name: '',
          employee_middle_initial: '',
          employee_other_last_names: '',
          employee_street_address: '',
          employee_apt_number: '',
          employee_city: '',
          employee_state: '',
          employee_zip_code: '',
          employee_dob: '',
          employee_ssn: '',
          employee_email: '',
          employee_phone: '',
          citizenship_status: '1',
          alien_number: '',
          work_authorization_expiry: '',
          uscis_a_number: '',
          i94_admission_number: '',
          foreign_passport_number: '',
          country_of_issuance: '',
          employee_signature_date: new Date().toISOString().split('T')[0],
          employee_signature_url: '',
          employee_verified_flag: false,
        });
        setSignatureType('canvas');
        setPdfSignatureFile(null);
        setPdfSignaturePreview(null);
        if (pdfFileInputRef.current) {
            pdfFileInputRef.current.value = '';
        }
        if (i9SigCanvas.current) {
            i9SigCanvas.current.clear();
        }
        try {
          const employee = await fetchEmployeeById(empid);
           setI9FormData(prev => ({
                ...prev,
                employee_last_name: employee.EMP_LAST_NAME || '',
                employee_first_name: employee.EMP_FST_NAME || '',
                employee_middle_initial: employee.EMP_MID_NAME || '',
                employee_street_address: employee.HOME_ADDR_LINE1 || '',
                employee_apt_number: employee.HOME_ADDR_LINE2 || '',
                employee_city: employee.HOME_CITY || '',
                employee_state: (employee.HOME_STATE_ID ? states.find(s => String(s.ID) === String(employee.HOME_STATE_ID))?.VALUE : employee.HOME_STATE_NAME_CUSTOM || ''),
                employee_zip_code: employee.HOME_POSTAL_CODE || '',
                employee_dob: (employee.DOB ? new Date(employee.DOB).toISOString().split('T')[0] : ''),
                employee_ssn: employee.SSN || '',
                employee_email: employee.email || '',
                employee_phone: employee.PHONE_NUMBER || employee.MOBILE_NUMBER || '',
            }));
        } catch (err) {
          console.error('Failed to prefill employee data for new I-9:', err);
           setError("Could not prefill employee data.");
        }
    } else {
        setError('Selected form type is not implemented yet.');
         setActiveView('list');
         setIsAdding(false);
         setIsEditing(false);
    }
  };

  const handleI9FormChange = (e) => {
    const { name, value, type, checked } = e.target;
    setI9FormData(prev => ({
        ...prev,
        [name]: type === 'checkbox' ? checked : value
    }));
  };

  const clearI9Signature = () => {
    if (i9SigCanvas.current) {
      i9SigCanvas.current.clear();
    }
  };

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
      if (i9SigCanvas.current) {
        i9SigCanvas.current.clear();
      }
    }
  };

  // --- UPDATED PDF EXTRACTION LOGIC ---
  const handlePdfFileChange = async (e) => {
    const file = e.target.files?.[0];
    
    if (!file) {
      setPdfSignatureFile(null);
      setPdfSignaturePreview(null);
      return;
    }

    if (file.type !== 'application/pdf') {
      setError('Please upload a valid PDF file.');
      e.target.value = '';
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('PDF file size must be less than 5MB.');
      e.target.value = '';
      return;
    }

    setError(null);
    setPdfSignatureFile(file);
    setIsExtractingSignature(true);

    try {
      console.log('📄 PDF Upload - Loading pdfjs-dist library...');
      // FIXED: Import specific build file to avoid Object.defineProperty error
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
      setError(null);
      
    } catch (err) {
      console.error('❌ PDF extraction error:', err);
      setError('Failed to process PDF file: ' + (err.message || 'Unknown error'));
      setPdfSignatureFile(null);
      setPdfSignaturePreview(null);
      if (pdfFileInputRef.current) {
        pdfFileInputRef.current.value = '';
      }
    } finally {
      setIsExtractingSignature(false);
    }
  };
  // ------------------------------------

  const clearPdfSignature = () => {
    setPdfSignatureFile(null);
    setPdfSignaturePreview(null);
    if (pdfFileInputRef.current) {
      pdfFileInputRef.current.value = '';
    }
  };

  const validateI9Form = () => {
    const requiredFields = [
      'employee_last_name', 'employee_first_name', 'employee_street_address',
      'employee_city', 'employee_state', 'employee_zip_code', 'employee_dob'
    ];
    for (const field of requiredFields) {
      if (!i9FormData[field] || String(i9FormData[field]).trim() === '') {
        const fieldName = field.replace('employee_', '').replace(/_/g, ' ');
        throw new Error(`${fieldName.charAt(0).toUpperCase() + fieldName.slice(1)} is required`);
      }
    }
    const status = i9FormData.citizenship_status;
     if (status === '3' && !i9FormData.uscis_a_number) {
        throw new Error('USCIS#/A-Number is required for Lawful Permanent Residents.');
     }
     if (status === '4' && !i9FormData.work_authorization_expiry) {
        throw new Error('Work Authorization Expiry Date is required for Aliens Authorized to Work.');
     }
     if (status === '4' && !i9FormData.uscis_a_number && !i9FormData.i94_admission_number && !i9FormData.foreign_passport_number) {
          throw new Error('One of USCIS#/A-Number, I-94 Admission Number, or Foreign Passport Number is required for Aliens Authorized to Work.');
     }
     if (status === '4' && i9FormData.foreign_passport_number && !i9FormData.country_of_issuance) {
         throw new Error('Country of Issuance is required if Foreign Passport Number is provided.');
     }

    if (signatureType === 'canvas') {
      if (!i9SigCanvas.current || i9SigCanvas.current.isEmpty()) {
        throw new Error('Signature is required to submit the I-9 form. Please draw your signature.');
      }
    } else if (signatureType === 'pdf') {
      if (!pdfSignaturePreview) {
        throw new Error('Signature is required to submit the I-9 form. Please upload a PDF with your signature.');
      }
    }
    return true;
  };

  const handleI9Save = async () => {
    setError(null);
    setSuccessMessage('');
    setIsSaving(true);

    try {
      validateI9Form();

      let signatureData = null;
      if (signatureType === 'canvas') {
        signatureData = (i9SigCanvas.current && !i9SigCanvas.current.isEmpty())
                        ? i9SigCanvas.current.getCanvas().toDataURL('image/png')
                        : null;
      } else if (signatureType === 'pdf') {
        signatureData = pdfSignaturePreview;
      }

      const dataToSave = {
        ...i9FormData,
        signature_data: signatureData,
        employee_verified_flag: true,
        citizenship_status: parseInt(i9FormData.citizenship_status, 10),
      };

      let result;
      const numericId = isAdding ? null : parseInt(String(selectedFormId).replace('I9-',''));

      if (isAdding) {
        result = await addI9Form({ ...dataToSave, orgid, emp_id: empid, verifier_id: null });
      } else if (isEditing && numericId) {
        result = await updateI9Form(numericId, dataToSave);
      } else {
          throw new Error("Cannot determine whether to add or update I-9 form.");
      }
      if (!result || !result.success) {
          throw new Error(result.error || 'Failed to process I-9 form');
      }

      setSuccessMessage('I-9 Form submitted successfully!');
      await loadAllForms();

      setTimeout(() => {
        handleBack();
      }, 2000);

    } catch (err) {
      setError(err.message || 'Failed to save I-9 form');
       console.error("I-9 Save Error:", err);
    } finally {
      setIsSaving(false);
    }
  };

 const handleDelete = async (form, e) => {
    e.stopPropagation();
    const confirmMessage = 'Are you sure you want to delete this form? This action cannot be undone.';
    
    if (!window.confirm(confirmMessage)) return;

    setError(null);
    setSuccessMessage('');

    try {
        let result;
         const numericIdMatch = String(form.ID).match(/-(\d+)$/);
         const numericId = numericIdMatch ? parseInt(numericIdMatch[1]) : parseInt(String(form.ID));
         if (isNaN(numericId)) throw new Error("Invalid Form ID for deletion.");

        if (form.FORM_TYPE === 'I9') {
            result = await deleteI9Form(numericId);
        } else if (form.FORM_TYPE === 'W9') {
            result = await w9Actions.deleteW9Form(numericId);
        } else if (form.FORM_TYPE === 'W4') {
            result = await w4Actions.deleteW4Form(numericId);
        } else if (form.FORM_TYPE === 'I983') {
             result = await i983Actions.deleteI983Form(numericId);
        } else {
             throw new Error(`Deletion not implemented for form type: ${form.FORM_TYPE}`);
        }

        if (!result || !result.success) {
            throw new Error(result.error || 'Failed to delete form');
        }
        setSuccessMessage('Form deleted successfully');
        await loadAllForms();
    } catch (err) {
      setError('Failed to delete form: ' + err.message);
      console.error("Delete Error:", err);
    }
  };

  const getStatus = (form) => {
     const statusMapI9 = {
        'DRAFT': 'Draft (I-9)',
        'EMPLOYEE_SUBMITTED': 'Pending Verification (I-9)',
        'EMPLOYER_VERIFIED': 'Verified (I-9)',
        'REJECTED': 'Rejected (I-9)'
     };
     const statusMapW9W4 = {
        'DRAFT': 'Draft',
        'SUBMITTED': 'Submitted',
        'VERIFIED': 'Verified (W-4)',
        'REJECTED': 'Rejected'
     };

     const statusMapI983 = {
         'DRAFT': 'Draft (I-983)',
         'GENERATED': 'Generated (I-983)',
     };

    if (form.FORM_TYPE === 'I9') return statusMapI9[form.FORM_STATUS] || form.FORM_STATUS;
    if (form.FORM_TYPE === 'W4') return statusMapW9W4[form.FORM_STATUS] || form.FORM_STATUS;
    if (form.FORM_TYPE === 'I983') return statusMapI983[form.FORM_STATUS] || form.FORM_STATUS;
    if (form.FORM_TYPE === 'W9') {
      return form.FORM_STATUS === 'SUBMITTED' ? 'Completed (W-9)' : (statusMapW9W4[form.FORM_STATUS] || form.FORM_STATUS);
    }
    return form.FORM_STATUS;
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return 'N/A';
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${month}/${day}/${date.getFullYear()}`;
  };

  const getStatusColor = (form) => {
    const colors = {
      draft: '#6c757d',
      pending: '#0d6efd',
      submitted: '#007bff',
      verified: '#28a745',
      rejected: '#dc3545',
      completed: '#198754'
    };

    const status = form.FORM_STATUS;
    let color = colors.draft;

    switch(form.FORM_TYPE) {
        case 'I9':
            if (status === 'EMPLOYEE_SUBMITTED') color = colors.submitted;
            else if (status === 'EMPLOYER_VERIFIED') color = colors.verified;
            else if (status === 'REJECTED') color = colors.rejected;
            break;
        case 'W4':
             if (status === 'SUBMITTED') color = colors.pending;
             else if (status === 'VERIFIED') color = colors.verified;
             else if (status === 'REJECTED') color = colors.rejected;
            break;
        case 'W9':
            if (status === 'SUBMITTED') color = colors.completed;
            break;
        case 'I983':
             if (status === 'GENERATED') color = colors.verified;
             else if (status === 'DRAFT') color = colors.draft;
            break;
    }
    return color;
  };

  const getFormTypeLabel = (type) => {
    const formType = formTypes.find(ft => ft.value === type);
    return formType ? formType.label : type;
  };

  const handleBack = () => {
    setIsAdding(false);
    setIsEditing(false);
    setSelectedFormId(null);
    setActiveView('list');
    setError(null);
    setSuccessMessage('');
    loadAllForms();
  };

  const renderActiveForm = () => {
    switch (activeView) {
      case 'w9form':
        return (
          <W9Form
              empid={empid}
              orgid={orgid}
              onBack={handleBack}
              states={states}
              isAdding={isAdding}
              selectedFormId={selectedFormId}
              onError={setError}
              onSuccess={(msg) => { setSuccessMessage(msg); loadAllForms(); }}
          />
        );
      case 'w4form':
        return (
          <W4Form
              empid={empid}
              orgid={orgid}
              onBack={handleBack}
              states={states}
              isAdding={isAdding}
              selectedFormId={selectedFormId}
              onError={setError}
              onSuccess={(msg) => { setSuccessMessage(msg); loadAllForms(); }}
          />
        );
      case 'i983form':
        return (
          <I983Form
              empid={empid}
              orgid={orgid}
              onBack={handleBack}
              states={states}
              countries={countries}
              isAdding={isAdding}
              selectedFormId={selectedFormId}
              onError={setError}
              onSuccess={(msg) => { setSuccessMessage(msg); loadAllForms(); }}
          />
        );
      case 'i9form':
        return (
          <div className={styles.formDetails}>
            <div className={styles.headerSection}>
              <h2 className={styles.title}>
                {isAdding ? `Add ${getFormTypeLabel('I9')}` : `${isEditing ? 'Edit' : 'View'} ${getFormTypeLabel('I9')}`}
              </h2>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button className={`${styles.button} ${styles.buttonBack}`} onClick={handleBack}>
                  Back to List
                </button>
              </div>
            </div>

            <form onSubmit={(e) => { e.preventDefault(); handleI9Save(); }}>
              <div className={styles.formSection}>
                <h3>Section 1: Employee Information and Attestation</h3>
                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label>Last Name*</label>
                    <input name="employee_last_name" value={i9FormData.employee_last_name ?? ''} onChange={handleI9FormChange} required disabled={!isEditing} />
                  </div>
                  <div className={styles.formGroup}>
                    <label>First Name*</label>
                    <input name="employee_first_name" value={i9FormData.employee_first_name ?? ''} onChange={handleI9FormChange} required disabled={!isEditing} />
                  </div>
                  <div className={styles.formGroup}>
                    <label>Middle Initial</label>
                    <input name="employee_middle_initial" value={i9FormData.employee_middle_initial ?? ''} onChange={handleI9FormChange} disabled={!isEditing} maxLength="1"/>
                  </div>
                </div>
                <div className={styles.formRow}>
                   <div className={styles.formGroup}>
                    <label>Other Last Names Used</label>
                    <input name="employee_other_last_names" value={i9FormData.employee_other_last_names ?? ''} onChange={handleI9FormChange} disabled={!isEditing} />
                  </div>
                </div>
                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label>Street Address*</label>
                    <input name="employee_street_address" value={i9FormData.employee_street_address ?? ''} onChange={handleI9FormChange} required disabled={!isEditing} />
                  </div>
                  <div className={styles.formGroup}>
                    <label>Apt. Number</label>
                    <input name="employee_apt_number" value={i9FormData.employee_apt_number ?? ''} onChange={handleI9FormChange} disabled={!isEditing} />
                  </div>
                </div>
                 <div className={styles.formRow}>
                     <div className={styles.formGroup}>
                        <label>City*</label>
                        <input name="employee_city" value={i9FormData.employee_city ?? ''} onChange={handleI9FormChange} required disabled={!isEditing} />
                    </div>
                     <div className={styles.formGroup}>
                        <label>State*</label>
                        <select name="employee_state" value={i9FormData.employee_state ?? ''} onChange={handleI9FormChange} required disabled={!isEditing}>
                             <option value="">Select State</option>
                             {Array.isArray(states) && states.map((state) => (
                                <option key={state.ID} value={state.VALUE}>{state.VALUE}</option>
                             ))}
                         </select>
                    </div>
                    <div className={styles.formGroup}>
                        <label>ZIP Code*</label>
                        <input name="employee_zip_code" value={i9FormData.employee_zip_code ?? ''} onChange={handleI9FormChange} required disabled={!isEditing} />
                    </div>
                </div>
                 <div className={styles.formRow}>
                     <div className={styles.formGroup}>
                        <label>Date of Birth*</label>
                        <input type="date" name="employee_dob" value={i9FormData.employee_dob ?? ''} onChange={handleI9FormChange} required disabled={!isEditing} />
                    </div>
                     <div className={styles.formGroup}>
                        <label>U.S. Social Security Number</label>
                        <input name="employee_ssn" value={i9FormData.employee_ssn ?? ''} onChange={handleI9FormChange} disabled={!isEditing} />
                    </div>
                </div>
                 <div className={styles.formRow}>
                     <div className={styles.formGroup}>
                        <label>Email Address</label>
                        <input type="email" name="employee_email" value={i9FormData.employee_email ?? ''} onChange={handleI9FormChange} disabled={!isEditing} />
                    </div>
                     <div className={styles.formGroup}>
                        <label>Telephone Number</label>
                        <input type="tel" name="employee_phone" value={i9FormData.employee_phone ?? ''} onChange={handleI9FormChange} disabled={!isEditing} />
                    </div>
                </div>

                <div className={styles.formGroup}>
                  <label>Citizenship/Immigration Status*</label>
                  <select name="citizenship_status" value={i9FormData.citizenship_status ?? '1'} onChange={handleI9FormChange} required disabled={!isEditing}>
                    <option value="1">1. A citizen of the United States</option>
                    <option value="2">2. A noncitizen national of the United States</option>
                    <option value="3">3. A lawful permanent resident</option>
                    <option value="4">4. An alien authorized to work</option>
                  </select>
                </div>

                {i9FormData.citizenship_status === '3' && (
                    <div className={styles.formGroup}>
                        <label>USCIS A-Number or Alien Registration Number*</label>
                        <input name="uscis_a_number" value={i9FormData.uscis_a_number ?? ''} onChange={handleI9FormChange} required disabled={!isEditing} />
                    </div>
                )}
                {i9FormData.citizenship_status === '4' && (
                    <>
                        <div className={styles.formGroup}>
                            <label>Work Authorization Expiration Date*</label>
                            <input type="date" name="work_authorization_expiry" value={i9FormData.work_authorization_expiry ?? ''} onChange={handleI9FormChange} required disabled={!isEditing} />
                        </div>
                        <p>Provide ONE of the following:</p>
                        <div className={styles.formGroup}>
                            <label>USCIS A-Number or Alien Registration Number</label>
                            <input name="uscis_a_number" value={i9FormData.uscis_a_number ?? ''} onChange={handleI9FormChange} disabled={!isEditing} />
                        </div>
                        <div className={styles.formGroup}>
                            <label>Form I-94 Admission Number</label>
                            <input name="i94_admission_number" value={i9FormData.i94_admission_number ?? ''} onChange={handleI9FormChange} disabled={!isEditing} />
                        </div>
                         <div className={styles.formRow}>
                            <div className={styles.formGroup}>
                                <label>Foreign Passport Number</label>
                                <input name="foreign_passport_number" value={i9FormData.foreign_passport_number ?? ''} onChange={handleI9FormChange} disabled={!isEditing} />
                            </div>
                            <div className={styles.formGroup}>
                                <label>Country of Issuance</label>
                                 <select name="country_of_issuance" value={i9FormData.country_of_issuance ?? ''} onChange={handleI9FormChange} disabled={!isEditing}>
                                     <option value="">Select Country</option>
                                     {Array.isArray(countries) && countries.map(country => (
                                         <option key={country.ID} value={country.VALUE}>{country.VALUE}</option>
                                     ))}
                                 </select>
                            </div>
                        </div>
                    </>
                )}

                 <div className={styles.formGroup}>
                    <label>Signature Date</label>
                    <input type="date" name="employee_signature_date" value={i9FormData.employee_signature_date ?? ''} onChange={handleI9FormChange} required disabled={!isEditing} />
                </div>

                {isEditing ? (
                    <div className={styles.formGroup}>
                        <label>Signature*</label>
                        
                        {i9FormData.employee_signature_url && !isAdding && (
                            <div className={styles.signatureDisplay} style={{ marginBottom: '15px'}}>
                                <p style={{margin: '0 0 5px 0', fontSize: '13px', fontWeight: 'bold'}}>Current Signature:</p>
                                <img
                                    src={`${i9FormData.employee_signature_url}?t=${timestamp}`}
                                    alt="Employee Signature"
                                    style={{ maxWidth: '300px', border: '1px solid #ccc', borderRadius: '4px' }}
                                />
                            </div>
                        )}

                        <div className={styles.signatureTypeSelector} style={{ marginBottom: '15px', padding: '10px', backgroundColor: '#f8f9fa', borderRadius: '4px' }}>
                            <p style={{ margin: '0 0 10px 0', fontSize: '14px', fontWeight: '500' }}>
                                {i9FormData.employee_signature_url && !isAdding
                                    ? 'Choose how to provide a new signature:'
                                    : 'Choose signature method:'}
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

                        {signatureType === 'canvas' && (
                            <>
                                <p className={styles.signatureInstruction}>
                                    Please sign below using your mouse or touchscreen.
                                </p>
                                <div className={styles.signatureCanvasWrapper}>
                                    <SignatureCanvas
                                        ref={i9SigCanvas}
                                        canvasProps={{ width: 600, height: 200, className: styles.signatureCanvas }}
                                    />
                                </div>
                                <button type="button" onClick={clearI9Signature} className={`${styles.button} ${styles.clearButton}`}>
                                    Clear Signature
                                </button>
                            </>
                        )}

                        {signatureType === 'pdf' && (
                            <>
                                <p className={styles.signatureInstruction}>
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
                            </>
                        )}
                    </div>
                ) : (
                    i9FormData.employee_signature_url ? (
                        <div className={styles.formGroup}>
                            <label>Employee Signature</label>
                            <div className={styles.signatureDisplay}>
                                <img
                                    src={`${i9FormData.employee_signature_url}?t=${timestamp}`}
                                    alt="Employee Signature"
                                    style={{ maxWidth: '300px', border: '1px solid #ccc', borderRadius: '4px' }}
                                />
                            </div>
                        </div>
                    ) : (
                        <div className={styles.formGroup}>
                            <label>Employee Signature</label>
                            <p style={{ fontStyle: 'italic', color: '#6c757d' }}>No signature on file</p>
                        </div>
                    )
                )}
              </div>

              {isEditing && (
                <div className={styles.formButtons}>
                  <button type="submit" className={`${styles.button} ${styles.buttonSave}`} disabled={isSaving}>
                    {isSaving ? 'Submitting...' : 'Sign and Submit'}
                  </button>
                  <button type="button" className={`${styles.button} ${styles.buttonCancel}`} onClick={handleBack} disabled={isSaving}>
                    Cancel
                  </button>
                </div>
              )}
            </form>
          </div>
        );
      default:
        return null;
    }
  };


  return (
    <div className={styles.i9FormsContainer}>
      {error && <div className={styles.errorMessage}><strong>Error:</strong> {error}</div>}
      {successMessage && <div className={styles.successMessage}><strong>Success:</strong> {successMessage}</div>}

      {showFormTypeModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <h3>Select Form Type</h3>
            <div className={styles.formGroup}>
              <label>Form Type*</label>
              <select value={selectedFormType} onChange={(e) => setSelectedFormType(e.target.value)} className={styles.formSelect}>
                <option value="">Select Form Type</option>
                {formTypes.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>
            <div className={styles.modalButtons}>
              <button className={`${styles.button} ${styles.buttonSave}`} onClick={handleFormTypeSelect} disabled={!selectedFormType}>Continue</button>
              <button className={`${styles.button} ${styles.buttonCancel}`} onClick={() => setShowFormTypeModal(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {activeView === 'list' ? (
        <div className={styles.formsList}>
          <div className={styles.headerSection}>
            <h2 className={styles.title}>Employee Forms</h2>
            <button className={`${styles.button} ${styles.buttonAdd}`} onClick={handleAddForm} disabled={isSaving}>Add Form</button>
          </div>
          <div className={styles.tableWrapper}>
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Form Type</th>
                  <th>Last Updated</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {isSaving ? (
                     <tr><td colSpan="5" style={{ textAlign: 'center', padding: '20px' }}>Loading Forms...</td></tr>
                ) : forms.length === 0 ? (
                  <tr>
                    <td colSpan="5" style={{ textAlign: 'center', padding: '20px' }}>
                      No forms found. Click "Add Form" to create one.
                    </td>
                  </tr>
                ) : (
                  forms.map((form) => {
                    const isDeletable = form.FORM_STATUS === 'DRAFT' || (form.FORM_TYPE === 'I983' && form.FORM_STATUS === 'GENERATED');
                    
                    const isFinalStateForEmployee = (
                        (form.FORM_TYPE === 'I9' && (form.FORM_STATUS === 'EMPLOYER_VERIFIED' || form.FORM_STATUS === 'EMPLOYEE_SUBMITTED')) ||
                        (form.FORM_TYPE === 'W4' && (form.FORM_STATUS === 'VERIFIED' || form.FORM_STATUS === 'SUBMITTED')) ||
                        (form.FORM_TYPE === 'W9' && form.FORM_STATUS === 'SUBMITTED') ||
                        form.FORM_STATUS === 'REJECTED'
                    );

                    return (
                      <tr
                        key={form.ID}
                        onClick={() => handleRowClick(form)}
                        style={{
                          cursor: 'pointer',
                          opacity: (isFinalStateForEmployee && form.FORM_TYPE !== 'I983') ? 0.7 : 1
                        }}
                      >
                        <td>{form.ID}</td>
                        <td>{getFormTypeLabel(form.FORM_TYPE)}</td>
                        <td>{formatDate(form.SORT_DATE)}</td>
                        <td>
                          <span style={{
                            padding: '4px 12px',
                            borderRadius: '12px',
                            backgroundColor: getStatusColor(form) + '20',
                            color: getStatusColor(form),
                            fontSize: '12px',
                            fontWeight: 'bold',
                            whiteSpace: 'nowrap'
                          }}>
                            {getStatus(form)}
                          </span>
                        </td>
                        <td onClick={(e) => e.stopPropagation()}>
                          {isDeletable && (
                            <button
                              className={`${styles.button} ${styles.buttonCancel}`}
                              onClick={(e) => handleDelete(form, e)}
                              style={{ padding: '5px 10px', fontSize: '12px' }}
                            >
                              Delete
                            </button>
                          )}
                           {!isFinalStateForEmployee && !isDeletable && (
                                <span style={{fontSize: '12px', color: '#666'}}>View/Edit</span>
                           )}
                            {isFinalStateForEmployee && form.FORM_TYPE !== 'I983' && (
                                <span style={{fontSize: '12px', color: '#666'}}>View Only</span>
                            )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        renderActiveForm()
      )}
    </div>
  );
};

export default I9Forms;
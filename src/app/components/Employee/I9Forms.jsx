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
import * as w4Actions from '@/app/serverActions/forms/w4form/action';
import * as i983Actions from '@/app/serverActions/forms/i983/actions';
import styles from './I9Forms.module.css';
import { useRouter } from 'next/navigation';
import SignatureCanvas from 'react-signature-canvas';
import W4Form from '../Forms/W4Form/W4Form';
import I983Form from '../Forms/I983Form/I983Form';

// --- DATE UTILITIES (MATCHING I-983 LOGIC) ---

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

// Helper function to safely get values for controlled inputs
const safeValue = (value, defaultValue = '') => value ?? defaultValue;

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
    employee_signature_date: getLocalTodayDate(),
    employee_signature_url: '',
    employee_verified_flag: false,
  });
  const i9SigCanvas = useRef(null);
  
  // ✅ NEW: Image signature support (matching I-983)
  const [signatureType, setSignatureType] = useState('canvas');
  const imageFileInputRef = useRef(null);
  const [imageSignatureFile, setImageSignatureFile] = useState(null);
  const [imageSignaturePreview, setImageSignaturePreview] = useState(null);
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
      const [i9FormsData, w4FormsData, i983FormsData] = await Promise.all([
          fetchI9FormsByEmpId(empid, orgid),
          w4Actions.fetchW4FormsByEmpId(empid, orgid),
          i983Actions.fetchI983FormsByEmpId(empid, orgid),
      ]);

      const combinedForms = [
          ...i9FormsData.map(f => ({ ...f, FORM_TYPE: 'I9', SORT_DATE: f.EMPLOYEE_SIGNATURE_DATE || f.CREATED_AT })),
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

        if (form.FORM_TYPE === 'W4') {
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
                employee_dob: formatDateForInput(selectedI9Form.EMPLOYEE_DOB),
                employee_ssn: selectedI9Form.EMPLOYEE_SSN || '',
                employee_email: selectedI9Form.EMPLOYEE_EMAIL || '',
                employee_phone: selectedI9Form.EMPLOYEE_PHONE || '',
                citizenship_status: String(selectedI9Form.CITIZENSHIP_STATUS || '1'),
                alien_number: selectedI9Form.ALIEN_NUMBER || '',
                work_authorization_expiry: formatDateForInput(selectedI9Form.WORK_AUTHORIZATION_EXPIRY),
                uscis_a_number: selectedI9Form.USCIS_A_NUMBER || '',
                i94_admission_number: selectedI9Form.I94_ADMISSION_NUMBER || '',
                foreign_passport_number: selectedI9Form.FOREIGN_PASSPORT_NUMBER || '',
                country_of_issuance: selectedI9Form.COUNTRY_OF_ISSUANCE || '',
                employee_signature_date: formatDateForInput(selectedI9Form.EMPLOYEE_SIGNATURE_DATE) || getLocalTodayDate(),
                employee_signature_url: selectedI9Form.EMPLOYEE_SIGNATURE_URL || '',
                employee_verified_flag: !!selectedI9Form.EMPLOYEE_VERIFIED_FLAG,
            });
            
            // Reset signature states
            setSignatureType('canvas');
            setImageSignatureFile(null);
            setImageSignaturePreview(null);
        }
    } catch (err) {
        setError('Failed to load form details.');
        console.error(err);
    }
  };

  const handleAddForm = () => {
    setShowFormTypeModal(true);
    setSelectedFormType('');
  };

  const handleFormTypeSelect = () => {
    if (!selectedFormType) return;
    setShowFormTypeModal(false);
    setError(null);
    setSuccessMessage('');
    setIsAdding(true);
    setIsEditing(true);
    setSelectedFormId(null);

    if (selectedFormType === 'W4') {
        setActiveView('w4form');
    } else if (selectedFormType === 'I983') {
        setActiveView('i983form');
    } else {
        setActiveView('i9form');
        setI9FormData({
            form_type: selectedFormType,
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
            employee_signature_date: getLocalTodayDate(),
            employee_signature_url: '',
            employee_verified_flag: false,
        });
        
        // Reset signature states
        setSignatureType('canvas');
        setImageSignatureFile(null);
        setImageSignaturePreview(null);
        if (i9SigCanvas.current) {
            i9SigCanvas.current.clear();
        }
    }
  };

  const handleBack = () => {
    setActiveView('list');
    setIsAdding(false);
    setIsEditing(false);
    setSelectedFormId(null);
    setError(null);
    setSuccessMessage('');
    
    // Reset signature states
    setSignatureType('canvas');
    setImageSignatureFile(null);
    setImageSignaturePreview(null);
  };

  const handleDelete = async (form, e) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this form?')) return;
    
    setIsSaving(true);
    setError(null);
    
    try {
        const numericIdMatch = String(form.ID).match(/-(\d+)$/);
        const numericId = numericIdMatch ? parseInt(numericIdMatch[1]) : parseInt(String(form.ID));
        
        if (form.FORM_TYPE === 'W4') {
            await w4Actions.deleteW4Form(numericId);
        } else if (form.FORM_TYPE === 'I983') {
            await i983Actions.deleteI983Form(numericId);
        } else {
            await deleteI9Form(numericId);
        }
        
        setSuccessMessage('Form deleted successfully.');
        await loadAllForms();
    } catch (err) {
        setError(err.message || 'Failed to delete form.');
        console.error(err);
    } finally {
        setIsSaving(false);
    }
  };

  const handleI9InputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setI9FormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  // ✅ NEW: Handle image signature file selection
  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = ['image/png', 'image/jpeg', 'image/jpg'];
    if (!validTypes.includes(file.type)) {
      setError('Please upload a PNG or JPEG image.');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('Image file is too large. Maximum size is 5MB.');
      return;
    }

    setImageSignatureFile(file);

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setImageSignaturePreview(reader.result);
    };
    reader.readAsDataURL(file);
  };

  // ✅ NEW: Clear image signature
  const clearImageSignature = () => {
    setImageSignatureFile(null);
    setImageSignaturePreview(null);
    if (imageFileInputRef.current) {
      imageFileInputRef.current.value = '';
    }
  };

  // ✅ NEW: Clear canvas signature
  const clearCanvasSignature = () => {
    if (i9SigCanvas.current) {
      i9SigCanvas.current.clear();
    }
  };

  const handleI9Submit = async (e) => {
    e.preventDefault();
    setError(null);
    setIsSaving(true);

    try {
      // ✅ Get signature data based on signature type
      let signatureData = null;
      
      if (signatureType === 'canvas') {
        if (!i9SigCanvas.current || i9SigCanvas.current.isEmpty()) {
          throw new Error('Please provide your signature.');
        }
        signatureData = i9SigCanvas.current.toDataURL('image/png');
      } else if (signatureType === 'image') {
        if (!imageSignatureFile || !imageSignaturePreview) {
          throw new Error('Please upload a signature image.');
        }
        signatureData = imageSignaturePreview;
      }

      if (!signatureData) {
        throw new Error('Please provide your signature.');
      }

      const payload = {
        orgid,
        emp_id: empid,
        verifier_id: empid,
        form_type: i9FormData.form_type,
        employee_verified_flag: true,
        employee_last_name: i9FormData.employee_last_name,
        employee_first_name: i9FormData.employee_first_name,
        employee_middle_initial: i9FormData.employee_middle_initial,
        employee_other_last_names: i9FormData.employee_other_last_names,
        employee_street_address: i9FormData.employee_street_address,
        employee_apt_number: i9FormData.employee_apt_number,
        employee_city: i9FormData.employee_city,
        employee_state: i9FormData.employee_state,
        employee_zip_code: i9FormData.employee_zip_code,
        employee_dob: i9FormData.employee_dob,
        employee_ssn: i9FormData.employee_ssn,
        employee_email: i9FormData.employee_email,
        employee_phone: i9FormData.employee_phone,
        citizenship_status: i9FormData.citizenship_status,
        alien_number: i9FormData.alien_number,
        work_authorization_expiry: i9FormData.work_authorization_expiry,
        uscis_a_number: i9FormData.uscis_a_number,
        i94_admission_number: i9FormData.i94_admission_number,
        foreign_passport_number: i9FormData.foreign_passport_number,
        country_of_issuance: i9FormData.country_of_issuance,
        employee_signature_date: i9FormData.employee_signature_date,
        signature_data: signatureData,
      };

      if (isAdding) {
        await addI9Form(payload);
        setSuccessMessage('I-9 form submitted successfully!');
      } else {
        const numericIdMatch = String(selectedFormId).match(/-(\d+)$/);
        const numericId = numericIdMatch ? parseInt(numericIdMatch[1]) : parseInt(String(selectedFormId));
        await updateI9Form(numericId, payload);
        setSuccessMessage('I-9 form updated successfully!');
      }

      await loadAllForms();
      setActiveView('list');
      setIsAdding(false);
      setIsEditing(false);
      setSelectedFormId(null);
      
      // Reset signature states
      setSignatureType('canvas');
      setImageSignatureFile(null);
      setImageSignaturePreview(null);
    } catch (err) {
      setError(err.message || 'Failed to submit form.');
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  const formatDate = (dateStr) => {
    return formatDateDisplay(dateStr);
  };

  const getFormTypeLabel = (formType) => {
    const type = formTypes.find(t => t.value === formType);
    return type ? type.label : formType;
  };

  const getStatus = (form) => {
    if (form.FORM_TYPE === 'I983') {
      const status = form.FORM_STATUS || 'DRAFT';
      const statusMap = {
        'GENERATED': 'Generated',
        'DRAFT': 'Draft',
        'EMPLOYER_VERIFIED': 'Employer Verified',
      };
      return statusMap[status] || status;
    }
    
    const status = form.FORM_STATUS || 'DRAFT';
    const statusMap = {
      'DRAFT': 'Draft',
      'EMPLOYEE_SUBMITTED': 'Submitted',
      'EMPLOYER_VERIFIED': 'Verified',
      'SUBMITTED': 'Submitted',
      'VERIFIED': 'Verified',
      'REJECTED': 'Rejected',
    };
    return statusMap[status] || status;
  };

  const getStatusColor = (form) => {
    const status = form.FORM_STATUS || 'DRAFT';
    const colorMap = {
      'DRAFT': '#6c757d',
      'GENERATED': '#17a2b8',
      'EMPLOYEE_SUBMITTED': '#007bff',
      'EMPLOYER_VERIFIED': '#28a745',
      'SUBMITTED': '#007bff',
      'VERIFIED': '#28a745',
      'REJECTED': '#dc3545',
    };
    return colorMap[status] || '#6c757d';
  };

  const renderActiveForm = () => {
    switch (activeView) {
      case 'w4form':
        return (
          <W4Form
            empid={empid}
            orgid={orgid}
            formId={selectedFormId ? parseInt(String(selectedFormId).replace('W4-', '')) : null}
            onBack={handleBack}
            onSuccess={(message) => {
              setSuccessMessage(message);
              loadAllForms();
              handleBack();
            }}
            roles={roles}
            states={states}
            timestamp={timestamp}
          />
        );
      
      case 'i983form':
        return (
          <I983Form
            empid={empid}
            orgid={orgid}
            formId={selectedFormId ? parseInt(String(selectedFormId).replace('I983-', '')) : null}
            onBack={handleBack}
            onSuccess={(message) => {
              setSuccessMessage(message);
              loadAllForms();
              handleBack();
            }}
            isAdding={isAdding}
            timestamp={timestamp}
          />
        );

      case 'i9form':
        return (
          <div className={styles.formEditor}>
            <div className={styles.headerSection}>
              <h2 className={styles.title}>
                {isAdding ? 'Add New I-9 Form' : isEditing ? 'Edit I-9 Form' : 'View I-9 Form'}
              </h2>
              <button className={`${styles.button} ${styles.buttonBack}`} onClick={handleBack} disabled={isSaving}>
                Back to List
              </button>
            </div>

            <form onSubmit={handleI9Submit} className={styles.i9Form}>
              <div className={styles.formSection}>
                <h3>Personal Information</h3>
                
                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label>Last Name*</label>
                    <input
                      type="text"
                      name="employee_last_name"
                      value={safeValue(i9FormData.employee_last_name)}
                      onChange={handleI9InputChange}
                      required
                      disabled={!isEditing || isSaving}
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label>First Name*</label>
                    <input
                      type="text"
                      name="employee_first_name"
                      value={safeValue(i9FormData.employee_first_name)}
                      onChange={handleI9InputChange}
                      required
                      disabled={!isEditing || isSaving}
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label>Middle Initial</label>
                    <input
                      type="text"
                      name="employee_middle_initial"
                      value={safeValue(i9FormData.employee_middle_initial)}
                      onChange={handleI9InputChange}
                      maxLength="1"
                      disabled={!isEditing || isSaving}
                    />
                  </div>
                </div>

                <div className={styles.formGroup}>
                  <label>Other Last Names Used (if any)</label>
                  <input
                    type="text"
                    name="employee_other_last_names"
                    value={safeValue(i9FormData.employee_other_last_names)}
                    onChange={handleI9InputChange}
                    disabled={!isEditing || isSaving}
                  />
                </div>

                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label>Street Address*</label>
                    <input
                      type="text"
                      name="employee_street_address"
                      value={safeValue(i9FormData.employee_street_address)}
                      onChange={handleI9InputChange}
                      required
                      disabled={!isEditing || isSaving}
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label>Apt. Number</label>
                    <input
                      type="text"
                      name="employee_apt_number"
                      value={safeValue(i9FormData.employee_apt_number)}
                      onChange={handleI9InputChange}
                      disabled={!isEditing || isSaving}
                    />
                  </div>
                </div>

                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label>City*</label>
                    <input
                      type="text"
                      name="employee_city"
                      value={safeValue(i9FormData.employee_city)}
                      onChange={handleI9InputChange}
                      required
                      disabled={!isEditing || isSaving}
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label>State*</label>
                    <select
                      name="employee_state"
                      value={safeValue(i9FormData.employee_state)}
                      onChange={handleI9InputChange}
                      required
                      disabled={!isEditing || isSaving}
                    >
                      <option value="">Select State</option>
                      {states && states.map((state, index) => (
                        <option key={state.ID || `state-${index}`} value={state.ID}>
                          {state.VALUE}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className={styles.formGroup}>
                    <label>ZIP Code*</label>
                    <input
                      type="text"
                      name="employee_zip_code"
                      value={safeValue(i9FormData.employee_zip_code)}
                      onChange={handleI9InputChange}
                      required
                      disabled={!isEditing || isSaving}
                    />
                  </div>
                </div>

                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label>Date of Birth*</label>
                    <input
                      type="date"
                      name="employee_dob"
                      value={safeValue(i9FormData.employee_dob)}
                      onChange={handleI9InputChange}
                      required
                      disabled={!isEditing || isSaving}
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label>Social Security Number*</label>
                    <input
                      type="text"
                      name="employee_ssn"
                      value={safeValue(i9FormData.employee_ssn)}
                      onChange={handleI9InputChange}
                      placeholder="XXX-XX-XXXX"
                      required
                      disabled={!isEditing || isSaving}
                    />
                  </div>
                </div>

                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label>Email Address*</label>
                    <input
                      type="email"
                      name="employee_email"
                      value={safeValue(i9FormData.employee_email)}
                      onChange={handleI9InputChange}
                      required
                      disabled={!isEditing || isSaving}
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label>Phone Number*</label>
                    <input
                      type="tel"
                      name="employee_phone"
                      value={safeValue(i9FormData.employee_phone)}
                      onChange={handleI9InputChange}
                      required
                      disabled={!isEditing || isSaving}
                    />
                  </div>
                </div>
              </div>

              <div className={styles.formSection}>
                <h3>Citizenship Status</h3>
                
                <div className={styles.formGroup}>
                  <label>I attest, under penalty of perjury, that I am:*</label>
                  <select
                    name="citizenship_status"
                    value={safeValue(i9FormData.citizenship_status)}
                    onChange={handleI9InputChange}
                    required
                    disabled={!isEditing || isSaving}
                  >
                    <option value="1">1. A citizen of the United States</option>
                    <option value="2">2. A noncitizen national of the United States</option>
                    <option value="3">3. A lawful permanent resident</option>
                    <option value="4">4. A noncitizen authorized to work</option>
                  </select>
                </div>

                {i9FormData.citizenship_status === '3' && (
                  <div className={styles.formGroup}>
                    <label>USCIS Number or Alien Registration Number</label>
                    <input
                      type="text"
                      name="alien_number"
                      value={safeValue(i9FormData.alien_number)}
                      onChange={handleI9InputChange}
                      placeholder="Enter USCIS# or A#"
                      disabled={!isEditing || isSaving}
                    />
                  </div>
                )}

                {i9FormData.citizenship_status === '4' && (
                  <>
                    <div className={styles.formRow}>
                      <div className={styles.formGroup}>
                        <label>USCIS A-Number</label>
                        <input
                          type="text"
                          name="uscis_a_number"
                          value={safeValue(i9FormData.uscis_a_number)}
                          onChange={handleI9InputChange}
                          placeholder="A-Number"
                          disabled={!isEditing || isSaving}
                        />
                      </div>
                      <div className={styles.formGroup}>
                        <label>Work Authorization Expiration Date</label>
                        <input
                          type="date"
                          name="work_authorization_expiry"
                          value={safeValue(i9FormData.work_authorization_expiry)}
                          onChange={handleI9InputChange}
                          disabled={!isEditing || isSaving}
                        />
                      </div>
                    </div>

                    <div className={styles.formRow}>
                      <div className={styles.formGroup}>
                        <label>Form I-94 Admission Number</label>
                        <input
                          type="text"
                          name="i94_admission_number"
                          value={safeValue(i9FormData.i94_admission_number)}
                          onChange={handleI9InputChange}
                          disabled={!isEditing || isSaving}
                        />
                      </div>
                      <div className={styles.formGroup}>
                        <label>Foreign Passport Number</label>
                        <input
                          type="text"
                          name="foreign_passport_number"
                          value={safeValue(i9FormData.foreign_passport_number)}
                          onChange={handleI9InputChange}
                          disabled={!isEditing || isSaving}
                        />
                      </div>
                    </div>

                    <div className={styles.formGroup}>
                      <label>Country of Issuance</label>
                      <select
                        name="country_of_issuance"
                        value={safeValue(i9FormData.country_of_issuance)}
                        onChange={handleI9InputChange}
                        disabled={!isEditing || isSaving}
                      >
                        <option value="">Select Country</option>
                        {countries && countries.map((country, index) => (
                          <option key={country.COUNTRY_ID || `country-${index}`} value={country.COUNTRY_ID}>
                            {country.CNAME}
                          </option>
                        ))}
                      </select>
                    </div>
                  </>
                )}
              </div>

              <div className={styles.formSection}>
                <h3>Signature and Attestation</h3>
                
                <div className={styles.formGroup}>
                  <label>Signature Date*</label>
                  <input
                    type="date"
                    name="employee_signature_date"
                    value={safeValue(i9FormData.employee_signature_date)}
                    onChange={handleI9InputChange}
                    required
                    disabled={!isEditing || isSaving}
                  />
                </div>

                {isEditing ? (
                    <div className={styles.formGroup}>
                        <label>Employee Signature*</label>
                        
                        {/* Existing signature display (if editing) */}
                        {!isAdding && i9FormData.employee_signature_url && (
                            <div className={styles.signatureDisplay} style={{ marginBottom: '10px' }}>
                                <p>Current Signature:</p>
                                <img
                                    src={`${i9FormData.employee_signature_url}?t=${timestamp}`}
                                    alt="Current Signature"
                                    style={{ maxHeight: '60px', border: '1px solid #ccc' }}
                                />
                            </div>
                        )}

                        {/* Signature type selector */}
                        <div style={{ marginBottom: '15px', padding: '10px', backgroundColor: '#f8f9fa', borderRadius: '4px' }}>
                            <p style={{ margin: '0 0 10px 0', fontSize: '14px', fontWeight: '500' }}>Choose signature method:</p>
                            <div style={{ display: 'flex', gap: '20px' }}>
                                <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                                    <input
                                        type="radio"
                                        name="signatureType"
                                        value="canvas"
                                        checked={signatureType === 'canvas'}
                                        onChange={(e) => setSignatureType(e.target.value)}
                                        style={{ marginRight: '8px' }}
                                    />
                                    Draw Signature
                                </label>
                                <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                                    <input
                                        type="radio"
                                        name="signatureType"
                                        value="image"
                                        checked={signatureType === 'image'}
                                        onChange={(e) => setSignatureType(e.target.value)}
                                        style={{ marginRight: '8px' }}
                                    />
                                    Upload Signature Image
                                </label>
                            </div>
                        </div>

                        {/* Canvas signature */}
                        {signatureType === 'canvas' && (
                            <>
                                <div className={styles.signatureCanvasWrapper}>
                                    <SignatureCanvas
                                        ref={i9SigCanvas}
                                        canvasProps={{ className: styles.signatureCanvas }}
                                    />
                                </div>
                                <button
                                    type="button"
                                    onClick={clearCanvasSignature}
                                    className={`${styles.button} ${styles.clearButton}`}
                                >
                                    Clear
                                </button>
                            </>
                        )}

                        {/* Image signature upload */}
                        {signatureType === 'image' && (
                            <>
                                <p style={{ margin: '0 0 10px 0', fontSize: '13px', color: '#666' }}>
                                    Upload a PNG, JPG, or JPEG image of your signature.
                                </p>
                                <div style={{ marginBottom: '10px' }}>
                                    <input
                                        type="file"
                                        ref={imageFileInputRef}
                                        accept="image/png,image/jpeg,image/jpg"
                                        onChange={handleImageChange}
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
                                
                                {imageSignaturePreview && (
                                    <div style={{ marginTop: '10px', padding: '10px', backgroundColor: '#f8f9fa', borderRadius: '4px' }}>
                                        <p style={{ margin: '0 0 10px 0', fontSize: '13px', fontWeight: 'bold', color: '#28a745' }}>
                                            ✓ Signature preview:
                                        </p>
                                        <img
                                            src={imageSignaturePreview}
                                            alt="Signature Preview"
                                            style={{
                                                maxWidth: '300px',
                                                maxHeight: '100px',
                                                border: '1px solid #ccc',
                                                borderRadius: '4px',
                                                backgroundColor: '#fff'
                                            }}
                                        />
                                        <div style={{ marginTop: '10px' }}>
                                            <button
                                                type="button"
                                                onClick={clearImageSignature}
                                                className={`${styles.button} ${styles.clearButton}`}
                                            >
                                                Remove & Upload Different Image
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

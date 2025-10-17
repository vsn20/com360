'use client';

import React, { useState, useEffect, useRef } from 'react';
import { fetchEmployeeById } from '@/app/serverActions/Employee/overview';
import {
  addForm,
  fetchFormsByEmpId,
  updateForm,
  getFormTypes,
  canEditForm,
  deleteForm
} from '@/app/serverActions/Employee/i9forms';
// ✅ FIX: Import getI9FormDetails from its correct location
import { getI9FormDetails } from '@/app/serverActions/forms/verification/actions';
import * as w9Actions from '@/app/serverActions/forms/w9form/action';
import styles from './I9Forms.module.css';
import { useRouter } from 'next/navigation';
import SignatureCanvas from 'react-signature-canvas';
import W9Form from '../Forms/W9Form/W9Form';

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
  const [activeView, setActiveView] = useState('list'); // 'list', 'i9form', 'w9form'
  const [formData, setFormData] = useState({
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
  const [isAdding, setIsAdding] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState(initialError);
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const sigCanvas = useRef(null);

  const router = useRouter();

  useEffect(() => {
    loadAllForms();
    loadFormTypes();
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
    }
  };

  const loadAllForms = async () => {
    try {
      const [i9Forms, w9Forms] = await Promise.all([
          fetchFormsByEmpId(empid, orgid),
          w9Actions.fetchW9FormsByEmpId(empid, orgid)
      ]);

      const combinedForms = [
          ...i9Forms,
          ...w9Forms.map(w9Form => ({
              ID: `W9-${w9Form.ID}`,
              FORM_TYPE: 'W9',
              EMPLOYEE_SIGNATURE_DATE: w9Form.SUBMITTED_AT || w9Form.CREATED_AT,
              FORM_STATUS: w9Form.FORM_STATUS,
          }))
      ];

      combinedForms.sort((a, b) => new Date(b.EMPLOYEE_SIGNATURE_DATE || b.CREATED_AT || 0) - new Date(a.EMPLOYEE_SIGNATURE_DATE || a.CREATED_AT || 0));

      setForms(combinedForms);
    } catch (err) {
      setError('Failed to load forms.');
      console.error(err);
    }
  };


  const handleRowClick = async (form) => {
    setError(null);
    setSuccessMessage('');

    if (form.FORM_TYPE === 'W9') {
        try {
            const editCheck = await w9Actions.canEditW9Form(form.ID.replace('W9-', ''));
            if (!editCheck.canEdit) {
                setError(editCheck.reason);
            }
            setSelectedFormId(form.ID);
            setActiveView('w9form');
            setIsAdding(false);
            setIsEditing(false);
        } catch (err) {
             setError('Failed to load W-9 form details: ' + err.message);
        }
        return;
    }

    try {
      const editCheck = await canEditForm(form.ID);
      if (!editCheck.canEdit) {
        setError(editCheck.reason);
      }

      setSelectedFormId(form.ID);
      setActiveView('i9form');
      setIsAdding(false);
      setIsEditing(editCheck.canEdit);

      // ✅ FIX: Use the correctly imported function
      const selectedI9Form = await getI9FormDetails(form.ID);

      setFormData({
        form_type: selectedI9Form.FORM_TYPE || '',
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

      const employee = await fetchEmployeeById(empid);
      prefillFromEmployee(employee);
    } catch (err) {
      setError('Failed to load I-9 form details: ' + err.message);
      console.error(err);
    }
  };

  const prefillFromEmployee = (employee) => {
    setFormData(prev => ({
      ...prev,
      employee_last_name: prev.employee_last_name || employee.EMP_LAST_NAME,
      employee_first_name: prev.employee_first_name || employee.EMP_FST_NAME,
      employee_middle_initial: prev.employee_middle_initial || employee.EMP_MID_NAME,
      employee_street_address: prev.employee_street_address || employee.HOME_ADDR_LINE1,
      employee_apt_number: prev.employee_apt_number || employee.HOME_ADDR_LINE2,
      employee_city: prev.employee_city || employee.HOME_CITY,
      employee_state: prev.employee_state || (employee.HOME_STATE_ID ? states.find(s => String(s.ID) === String(employee.HOME_STATE_ID))?.VALUE : employee.HOME_STATE_NAME_CUSTOM),
      employee_zip_code: prev.employee_zip_code || employee.HOME_POSTAL_CODE,
      employee_dob: prev.employee_dob || (employee.DOB ? new Date(employee.DOB).toISOString().split('T')[0] : ''),
      employee_ssn: prev.employee_ssn || employee.SSN,
      employee_email: prev.employee_email || employee.email,
      employee_phone: prev.employee_phone || employee.PHONE_NUMBER || employee.MOBILE_NUMBER,
    }));
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

    setShowFormTypeModal(false);
    setError(null);
    setSuccessMessage('');

    if (selectedFormType === 'W9') {
        setActiveView('w9form');
        setIsAdding(true);
        setIsEditing(false);
        setSelectedFormId(null);
        return;
    }

    if (selectedFormType === 'I9') {
        setActiveView('i9form');
        setIsAdding(true);
        setIsEditing(true);
        setSelectedFormId(null);

        setFormData({
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
          employee_signature_date: new Date().toISOString().split('T')[0],
          employee_signature_url: '',
          employee_verified_flag: false,
        });

        try {
          const employee = await fetchEmployeeById(empid);
          prefillFromEmployee(employee);
        } catch (err) {
          console.error('Failed to prefill employee data:', err);
        }
        return;
    }

    setError('This form type will be available later.');
  };

  const handleEditForm = async () => {
    try {
        const editCheck = await canEditForm(selectedFormId);
        if (!editCheck.canEdit) {
            setError(editCheck.reason);
            return;
        }
        setIsEditing(true);
        setError(null);
        setSuccessMessage('');
    } catch(err) {
        setError('Error checking edit permission: ' + err.message);
    }
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const clearSignature = () => {
    if (sigCanvas.current) {
      sigCanvas.current.clear();
    }
  };

  const validateForm = () => {
    const requiredFields = [
      'employee_last_name', 'employee_first_name', 'employee_street_address',
      'employee_city', 'employee_state', 'employee_zip_code', 'employee_dob'
    ];

    for (const field of requiredFields) {
      if (!formData[field] || String(formData[field]).trim() === '') {
        const fieldName = field.replace('employee_', '').replace(/_/g, ' ');
        throw new Error(`${fieldName.charAt(0).toUpperCase() + fieldName.slice(1)} is required`);
      }
    }

    if (isAdding || isEditing) {
      if (!sigCanvas.current || sigCanvas.current.isEmpty()) {
        throw new Error('Signature is required to submit the form.');
      }
    }

    const dob = new Date(formData.employee_dob);
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const m = today.getMonth() - dob.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) {
        age--;
    }

    if (isNaN(age) || age < 14 || age > 120) {
      throw new Error('Please enter a valid date of birth');
    }

    if (!formData.citizenship_status) {
      throw new Error('Citizenship status is required');
    }

    if (formData.citizenship_status === '3' && !formData.uscis_a_number) {
      throw new Error('USCIS A-Number is required for lawful permanent residents');
    }

    if (formData.citizenship_status === '4') {
      if (!formData.work_authorization_expiry) {
        throw new Error('Work authorization expiry date is required for aliens authorized to work');
      }
      const expiryDate = new Date(formData.work_authorization_expiry);
      if (expiryDate < new Date().setHours(0,0,0,0)) {
          throw new Error('Work authorization expiry date cannot be in the past');
      }
    }
    return true;
  };

  const handleSave = async () => {
    setError(null);
    setSuccessMessage('');
    setIsSaving(true);

    try {
      validateForm();

      const signatureData = (sigCanvas.current && !sigCanvas.current.isEmpty())
                            ? sigCanvas.current.getCanvas().toDataURL('image/png')
                            : null;

      if ((isAdding || isEditing) && !signatureData) {
           throw new Error('Signature is required to save or submit the form.');
      }

      const dataToSave = {
        ...formData,
        signature_data: signatureData,
        employee_verified_flag: true,
        citizenship_status: parseInt(formData.citizenship_status, 10),
      };

      let result;
      if (isAdding) {
        result = await addForm({ ...dataToSave, orgid, emp_id: empid, verifier_id: '' });
      } else if (isEditing && selectedFormId) {
        result = await updateForm(selectedFormId, dataToSave);
      } else {
          setIsSaving(false);
          return;
      }
      if (!result || !result.success) {
          throw new Error(result.error || 'Failed to process form');
      }

      setSuccessMessage('Form submitted successfully!');
      await loadAllForms();

      setTimeout(() => {
        setIsAdding(false);
        setIsEditing(false);
        setSelectedFormId(null);
        setActiveView('list');
        router.refresh();
      }, 2000);

    } catch (err) {
      setError(err.message || 'Failed to save form');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (form, e) => {
    e.stopPropagation();
    const confirmMessage = 'Are you sure you want to delete this draft? This action cannot be undone.';
    if (!confirm(confirmMessage)) return;

    setError(null);
    setSuccessMessage('');

    try {
      let result;
      if (form.FORM_TYPE === 'I9') {
        result = await deleteForm(form.ID);
      } else if (form.FORM_TYPE === 'W9') {
        result = await w9Actions.deleteW9Form(form.ID.replace('W9-', ''));
      }
      if (!result || !result.success) {
          throw new Error(result.error || 'Failed to delete form');
      }
      setSuccessMessage('Draft deleted successfully');
      await loadAllForms();
    } catch (err) {
      setError('Failed to delete form: ' + err.message);
    }
  };

  const i9CanEdit = (form) => form.FORM_STATUS !== 'EMPLOYER_VERIFIED';
  const w9CanEdit = (form) => form.FORM_STATUS !== 'VERIFIED';

  const getStatus = (form) => {
    const statusMap = {
      'DRAFT': 'Draft',
      'EMPLOYEE_SUBMITTED': 'Submitted (I-9)',
      'SUBMITTED': 'Submitted (W-9)',
      'EMPLOYER_VERIFIED': 'Verified (I-9)',
      'VERIFIED': 'Verified (W-9)',
      'REJECTED': 'Rejected'
    };
    return statusMap[form.FORM_STATUS] || form.FORM_STATUS;
  };

  const getStatusColor = (form) => {
    const status = form.FORM_STATUS;
    const colorMap = {
      'DRAFT': '#6c757d',
      'EMPLOYEE_SUBMITTED': '#007bff',
      'SUBMITTED': '#0d6efd',
      'EMPLOYER_VERIFIED': '#28a745',
      'VERIFIED': '#28a745',
      'REJECTED': '#dc3545'
    };
    return colorMap[status] || '#6c757d';
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

  if (activeView === 'w9form') {
      return (
        <W9Form
            empid={empid}
            orgid={orgid}
            onBack={handleBack}
            states={states}
            isAdding={isAdding}
            selectedFormId={selectedFormId}
            onError={setError}
            onSuccess={setSuccessMessage}
        />
      );
  }

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
                    {type.label} {type.value === 'W4' ? '(Coming Soon)' : ''}
                  </option>
                ))}
              </select>
            </div>
            <div className={styles.modalButtons}>
              <button className={`${styles.button} ${styles.buttonSave}`} onClick={handleFormTypeSelect}>Continue</button>
              <button className={`${styles.button} ${styles.buttonCancel}`} onClick={() => setShowFormTypeModal(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {activeView === 'list' ? (
        <div className={styles.formsList}>
          <div className={styles.headerSection}>
            <h2 className={styles.title}>Employee Forms</h2>
            <button className={`${styles.button} ${styles.buttonAdd}`} onClick={handleAddForm}>Add Form</button>
          </div>
          <div className={styles.tableWrapper}>
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Form Type</th>
                  <th>Submitted/Created Date</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {forms.length === 0 ? (
                  <tr>
                    <td colSpan="5" style={{ textAlign: 'center', padding: '20px' }}>
                      No forms found. Click "Add Form" to create one.
                    </td>
                  </tr>
                ) : (
                  forms.map((form) => {
                    const isDraft = form.FORM_STATUS === 'DRAFT';
                    return (
                      <tr
                        key={form.ID}
                        onClick={() => handleRowClick(form)}
                        style={{
                          cursor: 'pointer',
                          opacity: (form.FORM_STATUS === 'VERIFIED' || form.FORM_STATUS === 'EMPLOYER_VERIFIED') ? 0.7 : 1
                        }}
                      >
                        <td>{form.ID}</td>
                        <td>{getFormTypeLabel(form.FORM_TYPE)}</td>
                        <td>{form.EMPLOYEE_SIGNATURE_DATE ? new Date(form.EMPLOYEE_SIGNATURE_DATE).toLocaleDateString() : 'N/A'}</td>
                        <td>
                          <span style={{
                            padding: '4px 12px',
                            borderRadius: '12px',
                            backgroundColor: getStatusColor(form) + '20',
                            color: getStatusColor(form),
                            fontSize: '12px',
                            fontWeight: 'bold'
                          }}>
                            {getStatus(form)}
                          </span>
                        </td>
                        <td onClick={(e) => e.stopPropagation()}>
                          {isDraft && (
                            <button
                              className={`${styles.button} ${styles.buttonCancel}`}
                              onClick={(e) => handleDelete(form, e)}
                              style={{ padding: '5px 10px', fontSize: '12px' }}
                            >
                              Delete
                            </button>
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
        <div className={styles.formDetails}>
          <div className={styles.headerSection}>
            <h2 className={styles.title}>
              {isAdding ? `Add ${getFormTypeLabel(formData.form_type)}` : `View/Edit ${getFormTypeLabel(formData.form_type)}`}
            </h2>
            <div style={{ display: 'flex', gap: '10px' }}>
              {!isAdding && !isEditing && i9CanEdit(formData) && (
                <button className={`${styles.button} ${styles.buttonSave}`} onClick={handleEditForm}>
                  Edit Form
                </button>
              )}
              <button className={`${styles.button} ${styles.buttonBack}`} onClick={handleBack}>
                Back to List
              </button>
            </div>
          </div>

          <form onSubmit={(e) => { e.preventDefault(); handleSave(); }}>
            <div className={styles.formSection}>
              <h3>Section 1: Employee Information and Attestation</h3>
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>Last Name*</label>
                  <input name="employee_last_name" value={formData.employee_last_name ?? ''} onChange={handleFormChange} required disabled={!isEditing} />
                </div>
                <div className={styles.formGroup}>
                  <label>First Name*</label>
                  <input name="employee_first_name" value={formData.employee_first_name ?? ''} onChange={handleFormChange} required disabled={!isEditing} />
                </div>
                <div className={styles.formGroup}>
                  <label>Middle Initial</label>
                  <input name="employee_middle_initial" value={formData.employee_middle_initial ?? ''} onChange={handleFormChange} disabled={!isEditing} />
                </div>
              </div>

              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>Other Last Names Used</label>
                  <input name="employee_other_last_names" value={formData.employee_other_last_names ?? ''} onChange={handleFormChange} disabled={!isEditing} />
                </div>
              </div>

              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>Street Address*</label>
                  <input name="employee_street_address" value={formData.employee_street_address ?? ''} onChange={handleFormChange} required disabled={!isEditing} />
                </div>
                <div className={styles.formGroup}>
                  <label>Apt. Number</label>
                  <input name="employee_apt_number" value={formData.employee_apt_number ?? ''} onChange={handleFormChange} disabled={!isEditing} />
                </div>
              </div>

              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>City*</label>
                  <input name="employee_city" value={formData.employee_city ?? ''} onChange={handleFormChange} required disabled={!isEditing} />
                </div>
                <div className={styles.formGroup}>
                  <label>State*</label>
                  <select name="employee_state" value={formData.employee_state ?? ''} onChange={handleFormChange} required disabled={!isEditing}>
                    <option value="">Select State</option>
                    {states.map((state) => (
                      <option key={state.ID} value={state.VALUE}>{state.VALUE}</option>
                    ))}
                  </select>
                </div>
                <div className={styles.formGroup}>
                  <label>ZIP Code*</label>
                  <input name="employee_zip_code" value={formData.employee_zip_code ?? ''} onChange={handleFormChange} required disabled={!isEditing} />
                </div>
              </div>

              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>Date of Birth*</label>
                  <input type="date" name="employee_dob" value={formData.employee_dob ?? ''} onChange={handleFormChange} required disabled={!isEditing} />
                </div>
                <div className={styles.formGroup}>
                  <label>Social Security Number</label>
                  <input name="employee_ssn" value={formData.employee_ssn ?? ''} onChange={handleFormChange} maxLength="11" placeholder="###-##-####" disabled={!isEditing} />
                </div>
              </div>

              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>Email Address</label>
                  <input type="email" name="employee_email" value={formData.employee_email ?? ''} onChange={handleFormChange} disabled={!isEditing} />
                </div>
                <div className={styles.formGroup}>
                  <label>Telephone Number</label>
                  <input name="employee_phone" value={formData.employee_phone ?? ''} onChange={handleFormChange} disabled={!isEditing} />
                </div>
              </div>

              <div className={styles.formGroup}>
                <label>Citizenship/Immigration Status*</label>
                <select name="citizenship_status" value={formData.citizenship_status ?? '1'} onChange={handleFormChange} required disabled={!isEditing}>
                  <option value="1">1. A citizen of the United States</option>
                  <option value="2">2. A noncitizen national of the United States</option>
                  <option value="3">3. A lawful permanent resident</option>
                  <option value="4">4. An alien authorized to work</option>
                </select>
              </div>

              {formData.citizenship_status === '3' && (
                <div className={styles.formGroup}>
                  <label>USCIS A-Number*</label>
                  <input
                    name="uscis_a_number"
                    value={formData.uscis_a_number ?? ''}
                    onChange={handleFormChange}
                    required
                    placeholder="A-########"
                    disabled={!isEditing}
                  />
                </div>
              )}

              {formData.citizenship_status === '4' && (
                <>
                  <div className={styles.formGroup}>
                    <label>Work Authorization Expiry*</label>
                    <input
                      type="date"
                      name="work_authorization_expiry"
                      value={formData.work_authorization_expiry ?? ''}
                      onChange={handleFormChange}
                      required
                      disabled={!isEditing}
                    />
                  </div>
                  <p className={styles.conditionalInfo}>
                    Provide one of the following: USCIS A-Number, I-94 Admission Number, OR Foreign Passport details.
                  </p>
                  <div className={styles.formGroup}>
                    <label>USCIS A-Number</label>
                    <input
                      name="uscis_a_number"
                      value={formData.uscis_a_number ?? ''}
                      onChange={handleFormChange}
                      placeholder="A-########"
                      disabled={!isEditing}
                    />
                  </div>
                   <div className={styles.formGroup}>
                    <label>I-94 Admission Number</label>
                    <input
                      name="i94_admission_number"
                      value={formData.i94_admission_number ?? ''}
                      onChange={handleFormChange}
                      disabled={!isEditing}
                    />
                  </div>
                  <div className={styles.formRow}>
                    <div className={styles.formGroup}>
                      <label>Foreign Passport Number</label>
                      <input
                        name="foreign_passport_number"
                        value={formData.foreign_passport_number ?? ''}
                        onChange={handleFormChange}
                        disabled={!isEditing}
                      />
                    </div>
                    <div className={styles.formGroup}>
                      <label>Country of Issuance</label>
                      <select
                        name="country_of_issuance"
                        value={formData.country_of_issuance ?? ''}
                        onChange={handleFormChange}
                        disabled={!isEditing}
                      >
                        <option value="">Select Country</option>
                        {countries.map((country) => (
                          <option key={country.ID} value={country.VALUE}>{country.VALUE}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </>
              )}

              <div className={styles.formGroup}>
                <label>Signature Date</label>
                <input type="date" name="employee_signature_date" value={formData.employee_signature_date ?? ''} onChange={handleFormChange} disabled={!isEditing} />
              </div>

              {isEditing ? (
                  <div className={styles.formGroup}>
                      <label>Signature*</label>
                      <p className={styles.signatureInstruction}>
                          {formData.employee_signature_url && !isAdding
                              ? 'Draw a new signature below to replace the existing one.'
                              : 'Please sign below using your mouse or touchscreen.'}
                      </p>
                      {formData.employee_signature_url && !isAdding && (
                          <div className={styles.currentSignature}>
                              <p>Current signature:</p>
                              <img
                                  src={`${formData.employee_signature_url}?t=${timestamp}`}
                                  alt="Current Signature"
                                  style={{ maxWidth: '300px', border: '1px solid #ccc', borderRadius: '4px' }}
                              />
                          </div>
                      )}
                      <div className={styles.signatureCanvasWrapper}>
                          <SignatureCanvas
                              ref={sigCanvas}
                              canvasProps={{ width: 600, height: 200, className: styles.signatureCanvas }}
                          />
                      </div>
                      <button type="button" onClick={clearSignature} className={`${styles.button} ${styles.clearButton}`}>
                          Clear Signature
                      </button>
                  </div>
              ) : (
                  formData.employee_signature_url && (
                      <div className={styles.formGroup}>
                          <label>Employee Signature</label>
                          <div className={styles.signatureDisplay}>
                              <img
                                  src={`${formData.employee_signature_url}?t=${timestamp}`}
                                  alt="Employee Signature"
                                  style={{ maxWidth: '300px', border: '1px solid #ccc', borderRadius: '4px' }}
                              />
                          </div>
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
      )}
    </div>
  );
};

export default I9Forms;


// src/app/components/Employee/I9Forms.jsx
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
import styles from './I9Forms.module.css';
import { useRouter } from 'next/navigation';
import SignatureCanvas from 'react-signature-canvas';

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
    loadForms();
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

  const loadForms = async () => {
    try {
      const fetchedForms = await fetchFormsByEmpId(empid, orgid);
      setForms(fetchedForms);
    } catch (err) {
      setError('Failed to load forms.');
      console.error(err);
    }
  };

  const handleRowClick = async (formId) => {
    try {
      const form = forms.find(f => f.ID === formId);
      
      if (form && form.FORM_TYPE !== 'I9') {
        setError('This form type will be available later. Currently only I-9 forms can be edited.');
        return;
      }

      const editCheck = await canEditForm(formId);
      if (!editCheck.canEdit) {
        setError(editCheck.reason);
        return;
      }

      setSelectedFormId(formId);
      setIsAdding(false);
      setIsEditing(false);
      setError(null);
      setSuccessMessage('');
      
      if (form) {
        setFormData({
          form_type: form.FORM_TYPE || '',
          employee_last_name: form.EMPLOYEE_LAST_NAME || '',
          employee_first_name: form.EMPLOYEE_FIRST_NAME || '',
          employee_middle_initial: form.EMPLOYEE_MIDDLE_INITIAL || '',
          employee_other_last_names: form.EMPLOYEE_OTHER_LAST_NAMES || '',
          employee_street_address: form.EMPLOYEE_STREET_ADDRESS || '',
          employee_apt_number: form.EMPLOYEE_APT_NUMBER || '',
          employee_city: form.EMPLOYEE_CITY || '',
          employee_state: form.EMPLOYEE_STATE || '',
          employee_zip_code: form.EMPLOYEE_ZIP_CODE || '',
          employee_dob: form.EMPLOYEE_DOB ? new Date(form.EMPLOYEE_DOB).toISOString().split('T')[0] : '',
          employee_ssn: form.EMPLOYEE_SSN || '',
          employee_email: form.EMPLOYEE_EMAIL || '',
          employee_phone: form.EMPLOYEE_PHONE || '',
          citizenship_status: form.CITIZENSHIP_STATUS?.toString() || '1',
          alien_number: form.ALIEN_NUMBER || '',
          work_authorization_expiry: form.WORK_AUTHORIZATION_EXPIRY ? new Date(form.WORK_AUTHORIZATION_EXPIRY).toISOString().split('T')[0] : '',
          uscis_a_number: form.USCIS_A_NUMBER || '',
          i94_admission_number: form.I94_ADMISSION_NUMBER || '',
          foreign_passport_number: form.FOREIGN_PASSPORT_NUMBER || '',
          country_of_issuance: form.COUNTRY_OF_ISSUANCE || '',
          employee_signature_date: form.EMPLOYEE_SIGNATURE_DATE ? new Date(form.EMPLOYEE_SIGNATURE_DATE).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
          employee_signature_url: form.EMPLOYEE_SIGNATURE_URL || '',
          employee_verified_flag: form.EMPLOYEE_VERIFIED_FLAG || false,
        });
      }
      
      const employee = await fetchEmployeeById(empid);
      prefillFromEmployee(employee);
    } catch (err) {
      setError('Failed to load form details: ' + err.message);
      console.error(err);
    }
  };

  const prefillFromEmployee = (employee) => {
    setFormData(prev => ({
      ...prev,
      employee_last_name: employee.EMP_LAST_NAME || prev.employee_last_name,
      employee_first_name: employee.EMP_FST_NAME || prev.employee_first_name,
      employee_middle_initial: employee.EMP_MID_NAME || prev.employee_middle_initial,
      employee_street_address: employee.HOME_ADDR_LINE1 || prev.employee_street_address,
      employee_apt_number: employee.HOME_ADDR_LINE2 || prev.employee_apt_number,
      employee_city: employee.HOME_CITY || prev.employee_city,
      employee_state: employee.HOME_STATE_ID ? states.find(s => s.ID === employee.HOME_STATE_ID)?.VALUE : employee.HOME_STATE_NAME_CUSTOM || prev.employee_state,
      employee_zip_code: employee.HOME_POSTAL_CODE || prev.employee_zip_code,
      employee_dob: employee.DOB ? new Date(employee.DOB).toISOString().split('T')[0] : prev.employee_dob,
      employee_ssn: employee.SSN || prev.employee_ssn,
      employee_email: employee.email || prev.employee_email,
      employee_phone: employee.PHONE_NUMBER || employee.MOBILE_NUMBER || prev.employee_phone,
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

    if (selectedFormType !== 'I9') {
      setError('Only I-9 forms are available at this time. Other form types will be available later.');
      return;
    }

    setShowFormTypeModal(false);
    setIsAdding(true);
    setIsEditing(false);
    setSelectedFormId(null);
    setError(null);
    setSuccessMessage('');
    
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
  };

  const handleEditForm = () => {
    setIsEditing(true);
    setError(null);
    setSuccessMessage('');
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
      'employee_last_name',
      'employee_first_name',
      'employee_street_address',
      'employee_city',
      'employee_state',
      'employee_zip_code',
      'employee_dob'
    ];

    for (const field of requiredFields) {
      if (!formData[field] || formData[field].trim() === '') {
        const fieldName = field.replace('employee_', '').replace(/_/g, ' ');
        throw new Error(`${fieldName} is required`);
      }
    }

    if (!sigCanvas.current || sigCanvas.current.isEmpty()) {
      throw new Error('Signature is required. Please sign the form.');
    }

    const dob = new Date(formData.employee_dob);
    const today = new Date();
    const age = today.getFullYear() - dob.getFullYear();
    
    if (age < 16 || age > 120) {
      throw new Error('Please enter a valid date of birth');
    }

    if (formData.form_type === 'I9') {
      if (!formData.citizenship_status) {
        throw new Error('Citizenship status is required for I-9 forms');
      }

      if (formData.citizenship_status === '3' && !formData.uscis_a_number) {
        throw new Error('USCIS A-Number is required for lawful permanent residents');
      }

      if (formData.citizenship_status === '4') {
        if (!formData.work_authorization_expiry) {
          throw new Error('Work authorization expiry date is required for aliens authorized to work');
        }
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

      const canvas = sigCanvas.current.getCanvas();
      const sigImage = canvas.toDataURL('image/png');

      const dataToSave = {
        ...formData,
        signature_data: sigImage,
        employee_verified_flag: true,
        citizenship_status: parseInt(formData.citizenship_status, 10),
      };

      if (isAdding) {
        console.log('Creating new form...');
        const result = await addForm({
          ...dataToSave,
          orgid,
          emp_id: empid,
          verifier_id: '',
        });
        
        if (result.success) {
          setSuccessMessage('Form created and submitted successfully!');
        }
      } else if (isEditing) {
        console.log('Updating form:', selectedFormId);
        const result = await updateForm(selectedFormId, dataToSave);
        
        if (result.success) {
          setSuccessMessage('Form updated and submitted successfully!');
        }
      }

      await loadForms();
      
      setTimeout(() => {
        setIsAdding(false);
        setIsEditing(false);
        setSelectedFormId(null);
        router.refresh();
      }, 2000);
      
    } catch (err) {
      setError(err.message || 'Failed to save form');
      console.error('Save error:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (formId, e) => {
    e.stopPropagation();
    
    if (!confirm('Are you sure you want to delete this form? This action cannot be undone.')) {
      return;
    }

    try {
      await deleteForm(formId);
      setSuccessMessage('Form deleted successfully');
      await loadForms();
    } catch (err) {
      setError('Failed to delete form: ' + err.message);
    }
  };

  const canEdit = (form) => {
    return form.EMPLOYER_VERIFIED_UPLOADED_FLAG !== 1 && 
           form.FORM_STATUS !== 'EMPLOYER_VERIFIED';
  };

  const getStatus = (form) => {
    if (form.FORM_STATUS) {
      const statusMap = {
        'DRAFT': 'Draft',
        'EMPLOYEE_SUBMITTED': 'Employee Submitted',
        'EMPLOYER_VERIFIED': 'Employer Verified',
        'REJECTED': 'Rejected'
      };
      return statusMap[form.FORM_STATUS] || form.FORM_STATUS;
    }
    
    if (form.EMPLOYER_VERIFIED_UPLOADED_FLAG === 1) {
      return 'Employer Verified';
    }
    return form.EMPLOYEE_VERIFIED_FLAG ? 'Employee Submitted' : 'Draft';
  };

  const getStatusColor = (form) => {
    const status = form.FORM_STATUS || 
                   (form.EMPLOYER_VERIFIED_UPLOADED_FLAG === 1 ? 'EMPLOYER_VERIFIED' : 
                   (form.EMPLOYEE_VERIFIED_FLAG ? 'EMPLOYEE_SUBMITTED' : 'DRAFT'));
    
    const colorMap = {
      'DRAFT': '#6c757d',
      'EMPLOYEE_SUBMITTED': '#007bff',
      'EMPLOYER_VERIFIED': '#28a745',
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
    setError(null);
    setSuccessMessage('');
  };

  return (
    <div className={styles.i9FormsContainer}>
      {error && (
        <div className={styles.errorMessage}>
          <strong>Error:</strong> {error}
        </div>
      )}
      
      {successMessage && (
        <div className={styles.successMessage}>
          <strong>Success:</strong> {successMessage}
        </div>
      )}

      {showFormTypeModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <h3>Select Form Type</h3>
            <div className={styles.formGroup}>
              <label>Form Type*</label>
              <select 
                value={selectedFormType} 
                onChange={(e) => setSelectedFormType(e.target.value)}
                className={styles.formSelect}
              >
                <option value="">Select Form Type</option>
                {formTypes.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label} {type.value !== 'I9' ? '(Coming Soon)' : ''}
                  </option>
                ))}
              </select>
            </div>
            <div className={styles.modalButtons}>
              <button className={`${styles.button} ${styles.buttonSave}`} onClick={handleFormTypeSelect}>
                Continue
              </button>
              <button className={`${styles.button} ${styles.buttonCancel}`} onClick={() => setShowFormTypeModal(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {!isAdding && !selectedFormId ? (
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
                  <th>Submitted Date</th>
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
                  forms.map((form) => (
                    <tr 
                      key={form.ID} 
                      onClick={() => form.FORM_TYPE === 'I9' && canEdit(form) && handleRowClick(form.ID)}
                      style={{ 
                        cursor: form.FORM_TYPE === 'I9' && canEdit(form) ? 'pointer' : 'not-allowed',
                        opacity: form.FORM_TYPE === 'I9' && canEdit(form) ? 1 : 0.6
                      }}
                    >
                      <td>{form.ID}</td>
                      <td>
                        {getFormTypeLabel(form.FORM_TYPE)}
                        {form.FORM_TYPE !== 'I9' && (
                          <span style={{ fontSize: '11px', color: '#6c757d', marginLeft: '5px' }}>
                            (View Only)
                          </span>
                        )}
                      </td>
                      <td>{form.EMPLOYEE_SIGNATURE_DATE ? new Date(form.EMPLOYEE_SIGNATURE_DATE).toLocaleDateString() : '-'}</td>
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
                        {canEdit(form) && getStatus(form) === 'Draft' && (
                          <button 
                            className={`${styles.button} ${styles.buttonCancel}`}
                            onClick={(e) => handleDelete(form.ID, e)}
                            style={{ padding: '5px 10px', fontSize: '12px' }}
                          >
                            Delete
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
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
              {!isEditing && !isAdding && (
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
                  <input 
                    name="employee_last_name" 
                    value={formData.employee_last_name} 
                    onChange={handleFormChange} 
                    required 
                    disabled={!isAdding && !isEditing}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>First Name*</label>
                  <input 
                    name="employee_first_name" 
                    value={formData.employee_first_name} 
                    onChange={handleFormChange} 
                    required 
                    disabled={!isAdding && !isEditing}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Middle Initial</label>
                  <input 
                    name="employee_middle_initial" 
                    value={formData.employee_middle_initial} 
                    onChange={handleFormChange} 
                    disabled={!isAdding && !isEditing}
                  />
                </div>
              </div>
              
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>Other Last Names Used</label>
                  <input 
                    name="employee_other_last_names" 
                    value={formData.employee_other_last_names} 
                    onChange={handleFormChange} 
                    disabled={!isAdding && !isEditing}
                  />
                </div>
              </div>
              
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>Street Address*</label>
                  <input 
                    name="employee_street_address" 
                    value={formData.employee_street_address} 
                    onChange={handleFormChange} 
                    required 
                    disabled={!isAdding && !isEditing}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Apt. Number</label>
                  <input 
                    name="employee_apt_number" 
                    value={formData.employee_apt_number} 
                    onChange={handleFormChange} 
                    disabled={!isAdding && !isEditing}
                  />
                </div>
              </div>
              
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>City*</label>
                  <input 
                    name="employee_city" 
                    value={formData.employee_city} 
                    onChange={handleFormChange} 
                    required 
                    disabled={!isAdding && !isEditing}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>State*</label>
                  <select 
                    name="employee_state" 
                    value={formData.employee_state} 
                    onChange={handleFormChange} 
                    required
                    disabled={!isAdding && !isEditing}
                  >
                    <option value="">Select State</option>
                    {states.map((state) => (
                      <option key={state.ID} value={state.VALUE}>{state.VALUE}</option>
                    ))}
                  </select>
                </div>
                <div className={styles.formGroup}>
                  <label>ZIP Code*</label>
                  <input 
                    name="employee_zip_code" 
                    value={formData.employee_zip_code} 
                    onChange={handleFormChange} 
                    required 
                    disabled={!isAdding && !isEditing}
                  />
                </div>
              </div>
              
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>Date of Birth*</label>
                  <input 
                    type="date" 
                    name="employee_dob" 
                    value={formData.employee_dob} 
                    onChange={handleFormChange} 
                    required 
                    disabled={!isAdding && !isEditing}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Social Security Number</label>
                  <input 
                    name="employee_ssn" 
                    value={formData.employee_ssn} 
                    onChange={handleFormChange} 
                    maxLength="11"
                    placeholder="###-##-####"
                    disabled={!isAdding && !isEditing}
                  />
                </div>
              </div>
              
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>Email Address</label>
                  <input 
                    type="email" 
                    name="employee_email" 
                    value={formData.employee_email} 
                    onChange={handleFormChange} 
                    disabled={!isAdding && !isEditing}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Telephone Number</label>
                  <input 
                    name="employee_phone" 
                    value={formData.employee_phone} 
                    onChange={handleFormChange} 
                    disabled={!isAdding && !isEditing}
                  />
                </div>
              </div>
              
              {formData.form_type === 'I9' && (
                <>
                  <div className={styles.formGroup}>
                    <label>Citizenship/Immigration Status*</label>
                    <select 
                      name="citizenship_status" 
                      value={formData.citizenship_status} 
                      onChange={handleFormChange} 
                      required
                      disabled={!isAdding && !isEditing}
                    >
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
                        value={formData.uscis_a_number} 
                        onChange={handleFormChange} 
                        required
                        placeholder="A-########"
                        disabled={!isAdding && !isEditing}
                      />
                    </div>
                  )}
                  
                  {formData.citizenship_status === '4' && (
                    <>
                      <div className={styles.formGroup}>
                        <label>Alien Number</label>
                        <input 
                          name="alien_number" 
                          value={formData.alien_number} 
                          onChange={handleFormChange} 
                          disabled={!isAdding && !isEditing}
                        />
                      </div>
                      <div className={styles.formGroup}>
                        <label>Work Authorization Expiry*</label>
                        <input 
                          type="date" 
                          name="work_authorization_expiry" 
                          value={formData.work_authorization_expiry} 
                          onChange={handleFormChange} 
                          required
                          disabled={!isAdding && !isEditing}
                        />
                      </div>
                      <div className={styles.formGroup}>
                        <label>USCIS A-Number</label>
                        <input 
                          name="uscis_a_number" 
                          value={formData.uscis_a_number} 
                          onChange={handleFormChange} 
                          placeholder="A-########"
                          disabled={!isAdding && !isEditing}
                        />
                      </div>
                      <div className={styles.formGroup}>
                        <label>I-94 Admission Number</label>
                        <input 
                          name="i94_admission_number" 
                          value={formData.i94_admission_number} 
                          onChange={handleFormChange} 
                          disabled={!isAdding && !isEditing}
                        />
                      </div>
                      <div className={styles.formGroup}>
                        <label>Foreign Passport Number</label>
                        <input 
                          name="foreign_passport_number" 
                          value={formData.foreign_passport_number} 
                          onChange={handleFormChange} 
                          disabled={!isAdding && !isEditing}
                        />
                      </div>
                      <div className={styles.formGroup}>
                        <label>Country of Issuance</label>
                        <select 
                          name="country_of_issuance" 
                          value={formData.country_of_issuance} 
                          onChange={handleFormChange}
                          disabled={!isAdding && !isEditing}
                        >
                          <option value="">Select Country</option>
                          {countries.map((country) => (
                            <option key={country.ID} value={country.VALUE}>{country.VALUE}</option>
                          ))}
                        </select>
                      </div>
                    </>
                  )}
                </>
              )}
              
              <div className={styles.formGroup}>
                <label>Signature Date</label>
                <input 
                  type="date" 
                  name="employee_signature_date" 
                  value={formData.employee_signature_date} 
                  onChange={handleFormChange} 
                  disabled={!isAdding && !isEditing}
                />
              </div>
              
              {(isAdding || isEditing) ? (
                <div className={styles.formGroup}>
                  <label>Signature*</label>
                  <p style={{ fontSize: '14px', color: '#666', marginBottom: '10px' }}>
                    {isEditing 
                      ? 'Draw a new signature below. This will replace your existing signature.' 
                      : 'Please sign below using your mouse or touchscreen.'
                    }
                  </p>
                  {isEditing && formData.employee_signature_url && (
                    <div style={{ marginBottom: '10px', padding: '10px', backgroundColor: '#f8f9fa', borderRadius: '4px' }}>
                      <p style={{ margin: '0 0 10px 0', fontSize: '13px', fontWeight: 'bold' }}>
                        Current signature (will be replaced):
                      </p>
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
                      canvasProps={{ 
                        width: 600, 
                        height: 200, 
                        className: styles.signatureCanvas
                      }} 
                    />
                  </div>
                  <button 
                    type="button" 
                    onClick={clearSignature}
                    style={{ marginTop: '10px' }}
                    className={styles.button}
                  >
                    Clear Signature
                  </button>
                </div>
              ) : (
                formData.employee_signature_url && (
                  <div className={styles.formGroup}>
                    <label>Employee Signature</label>
                    <div style={{ padding: '10px', backgroundColor: '#f8f9fa', borderRadius: '4px' }}>
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
            
            {(isAdding || isEditing) && (
              <div className={styles.formButtons}>
                <button type="submit" className={`${styles.button} ${styles.buttonSave}`} disabled={isSaving}>
                  {isSaving ? 'Saving...' : 'Submit Form'}
                </button>
                <button 
                  type="button" 
                  className={`${styles.button} ${styles.buttonCancel}`}
                  onClick={handleBack}
                  disabled={isSaving}
                >
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
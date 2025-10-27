'use client';

import React, { useState, useEffect, useRef } from 'react';
import { fetchEmployeeById } from '@/app/serverActions/Employee/overview';
import {
  addForm as addI9Form, // Renamed for clarity
  fetchFormsByEmpId as fetchI9FormsByEmpId, // Renamed for clarity
  updateForm as updateI9Form, // Renamed for clarity
  getFormTypes, // This will need updating on the server
  canEditForm as canEditI9Form, // Renamed for clarity
  deleteForm as deleteI9Form, // Renamed for clarity
} from '@/app/serverActions/Employee/i9forms'; // Core I-9 actions
import { getI9FormDetails } from '@/app/serverActions/forms/verification/actions'; // I-9 details fetcher
import * as w9Actions from '@/app/serverActions/forms/w9form/action';
import * as w4Actions from '@/app/serverActions/forms/w4form/action';
import * as i983Actions from '@/app/serverActions/forms/i983/actions'; // Import I-983 actions
import styles from './I9Forms.module.css';
import { useRouter } from 'next/navigation';
import SignatureCanvas from 'react-signature-canvas';
import W9Form from '../Forms/W9Form/W9Form';
import W4Form from '../Forms/W4Form/W4Form';
import I983Form from '../Forms/I983Form/I983Form'; // Import I-983 component

const I9Forms = ({
  roles,
  empid,
  orgid,
  error: initialError,
  countries,
  states,
  timestamp, // Used for cache-busting images
}) => {
  const [forms, setForms] = useState([]);
  const [selectedFormId, setSelectedFormId] = useState(null);
  const [showFormTypeModal, setShowFormTypeModal] = useState(false);
  const [formTypes, setFormTypes] = useState([]);
  const [selectedFormType, setSelectedFormType] = useState('');
  // Added 'i983form' to possible views
  const [activeView, setActiveView] = useState('list'); // 'list', 'i9form', 'w9form', 'w4form', 'i983form'
  // --- I-9 Specific State ---
  const [i9FormData, setI9FormData] = useState({
    form_type: '', // Should be 'I9' when active
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
    alien_number: '', // Only used for status 3? Check form logic
    work_authorization_expiry: '', // Only used for status 4
    uscis_a_number: '', // Used for status 3 & 4
    i94_admission_number: '', // Only used for status 4
    foreign_passport_number: '', // Only used for status 4
    country_of_issuance: '', // Only used for status 4
    employee_signature_date: new Date().toISOString().split('T')[0],
    employee_signature_url: '',
    employee_verified_flag: false, // Internal flag for submission state
  });
  const i9SigCanvas = useRef(null); // Specific ref for I-9 signature
  // --- End I-9 Specific State ---

  const [isAdding, setIsAdding] = useState(false);
  // General editing flag, I983 component will manage field-level disabling
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState(initialError);
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  const router = useRouter();

  useEffect(() => {
    loadAllForms();
    loadFormTypes();
  }, [orgid, empid]); // Depend on orgid and empid

  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(''), 5000); // Auto-clear success message
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  const loadFormTypes = async () => {
    try {
      // Assuming getFormTypes is updated on the server to include I-983
      const types = await getFormTypes();
      setFormTypes(types);
    } catch (err) {
      console.error('Failed to load form types:', err);
      setError('Failed to load form types.'); // Show error to user
    }
  };

  const loadAllForms = async () => {
    setError(null); // Clear previous errors
    setIsSaving(true); // Indicate loading
    try {
      const [i9FormsData, w9FormsData, w4FormsData, i983FormsData] = await Promise.all([
          fetchI9FormsByEmpId(empid, orgid), // Fetch I-9 forms
          w9Actions.fetchW9FormsByEmpId(empid, orgid),
          w4Actions.fetchW4FormsByEmpId(empid, orgid),
          i983Actions.fetchI983FormsByEmpId(empid, orgid), // Fetch I-983 forms
      ]);

      const combinedForms = [
          ...i9FormsData.map(f => ({ ...f, FORM_TYPE: 'I9', SORT_DATE: f.EMPLOYEE_SIGNATURE_DATE || f.CREATED_AT })), // Ensure type and sort date
          ...w9FormsData.map(w9Form => ({
              ID: `W9-${w9Form.ID}`, // Prefix ID
              FORM_TYPE: 'W9',
              // Use consistent date field for sorting, preferring submitted, then signature, then created
              SORT_DATE: w9Form.SUBMITTED_AT || w9Form.SIGNATURE_DATE || w9Form.CREATED_AT,
              FORM_STATUS: w9Form.FORM_STATUS,
          })),
          ...w4FormsData.map(w4Form => ({
              ID: `W4-${w4Form.ID}`, // Prefix ID
              FORM_TYPE: 'W4',
              SORT_DATE: w4Form.SUBMITTED_AT || w4Form.EMPLOYEE_SIGNATURE_DATE || w4Form.CREATED_AT,
              FORM_STATUS: w4Form.FORM_STATUS,
          })),
           ...i983FormsData.map(i983Form => ({ // Add I-983 forms
              ID: `I983-${i983Form.ID}`, // Prefix ID
              FORM_TYPE: 'I983',
              // Use UPDATED_AT or CREATED_AT for sorting I-983
              SORT_DATE: i983Form.UPDATED_AT || i983Form.CREATED_AT,
              FORM_STATUS: i983Form.FORM_STATUS,
          })),
      ];

      // Sort by the derived SORT_DATE field, most recent first
      combinedForms.sort((a, b) => new Date(b.SORT_DATE || 0) - new Date(a.SORT_DATE || 0));

      setForms(combinedForms);
    } catch (err) {
      setError('Failed to load forms.');
      console.error(err);
    } finally {
        setIsSaving(false); // Done loading
    }
  };


  const handleRowClick = async (form) => {
    if (isSaving) return; // Prevent clicks while loading
    setError(null); // Clear previous error first
    setSuccessMessage('');
    setIsAdding(false); // Reset adding flag
    setSelectedFormId(form.ID); // Store prefixed ID

    console.log("handleRowClick triggered for:", form); // Add log

    try {
        // Extract numeric ID for server actions that need it
        const numericIdMatch = String(form.ID).match(/-(\d+)$/);
        // Fallback for I-9 which doesn't have a prefix in its DB ID
        const numericId = numericIdMatch ? parseInt(numericIdMatch[1]) : parseInt(String(form.ID));
        if (isNaN(numericId)) throw new Error("Invalid Form ID.");

        console.log(`Extracted numeric ID: ${numericId} for type: ${form.FORM_TYPE}`); // Add log

        if (form.FORM_TYPE === 'W9') {
            console.log("Handling W9 click...");
            const editCheck = await w9Actions.canEditW9Form(numericId);
            if (!editCheck.canEdit) setError(editCheck.reason);
            setActiveView('w9form');
            setIsEditing(false); // W9Form handles its own edit state
        }
        else if (form.FORM_TYPE === 'W4') {
             console.log("Handling W4 click...");
            const editCheck = await w4Actions.canEditW4Form(numericId);
            if (!editCheck.canEdit) setError(editCheck.reason);
            setActiveView('w4form');
            setIsEditing(false); // W4Form handles its own edit state
        }
        else if (form.FORM_TYPE === 'I983') {
             console.log("Handling I983 click...");
            // *** NO canEdit CHECK NEEDED HERE for viewing/continuing workflow ***
            const fetchedForm = await i983Actions.getI983FormDetails(numericId);
            console.log("Fetched I983 details:", fetchedForm);
            setActiveView('i983form');
            // Set overall editing state based on completion. Component manages field disables.
            setIsEditing(fetchedForm.FORM_STATUS !== 'FORM_COMPLETED');
            console.log("Set activeView to i983form, isEditing:", fetchedForm.FORM_STATUS !== 'FORM_COMPLETED');
        }
        else if (form.FORM_TYPE === 'I9') {
             console.log("Handling I9 click...");
            // Handle I-9 form click (Existing logic)
            const editCheck = await canEditI9Form(numericId); // Use numeric ID for check
            if (!editCheck.canEdit) {
                 console.log("I9 cannot be edited:", editCheck.reason);
                setError(editCheck.reason);
                // Even if not editable by server rules, allow viewing
            } else {
                 console.log("I9 can be edited.");
            }

            setActiveView('i9form');
            setIsEditing(editCheck.canEdit); // Set editing based on server check

            const selectedI9Form = await getI9FormDetails(numericId); // Use numeric ID
            console.log("Fetched I9 details:", selectedI9Form);

            // Map fetched I-9 data to state
            setI9FormData({
                form_type: 'I9', // Explicitly set form type
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
                alien_number: selectedI9Form.ALIEN_NUMBER || '', // Needs review based on form logic
                work_authorization_expiry: selectedI9Form.WORK_AUTHORIZATION_EXPIRY ? new Date(selectedI9Form.WORK_AUTHORIZATION_EXPIRY).toISOString().split('T')[0] : '',
                uscis_a_number: selectedI9Form.USCIS_A_NUMBER || '',
                i94_admission_number: selectedI9Form.I94_ADMISSION_NUMBER || '',
                foreign_passport_number: selectedI9Form.FOREIGN_PASSPORT_NUMBER || '',
                country_of_issuance: selectedI9Form.COUNTRY_OF_ISSUANCE || '',
                employee_signature_date: selectedI9Form.EMPLOYEE_SIGNATURE_DATE ? new Date(selectedI9Form.EMPLOYEE_SIGNATURE_DATE).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
                employee_signature_url: selectedI9Form.EMPLOYEE_SIGNATURE_URL || '',
                employee_verified_flag: selectedI9Form.EMPLOYEE_VERIFIED_FLAG || false, // Should be based on FORM_STATUS really
            });

            // Prefill I-9 form data if it's missing from form record but available on employee record
            // Ensure prefill doesn't overwrite existing form data
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
            console.log("I9 Data loaded and potentially prefilled.");
        }
        else {
             console.warn("Unknown form type clicked:", form.FORM_TYPE);
            setError(`Cannot open form type: ${form.FORM_TYPE}`);
        }

    } catch (err) {
      setError('Failed to load form details: ' + err.message);
      console.error(err);
      // Reset view if loading fails
      setActiveView('list');
      setSelectedFormId(null);
    }
  };


  const handleAddForm = () => {
    setShowFormTypeModal(true);
    setSelectedFormType('I9'); // Default selection
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
    setIsEditing(true); // Always editable when adding
    setIsAdding(true); // Set adding flag
    setSelectedFormId(null); // Clear selected ID

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
        // Reset I-9 specific state for a new form
        setI9FormData({
          form_type: 'I9', // Set type
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
        // Prefill from employee record
        try {
          const employee = await fetchEmployeeById(empid);
           // Apply prefill to the freshly reset state
           setI9FormData(prev => ({
                ...prev, // Keep the reset defaults (like sig date)
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
         setActiveView('list'); // Go back to list if type is unknown
         setIsAdding(false);
         setIsEditing(false);
    }
  };

  // --- I-9 Specific Handlers ---
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

  const validateI9Form = () => {
    // Basic required field checks for I-9 Section 1
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
    // Citizenship status specific checks
    const status = i9FormData.citizenship_status;
     if (status === '3' && !i9FormData.uscis_a_number) { // LPR requires A-Number or USCIS#
        throw new Error('USCIS#/A-Number is required for Lawful Permanent Residents.');
     }
     if (status === '4' && !i9FormData.work_authorization_expiry) { // Alien Auth. requires expiry
        throw new Error('Work Authorization Expiry Date is required for Aliens Authorized to Work.');
     }
     if (status === '4' && !i9FormData.uscis_a_number && !i9FormData.i94_admission_number && !i9FormData.foreign_passport_number) {
          throw new Error('One of USCIS#/A-Number, I-94 Admission Number, or Foreign Passport Number is required for Aliens Authorized to Work.');
     }
     if (status === '4' && i9FormData.foreign_passport_number && !i9FormData.country_of_issuance) {
         throw new Error('Country of Issuance is required if Foreign Passport Number is provided.');
     }

    // Check signature
    if (!i9SigCanvas.current || i9SigCanvas.current.isEmpty()) {
       throw new Error('Signature is required to submit the I-9 form.');
    }
    return true;
  };

  const handleI9Save = async () => {
    setError(null);
    setSuccessMessage('');
    setIsSaving(true);

    try {
      validateI9Form(); // Perform validation

      const signatureData = (i9SigCanvas.current && !i9SigCanvas.current.isEmpty())
                            ? i9SigCanvas.current.getCanvas().toDataURL('image/png')
                            : null;

      // Prepare data, ensuring correct types and flags
      const dataToSave = {
        ...i9FormData,
        signature_data: signatureData,
        employee_verified_flag: true, // Set flag to true on submit
        // Convert citizenship status back to number if needed by backend
        citizenship_status: parseInt(i9FormData.citizenship_status, 10),
      };

      let result;
      // Extract numeric ID if updating
      const numericId = isAdding ? null : parseInt(String(selectedFormId).replace('I9-',''));

      if (isAdding) {
        console.log("Adding new I-9 form...");
        result = await addI9Form({ ...dataToSave, orgid, emp_id: empid, verifier_id: null }); // Pass orgid, empid
      } else if (isEditing && numericId) {
        console.log(`Updating I-9 form ID: ${numericId}...`);
        result = await updateI9Form(numericId, dataToSave); // Pass numeric ID
      } else {
          throw new Error("Cannot determine whether to add or update I-9 form.");
      }
      if (!result || !result.success) {
          throw new Error(result.error || 'Failed to process I-9 form');
      }

      setSuccessMessage('I-9 Form submitted successfully!');
      await loadAllForms(); // Refresh the list

      // Delay before going back to list to show success message
      setTimeout(() => {
        handleBack(); // Use the general back handler
      }, 2000);

    } catch (err) {
      setError(err.message || 'Failed to save I-9 form');
       console.error("I-9 Save Error:", err);
    } finally {
      setIsSaving(false);
    }
  };

  // --- End I-9 Specific Handlers ---

 const handleDelete = async (form, e) => {
    e.stopPropagation(); // Prevent row click when clicking delete
    const confirmMessage = 'Are you sure you want to delete this draft? This action cannot be undone.';
    // TODO: Replace window.confirm with a proper modal component
    if (!window.confirm(confirmMessage)) return;

    setError(null);
    setSuccessMessage('');

    try {
        let result;
        // Extract numeric ID
         const numericIdMatch = String(form.ID).match(/-(\d+)$/);
         const numericId = numericIdMatch ? parseInt(numericIdMatch[1]) : parseInt(String(form.ID)); // Fallback for I-9
         if (isNaN(numericId)) throw new Error("Invalid Form ID for deletion.");

        if (form.FORM_TYPE === 'I9') {
            result = await deleteI9Form(numericId); // Use I-9 delete action
        } else if (form.FORM_TYPE === 'W9') {
            result = await w9Actions.deleteW9Form(numericId);
        } else if (form.FORM_TYPE === 'W4') {
            result = await w4Actions.deleteW4Form(numericId);
        } else if (form.FORM_TYPE === 'I983') {
             result = await i983Actions.deleteI983Form(numericId); // Use I-983 delete action
        } else {
             throw new Error(`Deletion not implemented for form type: ${form.FORM_TYPE}`);
        }

        if (!result || !result.success) {
            throw new Error(result.error || 'Failed to delete form');
        }
        setSuccessMessage('Draft deleted successfully');
        await loadAllForms(); // Refresh list
    } catch (err) {
      setError('Failed to delete form: ' + err.message);
      console.error("Delete Error:", err);
    }
  };

  // src/app/components/Employee/I9Forms.jsx

  const getStatus = (form) => {
    // Define status maps for each form type
     const statusMapI9 = {
        'DRAFT': 'Draft (I-9)',
        'EMPLOYEE_SUBMITTED': 'Pending Verification (I-9)',
        'EMPLOYER_VERIFIED': 'Verified (I-9)',
        'REJECTED': 'Rejected (I-9)'
     };
     const statusMapW9W4 = {
        'DRAFT': 'Draft',
        'SUBMITTED': 'Submitted', // W-4 needs verification, W-9 is complete
        'VERIFIED': 'Verified (W-4)', // Only W-4 uses this
        'REJECTED': 'Rejected'
     };

    // --- REPLACE THE OLD statusMapI983 WITH THIS: ---
     const statusMapI983 = {
         'DRAFT': 'Draft (I-983)',
         'PAGE1_COMPLETE': 'Pending Employer Sec 3/4',
         'PAGE2_COMPLETE': 'Pending Student Sec 5 Names',
         'PAGE3_SEC5_NAMES_COMPLETE': 'Pending Employer Sec 5 Site',
         'PAGE3_SEC5_SITE_COMPLETE': 'Pending Student Sec 5 Training',
         'PAGE3_SEC5_TRAINING_COMPLETE': 'Pending Employer Sec 5 Oversight',
         'PAGE3_SEC5_OVERSIGHT_COMPLETE': 'Pending Employer Sec 6',
         'PAGE4_SEC6_COMPLETE': 'Pending Employer Eval 1 Init', // Verifier needs to initiate
         'EVAL1_PENDING_STUDENT_SIGNATURE': 'Pending Student Eval 1 Signature',
         'EVAL1_PENDING_EMPLOYER_SIGNATURE': 'Pending Employer Eval 1 Signature',
         'EVAL1_COMPLETE': 'Pending Employer Eval 2 Init', // Verifier needs to initiate
         'EVAL2_PENDING_STUDENT_SIGNATURE': 'Pending Student Final Eval Sig',
         'EVAL2_PENDING_EMPLOYER_SIGNATURE': 'Pending Employer Final Eval Sig',
         'FORM_COMPLETED': 'Completed (I-983)',
          // Mappings for old statuses
         'STUDENT_SEC1_2_COMPLETE': 'Pending Employer Sec 3/4 (Old)',
         'EMPLOYER_SEC3_4_COMPLETE': 'Pending Student Sec 5 Names (Old)',
         'STUDENT_SEC5_NAMES_COMPLETE': 'Pending Employer Sec 5 Site (Old)',
         'EMPLOYER_SEC5_SITE_COMPLETE': 'Pending Student Sec 5 Training (Old)',
         'STUDENT_SEC5_TRAINING_COMPLETE': 'Pending Employer Sec 5 Oversight (Old)',
         'EMPLOYER_SEC5_EVAL_COMPLETE': 'Pending Employer Sec 6 (Old)',
         'EMPLOYER_SEC6_COMPLETE': 'Pending Employer Eval 1 Init (Old)',
     };
    // --- END OF REPLACEMENT ---

    if (form.FORM_TYPE === 'I9') return statusMapI9[form.FORM_STATUS] || form.FORM_STATUS;
    if (form.FORM_TYPE === 'W4') return statusMapW9W4[form.FORM_STATUS] || form.FORM_STATUS;
     if (form.FORM_TYPE === 'I983') return statusMapI983[form.FORM_STATUS] || form.FORM_STATUS; // This line uses the map
    if (form.FORM_TYPE === 'W9') {
      return form.FORM_STATUS === 'SUBMITTED' ? 'Completed (W-9)' : (statusMapW9W4[form.FORM_STATUS] || form.FORM_STATUS);
    }
    return form.FORM_STATUS; // Fallback
  };

  const getStatusColor = (form) => {
    // Define colors - adjust as needed
    const colors = {
      draft: '#6c757d', // Grey
      pending: '#0d6efd', // Blue (needs external action)
      submitted: '#007bff', // Lighter Blue (e.g., I-9 submitted by emp)
      verified: '#28a745', // Green (I-9, W-4 final)
      rejected: '#dc3545', // Red
      completed: '#198754' // Darker Green (W-9, I-983 final)
    };

    const status = form.FORM_STATUS;
    let color = colors.draft; // Default

    switch(form.FORM_TYPE) {
        case 'I9':
            if (status === 'EMPLOYEE_SUBMITTED') color = colors.submitted;
            else if (status === 'EMPLOYER_VERIFIED') color = colors.verified;
            else if (status === 'REJECTED') color = colors.rejected;
            break;
        case 'W4':
             if (status === 'SUBMITTED') color = colors.pending; // Pending verification
             else if (status === 'VERIFIED') color = colors.verified;
             else if (status === 'REJECTED') color = colors.rejected;
            break;
        case 'W9':
            // Submitted W-9 is considered completed
            if (status === 'SUBMITTED') color = colors.completed;
            break;
        case 'I983':
             // Color based on who needs to act or if completed
             if (status === 'FORM_COMPLETED') color = colors.completed;
             else if (status !== 'DRAFT') color = colors.pending; // Any non-draft/completed state is pending someone's action
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
    loadAllForms(); // Refresh list on back
  };

  // Render correct form based on activeView
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
              onSuccess={(msg) => { setSuccessMessage(msg); loadAllForms(); }} // Ensure list refresh on success
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
              onSuccess={(msg) => { setSuccessMessage(msg); loadAllForms(); }} // Ensure list refresh on success
          />
        );
      case 'i983form': // Add case for I-983
        return (
          <I983Form
              empid={empid}
              orgid={orgid}
              onBack={handleBack}
              states={states} // Pass states if needed for I-983 addresses
              countries={countries} // Pass countries if needed
              isAdding={isAdding}
              selectedFormId={selectedFormId}
              onError={setError}
              onSuccess={(msg) => { setSuccessMessage(msg); loadAllForms(); }} // Ensure list refresh on success
          />
        );
      case 'i9form':
        // I-9 Form View (Existing JSX)
        return (
          <div className={styles.formDetails}>
            <div className={styles.headerSection}>
              <h2 className={styles.title}>
                {isAdding ? `Add ${getFormTypeLabel('I9')}` : `${isEditing ? 'Edit' : 'View'} ${getFormTypeLabel('I9')}`}
              </h2>
              <div style={{ display: 'flex', gap: '10px' }}>
                 {/* Remove the redundant "Edit" button logic here, rely on handleRowClick */}
                <button className={`${styles.button} ${styles.buttonBack}`} onClick={handleBack}>
                  Back to List
                </button>
              </div>
            </div>

            <form onSubmit={(e) => { e.preventDefault(); handleI9Save(); }}>
              <div className={styles.formSection}>
                <h3>Section 1: Employee Information and Attestation</h3>
                {/* I-9 Form fields... */}
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
                             {/* Ensure states is an array */}
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

                {/* Conditional fields based on status */}
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
                                     {/* Ensure countries is an array */}
                                     {Array.isArray(countries) && countries.map(country => (
                                         <option key={country.ID} value={country.VALUE}>{country.VALUE}</option>
                                     ))}
                                 </select>
                            </div>
                        </div>
                    </>
                )}

                {/* Signature Section */}
                 <div className={styles.formGroup}>
                    <label>Signature Date</label>
                    <input type="date" name="employee_signature_date" value={i9FormData.employee_signature_date ?? ''} onChange={handleI9FormChange} required disabled={!isEditing} />
                </div>

                {isEditing ? (
                    <div className={styles.formGroup}>
                        <label>Signature*</label>
                        <p className={styles.signatureInstruction}>
                            {i9FormData.employee_signature_url && !isAdding
                                ? 'Draw a new signature below to replace the existing one.'
                                : 'Please sign below using your mouse or touchscreen.'}
                        </p>
                         {/* Display existing signature if editing */}
                         {i9FormData.employee_signature_url && !isAdding && (
                            <div className={styles.signatureDisplay} style={{ marginBottom: '10px'}}>
                                <p style={{margin: '0 0 5px 0', fontSize: '13px'}}>Current Signature:</p>
                                <img
                                    src={`${i9FormData.employee_signature_url}?t=${timestamp}`} // Use timestamp for cache bust
                                    alt="Employee Signature"
                                    style={{ maxWidth: '300px', border: '1px solid #ccc', borderRadius: '4px' }}
                                />
                            </div>
                        )}
                        <div className={styles.signatureCanvasWrapper}>
                            <SignatureCanvas
                                ref={i9SigCanvas} // Use specific I-9 ref
                                canvasProps={{ width: 600, height: 200, className: styles.signatureCanvas }}
                            />
                        </div>
                        <button type="button" onClick={clearI9Signature} className={`${styles.button} ${styles.clearButton}`}>
                            Clear Signature
                        </button>
                    </div>
                ) : (
                    // Read-only signature display
                    i9FormData.employee_signature_url && (
                        <div className={styles.formGroup}>
                            <label>Employee Signature</label>
                            <div className={styles.signatureDisplay}>
                                <img
                                    src={`${i9FormData.employee_signature_url}?t=${timestamp}`} // Use timestamp
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
        );
      default:
        return null; // Should not happen if activeView is managed correctly
    }
  };


  return (
    <div className={styles.i9FormsContainer}>
      {error && <div className={styles.errorMessage}><strong>Error:</strong> {error}</div>}
      {successMessage && <div className={styles.successMessage}><strong>Success:</strong> {successMessage}</div>}

      {/* Form Type Selection Modal */}
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

      {/* Main Content Area */}
      {activeView === 'list' ? (
        // List View
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
                    const isDraft = form.FORM_STATUS === 'DRAFT';
                    // Determine if the form is in a final, non-editable state *for the employee*
                    const isFinalStateForEmployee = (
                        form.FORM_TYPE === 'I9' && form.FORM_STATUS === 'EMPLOYER_VERIFIED' ||
                        form.FORM_TYPE === 'W4' && form.FORM_STATUS === 'VERIFIED' ||
                        form.FORM_TYPE === 'W9' && form.FORM_STATUS === 'SUBMITTED' ||
                        form.FORM_TYPE === 'I983' && form.FORM_STATUS === 'FORM_COMPLETED' ||
                        // Add rejected if it should also be dimmed
                         form.FORM_STATUS === 'REJECTED'
                    );

                    return (
                      <tr
                        key={form.ID}
                        onClick={() => handleRowClick(form)}
                        style={{
                          cursor: 'pointer',
                          opacity: isFinalStateForEmployee ? 0.7 : 1 // Dim final state forms
                        }}
                      >
                        <td>{form.ID}</td>
                        <td>{getFormTypeLabel(form.FORM_TYPE)}</td>
                        <td>{form.SORT_DATE ? new Date(form.SORT_DATE).toLocaleDateString() : 'N/A'}</td>
                        <td>
                          <span style={{
                            padding: '4px 12px',
                            borderRadius: '12px',
                            backgroundColor: getStatusColor(form) + '20', // Add alpha
                            color: getStatusColor(form),
                            fontSize: '12px',
                            fontWeight: 'bold',
                            whiteSpace: 'nowrap' // Prevent wrapping
                          }}>
                            {getStatus(form)}
                          </span>
                        </td>
                        <td onClick={(e) => e.stopPropagation()}> {/* Prevent row click on action button */}
                          {isDraft && ( // Only show delete for drafts
                            <button
                              className={`${styles.button} ${styles.buttonCancel}`}
                              onClick={(e) => handleDelete(form, e)}
                              style={{ padding: '5px 10px', fontSize: '12px' }}
                            >
                              Delete
                            </button>
                          )}
                           {!isDraft && !isFinalStateForEmployee && (form.FORM_TYPE === 'I9' || form.FORM_TYPE === 'I983') && ( // Show 'View/Edit' for non-draft, non-final I9/I983
                                <span style={{fontSize: '12px', color: '#666'}}>View/Edit</span>
                           )}
                            {isFinalStateForEmployee && ( // Show 'View Only' for final states
                                <span style={{fontSize: '12px', color: '#666'}}>View Only</span>
                            )}
                            {/* W4/W9 might just show 'View/Edit' if submitted but not final? Adjust as needed */}
                            {/* Example: (form.FORM_TYPE === 'W4' && form.FORM_STATUS === 'SUBMITTED') && (<span...>) */}

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
        // Render the currently active form component
        renderActiveForm()
      )}
    </div>
  );
};

export default I9Forms;


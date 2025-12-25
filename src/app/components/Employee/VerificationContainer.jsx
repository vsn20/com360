// src/app/components/Employee/VerificationContainer.jsx
'use client';

import React, { useState, useEffect } from 'react';
import {
  getEmployeeFormsForVerification,
  getPendingI9Approvals,
  getI9FormDetails,
  getW4FormDetails,
  getPendingW4Approvals,
  getI983FormDetails, // Import I-983 details fetcher
  getPendingI983Approvals // Import I-983 pending fetcher
} from '@/app/serverActions/forms/verification/actions';
import VerificationForm from './VerificationForm'; // I-9 Verification
import W4VerificationForm from './W4VerificationForm'; // W-4 Verification
import I983VerificationForm from './I983VerificationForm'; // Import I-983 Verification
import styles from './Verification.module.css';

const VerificationContainer = ({
  employees,
  isAdmin,
  hasAllData,
  hasTeamData,
  currentEmpId,
  orgId,
  orgName,
  pendingCount: initialPendingCount // Initial count from server page component
}) => {
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [forms, setForms] = useState([]);
  const [selectedForm, setSelectedForm] = useState(null);
  const [showPending, setShowPending] = useState(false);
  const [pendingForms, setPendingForms] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null); // State setter for errors
  const [successMessage, setSuccessMessage] = useState('');
  // Use state for pending count, initialized from props
  const [pendingCount, setPendingCount] = useState(initialPendingCount);

  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(''), 5000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

    // Clear error when switching views
    useEffect(() => {
     setError(null);
    }, [selectedEmployee, showPending, selectedForm]);

  const loadEmployeeForms = async (empId) => {
    setLoading(true);
    setError(null);
    try {
      // Fetches I-9, W-4, W-9, I-983 for the employee
      const data = await getEmployeeFormsForVerification(empId, orgId);
      setForms(data);
    } catch (err) {
      setError('Failed to load employee forms: ' + err.message);
      setForms([]);
    } finally {
      setLoading(false);
    }
  };

  const loadPendingApprovals = async () => {
    setLoading(true);
    setError(null);
    try {
      const subordinateIds = employees.map(e => e.empid);

      // Fetch pending forms for all relevant types
      // getPendingI983Approvals now only fetches 'DRAFT' forms
      const [i9Data, w4Data, i983Data] = await Promise.all([
        getPendingI9Approvals(orgId, currentEmpId, isAdmin, hasAllData, subordinateIds),
        getPendingW4Approvals(orgId, currentEmpId, isAdmin, hasAllData, subordinateIds),
        getPendingI983Approvals(orgId, currentEmpId, isAdmin, hasAllData, subordinateIds) // Fetch I-983 pending
      ]);

      // Combine and add prefixes
      const combined = [
        ...i9Data, // Already has FORM_TYPE='I9'
        ...w4Data.map(f => ({ ...f, ID: `W4-${f.ID}`, FORM_TYPE: 'W4' })), // Add W4 prefix & ensure type
        ...i983Data.map(f => ({ ...f, ID: `I983-${f.ID}`, FORM_TYPE: 'I983' })) // Add I983 prefix & ensure type
      ];

      // Sort by SUBMITTED_DATE (or equivalent) descending
      combined.sort((a, b) => {
        // Use SORT_DATE if available, otherwise fallback
        const dateA = new Date(a.SORT_DATE || a.SUBMITTED_DATE || a.CREATED_AT || 0);
        const dateB = new Date(b.SORT_DATE || b.SUBMITTED_DATE || b.CREATED_AT || 0);
        return dateB - dateA;
      });

      setPendingForms(combined);
      // Update the pending count based on fetched data
      setPendingCount(combined.length);
    } catch (err) {
      setError('Failed to load pending approvals: ' + err.message);
      setPendingForms([]);
      setPendingCount(0); // Reset count on error
    } finally {
      setLoading(false);
    }
  };

  const handleEmployeeChange = (e) => {
    const empId = e.target.value;
    setSelectedEmployee(empId);
    setShowPending(false);
    setSelectedForm(null);
    if (empId) {
      loadEmployeeForms(empId);
    } else {
      setForms([]);
    }
  };

  const handleShowPending = async () => {
    setShowPending(true);
    setSelectedEmployee('');
    setForms([]);
    setSelectedForm(null);
    await loadPendingApprovals();
  };

  const handleFormClick = async (form) => {
    // Prevent clicking if already loading
    if (loading) return;

    setLoading(true);
    setError(null); // Clear previous errors
    setSuccessMessage(''); // Clear previous success messages
    try {
      let fullFormData;
      // Extract numeric ID
      const numericId = parseInt(String(form.ID).replace(/^[A-Z0-9]+-/, ''));
      if(isNaN(numericId)) throw new Error("Invalid form ID clicked.");

      if (form.FORM_TYPE === 'W4') {
        fullFormData = await getW4FormDetails(numericId);
        fullFormData.FORM_TYPE = 'W4'; // Ensure type is set
      } else if (form.FORM_TYPE === 'I9') {
        fullFormData = await getI9FormDetails(numericId);
         fullFormData.FORM_TYPE = 'I9'; // Ensure type is set
      } else if (form.FORM_TYPE === 'I983') { // Handle I-983 click
        fullFormData = await getI983FormDetails(numericId);
        fullFormData.FORM_TYPE = 'I983'; // Ensure type is set
      } else {
        // W-9 or other non-verifiable form in this context
        setError(`Form type ${form.FORM_TYPE} does not require action here.`);
        setLoading(false);
        return;
      }
      setSelectedForm(fullFormData);
    } catch (err) {
      setError('Failed to load form details: ' + err.message);
      setSelectedForm(null); // Clear selection on error
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    setSelectedForm(null);
    setError(null); // Clear errors when going back
    setSuccessMessage(''); // Clear success messages
    // Refresh the list view (pending or employee)
    if (showPending) {
      loadPendingApprovals();
    } else if (selectedEmployee) {
      loadEmployeeForms(selectedEmployee);
    }
    // No else needed - if neither is selected, it stays on the empty selection screen
  };

  const handleVerificationSuccess = (message) => {
    setSuccessMessage(message);
    setSelectedForm(null); // Go back to the list after success

    // Refresh the list view after a successful action
    if (showPending) {
      loadPendingApprovals(); // Refresh pending list
    } else if (selectedEmployee) {
      loadEmployeeForms(selectedEmployee); // Refresh employee's list
    }
  };

  // --- Status Badge Logic (UPDATED) ---
 const getStatusBadge = (form) => {
    const status = form.FORM_STATUS;
    const type = form.FORM_TYPE;

    // Define colors
    const colors = {
        draft: '#6c757d', // Grey
        pending: '#0d6efd', // Blue (needs action)
        submitted: '#007bff', // Lighter Blue (e.g., I-9 submitted by emp)
        verified: '#28a745', // Green (I-9, W-4 final, I-983 generated)
        rejected: '#dc3545', // Red
        completed: '#198754' // Darker Green (W-9)
    };

    let color = colors.draft;
    let label = status; // Default label is the raw status

     const statusMapI9 = {
        'DRAFT': { label: 'Draft (I-9)', color: colors.draft },
        'EMPLOYEE_SUBMITTED': { label: 'Pending Verification (I-9)', color: colors.submitted },
        'EMPLOYER_VERIFIED': { label: 'Verified (I-9)', color: colors.verified },
        'REJECTED': { label: 'Rejected (I-9)', color: colors.rejected }
     };
     const statusMapW9W4 = {
        'DRAFT': { label: 'Draft', color: colors.draft },
        'SUBMITTED': { label: 'Submitted', color: colors.pending }, // Pending verification for W-4, final for W-9
        'VERIFIED': { label: 'Verified (W-4)', color: colors.verified },
        'REJECTED': { label: 'Rejected', color: colors.rejected }
     };
    
    // --- UPDATED I-983 Status Map ---
    const statusMapI983 = {
        'DRAFT': { label: 'Draft (I-983)', color: colors.draft },
        'GENERATED': { label: 'Generated (I-983)', color: colors.verified },
        // All other step-by-step statuses removed
     };
     // --- END OF UPDATE ---
    
     let config = { label: status, color: colors.draft }; // Default

     if (type === 'I9') config = statusMapI9[status] || config;
     else if (type === 'W4') config = statusMapW9W4[status] || config;
     else if (type === 'W9') {
         // Special case for W9 'SUBMITTED'
         config = status === 'SUBMITTED'
            ? { label: 'Completed (W-9)', color: colors.completed }
            : (statusMapW9W4[status] || config);
     }
     else if (type === 'I983') config = statusMapI983[status] || config;


    return (
      <span style={{
        padding: '4px 12px',
        borderRadius: '12px',
        backgroundColor: config.color + '20', // Add alpha transparency
        color: config.color,
        fontSize: '12px',
        fontWeight: 'bold',
        whiteSpace: 'nowrap' // Prevent wrapping
      }}>
        {config.label}
      </span>
    );
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    try {
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return 'Invalid Date';
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${month}/${day}/${date.getFullYear()}`;
    } catch (e) {
        return 'Invalid Date';
    }
  };

  // --- Main Render ---

  if (selectedForm) {
    // Render the appropriate verification form based on FORM_TYPE
    if (selectedForm.FORM_TYPE === 'W4') {
      return (
        <W4VerificationForm
          form={selectedForm}
          verifierEmpId={currentEmpId}
          orgId={orgId}
          orgName={orgName}
          onBack={handleBack}
          onSuccess={handleVerificationSuccess}
          isAdmin={isAdmin}
          onError={setError} // Pass error handler
        />
      );
    } else if (selectedForm.FORM_TYPE === 'I9') {
      return (
        <VerificationForm // This is the I-9 verification form
          form={selectedForm}
          verifierEmpId={currentEmpId}
          orgId={orgId}
          orgName={orgName}
          onBack={handleBack}
          onSuccess={handleVerificationSuccess}
          isAdmin={isAdmin}
          onError={setError} // Pass error handler
        />
      );
    } else if (selectedForm.FORM_TYPE === 'I983') { // Add case for I-983
       return (
         <I983VerificationForm
           form={selectedForm}
           verifierEmpId={currentEmpId} // Pass verifier ID
           orgId={orgId}
           orgName={orgName}
           onBack={handleBack}
           onSuccess={handleVerificationSuccess} // This will refresh the list
           isAdmin={isAdmin}
           onError={setError} // Pass error handler
         />
       );
    } else {
        // Fallback if somehow a non-verifiable form was selected
        handleBack(); // Go back to list
        return null;
    }
  }

  // --- List View Render ---
  return (
    <div className={styles.verificationContainer}>
      {/* Display error message */}
      {error && <div className={styles.errorMessage}><strong>Error:</strong> {error}</div>}
      {successMessage && <div className={styles.successMessage}><strong>Success:</strong> {successMessage}</div>}

      <div className={styles.headerSection}>
        <h2 className={styles.title}>Document Verification</h2>
        {/* Update button text dynamically */}
        <button
          className={`${styles.button} ${styles.pendingButton}`}
          onClick={handleShowPending}
          disabled={loading} // Disable while loading
        >
          Pending My Approvals {pendingCount > 0 ? `(${pendingCount})` : ''}
        </button>
      </div>

      {!showPending && (
        <div className={styles.filterSection}>
          <div className={styles.formGroup}>
            <label>Select Employee to View Forms</label>
            <select
              value={selectedEmployee}
              onChange={handleEmployeeChange}
              className={styles.formSelect}
              disabled={loading} // Disable while loading
            >
              <option value="">-- Select an Employee --</option>
              {employees.map((emp) => (
                <option key={emp.empid} value={emp.empid}>
                  {emp.EMP_FST_NAME} {emp.EMP_LAST_NAME} ({emp.empid})
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {loading && <div className={styles.loadingMessage}>Loading...</div>}

      {/* Display either pending list or employee's forms list */}
      {!loading && (showPending || selectedEmployee) && (showPending ? pendingForms : forms).length > 0 && (
        <div className={styles.formsList}>
          <h3>{showPending ? 'Forms Pending Your Action' : `Forms for ${employees.find(e => e.empid === selectedEmployee)?.EMP_FST_NAME || ''} ${employees.find(e => e.empid === selectedEmployee)?.EMP_LAST_NAME || ''}`}</h3>
          <div className={styles.tableWrapper}>
            <table className={styles.verificationTable}>
              <thead>
                <tr>
                  <th>Form ID</th>
                  {showPending && <th>Employee</th>}
                  <th>Form Type</th>
                  <th>Last Updated</th>
                  <th>Status</th>
                  <th>Verifier</th>
                </tr>
              </thead>
              {/* --- FIX 1: The map starts on the SAME LINE as <tbody> --- */}
              <tbody>{(showPending ? pendingForms : forms).map((form) => {
                // I-9, W-4, and I-983 are always clickable (to view/edit/verify)
                const isClickable = form.FORM_TYPE === 'I9' || form.FORM_TYPE === 'W4' || form.FORM_TYPE === 'I983';
                let rowStyle = {};
                if (isClickable) {
                    rowStyle.cursor = 'pointer';
                }
                
                // ** UPDATED: Dimming logic **
                if (form.FORM_STATUS === 'EMPLOYER_VERIFIED' || 
                    form.FORM_STATUS === 'VERIFIED' || 
                    (form.FORM_TYPE === 'I983' && form.FORM_STATUS === 'GENERATED') || 
                    (form.FORM_TYPE === 'W9' && form.FORM_STATUS === 'SUBMITTED')) 
                {
                     rowStyle.opacity = 0.7;
                }

                return (
                  <tr
                    key={form.ID}
                    onClick={isClickable ? () => handleFormClick(form) : undefined}
                    className={isClickable ? styles.clickableRow : styles.nonClickableRow}
                    style={rowStyle}
                  >
                    <td>{form.ID}</td>
                    {showPending && <td>{form.EMPLOYEE_FIRST_NAME} {form.EMPLOYEE_LAST_NAME}</td>}
                    <td>{form.FORM_TYPE}</td>
                    <td>{formatDate(form.SORT_DATE || form.UPDATED_AT || form.CREATED_AT)}</td>
                    {/* --- FIX 2: No space between </td> and the comment --- */}
                    <td>{getStatusBadge(form)}</td>{/* Use updated badge function */}
                    <td>
                      {/* ** MODIFIED: I-983 Verifier display ** */}
                      {`${form.VERIFIER_FIRST_NAME || ''} ${form.VERIFIER_LAST_NAME || ''}`.trim() || (form.FORM_TYPE === 'I983' && form.FORM_STATUS !== 'GENERATED' ? 'Pending Action' : 'N/A')}
                    </td>
                  </tr>
                );
              })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Empty States */}
      {!loading && !showPending && selectedEmployee && forms.length === 0 && (
        <div className={styles.emptyState}>No I-9, W-9, W-4, or I-983 forms found for this employee.</div>
      )}
      {!loading && showPending && pendingForms.length === 0 && (
        <div className={styles.emptyState}>No forms pending your action at this time.</div>
      )}
      {/* Initial state before selection */}
       {!loading && !showPending && !selectedEmployee && (
          <div className={styles.emptyState}>Select an employee or view pending approvals.</div>
       )}
    </div>
  );
};

export default VerificationContainer;
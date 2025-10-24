'use client';

import React, { useState, useEffect } from 'react';
import { 
  getEmployeeFormsForVerification, 
  getPendingI9Approvals,
  getI9FormDetails,
  // getW9FormDetails, // No longer needed here
  // getPendingW9Approvals, // No longer needed here
  getW4FormDetails, 
  getPendingW4Approvals 
} from '@/app/serverActions/forms/verification/actions';
import VerificationForm from './VerificationForm';
// import W9VerificationForm from './W9VerificationForm'; // No longer needed
import W4VerificationForm from './W4VerificationForm'; 
import styles from './Verification.module.css';

const VerificationContainer = ({
  employees,
  isAdmin,
  hasAllData,
  hasTeamData,
  currentEmpId,
  orgId,
  orgName,
  pendingCount: initialPendingCount
}) => {
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [forms, setForms] = useState([]);
  const [selectedForm, setSelectedForm] = useState(null);
  const [showPending, setShowPending] = useState(false);
  const [pendingForms, setPendingForms] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');
  const [pendingCount, setPendingCount] = useState(initialPendingCount);

  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(''), 5000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  const loadEmployeeForms = async (empId) => {
    setLoading(true);
    setError(null);
    try {
      // This function on the server side should still fetch all forms,
      // but we will only be able to click on I-9 and W-4
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
      
      // ✅ Removed getPendingW9Approvals
      const [i9Data, w4Data] = await Promise.all([
        getPendingI9Approvals(orgId, currentEmpId, isAdmin, hasAllData, subordinateIds),
        getPendingW4Approvals(orgId, currentEmpId, isAdmin, hasAllData, subordinateIds) 
      ]);

      const combined = [
        ...i9Data,
        ...w4Data.map(f => ({ ...f, ID: `W4-${f.ID}` })) 
      ];
      
      combined.sort((a, b) => {
        const dateA = new Date(a.SUBMITTED_DATE || a.CREATED_AT || 0);
        const dateB = new Date(b.SUBMITTED_DATE || b.CREATED_AT || 0);
        return dateB - dateA;
      });

      setPendingForms(combined);
      setPendingCount(combined.length);
    } catch (err) {
      setError('Failed to load pending approvals: ' + err.message);
      setPendingForms([]);
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
    setLoading(true);
    setError(null);
    try {
      let fullFormData;
      // ✅ Removed W-9 logic
      if (form.FORM_TYPE === 'W4') { 
        const w4Id = parseInt(String(form.ID).replace('W4-', ''));
        fullFormData = await getW4FormDetails(w4Id);
        fullFormData.FORM_TYPE = 'W4';
      } else if (form.FORM_TYPE === 'I9') { // Handle I-9
        fullFormData = await getI9FormDetails(form.ID);
      } else {
        // If it's a W-9 or other non-verifiable form, just set an error
        setError('This form type does not require verification.');
        setLoading(false);
        return;
      }
      setSelectedForm(fullFormData);
    } catch (err) {
      setError('Failed to load form details: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    setSelectedForm(null);
    if (showPending) {
      loadPendingApprovals();
    } else if (selectedEmployee) {
      loadEmployeeForms(selectedEmployee);
    }
  };

  const handleVerificationSuccess = (message) => {
    setSuccessMessage(message);
    setSelectedForm(null);
    
    if (showPending) {
      loadPendingApprovals();
    } else if (selectedEmployee) {
      loadEmployeeForms(selectedEmployee);
    }
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      'DRAFT': { color: '#6c757d', label: 'Draft' },
      'EMPLOYEE_SUBMITTED': { color: '#007bff', label: 'Pending I-9' },
      'EMPLOYER_VERIFIED': { color: '#28a745', label: 'Verified I-9' },
      'REJECTED': { color: '#dc3545', label: 'Rejected' },
      'SUBMITTED': { color: '#0d6efd', label: 'Submitted' }, // W-9 & W-4
      'VERIFIED': { color: '#28a745', label: 'Verified (W-4)' } // W-4 only
    };
    
    const config = statusConfig[status] || statusConfig['DRAFT'];
    
    return (
      <span style={{
        padding: '4px 12px',
        borderRadius: '12px',
        backgroundColor: config.color + '20',
        color: config.color,
        fontSize: '12px',
        fontWeight: 'bold'
      }}>
        {config.label}
      </span>
    );
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return 'N/A';
    return date.toLocaleDateString();
  };

  if (selectedForm) {
    // ✅ Removed W-9 verification form render
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
        />
      );
    }
    
    // Default to I-9 (VerificationForm)
    return (
      <VerificationForm
        form={selectedForm}
        verifierEmpId={currentEmpId}
        orgId={orgId}
        orgName={orgName}
        onBack={handleBack}
        onSuccess={handleVerificationSuccess}
        isAdmin={isAdmin}
      />
    );
  }

  return (
    <div className={styles.verificationContainer}>
      {error && <div className={styles.errorMessage}><strong>Error:</strong> {error}</div>}
      {successMessage && <div className={styles.successMessage}><strong>Success:</strong> {successMessage}</div>}

      <div className={styles.headerSection}>
        <h2 className={styles.title}>Document Verification</h2>
        <button 
          className={`${styles.button} ${styles.pendingButton}`}
          onClick={handleShowPending}
        >
          Pending Approvals {pendingCount > 0 && `(${pendingCount})`}
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

      {!loading && (showPending ? pendingForms : forms).length > 0 && (
        <div className={styles.formsList}>
          {/* ✅ Updated title */}
          <h3>{showPending ? 'Pending Approvals (I-9 & W-4)' : 'Employee Forms (I-9, W-9, W-4)'}</h3>
          <div className={styles.tableWrapper}>
            <table className={styles.verificationTable}>
              <thead>
                <tr>
                  <th>Form ID</th>
                  {showPending && <th>Employee</th>}
                  <th>Form Type</th>
                  <th>Submitted Date</th>
                  <th>Status</th>
                  <th>Verifier</th>
                </tr>
              </thead>
              <tbody>
                {(showPending ? pendingForms : forms).map((form) => {
                  // ✅ Make W-9 rows non-clickable in this view
                  const isClickable = form.FORM_TYPE === 'I9' || form.FORM_TYPE === 'W4';
                  return (
                    <tr 
                      key={form.ID}
                      onClick={isClickable ? () => handleFormClick(form) : undefined}
                      className={isClickable ? styles.clickableRow : styles.nonClickableRow}
                    >
                      <td>{form.ID}</td>
                      {showPending && <td>{form.EMPLOYEE_FIRST_NAME} {form.EMPLOYEE_LAST_NAME}</td>}
                      <td>{form.FORM_TYPE}</td>
                      <td>{formatDate(form.SUBMITTED_DATE || form.EMPLOYEE_SIGNATURE_DATE)}</td>
                      <td>{getStatusBadge(form.FORM_STATUS)}</td>
                      <td>
                        {`${form.VERIFIER_FIRST_NAME || ''} ${form.VERIFIER_LAST_NAME || ''}`.trim() || 'Not Assigned'}
                      </td>
                    </tr>
                  );
                 })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!loading && !showPending && selectedEmployee && forms.length === 0 && (
        <div className={styles.emptyState}>No I-9, W-9, or W-4 forms found for this employee.</div>
      )}
      {/* ✅ Updated title */}
      {!loading && showPending && pendingForms.length === 0 && (
        <div className={styles.emptyState}>No pending I-9 or W-4 approvals at this time.</div>
      )}
    </div>
  );
};

export default VerificationContainer;
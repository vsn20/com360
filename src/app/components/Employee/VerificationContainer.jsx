// src/app/components/Employee/VerificationContainer.jsx
'use client';

import React, { useState, useEffect } from 'react';
import { 
  getEmployeeForms, 
  getPendingApprovals,
  getFormDetails 
} from '@/app/serverActions/Employee/documentverification';
import VerificationForm from './VerificationForm';
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
      const data = await getEmployeeForms(empId, orgId);
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
      const employeeIds = employees.map(e => e.empid);
      const data = await getPendingApprovals(orgId, currentEmpId, isAdmin, hasAllData, employeeIds);
      setPendingForms(data);
      setPendingCount(data.length);
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
      const fullFormData = await getFormDetails(form.ID);
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
    setPendingCount(prev => Math.max(0, prev - 1));
    
    if (showPending) {
      loadPendingApprovals();
    } else if (selectedEmployee) {
      loadEmployeeForms(selectedEmployee);
    }
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      'DRAFT': { color: '#6c757d', label: 'Draft' },
      'EMPLOYEE_SUBMITTED': { color: '#007bff', label: 'Pending Verification' },
      'EMPLOYER_VERIFIED': { color: '#28a745', label: 'Verified' },
      'REJECTED': { color: '#dc3545', label: 'Rejected' }
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
    return new Date(dateStr).toLocaleDateString();
  };

  if (selectedForm) {
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
            <label>Select Employee</label>
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

      {loading && (
        <div className={styles.loadingMessage}>
          Loading...
        </div>
      )}

      {!loading && (showPending ? pendingForms : forms).length > 0 && (
        <div className={styles.formsList}>
          <h3>{showPending ? 'Pending Approvals' : 'Employee Forms'}</h3>
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
                {(showPending ? pendingForms : forms).map((form) => (
                  <tr 
                    key={form.ID}
                    onClick={() => handleFormClick(form)}
                    className={styles.clickableRow}
                  >
                    <td>{form.ID}</td>
                    {showPending && (
                      <td>{form.EMPLOYEE_FIRST_NAME} {form.EMPLOYEE_LAST_NAME}</td>
                    )}
                    <td>{form.FORM_TYPE}</td>
                    <td>{formatDate(form.EMPLOYEE_SIGNATURE_DATE)}</td>
                    <td>{getStatusBadge(form.FORM_STATUS)}</td>
                    <td>
                      {form.VERIFIER_ID ? 
                        `${form.VERIFIER_FIRST_NAME || ''} ${form.VERIFIER_LAST_NAME || ''}`.trim() || form.VERIFIER_ID 
                        : 'Not Assigned'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!loading && !showPending && selectedEmployee && forms.length === 0 && (
        <div className={styles.emptyState}>
          No forms found for this employee.
        </div>
      )}

      {!loading && showPending && pendingForms.length === 0 && (
        <div className={styles.emptyState}>
          No pending approvals at this time.
        </div>
      )}
    </div>
  );
};

export default VerificationContainer;
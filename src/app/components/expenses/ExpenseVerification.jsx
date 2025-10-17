// src/app/components/expenses/ExpenseVerification.jsx
'use client';

import React, { useState, useEffect } from 'react';
import { 
  getVerifierEmployees,
  getExpensesForVerification,
  verifyExpense,
  unverifyExpense,
  getExpenseCategories
} from '@/app/serverActions/expenses/verification';
import styles from './ExpenseSubmission.module.css';

const ExpenseVerification = ({ empid, orgid, error: initialError }) => {
  const [employees, setEmployees] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState('all');
  const [expenses, setExpenses] = useState([]);
  const [selectedExpenseId, setSelectedExpenseId] = useState(null);
  const [expenseDetails, setExpenseDetails] = useState(null);
  const [isViewing, setIsViewing] = useState(false);
  const [error, setError] = useState(initialError);
  const [successMessage, setSuccessMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [showPendingOnly, setShowPendingOnly] = useState(false);
  const [hasAllDataPermission, setHasAllDataPermission] = useState(false);
  const [categories, setCategories] = useState({
    types: [],
    subtypes: [],
    categories: []
  });

  useEffect(() => {
    loadEmployees();
    loadCategories();
  }, [orgid, empid]);

  useEffect(() => {
    loadExpenses();
  }, [selectedEmployee, showPendingOnly]);

  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(''), 5000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  const loadCategories = async () => {
    try {
      const cats = await getExpenseCategories(orgid);
      setCategories(cats);
    } catch (err) {
      console.error('Failed to load categories:', err);
    }
  };

  const loadEmployees = async () => {
    try {
      const result = await getVerifierEmployees(empid, orgid);
      console.log('👥 Loaded employees:', result);
      setEmployees(result.employees);
      setHasAllDataPermission(result.hasAllData);
    } catch (err) {
      setError('Failed to load employees: ' + err.message);
      console.error(err);
    }
  };

  const loadExpenses = async () => {
    try {
      const empIds = selectedEmployee === 'all' 
        ? employees.map(e => e.empid)
        : [selectedEmployee];
      
      if (empIds.length === 0) return;

      const fetchedExpenses = await getExpensesForVerification(
        empIds, 
        orgid, 
        showPendingOnly
      );
      console.log('💰 Loaded expenses for verification:', fetchedExpenses);
      setExpenses(fetchedExpenses);
    } catch (err) {
      setError('Failed to load expenses: ' + err.message);
      console.error(err);
    }
  };

  const handleRowClick = async (expenseId) => {
    try {
      const expense = expenses.find(e => e.ID === expenseId);
      
      setSelectedExpenseId(expenseId);
      setIsViewing(true);
      setError(null);
      setSuccessMessage('');
      setExpenseDetails(expense);
      
    } catch (err) {
      setError('Failed to load expense details: ' + err.message);
      console.error(err);
    }
  };

  const handleVerify = async () => {
    if (!selectedExpenseId) return;
    
    if (!confirm('Are you sure you want to verify this expense?')) {
      return;
    }

    setIsSaving(true);
    setError(null);
    
    try {
      const result = await verifyExpense(selectedExpenseId, empid, orgid);
      
      if (result.success) {
        setSuccessMessage('Expense verified successfully!');
        
        // Update local state
        setExpenseDetails(prev => ({
          ...prev,
          APPROVED_FLAG: 1,
          VERIFIER_ID: empid
        }));
        
        await loadExpenses();
        
        setTimeout(() => {
          setSuccessMessage('');
        }, 3000);
      }
    } catch (err) {
      setError('Failed to verify expense: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleUnverify = async () => {
    if (!selectedExpenseId) return;
    
    if (!confirm('Are you sure you want to change this expense status back to pending? This will remove the verification.')) {
      return;
    }

    setIsSaving(true);
    setError(null);
    
    try {
      const result = await unverifyExpense(selectedExpenseId, orgid);
      
      if (result.success) {
        setSuccessMessage('Expense status changed to pending!');
        
        // Update local state
        setExpenseDetails(prev => ({
          ...prev,
          APPROVED_FLAG: 0,
          VERIFIER_ID: null,
          VERIFIER_NAME: null
        }));
        
        await loadExpenses();
        
        setTimeout(() => {
          setSuccessMessage('');
        }, 3000);
      }
    } catch (err) {
      setError('Failed to unverify expense: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const formatDateForDisplay = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString + 'T00:00:00Z');
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric',
      timeZone: 'UTC'
    });
  };

  const getCategoryName = (categoryId, type) => {
    if (!categoryId) return '-';
    
    const list = type === 'type' ? categories.types : 
                type === 'subtype' ? categories.subtypes : 
                categories.categories;
    
    const item = list.find(c => c.id === parseInt(categoryId));
    return item ? item.Name : categoryId;
  };

  const getStatus = (expense) => {
    return expense.APPROVED_FLAG === 1 ? 'Verified' : 'Pending';
  };

  const getStatusColor = (expense) => {
    return expense.APPROVED_FLAG === 1 ? '#28a745' : '#ffc107';
  };

  const handleBack = () => {
    setIsViewing(false);
    setSelectedExpenseId(null);
    setExpenseDetails(null);
    setError(null);
    setSuccessMessage('');
  };

  return (
    <div className={styles.expenseContainer}>
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

      {!isViewing ? (
        <div className={styles.expensesList}>
          <div className={styles.headerSection}>
            <div>
              <h2 className={styles.title}>Expense Verification</h2>
              <div style={{ display: 'flex', gap: '15px', alignItems: 'center', marginTop: '15px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <label style={{ fontWeight: '500', fontSize: '14px' }}>Employee:</label>
                  <select 
                    value={selectedEmployee}
                    onChange={(e) => setSelectedEmployee(e.target.value)}
                    style={{ 
                      padding: '8px 12px', 
                      borderRadius: '4px', 
                      border: '1px solid #ced4da',
                      fontSize: '14px',
                      minWidth: '200px'
                    }}
                  >
                    <option value="all">All Employees</option>
                    {employees.map((emp) => (
                      <option key={emp.empid} value={emp.empid}>
                        {emp.EMP_FST_NAME} {emp.EMP_LAST_NAME} ({emp.empid})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
            <button 
              className={`${styles.button} ${showPendingOnly ? styles.buttonSave : styles.buttonAdd}`}
              onClick={() => setShowPendingOnly(!showPendingOnly)}
            >
              {showPendingOnly ? 'Show All' : 'Pending Verification'}
            </button>
          </div>
          
          <div className={styles.tableWrapper}>
            <table>
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Start Date</th>
                  <th>End Date</th>
                  <th>Type</th>
                  <th>Subtype</th>
                  <th>Category</th>
                  <th>Total Amount</th>
                  <th>Submitted Date</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {expenses.length === 0 ? (
                  <tr>
                    <td colSpan="9" style={{ textAlign: 'center', padding: '20px' }}>
                      {showPendingOnly 
                        ? 'No pending expenses for verification.' 
                        : 'No expenses found.'}
                    </td>
                  </tr>
                ) : (
                  expenses.map((expense) => (
                    <tr 
                      key={expense.ID} 
                      onClick={() => handleRowClick(expense.ID)}
                      style={{ cursor: 'pointer' }}
                    >
                      <td>{expense.EMP_NAME}</td>
                      <td>{formatDateForDisplay(expense.START_DATE)}</td>
                      <td>{formatDateForDisplay(expense.END_DATE)}</td>
                      <td>{getCategoryName(expense.TYPE, 'type')}</td>
                      <td>{getCategoryName(expense.SUBTYPE, 'subtype')}</td>
                      <td>{getCategoryName(expense.CATEGORY, 'category')}</td>
                      <td>${parseFloat(expense.TOTAL || 0).toFixed(2)}</td>
                      <td>
                        {expense.SUBMITTED_DATE 
                          ? new Date(expense.SUBMITTED_DATE).toLocaleDateString()
                          : '-'}
                      </td>
                      <td>
                        <span style={{ 
                          padding: '4px 12px', 
                          borderRadius: '12px', 
                          backgroundColor: getStatusColor(expense) + '20',
                          color: getStatusColor(expense),
                          fontSize: '12px',
                          fontWeight: 'bold'
                        }}>
                          {getStatus(expense)}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className={styles.expenseDetails}>
          <div className={styles.headerSection}>
            <h2 className={styles.title}>Expense Details</h2>
            <div style={{ display: 'flex', gap: '10px' }}>
              {expenseDetails && expenseDetails.APPROVED_FLAG === 1 ? (
                <button 
                  className={`${styles.button} ${styles.buttonCancel}`} 
                  onClick={handleUnverify}
                  disabled={isSaving}
                >
                  {isSaving ? 'Processing...' : 'Change to Pending'}
                </button>
              ) : (
                <button 
                  className={`${styles.button} ${styles.buttonSave}`} 
                  onClick={handleVerify}
                  disabled={isSaving}
                >
                  {isSaving ? 'Verifying...' : 'Verify Expense'}
                </button>
              )}
              <button 
                className={`${styles.button} ${styles.buttonBack}`} 
                onClick={handleBack}
              >
                Back to List
              </button>
            </div>
          </div>
          
          {expenseDetails && (
            <div className={styles.formSection}>
              <h3>Expense Information</h3>
              
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>Employee</label>
                  <input 
                    type="text"
                    value={expenseDetails.EMP_NAME}
                    readOnly
                    disabled
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Status</label>
                  <input 
                    type="text"
                    value={getStatus(expenseDetails)}
                    readOnly
                    disabled
                    style={{ 
                      backgroundColor: getStatusColor(expenseDetails) + '20',
                      color: getStatusColor(expenseDetails),
                      fontWeight: 'bold'
                    }}
                  />
                </div>
              </div>
              
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>Start Date</label>
                  <input 
                    type="text"
                    value={formatDateForDisplay(expenseDetails.START_DATE)}
                    readOnly
                    disabled
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>End Date</label>
                  <input 
                    type="text"
                    value={formatDateForDisplay(expenseDetails.END_DATE)}
                    readOnly
                    disabled
                  />
                </div>
              </div>
              
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>Type</label>
                  <input 
                    type="text"
                    value={getCategoryName(expenseDetails.TYPE, 'type')}
                    readOnly
                    disabled
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Subtype</label>
                  <input 
                    type="text"
                    value={getCategoryName(expenseDetails.SUBTYPE, 'subtype')}
                    readOnly
                    disabled
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Category</label>
                  <input 
                    type="text"
                    value={getCategoryName(expenseDetails.CATEGORY, 'category')}
                    readOnly
                    disabled
                  />
                </div>
              </div>
              
              <div className={styles.formRow}>
                <div className={styles.formGroup} style={{ gridColumn: '1 / -1' }}>
                  <label>Description</label>
                  <textarea 
                    value={expenseDetails.DESCRIPTION || 'No description'}
                    readOnly
                    disabled
                    rows="3"
                  />
                </div>
              </div>
              
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>Amount</label>
                  <input 
                    type="text"
                    value={`$${parseFloat(expenseDetails.AMOUNT || 0).toFixed(2)}`}
                    readOnly
                    disabled
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Tax</label>
                  <input 
                    type="text"
                    value={`$${parseFloat(expenseDetails.TAX || 0).toFixed(2)}`}
                    readOnly
                    disabled
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Tip</label>
                  <input 
                    type="text"
                    value={`$${parseFloat(expenseDetails.TIP || 0).toFixed(2)}`}
                    readOnly
                    disabled
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Total</label>
                  <input 
                    type="text"
                    value={`$${parseFloat(expenseDetails.TOTAL || 0).toFixed(2)}`}
                    readOnly
                    disabled
                    style={{ backgroundColor: '#e9ecef', fontWeight: 'bold' }}
                  />
                </div>
              </div>
              
              {expenseDetails.ATTACHMENTS && expenseDetails.ATTACHMENTS.length > 0 && (
                <div className={styles.formGroup}>
                  <label>Attachments</label>
                  <ul style={{ marginTop: '5px' }}>
                    {expenseDetails.ATTACHMENTS.map((attachment) => (
                      <li key={attachment.ATTACHMENT_ID} style={{ padding: '5px 0' }}>
                        <a 
                          href={attachment.ATTACHMENT_URL} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          style={{ color: '#007bff', textDecoration: 'none' }}
                        >
                          View {attachment.ATTACHMENT_TYPE}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>Submitted Date</label>
                  <input 
                    type="text"
                    value={expenseDetails.SUBMITTED_DATE 
                      ? new Date(expenseDetails.SUBMITTED_DATE).toLocaleString()
                      : 'Not submitted'}
                    readOnly
                    disabled
                  />
                </div>
                {expenseDetails.APPROVED_FLAG === 1 && (
                  <div className={styles.formGroup}>
                    <label>Verified By</label>
                    <input 
                      type="text"
                      value={expenseDetails.VERIFIER_NAME || 'Unknown'}
                      readOnly
                      disabled
                    />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ExpenseVerification;
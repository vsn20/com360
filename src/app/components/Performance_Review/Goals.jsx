'use client';

import React, { useState, useEffect, useMemo } from 'react';
import './goals.css';
import { createGoal, updateGoal, deleteGoal, createBulkGoals } from '@/app/serverActions/Performance_Review/goals';

const DEFAULT_FORM_DATA = {
  id: null,
  employee_id: '',
  description: '',
  start_date: new Date().toLocaleDateString('en-CA'), 
  end_date: new Date(new Date().setMonth(new Date().getMonth() + 3)).toLocaleDateString('en-CA'),
  completion_percentage: 0,
  employee_comments: '',
  supervisor_comments: '',
};

const Goals = ({
  initialGoals,
  employees,
  permissionLevel,
  loggedInEmpId,
  orgid
}) => {
  // --- STATE ---
  const [goals, setGoals] = useState(initialGoals || []);
  useEffect(() => {
    setGoals(initialGoals || []);
  }, [initialGoals]);

  const [filterEmployeeId, setFilterEmployeeId] = useState('all');
  const currentYear = new Date().getFullYear();
  const [filterYear, setFilterYear] = useState(currentYear.toString());

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState(null); 
  const [formData, setFormData] = useState(DEFAULT_FORM_DATA);
  const [formError, setFormError] = useState(null);
  const [formSuccess, setFormSuccess] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Bulk goal modal state
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [bulkFormData, setBulkFormData] = useState({
    description: '',
    start_date: new Date().toLocaleDateString('en-CA'),
    end_date: new Date(new Date().setMonth(new Date().getMonth() + 3)).toLocaleDateString('en-CA'),
    completion_percentage: 0,
    employee_comments: '',
    supervisor_comments: '',
  });
  const [bulkFormError, setBulkFormError] = useState(null);
  const [bulkFormSuccess, setBulkFormSuccess] = useState(null);
  const [isBulkSubmitting, setIsBulkSubmitting] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);
  const [pageInputValue, setPageInputValue] = useState('1');
  const [goalsPerPage, setGoalsPerPage] = useState(10);
  const [goalsPerPageInput, setGoalsPerPageInput] = useState('10');

  // --- PERMISSIONS ---
  const canAdmin = useMemo(() => permissionLevel === 'all' || permissionLevel === 'team', [permissionLevel]);
  const canAddForOthers = useMemo(() => canAdmin, [canAdmin]);

  const canEditSupervisorComments = useMemo(() => {
    if (permissionLevel === 'all') return true;
    if (permissionLevel === 'team') {
      return String(formData.employee_id) !== String(loggedInEmpId);
    }
    return false;
  }, [permissionLevel, formData.employee_id, loggedInEmpId]);

  const canSeeSupervisorComments = useMemo(() => 
    permissionLevel === 'all' || permissionLevel === 'team' || permissionLevel === 'individual', 
  [permissionLevel]);

  const canEditGoal = (goal) => {
    if (!goal) return false;
    return canAdmin || goal.employee_id === loggedInEmpId;
  };

  // --- DERIVED DATA ---
  const sortedEmployeesForDropdown = useMemo(() => {
    if (!employees || employees.length === 0) return [];
    const loggedInUser = employees.find(emp => String(emp.empid) === String(loggedInEmpId));
    const otherEmployees = employees.filter(emp => String(emp.empid) !== String(loggedInEmpId))
                                  .sort((a, b) => a.name.localeCompare(b.name));
    if (loggedInUser) {
      const meEmployee = { ...loggedInUser, name: `${loggedInUser.name} (Me)` };
      return [meEmployee, ...otherEmployees];
    }
    return employees.sort((a, b) => a.name.localeCompare(b.name));
  }, [employees, loggedInEmpId]);

  const availableYears = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const specialYears = [
      (currentYear + 1).toString(),
      currentYear.toString(),
      (currentYear - 1).toString()
    ];
    
    const otherYears = new Set();
    goals.forEach(g => {
      const start = new Date(g.start_date).getFullYear();
      const end = new Date(g.end_date).getFullYear();
      for (let y = start; y <= end; y++) {
        otherYears.add(y.toString());
      }
    });

    specialYears.forEach(year => otherYears.delete(year));
    const sortedOtherYears = Array.from(otherYears).sort((a, b) => b - a);

    return [...specialYears, ...sortedOtherYears];
  }, [goals]);

  const filteredGoals = useMemo(() => {
    return goals.filter(goal => {
      const matchEmp = filterEmployeeId === 'all' || String(goal.employee_id) === filterEmployeeId;
      
      let matchYear = true;
      if (filterYear !== 'all') {
        const selectedYear = parseInt(filterYear, 10);
        const goalStartYear = new Date(goal.start_date).getFullYear();
        const goalEndYear = new Date(goal.end_date).getFullYear();
        matchYear = selectedYear >= goalStartYear && selectedYear <= goalEndYear;
      }

      return matchEmp && matchYear;
    });
  }, [goals, filterEmployeeId, filterYear]);

  // --- PAGINATION ---
  const totalPages = Math.ceil(filteredGoals.length / goalsPerPage);
  const indexOfLastGoal = currentPage * goalsPerPage;
  const indexOfFirstGoal = indexOfLastGoal - goalsPerPage;
  const currentGoals = filteredGoals.slice(indexOfFirstGoal, indexOfLastGoal);

  useEffect(() => {
    setCurrentPage(1);
    setPageInputValue('1');
  }, [filterEmployeeId, filterYear, goalsPerPage]);
  
  // --- HANDLERS ---
  const closeModal = () => {
    setIsModalOpen(false);
    setEditingGoal(null);
    setFormData(DEFAULT_FORM_DATA);
    setFormError(null);
    setFormSuccess(null);
    setIsSubmitting(false);
  };

  const handleAddClick = () => {
    let defaultEmployee = '';
    if (!canAddForOthers) {
      defaultEmployee = loggedInEmpId;
    }
    setFormData({ ...DEFAULT_FORM_DATA, employee_id: defaultEmployee });
    setEditingGoal(null);
    setIsModalOpen(true);
  };

  // Bulk goal handlers
  const closeBulkModal = () => {
    setIsBulkModalOpen(false);
    setBulkFormData({
      description: '',
      start_date: new Date().toLocaleDateString('en-CA'),
      end_date: new Date(new Date().setMonth(new Date().getMonth() + 3)).toLocaleDateString('en-CA'),
      completion_percentage: 0,
      employee_comments: '',
      supervisor_comments: '',
    });
    setBulkFormError(null);
    setBulkFormSuccess(null);
    setIsBulkSubmitting(false);
  };

  const handleAddBulkClick = () => {
    setBulkFormData({
      description: '',
      start_date: new Date().toLocaleDateString('en-CA'),
      end_date: new Date(new Date().setMonth(new Date().getMonth() + 3)).toLocaleDateString('en-CA'),
      completion_percentage: 0,
      employee_comments: '',
      supervisor_comments: '',
    });
    setIsBulkModalOpen(true);
  };

  const handleBulkFormChange = (e) => {
    const { name, value } = e.target;
    setBulkFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleBulkSubmit = async (e) => {
    e.preventDefault();
    
    // Validation: Check if Start Date > End Date
    if (new Date(bulkFormData.start_date) > new Date(bulkFormData.end_date)) {
      setBulkFormError("End Date cannot be earlier than Start Date.");
      return;
    }

    setIsBulkSubmitting(true);
    setBulkFormError(null);
    setBulkFormSuccess(null);

    // Get all employee IDs from the dropdown (visible employees)
    const employeeIds = sortedEmployeesForDropdown.map(emp => emp.empid);

    const formDataObject = new FormData();
    formDataObject.append('orgid', orgid);
    formDataObject.append('employee_ids', JSON.stringify(employeeIds));
    formDataObject.append('description', bulkFormData.description);
    formDataObject.append('start_date', bulkFormData.start_date);
    formDataObject.append('end_date', bulkFormData.end_date);
    formDataObject.append('completion_percentage', bulkFormData.completion_percentage);
    formDataObject.append('employee_comments', bulkFormData.employee_comments);
    formDataObject.append('supervisor_comments', bulkFormData.supervisor_comments);

    try {
      const result = await createBulkGoals(formDataObject);
      if (result.error) throw new Error(result.error);
      setBulkFormSuccess(`Goal added for ${employeeIds.length} employees successfully!`);
      setTimeout(closeBulkModal, 1500);
    } catch (err) {
      setBulkFormError(err.message);
    } finally {
      setIsBulkSubmitting(false);
    }
  };

  const handleEditClick = (goal) => {
    if (!canEditGoal(goal)) {
      setFormError("You do not have permission to edit this goal.");
      return;
    }
    setFormData({
      id: goal.id,
      employee_id: goal.employee_id,
      description: goal.description || '',
      start_date: new Date(goal.start_date).toLocaleDateString('en-CA'),
      end_date: new Date(goal.end_date).toLocaleDateString('en-CA'),
      completion_percentage: goal.completion_percentage || 0,
      employee_comments: goal.employee_comments || '',
      supervisor_comments: goal.supervisor_comments || '',
    });
    setEditingGoal(goal);
    setIsModalOpen(true);
  };

  const handleDeleteClick = async (e, goal) => {
    e.stopPropagation(); 
    if (!canEditGoal(goal)) {
      alert("You do not have permission to delete this goal.");
      return;
    }
    const userConfirmed = window.prompt("To delete this goal, type DELETE and click OK.", "");
    if (userConfirmed !== "DELETE") return;

    try {
      await deleteGoal(goal.id);
    } catch (err) {
      alert(`Error deleting goal: ${err.message}`);
    }
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validation: Check if Start Date > End Date
    if (new Date(formData.start_date) > new Date(formData.end_date)) {
      setFormError("End Date cannot be earlier than Start Date.");
      return;
    }

    setIsSubmitting(true);
    setFormError(null);
    setFormSuccess(null);

    const formDataObject = new FormData();
    formDataObject.append('orgid', orgid);
    for (const key in formData) {
      formDataObject.append(key, formData[key]);
    }
    if (!canEditSupervisorComments) {
      formDataObject.delete('supervisor_comments');
    }
    if (!canAddForOthers) {
      formDataObject.set('employee_id', loggedInEmpId);
    }

    try {
      if (editingGoal) {
        const result = await updateGoal(formDataObject);
        if (result.error) throw new Error(result.error);
        setFormSuccess('Goal updated successfully!');
      } else {
        const result = await createGoal(formDataObject);
        if (result.error) throw new Error(result.error);
        setFormSuccess('Goal created successfully!');
      }
      setTimeout(closeModal, 1000);
    } catch (err) {
      setFormError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- Pagination Handlers ---
  useEffect(() => {
    setPageInputValue(currentPage.toString());
  }, [currentPage]);

  useEffect(() => {
    setGoalsPerPageInput(goalsPerPage.toString());
  }, [goalsPerPage]);

  const handleNextPage = () => {
    if (currentPage < totalPages) setCurrentPage(prev => prev + 1);
  };

  const handlePrevPage = () => {
    if (currentPage > 1) setCurrentPage(prev => prev - 1);
  };

  const handlePageInputChange = (e) => setPageInputValue(e.target.value);

  const handlePageInputKeyPress = (e) => {
    if (e.key === 'Enter') {
      const value = parseInt(pageInputValue, 10);
      if (!isNaN(value) && value >= 1 && value <= totalPages) {
        setCurrentPage(value);
      } else {
        setPageInputValue(currentPage.toString()); 
      }
    }
  };

  const handleGoalsPerPageInputChange = (e) => setGoalsPerPageInput(e.target.value);

  const handleGoalsPerPageInputKeyPress = (e) => {
    if (e.key === 'Enter') {
      const value = parseInt(e.target.value, 10);
      if (!isNaN(value) && value >= 1) {
        setGoalsPerPage(value);
      } else {
        setGoalsPerPageInput(goalsPerPage.toString()); 
      }
    }
  };
  
  return (
    <div className="employee_goals_container">
      <div className="employee_goals_header-section">
        <h2 className="employee_goals_title">Employee Goals</h2>
        <div style={{ display: 'flex', gap: '10px' }}>
          {canAdmin && (
            <button className="employee_goals_save employee_goals_button" onClick={handleAddBulkClick}>
              Add All Employee Goals
            </button>
          )}
          <button className="employee_goals_save employee_goals_button" onClick={handleAddClick}>
            Add Goal
          </button>
        </div>
      </div>

      <div className="employee_goals_search-filter-container">
        {canAdmin && (
          <select
            className="employee_goals_filter-select"
            value={filterEmployeeId}
            onChange={(e) => setFilterEmployeeId(e.target.value)}
          >
            <option value="all">All Visible Employees</option>
            {sortedEmployeesForDropdown.map(emp => (
              <option key={emp.empid} value={emp.empid}>{emp.name}</option>
            ))}
          </select>
        )}

        <select
          className="employee_goals_filter-select"
          value={filterYear}
          onChange={(e) => setFilterYear(e.target.value)}
        >
          <option value="all">All Years</option>
          {availableYears.map(year => (
            <option key={year} value={year}>{year}</option>
          ))}
        </select>
      </div>

      <div className="employee_goals_table-wrapper">
        <table className="employee_goals_table">
          <thead>
            <tr>
              {canAdmin && <th>Employee Name</th>}
              <th>Description</th>
              <th>Start Date</th>
              <th>End Date</th>
              <th>Completion %</th>
              <th>Employee Comments</th>
              <th>Supervisor Comments</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
  {currentGoals.length > 0 ? (
    currentGoals.map(goal => (
      <tr key={goal.id} onClick={() => handleEditClick(goal)}>
        {canAdmin && (
          <td>
            <span className="employee_goals_status-indicator"></span>
            {goal.employee_name}
          </td>
        )}
        <td>{goal.description}</td>
        <td>{goal.start_date}</td>
        <td>{goal.end_date}</td>
        <td>{goal.completion_percentage}%</td>
        <td style={{ whiteSpace: 'pre-wrap' }}>{goal.employee_comments || '-'}</td>
        <td style={{ whiteSpace: 'pre-wrap' }}>{goal.supervisor_comments || '-'}</td>
        <td>
          {canEditGoal(goal) && (
            <button
              className="employee_goals_cancel employee_goals_button"
              onClick={(e) => handleDeleteClick(e, goal)}
            >
              Delete
            </button>
          )}
        </td>
      </tr>
    ))
  ) : (
    <tr>
      <td colSpan={canAdmin ? 8 : 7} className="employee_goals_empty-state">
        No goals found for the selected filters.
      </td>
    </tr>
  )}
</tbody>
        </table>
      </div>

      {filteredGoals.length > goalsPerPage && (
        <div className="employee_goals_pagination-container">
          <button
            className="employee_goals_button employee_goals_cancel"
            onClick={handlePrevPage}
            disabled={currentPage === 1}
            style={{ minWidth: '100px' }}
          >
            ← Previous
          </button>
          <span className="employee_goals_pagination-text">
            Page{' '}
            <input
              type="text"
              value={pageInputValue}
              onChange={handlePageInputChange}
              onKeyPress={handlePageInputKeyPress}
              className="employee_goals_pagination-input"
            />{' '}
            of {totalPages}
          </span>
          <button
            className="employee_goals_button employee_goals_save"
            onClick={handleNextPage}
            disabled={currentPage === totalPages}
            style={{ minWidth: '100px' }}
          >
            Next →
          </button>
        </div>
      )}
      
      <div className="employee_goals_rows-per-page-container">
        <label className="employee_goals_rows-per-page-label">Rows per Page:</label>
        <input
          type="text"
          value={goalsPerPageInput}
          onChange={handleGoalsPerPageInputChange}
          onKeyPress={handleGoalsPerPageInputKeyPress}
          placeholder="Goals per page"
          className="employee_goals_rows-per-page-input"
          aria-label="Number of rows per page"
        />
      </div>

      {/* --- ADD/EDIT MODAL --- */}
      {isModalOpen && (
        <div className="employee_goals_modal-overlay" onClick={closeModal}>
          <div className="employee_goals_modal-content" onClick={(e) => e.stopPropagation()}>
            
            <div className="employee_goals_modal-header">
              <h3 className="employee_goals_modal-title">
                {editingGoal ? 'Edit Goal' : 'Add New Goal'}
              </h3>
              <button className="employee_goals_modal-close-button" onClick={closeModal}>
                &times;
              </button>
            </div>

            <form className="employee_goals_form" onSubmit={handleSubmit}>
              {formError && <div className="employee_goals_error-message">{formError}</div>}
              {formSuccess && <div className="employee_goals_success-message">{formSuccess}</div>}

              <div className="employee_goals_form-group">
                <label htmlFor="employee_id">Employee Name</label>
                <select
                  id="employee_id"
                  name="employee_id"
                  value={formData.employee_id}
                  onChange={handleFormChange}
                  disabled={!canAddForOthers || !!editingGoal} 
                  required
                >
                  <option value="" disabled>Select an employee</option>
                  {canAddForOthers ? (
                    sortedEmployeesForDropdown.map(emp => (
                      <option key={emp.empid} value={emp.empid}>{emp.name}</option>
                    ))
                  ) : (
                    <option value={loggedInEmpId}>
                      {employees.find(e => e.empid === loggedInEmpId)?.name || 'Me'}
                    </option>
                  )}
                </select>
              </div>

              <div className="employee_goals_form-group">
                <label htmlFor="description">Goal Description</label>
                <textarea
                  id="description"
                  name="description"
                  value={formData.description}
                  onChange={handleFormChange}
                  rows="3"
                  required
                />
              </div>

              <div className="employee_goals_form-row">
                <div className="employee_goals_form-group">
                  <label htmlFor="start_date">Start Date</label>
                  <input
                    type="date"
                    id="start_date"
                    name="start_date"
                    value={formData.start_date}
                    onChange={handleFormChange}
                    required
                  />
                </div>
                <div className="employee_goals_form-group">
                  <label htmlFor="end_date">End Date</label>
                  <input
                    type="date"
                    id="end_date"
                    name="end_date"
                    value={formData.end_date}
                    onChange={handleFormChange}
                    required
                  />
                </div>
              </div>
              <div className="employee_goals_form-group">
                <label htmlFor="completion_percentage">Completion Percentage</label>
                <input
                  type="number"
                  id="completion_percentage"
                  name="completion_percentage"
                  value={formData.completion_percentage}
                  onChange={handleFormChange}
                  min="0"
                  max="100"
                />
              </div>

              <div className="employee_goals_form-group">
                <label htmlFor="employee_comments">Employee Comments</label>
                <textarea
                  id="employee_comments"
                  name="employee_comments"
                  value={formData.employee_comments}
                  onChange={handleFormChange}
                  rows="3"
                />
              </div>

              {canSeeSupervisorComments && ( 
                <div className="employee_goals_form-group">
                  <label htmlFor="supervisor_comments">Supervisor Comments</label>
                  <textarea
                    id="supervisor_comments"
                    name="supervisor_comments"
                    value={formData.supervisor_comments}
                    onChange={handleFormChange}
                    rows="3"
                    disabled={!canEditSupervisorComments} 
                  />
                </div>
              )}

              <div className="employee_goals_form-buttons">
                <button
                  type="button"
                  className="employee_goals_cancel employee_goals_button"
                  onClick={closeModal}
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="employee_goals_save employee_goals_button"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Saving...' : (editingGoal ? 'Update Goal' : 'Save Goal')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- BULK ADD MODAL --- */}
      {isBulkModalOpen && (
        <div className="employee_goals_modal-overlay" onClick={closeBulkModal}>
          <div className="employee_goals_modal-content" onClick={(e) => e.stopPropagation()}>
            
            <div className="employee_goals_modal-header">
              <h3 className="employee_goals_modal-title">
                Add Goal for All Employees
              </h3>
              <button className="employee_goals_modal-close-button" onClick={closeBulkModal}>
                &times;
              </button>
            </div>

            <div style={{ padding: '0 20px', marginBottom: '15px', color: '#666', fontSize: '14px' }}>
              This goal will be added for <strong>{sortedEmployeesForDropdown.length}</strong> employees.
            </div>

            <form className="employee_goals_form" onSubmit={handleBulkSubmit}>
              {bulkFormError && <div className="employee_goals_error-message">{bulkFormError}</div>}
              {bulkFormSuccess && <div className="employee_goals_success-message">{bulkFormSuccess}</div>}

              <div className="employee_goals_form-group">
                <label htmlFor="bulk_description">Goal Description</label>
                <textarea
                  id="bulk_description"
                  name="description"
                  value={bulkFormData.description}
                  onChange={handleBulkFormChange}
                  rows="3"
                  required
                />
              </div>

              <div className="employee_goals_form-row">
                <div className="employee_goals_form-group">
                  <label htmlFor="bulk_start_date">Start Date</label>
                  <input
                    type="date"
                    id="bulk_start_date"
                    name="start_date"
                    value={bulkFormData.start_date}
                    onChange={handleBulkFormChange}
                    required
                  />
                </div>
                <div className="employee_goals_form-group">
                  <label htmlFor="bulk_end_date">End Date</label>
                  <input
                    type="date"
                    id="bulk_end_date"
                    name="end_date"
                    value={bulkFormData.end_date}
                    onChange={handleBulkFormChange}
                    required
                  />
                </div>
              </div>

              <div className="employee_goals_form-group">
                <label htmlFor="bulk_completion_percentage">Completion Percentage</label>
                <input
                  type="number"
                  id="bulk_completion_percentage"
                  name="completion_percentage"
                  value={bulkFormData.completion_percentage}
                  onChange={handleBulkFormChange}
                  min="0"
                  max="100"
                />
              </div>

              <div className="employee_goals_form-group">
                <label htmlFor="bulk_employee_comments">Employee Comments</label>
                <textarea
                  id="bulk_employee_comments"
                  name="employee_comments"
                  value={bulkFormData.employee_comments}
                  onChange={handleBulkFormChange}
                  rows="3"
                />
              </div>

              <div className="employee_goals_form-group">
                <label htmlFor="bulk_supervisor_comments">Supervisor Comments</label>
                <textarea
                  id="bulk_supervisor_comments"
                  name="supervisor_comments"
                  value={bulkFormData.supervisor_comments}
                  onChange={handleBulkFormChange}
                  rows="3"
                />
              </div>

              <div className="employee_goals_form-buttons">
                <button
                  type="button"
                  className="employee_goals_cancel employee_goals_button"
                  onClick={closeBulkModal}
                  disabled={isBulkSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="employee_goals_save employee_goals_button"
                  disabled={isBulkSubmitting}
                >
                  {isBulkSubmitting ? 'Adding Goals...' : `Add Goal for ${sortedEmployeesForDropdown.length} Employees`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Goals;
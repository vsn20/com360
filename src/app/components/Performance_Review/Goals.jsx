'use client';

import React, { useState, useEffect, useMemo } from 'react';
import './goals.css';
import { createGoal, updateGoal, deleteGoal } from '@/app/serverActions/Performance_Review/goals';

// Define the default empty state for a new goal form
const DEFAULT_FORM_DATA = {
  id: null,
  employee_id: '',
  description: '',
  start_date: new Date().toLocaleDateString('en-CA'), // YYYY-MM-DD
  end_date: new Date(new Date().setMonth(new Date().getMonth() + 3)).toLocaleDateString('en-CA'), // Default +3 months
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

  // 1. Data State:
  const [goals, setGoals] = useState(initialGoals || []);
  useEffect(() => {
    setGoals(initialGoals || []);
  }, [initialGoals]);

  // 2. Filter State:
  const [filterEmployeeId, setFilterEmployeeId] = useState('all');
  const currentYear = new Date().getFullYear();
  const [filterYear, setFilterYear] = useState(currentYear.toString());

  // 3. Modal & Form State:
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState(null); // null = Add mode, object = Edit mode
  const [formData, setFormData] = useState(DEFAULT_FORM_DATA);
  const [formError, setFormError] = useState(null);
  const [formSuccess, setFormSuccess] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 4. Pagination State (NEW)
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

  // --- DERIVED DATA (for filters) ---

  const sortedEmployeesForDropdown = useMemo(() => {
    if (!employees || employees.length === 0) return [];
    const loggedInUser = employees.find(emp => String(emp.empid) === String(loggedInEmpId));
    const otherEmployees = employees.filter(emp => String(emp.empid) !== String(loggedInEmpId))
                                  .sort((a, b) => a.name.localeCompare(b.name)); // Sort others alphabetically
    if (loggedInUser) {
      const meEmployee = { ...loggedInUser, name: `${loggedInUser.name} (Me)` };
      return [meEmployee, ...otherEmployees];
    }
    return employees.sort((a, b) => a.name.localeCompare(b.name));
  }, [employees, loggedInEmpId]);

  // --- MODIFIED: Year Filter Logic ---
  const availableYears = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const specialYears = [
      (currentYear + 1).toString(),
      currentYear.toString(),
      (currentYear - 1).toString()
    ];
    
    // Get all other distinct years from goals, excluding the special years
    const otherYears = new Set(goals.map(g => new Date(g.end_date).getFullYear().toString()));
    specialYears.forEach(year => otherYears.delete(year));

    // Sort the remaining years descending
    const sortedOtherYears = Array.from(otherYears).sort((a, b) => b - a);

    return [...specialYears, ...sortedOtherYears];
  }, [goals]);

  // Filter the goals based on the selected employee and year
  const filteredGoals = useMemo(() => {
    return goals.filter(goal => {
      const matchEmp = filterEmployeeId === 'all' || String(goal.employee_id) === filterEmployeeId;
      const matchYear = filterYear === 'all' || new Date(goal.end_date).getFullYear().toString() === filterYear;
      return matchEmp && matchYear;
    });
  }, [goals, filterEmployeeId, filterYear]);

  // --- NEW: Pagination Logic ---
  const totalPages = Math.ceil(filteredGoals.length / goalsPerPage);
  const indexOfLastGoal = currentPage * goalsPerPage;
  const indexOfFirstGoal = indexOfLastGoal - goalsPerPage;
  const currentGoals = filteredGoals.slice(indexOfFirstGoal, indexOfLastGoal);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
    setPageInputValue('1');
  }, [filterEmployeeId, filterYear, goalsPerPage]);
  
  // --- EVENT HANDLERS ---

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

  // --- NEW: Pagination Handlers ---
  
  useEffect(() => {
    setPageInputValue(currentPage.toString());
  }, [currentPage]);

  useEffect(() => {
    setGoalsPerPageInput(goalsPerPage.toString());
  }, [goalsPerPage]);

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(prev => prev + 1);
    }
  };

  const handlePrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(prev => prev - 1);
    }
  };

  const handlePageInputChange = (e) => {
    setPageInputValue(e.target.value);
  };

  const handlePageInputKeyPress = (e) => {
    if (e.key === 'Enter') {
      const value = parseInt(pageInputValue, 10);
      if (!isNaN(value) && value >= 1 && value <= totalPages) {
        setCurrentPage(value);
      } else {
        setPageInputValue(currentPage.toString()); // Reset to current page
      }
    }
  };

  const handleGoalsPerPageInputChange = (e) => {
    setGoalsPerPageInput(e.target.value);
  };

  const handleGoalsPerPageInputKeyPress = (e) => {
    if (e.key === 'Enter') {
      const value = parseInt(e.target.value, 10);
      if (!isNaN(value) && value >= 1) {
        setGoalsPerPage(value);
      } else {
        setGoalsPerPageInput(goalsPerPage.toString()); // Reset to current value
      }
    }
  };
  
  return (
    <div className="Employee_Goals_container">
      {/* --- HEADER: Title and Add Button --- */}
      <div className="Employee_Goals_header-section">
        <h2 className="Employee_Goals_title">Employee Goals</h2>
        <button className="Employee_Goals_save Employee_Goals_button" onClick={handleAddClick}>
          Add Goal
        </button>
      </div>

      {/* --- FILTERS: Employee and Year --- */}
      <div className="Employee_Goals_search-filter-container">
        {canAdmin && (
          <select
            className="Employee_Goals_filter-select"
            value={filterEmployeeId}
            onChange={(e) => setFilterEmployeeId(e.target.value)}
          >
            <option value="all">All Visible Employees</option>
            {sortedEmployeesForDropdown.map(emp => (
              <option key={emp.empid} value={emp.empid}>{emp.name}</option>
            ))}
          </select>
        )}

        {/* --- MODIFIED: Year Filter --- */}
        <select
          className="Employee_Goals_filter-select"
          value={filterYear}
          onChange={(e) => setFilterYear(e.target.value)}
        >
          <option value="all">All Years</option>
          {availableYears.map(year => (
            <option key={year} value={year}>{year}</option>
          ))}
        </select>
      </div>

      {/* --- GOALS TABLE --- */}
      <div className="Employee_Goals_table-wrapper">
        <table className="Employee_Goals_table">
          <thead>
            <tr>
              {canAdmin && <th>Employee</th>}
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
            {/* --- MODIFIED: Use currentGoals for pagination --- */}
            {currentGoals.length > 0 ? (
              currentGoals.map(goal => (
                <tr key={goal.id} onClick={() => handleEditClick(goal)}>
                  {canAdmin && <td>{goal.employee_name}</td>}
                  <td>{goal.description}</td>
                  <td>{new Date(goal.start_date).toLocaleDateString('en-CA')}</td>
                  <td>{new Date(goal.end_date).toLocaleDateString('en-CA')}</td>
                  <td>{goal.completion_percentage}%</td>
                  <td style={{ whiteSpace: 'pre-wrap' }}>{goal.employee_comments || '-'}</td>
                  <td style={{ whiteSpace: 'pre-wrap' }}>{goal.supervisor_comments || '-'}</td>
                  <td>
                    {canEditGoal(goal) && (
                      <button
                        className="Employee_Goals_cancel Employee_Goals_button"
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
                <td colSpan={canAdmin ? 8 : 7} className="Employee_Goals_empty-state">
                  No goals found for the selected filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* --- NEW: Pagination Controls --- */}
      {filteredGoals.length > goalsPerPage && (
        <div className="Employee_Goals_pagination-container">
          <button
            className="Employee_Goals_button Employee_Goals_cancel"
            onClick={handlePrevPage}
            disabled={currentPage === 1}
            style={{ minWidth: '100px' }}
          >
            ← Previous
          </button>
          <span className="Employee_Goals_pagination-text">
            Page{' '}
            <input
              type="text"
              value={pageInputValue}
              onChange={handlePageInputChange}
              onKeyPress={handlePageInputKeyPress}
              className="Employee_Goals_pagination-input"
            />{' '}
            of {totalPages}
          </span>
          <button
            className="Employee_Goals_button Employee_Goals_save"
            onClick={handleNextPage}
            disabled={currentPage === totalPages}
            style={{ minWidth: '100px' }}
          >
            Next →
          </button>
        </div>
      )}
      
      {/* --- NEW: Rows Per Page --- */}
      <div className="Employee_Goals_rows-per-page-container">
        <label className="Employee_Goals_rows-per-page-label">Rows per Page:</label>
        <input
          type="text"
          value={goalsPerPageInput}
          onChange={handleGoalsPerPageInputChange}
          onKeyPress={handleGoalsPerPageInputKeyPress}
          placeholder="Goals per page"
          className="Employee_Goals_rows-per-page-input"
          aria-label="Number of rows per page"
        />
      </div>

      {/* --- ADD/EDIT MODAL --- */}
      {isModalOpen && (
        <div className="Employee_Goals_modal-overlay" onClick={closeModal}>
          <div className="Employee_Goals_modal-content" onClick={(e) => e.stopPropagation()}>
            
            <div className="Employee_Goals_modal-header">
              <h3 className="Employee_Goals_modal-title">
                {editingGoal ? 'Edit Goal' : 'Add New Goal'}
              </h3>
              <button className="Employee_Goals_modal-close-button" onClick={closeModal}>
                &times;
              </button>
            </div>

            <form className="Employee_Goals_form" onSubmit={handleSubmit}>
              {formError && <div className="Employee_Goals_error-message">{formError}</div>}
              {formSuccess && <div className="Employee_Goals_success-message">{formSuccess}</div>}

              {/* --- Employee Selection --- */}
              <div className="Employee_Goals_form-group">
                <label htmlFor="employee_id">Employee</label>
                <select
                  id="employee_id"
                  name="employee_id"
                  value={formData.employee_id}
                  onChange={handleFormChange}
                  disabled={!canAddForOthers || !!editingGoal} // Disable if not admin OR if editing
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

              {/* --- Description --- */}
              <div className="Employee_Goals_form-group">
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

              {/* --- Dates & Completion --- */}
              <div className="Employee_Goals_form-row">
                <div className="Employee_Goals_form-group">
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
                <div className="Employee_Goals_form-group">
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
              <div className="Employee_Goals_form-group">
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

              {/* --- Comments --- */}
              <div className="Employee_Goals_form-group">
                <label htmlFor="employee_comments">Employee Comments</label>
                <textarea
                  id="employee_comments"
                  name="employee_comments"
                  value={formData.employee_comments}
                  onChange={handleFormChange}
                  rows="3"
                />
              </div>

              {/* --- MODIFIED: Supervisor Comments (Conditional) --- */}
              {canSeeSupervisorComments && ( // Show if 'individual', 'team', or 'all'
                <div className="Employee_Goals_form-group">
                  <label htmlFor="supervisor_comments">Supervisor Comments</label>
                  <textarea
                    id="supervisor_comments"
                    name="supervisor_comments"
                    value={formData.supervisor_comments}
                    onChange={handleFormChange}
                    rows="3"
                    // Only admins ('all', 'team') can edit. 'individual' will be disabled.
                    disabled={!canEditSupervisorComments} 
                  />
                </div>
              )}

              {/* --- Form Actions --- */}
              <div className="Employee_Goals_form-buttons">
                <button
                  type="button"
                  className="Employee_Goals_cancel Employee_Goals_button"
                  onClick={closeModal}
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="Employee_Goals_save Employee_Goals_button"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Saving...' : (editingGoal ? 'Update Goal' : 'Save Goal')}
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
'use client';
import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { fetchEmployeeLeaves, fetchEmployeesUnderSuperior, fetchLeaveAssignments } from '@/app/serverActions/Leaves/Overview';
import { approveEmployeeLeave } from '@/app/serverActions/Leaves/Addleave';
import './overview.css';
import PendingLeaveApprovals from './pendingleaves';
import Addleaves from './Addleaves';

export default function Overview() {
  const [leaves, setLeaves] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [availableLeaves, setAvailableLeaves] = useState({});
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState(false);
  const [isSuperior, setIsSuperior] = useState(false);
  const router = useRouter();
  const [ispending, setispending] = useState(false);
  const [isadding, setisadding] = useState(false);
  const searchParams = useSearchParams();

  // --- Pagination State ---
  const [currentPage, setCurrentPage] = useState(1);
  const [pageInputValue, setPageInputValue] = useState('1');
  const itemsPerPage = 10;

  const resetToInitialState = async () => {
    console.log('Resetting to initial state');
    router.refresh();
    setLeaves([]);
    setEmployees([]);
    setSelectedEmployee('');
    setAvailableLeaves({});
    setError(null);
    setLoading(true);
    setSuccess(false);
    setIsSuperior(false);
    setispending(false);
    setisadding(false);
    const employeesResult = await fetchEmployeesUnderSuperior();
    if (employeesResult.error) {
      setError(employeesResult.error);
    } else {
      const currentEmpId = employeesResult.employees[0]?.empid;
      setSelectedEmployee(currentEmpId || '');
      const sortedEmployees = [
        ...employeesResult.employees.filter(emp => emp.empid === currentEmpId),
        ...employeesResult.employees.filter(emp => emp.empid !== currentEmpId).sort((a, b) =>
          `${a.EMP_FST_NAME} ${a.EMP_LAST_NAME || ''}`.localeCompare(`${b.EMP_FST_NAME} ${b.EMP_LAST_NAME || ''}`)
        ),
      ];
      setEmployees(sortedEmployees);
      setIsSuperior(sortedEmployees.length > 1 || sortedEmployees.some(emp => emp.empid !== currentEmpId));
      if (currentEmpId) {
        const [leavesResult, availableLeavesResult] = await Promise.all([
          fetchEmployeeLeaves(currentEmpId),
          fetchLeaveAssignments(currentEmpId),
        ]);
        if (leavesResult.error) {
          setError(leavesResult.error);
        } else {
          setLeaves(leavesResult);
        }
        if (availableLeavesResult.error) {
          setError(availableLeavesResult.error);
        } else {
          setAvailableLeaves(availableLeavesResult);
        }
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    const fetchData = async () => {
      setError(null);
      setSuccess(false);
      setLoading(true);

      const employeesResult = await fetchEmployeesUnderSuperior();
      if (employeesResult.error) {
        setError(employeesResult.error);
        setEmployees([]);
        setIsSuperior(false);
      } else {
        const currentEmpId = employeesResult.employees[0]?.empid;
        setSelectedEmployee(currentEmpId || '');
        const sortedEmployees = [
          ...employeesResult.employees.filter(emp => emp.empid === currentEmpId),
          ...employeesResult.employees.filter(emp => emp.empid !== currentEmpId).sort((a, b) =>
            `${a.EMP_FST_NAME} ${a.EMP_LAST_NAME || ''}`.localeCompare(`${b.EMP_FST_NAME} ${b.EMP_LAST_NAME || ''}`)
          ),
        ];
        setEmployees(sortedEmployees);
        setIsSuperior(sortedEmployees.length > 1 || sortedEmployees.some(emp => emp.empid !== currentEmpId));
        if (currentEmpId) {
          const [leavesResult, availableLeavesResult] = await Promise.all([
            fetchEmployeeLeaves(currentEmpId),
            fetchLeaveAssignments(currentEmpId),
          ]);
          if (leavesResult.error) {
            setError(leavesResult.error);
          } else {
            setLeaves(leavesResult);
          }
          if (availableLeavesResult.error) {
            setError(availableLeavesResult.error);
          } else {
            setAvailableLeaves(availableLeavesResult);
          }
        }
      }

      setLoading(false);
    };
    fetchData();
  }, []);

  useEffect(() => {
    if (searchParams.get('refresh')) {
      resetToInitialState();
    }
  }, [searchParams.get('refresh')]);

  const handleEmployeeChange = async (e) => {
    const empId = e.target.value;
    setSelectedEmployee(empId);
    setCurrentPage(1);
    setPageInputValue('1');
    if (empId) {
      const [leavesResult, availableLeavesResult] = await Promise.all([
        fetchEmployeeLeaves(empId),
        fetchLeaveAssignments(empId),
      ]);
      if (leavesResult.error) {
        setError(leavesResult.error);
      } else {
        setLeaves(leavesResult);
      }
      if (availableLeavesResult.error) {
        setError(availableLeavesResult.error);
      } else {
        setAvailableLeaves(availableLeavesResult);
      }
    } else {
      setLeaves([]);
      setAvailableLeaves({});
    }
  };

  const handleAddLeave = () => {
    if (!selectedEmployee) {
      setError('Please select an employee.');
      return;
    }
    router.refresh();
    setisadding(true);
    setispending(false);
  };

  const handleApproveChange = async (leaveId, empId, action) => {
    console.log('Approving leaveId:', leaveId, 'for empId:', empId, 'with action:', action);
    setError(null);
    setSuccess(false);
    const result = await approveEmployeeLeave(leaveId, action);
    if (result.error) {
      setError(result.error);
    } else {
      if (selectedEmployee) {
        const [leavesResult, availableLeavesResult] = await Promise.all([
          fetchEmployeeLeaves(selectedEmployee),
          fetchLeaveAssignments(selectedEmployee),
        ]);
        if (leavesResult.error) {
          setError(leavesResult.error);
        } else {
          setLeaves(leavesResult);
        }
        if (availableLeavesResult.error) {
          setError(availableLeavesResult.error);
        } else {
          setAvailableLeaves(availableLeavesResult);
        }
      }
      setSuccess(true);
    }
  };

  const formatDate = (date) => {
    if (!date || isNaN(new Date(date))) return '';
    const d = new Date(date);
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${month}/${day}/${d.getFullYear()}`;
  };

  const handlepending = () => {
    router.refresh();
    setisadding(false);
    setispending(true);
  };

  // --- Pagination Logic ---
  const totalPages = Math.ceil(leaves.length / itemsPerPage);
  const indexOfLastLeave = currentPage * itemsPerPage;
  const indexOfFirstLeave = indexOfLastLeave - itemsPerPage;
  const currentLeaves = leaves.slice(indexOfFirstLeave, indexOfLastLeave);

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      const newPage = currentPage + 1;
      setCurrentPage(newPage);
      setPageInputValue(newPage.toString());
    }
  };

  const handlePrevPage = () => {
    if (currentPage > 1) {
      const newPage = currentPage - 1;
      setCurrentPage(newPage);
      setPageInputValue(newPage.toString());
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
        setPageInputValue(currentPage.toString());
      }
    }
  };

  return (
    <div className="leaves_overview_main_container">
      <div className="leaves_container">
        {ispending || isadding ? (
          <div className="leaves_sub_page_container">
            <div className="leaves_sub_page_content">
              {ispending && <PendingLeaveApprovals onBack={resetToInitialState} />}
              {isadding && <Addleaves onBack={resetToInitialState}/>}
            </div>
          </div>
        ) : (
          <>
            <div className="leaves_header">
              <h2 className="leaves_title">Employee Leaves Management</h2>
              <div className="leaves_employee_section">
                <div className="leaves_employee_selector">
                  <select 
                    value={selectedEmployee} 
                    onChange={handleEmployeeChange} 
                    className="leaves_dropdown leaves_employee_dropdown"
                  >
                    <option value="" className="leaves_dropdown_placeholder">Select an Employee</option>
                    {employees.map((emp) => (
                      <option key={emp.empid} value={emp.empid} className="leaves_dropdown_option">
                        {`${emp.EMP_FST_NAME} ${emp.EMP_LAST_NAME || ''}`}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="leaves_controls">
                  <button 
                    onClick={handleAddLeave} 
                    disabled={!selectedEmployee || selectedEmployee !== employees[0]?.empid} 
                    className="leaves_button primary leaves_add_button"
                  >
                    <span className="leaves_button_text">Add Leave</span>
                  </button>
                  {isSuperior && (
                    <button className="leaves_button secondary leaves_pending_button" onClick={handlepending}>
                      <span className="leaves_button_text">Pending Requests</span>
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Available Leaves Section */}
            {selectedEmployee && (
              <div className="leaves_available_section">
                <h3 className="leaves_available_title">Available Leave Balance:</h3>
                <div className="leaves_available_list">
                  {Object.keys(availableLeaves).length > 0 ? (
                    Object.entries(availableLeaves).map(([leaveId, leave]) => (
                      <div key={leaveId} className="leaves_available_item">
                        <span className="leaves_available_name">{leave.name}</span>
                        <span className="leaves_available_count">{leave.noofleaves}</span>
                      </div>
                    ))
                  ) : (
                    <div className="leaves_available_empty">
                      No available leaves for the selected employee.
                    </div>
                  )}
                </div>
              </div>
            )}

            {loading && (
              <div className="leaves_loading_state">
                <div className="leaves_loading_spinner">Loading leaves...</div>
              </div>
            )}
            
            {success && (
              <div className="leaves_success_message">
                <span className="leaves_message_icon">✓</span>
                Action completed successfully!
              </div>
            )}
            
            {error && (
              <div className="leaves_error_message">
                <span className="leaves_message_icon">⚠</span>
                {error}
              </div>
            )}

            {!loading && !error && (
              <div className="leaves_content_wrapper">
                <div className="leaves_main_content">
                  {leaves.length > 0 ? (
                    <>
                      <h3 className="leaves_table_title">Leave History</h3>
                      <div className="leaves_table_wrapper">
                        <table className="leaves_table">
                          <thead>
                            <tr className="leaves_table_header">
                              <th className="leaves_th_leave_name">Leave Name</th>
                              <th className="leaves_th_start_date">Start Date</th>
                              <th className="leaves_th_end_date">End Date</th>
                              <th className="leaves_th_status">Status</th>
                              <th className="leaves_th_duration">No. of Noons</th>
                              <th className="leaves_th_period">AM/PM</th>
                              <th className="leaves_th_reason">Reason</th>
                              <th className="leaves_th_action">Action</th>
                            </tr>
                          </thead>
                          <tbody className="leaves_table_body">
                            {currentLeaves.map((leave) => (
                              <tr key={leave.id} className="leaves_table_row">
                                <td className="leaves_td_leave_name">{leave.leave_name || 'Unknown'}</td>
                                <td className="leaves_td_start_date">{formatDate(leave.startdate)}</td>
                                <td className="leaves_td_end_date">{formatDate(leave.enddate)}</td>
                                <td className="leaves_td_status">
                                  <span className={`leaves_status_badge ${
                                      leave.status === 'accepted' ? 'leaves_status_approved'
                                      : leave.status === 'pending' ? 'leaves_status_pending'
                                      : 'leaves_status_rejected'
                                    }`}
                                  >
                                    {leave.status}
                                  </span>
                                </td>
                                <td className="leaves_td_duration">{leave.noofnoons}</td>
                                <td className="leaves_td_period">{leave.am_pm}</td>
                                <td className="leaves_td_reason">{leave.description || '--'}</td>
                                {leave.status !== 'pending' && (
                                  <td className="leaves_td_action leaves_action_completed">
                                    <span className="leaves_action_text">
                                      {leave.status === 'accepted'
                                        ? `Approved by ${leave.approved_by}`
                                        : `Rejected by ${leave.approved_by}`}
                                    </span>
                                  </td>
                                )}
                                {leave.status === 'pending' && leave.empid === employees[0]?.empid && (
                                  <td className="leaves_td_action leaves_action_pending">
                                    <span className="leaves_pending_text">Pending</span>
                                  </td>
                                )}
                                {leave.status === 'pending' && leave.empid !== employees[0]?.empid && (
                                  <td className="leaves_td_action leaves_action_select">
                                    <select
                                      className="leaves_pending_action_select"
                                      onChange={(e) => handleApproveChange(leave.id, leave.empid, e.target.value)}
                                      defaultValue=""
                                    >
                                      <option value="" className="leaves_action_placeholder">Select Action</option>
                                      <option value="accept" className="leaves_action_approve">Accept</option>
                                      <option value="reject" className="leaves_action_reject">Reject</option>
                                    </select>
                                  </td>
                                )}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      {leaves.length > itemsPerPage && (
                        <div className="leaves_pagination_container">
                          <button 
                            className="leaves_button secondary leaves_pagination_button" 
                            onClick={handlePrevPage} 
                            disabled={currentPage === 1}
                          >
                            <span className="leaves_pagination_arrow">←</span> Previous
                          </button>
                          <span className="leaves_pagination_text">
                            Page{' '}
                            <input 
                              type="text" 
                              value={pageInputValue} 
                              onChange={handlePageInputChange} 
                              onKeyPress={handlePageInputKeyPress} 
                              className="leaves_pagination_input" 
                            />
                            {' '}of <span className="leaves_pagination_total">{totalPages}</span>
                          </span>
                          <button 
                            className="leaves_button secondary leaves_pagination_button" 
                            onClick={handleNextPage} 
                            disabled={currentPage === totalPages}
                          >
                            Next <span className="leaves_pagination_arrow">→</span>
                          </button>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="leaves_empty_state">
                      <div className="leaves_empty_icon">📋</div>
                      <h3 className="leaves_empty_title">No Leaves Found</h3>
                      <p className="leaves_empty_description">
                        No leave records found for the selected employee.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
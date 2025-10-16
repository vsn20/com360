'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { getInitialLeaveData, fetchLeaveAssignments } from '@/app/serverActions/Leaves/Overview';
import { approveEmployeeLeave, fetchLeaveTypes } from '@/app/serverActions/Leaves/Addleave';
import './overview.css';
import PendingLeaveApprovals from './pendingleaves';
import Addleaves from './Addleaves';
import EditLeaveModal from './EditLeaveModal';

export default function Overview() {
  const [leaves, setLeaves] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [availableLeaves, setAvailableLeaves] = useState({});
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState('');
  
  const [manageableEmpIds, setManageableEmpIds] = useState([]);
  const [loggedInEmpId, setLoggedInEmpId] = useState(null);
  const [myDelegatees, setMyDelegatees] = useState([]);

  const [ispending, setispending] = useState(false);
  const [isadding, setisadding] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingLeave, setEditingLeave] = useState(null);

  const [filters, setFilters] = useState({
    leaveType: 'all', startDate: '', endDate: '', status: 'all', period: 'all'
  });

  const [currentPage, setCurrentPage] = useState(1);
  const [pageInputValue, setPageInputValue] = useState('1');
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [itemsPerPageInput, setItemsPerPageInput] = useState('10');

  // **FIX**: Renamed to `refreshAllData` for clarity
  const refreshAllData = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [managementData, leaveTypesData] = await Promise.all([
      getInitialLeaveData(),
      fetchLeaveTypes()
    ]);
    
    if (managementData.error) {
      setError(managementData.error);
    } else {
      setLoggedInEmpId(managementData.loggedInEmpId);
      setEmployees(managementData.employees);
      setLeaves(managementData.leaves);
      setManageableEmpIds(managementData.manageableEmpIds || []);
      setMyDelegatees(managementData.myDelegatees || []);
      
      if (managementData.loggedInEmpId && !selectedEmployee) {
        setSelectedEmployee(managementData.loggedInEmpId);
        setAvailableLeaves(managementData.assignments || {});
      }
    }

    if(leaveTypesData && !leaveTypesData.error){
      setLeaveTypes(leaveTypesData);
    }
    setLoading(false);
  }, [selectedEmployee]); // Keep dependency so it can be used in other hooks

  // **FIX**: Changed to `refreshAvailableLeaves` for clarity
  const refreshAvailableLeaves = useCallback(async () => {
    if (selectedEmployee) {
      // Don't set loading here to prevent full page flicker
      const assignmentsResult = await fetchLeaveAssignments(selectedEmployee);
      if (assignmentsResult.error) {
        setError(assignmentsResult.error);
        setAvailableLeaves({});
      } else {
        setAvailableLeaves(assignmentsResult);
      }
    }
  }, [selectedEmployee]); // This hook now *only* depends on selectedEmployee

  useEffect(() => {
    refreshAllData();
  }, []); // Fetch initial data only once

  useEffect(() => {
    refreshAvailableLeaves();
  }, [selectedEmployee, refreshAvailableLeaves]); // Re-run when selectedEmployee changes

  const handleFilterChange = (e) => {
    setFilters(prev => ({ ...prev, [e.target.name]: e.target.value }));
    setCurrentPage(1); setPageInputValue('1');
  };

  const resetFilters = () => {
    setFilters({ leaveType: 'all', startDate: '', endDate: '', status: 'all', period: 'all' });
    setCurrentPage(1); setPageInputValue('1');
  };

  const handleEmployeeChange = (e) => {
    setSelectedEmployee(e.target.value);
    resetFilters();
  };
  
  const handleBack = () => {
    setisadding(false); setispending(false);
    refreshAllData();
  };

  const handleApproveChange = async (leaveId, action) => {
    setError(null); setSuccess('');
    const result = await approveEmployeeLeave(leaveId, action);
    if (result.error) {
        setError(result.error);
        setTimeout(() => setError(null), 3000);
    } else {
      setSuccess('Action completed successfully!');
      setTimeout(() => setSuccess(''), 3000);
      await refreshAllData();
      await refreshAvailableLeaves(); // **FIX**: Explicitly refresh balance
    }
  };

  const handleEditClick = (leave) => {
    setEditingLeave(leave);
    setIsEditModalOpen(true);
  };

  const handleUpdateSuccess = async () => {
    setIsEditModalOpen(false); setEditingLeave(null);
    setSuccess('Leave updated successfully!');
    setTimeout(() => setSuccess(''), 3000);
    await refreshAllData();
    await refreshAvailableLeaves(); // **FIX**: Explicitly refresh balance
  };

  // **FIX**: Removed local formatDate function

  const handleNextPage = () => { if (currentPage < totalPages) { setCurrentPage(prev => prev + 1); setPageInputValue((currentPage + 1).toString()); } };
  const handlePrevPage = () => { if (currentPage > 1) { setCurrentPage(prev => prev - 1); setPageInputValue((currentPage - 1).toString()); } };
  const handlePageInputChange = (e) => setPageInputValue(e.target.value);
  const handlePageInputKeyPress = (e) => { if (e.key === 'Enter') { const value = parseInt(pageInputValue, 10); if (!isNaN(value) && value >= 1 && value <= totalPages) setCurrentPage(value); else setPageInputValue(currentPage.toString()); } };
  const handleItemsPerPageChange = (e) => setItemsPerPageInput(e.target.value);
  const handleItemsPerPageKeyPress = (e) => { if (e.key === 'Enter') { const value = parseInt(itemsPerPageInput, 10); if (!isNaN(value) && value > 0) { setItemsPerPage(value); setCurrentPage(1); setPageInputValue('1'); } else setItemsPerPageInput(itemsPerPage.toString()); } };
  
  const visibleLeaves = leaves.filter(leave => leave.empid === selectedEmployee);
  
  const filteredLeaves = visibleLeaves.filter(leave => {
    const filterStartDate = filters.startDate ? new Date(filters.startDate + 'T00:00:00Z') : null;
    const filterEndDate = filters.endDate ? new Date(filters.endDate + 'T23:59:59Z') : null;
    // Dates are already formatted, so we just filter on other fields
    return (filters.leaveType === 'all' || leave.leaveid.toString() === filters.leaveType) && (filters.status === 'all' || leave.status === filters.status) && (filters.period === 'all' || leave.am_pm === filters.period);
  });

  const totalPages = Math.ceil(filteredLeaves.length / itemsPerPage);
  const currentLeaves = filteredLeaves.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const canManageSomeone = manageableEmpIds.length > 0;

  return (
    <div className="leaves_overview_main_container">
      {isEditModalOpen && editingLeave && ( 
        <EditLeaveModal 
            leave={editingLeave} 
            onClose={() => setIsEditModalOpen(false)} 
            onSuccess={handleUpdateSuccess} 
            canEditAnytime={manageableEmpIds.includes(editingLeave.empid)} 
        /> 
      )}
      <div className="leaves_container">
        {ispending || isadding ? (
          <div className="leaves_sub_page_container">
            {ispending && <PendingLeaveApprovals onBack={handleBack} />}
            {isadding && <Addleaves onBack={handleBack} availableLeaves={availableLeaves} />}
          </div>
        ) : (
          <>
            <div className="leaves_header">
              <h2 className="leaves_title">Employee Leaves Management</h2>
              <div className="leaves_employee_section">
                <div className="leaves_employee_selector">
                  <select value={selectedEmployee} onChange={handleEmployeeChange} className="leaves_dropdown leaves_employee_dropdown">
                    {employees.map((emp) => (<option key={emp.empid} value={emp.empid}>{`${emp.EMP_FST_NAME} ${emp.EMP_LAST_NAME || ''}`}</option>))}
                  </select>
                </div>
                <div className="leaves_controls">
                  <button onClick={() => setisadding(true)} className="leaves_button primary" disabled={selectedEmployee !== loggedInEmpId}>Add Leave</button>
                  {canManageSomeone && <button className="leaves_button secondary" onClick={() => setispending(true)}>Pending Requests</button>}
                </div>
              </div>
            </div>
            <div className="leaves_filters_container">
              <div className="leaves_filter_group"><label>Leave Type</label><select name="leaveType" value={filters.leaveType} onChange={handleFilterChange}><option value="all">All</option>{leaveTypes.map(lt => <option key={lt.id} value={lt.id}>{lt.Name}</option>)}</select></div>
              <div className="leaves_filter_group"><label>Status</label><select name="status" value={filters.status} onChange={handleFilterChange}><option value="all">All</option><option value="pending">Pending</option><option value="accepted">Accepted</option><option value="rejected">Rejected</option></select></div>
              <div className="leaves_filter_group"><label>Period</label><select name="period" value={filters.period} onChange={handleFilterChange}><option value="all">All</option><option value="am">Morning</option><option value="pm">Afternoon</option><option value="both">Full Day</option></select></div>
            </div>
            
            <div className="leaves_available_section">
                <h3 className="leaves_available_title">Available Leave Balance:</h3>
                <div className="leaves_available_list">
                    {Object.keys(availableLeaves).length > 0 ? ( Object.entries(availableLeaves).map(([leaveId, leave]) => ( <div key={leaveId} className="leaves_available_item"><span className="leaves_available_name">{leave.name}</span><span className="leaves_available_count">{leave.noofleaves}</span></div> )) ) : ( <div className="leaves_available_empty">No available leaves found.</div> )}
                </div>
            </div>

            {success && <div className="leaves_success_message">{success}</div>}
            {error && <div className="leaves_error_message">{error}</div>}
            {loading ? (<div className="leaves_loading_state"><div className="leaves_loading_spinner">Loading Data...</div></div>) : (
              <div className="leaves_content_wrapper">
                {currentLeaves.length > 0 ? (
                  <>
                    <div className="leaves_table_wrapper">
                      <table className="leaves_table">
                        <thead>
                          <tr><th style={{width: '3%'}}></th><th>Leave Name</th><th>Start Date</th><th>End Date</th><th>Status</th><th>Noons</th><th>Period</th><th>Reason</th><th>Action</th></tr>
                        </thead>
                        <tbody>
                          {currentLeaves.map((leave) => {
                            const canEditAnytime = manageableEmpIds.includes(leave.empid);
                            const canEditOwnPending = (leave.empid === loggedInEmpId && leave.status === 'pending');
                            const isMyDelegateeWithPendingLeave = myDelegatees.includes(leave.empid) && leave.status === 'pending';
                            
                            const canEdit = canEditAnytime || canEditOwnPending || isMyDelegateeWithPendingLeave;
                            const canApprove = canEditAnytime && leave.empid !== loggedInEmpId && leave.status === 'pending';
                            const statusText = leave.status.charAt(0).toUpperCase() + leave.status.slice(1);
                            return (
                              <tr key={leave.id}>
                                <td className="leaves_indicator_cell"><span className={`leaves_status_indicator leaves_indicator_${leave.status}`}></span></td>
                                <td>{leave.leave_name || 'N/A'}</td>
                                {/* **FIX**: Use pre-formatted dates directly */}
                                <td>{leave.startdate}</td>
                                <td>{leave.enddate}</td>
                                <td className="leaves_status_text_cell">{statusText}</td>
                                <td>{leave.noofnoons}</td><td>{leave.am_pm}</td><td>{leave.description || '--'}</td>
                                <td>
                                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                    {canEdit && <button onClick={() => handleEditClick(leave)} className="leaves_button secondary" style={{padding: '5px 10px', fontSize: '12px'}}>Edit</button>}
                                    {canApprove ? (
                                      <select onChange={(e) => handleApproveChange(leave.id, e.target.value)} defaultValue="" className="leaves_pending_action_select">
                                        <option value="">Action</option><option value="accept">Accept</option><option value="reject">Reject</option>
                                      </select>
                                    ) : ( !canEdit && <span>{statusText}</span> )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    <div className="leaves_pagination_controls">
                      {totalPages > 1 && (
                          <div className="leaves_pagination_container">
                              <button className="leaves_button secondary" onClick={handlePrevPage} disabled={currentPage === 1}>&larr; Prev</button>
                              <span className="leaves_pagination_text"> Page <input type="number" value={pageInputValue} onChange={handlePageInputChange} onKeyPress={handlePageInputKeyPress} className="leaves_pagination_input" /> of {totalPages} </span>
                              <button className="leaves_button secondary" onClick={handleNextPage} disabled={currentPage === totalPages}>Next &rarr;</button>
                          </div>
                      )}
                      <div className="leaves_rows_per_page_container">
                          <label>Rows per page:</label>
                          <input type="number" value={itemsPerPageInput} onChange={handleItemsPerPageChange} onKeyPress={handleItemsPerPageKeyPress} className="leaves_rows_per_page_input" />
                      </div>
                    </div>
                  </>
                ) : ( <div className="leaves_empty_state">No leave records match the current filters.</div> )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
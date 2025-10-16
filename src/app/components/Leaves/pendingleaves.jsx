'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { fetchPendingLeaves } from '@/app/serverActions/Leaves/Overview';
import { approveEmployeeLeave, fetchLeaveTypes } from '@/app/serverActions/Leaves/Addleave';
import EditLeaveModal from './EditLeaveModal';
import './pendingleaves.css';

const PendingLeaveApprovals = ({ onBack }) => {
  const [pendingLeaves, setPendingLeaves] = useState([]);
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(true);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingLeave, setEditingLeave] = useState(null);
  
  const [filters, setFilters] = useState({
    searchQuery: '', leaveType: 'all', startDate: '', endDate: '', period: 'all'
  });

  const [currentPage, setCurrentPage] = useState(1);
  const [pageInputValue, setPageInputValue] = useState('1');
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [itemsPerPageInput, setItemsPerPageInput] = useState('10');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [pendingResult, leaveTypesResult] = await Promise.all([
      fetchPendingLeaves(),
      fetchLeaveTypes()
    ]);

    if (pendingResult.error) {
      setError(pendingResult.error);
      setPendingLeaves([]);
    } else {
      setPendingLeaves(pendingResult.leaves || []);
    }
    if (leaveTypesResult && !leaveTypesResult.error) {
      setLeaveTypes(leaveTypesResult);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleFilterChange = (e) => {
    setFilters(prev => ({ ...prev, [e.target.name]: e.target.value }));
    setCurrentPage(1); setPageInputValue('1');
  };

  const handleApproveChange = async (leaveId, action) => {
    setError(null); setSuccess('');
    const result = await approveEmployeeLeave(leaveId, action);
    if (result.error) {
      setError(result.error);
    } else {
      setSuccess('Action successful!');
      fetchData();
    }
  };

  const handleEditClick = (leave) => {
    setEditingLeave(leave);
    setIsEditModalOpen(true);
  };

  const handleUpdateSuccess = () => {
    setIsEditModalOpen(false); setEditingLeave(null);
    setSuccess('Leave updated successfully!');
    fetchData();
  };

  const formatDate = (date) => {
    if (!date || isNaN(new Date(date))) return '';
    const d = new Date(date);
    const month = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    return `${month}/${day}/${d.getUTCFullYear()}`;
  };

  const handleNextPage = () => { if (currentPage < totalPages) { setCurrentPage(prev => prev + 1); setPageInputValue((currentPage + 1).toString()); } };
  const handlePrevPage = () => { if (currentPage > 1) { setCurrentPage(prev => prev - 1); setPageInputValue((currentPage - 1).toString()); } };
  const handlePageInputChange = (e) => setPageInputValue(e.target.value);
  const handlePageInputKeyPress = (e) => { if (e.key === 'Enter') { const value = parseInt(pageInputValue, 10); if (!isNaN(value) && value >= 1 && value <= totalPages) setCurrentPage(value); else setPageInputValue(currentPage.toString()); } };
  const handleItemsPerPageChange = (e) => setItemsPerPageInput(e.target.value);
  const handleItemsPerPageKeyPress = (e) => { if (e.key === 'Enter') { const value = parseInt(itemsPerPageInput, 10); if (!isNaN(value) && value > 0) { setItemsPerPage(value); setCurrentPage(1); setPageInputValue('1'); } else setItemsPerPageInput(itemsPerPage.toString()); } };

  const filteredLeaves = pendingLeaves.filter(leave => {
    const leaveStartDate = new Date(leave.startdate); const leaveEndDate = new Date(leave.enddate);
    const filterStartDate = filters.startDate ? new Date(filters.startDate + 'T00:00:00Z') : null;
    const filterEndDate = filters.endDate ? new Date(filters.endDate + 'T23:59:59Z') : null;
    return leave.employee_name.toLowerCase().includes(filters.searchQuery.toLowerCase()) && (!filterStartDate || leaveEndDate >= filterStartDate) && (!filterEndDate || leaveStartDate <= filterEndDate) && (filters.leaveType === 'all' || leave.leaveid.toString() === filters.leaveType) && (filters.period === 'all' || leave.am_pm === filters.period);
  });

  const totalPages = Math.ceil(filteredLeaves.length / itemsPerPage);
  const currentLeaves = filteredLeaves.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  if (loading) return <div className="loading">Loading...</div>;

  return (
    <div className="leaves_pending_page_container">
      {/* **FIX**: This now passes the correct `canEditAnytime` prop. It's always true on this screen. */}
      {isEditModalOpen && editingLeave && ( <EditLeaveModal leave={editingLeave} onClose={() => setIsEditModalOpen(false)} onSuccess={handleUpdateSuccess} canEditAnytime={true} /> )}
      <h2 className="leaves_pending_page_title">Pending Leave Approvals</h2>
      <button onClick={onBack} className="leaves_back_button"></button>
      <div className="leaves_pending_container">
        {success && <p className="leaves_pending_message_success">{success}</p>}
        {error && <p className="leaves_error_message">{error}</p>}
        <div className="leaves_filters_container">
            <div className="leaves_filter_group"><label>Employee Name</label><input type="text" name="searchQuery" value={filters.searchQuery} onChange={handleFilterChange} placeholder="Search by name..." /></div>
            <div className="leaves_filter_group"><label>Leave Type</label><select name="leaveType" value={filters.leaveType} onChange={handleFilterChange}><option value="all">All</option>{leaveTypes.map(lt => <option key={lt.id} value={lt.id}>{lt.Name}</option>)}</select></div>
            <div className="leaves_filter_group"><label>Period</label><select name="period" value={filters.period} onChange={handleFilterChange}><option value="all">All</option><option value="am">Morning</option><option value="pm">Afternoon</option><option value="both">Full Day</option></select></div>
        </div>
        {filteredLeaves.length === 0 ? (
          <p className="leaves_pending_message_info">No pending leaves to approve.</p>
        ) : (
          <>
            <div className="leaves_pending_table_wrapper">
              <table className="leaves_pending_table">
                <thead>
                  <tr><th style={{width: '3%'}}></th><th>Employee Name</th><th>Leave Name</th><th>Start Date</th><th>End Date</th><th>Noons</th><th>Reason</th><th>Action</th></tr>
                </thead>
                <tbody>
                  {currentLeaves.map((leave) => (
                    <tr key={leave.id}>
                      <td className="leaves_indicator_cell"><span className={`leaves_status_indicator leaves_indicator_${leave.status}`}></span></td>
                      <td>{leave.employee_name}</td><td>{leave.leave_name || 'N/A'}</td><td>{formatDate(leave.startdate)}</td><td>{formatDate(leave.enddate)}</td><td>{leave.noofnoons}</td><td>{leave.description || '--'}</td>
                      <td>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <button onClick={() => handleEditClick(leave)} className="leaves_button secondary" style={{padding: '5px 10px', fontSize: '12px', whiteSpace: 'nowrap'}}>Edit</button>
                            <select className="leaves_pending_action_select" onChange={(e) => handleApproveChange(leave.id, e.target.value)} defaultValue="">
                                <option value="">Action</option><option value="accept">Accept</option><option value="reject">Reject</option>
                            </select>
                        </div>
                      </td>
                    </tr>
                  ))}
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
        )}
      </div>
    </div>
  );
};
export default PendingLeaveApprovals;
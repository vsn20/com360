'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { fetchPendingTimesheets, approveTimesheet } from '@/app/serverActions/Timesheets/Pending';
import './ApprovalPending.css';

const ApprovalPending = ({ onBack }) => {
  const router = useRouter();
  const [allTimesheets, setAllTimesheets] = useState([]);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [loading, setLoading] = useState(true);

  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageInputValue, setPageInputValue] = useState('1');
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [itemsPerPageInput, setItemsPerPageInput] = useState('10');

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      setSuccess(false);
      const result = await fetchPendingTimesheets();
      
      if (result.error) {
        setError(result.error);
        setAllTimesheets([]);
        if (result.error.includes('You are not authorized')) {
          router.push('/userscreens/timesheets');
        }
      } else {
        const groupedTimesheets = {};
        result.C_TIMESHEETS.forEach(ts => {
          const key = `${ts.employee_id}_${ts.week_start_date}`;
          if (!groupedTimesheets[key]) {
            groupedTimesheets[key] = {
              employee_id: ts.employee_id,
              employee_name: ts.employee_name,
              week_start_date: ts.week_start_date,
              total_hours: 0,
              timesheet_ids: [],
              project_hours: {},
            };
          }
          groupedTimesheets[key].total_hours += ts.total_hours;
          groupedTimesheets[key].timesheet_ids.push(ts.timesheet_id);
          groupedTimesheets[key].project_hours[ts.project_name] = (groupedTimesheets[key].project_hours[ts.project_name] || 0) + ts.total_hours;
        });
        setAllTimesheets(Object.values(groupedTimesheets));
      }
      setLoading(false);
    };
    fetchData();
  }, [router]);

  const handleApproveChange = async (employeeId, weekStartDate, timesheetIds) => {
    setError(null);
    setSuccess(false);
    for (const timesheetId of timesheetIds) {
      const result = await approveTimesheet(timesheetId, employeeId);
      if (result.error) {
        setError(result.error);
        return;
      }
    }
    setAllTimesheets(prev => prev.filter(ts => !(ts.employee_id === employeeId && ts.week_start_date === weekStartDate)));
    setSuccess('Timesheet approved successfully!');
    setTimeout(() => setSuccess(null), 3000);
  };

  const formatDate = (date) => {
    if (!date || isNaN(new Date(date))) return '';
    const d = new Date(date);
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${month}/${day}/${d.getFullYear()}`;
  };

  const filteredTimesheets = allTimesheets.filter(ts =>
    ts.employee_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalPages = Math.ceil(filteredTimesheets.length / itemsPerPage);
  const currentTimesheets = filteredTimesheets.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(prev => prev + 1);
      setPageInputValue((currentPage + 1).toString());
    }
  };

  const handlePrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(prev => prev - 1);
      setPageInputValue((currentPage - 1).toString());
    }
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

  const handleItemsPerPageInputChange = (e) => {
    setItemsPerPageInput(e.target.value);
  };

  const handleItemsPerPageInputKeyPress = (e) => {
    if (e.key === 'Enter') {
      const value = parseInt(e.target.value, 10);
      if (!isNaN(value) && value >= 1) {
        setItemsPerPage(value);
        setItemsPerPageInput(value.toString());
        setCurrentPage(1);
        setPageInputValue('1');
      } else {
        setItemsPerPageInput(itemsPerPage.toString());
        setCurrentPage(1);
        setPageInputValue('1');
      }
    }
  };

  if (loading) return <div className="loading">Loading...</div>;
  if (error) return <div className="error">{error}</div>;

  return (
    <div className="pending_timesheets_page_container">
      <h2 className="pending_timesheets_page_title">Pending Timesheet Approvals</h2>
      {onBack && <button onClick={onBack} className="pending_timesheets_back-button"></button>}
      
      <div className="pending_timesheets_content_container">
        {error && <p className="pending_timesheets_error_message">{error}</p>}
        {success && <p className="pending_timesheets_success_message">{success}</p>}
        
        <div className="pending_timesheets_controls_header">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pending_timesheets_search-input"
            placeholder="Search by employee name..."
          />
        </div>
        
        {loading ? (
          <p className="pending_timesheets_empty_state">Loading...</p>
        ) : currentTimesheets.length === 0 ? (
          <p className="pending_timesheets_empty_state">No pending timesheets found.</p>
        ) : (
          <>
            <div className="pending_timesheets_table_wrapper">
              <table className="pending_timesheets_table">
                <thead>
                  <tr>
                    <th>Employee Name</th>
                    <th>Week Start Date</th>
                    <th>Total Hours</th>
                    <th>Project Breakdown</th>
                    <th>Approve</th>
                  </tr>
                </thead>
                <tbody>
                  {currentTimesheets.map((ts) => (
                    <tr key={`${ts.employee_id}_${ts.week_start_date}`}>
                      <td>{ts.employee_name}</td>
                      <td>{formatDate(ts.week_start_date)}</td>
                      <td>{ts.total_hours.toFixed(2)}</td>
                      <td>
                        <ul className="pending_timesheets_project_breakdown">
                          {Object.entries(ts.project_hours).map(([projectName, hours]) => (
                            <li key={projectName}>{projectName}: {hours.toFixed(2)} hours</li>
                          ))}
                        </ul>
                      </td>
                      <td>
                        <input
                          type="checkbox"
                          className="pending_timesheets_action_checkbox"
                          onChange={() => handleApproveChange(ts.employee_id, ts.week_start_date, ts.timesheet_ids)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {filteredTimesheets.length > itemsPerPage && (
              <div className="pending_timesheets_pagination_container">
                <button className="pending_timesheets_button" onClick={handlePrevPage} disabled={currentPage === 1}>
                  &larr; Previous
                </button>
                <span className="pending_timesheets_pagination_text">
                  Page{' '}
                  <input
                    type="text"
                    value={pageInputValue}
                    onChange={handlePageInputChange}
                    onKeyPress={handlePageInputKeyPress}
                    className="pending_timesheets_pagination_input"
                  />{' '}
                  of {totalPages}
                </span>
                <button className="pending_timesheets_button" onClick={handleNextPage} disabled={currentPage === totalPages}>
                  Next &rarr;
                </button>
              </div>
            )}
            {filteredTimesheets.length > 0 && (
              <div className="pending_timesheets_rows-per-page-container">
                <label className="pending_timesheets_rows-per-page-label">Rows/ Page</label>
                <input
                  type="text"
                  value={itemsPerPageInput}
                  onChange={handleItemsPerPageInputChange}
                  onKeyPress={handleItemsPerPageInputKeyPress}
                  className="pending_timesheets_rows-per-page-input"
                  aria-label="Number of rows per page"
                />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default ApprovalPending;
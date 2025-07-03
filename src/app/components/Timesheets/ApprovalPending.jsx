'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { fetchPendingTimesheets, approveTimesheet } from '@/app/serverActions/Timesheets/Pending';
import './ApprovalPending.css';

const ApprovalPending = () => {
  const router = useRouter();
  const [timesheets, setTimesheets] = useState([]);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      setError(null);
      setSuccess(false);
      const result = await fetchPendingTimesheets();
      if (result.error) {
        setError(result.error);
        setTimesheets([]);
        if (result.error.includes('You are not authorized to view pending timesheets')) {
          router.push('/userscreens/timesheets');
        }
      } else {
        setTimesheets(result.timesheets || []);
      }
    };
    fetchData();
  }, [router]);

  const handleApproveChange = async (timesheetId, employeeId) => {
    setError(null);
    setSuccess(false);
    const result = await approveTimesheet(timesheetId, employeeId);
    if (result.error) {
      setError(result.error);
      if (result.error.includes('You are not authorized to approve this timesheet')) {
        router.push('/userscreens/timesheets');
      }
      return;
    }
    setTimesheets(prev => prev.filter(ts => ts.timesheet_id !== timesheetId));
    setSuccess(true);
  };

  const formatDate = (date) => {
    if (!date || isNaN(new Date(date))) return '';
    const d = new Date(date);
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${month}/${day}/${d.getFullYear()}`;
  };

  return (
    <div className="timesheet-container">
      <div className="content-wrapper">
        <h2 className="timesheet-title">Pending Timesheet Approvals</h2>
        {error && <p className="error-message">{error}</p>}
        {success && <p className="success-message">Timesheet approved successfully!</p>}
        {timesheets.length === 0 ? (
          <p className="no-timesheets-message">No pending timesheets for approval.</p>
        ) : (
          <div className="table-wrapper">
            <table className="timesheet-table">
              <thead>
                <tr>
                  <th>Employee Name</th>
                  <th>Project Name</th>
                  <th>Week Start Date</th>
                  <th>Total Hours</th>
                  <th>Approve</th>
                </tr>
              </thead>
              <tbody>
                {timesheets.map((ts) => (
                  <tr key={ts.timesheet_id}>
                    <td>{ts.employee_name}</td>
                    <td>{ts.project_name}</td>
                    <td>{formatDate(ts.week_start_date)}</td>
                    <td>{ts.total_hours.toFixed(2)}</td>
                    <td>
                      <input
                        type="checkbox"
                        checked={false}
                        onChange={() => handleApproveChange(ts.timesheet_id, ts.employee_id)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default ApprovalPending;
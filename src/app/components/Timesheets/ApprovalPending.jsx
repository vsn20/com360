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
        // Group timesheets by employee_id and week_start_date
        const groupedTimesheets = {};
        result.timesheets.forEach(ts => {
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
        setTimesheets(Object.values(groupedTimesheets));
      }
    };
    fetchData();
  }, [router]);

  const handleApproveChange = async (employeeId, weekStartDate, timesheetIds) => {
    setError(null);
    setSuccess(false);
    // Approve all timesheets for the week
    for (const timesheetId of timesheetIds) {
      const result = await approveTimesheet(timesheetId, employeeId);
      if (result.error) {
        setError(result.error);
        if (result.error.includes('You are not authorized to approve this timesheet')) {
          router.push('/userscreens/timesheets');
        }
        return;
      }
    }
    setTimesheets(prev => prev.filter(ts => !(ts.employee_id === employeeId && ts.week_start_date === weekStartDate)));
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
                  <th>Week Start Date</th>
                  <th>Total Hours</th>
                  <th>Project Names & Hours</th>
                  <th>Approve</th>
                </tr>
              </thead>
              <tbody>
                {timesheets.map((ts) => (
                  <tr key={`${ts.employee_id}_${ts.week_start_date}_${ts.timesheet_ids[0] || 'default'}`}>
                    <td>{ts.employee_name}</td>
                    <td>{formatDate(ts.week_start_date)}</td>
                    <td>{ts.total_hours.toFixed(2)}</td>
                    <td>
                      <ul className="project-breakdown">
                        {Object.entries(ts.project_hours).map(([projectName, hours], index) => (
                          <li key={index}>{projectName}: {hours.toFixed(2)} hours</li>
                        ))}
                      </ul>
                    </td>
                    <td>
                      <input
                        type="checkbox"
                        checked={false}
                        onChange={() => handleApproveChange(ts.employee_id, ts.week_start_date, ts.timesheet_ids)}
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
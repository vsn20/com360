'use client';
import React, { useState, useEffect } from 'react';
import { fetchPendingLeaves, fetchEmployeesUnderSuperior } from '@/app/serverActions/Leaves/Overview';
import { approveEmployeeLeave, fetchLeaveTypes } from '@/app/serverActions/Leaves/Addleave';
import './pendingleaves.css';
import { useRouter } from 'next/navigation';

const PendingLeaveApprovals = ({ onBack }) => { // Accept onBack as a prop
  const router = useRouter();
  const [pendingLeaves, setPendingLeaves] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setError(null);
      setSuccess(false);
      setLoading(true);

      const employeesResult = await fetchEmployeesUnderSuperior();
      if (employeesResult.error) {
        setError(employeesResult.error);
        setEmployees([]);
      } else {
        setEmployees(employeesResult.employees);
      }

      const leaveTypesResult = await fetchLeaveTypes();
      if (leaveTypesResult.error) {
        setError(leaveTypesResult.error);
      } else {
        setLeaveTypes(leaveTypesResult);
      }

      const result = await fetchPendingLeaves();
      if (result.error) {
        setError(result.error);
        setPendingLeaves([]);
        if (result.error.includes('You are not authorized')) {
          router.push('/userscreens/leaves');
        }
      } else {
        const currentEmpId = employees[0]?.empid;
        setPendingLeaves(result.leaves.filter(leave => leave.empid !== currentEmpId));
      }

      setLoading(false);
    };
    fetchData();
  }, [router]);

  const handleApproveChange = async (leaveId, empId, action) => {
    console.log('Approving leaveId:', leaveId, 'for empId:', empId, 'with action:', action); // Debug log
    setError(null);
    setSuccess(false);
    const result = await approveEmployeeLeave(leaveId, action);
    if (result.error) {
      setError(result.error);
    } else {
      setPendingLeaves(prev => prev.filter(l => l.id !== leaveId));
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

  if (loading) return <div className="loading">Loading...</div>;
  if (error) return <div className="error">{error}</div>;

  return (
    <div className="leaves_pending_page_container">
      <h2 className="leaves_pending_page_title">Pending Leave Approvals</h2>
      <button onClick={onBack} className="leaves_back_button"></button>

      <div className="leaves_pending_container">
        {success && <p className="leaves_pending_message_success">Leave action successful!</p>}
        {pendingLeaves.length === 0 ? (
          <p className="leaves_pending_message_info">No pending leave requests.</p>
        ) : (
          <div className="leaves_pending_table_wrapper">
            <table className="leaves_pending_table">
              <thead>
                <tr>
                  <th>Employee Name</th>
                  <th>Leave Name</th>
                  <th>Start Date</th>
                  <th>End Date</th>
                  <th>No. of Noons</th>
                  <th>AM/PM</th>
                  <th>Reason</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {pendingLeaves.map((leave) => (
                  <tr key={leave.id}>
                    <td>{leave.employee_name}</td>
                    <td>{leave.leave_name || 'Unknown Leave Type'}</td>
                    <td>{formatDate(leave.startdate)}</td>
                    <td>{formatDate(leave.enddate)}</td>
                    <td>{leave.noofnoons}</td>
                    <td>{leave.am_pm}</td>
                    <td>{leave.description || 'No reason provided'}</td>
                    <td>
                      <select
                        className="leaves_pending_action_select"
                        onChange={(e) => handleApproveChange(leave.id, leave.empid, e.target.value)}
                        defaultValue=""
                      >
                        <option value="">Select Action</option>
                        <option value="accept">Accept</option>
                        <option value="reject">Reject</option>
                      </select>
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

export default PendingLeaveApprovals;
'use client'
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { fetchEmployeeLeaves, fetchPendingLeaves, fetchEmployeesUnderSuperior, fetchLeaveAssignments } from '@/app/serverActions/Leaves/Overview';
import { approveEmployeeLeave } from '@/app/serverActions/Leaves/Addleave';
import './overview.css';

export default function Overview() {
  const [leaves, setLeaves] = useState([]);
  const [pendingLeaves, setPendingLeaves] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [availableLeaves, setAvailableLeaves] = useState({});
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState(false);
  const [isSuperior, setIsSuperior] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const fetchData = async () => {
      setError(null);
      setSuccess(false);
      setLoading(true);

      const employeesResult = await fetchEmployeesUnderSuperior();
      if (employeesResult.error) {
        alert(employeesResult.error);
        window.location.reload();
        setEmployees([]);
        setIsSuperior(false);
      } else {
        setEmployees(employeesResult.employees);
        const currentEmpId = employeesResult.employees[0]?.empid;
        setSelectedEmployee(currentEmpId || '');
        setIsSuperior(employeesResult.employees.length > 1);
        if (currentEmpId) {
          const [leavesResult, availableLeavesResult] = await Promise.all([
            fetchEmployeeLeaves(currentEmpId),
            fetchLeaveAssignments(currentEmpId),
          ]);
          if (leavesResult.error) {
            alert(leavesResult.error);
            window.location.reload();
          } else {
            setLeaves(leavesResult);
          }
          if (availableLeavesResult.error) {
            alert(availableLeavesResult.error);
            window.location.reload();
          } else {
            setAvailableLeaves(availableLeavesResult);
          }
        }
      }

      const pendingResult = await fetchPendingLeaves();
      if (pendingResult.error) {
        setPendingLeaves([]);
        if (!pendingResult.error.includes('You are not authorized')) {
          alert(pendingResult.error);
          window.location.reload();
        }
      } else {
        setPendingLeaves(pendingResult.leaves);
      }

      setLoading(false);
    };
    fetchData();
  }, []);

  const handleEmployeeChange = async (e) => {
    const empId = e.target.value;
    setSelectedEmployee(empId);
    if (empId) {
      const [leavesResult, availableLeavesResult] = await Promise.all([
        fetchEmployeeLeaves(empId),
        fetchLeaveAssignments(empId),
      ]);
      if (leavesResult.error) {
        alert(leavesResult.error);
        window.location.reload();
      } else {
        setLeaves(leavesResult);
      }
      if (availableLeavesResult.error) {
        alert(availableLeavesResult.error);
        window.location.reload();
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
      alert('Please select an employee.');
      window.location.reload();
      return;
    }
    router.push(`/userscreens/leaves/addleave?empid=${selectedEmployee}`);
  };

  const handleApproveChange = async (leaveId, empId, action) => {
    console.log('Approving leaveId:', leaveId, 'for empId:', empId, 'with action:', action);
    setError(null);
    setSuccess(false);
    const result = await approveEmployeeLeave(leaveId, action);
    if (result.error) {
      alert(result.error);
      window.location.reload();
    } else {
      if (selectedEmployee) {
        const [leavesResult, availableLeavesResult] = await Promise.all([
          fetchEmployeeLeaves(selectedEmployee),
          fetchLeaveAssignments(selectedEmployee),
        ]);
        if (leavesResult.error) {
          alert(leavesResult.error);
          window.location.reload();
        } else {
          setLeaves(leavesResult);
        }
        if (availableLeavesResult.error) {
          alert(availableLeavesResult.error);
          window.location.reload();
        } else {
          setAvailableLeaves(availableLeavesResult);
        }
      }
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

  return (
    <div className="container">
      {loading && <div className="loading">Loading leaves...</div>}
      {success && <div className="success-message">Action successful!</div>}
      {!loading && !error && (
        <div className="content-wrapper">
          <div className="main-content">
            <h2 className="heading">Employee Leaves</h2>
            <div className="controls">
              <select
                value={selectedEmployee}
                onChange={handleEmployeeChange}
                className="employee-dropdown"
              >
                <option value="">Select an Employee</option>
                {employees.map((emp) => (
                  <option key={emp.empid} value={emp.empid}>
                    {`${emp.EMP_FST_NAME} ${emp.EMP_LAST_NAME || ''}`}
                  </option>
                ))}
              </select>
              <button
                onClick={handleAddLeave}
                disabled={!selectedEmployee || selectedEmployee !== employees[0]?.empid}
              >
                Add Leave
              </button>
              {isSuperior && (
                <button
                  className="pending-requests-button"
                  onClick={() => router.push('/userscreens/leaves/pending')}
                >
                  Pending Requests
                </button>
              )}
            </div>
            {leaves.length === 0 ? (
              <p className="no-leaves">No leaves assigned for selected employee.</p>
            ) : (
              <div className="table-container">
                <table className="table">
                  <thead>
                    <tr>
                     
                      <th>Leave Name</th>
                      <th>Start Date</th>
                      <th>End Date</th>
                      <th>Status</th>
                      <th>No. of Noons</th>
                      <th>AM/PM</th>
                      <th>Reason</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leaves.map((leave) => (
                      <tr key={leave.id}>
                        
                        <td>{leave.leave_name || 'Unknown Leave Type'}</td>
                        <td>{formatDate(leave.startdate)}</td>
                        <td>{formatDate(leave.enddate)}</td>
                        <td>
                          <span
                            className={`status-badge ${
                              leave.status === 'accepted'
                                ? 'status-approved'
                                : leave.status === 'pending'
                                  ? 'status-pending'
                                  : 'status-rejected'
                            }`}
                          >
                            {leave.status.charAt(0).toUpperCase() + leave.status.slice(1)}
                          </span>
                        </td>
                        <td>{leave.noofnoons}</td>
                        <td>{leave.am_pm}</td>
                        <td>{leave.description || 'No reason provided'}</td>
                        {leave.status !== 'pending' && (
                          <td>
                            {leave.status === 'accepted'
                              ? `Approved by ${leave.approved_by}(${leave.approved_role})`
                              : `Rejected by ${leave.approved_by}(${leave.approved_role})`}
                          </td>
                        )}
                        {leave.status === 'pending' && leave.empid !== employees[0]?.empid && isSuperior && (
                          <td>
                            <select
                              onChange={(e) => handleApproveChange(leave.id, leave.empid, e.target.value)}
                              defaultValue=""
                            >
                              <option value="">Select Action</option>
                              <option value="accept">Accept</option>
                              <option value="reject">Reject</option>
                            </select>
                          </td>
                        )}
                        {leave.status === 'pending' && leave.empid === employees[0]?.empid && (
                          <td>Pending</td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          <div className="available-leaves-box">
            <h3>Available Leaves</h3>
            {Object.keys(availableLeaves).length === 0 ? (
              <p>No available leaves for selected employee.</p>
            ) : (
              <ul>
                {Object.entries(availableLeaves).map(([leaveId, leave]) => (
                  <li key={leaveId}>
                    {leave.name}: {leave.noofleaves}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
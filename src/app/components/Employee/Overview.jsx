'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { fetchEmployeesByOrgId } from '@/app/serverActions/Employee/overview';
import './overview.css';

const Overview = () => {
  const [employees, setEmployees] = useState([]);
  const [error, setError] = useState(null);
  const router = useRouter();

  useEffect(() => {
    const loadEmployees = async () => {
      try {
        const employeeData = await fetchEmployeesByOrgId();
        setEmployees(employeeData);
        setError(null);
      } catch (err) {
        console.error('Error loading employees:', err);
        setError(err.message);
        setEmployees([]);
      }
    };
    loadEmployees();
  }, []);

  const handleEdit = (empid) => {
    router.push(`/userscreens/employee/edit/${empid}`);
  };

  return (
    <div className="overview-container">
      {error && <div className="error-message">{error}</div>}
      {employees.length === 0 && !error ? (
        <p>No active employees found.</p>
      ) : (
        <table className="employee-table">
          <thead>
            <tr>
              <th>Employee ID</th>
              <th>Name</th>
              <th>Email</th>
              <th>Hire Date</th>
              <th>Mobile</th>
              <th>Gender</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {employees.map((employee) => (
              <tr key={employee.empid}>
                <td>{employee.empid}</td>
                <td>
                  {employee.EMP_PREF_NAME || `${employee.EMP_FST_NAME} ${employee.EMP_MID_NAME || ''} ${employee.EMP_LAST_NAME}`.trim()}
                </td>
                <td>{employee.email}</td>
                <td>{employee.HIRE ? new Date(employee.HIRE).toLocaleDateString('en-US') : '-'}</td>
                <td>{employee.MOBILE_NUMBER || '-'}</td>
                <td>{employee.GENDER || '-'}</td>
                <td>
                  <button className="edit-button" onClick={() => handleEdit(employee.empid)}>
                    ✏️
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default Overview;